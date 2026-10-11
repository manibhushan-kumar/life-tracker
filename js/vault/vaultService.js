// --- Vault service (in-memory unlock state machine) ---------------------
// Owns the ONLY two pieces of sensitive state that ever exist anywhere in
// this feature while the app is running:
//   _vaultKey  - a non-extractable CryptoKey (crypto.js derives it, nobody
//                can pull its raw bytes back out, not even this file)
//   _vaultData - the decrypted { items: [...] } object
// Neither is ever assigned to `window`, written to localStorage/
// sessionStorage/IndexedDB, logged, or included in anything sent to Google
// Drive. They live ONLY as closures inside this IIFE and are nulled out
// the moment the vault locks (manually, or via auto-lock after 2 minutes idle).
//
// vaultStore.js is the only other file this one talks to, and only ever
// with opaque {kdf, encryption, ciphertext} blobs - this is the one place
// in the whole feature that actually calls crypto.subtle.

const VAULT_INACTIVITY_LOCK_MS = 2 * 60 * 1000; // 2 min idle
const VAULT_COUNTDOWN_THRESHOLD_MS = 30 * 1000; // 30 sec before expiry

const vaultService = (() => {
  let _vaultKey = null;
  let _vaultData = null; // { items: [...] }
  let _lockListeners = [];
  let _countdownListeners = [];

  let _tickerInterval = null;
  let _watchersActive = false;
  let _lastActivityTime = 0;
  let _lastReportedSeconds = null;

  function _notifyCountdown(secondsRemaining) {
    _countdownListeners.forEach(cb => {
      try { cb(secondsRemaining); } catch (e) {}
    });
  }

  function vaultOnCountdown(callback) {
    _countdownListeners.push(callback);
  }

  function _tick() {
    if (!_watchersActive) return;
    const idleTime = Date.now() - _lastActivityTime;
    const remainingMs = VAULT_INACTIVITY_LOCK_MS - idleTime;
    if (remainingMs <= 0) {
      vaultLock();
      return;
    }
    if (remainingMs <= VAULT_COUNTDOWN_THRESHOLD_MS) {
      const remainingSecs = Math.max(1, Math.ceil(remainingMs / 1000));
      if (remainingSecs !== _lastReportedSeconds) {
        _lastReportedSeconds = remainingSecs;
        _notifyCountdown(remainingSecs);
      }
    } else {
      if (_lastReportedSeconds !== null) {
        _lastReportedSeconds = null;
        _notifyCountdown(null);
      }
    }
  }

  function _onActivity() {
    if (!_watchersActive) return;
    const now = Date.now();
    if (_lastActivityTime && (now - _lastActivityTime >= VAULT_INACTIVITY_LOCK_MS)) {
      vaultLock();
      return;
    }
    _lastActivityTime = now;
    if (_lastReportedSeconds !== null) {
      _lastReportedSeconds = null;
      _notifyCountdown(null);
    }
  }

  function vaultResetActivity() {
    _onActivity();
  }

  function _onVisibilityChange() {
    if (!_watchersActive) return;
    if (document.hidden) {
      vaultLock();
    }
  }

  function _onPageHide() {
    if (vaultIsUnlocked()) {
      vaultLock();
    }
  }

  const ACTIVITY_EVENTS = ['click', 'keydown', 'touchstart', 'pointerdown', 'input', 'wheel'];

  function vaultStartAutoLockWatchers() {
    if (_watchersActive) return;
    _watchersActive = true;
    _lastActivityTime = Date.now();
    _lastReportedSeconds = null;
    ACTIVITY_EVENTS.forEach(evt =>
      document.addEventListener(evt, _onActivity, { passive: true })
    );
    document.addEventListener('visibilitychange', _onVisibilityChange);
    window.addEventListener('pagehide', _onPageHide);
    clearInterval(_tickerInterval);
    _tickerInterval = setInterval(_tick, 500);
  }

  function vaultStopAutoLockWatchers() {
    _watchersActive = false;
    _lastActivityTime = 0;
    clearInterval(_tickerInterval);
    if (_lastReportedSeconds !== null) {
      _lastReportedSeconds = null;
      _notifyCountdown(null);
    }
    ACTIVITY_EVENTS.forEach(evt =>
      document.removeEventListener(evt, _onActivity)
    );
    document.removeEventListener('visibilitychange', _onVisibilityChange);
    window.removeEventListener('pagehide', _onPageHide);
  }

  function vaultOnLock(callback) {
    _lockListeners.push(callback);
  }

  function vaultIsUnlocked() {
    if (_watchersActive && _lastActivityTime && (Date.now() - _lastActivityTime >= VAULT_INACTIVITY_LOCK_MS)) {
      vaultLock();
      return false;
    }
    return !!_vaultKey && !!_vaultData;
  }

  async function vaultHasVault() {
    return vaultStoreExists();
  }

  // Encrypts the CURRENT in-memory _vaultData under _vaultKey and persists
  // it. Always mints a fresh IV (required for GCM); reuses whatever salt/
  // iterations the blob already has unless the caller is mid password-change
  // (which passes its own kdf object representing the NEW salt).
  async function _persist(kdfOverride) {
    const existing = await vaultStoreGetBlob();
    const kdf = kdfOverride || (existing && existing.kdf);
    if (!kdf) throw new Error('Vault has no KDF parameters to persist against.');
    const { iv, ciphertext } = await vaultEncryptJson(_vaultKey, _vaultData);
    await vaultStoreSaveBlob({
      kdf,
      encryption: { algorithm: 'AES-256-GCM', iv },
      ciphertextB64: ciphertext,
      updatedAt: new Date().toISOString()
    });
  }

  // Creates a brand-new, empty vault. Throws if one already exists locally -
  // callers (vaultUI) must route an existing installation through
  // vaultUnlock() instead.
  async function vaultCreate(masterPassword) {
    if (await vaultStoreExists()) throw new Error('A vault already exists on this device.');
    if (!masterPassword) throw new Error('Master password is required.');

    const salt = vaultGenerateSalt();
    const kdf = { algorithm: 'PBKDF2-SHA256', iterations: VAULT_PBKDF2_ITERATIONS, salt: vaultBytesToBase64(salt) };
    _vaultKey = await vaultDeriveKey(masterPassword, salt, kdf.iterations);
    _vaultData = { items: [] };
    await _persist(kdf);
    vaultStartAutoLockWatchers();
  }

  // Throws a plain Error with `.code === 'WRONG_PASSWORD'` on a bad
  // password, or `.code === 'NO_VAULT'` if nothing has been created yet -
  // vaultUI checks these codes to show a friendly message without the raw
  // WebCrypto exception (which is fine to surface too, but these codes keep
  // the UI's wording independent of crypto.js's internals).
  async function vaultUnlock(masterPassword) {
    const blob = await vaultStoreGetBlob();
    if (!blob) {
      const err = new Error('No vault exists on this device yet.');
      err.code = 'NO_VAULT';
      throw err;
    }
    const salt = vaultBase64ToBytes(blob.kdf.salt);
    const key = await vaultDeriveKey(masterPassword, salt, blob.kdf.iterations);
    let data;
    try {
      data = await vaultDecryptJson(key, blob.encryption.iv, blob.ciphertext);
    } catch (e) {
      const err = new Error('Incorrect master password.');
      err.code = 'WRONG_PASSWORD';
      throw err;
    }
    _vaultKey = key;
    _vaultData = data;
    vaultStartAutoLockWatchers();
  }

  // Locking is the ONE operation that must never throw and never partially
  // complete - it's called from idle timers, not just a button, so it has
  // to be safe to call unconditionally and often (including when already locked - a no-op in that case).
  function vaultLock() {
    vaultStopAutoLockWatchers();
    _vaultKey = null;
    _vaultData = null;
    _lockListeners.forEach(cb => {
      try { cb(); } catch (e) { /* a broken UI listener must not stop the lock itself */ }
    });
  }

  function _requireUnlocked() {
    if (!vaultIsUnlocked()) throw new Error('Vault is locked.');
  }

  // Re-derives a key under a brand new random salt and re-encrypts the
  // CURRENTLY decrypted data with it. Requires the vault to already be
  // unlocked (i.e. the caller already proved they know the current master
  // password by unlocking) rather than re-accepting it here, so there is
  // exactly one place in the whole feature that verifies a master password.
  async function vaultChangeMasterPassword(newPassword) {
    _requireUnlocked();
    if (!newPassword) throw new Error('New master password is required.');
    const salt = vaultGenerateSalt();
    const kdf = { algorithm: 'PBKDF2-SHA256', iterations: VAULT_PBKDF2_ITERATIONS, salt: vaultBytesToBase64(salt) };
    const newKey = await vaultDeriveKey(newPassword, salt, kdf.iterations);
    _vaultKey = newKey;
    await _persist(kdf);
  }

  function vaultGetItems() {
    _requireUnlocked();
    // Defensive deep copy - callers (vaultUI) render/edit freely without
    // being able to accidentally mutate the in-memory vault without going
    // through vaultAddItem/vaultUpdateItem/vaultDeleteItem (which persist).
    return JSON.parse(JSON.stringify(_vaultData.items));
  }

  async function vaultAddItem(item) {
    _requireUnlocked();
    const now = new Date().toISOString();
    const toSave = { ...item, id: 'vitem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8), createdAt: now, updatedAt: now };
    _vaultData.items.push(toSave);
    await _persist();
    return toSave;
  }

  async function vaultUpdateItem(id, patch) {
    _requireUnlocked();
    const idx = _vaultData.items.findIndex(i => i.id === id);
    if (idx === -1) throw new Error('Vault item not found.');
    _vaultData.items[idx] = { ..._vaultData.items[idx], ...patch, id, updatedAt: new Date().toISOString() };
    await _persist();
    return _vaultData.items[idx];
  }

  async function vaultDeleteItem(id) {
    _requireUnlocked();
    _vaultData.items = _vaultData.items.filter(i => i.id !== id);
    await _persist();
  }

  // Used only by vaultSync.js's "Pull from Drive" path, after the user has
  // explicitly confirmed overwriting their LOCAL blob with the remote one.
  // It replaces the stored blob wholesale and, if the vault happens to be
  // unlocked right now, locks it immediately - the in-memory key was
  // derived against the OLD salt and can no longer be assumed valid against
  // whatever the remote blob actually contains.
  function vaultLockIfUnlocked() {
    if (vaultIsUnlocked()) vaultLock();
  }

  // The "forgot my master password" recovery path - there is deliberately
  // NO way to recover the old contents (that's the whole point of never
  // storing the password anywhere), so this just wipes the local encrypted
  // blob entirely so vaultCreate() can start over. Does NOT touch Google
  // Drive - a vault synced there earlier is left exactly as it was. It
  // DOES mark syncMeta.vaultLocalResetSinceSync so the next Drive sync from
  // this device knows to ask Pull/Overwrite/Cancel instead of silently
  // assuming the freshly-created (and therefore "newer") empty vault should
  // win - see vaultSyncUpload() in vaultSync.js.
  async function vaultResetVault() {
    vaultLock();
    await vaultStoreDeleteBlob();
    await saveSyncMeta({ vaultLocalResetSinceSync: true });
  }

  return {
    vaultHasVault,
    vaultIsUnlocked,
    vaultCreate,
    vaultUnlock,
    vaultLock,
    vaultLockIfUnlocked,
    vaultResetVault,
    vaultChangeMasterPassword,
    vaultGetItems,
    vaultAddItem,
    vaultUpdateItem,
    vaultDeleteItem,
    vaultOnLock,
    vaultOnCountdown,
    vaultResetActivity,
    vaultStartAutoLockWatchers,
    vaultStopAutoLockWatchers
  };
})();

// Flattened onto globals (this project has no module system - every other
// feature file follows the same "plain functions in global scope" pattern,
// see splitwise.js/world-clock.js) so vaultUI.js/vaultSync.js/index.html can
// call e.g. vaultUnlock(...) directly instead of vaultService.vaultUnlock(...).
Object.assign(window, vaultService);
