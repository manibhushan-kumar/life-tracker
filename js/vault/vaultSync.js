// --- Vault <-> Google Drive sync -----------------------------------------
// Deliberately a SEPARATE, self-contained sync path from the
// settings/splitwise/groups/expenses pipeline in js/drive-sync.js - it only
// reuses that file's low-level, generic-JSON-file REST helpers
// (resolveRootFolderId/findFileByIdOrName/fetchJsonFile/upsertJsonFile) and
// its shared busy-modal helpers (driveSyncProgress/driveSyncDone). It does
// NOT touch performBackupWrite/findSyncConflicts/restoreFromGoogleDrive, so
// a bug here can't take down expense/settings backup, and vice versa.
//
// What actually goes over the wire is the exact row vaultStore.js keeps in
// IndexedDB - {kdf, encryption, ciphertext, updatedAt} - wholesale, as one
// small file named vault.enc inside the SAME backup folder
// (GOOGLE_DRIVE_BACKUP_FOLDER_NAME) everything else already uses. Sync never
// decrypts anything and never needs the master password - ciphertext is
// exactly as safe to upload/download as it is to leave sitting in
// IndexedDB.
//
// Conflict rule (never silently lose a newer copy, on either side):
// before uploading, fetch whatever's on Drive right now and compare its
// `updatedAt` against the local blob's. If Drive is newer, stop and ask the
// user Pull / Overwrite / Cancel instead of assuming local is right.

const VAULT_FILE_NAME = 'vault.enc';

function _vaultSyncRequireConnected() {
  if (!gdriveToken) throw new Error('Connect Google Drive first.');
}

async function _vaultSyncFindRemoteFile(rootId, syncMeta) {
  return findFileByIdOrName(syncMeta.vaultFileId, VAULT_FILE_NAME, rootId);
}

// Pushes the current LOCAL encrypted blob to Drive. Safe to call whether the
// vault is currently locked or unlocked - it only ever reads the opaque row
// from vaultStoreGetBlob(), never the decrypted contents.
async function vaultSyncUpload() {
  try {
    _vaultSyncRequireConnected();
    const localBlob = await vaultStoreGetBlob();
    if (!localBlob) throw new Error('Create a vault on this device before syncing it.');

    driveSyncProgress('Checking Drive for a newer vault...');
    const syncMeta = await getSyncMeta();
    const rootId = await resolveRootFolderId(GOOGLE_DRIVE_BACKUP_FOLDER_NAME);
    const remoteFile = await _vaultSyncFindRemoteFile(rootId, syncMeta);

    if (remoteFile) {
      let remoteBlob = null;
      try { remoteBlob = await fetchJsonFile(remoteFile.id); } catch (e) { /* treat as unreadable/missing, fall through to upload */ }

      // Normally only ask when Drive's copy is actually newer. But if this
      // device's local vault was wiped and recreated via vaultResetVault()
      // since the last sync, the new (empty) vault's updatedAt is always
      // "newer" than Drive's - that comparison alone would wrongly treat a
      // totally unrelated fresh vault as safe to silently overwrite Drive
      // with. vaultLocalResetSinceSync forces the same prompt in that case.
      const remoteIsNewer = remoteBlob && remoteBlob.updatedAt && new Date(remoteBlob.updatedAt) > new Date(localBlob.updatedAt || 0);
      const forcePromptAfterReset = remoteBlob && syncMeta.vaultLocalResetSinceSync;
      if (remoteIsNewer || forcePromptAfterReset) {
        hideDriveBusyModal();
        const choice = await _renderDialog({
          title: forcePromptAfterReset && !remoteIsNewer ? 'Drive already has a vault' : 'Newer vault found on Drive',
          message: forcePromptAfterReset && !remoteIsNewer
            ? 'This device\'s vault was reset since the last sync. Drive still has the OLDER vault from before that reset. Pull it down to recover it, or overwrite it permanently with this device\'s new (empty) vault?'
            : 'Another device backed up the vault more recently than this one. Pull that copy down, or overwrite it with what\'s on this device?',
          tone: 'warning',
          buttons: [
            { label: 'Cancel', style: 'secondary', value: 'cancel' },
            { label: 'Pull from Drive', style: 'secondary', value: 'pull' },
            { label: 'Overwrite Drive', style: 'danger', value: 'overwrite' }
          ]
        });
        if (choice === 'cancel' || !choice) return;
        if (choice === 'pull') {
          await vaultStoreSaveBlob({ kdf: remoteBlob.kdf, encryption: remoteBlob.encryption, ciphertextB64: remoteBlob.ciphertext, updatedAt: remoteBlob.updatedAt });
          vaultLockIfUnlocked();
          await saveSyncMeta({ vaultFileId: remoteFile.id, knownRemoteVaultSavedAt: remoteBlob.updatedAt, vaultLocalResetSinceSync: false });
          driveSyncDone('Pulled the vault from Drive. Unlock it to continue.');
          return;
        }
        // 'overwrite' falls through to the upload below.
        driveSyncProgress('Overwriting Drive\'s vault...');
      }
    }

    const fileId = await upsertJsonFile(rootId, VAULT_FILE_NAME, localBlob, syncMeta.vaultFileId || (remoteFile && remoteFile.id));
    await saveSyncMeta({ vaultFileId: fileId, knownRemoteVaultSavedAt: localBlob.updatedAt, vaultLocalResetSinceSync: false });
    driveSyncDone('Vault synced to Drive.');
  } catch (e) {
    driveSyncDone(e.message || 'Vault sync failed.', true);
  }
}

// Pulls whatever's on Drive down to this device, REPLACING the local
// encrypted blob wholesale (never merges item-by-item - there is no partial
// merge for a single opaque ciphertext blob). Refuses to silently discard a
// local copy that's actually newer than Drive's.
async function vaultSyncDownload() {
  try {
    _vaultSyncRequireConnected();
    driveSyncProgress('Looking for a vault backup on Drive...');
    const syncMeta = await getSyncMeta();
    const rootId = await resolveRootFolderId(GOOGLE_DRIVE_BACKUP_FOLDER_NAME);
    const remoteFile = await _vaultSyncFindRemoteFile(rootId, syncMeta);
    if (!remoteFile) throw new Error('No vault backup found on Drive yet.');

    const remoteBlob = await fetchJsonFile(remoteFile.id);
    const localBlob = await vaultStoreGetBlob();

    if (localBlob && localBlob.updatedAt && new Date(localBlob.updatedAt) > new Date(remoteBlob.updatedAt || 0)) {
      hideDriveBusyModal();
      const proceed = await showConfirm(
        'The vault on this device is newer than the one on Drive. Pulling will REPLACE this device\'s vault with the older Drive copy. Continue?',
        { title: 'Local vault is newer', confirmLabel: 'Pull anyway', danger: true }
      );
      if (!proceed) return;
      driveSyncProgress('Pulling vault from Drive...');
    }

    await vaultStoreSaveBlob({ kdf: remoteBlob.kdf, encryption: remoteBlob.encryption, ciphertextB64: remoteBlob.ciphertext, updatedAt: remoteBlob.updatedAt });
    vaultLockIfUnlocked();
    await saveSyncMeta({ vaultFileId: remoteFile.id, knownRemoteVaultSavedAt: remoteBlob.updatedAt });
    driveSyncDone('Vault pulled from Drive. Unlock it with the master password for that copy.');
  } catch (e) {
    driveSyncDone(e.message || 'Vault pull failed.', true);
  }
}
