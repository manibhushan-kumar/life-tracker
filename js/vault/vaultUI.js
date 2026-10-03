// --- Vault UI (Credentials & Cards) --------------------------------------
// Rendered as a normal in-app page (navigate('vault') -> #mainContainer),
// same "render function takes the container" convention as every other page
// (see js/world-clock.js/js/groups.js). Reached via the Quick Add (+) sheet
// (index.html), same shelf as World Clock/New Group - it's lock-gated, so
// there's nothing unsafe about it not being a persistent nav item.
//
// This file ONLY ever touches plaintext vault contents that vaultService.js
// (js/vault/vaultService.js) already handed it post-unlock - it never talks
// to IndexedDB or crypto.subtle directly. Item add/edit forms reuse the
// app's existing #formModal/#formModalContent pattern (see openExpenseForm
// in index.html) rather than inventing a second modal system.
//
// Security note on the masked fields below: toggling "show" or using "copy"
// puts the real secret into the DOM/clipboard, same as any password manager
// while unlocked - this app makes no claim that DevTools/clipboard history
// can't see it in that moment. What IS guaranteed is that locking (manual,
// idle-timeout, tab-hidden timeout, or navigating away) wipes this page's
// DOM and the in-memory decrypted vault immediately - see the vaultOnLock
// listener at the bottom of this file.

let _vaultItemsCache = [];
let vaultUnlockError = null;
let vaultVisibleSecrets = new Set(); // "itemId|field" currently shown in plain text
let vaultItemSearch = '';
let _vaultClipboardClearTimer = null;
let _vaultToastTimer = null;

// --- Pattern-lock input (alternate way to produce the master-password
// STRING - see js/vault/patternLock.js for the entropy tradeoff this
// carries). 'password' is the default for both screens; only a user who
// explicitly toggles ever sees the grid.
let vaultCreateInputMode = 'password'; // 'password' | 'pattern'
let vaultUnlockInputMode = 'password'; // 'password' | 'pattern'
let _vaultCreatePendingPattern = null; // first of the two confirm-by-redrawing draws
let _vaultPatternTooShortMsg = null;

// Change-master-password form has TWO independent fields that each need
// their own password/pattern toggle: proving the CURRENT credential (single
// draw, same as unlock) and choosing a NEW one (draw-twice-to-confirm, same
// as create). Without this, a vault created with a pattern would have no
// way to ever prove its current credential through this form at all - the
// text input has nothing a pattern-only user could type into it.
let vaultChangeCurrentMode = 'password'; // 'password' | 'pattern'
let vaultChangeNewMode = 'password'; // 'password' | 'pattern'
let _vaultChangeCurrentPattern = null; // captured from a single draw on the "current" grid
let _vaultChangeNewPendingPattern = null; // first of the two confirm-by-redrawing draws for "new"
let _vaultChangeNewPattern = null; // captured once the two "new" draws match

// --- Escaping (self-contained - no dependency on another feature file) ---
function _vltEsc(str) {
  return String(str == null ? '' : str).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
}
function _vltEscAttr(str) {
  return String(str == null ? '' : str).replace(/[&"<>]/g, ch => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[ch]));
}

// --- Page render ----------------------------------------------------------

async function renderVaultPage(container) {
  // Defensive - whichever of these two grids was wired up on the previous
  // render, drop its listeners before the DOM nodes they're attached to get
  // thrown away by the innerHTML replace below (vaultPatternLockDestroy is a
  // no-op if that id was never initialized).
  vaultPatternLockDestroy('vaultCreatePattern');
  vaultPatternLockDestroy('vaultUnlockPattern');

  if (!vaultIsUnlocked()) {
    const exists = await vaultHasVault();
    container.innerHTML = exists ? _vaultLockedHtml() : _vaultCreateHtml();
    _vaultWirePatternInputs();
    return;
  }
  _vaultItemsCache = vaultGetItems();
  container.innerHTML = _vaultUnlockedHtml();
}

// Wires up whichever pattern-lock grid is actually in the DOM right now
// (at most one of the two ids exists at a time - create screen vs locked
// screen - and only when that screen's mode toggle is set to 'pattern').
function _vaultWirePatternInputs() {
  if (document.getElementById('vaultCreatePattern')) {
    vaultPatternLockInit('vaultCreatePattern', {
      minLength: 6,
      onComplete: vaultOnCreatePatternComplete,
      onTooShort: () => {
        _vaultPatternTooShortMsg = 'Draw at least 6 dots before releasing.';
        renderVaultPage(document.getElementById('mainContainer'));
      }
    });
  }
  if (document.getElementById('vaultUnlockPattern')) {
    vaultPatternLockInit('vaultUnlockPattern', {
      minLength: 6,
      onComplete: vaultOnUnlockPatternComplete,
      onTooShort: () => { /* grid resets itself; nothing else to do */ }
    });
  }
}

function _vaultCreateHtml() {
  const patternMode = vaultCreateInputMode === 'pattern';
  return `
    <h2 class="text-sm font-bold text-slate-800 mb-1">Credentials &amp; Cards Vault</h2>
    <p class="text-[11px] text-slate-400 mb-3">Store logins and card details, encrypted on this device with a master password only you know. It's never sent anywhere unencrypted, and there is no way to recover the vault if you forget that password.</p>
    <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3 mb-4">
      <div class="flex items-center justify-between">
        <h3 class="text-xs font-bold text-slate-800">Create your vault</h3>
        <button type="button" onclick="vaultToggleCreateInputMode()" class="text-[11px] font-semibold text-blue-600 hover:text-blue-700 underline underline-offset-2">
          ${patternMode ? 'Use a password instead' : 'Use a pattern instead'}
        </button>
      </div>
      ${patternMode ? _vaultPatternBlockHtml('vaultCreatePattern', !!_vaultCreatePendingPattern
          ? 'Draw the SAME pattern again to confirm it.'
          : 'Draw a pattern connecting at least 6 dots. This is used instead of a typed password.'
        ) : `
      <form onsubmit="submitVaultCreate(event)" class="space-y-3">
        <div>
          <label class="text-[11px] font-semibold text-slate-400">Master Password</label>
          <input type="password" required minlength="8" id="vaultCreatePwd" autocomplete="new-password" class="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
        </div>
        <div>
          <label class="text-[11px] font-semibold text-slate-400">Confirm Master Password</label>
          <input type="password" required minlength="8" id="vaultCreatePwdConfirm" autocomplete="new-password" class="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
        </div>
        <p class="text-[10px] text-amber-600 bg-amber-50 rounded-lg p-2"><i class="fa-solid fa-triangle-exclamation"></i> This password is never stored anywhere. If you forget it, everything in the vault is permanently unreadable - nobody, including you, can reset it.</p>
        <button type="submit" class="w-full py-2.5 text-xs bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">Create Vault</button>
      </form>
      `}
    </div>
    ${gdriveToken ? `
      <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-center space-y-2">
        <p class="text-[11px] text-slate-500">Already created a vault on another device?</p>
        <button type="button" onclick="vaultSyncDownload().then(() => renderVaultPage(document.getElementById('mainContainer')))" class="px-4 py-2 text-xs border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition">
          <i class="fa-brands fa-google-drive text-amber-500"></i> Pull Vault from Drive
        </button>
      </div>
    ` : `
      <p class="text-[10px] text-slate-400 text-center">Connect Google Drive in Settings to restore a vault from another device.</p>
    `}
  `;
}

// Shared markup for the pattern grid + its entropy-tradeoff warning, used by
// both the create screen and the locked/unlock screen (only the id and the
// instruction line above the grid differ between the two call sites).
function _vaultPatternBlockHtml(gridId, instruction) {
  return `
    <p class="text-[11px] text-slate-500">${_vltEsc(instruction)}</p>
    <p class="text-[10px] text-amber-600 bg-amber-50 rounded-lg p-2">
      <i class="fa-solid fa-triangle-exclamation"></i>
      A drawn pattern is much weaker than a typed password: this 4x4 grid has only about 5.8 million possible 6-dot patterns, a space small enough that anyone who steals your encrypted vault file could try every single one offline. Use a typed password instead for any vault whose backup actually matters to you.
    </p>
    ${_vaultPatternTooShortMsg ? `<p class="text-[11px] text-rose-600">${_vltEsc(_vaultPatternTooShortMsg)}</p>` : ''}
    ${vaultPatternLockHtml(gridId, { gridSize: 4 })}
  `;
}

function vaultToggleCreateInputMode() {
  vaultCreateInputMode = vaultCreateInputMode === 'password' ? 'pattern' : 'password';
  _vaultCreatePendingPattern = null;
  _vaultPatternTooShortMsg = null;
  renderVaultPage(document.getElementById('mainContainer'));
}

function vaultToggleUnlockInputMode() {
  vaultUnlockInputMode = vaultUnlockInputMode === 'password' ? 'pattern' : 'password';
  vaultUnlockError = null;
  _vaultPatternTooShortMsg = null;
  renderVaultPage(document.getElementById('mainContainer'));
}

async function submitVaultCreate(event) {
  event.preventDefault();
  const pwd = document.getElementById('vaultCreatePwd').value;
  const confirmPwd = document.getElementById('vaultCreatePwdConfirm').value;
  if (pwd !== confirmPwd) { await showAlert('Passwords do not match.'); return; }
  if (pwd.length < 8) { await showAlert('Use at least 8 characters.'); return; }
  try {
    await vaultCreate(pwd);
    renderVaultPage(document.getElementById('mainContainer'));
  } catch (e) {
    await showAlert(e.message || 'Could not create vault.');
  }
}

// Fires once per completed drag on the create screen's grid. Mirrors
// Android's "draw it twice" setup flow: the first draw is just held in
// memory (never persisted, same as a typed password mid-form), the second
// must match exactly before vaultCreate() is actually called.
async function vaultOnCreatePatternComplete(patternStr) {
  _vaultPatternTooShortMsg = null;
  if (!_vaultCreatePendingPattern) {
    _vaultCreatePendingPattern = patternStr;
    renderVaultPage(document.getElementById('mainContainer'));
    return;
  }
  if (patternStr !== _vaultCreatePendingPattern) {
    _vaultCreatePendingPattern = null;
    renderVaultPage(document.getElementById('mainContainer'));
    await showAlert('Patterns didn\'t match. Draw it again from the start.');
    return;
  }
  const finalPattern = _vaultCreatePendingPattern;
  _vaultCreatePendingPattern = null;
  try {
    await vaultCreate(finalPattern);
    vaultCreateInputMode = 'password'; // back to the default for next time
    renderVaultPage(document.getElementById('mainContainer'));
  } catch (e) {
    await showAlert(e.message || 'Could not create vault.');
    renderVaultPage(document.getElementById('mainContainer'));
  }
}

// Fires once per completed drag on the locked screen's grid - a single draw
// is enough here, same as typing a password once and hitting Unlock.
async function vaultOnUnlockPatternComplete(patternStr) {
  try {
    await vaultUnlock(patternStr);
    vaultUnlockError = null;
    vaultUnlockInputMode = 'password'; // back to the default for next time
    renderVaultPage(document.getElementById('mainContainer'));
  } catch (e) {
    vaultUnlockError = e.code === 'WRONG_PASSWORD' ? 'Incorrect pattern.' : (e.message || 'Could not unlock vault.');
    renderVaultPage(document.getElementById('mainContainer'));
  }
}

function _vaultLockedHtml() {
  const patternMode = vaultUnlockInputMode === 'pattern';
  return `
    <h2 class="text-sm font-bold text-slate-800 mb-1">Vault Locked</h2>
    <p class="text-[11px] text-slate-400 mb-3">${patternMode ? 'Draw your pattern to unlock.' : 'Enter your master password to unlock.'}</p>
    <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
      <div class="flex justify-end">
        <button type="button" onclick="vaultToggleUnlockInputMode()" class="text-[11px] font-semibold text-blue-600 hover:text-blue-700 underline underline-offset-2">
          ${patternMode ? 'Use password instead' : 'Use pattern instead'}
        </button>
      </div>
      ${patternMode ? `
        ${vaultUnlockError ? `<p class="text-[11px] text-rose-600">${_vltEsc(vaultUnlockError)}</p>` : ''}
        ${vaultPatternLockHtml('vaultUnlockPattern', { gridSize: 4 })}
      ` : `
      <form onsubmit="submitVaultUnlock(event)" class="space-y-3">
        <div>
          <label class="text-[11px] font-semibold text-slate-400">Master Password</label>
          <input type="password" required id="vaultUnlockPwd" autocomplete="current-password" autofocus class="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
        </div>
        ${vaultUnlockError ? `<p class="text-[11px] text-rose-600">${_vltEsc(vaultUnlockError)}</p>` : ''}
        <button type="submit" class="w-full py-2.5 text-xs bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">Unlock</button>
      </form>
      `}
    </div>
    ${gdriveToken ? `
      <div class="mt-4 text-center">
        <button type="button" onclick="vaultSyncDownload().then(() => renderVaultPage(document.getElementById('mainContainer')))" class="px-4 py-2 text-xs border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition">
          <i class="fa-brands fa-google-drive text-amber-500"></i> Pull Latest from Drive
        </button>
      </div>
    ` : ''}
    <div class="mt-4 text-center">
      <button type="button" onclick="confirmVaultReset()" class="text-[11px] font-semibold text-rose-500 hover:text-rose-600 underline underline-offset-2">
        Forgot your master password?
      </button>
    </div>
  `;
}

async function submitVaultUnlock(event) {
  event.preventDefault();
  const pwd = document.getElementById('vaultUnlockPwd').value;
  try {
    await vaultUnlock(pwd);
    vaultUnlockError = null;
    renderVaultPage(document.getElementById('mainContainer'));
  } catch (e) {
    vaultUnlockError = e.code === 'WRONG_PASSWORD' ? 'Incorrect master password.' : (e.message || 'Could not unlock vault.');
    renderVaultPage(document.getElementById('mainContainer'));
  }
}

// Shared "forgot password / start over" entry point, reachable from both
// the locked screen (the actual recovery use case) and the unlocked
// Danger Zone (for anyone who just wants to wipe and restart deliberately).
// There is NO soft version of this - vaultResetVault() deletes the only
// copy of the encrypted blob this device has, and the master password was
// never stored anywhere to begin with, so there is nothing to roll back.
async function confirmVaultReset() {
  const hasRemote = !!gdriveToken;
  const message = hasRemote
    ? "This permanently deletes the vault stored on THIS device - there is no way to recover it, since the master password itself was never stored anywhere. If you've synced this vault to Google Drive before, that backup is NOT touched by this - but the next time you sync a freshly created vault from this device, you'll be asked whether to overwrite it. Continue?"
    : "This permanently deletes the vault stored on THIS device - there is no way to recover it, since the master password itself was never stored anywhere. Continue?";
  const confirmed = await showConfirm(message, { title: 'Delete this vault?', danger: true, confirmLabel: 'Delete Vault' });
  if (!confirmed) return;
  await vaultResetVault();
  vaultUnlockError = null;
  closeFormModal();
  renderVaultPage(document.getElementById('mainContainer'));
  await showAlert('Vault deleted from this device. Create a new one whenever you\'re ready.');
}

function _vaultUnlockedHtml() {
  return `
    <div id="vaultUnlockedRoot">
      <div class="flex items-center justify-between mb-1">
        <h2 class="text-sm font-bold text-slate-800">Vault</h2>
        <button type="button" onclick="vaultLock(); renderVaultPage(document.getElementById('mainContainer'))" class="px-3 py-1.5 text-[11px] font-bold text-slate-500 border border-slate-200 rounded-full hover:bg-slate-50 transition">
          <i class="fa-solid fa-lock text-[10px]"></i> Lock
        </button>
      </div>
      <p class="text-[11px] text-slate-400 mb-3">Auto-locks after 5 minutes idle, or about a minute after you switch away from the app.</p>

      <div class="relative mb-3">
        <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs pointer-events-none"></i>
        <input type="text" placeholder="Search vault..." value="${_vltEscAttr(vaultItemSearch)}" oninput="vaultOnSearchInput(this.value)" class="w-full text-xs p-2.5 pl-8 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
      </div>

      <div class="grid grid-cols-3 gap-2 mb-3">
        <button type="button" onclick="openVaultLoginForm()" class="p-2 rounded-xl border border-slate-100 bg-slate-50 hover:bg-blue-50 flex flex-col items-center gap-1 transition">
          <div class="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center"><i class="fa-solid fa-key text-xs"></i></div>
          <span class="text-[10px] font-bold text-slate-800">Login</span>
        </button>
        <button type="button" onclick="openVaultCardForm()" class="p-2 rounded-xl border border-slate-100 bg-slate-50 hover:bg-blue-50 flex flex-col items-center gap-1 transition">
          <div class="w-7 h-7 rounded-lg bg-fuchsia-500/10 text-fuchsia-600 flex items-center justify-center"><i class="fa-solid fa-credit-card text-xs"></i></div>
          <span class="text-[10px] font-bold text-slate-800">Card</span>
        </button>
        <button type="button" onclick="openVaultNoteForm()" class="p-2 rounded-xl border border-slate-100 bg-slate-50 hover:bg-blue-50 flex flex-col items-center gap-1 transition">
          <div class="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center"><i class="fa-solid fa-note-sticky text-xs"></i></div>
          <span class="text-[10px] font-bold text-slate-800">Note</span>
        </button>
      </div>

      <div class="space-y-3 mb-4" id="vaultItemsList">${_vaultItemsListHtml()}</div>

      <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2">
        <h3 class="text-[11px] font-bold text-slate-400 uppercase">Backup &amp; Sync</h3>
        <div class="grid grid-cols-2 gap-2">
          <button type="button" ${gdriveToken ? '' : 'disabled'} onclick="vaultSyncUpload()" class="py-2 text-[11px] font-bold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed">
            <i class="fa-brands fa-google-drive text-amber-500"></i> Sync to Drive
          </button>
          <button type="button" ${gdriveToken ? '' : 'disabled'} onclick="vaultSyncDownload().then(() => renderVaultPage(document.getElementById('mainContainer')))" class="py-2 text-[11px] font-bold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed">
            <i class="fa-brands fa-google-drive text-amber-500"></i> Pull from Drive
          </button>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <button type="button" onclick="vaultExportBackup()" class="py-2 text-[11px] font-bold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
            <i class="fa-solid fa-file-export"></i> Export Backup
          </button>
          <button type="button" onclick="document.getElementById('vaultImportFile').click()" class="py-2 text-[11px] font-bold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
            <i class="fa-solid fa-file-import"></i> Import Backup
          </button>
        </div>
        <input type="file" id="vaultImportFile" accept=".enc,.json,application/json" class="hidden" onchange="vaultImportBackup(event)">
        <button type="button" onclick="openVaultChangePasswordForm()" class="w-full py-2 text-[11px] font-bold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
          <i class="fa-solid fa-key"></i> Change Master Password
        </button>
      </div>

      <div class="bg-white p-4 rounded-2xl border border-rose-100 shadow-sm space-y-2 mt-4">
        <div class="flex items-center gap-2 mb-1">
          <i class="fa-solid fa-triangle-exclamation text-rose-500"></i>
          <h3 class="font-bold text-rose-700 text-xs">Danger Zone</h3>
        </div>
        <p class="text-[10px] text-slate-400">Permanently deletes every item in this vault from this device. There is no recovery - use this only if you want to start over with a new master password.</p>
        <button type="button" onclick="confirmVaultReset()" class="w-full py-2.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold hover:bg-rose-100 transition">
          <i class="fa-solid fa-trash mr-1"></i> Delete Vault
        </button>
      </div>
    </div>
  `;
}

function vaultOnSearchInput(value) {
  vaultItemSearch = value;
  // Only the items list re-renders (not the whole page) so the search
  // input never loses focus/cursor position mid-type - same reasoning as
  // World Clock's country search (js/world-clock.js).
  const list = document.getElementById('vaultItemsList');
  if (list) list.innerHTML = _vaultItemsListHtml();
}

function _vaultItemsListHtml() {
  const q = vaultItemSearch.trim().toLowerCase();
  const filtered = !q ? _vaultItemsCache : _vaultItemsCache.filter(i =>
    (i.title || '').toLowerCase().includes(q) ||
    (i.username || '').toLowerCase().includes(q) ||
    (i.cardholderName || '').toLowerCase().includes(q)
  );
  if (!filtered.length) {
    return `
      <div class="bg-white p-6 rounded-2xl border border-dashed border-slate-200 text-center space-y-2">
        <i class="fa-solid fa-shield-halved text-2xl text-slate-300"></i>
        <p class="text-xs text-slate-400">${_vaultItemsCache.length ? 'No items match your search.' : 'No items yet - add a login or card above.'}</p>
      </div>
    `;
  }
  return filtered.map(_vaultItemCardHtml).join('');
}

function _vaultItemCardHtml(item) {
  const isCard = item.type === 'card';
  const isNote = item.type === 'note';
  const icon = isCard ? 'fa-credit-card' : isNote ? 'fa-note-sticky' : 'fa-key';
  const iconClasses = isCard ? 'bg-fuchsia-500/10 text-fuchsia-600' : isNote ? 'bg-amber-500/10 text-amber-600' : 'bg-blue-500/10 text-blue-600';
  const editFn = isCard ? 'openVaultCardForm' : isNote ? 'openVaultNoteForm' : 'openVaultLoginForm';
  const defaultTitle = isCard ? 'Card' : isNote ? 'Note' : 'Login';
  return `
    <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
      <div class="flex items-center justify-between gap-2 mb-1">
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-8 h-8 rounded-lg ${iconClasses} flex items-center justify-center shrink-0">
            <i class="fa-solid ${icon} text-xs"></i>
          </div>
          <p class="text-xs font-bold text-slate-800 truncate">${_vltEsc(item.title || defaultTitle)}</p>
          ${isCard && item.cardNetwork ? `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">${_vltEsc(item.cardNetwork)}</span>` : ''}
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button type="button" onclick="${editFn}('${item.id}')" class="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100" title="Edit">
            <i class="fa-solid fa-pen text-[11px]"></i>
          </button>
          <button type="button" onclick="deleteVaultItem('${item.id}')" class="w-7 h-7 rounded-full flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50" title="Delete">
            <i class="fa-solid fa-trash text-[11px]"></i>
          </button>
        </div>
      </div>
      <div class="divide-y divide-slate-50">
        ${isCard ? `
          ${item.cardholderName ? `<p class="text-[10px] text-slate-400 py-1">${_vltEsc(item.cardholderName)}</p>` : ''}
          ${_vaultMaskedFieldHtml(item.id, 'cardNumber', item.cardNumber, 'Card Number', { cardNumberMask: true })}
          ${item.expiry ? `<p class="text-[10px] text-slate-400 py-1">Expires ${_vltEsc(item.expiry)}</p>` : ''}
          ${_vaultMaskedFieldHtml(item.id, 'cvv', item.cvv, 'CVV')}
          ${_vaultMaskedFieldHtml(item.id, 'pin', item.pin, 'PIN')}
        ` : isNote ? `
          ${_vaultMaskedFieldHtml(item.id, 'description', item.description, 'Note', { multiline: true })}
        ` : `
          ${item.username ? `<p class="text-[10px] text-slate-400 py-1 truncate">${_vltEsc(item.username)}</p>` : ''}
          ${_vaultMaskedFieldHtml(item.id, 'password', item.password, 'Password')}
          ${item.url ? `<p class="text-[10px] text-blue-500 py-1 truncate">${_vltEsc(item.url)}</p>` : ''}
        `}
        ${!isNote && item.notes ? `<p class="text-[10px] text-slate-400 py-1 whitespace-pre-line">${_vltEsc(item.notes)}</p>` : ''}
      </div>
    </div>
  `;
}

// `itemId` is always our own generated id (vitem_<timestamp>_<random>) and
// `field` is always one of a handful of fixed string literals from this
// file's own code - never user-entered - so both are safe to embed directly
// into the onclick attribute below with no escaping needed. The ACTUAL
// secret value never goes into an HTML attribute at all (only into escaped
// text content, and only when toggled to "shown") - see the dialog-button
// bug fixed earlier in js/ui-dialogs.js for exactly the class of bug this
// sidesteps.
// Card numbers get a friendlier hidden state than the generic dot-mask: the
// real last 4 digits stay visible (same convention every bank/wallet app
// uses - on their own they're not enough to do anything with) with the rest
// blocked out in groups of 4, so the list is actually usable for picking
// "which card is this" without a reveal tap every time.
function _vaultMaskedCardNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const last4 = digits.slice(-4);
  return last4 ? `•••• •••• •••• ${last4}` : '•••• •••• •••• ••••';
}

function _vaultMaskedFieldHtml(itemId, field, value, label, opts) {
  if (value == null || value === '') return '';
  const multiline = opts && opts.multiline;
  const shown = vaultVisibleSecrets.has(itemId + '|' + field);
  const hiddenDisplay = (opts && opts.cardNumberMask) ? _vaultMaskedCardNumber(value) : '••••••••';
  return `
    <div class="flex items-center justify-between gap-2 py-1">
      <div class="min-w-0 flex-1">
        <p class="text-[9px] font-semibold text-slate-400 uppercase">${label}</p>
        <p class="text-xs font-mono text-slate-800 ${shown && multiline ? 'whitespace-pre-line' : 'truncate'}">${shown ? _vltEsc(value) : hiddenDisplay}</p>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <button type="button" onclick="vaultToggleSecretVisible('${itemId}','${field}')" class="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100" title="${shown ? 'Hide' : 'Show'} ${label}">
          <i class="fa-solid ${shown ? 'fa-eye-slash' : 'fa-eye'} text-[11px]"></i>
        </button>
        <button type="button" onclick="vaultCopyValue('${itemId}','${field}')" class="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100" title="Copy ${label}">
          <i class="fa-solid fa-copy text-[11px]"></i>
        </button>
      </div>
    </div>
  `;
}

function vaultToggleSecretVisible(itemId, field) {
  const key = itemId + '|' + field;
  if (vaultVisibleSecrets.has(key)) vaultVisibleSecrets.delete(key); else vaultVisibleSecrets.add(key);
  const list = document.getElementById('vaultItemsList');
  if (list) list.innerHTML = _vaultItemsListHtml();
}

function vaultCopyValue(itemId, field) {
  const item = _vaultItemsCache.find(i => i.id === itemId);
  if (!item || item[field] == null) return;
  _vaultCopyToClipboard(String(item[field]), field);
}

// Best-effort only: writing an empty string back to the clipboard after a
// delay cannot be guaranteed (the user may have copied something else by
// then, and some browsers/OSes restrict clipboard writes to direct user
// gestures, which a setTimeout callback is not) - documented as a known
// limitation rather than claimed as a real guarantee.
function _vaultCopyToClipboard(value, label) {
  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    _vaultToast('Clipboard is not available in this browser.');
    return;
  }
  navigator.clipboard.writeText(value).then(() => {
    _vaultToast(label + ' copied');
    clearTimeout(_vaultClipboardClearTimer);
    _vaultClipboardClearTimer = setTimeout(() => {
      navigator.clipboard.writeText('').catch(() => {});
    }, 30000);
  }).catch(() => {
    _vaultToast('Could not copy - try again.');
  });
}

// Tiny self-made toast (no toast system exists elsewhere in this app -
// everything else uses the blocking dialog in js/ui-dialogs.js, which would
// be overkill for "copied"). Lazily creates its own fixed-position element
// the first time it's needed instead of requiring an index.html change.
function _vaultToast(message) {
  let el = document.getElementById('vaultToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'vaultToast';
    el.className = 'fixed left-1/2 -translate-x-1/2 bottom-24 z-[80] bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg transition-opacity duration-200 pointer-events-none';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.style.opacity = '1';
  clearTimeout(_vaultToastTimer);
  _vaultToastTimer = setTimeout(() => { el.style.opacity = '0'; }, 1500);
}

function vaultToggleInputType(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.type = el.type === 'password' ? 'text' : 'password';
}

// --- Add / Edit forms (reuse the app's existing #formModal) ---------------

function openVaultLoginForm(id) {
  const existing = id ? _vaultItemsCache.find(i => i.id === id) : null;
  const modal = document.getElementById('formModal');
  const content = document.getElementById('formModalContent');
  modal.classList.remove('hidden');
  content.innerHTML = `
    <h3 class="text-sm font-bold text-slate-800 mb-3">${existing ? 'Edit' : 'Add'} Login</h3>
    <form onsubmit="saveVaultLoginForm(event${existing ? `, '${existing.id}'` : ''})" class="space-y-3">
      <div>
        <label class="text-[11px] font-semibold text-slate-400">Title</label>
        <input type="text" required id="vfTitle" value="${_vltEscAttr(existing ? existing.title : '')}" placeholder="e.g. Gmail" class="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
      </div>
      <div>
        <label class="text-[11px] font-semibold text-slate-400">Username / Email</label>
        <input type="text" id="vfUsername" value="${_vltEscAttr(existing ? existing.username : '')}" class="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
      </div>
      <div>
        <label class="text-[11px] font-semibold text-slate-400">Password</label>
        <div class="flex gap-1">
          <input type="password" id="vfPassword" value="${_vltEscAttr(existing ? existing.password : '')}" class="flex-1 text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
          <button type="button" onclick="vaultToggleInputType('vfPassword')" class="w-9 rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50"><i class="fa-solid fa-eye text-xs"></i></button>
        </div>
      </div>
      <div>
        <label class="text-[11px] font-semibold text-slate-400">Website (Optional)</label>
        <input type="text" id="vfUrl" value="${_vltEscAttr(existing ? existing.url : '')}" class="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
      </div>
      <div>
        <label class="text-[11px] font-semibold text-slate-400">Notes (Optional)</label>
        <textarea id="vfNotes" rows="2" class="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500">${_vltEsc(existing ? existing.notes || '' : '')}</textarea>
      </div>
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="closeFormModal()" class="flex-1 py-2.5 text-xs border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition">Cancel</button>
        <button type="submit" class="flex-1 py-2.5 text-xs bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">Save</button>
      </div>
    </form>
  `;
}

async function saveVaultLoginForm(event, id) {
  event.preventDefault();
  const payload = {
    type: 'login',
    title: document.getElementById('vfTitle').value.trim(),
    username: document.getElementById('vfUsername').value.trim(),
    password: document.getElementById('vfPassword').value,
    url: document.getElementById('vfUrl').value.trim(),
    notes: document.getElementById('vfNotes').value.trim()
  };
  if (!payload.title) { await showAlert('Title is required.'); return; }
  try {
    if (id) await vaultUpdateItem(id, payload); else await vaultAddItem(payload);
    closeFormModal();
    renderVaultPage(document.getElementById('mainContainer'));
  } catch (e) {
    await showAlert(e.message || 'Could not save item.');
  }
}

function openVaultCardForm(id) {
  const existing = id ? _vaultItemsCache.find(i => i.id === id) : null;
  const modal = document.getElementById('formModal');
  const content = document.getElementById('formModalContent');
  modal.classList.remove('hidden');
  content.innerHTML = `
    <h3 class="text-sm font-bold text-slate-800 mb-3">${existing ? 'Edit' : 'Add'} Card</h3>
    <form onsubmit="saveVaultCardForm(event${existing ? `, '${existing.id}'` : ''})" class="space-y-3">
      <div>
        <label class="text-[11px] font-semibold text-slate-400">Title</label>
        <input type="text" required id="vfCTitle" value="${_vltEscAttr(existing ? existing.title : '')}" placeholder="e.g. HDFC Credit Card" class="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
      </div>
      <div>
        <label class="text-[11px] font-semibold text-slate-400">Cardholder Name</label>
        <input type="text" id="vfCName" value="${_vltEscAttr(existing ? existing.cardholderName : '')}" class="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
      </div>
      <div>
        <label class="text-[11px] font-semibold text-slate-400">Card Number</label>
        <div class="flex gap-1">
          <div class="relative flex-1">
            <input type="password" inputmode="numeric" id="vfCNumber" oninput="vaultOnCardNumberInput(this)" value="${_vltEscAttr(existing ? existing.cardNumber : '')}" class="w-full text-xs p-2.5 pr-14 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
            <span id="vfCNetworkIcon" class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center"></span>
          </div>
          <button type="button" onclick="vaultToggleInputType('vfCNumber')" class="w-9 rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50"><i class="fa-solid fa-eye text-xs"></i></button>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[11px] font-semibold text-slate-400">Expiry (MM/YY)</label>
          <input type="text" inputmode="numeric" maxlength="5" oninput="vaultFormatExpiryInput(this)" id="vfCExpiry" placeholder="MM/YY" value="${_vltEscAttr(existing ? existing.expiry : '')}" class="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
        </div>
        <div>
          <label class="text-[11px] font-semibold text-slate-400">CVV</label>
          <div class="flex items-center gap-1">
            <!-- Fixed width, not flex-1: a flex-growing input (flex-basis 0%)
                 in this cramped a column can end up narrower than its own
                 content needs on tight Android viewports, clipping the
                 digits - a short fixed-width box has no such ambiguity, and
                 suits a 3-4 digit value better than a full-width stretch. -->
            <input type="password" inputmode="numeric" maxlength="${existing && existing.cardNetwork === 'Amex' ? 4 : 3}" oninput="vaultFormatCvvInput(this)" id="vfCCvv" value="${_vltEscAttr(existing ? existing.cvv : '')}" class="w-16 shrink-0 text-xs text-center p-2 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
            <button type="button" onclick="vaultToggleInputType('vfCCvv')" class="w-9 h-9 shrink-0 rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50 flex items-center justify-center"><i class="fa-solid fa-eye text-xs"></i></button>
          </div>
        </div>
      </div>
      <div>
        <label class="text-[11px] font-semibold text-slate-400">PIN (Optional)</label>
        <div class="flex gap-1">
          <input type="password" inputmode="numeric" id="vfCPin" value="${_vltEscAttr(existing ? existing.pin : '')}" class="flex-1 text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
          <button type="button" onclick="vaultToggleInputType('vfCPin')" class="w-9 rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50"><i class="fa-solid fa-eye text-xs"></i></button>
        </div>
      </div>
      <div>
        <label class="text-[11px] font-semibold text-slate-400">Notes (Optional)</label>
        <textarea id="vfCNotes" rows="2" class="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500">${_vltEsc(existing ? existing.notes || '' : '')}</textarea>
      </div>
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="closeFormModal()" class="flex-1 py-2.5 text-xs border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition">Cancel</button>
        <button type="submit" class="flex-1 py-2.5 text-xs bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">Save</button>
      </div>
    </form>
  `;
  vaultOnCardNumberInput(document.getElementById('vfCNumber')); // picks up the pre-filled number when editing an existing card
}

// Reformats the expiry field to MM/YY as the user types - strips everything
// but digits, caps at 4 of them, and re-inserts the "/" once there are at
// least 3 (i.e. the user has started on the year). Like most simple
// auto-formatting inputs, this always places the cursor at the end after
// reformatting rather than preserving its exact prior position - an
// acceptable tradeoff for a 5-character field where that's rarely noticed.
function vaultFormatExpiryInput(el) {
  let digits = el.value.replace(/\D/g, '').slice(0, 4);
  el.value = digits.length >= 3 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

// Best-effort card network detection from the number's leading digits
// (IIN/BIN prefix). Card networks don't publish one single exhaustive
// public range list (RuPay's in particular is maintained by NPCI and only
// partially documented), so this covers the common, well-known prefixes -
// good enough for a quick "looks like Visa" hint, not a guarantee.
function _vaultDetectCardNetwork(rawNumber) {
  const num = String(rawNumber || '').replace(/\D/g, '');
  if (num.length < 2) return null;
  const p2 = Number(num.slice(0, 2));
  const p4 = num.length >= 4 ? Number(num.slice(0, 4)) : null;

  if (num[0] === '4') return 'Visa';
  if (p2 >= 51 && p2 <= 55) return 'Mastercard';
  if (p4 !== null && p4 >= 2221 && p4 <= 2720) return 'Mastercard';
  if (p2 === 34 || p2 === 37) return 'Amex';
  if (p2 === 60 || p2 === 65 || p2 === 81 || p2 === 82 || num.slice(0, 3) === '508') return 'RuPay';
  return null;
}

// Font Awesome's free "cc-visa"/"cc-mastercard"/"cc-amex" glyphs are each a
// SINGLE-color path, so tinting one with CSS can only ever produce a flat
// one-color silhouette - that's fundamentally why Mastercard's two
// overlapping red/orange circles (its whole visual identity) looked wrong
// no matter what color was picked. These are small hand-rolled multi-color
// badges instead: real SVG for Mastercard's two-circle mark (the one that
// actually needs two colors to be recognizable), and simple styled
// wordmarks for Visa/Amex using their official brand colors. RuPay has no
// widely-reusable mark to hand-roll safely, so it still falls back to a
// plain text chip.
function _vaultCardNetworkIconHtml(network) {
  if (network === 'Visa') {
    return `<span style="font-family:Georgia,serif;font-style:italic;font-weight:800;font-size:17px;color:#1434CB;letter-spacing:-0.5px;" title="Visa">VISA</span>`;
  }
  if (network === 'Mastercard') {
    return `
      <svg width="34" height="22" viewBox="0 0 34 22" xmlns="http://www.w3.org/2000/svg" title="Mastercard">
        <circle cx="13" cy="11" r="11" fill="#EB001B"/>
        <circle cx="21" cy="11" r="11" fill="#F79E1B"/>
        <path d="M17 2.6a11 11 0 0 1 0 16.8 11 11 0 0 1 0-16.8z" fill="#FF5F00"/>
      </svg>
    `;
  }
  if (network === 'Amex') {
    return `<span style="background:#2E77BC;color:#fff;font-weight:800;font-size:11px;padding:3px 6px;border-radius:4px;letter-spacing:0.3px;" title="American Express">AMEX</span>`;
  }
  if (network) return `<span class="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">${_vltEsc(network)}</span>`;
  return '';
}

// Combined "format as 4-digit blocks + update the network icon" handler for
// the Card Number field, run on every keystroke. Spaces are inserted purely
// for readability (type="password" still renders each character, space
// included, as its own masked dot, so the grouping is visible even hidden) -
// _vaultDetectCardNetwork strips them straight back out again, so the
// grouping never affects detection. Capped at 19 digits, the longest any
// real card network currently issues.
function vaultOnCardNumberInput(el) {
  if (!el) return;
  const digits = el.value.replace(/\D/g, '').slice(0, 19);
  el.value = digits.replace(/(.{4})/g, '$1 ').trim();
  const network = _vaultDetectCardNetwork(digits);

  const icon = document.getElementById('vfCNetworkIcon');
  if (icon) icon.innerHTML = _vaultCardNetworkIconHtml(network);

  // Amex is the one mainstream network with a 4-digit CVV printed on the
  // FRONT of the card - everyone else prints 3 on the back. Updating this
  // live as the number is typed (rather than only at save time) means the
  // CVV field won't silently let someone type/keep a 4th digit on a non-Amex
  // card, or cap them at 3 while they're mid-typing an Amex one.
  const cvv = document.getElementById('vfCCvv');
  if (cvv) {
    cvv.maxLength = network === 'Amex' ? 4 : 3;
    vaultFormatCvvInput(cvv); // re-truncates immediately if the limit just shrank
  }
}

// Digits-only, capped at whatever vaultOnCardNumberInput most recently set
// el.maxLength to (3 normally, 4 for a detected Amex number) - read live
// rather than hardcoded so this one handler serves both cases.
function vaultFormatCvvInput(el) {
  if (!el) return;
  el.value = el.value.replace(/\D/g, '').slice(0, el.maxLength > 0 ? el.maxLength : 4);
}

async function saveVaultCardForm(event, id) {
  event.preventDefault();
  const cardNumber = document.getElementById('vfCNumber').value.trim();
  const payload = {
    type: 'card',
    title: document.getElementById('vfCTitle').value.trim(),
    cardholderName: document.getElementById('vfCName').value.trim(),
    cardNumber,
    cardNetwork: _vaultDetectCardNetwork(cardNumber),
    expiry: document.getElementById('vfCExpiry').value.trim(),
    cvv: document.getElementById('vfCCvv').value.trim(),
    pin: document.getElementById('vfCPin').value.trim(),
    notes: document.getElementById('vfCNotes').value.trim()
  };
  if (!payload.title) { await showAlert('Title is required.'); return; }
  try {
    if (id) await vaultUpdateItem(id, payload); else await vaultAddItem(payload);
    closeFormModal();
    renderVaultPage(document.getElementById('mainContainer'));
  } catch (e) {
    await showAlert(e.message || 'Could not save item.');
  }
}

function openVaultNoteForm(id) {
  const existing = id ? _vaultItemsCache.find(i => i.id === id) : null;
  const modal = document.getElementById('formModal');
  const content = document.getElementById('formModalContent');
  modal.classList.remove('hidden');
  content.innerHTML = `
    <h3 class="text-sm font-bold text-slate-800 mb-3">${existing ? 'Edit' : 'Add'} Note</h3>
    <form onsubmit="saveVaultNoteForm(event${existing ? `, '${existing.id}'` : ''})" class="space-y-3">
      <div>
        <label class="text-[11px] font-semibold text-slate-400">Title</label>
        <input type="text" required id="vfNTitle" value="${_vltEscAttr(existing ? existing.title : '')}" placeholder="e.g. Wi-Fi Password, Recovery Codes" class="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
      </div>
      <div>
        <label class="text-[11px] font-semibold text-slate-400">Description</label>
        <textarea id="vfNDescription" rows="5" class="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500 font-mono">${_vltEsc(existing ? existing.description || '' : '')}</textarea>
      </div>
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="closeFormModal()" class="flex-1 py-2.5 text-xs border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition">Cancel</button>
        <button type="submit" class="flex-1 py-2.5 text-xs bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">Save</button>
      </div>
    </form>
  `;
}

async function saveVaultNoteForm(event, id) {
  event.preventDefault();
  const payload = {
    type: 'note',
    title: document.getElementById('vfNTitle').value.trim(),
    description: document.getElementById('vfNDescription').value
  };
  if (!payload.title) { await showAlert('Title is required.'); return; }
  try {
    if (id) await vaultUpdateItem(id, payload); else await vaultAddItem(payload);
    closeFormModal();
    renderVaultPage(document.getElementById('mainContainer'));
  } catch (e) {
    await showAlert(e.message || 'Could not save item.');
  }
}

async function deleteVaultItem(id) {
  if (!(await showConfirm('Delete this vault item? This cannot be undone.', { title: 'Delete item' }))) return;
  await vaultDeleteItem(id);
  renderVaultPage(document.getElementById('mainContainer'));
}

// --- Change master password -------------------------------------------------

function openVaultChangePasswordForm() {
  vaultChangeCurrentMode = 'password';
  vaultChangeNewMode = 'password';
  _vaultChangeCurrentPattern = null;
  _vaultChangeNewPendingPattern = null;
  _vaultChangeNewPattern = null;
  document.getElementById('formModal').classList.remove('hidden');
  _renderVaultChangePasswordForm();
}

// Rebuilt from scratch on every toggle/pattern-draw (not just on open) -
// same "re-render the whole form, re-wire whichever grid is present"
// approach as renderVaultPage() uses for the create/unlock screens, so the
// current-credential and new-credential fields can be toggled completely
// independently of each other.
function _renderVaultChangePasswordForm() {
  vaultPatternLockDestroy('vcpCurrentPattern');
  vaultPatternLockDestroy('vcpNewPattern');

  const content = document.getElementById('formModalContent');
  const curPattern = vaultChangeCurrentMode === 'pattern';
  const newPattern = vaultChangeNewMode === 'pattern';

  content.innerHTML = `
    <h3 class="text-sm font-bold text-slate-800 mb-3">Change Master Password</h3>
    <form onsubmit="saveVaultChangePassword(event)" class="space-y-3">
      <div>
        <div class="flex items-center justify-between mb-1">
          <label class="text-[11px] font-semibold text-slate-400">Current Master Password</label>
          <button type="button" onclick="vaultToggleChangeCurrentMode()" class="text-[10px] font-semibold text-blue-600 hover:text-blue-700 underline underline-offset-2">
            ${curPattern ? 'Use password instead' : 'Use pattern instead'}
          </button>
        </div>
        ${curPattern ? `
          <p class="text-[11px] ${_vaultChangeCurrentPattern ? 'text-emerald-600' : 'text-slate-500'} mb-1">
            ${_vaultChangeCurrentPattern ? '<i class="fa-solid fa-circle-check"></i> Pattern captured - draw again to replace it.' : 'Draw your current pattern.'}
          </p>
          ${vaultPatternLockHtml('vcpCurrentPattern', { gridSize: 4 })}
        ` : `
          <input type="password" required id="vcpCurrent" autocomplete="current-password" class="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
        `}
      </div>

      <div>
        <div class="flex items-center justify-between mb-1">
          <label class="text-[11px] font-semibold text-slate-400">New Master Password</label>
          <button type="button" onclick="vaultToggleChangeNewMode()" class="text-[10px] font-semibold text-blue-600 hover:text-blue-700 underline underline-offset-2">
            ${newPattern ? 'Use password instead' : 'Use pattern instead'}
          </button>
        </div>
        ${newPattern ? `
          <p class="text-[11px] ${_vaultChangeNewPattern ? 'text-emerald-600' : 'text-slate-500'} mb-1">
            ${_vaultChangeNewPendingPattern ? 'Draw the SAME new pattern again to confirm it.' : (_vaultChangeNewPattern ? '<i class="fa-solid fa-circle-check"></i> New pattern confirmed - draw again to replace it.' : 'Draw a new pattern connecting at least 6 dots.')}
          </p>
          <p class="text-[10px] text-amber-600 bg-amber-50 rounded-lg p-2 mb-1"><i class="fa-solid fa-triangle-exclamation"></i> A drawn pattern is much weaker than a typed password - this 4x4 grid has only ~5.8 million possible 6-dot patterns, small enough to brute-force offline against a stolen vault file. Use a typed password if this vault's backup matters.</p>
          ${vaultPatternLockHtml('vcpNewPattern', { gridSize: 4 })}
        ` : `
          <input type="password" required minlength="8" id="vcpNew" autocomplete="new-password" class="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
          <label class="text-[11px] font-semibold text-slate-400 mt-2 block mb-1">Confirm New Password</label>
          <input type="password" required minlength="8" id="vcpConfirm" autocomplete="new-password" class="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
        `}
      </div>

      <p class="text-[10px] text-amber-600 bg-amber-50 rounded-lg p-2"><i class="fa-solid fa-triangle-exclamation"></i> If this vault is synced to Google Drive from other devices, re-sync it from each of them after this change - they still have the OLD credential's key until then.</p>
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="closeFormModal()" class="flex-1 py-2.5 text-xs border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition">Cancel</button>
        <button type="submit" class="flex-1 py-2.5 text-xs bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">Change Password</button>
      </div>
    </form>
  `;

  _vaultWireChangePasswordPatternInputs();
}

function _vaultWireChangePasswordPatternInputs() {
  if (document.getElementById('vcpCurrentPattern')) {
    vaultPatternLockInit('vcpCurrentPattern', {
      minLength: 6,
      onComplete: vaultOnChangeCurrentPatternComplete,
      onTooShort: () => { /* grid resets itself; nothing else to do */ }
    });
  }
  if (document.getElementById('vcpNewPattern')) {
    vaultPatternLockInit('vcpNewPattern', {
      minLength: 6,
      onComplete: vaultOnChangeNewPatternComplete,
      onTooShort: () => { /* grid resets itself; nothing else to do */ }
    });
  }
}

function vaultToggleChangeCurrentMode() {
  vaultChangeCurrentMode = vaultChangeCurrentMode === 'password' ? 'pattern' : 'password';
  _vaultChangeCurrentPattern = null;
  _renderVaultChangePasswordForm();
}

function vaultToggleChangeNewMode() {
  vaultChangeNewMode = vaultChangeNewMode === 'password' ? 'pattern' : 'password';
  _vaultChangeNewPendingPattern = null;
  _vaultChangeNewPattern = null;
  _renderVaultChangePasswordForm();
}

// Single draw is enough to "fill in" the current-credential field - same as
// typing a password once, it's just held until Change Password is clicked,
// which is what actually proves it's correct (via vaultUnlock).
function vaultOnChangeCurrentPatternComplete(patternStr) {
  _vaultChangeCurrentPattern = patternStr;
  _renderVaultChangePasswordForm();
}

// Draw-twice-to-confirm, same as the create screen - this is choosing a
// brand NEW credential, not proving an existing one, so a typo should be
// caught here rather than silently locking the vault under a pattern the
// user didn't mean to set.
async function vaultOnChangeNewPatternComplete(patternStr) {
  if (!_vaultChangeNewPendingPattern) {
    _vaultChangeNewPendingPattern = patternStr;
    _vaultChangeNewPattern = null;
    _renderVaultChangePasswordForm();
    return;
  }
  if (patternStr !== _vaultChangeNewPendingPattern) {
    _vaultChangeNewPendingPattern = null;
    _renderVaultChangePasswordForm();
    await showAlert('Patterns didn\'t match. Draw the new pattern again from the start.');
    return;
  }
  _vaultChangeNewPattern = _vaultChangeNewPendingPattern;
  _vaultChangeNewPendingPattern = null;
  _renderVaultChangePasswordForm();
}

async function saveVaultChangePassword(event) {
  event.preventDefault();

  let oldCredential, newCredential;

  if (vaultChangeCurrentMode === 'pattern') {
    if (!_vaultChangeCurrentPattern) { await showAlert('Draw your current pattern first.'); return; }
    oldCredential = _vaultChangeCurrentPattern;
  } else {
    oldCredential = document.getElementById('vcpCurrent').value;
  }

  if (vaultChangeNewMode === 'pattern') {
    if (!_vaultChangeNewPattern) { await showAlert('Draw and confirm your new pattern first.'); return; }
    newCredential = _vaultChangeNewPattern;
  } else {
    newCredential = document.getElementById('vcpNew').value;
    const confirmPwd = document.getElementById('vcpConfirm').value;
    if (newCredential !== confirmPwd) { await showAlert('New passwords do not match.'); return; }
    if (newCredential.length < 8) { await showAlert('Use at least 8 characters.'); return; }
  }

  try {
    // Re-verifies the CURRENT credential through the exact same code path
    // as a normal unlock (vaultUnlock throws WRONG_PASSWORD on a bad one)
    // rather than a second, parallel verification routine - works
    // identically whether oldCredential came from a text field or a drawn
    // pattern, since both are just strings by this point.
    await vaultUnlock(oldCredential);
    await vaultChangeMasterPassword(newCredential);
    vaultPatternLockDestroy('vcpCurrentPattern');
    vaultPatternLockDestroy('vcpNewPattern');
    closeFormModal();
    await showAlert('Master password changed. Re-sync this vault from any other devices.');
    renderVaultPage(document.getElementById('mainContainer'));
  } catch (e) {
    await showAlert(e.code === 'WRONG_PASSWORD' ? 'Current password/pattern is incorrect.' : (e.message || 'Could not change password.'));
  }
}

// --- Encrypted import / export ----------------------------------------------
// Both operate purely on the opaque {kdf, encryption, ciphertext, updatedAt}
// blob - export never decrypts, import never decrypts either (decryption
// only ever happens via the normal unlock screen, after this file hands
// control back to it).

async function vaultExportBackup() {
  const blob = await vaultStoreGetBlob();
  if (!blob) { await showAlert('Nothing to export yet.'); return; }
  const json = JSON.stringify(blob, null, 2);
  const file = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vault-backup-${new Date().toISOString().slice(0, 10)}.enc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function vaultImportBackup(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = ''; // allow re-selecting the same file again later
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed || !parsed.kdf || !parsed.encryption || !parsed.ciphertext) {
      throw new Error("That file doesn't look like a vault backup.");
    }
    const hasExisting = await vaultHasVault();
    if (hasExisting) {
      const proceed = await showConfirm('Importing will REPLACE the vault currently on this device. Continue?', { title: 'Replace existing vault', danger: true });
      if (!proceed) return;
    }
    await vaultStoreSaveBlob({ kdf: parsed.kdf, encryption: parsed.encryption, ciphertextB64: parsed.ciphertext, updatedAt: parsed.updatedAt || new Date().toISOString() });
    vaultLockIfUnlocked();
    renderVaultPage(document.getElementById('mainContainer'));
    await showAlert("Vault imported. Unlock it with that backup's master password.");
  } catch (e) {
    await showAlert(e.message || 'Could not import that file.');
  }
}

// --- Lock listener ----------------------------------------------------------
// Registered once, at script load. Fires on EVERY lock - manual button,
// inactivity timeout, tab-hidden timeout, a Drive pull, or the navigate()
// teardown hook in index.html - and is what actually makes "locking" mean
// something: it wipes this page's own transient UI state and, if the vault
// page happens to still be what's on screen (checked via the DOM marker
// rather than `currentTab`, since teardown hooks run before currentTab
// updates), immediately re-renders to the locked/create screen - clearing
// every item, password and card number out of the DOM in the same tick the
// in-memory vault itself is cleared.
vaultOnLock(() => {
  vaultUnlockError = null;
  vaultVisibleSecrets.clear();
  vaultItemSearch = '';
  _vaultItemsCache = [];
  const marker = document.getElementById('vaultUnlockedRoot');
  if (marker) renderVaultPage(document.getElementById('mainContainer'));
});
