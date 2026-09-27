// --- Google Drive Sync (chunked, incremental) -----------------------------
// Layout inside the user's chosen Drive folder:
//
//   <Sync Folder>/
//     settings.json            <- categories + recurringItems + due items +
//                                  budgets (global + per-month overrides) +
//                                  familyMembers + tags. Always small, so
//                                  it's just overwritten wholesale on every
//                                  backup. No chunking.
//     splitwise.json           <- Splitwise groups (members + expenses per
//                                  group). Capped at 5 groups total, so like
//                                  settings.json it's just overwritten
//                                  wholesale every backup/restore - no need
//                                  for the chunking/dirty-tracking machinery
//                                  built for the (unbounded) expenses list.
//     expenses_manifest.json   <- index of every month chunk: {fileId, count,
//                                  updatedAt}. One small file means restore
//                                  never has to list-and-guess; it just reads
//                                  this and knows exactly what exists.
//     expenses/
//       2024-01.json           <- one small file per calendar month:
//       2024-02.json              {yearMonth, count, expenses, updatedAt}
//       ...
//
// Backups only touch months that actually changed since the last backup
// (tracked in storage.js as "dirty months") - years of history sitting
// untouched costs nothing on every subsequent sync. Restores compare the
// manifest's per-month `updatedAt` against what was last pulled locally and
// skip re-downloading anything unchanged, so re-syncing a large history is
// cheap after the first time.
//
// Legacy single-file backups (life_tracker_data.json, from before this
// rewrite) are still recognized on restore and transparently upgraded to
// this format on the next backup.

const G_TOKEN_KEY = 'life_tracker_gdrive_token';
const G_TOKEN_EXPIRY_KEY = 'life_tracker_gdrive_token_expiry';
// Caches the resolved ROOT sync folder's id, keyed to the folder NAME it was
// resolved for. Exists purely to dodge a real Google Drive gotcha: the
// files.list search endpoint (used by getOrCreateFolder/findFileByName) is
// only EVENTUALLY consistent with files.create - a folder/file created a
// moment ago can still come back empty from a search for a few seconds.
// Backup-immediately-followed-by-Restore is exactly the shape that triggers
// this, and getOrCreateFolder reacting to "found nothing" by creating a
// SECOND folder with the same name is how you get silent duplicate backup
// folders and "No backup found" right after a successful upload. See
// resolveRootFolderId() below.
const G_ROOT_FOLDER_CACHE_KEY = 'life_tracker_gfolder_cache';

const SETTINGS_FILE_NAME = 'settings.json';
const SPLITWISE_FILE_NAME = 'splitwise.json';
const MANIFEST_FILE_NAME = 'expenses_manifest.json';
const EXPENSES_FOLDER_NAME = 'expenses';
const LEGACY_BACKUP_FILE_NAME = 'life_tracker_data.json';

let gdriveToken = null;
let tokenClient = null;

// Single place that updates the "Connected"/"Offline" pill in the header,
// so authenticate/restore/disconnect all agree on what it looks like. Also
// owns the header's quick "Sync to Drive" shortcut button right next to it -
// that button only ever makes sense to show once we're actually connected,
// so its visibility is tied to the exact same signal, right here, rather
// than being a separate thing callers have to remember to toggle themselves.
function setDriveConnectedUI(connected) {
  const status = document.getElementById('globalDriveStatus');
  const syncBtn = document.getElementById('globalDriveSyncBtn');
  if (!status) return;
  if (connected) {
    status.innerHTML = '<i class="fa-brands fa-google-drive text-amber-500"></i> Connected';
    status.classList.remove('text-slate-400', 'bg-white');
    status.classList.add('text-slate-700', 'bg-amber-50', 'border-amber-100');
    if (syncBtn) syncBtn.classList.remove('hidden');
  } else {
    status.innerHTML = '<i class="fa-brands fa-google-drive"></i> Offline';
    status.classList.add('text-slate-400', 'bg-white');
    status.classList.remove('text-slate-700', 'bg-amber-50', 'border-amber-100');
    if (syncBtn) syncBtn.classList.add('hidden');
  }
}

// Access tokens from Google Identity Services are short-lived (~1hr) but we
// cache one in localStorage so a page refresh or tab switch doesn't force a
// fresh login every time - only once the cached token actually expires.
function persistDriveToken(token, expiresInSeconds) {
  localStorage.setItem(G_TOKEN_KEY, token);
  localStorage.setItem(G_TOKEN_EXPIRY_KEY, String(Date.now() + (Number(expiresInSeconds) || 3600) * 1000));
}

function clearPersistedDriveToken() {
  localStorage.removeItem(G_TOKEN_KEY);
  localStorage.removeItem(G_TOKEN_EXPIRY_KEY);
}

function loadPersistedDriveToken() {
  const token = localStorage.getItem(G_TOKEN_KEY);
  const expiry = Number(localStorage.getItem(G_TOKEN_EXPIRY_KEY) || 0);
  // 30s safety buffer so we don't hand back a token that's about to expire mid-request.
  if (token && expiry > Date.now() + 30000) return token;
  clearPersistedDriveToken();
  return null;
}

// Called once on app boot. First tries the cached token (covers the common
// "I just refreshed the page" case instantly, no network needed). If that's
// gone/expired but a Client ID is saved, it tries a silent (no popup) Google
// re-auth - works if the browser still has an active Google session and the
// user previously granted consent. Fails silently otherwise; user can still
// hit "Connect Auth" manually.
function tryRestoreDriveSession() {
  const cached = loadPersistedDriveToken();
  if (cached) {
    gdriveToken = cached;
    setDriveConnectedUI(true);
    if (currentTab === 'settings') renderSettings(document.getElementById('mainContainer'));
    return;
  }

  if (!isGoogleDriveConfigured()) return;

  const attemptSilentAuth = () => {
    if (typeof google === 'undefined' || !google.accounts) return;
    const silentClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (response) => {
        if (!response || response.error || !response.access_token) return; // silent fail, no popup shown
        gdriveToken = response.access_token;
        persistDriveToken(response.access_token, response.expires_in);
        setDriveConnectedUI(true);
        if (currentTab === 'settings') renderSettings(document.getElementById('mainContainer'));
      }
    });
    silentClient.requestAccessToken({ prompt: '' });
  };

  // The GIS script tag loads async/defer, so poll briefly until it's ready.
  let attempts = 0;
  const poll = setInterval(() => {
    attempts++;
    if (typeof google !== 'undefined' && google.accounts) {
      clearInterval(poll);
      attemptSilentAuth();
    } else if (attempts > 20) {
      clearInterval(poll); // ~6s of trying, then give up quietly
    }
  }, 300);
}

function authenticateGoogleDrive() {
  if (!isGoogleDriveConfigured()) return alert('Google Drive backup is not configured yet. Set GOOGLE_OAUTH_CLIENT_ID in js/config.js first.');

  if (typeof google === 'undefined' || !google.accounts) {
    return alert('Google scripts are loading or offline. Check internet connection.');
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_OAUTH_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: (response) => {
      if (response.error) {
        alert('Authentication failed: ' + response.error);
        return;
      }
      gdriveToken = response.access_token;
      persistDriveToken(response.access_token, response.expires_in);
      setDriveConnectedUI(true);

      // Re-render settings if open
      if (currentTab === 'settings') renderSettings(document.getElementById('mainContainer'));
    }
  });
  tokenClient.requestAccessToken({ prompt: 'consent' });
}

function disconnectDrive() {
  // Wipe the token from memory AND the persisted cache - no API revoking.
  gdriveToken = null;
  clearPersistedDriveToken();
  setDriveConnectedUI(false);

  // Re-render Settings screen to show Connect button and disable Backup/Restore
  if (currentTab === 'settings') {
    renderSettings(document.getElementById('mainContainer'));
    document.getElementById('driveSyncNotice').innerText = 'Drive disconnected from this session.';
    document.getElementById('driveSyncNotice').className = 'text-[11px] text-center text-slate-500 font-medium h-4';
  }
}

// --- Low-level Drive REST helpers (generic - no knowledge of "expenses" or
// "settings", just "folders and small JSON files") --------------------------

// Search-only half of getOrCreateFolder, split out so the Danger Zone's
// "delete all Drive backups" flow can look up the 'expenses' subfolder
// WITHOUT accidentally creating it just to immediately delete it again.
async function findFolder(folderName, parentId) {
  const parentClause = parentId ? ` and '${parentId}' in parents` : '';
  const query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false${parentClause}`;
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${gdriveToken}` }
  });
  const searchData = await searchRes.json();
  return (searchData.files && searchData.files[0]) || null;
}

async function getOrCreateFolder(folderName, parentId) {
  const existing = await findFolder(folderName, parentId);
  if (existing) return existing.id;

  const metadata = { name: folderName, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) metadata.parents = [parentId];

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${gdriveToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata)
  });
  const createData = await createRes.json();
  return createData.id;
}

// Deletes a single Drive file OR folder (folders take everything inside them
// with them). 404 counts as success too - "already gone" is exactly the
// state we wanted, whether we did it or the user deleted it by hand earlier.
async function deleteDriveFile(fileId) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${gdriveToken}` }
  });
  return res.ok || res.status === 404;
}

// Resolves the sync root folder AND the nested "expenses" subfolder that
// holds the monthly chunk files. Two lightweight list/create calls, cached
// per-call (not across calls) since folder ids rarely matter outside a
// single backup/restore run.
async function ensureSyncFolders() {
  const folderName = GOOGLE_DRIVE_BACKUP_FOLDER_NAME;
  const rootId = await resolveRootFolderId(folderName);
  const expensesFolderId = await getOrCreateFolder(EXPENSES_FOLDER_NAME, rootId);
  return { rootId, expensesFolderId };
}

// Prefers a locally cached root-folder id over a fresh by-name search,
// re-validating it with a cheap GET-by-id (immediately consistent, unlike
// files.list) rather than trusting it blindly forever. Only falls back to
// search-or-create when there's no cache yet, or the cached folder is
// confirmed gone (404) or trashed - any other hiccup (network blip, rate
// limit) just trusts the cache rather than risk minting a duplicate folder.
async function resolveRootFolderId(folderName) {
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(G_ROOT_FOLDER_CACHE_KEY) || 'null'); } catch (e) { /* ignore */ }
  const cachedId = (cached && cached.name === folderName) ? cached.id : null;

  if (cachedId) {
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${cachedId}?fields=id,trashed`, {
        headers: { Authorization: `Bearer ${gdriveToken}` }
      });
      if (res.status !== 404) {
        if (!res.ok) return cachedId; // transient error - trust the cache
        const data = await res.json();
        if (!data.trashed) return cachedId;
      }
      // else: definitively gone or trashed - fall through and re-resolve
    } catch (e) {
      return cachedId; // network hiccup - trust the cache
    }
  }

  const rootId = await getOrCreateFolder(folderName);
  localStorage.setItem(G_ROOT_FOLDER_CACHE_KEY, JSON.stringify({ name: folderName, id: rootId }));
  return rootId;
}

// Same eventual-consistency dodge as resolveRootFolderId, but for individual
// FILES (settings.json/splitwise.json/expenses_manifest.json) instead of the
// root folder - prefers a cached fileId (from syncMeta, saved right after
// the backup that created it) over a name search, since a name search can
// miss a file that was created moments ago. Falls back to search-by-name
// whenever there's no cached id or it no longer resolves.
async function findFileByIdOrName(cachedId, fileName, parentId) {
  if (cachedId) {
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${cachedId}?fields=id,trashed`, {
        headers: { Authorization: `Bearer ${gdriveToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (!data.trashed) return { id: cachedId };
      }
    } catch (e) { /* fall through to name search */ }
  }
  return findFileByName(fileName, parentId);
}

async function findFileByName(fileName, parentId) {
  const query = `name='${fileName}' and '${parentId}' in parents and trashed=false`;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${gdriveToken}` }
  });
  const data = await res.json();
  return (data.files && data.files[0]) || null;
}

async function fetchJsonFile(fileId) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${gdriveToken}` }
  });
  if (!res.ok) throw new Error(`Drive fetch failed (${res.status})`);
  return res.json();
}

// Creates a brand new small JSON file (needs the multipart dance because
// metadata - name/parent - has to travel alongside the content on create).
async function createJsonFile(parentId, fileName, dataObj) {
  const boundary = 'life_tracker_boundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;
  const metadata = { name: fileName, mimeType: 'application/json', parents: [parentId] };
  const body =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(dataObj) +
    closeDelim;

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { Authorization: `Bearer ${gdriveToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body
  });
  if (!res.ok) throw new Error(`Drive create failed for ${fileName} (${res.status})`);
  const created = await res.json();
  return created.id;
}

// Overwrites CONTENT ONLY (uploadType=media, no metadata re-sent). Smaller,
// cheaper request than a full multipart re-upload - and this is the path
// that runs once PER DIRTY MONTH on every backup, so keeping it lean matters.
async function overwriteJsonFile(fileId, dataObj) {
  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${gdriveToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(dataObj)
  });
  return res.ok;
}

// Create-or-update a small JSON file. Pass `cachedFileId` when you already
// know it (from the manifest or sync-meta) to skip a lookup entirely; falls
// back to a name search, and finally a fresh create, if that id has gone stale.
async function upsertJsonFile(parentId, fileName, dataObj, cachedFileId) {
  if (cachedFileId) {
    const ok = await overwriteJsonFile(cachedFileId, dataObj);
    if (ok) return cachedFileId;
  }
  const existing = await findFileByName(fileName, parentId);
  if (existing) {
    await overwriteJsonFile(existing.id, dataObj);
    return existing.id;
  }
  return createJsonFile(parentId, fileName, dataObj);
}

// Runs `fn` over `items` with at most `limit` in flight at once - browsers
// only allow ~6 concurrent connections per origin anyway, and this keeps a
// first-time restore of years of monthly chunks from hammering the Drive
// API with hundreds of simultaneous requests.
function mapWithConcurrency(items, limit, fn) {
  return new Promise((resolve) => {
    const results = new Array(items.length);
    if (items.length === 0) return resolve(results);
    let nextIndex = 0;
    let finished = 0;

    function launchNext() {
      if (nextIndex >= items.length) return;
      const i = nextIndex++;
      Promise.resolve(fn(items[i], i))
        .then(res => { results[i] = res; })
        .catch(err => { results[i] = { __error: err }; })
        .finally(() => {
          finished++;
          if (finished === items.length) resolve(results);
          else launchNext();
        });
    }
    for (let k = 0; k < Math.min(limit, items.length); k++) launchNext();
  });
}

// --- Busy-state spinner helpers ---------------------------------------
// All Drive-touching buttons share the same manifest + dirty-months
// bookkeeping, so running two Drive operations at once would race on it -
// hence disabling ALL of them together, not just the one clicked. The
// active button's markup is swapped for a spinner + label and restored
// verbatim afterward (via a dataset stash) rather than hardcoding what it
// should go back to, so this stays correct even if a button's label ever
// changes.
const DRIVE_ACTION_BUTTON_IDS = ['btnBackupDrive', 'btnRestoreDrive', 'globalDriveSyncBtn'];

// The header's quick-sync shortcut is icon-only (a small round button) -
// swapping its content for a spinner should stay icon-only too, not cram a
// text busyLabel into a 28px circle the way the full-width Settings buttons
// can afford to.
const ICON_ONLY_BUTTON_IDS = new Set(['globalDriveSyncBtn']);

// `activeButtonIds` accepts either one id or an array - an array matters
// because the Settings-page "Backup" button AND the header's quick-sync
// button both trigger the exact same backupToGoogleDrive() call, and
// whichever one the user actually clicked should be the one that spins.
function setDriveActionBusy(activeButtonIds, busyLabel) {
  const activeSet = new Set(Array.isArray(activeButtonIds) ? activeButtonIds : [activeButtonIds]);
  DRIVE_ACTION_BUTTON_IDS.forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = true;
    if (activeSet.has(id)) {
      btn.dataset.originalHtml = btn.innerHTML;
      btn.innerHTML = ICON_ONLY_BUTTON_IDS.has(id)
        ? '<i class="fa-solid fa-spinner fa-spin text-xs"></i>'
        : `<i class="fa-solid fa-spinner fa-spin mr-1"></i> ${busyLabel}`;
    }
  });
}

function clearDriveActionBusy() {
  DRIVE_ACTION_BUTTON_IDS.forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = false;
    if (btn.dataset.originalHtml) {
      btn.innerHTML = btn.dataset.originalHtml;
      delete btn.dataset.originalHtml;
    }
  });
}

// --- Backup ----------------------------------------------------------------

async function backupToGoogleDrive() {
  if (!gdriveToken) return alert('Authenticate with Google first!');
  // driveSyncNotice only exists in the DOM while Settings is the current tab
  // (it's part of renderSettings' template) - but this can now also be
  // triggered from the header's quick-sync button on ANY screen, so every
  // notice update below has to tolerate it being absent. When it IS absent,
  // the terminal success/error messages fall back to a plain alert() so a
  // header-triggered sync still gives some feedback beyond the spinner.
  const notice = document.getElementById('driveSyncNotice');
  const setNotice = (text, cls) => {
    if (!notice) return;
    notice.innerText = text;
    notice.className = `text-[11px] text-center ${cls} font-medium h-4`;
  };
  setDriveActionBusy(['btnBackupDrive', 'globalDriveSyncBtn'], 'Uploading...');
  setNotice('Preparing backup...', 'text-blue-500');

  try {
    const { rootId, expensesFolderId } = await ensureSyncFolders();
    const syncMeta = await getSyncMeta();

    // Find the existing remote manifest UP FRONT (cached id first, else a
    // fresh lookup by name in the current folder). This doubles as the
    // detector for "the whole Drive backup folder vanished" - e.g. the user
    // deleted it by hand in Drive, or used the Danger Zone's "delete all
    // Drive backups" option. Local dirty-month tracking only records what
    // changed SINCE THE LAST BACKUP - it has no idea Drive's copy got wiped
    // out from under it, so trusting it blindly here would mean months that
    // were already "clean" locally never get re-uploaded to the new folder,
    // and a later restore finds nothing ("No backup found").
    let manifestFileId = syncMeta.manifestFileId;
    let manifest = manifestFileId ? await fetchJsonFile(manifestFileId).catch(() => null) : null;
    if (!manifest) {
      const found = await findFileByName(MANIFEST_FILE_NAME, rootId);
      manifestFileId = found ? found.id : null;
      manifest = found ? await fetchJsonFile(found.id).catch(() => null) : null;
    }

    const remoteManifestMissing = !manifest;
    const trackedDirtyMonths = syncMeta.dirtyMonths || [];
    const localMonths = Array.from(new Set(appData.expenses.map(e => yearMonthOf(e.date))));
    // Remote manifest missing but local history exists -> trust nothing,
    // re-upload every month we actually have. Otherwise stick with the
    // normal incremental "only what changed" list.
    const dirtyMonths = remoteManifestMissing
      ? Array.from(new Set([...trackedDirtyMonths, ...localMonths]))
      : trackedDirtyMonths;

    if (remoteManifestMissing && localMonths.length > 0) {
      setNotice('Drive backup not found - re-uploading full history...', 'text-amber-600');
    }

    // Settings (categories + recurringItems + due items + budgets + family
    // members + tags) are always small, so they're just overwritten
    // wholesale every backup - no chunking needed.
    setNotice('Syncing settings...', 'text-blue-500');
    const settingsPayload = {
      categories: appData.categories,
      recurringItems: appData.recurringItems,
      items: appData.items,
      budgets: appData.budgets,
      familyMembers: appData.familyMembers,
      tags: appData.tags,
      savedAt: new Date().toISOString()
    };
    const settingsFileId = await upsertJsonFile(rootId, SETTINGS_FILE_NAME, settingsPayload, syncMeta.settingsFileId);

    // Splitwise groups are capped at 5 total, so - same reasoning as
    // settings.json above - just read the whole store fresh from IndexedDB
    // (not the in-memory `splitGroups` variable, which is only populated
    // while the Splitwise overlay is actually open and would be stale/empty
    // otherwise) and overwrite the Drive copy wholesale every backup.
    setNotice('Syncing Splitwise groups...', 'text-blue-500');
    const splitwisePayload = {
      groups: await IDB.getAll('splitGroups'),
      savedAt: new Date().toISOString()
    };
    const splitwiseFileId = await upsertJsonFile(rootId, SPLITWISE_FILE_NAME, splitwisePayload, syncMeta.splitwiseFileId);

    // manifestFileId/manifest were already resolved up front (see the
    // remoteManifestMissing check above) - no need to look them up again.
    if (dirtyMonths.length > 0) {
      manifest = manifest || { chunks: {} };
      manifest.chunks = manifest.chunks || {};

      const remoteVersions = {};
      for (let i = 0; i < dirtyMonths.length; i++) {
        const month = dirtyMonths[i];
        setNotice(`Uploading ${month} (${i + 1}/${dirtyMonths.length})...`, 'text-blue-500');

        const monthExpenses = appData.expenses.filter(e => yearMonthOf(e.date) === month);
        const updatedAt = new Date().toISOString();
        const chunk = { yearMonth: month, count: monthExpenses.length, expenses: monthExpenses, updatedAt };

        const existingChunk = manifest.chunks[month];
        const chunkFileId = await upsertJsonFile(expensesFolderId, `${month}.json`, chunk, existingChunk && existingChunk.fileId);

        manifest.chunks[month] = { fileId: chunkFileId, count: chunk.count, updatedAt };
        remoteVersions[month] = updatedAt;
      }

      setNotice('Updating index...', 'text-blue-500');
      manifestFileId = await upsertJsonFile(rootId, MANIFEST_FILE_NAME, manifest, manifestFileId);

      await clearDirtyMonths(dirtyMonths, remoteVersions);
    }

    await saveSyncMeta({ settingsFileId, manifestFileId, splitwiseFileId });

    const resultMessage = dirtyMonths.length > 0 ? `Synced ${dirtyMonths.length} month(s) + settings.` : 'Settings synced. Expenses already up to date.';
    setNotice(resultMessage, 'text-emerald-600');
    if (!notice) alert(`Drive sync complete. ${resultMessage}`);
  } catch (err) {
    console.error(err);
    setNotice('Error: ' + err.message, 'text-rose-600');
    if (!notice) alert('Drive sync failed: ' + err.message);
  } finally {
    clearDriveActionBusy();
  }
}

// --- Danger Zone: wipe the Drive backup, keep settings.json ----------------
// A deliberate, one-way trip that only touches the REMOTE copy - local data
// on this device is never touched. Handy as a genuine "start the cloud
// backup over from scratch" button, and it also happens to be exactly the
// state a manually-deleted Drive folder leaves behind, so it's a good way to
// sanity-check the self-healing logic in backupToGoogleDrive() above (hit
// this, then just hit Backup - it should silently rebuild everything).
async function deleteAllDriveBackupsExceptSettings() {
  if (!gdriveToken) return alert('Authenticate with Google first!');
  if (!confirm('This permanently deletes your Drive backup - all expense history and Splitwise groups stored there - EXCEPT settings.json (categories/recurring items/due items/budgets/family members). Data on THIS device is untouched. This cannot be undone. Continue?')) return;

  const notice = document.getElementById('driveSyncNotice');
  const setNotice = (text, cls) => {
    if (!notice) return;
    notice.innerText = text;
    notice.className = `text-[11px] text-center ${cls} font-medium h-4`;
  };
  setDriveActionBusy('btnBackupDrive', 'Deleting Drive backup...');
  setNotice('Deleting Drive backup...', 'text-blue-500');

  try {
    const folderName = GOOGLE_DRIVE_BACKUP_FOLDER_NAME;
    const rootId = await resolveRootFolderId(folderName);
    const syncMeta = await getSyncMeta();

    const [manifestFile, splitwiseFile, legacyFile, expensesFolder] = await Promise.all([
      findFileByIdOrName(syncMeta.manifestFileId, MANIFEST_FILE_NAME, rootId),
      findFileByIdOrName(syncMeta.splitwiseFileId, SPLITWISE_FILE_NAME, rootId),
      findFileByName(LEGACY_BACKUP_FILE_NAME, rootId),
      findFolder(EXPENSES_FOLDER_NAME, rootId)
    ]);

    // Deleting the "expenses" FOLDER takes every monthly chunk inside it
    // along with it in one call - no need to enumerate them individually.
    await Promise.all(
      [manifestFile, splitwiseFile, legacyFile, expensesFolder]
        .filter(Boolean)
        .map(f => deleteDriveFile(f.id))
    );

    // Forget local bookkeeping for everything just deleted, but KEEP
    // settingsFileId untouched - settings.json wasn't touched on Drive.
    // Clearing dirtyMonths/remoteChunkVersions here isn't strictly required
    // (backupToGoogleDrive's remoteManifestMissing check will rebuild both
    // from scratch the moment it notices the manifest is gone) but there's
    // no reason to leave stale bookkeeping lying around either.
    await saveSyncMeta({ manifestFileId: null, splitwiseFileId: null, dirtyMonths: [], remoteChunkVersions: {} });

    setNotice('Drive backup deleted (settings kept). Next Backup re-uploads everything fresh.', 'text-emerald-600');
    if (currentTab === 'settings') renderSettings(document.getElementById('mainContainer'));
  } catch (err) {
    console.error(err);
    setNotice('Error deleting Drive backup: ' + err.message, 'text-rose-600');
  } finally {
    clearDriveActionBusy();
  }
}

// --- Restore -----------------------------------------------------------------

// Holds whatever we already fetched (manifest/settings, or a full legacy
// blob) while the user is picking a year in the modal below. Only one
// restore can be "in progress but awaiting a year choice" at a time, which
// is all a single-user, single-tab app ever needs (YAGNI - no reason to
// build anything fancier than a module-level stash for this).
let _pendingRestore = null;

// Replaces ONLY the given months' worth of local expenses with `newExpenses`
// - every other month (other years, or years the user didn't pick) is left
// completely untouched. This is what makes year-scoped restore a MERGE
// rather than a destructive full replace: picking "2022" to peek at old data
// should never quietly delete 2023-2026 sitting right there on the device.
function mergeExpensesForMonths(newExpenses, targetMonths) {
  const months = targetMonths || Array.from(new Set(newExpenses.map(e => yearMonthOf(e.date))));
  const monthSet = new Set(months);
  const untouchedLocal = appData.expenses.filter(e => !monthSet.has(yearMonthOf(e.date)));
  appData.expenses = untouchedLocal.concat(newExpenses);
}

// Unlike expenses, Splitwise groups aren't year-scoped and there's no
// diffing/merge needed - it's a full REPLACE of the local store with
// whatever's on Drive, same wholesale treatment as settings.json. Safe to
// call unconditionally (no-ops if there's nothing to restore) from every
// restore code path, including the early-return "no expense history yet"
// branches that never reach the year-picker/confirmYearRestore flow at all.
async function applyRestoredSplitwiseData(splitwiseData) {
  if (!splitwiseData || !Array.isArray(splitwiseData.groups)) return;

  await IDB.replaceAll('splitGroups', splitwiseData.groups);

  // If the Splitwise overlay happens to be open right now, refresh it in
  // place so it doesn't keep showing stale pre-restore data until the user
  // backs out and back in. (openSplitwise() itself always re-fetches fresh
  // from IndexedDB anyway, so this is only needed for the "already open"
  // case.)
  const overlay = document.getElementById('splitwiseOverlay');
  if (overlay && !overlay.classList.contains('hidden')) {
    splitGroups = await IDB.getAll('splitGroups');
    splitGroups.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    renderSplitwiseView();
  }
}

async function restoreFromGoogleDrive() {
  if (!gdriveToken) return alert('Authenticate with Google first!');
  const notice = document.getElementById('driveSyncNotice');
  const setNotice = (text, cls) => {
    notice.innerText = text;
    notice.className = `text-[11px] text-center ${cls} font-medium h-4`;
  };
  setDriveActionBusy('btnRestoreDrive', 'Checking...');
  setNotice('Checking Drive...', 'text-blue-500');

  try {
    const folderName = GOOGLE_DRIVE_BACKUP_FOLDER_NAME;
    const rootId = await resolveRootFolderId(folderName);
    const syncMeta = await getSyncMeta();

    // Splitwise groups aren't year-scoped like expenses (max 5 groups,
    // wholesale-synced) - so this happens right here, unconditionally,
    // BEFORE any of the expense year-picker branching below. It used to be
    // deferred into _pendingRestore and only applied once the user picked a
    // year and clicked "Restore" inside that modal - which meant it never
    // ran at all if there was nothing new expense-wise to restore, or if
    // the user hadn't gotten around to completing that flow yet. Splitting
    // it out here means hitting "Restore Data" always pulls the latest
    // Splitwise groups immediately, independent of whatever happens with
    // expenses afterward.
    //
    // Every lookup below prefers findFileByIdOrName (cached id from syncMeta
    // first) over a raw findFileByName search - a plain name search can miss
    // a file that was created moments ago (Drive's search index lags behind
    // files.create by a few seconds), which is exactly the "Backup said
    // done, Restore says no backup found" bug this fixes.
    const splitwiseFile = await findFileByIdOrName(syncMeta.splitwiseFileId, SPLITWISE_FILE_NAME, rootId);
    const splitwiseData = splitwiseFile ? await fetchJsonFile(splitwiseFile.id).catch(() => null) : null;
    if (splitwiseData) {
      setNotice('Syncing Splitwise groups...', 'text-blue-500');
      await applyRestoredSplitwiseData(splitwiseData);
    }

    const manifestFile = await findFileByIdOrName(syncMeta.manifestFileId, MANIFEST_FILE_NAME, rootId);

    if (!manifestFile) {
      // No chunked backup yet - fall back to an old-format single-file backup.
      // It's already ONE full download either way, so there's no extra network
      // cost to also offering a year filter here - just filter client-side
      // after the (already required) full fetch.
      const legacyFile = await findFileByName(LEGACY_BACKUP_FILE_NAME, rootId);
      if (!legacyFile) {
        setNotice(`No backup found in folder '${folderName}'.`, 'text-rose-600');
        return;
      }

      setNotice('Downloading legacy backup...', 'text-blue-500');
      const legacyData = await fetchJsonFile(legacyFile.id);
      const legacyExpenses = Array.isArray(legacyData.expenses) ? legacyData.expenses : [];
      const years = Array.from(new Set(legacyExpenses.map(e => yearMonthOf(e.date).slice(0, 4)))).sort().reverse();

      if (years.length === 0) {
        // Nothing dated at all - nothing to pick a year for, just bring in settings.
        mergeIntoAppData({ ...legacyData, expenses: undefined });
        await saveState({ skipDirtyTracking: true });
        setNotice('Restored settings from legacy backup (no expenses found).', 'text-emerald-600');
        navigate('home');
        return;
      }

      _pendingRestore = { mode: 'legacy', legacyData, legacyExpenses };
      setNotice('Choose a year to restore below.', 'text-blue-500');
      openYearPickerModal(years, { legacyUpgradeNotice: true });
      return;
    }

    const settingsFile = await findFileByIdOrName(syncMeta.settingsFileId, SETTINGS_FILE_NAME, rootId);
    const [manifest, settingsData] = await Promise.all([
      fetchJsonFile(manifestFile.id),
      settingsFile ? fetchJsonFile(settingsFile.id) : Promise.resolve(null)
    ]);

    const remoteMonths = Object.keys(manifest.chunks || {});

    if (remoteMonths.length === 0) {
      if (settingsData) mergeIntoAppData(settingsData);
      await saveState({ skipDirtyTracking: true });
      setNotice('Backup found, but it has no expense history yet. Settings synced.', 'text-amber-600');
      navigate('home');
      return;
    }

    const years = Array.from(new Set(remoteMonths.map(m => m.slice(0, 4)))).sort().reverse();
    _pendingRestore = { mode: 'chunked', manifest, settingsData, manifestFile, settingsFile, remoteMonths };
    setNotice('Choose a year to restore below.', 'text-blue-500');
    openYearPickerModal(years, {});
  } catch (err) {
    console.error(err);
    setNotice('Restore Error: ' + err.message, 'text-rose-600');
  } finally {
    // Clears regardless of outcome: error, "nothing to restore" early-return,
    // or successfully handing off to the year-picker modal (which owns the
    // busy/spinner state for the actual restore work from here on - see
    // confirmYearRestore).
    clearDriveActionBusy();
  }
}

// Small year-picker form, reusing the app's existing generic formModal
// (same one used for Add Expense, the Expiry Check report, etc). Lets you
// restore any combination of years instead of dragging in the entire
// history in one go - tick as many boxes as you need (e.g. restoring 2023
// AND 2024 together so they're both on-device for comparison).
function openYearPickerModal(years, opts) {
  const modal = document.getElementById('formModal');
  const content = document.getElementById('formModalContent');
  modal.classList.remove('hidden');

  const currentYear = String(new Date().getFullYear());
  // Always offer the current year as a tickable option even if nothing's
  // been backed up for it yet, so "grab an old year AND this year in one
  // go" is just two checkboxes instead of a separate bolt-on control.
  const allYears = years.includes(currentYear) ? years : [...years, currentYear].sort().reverse();
  const defaultChecked = new Set([years.includes(currentYear) ? currentYear : years[0]]);

  content.innerHTML = `
    <h3 class="text-sm font-bold text-slate-800 mb-1"><i class="fa-solid fa-cloud-arrow-down text-blue-500 mr-1"></i>Restore from Drive</h3>
    <p class="text-[11px] text-slate-400 mb-3">${opts.legacyUpgradeNotice
      ? 'Older-format backup found - pick which year(s) to bring in now, it upgrades to the new format automatically on your next backup.'
      : `Found expense history across ${years.length} year(s). Pick one or more to restore - keeps things light instead of pulling everything.`}</p>

    <label class="block text-[10px] font-bold text-slate-500 mb-1">Year(s) to restore</label>
    <div class="space-y-1 max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2.5 mb-1">
      ${allYears.map(y => `
        <label class="flex items-center gap-2 text-xs text-slate-600 py-0.5">
          <input type="checkbox" class="restoreYearCheckbox w-4 h-4 rounded border-slate-300" value="${y}" ${defaultChecked.has(y) ? 'checked' : ''}>
          ${y}${!years.includes(y) ? ' <span class="text-slate-300">(no backup yet)</span>' : ''}${y === currentYear ? ' <span class="text-amber-600 font-semibold">(full overwrite)</span>' : ''}
        </label>
      `).join('')}
    </div>
    <p id="restoreYearError" class="text-[10px] text-rose-500 mb-2 hidden">Pick at least one year.</p>

    <p class="text-[10px] text-amber-600 mb-2"><i class="fa-solid fa-triangle-exclamation mr-1"></i>${currentYear} is handled differently from other years: since Home/Expenses live off it daily, restoring it fully <strong>replaces</strong> your local ${currentYear} data with Drive's version (anything not yet backed up will be lost). Other years just merge in on top - nothing else on-device gets touched.</p>

    <p class="text-[10px] text-slate-400 mb-3">Categories, recurring items, due items, and Splitwise groups always sync in full - they're tiny.</p>

    <div class="grid grid-cols-2 gap-2">
      <button onclick="closeFormModal(); _pendingRestore = null;" class="py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">Cancel</button>
      <button onclick="confirmYearRestore()" class="py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition">Restore</button>
    </div>
  `;
}

async function confirmYearRestore() {
  if (!_pendingRestore) return closeFormModal();

  // Validate before touching the modal - an empty selection should nudge
  // the user to tick something, not silently vanish and do nothing.
  const checked = Array.from(document.querySelectorAll('.restoreYearCheckbox:checked')).map(el => el.value);
  if (checked.length === 0) {
    const errorEl = document.getElementById('restoreYearError');
    if (errorEl) errorEl.classList.remove('hidden');
    return;
  }

  const pending = _pendingRestore;
  _pendingRestore = null;

  // Keep the modal open with a spinner instead of closing it immediately -
  // the actual restore involves real network round-trips (fetching months
  // from Drive), and closing right away made it look like the click did
  // nothing until Home suddenly re-rendered moments later.
  const modalContent = document.getElementById('formModalContent');
  const showModalProgress = (text) => {
    if (!modalContent) return;
    modalContent.innerHTML = `
      <div class="py-10 flex flex-col items-center justify-center gap-3 text-center">
        <i class="fa-solid fa-circle-notch fa-spin text-3xl text-blue-500"></i>
        <p class="text-xs font-semibold text-slate-700">${text}</p>
      </div>
    `;
  };
  const showModalError = (message) => {
    if (!modalContent) return;
    modalContent.innerHTML = `
      <div class="py-6 flex flex-col items-center justify-center gap-3 text-center">
        <i class="fa-solid fa-circle-exclamation text-3xl text-rose-500"></i>
        <p class="text-xs font-semibold text-rose-600">Restore failed</p>
        <p class="text-[10px] text-slate-400 px-2">${message}</p>
        <button onclick="closeFormModal()" class="mt-2 px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">Close</button>
      </div>
    `;
  };

  const notice = document.getElementById('driveSyncNotice');
  const setNotice = (text, cls) => {
    if (notice) {
      notice.innerText = text;
      notice.className = `text-[11px] text-center ${cls} font-medium h-4`;
    }
    showModalProgress(text);
  };

  const targetYears = new Set(checked);
  const currentYear = currentYearStr();
  const restoringCurrentYear = targetYears.has(currentYear);

  setNotice(`Restoring ${Array.from(targetYears).join(', ')}...`, 'text-blue-500');

  try {
    // Splitwise sync already happened up in restoreFromGoogleDrive(), before
    // this year-picker modal even opened - it's intentionally NOT repeated
    // here, since it isn't year-scoped and shouldn't depend on the user
    // completing this expense-specific flow at all.

    // Local storage is capped to "current year + whatever's being restored
    // right now" - anything else gets purged first. Two things fall out of
    // this single step:
    //   1. Scale: restoring a new comparison year (e.g. 2024) auto-evicts
    //      whatever OTHER non-current year was sitting locally (e.g. 2025)
    //      instead of piling up forever - IndexedDB rewrite cost per edit
    //      stays bounded to roughly two years' worth of data, always, no
    //      matter how many different years you've ever compared over time.
    //   2. The current year, when it's the one being restored, purges its
    //      OWN data too (not just "other" years) - that's what makes
    //      restoring current year a full overwrite rather than a merge
    //      (see the note further down where it gets rebuilt from Drive).
    const localYears = new Set(appData.expenses.map(e => yearMonthOf(e.date).slice(0, 4)));
    const keepYears = new Set([...targetYears, currentYear]);
    const yearsToPurge = Array.from(localYears).filter(y => !keepYears.has(y));
    if (restoringCurrentYear) yearsToPurge.push(currentYear);

    if (yearsToPurge.length > 0) {
      await purgeYearsFromMemory(yearsToPurge);
      // Bake the eviction into the dirty-tracking snapshot RIGHT NOW, before
      // any other logic runs. Without this, a later non-skip saveState()
      // call (e.g. the legacy branch below, which intentionally marks its
      // own newly-restored months dirty) would ALSO see these purged
      // months as "changed since last snapshot" and mark them dirty too -
      // and backupToGoogleDrive() uploads a dirty month's CURRENT local
      // expenses verbatim, empty array and all. That would silently wipe
      // the evicted year's real data on Drive, exactly the thing eviction
      // is supposed to never do. Evictions must be invisible to Drive,
      // always - not "usually fine depending on which branch runs next".
      await saveState({ skipDirtyTracking: true });
    }

    if (pending.mode === 'legacy') {
      const { legacyData, legacyExpenses } = pending;
      const filteredExpenses = legacyExpenses.filter(e => targetYears.has(yearMonthOf(e.date).slice(0, 4)));

      // Settings-ish fields only - `expenses: undefined` stops mergeIntoAppData
      // from clobbering appData.expenses with the ENTIRE unfiltered legacy
      // history, which would defeat the whole point of picking a year.
      mergeIntoAppData({ ...legacyData, expenses: undefined });
      mergeExpensesForMonths(filteredExpenses, null);

      await saveState(); // normal diff -> marks these months dirty so the next backup ships them in the new chunked format
      setNotice(`Restored ${filteredExpenses.length} expense(s) for ${Array.from(targetYears).join(', ')}. Upgrading Drive format...`, 'text-blue-500');
      await backupToGoogleDrive(); // seeds settings.json + chunked expenses/manifest from here on - done BEFORE navigating away so its own progress notices still have a live #driveSyncNotice element to write into
      closeFormModal();
      navigate('home');
      return;
    }

    const { manifest, settingsData, manifestFile, settingsFile, remoteMonths } = pending;
    const targetMonths = remoteMonths.filter(m => targetYears.has(m.slice(0, 4)));

    if (settingsData) mergeIntoAppData(settingsData);

    if (targetMonths.length === 0) {
      // Local data for the selected year(s) was already purged above (and
      // baked into the snapshot as non-dirty) even though Drive turned out
      // to have nothing for them - that's the whole point of "overwrite":
      // Drive's emptiness IS the answer, not a reason to keep stale local
      // data around. Nothing changed since that bake-in, so there's
      // nothing new to mark dirty here either.
      await saveState({ skipDirtyTracking: true });
      setNotice(`No expense data found on Drive for ${Array.from(targetYears).join(', ')}.${restoringCurrentYear ? ' Local data for it was cleared to match.' : ' Settings synced.'}`, 'text-amber-600');
      closeFormModal();
      navigate('home');
      return;
    }

    const syncMeta = await getSyncMeta();
    const knownVersions = syncMeta.remoteChunkVersions || {};

    let fetchedCount = 0;
    let skippedCount = 0;
    const monthResults = await mapWithConcurrency(targetMonths, 5, async (month) => {
      const meta = manifest.chunks[month];

      if (knownVersions[month] === meta.updatedAt) {
        const localMatch = appData.expenses.filter(e => yearMonthOf(e.date) === month);
        if (localMatch.length === meta.count) {
          skippedCount++;
          return localMatch; // already in sync locally, don't bother re-downloading
        }
      }

      fetchedCount++;
      const chunk = await fetchJsonFile(meta.fileId);
      return Array.isArray(chunk.expenses) ? chunk.expenses : [];
    });

    setNotice(`Merging ${targetMonths.length} month(s) (${fetchedCount} downloaded, ${skippedCount} already up to date)...`, 'text-blue-500');

    mergeExpensesForMonths(monthResults.flat(), targetMonths);

    const newVersions = {};
    targetMonths.forEach(month => { newVersions[month] = manifest.chunks[month].updatedAt; });

    // Local now matches Drive exactly for these months by construction, so
    // skip dirty-tracking - there's nothing new to re-upload.
    await saveState({ skipDirtyTracking: true });
    await saveSyncMeta({
      remoteChunkVersions: { ...knownVersions, ...newVersions },
      manifestFileId: manifestFile.id,
      settingsFileId: settingsFile ? settingsFile.id : null,
      lastRestoreAt: new Date().toISOString()
    });

    setNotice(`Restored ${Array.from(targetYears).join(', ')} (${targetMonths.length} month(s)).`, 'text-emerald-600');
    closeFormModal();
    navigate('home');
  } catch (err) {
    console.error(err);
    if (notice) {
      notice.innerText = 'Restore Error: ' + err.message;
      notice.className = 'text-[11px] text-center text-rose-600 font-medium h-4';
    }
    showModalError(err.message);
  }
}
