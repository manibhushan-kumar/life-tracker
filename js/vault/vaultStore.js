// --- Vault persistence (IndexedDB) --------------------------------------
// Deliberately reuses the EXISTING 'meta' store (js/idb.js) instead of
// adding a new IndexedDB object store / bumping DB_VERSION - 'meta' is
// already documented there as "a single small key/value table for
// everything that isn't a growing-forever list", and the vault is exactly
// that: one row, rarely written, never chunked.
//
// The row this file owns (key: 'vaultBlob') NEVER contains plaintext. It is
// always:
//   {
//     key: 'vaultBlob',
//     schemaVersion: 1,
//     kdf: { algorithm: 'PBKDF2-SHA256', iterations, salt: base64 },
//     encryption: { algorithm: 'AES-256-GCM', iv: base64 },
//     ciphertext: base64,          // whole-vault JSON, encrypted
//     updatedAt: ISOString         // bumped on every re-encrypt+save
//   }
// salt/iv/ciphertext are meaningless without the master password - storing
// them in IndexedDB (unencrypted browser storage) is safe by design, same
// reasoning as storing a bcrypt hash: the stored bytes don't help an
// attacker who only has disk/DevTools access, only guessing does.
//
// This file has ZERO knowledge of the master password, derived key, or
// decrypted contents - it only ever moves opaque blobs in and out of IDB.
// That split is deliberate: vaultService.js (which DOES hold the key, only
// in memory) is the only thing allowed to decide when a blob is safe to
// write, this file just does the write.

const VAULT_META_KEY = 'vaultBlob';
const VAULT_SCHEMA_VERSION = 1;

async function vaultStoreGetBlob() {
  return (await IDB.get('meta', VAULT_META_KEY)) || null;
}

async function vaultStoreExists() {
  return !!(await vaultStoreGetBlob());
}

// `kdf`/`encryption` are the small plaintext metadata objects described
// above (algorithm names, iteration count, base64 salt/iv) - never the
// password or key itself. `ciphertextB64` is the encrypted vault JSON.
async function vaultStoreSaveBlob({ kdf, encryption, ciphertextB64, updatedAt }) {
  const row = {
    key: VAULT_META_KEY,
    schemaVersion: VAULT_SCHEMA_VERSION,
    kdf,
    encryption,
    ciphertext: ciphertextB64,
    updatedAt: updatedAt || new Date().toISOString()
  };
  await IDB.put('meta', row);
  return row;
}

// Used only by "Delete Vault" (Settings-style danger action) and by import
// when the user explicitly chooses to replace an existing vault rather than
// merge. Never called as part of lock/unlock.
async function vaultStoreDeleteBlob() {
  await IDB.delete('meta', VAULT_META_KEY);
}
