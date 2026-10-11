// --- Vault crypto primitives -------------------------------------------
// Everything in this file is pure Web Crypto (crypto.subtle) - no
// third-party crypto library. This is the ONLY file that should ever touch
// a raw master password or a derived CryptoKey. Nothing here ever persists
// anything; callers own storage.
//
// Scheme: PBKDF2-HMAC-SHA256 (key derivation) -> AES-256-GCM (authenticated
// encryption of the whole vault JSON blob, not per-field). A fresh random
// salt is generated once per vault (and again on every master-password
// change); a fresh random IV is generated on every single encrypt call
// (required for GCM - reusing an IV with the same key breaks
// confidentiality). Wrong password -> AES-GCM auth tag check fails ->
// decrypt() rejects. There is no "weaker" fallback path.

const VAULT_PBKDF2_ITERATIONS = 310000; // OWASP (2023) floor for PBKDF2-HMAC-SHA256
const VAULT_SALT_BYTES = 16;
const VAULT_IV_BYTES = 12; // 96-bit IV is the recommended/optimal size for AES-GCM

function vaultRandomBytes(len) {
  return crypto.getRandomValues(new Uint8Array(len));
}

function vaultGenerateSalt() {
  return vaultRandomBytes(VAULT_SALT_BYTES);
}

function vaultGenerateIv() {
  return vaultRandomBytes(VAULT_IV_BYTES);
}

// ArrayBuffer/Uint8Array <-> base64 - safe for arbitrary binary (chunked so
// huge blobs don't blow the String.fromCharCode argument-count limit).
function vaultBytesToBase64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < u8.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, u8.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function vaultBase64ToBytes(b64) {
  const binary = atob(b64);
  const u8 = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) u8[i] = binary.charCodeAt(i);
  return u8;
}

// Derives a non-extractable AES-256-GCM CryptoKey from a master password +
// salt. Non-extractable so even code running in the same page can't pull
// the raw key bytes back out via exportKey - it can only be used to
// encrypt/decrypt via crypto.subtle.
async function vaultDeriveKey(masterPassword, saltBytes, iterations = VAULT_PBKDF2_ITERATIONS) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(masterPassword),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable
    ['encrypt', 'decrypt']
  );
}

// Encrypts a JS value (JSON-serializable) under the given key. Returns
// base64 iv + base64 ciphertext (ciphertext includes the GCM auth tag,
// appended by crypto.subtle.encrypt per the WebCrypto spec).
async function vaultEncryptJson(key, value) {
  const iv = vaultGenerateIv();
  const enc = new TextEncoder();
  const plaintext = enc.encode(JSON.stringify(value));
  const ciphertextBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return {
    iv: vaultBytesToBase64(iv),
    ciphertext: vaultBytesToBase64(ciphertextBuf)
  };
}

// Decrypts + JSON-parses. Throws (DOMException, "OperationError") if the
// key/password is wrong or the ciphertext was tampered with - GCM's auth
// tag check fails closed, there is no partial/garbled-output case to
// handle defensively.
async function vaultDecryptJson(key, ivBase64, ciphertextBase64) {
  const iv = vaultBase64ToBytes(ivBase64);
  const ciphertext = vaultBase64ToBytes(ciphertextBase64);
  const plaintextBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  const dec = new TextDecoder();
  return JSON.parse(dec.decode(plaintextBuf));
}
