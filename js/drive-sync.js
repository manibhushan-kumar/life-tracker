// --- Google Drive Sync (chunked, incremental) -----------------------------
// Layout inside the user's chosen Drive folder:
//
//   <Sync Folder>/
//     settings.json            <- categories + recurringItems + due items +
//                                  budgets (global + per-month overrides) +
//                                  familyMembers + tags + vehicles +
//                                  fuelLogs + loans. Always small, so it's
//                                  just overwritten wholesale on every
//                                  backup. No chunking.
//     splitwise.json           <- Splitwise groups (members + expenses per
//                                  group). Capped at 5 groups total, so like
//                                  settings.json it's just overwritten
//                                  wholesale every backup/restore - no need
//                                  for the chunking/dirty-tracking machinery
//                                  built for the (unbounded) expenses list.
//     groups.json              <- General-purpose reusable contact Groups
//                                  (js/groups.js - name + member list only,
//                                  no expenses/balances). Same wholesale
//                                  overwrite treatment as splitwise.json,
//                                  just a separate file/store since it's a
//                                  distinct, Splitwise-independent concept.
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
// Set the first time the one-time "tap here to connect" coach-mark gets
// dismissed (explicit X, clicking the pill, or ever successfully
// connecting) - see maybeShowDriveConnectHint/dismissDriveConnectHint below.
const G_HINT_DISMISSED_KEY = 'life_tracker_gdrive_hint_dismissed';
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
const GROUPS_FILE_NAME = 'groups.json';
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
    status.classList.remove('text-slate-400', 'bg-white', 'cursor-pointer', 'hover:bg-slate-50');
    status.classList.add('text-slate-700', 'bg-amber-50', 'border-amber-100', 'cursor-default');
    status.disabled = true;
    status.setAttribute('aria-label', 'Google Drive connected');
    status.title = 'Google Drive connected';
    if (syncBtn) syncBtn.classList.remove('hidden');
    dismissDriveConnectHint(); // no need to keep nudging once actually connected
  } else {
    status.innerHTML = '<i class="fa-brands fa-google-drive"></i> Offline';
    status.classList.add('text-slate-400', 'bg-white', 'cursor-pointer', 'hover:bg-slate-50');
    status.classList.remove('text-slate-700', 'bg-amber-50', 'border-amber-100', 'cursor-default');
    status.disabled = false;
    status.setAttribute('aria-label', 'Google Drive offline. Click to connect.');
    status.title = 'Click to connect Google Drive';
    if (syncBtn) syncBtn.classList.add('hidden');
  }
  updateDriveUploadButtonState(); // connecting/disconnecting always changes whether there's anything to push
}

// The header pill IS the manual login affordance now (see index.html - it's
// a real <button>, not a decorative span). Clicking it while offline kicks
// off the exact same consent-popup flow as the Settings "Connect" button -
// one login implementation, two entry points, no duplicated OAuth logic.
// setDriveConnectedUI disables the button once connected so there's nothing
// to click there, but this guard is a cheap safety net regardless.
function handleDriveStatusClick() {
  dismissDriveConnectHint(); // they found it and clicked it - job done
  if (gdriveToken) return;
  authenticateGoogleDrive();
}

// One-time coach-mark nudging brand-new users toward the header pill as the
// login entry point (see the #driveConnectHint markup in index.html) -
// without it, "Offline" just looks like a status label, not a button. Only
// shown if Drive backup is actually configured (no point advertising a
// feature that isn't set up yet) and only if never dismissed/connected
// before. Silenced permanently via G_HINT_DISMISSED_KEY the first time any
// of those things happens - it never nags a returning user twice.
function maybeShowDriveConnectHint() {
  if (!isGoogleDriveConfigured()) return;
  if (gdriveToken) return;
  if (localStorage.getItem(G_HINT_DISMISSED_KEY)) return;
  const hint = document.getElementById('driveConnectHint');
  if (!hint) return;
  // Small delay so it appears after the page has visibly settled rather than
  // flashing in as part of the very first paint.
  setTimeout(() => hint.classList.remove('hidden'), 800);
}

function dismissDriveConnectHint() {
  localStorage.setItem(G_HINT_DISMISSED_KEY, '1');
  const hint = document.getElementById('driveConnectHint');
  if (hint) hint.classList.add('hidden');
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

// Called once on app boot. Only restores an ALREADY-connected session from
// the cached token (localStorage read, instant, no network call, no Google
// script involved at all). It deliberately does NOT attempt any kind of
// silent/background Google re-auth anymore - that used to fire a
// google.accounts.oauth2 token request on every load for anyone not
// connected, which is exactly the surprise "why is it trying to log me into
// Google on page load" behavior. Login is now always a deliberate,
// user-initiated click - either the header pill (see handleDriveStatusClick)
// or the "Connect" button in Settings - never something that fires itself.
function tryRestoreDriveSession() {
  const cached = loadPersistedDriveToken();
  if (cached) {
    gdriveToken = cached;
    setDriveConnectedUI(true);
    if (currentTab === 'settings') renderSettings(document.getElementById('mainContainer'));
  }
}

async function authenticateGoogleDrive() {
  if (!isGoogleDriveConfigured()) return showAlert('Google Drive backup is not configured yet. Set GOOGLE_OAUTH_CLIENT_ID in js/config.js first.');

  if (typeof google === 'undefined' || !google.accounts) {
    return showAlert('Google scripts are loading or offline. Check internet connection.');
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_OAUTH_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: async (response) => {
      if (response.error) {
        await showAlert('Authentication failed: ' + response.error);
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

// Subset of the above that actually PUSHES local data to Drive (as opposed
// to btnRestoreDrive, which only pulls) - see updateDriveUploadButtonState()
// below for why only these two care about "is there anything new to send".
const UPLOAD_BUTTON_IDS = ['btnBackupDrive', 'globalDriveSyncBtn'];

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
  // The blanket `disabled = false` above is deliberately naive (it doesn't
  // know or care WHY a button was busy) - this re-applies the "nothing new
  // to upload" state on top of it immediately after, so upload buttons
  // don't flash briefly re-enabled after a backup/restore/danger-zone
  // action that just made them up to date.
  updateDriveUploadButtonState();
}

// Disables btnBackupDrive/globalDriveSyncBtn whenever there's genuinely
// nothing local to push - see hasLocalChangesToSync() in storage.js for the
// actual "is anything dirty" logic. Called after every Drive operation
// finishes (via clearDriveActionBusy), on connect/disconnect (via
// setDriveConnectedUI), and after every local mutation (via saveState in
// storage.js) - so the button's state is always a few-hundred-ms-fresh
// reflection of reality, never something a caller has to remember to sync
// by hand.
// --- Blocking status modal for Upload/Restore/Danger-Zone operations ------
// Native alert()/a tiny inline text notice both have the same real problem:
// neither one stops the user from tapping over to another tab and logging a
// new expense while a restore is still merging data in the background. This
// modal (#driveBusyModal in index.html) is genuinely undismissable while
// busy - no close button, no backdrop-click handler - so the whole page is
// blocked for the actual duration of the operation, not just "looks busy".
let _driveBusyAutoCloseTimer = null;

// Opens (or updates, if already open) the busy modal in its "working"
// state - spinner, no dismiss button. First call in an operation opens it;
// every subsequent call just swaps the message in place, so callers never
// have to think about show-vs-update.
function driveSyncProgress(text) {
  clearTimeout(_driveBusyAutoCloseTimer);
  const modal = document.getElementById('driveBusyModal');
  const content = document.getElementById('driveBusyModalContent');
  modal.classList.remove('hidden');
  content.innerHTML = `
    <i class="fa-solid fa-circle-notch fa-spin text-3xl text-blue-500 mb-3" aria-hidden="true"></i>
    <p class="text-xs font-semibold text-slate-700">${text}</p>
  `;

  // Mirrored into Settings' inline notice too, purely as a nice-to-have for
  // anyone actually looking at that spot - the modal is the real,
  // page-blocking source of truth now.
  const notice = document.getElementById('driveSyncNotice');
  if (notice) {
    notice.innerText = text;
    notice.className = 'text-[11px] text-center text-blue-500 font-medium h-4';
  }
}

// Terminal state (success or error) - swaps in an OK button and
// auto-dismisses after 5s if the user doesn't click it first. This is the
// ONLY point an Upload/Restore/Danger-Zone operation becomes dismissable.
function driveSyncDone(text, isError) {
  clearTimeout(_driveBusyAutoCloseTimer);
  const modal = document.getElementById('driveBusyModal');
  const content = document.getElementById('driveBusyModalContent');
  modal.classList.remove('hidden');
  content.innerHTML = `
    <i class="fa-solid ${isError ? 'fa-circle-exclamation text-rose-500' : 'fa-circle-check text-emerald-500'} text-3xl mb-3" aria-hidden="true"></i>
    <p class="text-xs font-semibold ${isError ? 'text-rose-600' : 'text-slate-700'} mb-4">${text}</p>
    <button onclick="hideDriveBusyModal()" autofocus class="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition">OK</button>
  `;

  const notice = document.getElementById('driveSyncNotice');
  if (notice) {
    notice.innerText = text;
    notice.className = `text-[11px] text-center ${isError ? 'text-rose-600' : 'text-emerald-600'} font-medium h-4`;
  }

  _driveBusyAutoCloseTimer = setTimeout(hideDriveBusyModal, 5000);
}

function hideDriveBusyModal() {
  clearTimeout(_driveBusyAutoCloseTimer);
  document.getElementById('driveBusyModal').classList.add('hidden');
}

async function updateDriveUploadButtonState() {
  const connected = !!gdriveToken;
  const upToDate = connected && !(await hasLocalChangesToSync());
  UPLOAD_BUTTON_IDS.forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    // Never fight setDriveActionBusy() mid-flight - if it's showing a
    // spinner right now, that busy state owns `disabled` until it's done.
    if (btn.dataset.originalHtml) return;
    btn.disabled = !connected || upToDate;
  });
}

// --- Backup ----------------------------------------------------------------

// Does the actual writing to Drive - settings/Splitwise wholesale, dirty
// expense months chunked, manifest updated - and records what got pushed.
// Split out of backupToGoogleDrive() so both the normal (no-conflict) path
// AND resolveConflictOverwrite/resolveConflictPull (below) share ONE
// implementation instead of two copies quietly drifting apart over time.
async function performBackupWrite({ rootId, expensesFolderId, manifest, manifestFileId, dirtyMonths, syncMeta }) {
  // Settings (categories + recurringItems + due items + budgets + family
  // members + tags + vehicles + fuelLogs + loans) are always small, so
  // they're just overwritten wholesale every backup - no chunking needed.
  driveSyncProgress('Syncing settings...');
  const settingsPayload = {
    categories: appData.categories,
    recurringItems: appData.recurringItems,
    items: appData.items,
    budgets: appData.budgets,
    familyMembers: appData.familyMembers,
    tags: appData.tags,
    vehicles: appData.vehicles,
    fuelLogs: appData.fuelLogs,
    loans: appData.loans,
    userName: appData.userName,
    savedAt: new Date().toISOString()
  };
  const settingsFileId = await upsertJsonFile(rootId, SETTINGS_FILE_NAME, settingsPayload, syncMeta.settingsFileId);

  // Splitwise groups are capped at 5 total, so - same reasoning as
  // settings.json above - just read the whole store fresh from IndexedDB
  // (not the in-memory `splitGroups` variable, which is only populated
  // while the Splitwise overlay is actually open and would be stale/empty
  // otherwise) and overwrite the Drive copy wholesale every backup.
  driveSyncProgress('Syncing Splitwise groups...');
  const splitwisePayload = {
    groups: await IDB.getAll('splitGroups'),
    savedAt: new Date().toISOString()
  };
  const splitwiseFileId = await upsertJsonFile(rootId, SPLITWISE_FILE_NAME, splitwisePayload, syncMeta.splitwiseFileId);

  // Same wholesale-replace reasoning as Splitwise groups above, just for
  // the general-purpose Groups feature (js/groups.js) - its own separate
  // store/file, not folded into splitwise.json, since a Group has no
  // expenses/balances of its own and is meant to be reusable by future
  // features beyond just Splitwise.
  driveSyncProgress('Syncing Groups...');
  const groupsPayload = {
    groups: await IDB.getAll('contactGroups'),
    savedAt: new Date().toISOString()
  };
  const groupsFileId = await upsertJsonFile(rootId, GROUPS_FILE_NAME, groupsPayload, syncMeta.groupsFileId);

  // manifestFileId/manifest were already resolved by the caller.
  if (dirtyMonths.length > 0) {
    manifest = manifest || { chunks: {} };
    manifest.chunks = manifest.chunks || {};

    const remoteVersions = {};
    for (let i = 0; i < dirtyMonths.length; i++) {
      const month = dirtyMonths[i];
      driveSyncProgress(`Uploading ${month} (${i + 1}/${dirtyMonths.length})...`);

      const monthExpenses = appData.expenses.filter(e => yearMonthOf(e.date) === month);
      const updatedAt = new Date().toISOString();
      const chunk = { yearMonth: month, count: monthExpenses.length, expenses: monthExpenses, updatedAt };

      const existingChunk = manifest.chunks[month];
      const chunkFileId = await upsertJsonFile(expensesFolderId, `${month}.json`, chunk, existingChunk && existingChunk.fileId);

      manifest.chunks[month] = { fileId: chunkFileId, count: chunk.count, updatedAt };
      remoteVersions[month] = updatedAt;
    }

    driveSyncProgress('Updating index...');
    manifestFileId = await upsertJsonFile(rootId, MANIFEST_FILE_NAME, manifest, manifestFileId);

    await clearDirtyMonths(dirtyMonths, remoteVersions);
  }

  // Fingerprint/stamp everything JUST pushed, so the next
  // hasLocalChangesToSync() (storage.js) and findSyncConflicts() (above)
  // both know THESE exact payloads are now in sync with Drive.
  await saveSyncMeta({
    settingsFileId,
    manifestFileId,
    splitwiseFileId,
    groupsFileId,
    lastSyncedSettingsFingerprint: _settingsSyncFingerprint(),
    lastSyncedSplitwiseFingerprint: JSON.stringify(splitwisePayload.groups),
    lastSyncedGroupsFingerprint: JSON.stringify(groupsPayload.groups),
    knownRemoteSettingsSavedAt: settingsPayload.savedAt,
    knownRemoteSplitwiseSavedAt: splitwisePayload.savedAt,
    knownRemoteGroupsSavedAt: groupsPayload.savedAt
  });

  return dirtyMonths.length > 0 ? `Synced ${dirtyMonths.length} month(s) + settings.` : 'Settings synced. Expenses already up to date.';
}

async function backupToGoogleDrive() {
  if (!gdriveToken) { driveSyncDone('Authenticate with Google first!', true); return; }
  setDriveActionBusy(['btnBackupDrive', 'globalDriveSyncBtn'], 'Uploading...');
  driveSyncProgress('Preparing backup...');

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
      driveSyncProgress('Drive backup not found - re-uploading full history...');
    }

    // --- Conflict check ----------------------------------------------------
    // Before writing ANYTHING, make sure Drive hasn't moved on since this
    // device last looked at whatever it's about to overwrite. Cheap: these
    // are the same small settings.json/splitwise.json files anyway.
    driveSyncProgress('Checking for conflicts...');
    const [remoteSettingsFile, remoteSplitwiseFile, remoteGroupsFile] = await Promise.all([
      findFileByIdOrName(syncMeta.settingsFileId, SETTINGS_FILE_NAME, rootId),
      findFileByIdOrName(syncMeta.splitwiseFileId, SPLITWISE_FILE_NAME, rootId),
      findFileByIdOrName(syncMeta.groupsFileId, GROUPS_FILE_NAME, rootId)
    ]);
    const [remoteSettingsData, remoteSplitwiseData, remoteGroupsData] = await Promise.all([
      remoteSettingsFile ? fetchJsonFile(remoteSettingsFile.id).catch(() => null) : Promise.resolve(null),
      remoteSplitwiseFile ? fetchJsonFile(remoteSplitwiseFile.id).catch(() => null) : Promise.resolve(null),
      remoteGroupsFile ? fetchJsonFile(remoteGroupsFile.id).catch(() => null) : Promise.resolve(null)
    ]);

    const conflicts = findSyncConflicts({ syncMeta, manifest, dirtyMonths, remoteSettingsData, remoteSplitwiseData, remoteGroupsData });

    if (conflicts.hasAny) {
      // Hand off to the interactive conflict-choice modal - hide the
      // undismissable busy modal first, or the user could never reach it.
      hideDriveBusyModal();
      openSyncConflictModal({
        conflicts, rootId, expensesFolderId, manifest, manifestFileId, dirtyMonths, syncMeta,
        remoteSettingsData, remoteSplitwiseData, remoteGroupsData, remoteSettingsFile, remoteSplitwiseFile, remoteGroupsFile
      });
      return;
    }

    const resultMessage = await performBackupWrite({ rootId, expensesFolderId, manifest, manifestFileId, dirtyMonths, syncMeta });
    driveSyncDone(resultMessage, false);
  } catch (err) {
    console.error(err);
    driveSyncDone('Error: ' + err.message, true);
  } finally {
    clearDriveActionBusy();
  }
}

// --- Conflict resolution modal ---------------------------------------------
// Shown when backupToGoogleDrive()'s pre-write check finds Drive has moved
// on since this device last looked. Holds whatever the caller already
// fetched (manifest, remote settings/Splitwise data, file ids) so neither
// resolution path has to re-fetch it - mirrors _pendingRestore's role for
// the year-picker modal (same single-user/single-tab reasoning applies).
let _pendingConflictResolution = null;

function openSyncConflictModal(ctx) {
  _pendingConflictResolution = ctx;
  const { conflicts } = ctx;
  const modal = document.getElementById('formModal');
  const content = document.getElementById('formModalContent');
  modal.classList.remove('hidden');

  const pieces = [];
  if (conflicts.settings) pieces.push('Settings');
  if (conflicts.splitwise) pieces.push('Splitwise groups');
  if (conflicts.groups) pieces.push('Groups');
  if (conflicts.months.length) pieces.push(`Expenses (${conflicts.months.join(', ')})`);

  content.innerHTML = `
    <h3 class="text-sm font-bold text-slate-800 mb-1"><i class="fa-solid fa-triangle-exclamation text-amber-500 mr-1"></i>Drive has changes you haven't pulled</h3>
    <p class="text-[11px] text-slate-400 mb-3">Another device backed up since this one last checked - <strong class="text-slate-600">${pieces.join(', ')}</strong>. Uploading now would overwrite that.</p>

    <div class="space-y-2">
      <button onclick="resolveConflictPull()" class="w-full py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition">
        <i class="fa-solid fa-cloud-arrow-down mr-1"></i> Pull latest first (recommended)
      </button>
      <button onclick="resolveConflictOverwrite()" class="w-full py-2.5 border border-rose-200 text-rose-600 rounded-xl text-xs font-semibold hover:bg-rose-50 transition">
        <i class="fa-solid fa-cloud-arrow-up mr-1"></i> Overwrite Drive with mine
      </button>
      <button onclick="cancelConflictResolution()" class="w-full py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 transition">
        Cancel
      </button>
    </div>

    <p class="text-[10px] text-slate-400 mt-3">Expenses merge automatically by entry - nothing gets dropped. Settings/Splitwise pull Drive's version wholesale, so redo any pending edit there afterward.</p>
  `;
}

function cancelConflictResolution() {
  _pendingConflictResolution = null;
  closeFormModal();
  clearDriveActionBusy();
  hideDriveBusyModal(); // defensive - should already be hidden, cheap insurance against a stray blocking modal
}

// "I know, push mine over it anyway" - runs the exact same write path a
// conflict-free backup would have, just with the check already bypassed by
// the user's explicit choice.
async function resolveConflictOverwrite() {
  const ctx = _pendingConflictResolution;
  _pendingConflictResolution = null;
  closeFormModal();
  if (!ctx) return;

  setDriveActionBusy(['btnBackupDrive', 'globalDriveSyncBtn'], 'Uploading...');
  driveSyncProgress('Uploading...');
  try {
    const resultMessage = await performBackupWrite(ctx);
    driveSyncDone(resultMessage, false);
  } catch (err) {
    console.error(err);
    driveSyncDone('Error: ' + err.message, true);
  } finally {
    clearDriveActionBusy();
  }
}

// "Pull Drive's version first" - Settings/Splitwise are wholesale-replaced
// with Drive's copy (same as a normal restore - no merge engine exists for
// arbitrary settings blobs, see the chat where this was scoped). Expenses
// get the smarter treatment: conflicted months are merged BY ID with
// mergeExpensesByIdForConflict() instead of replaced, so this device's own
// pending edits survive right alongside whatever the other device pushed -
// then immediately re-uploaded as the new merged version, which is what
// makes this a real "pull + rebase + push" instead of just a restore.
async function resolveConflictPull() {
  const ctx = _pendingConflictResolution;
  _pendingConflictResolution = null;
  closeFormModal();
  if (!ctx) return;

  const { conflicts, remoteSettingsData, remoteSplitwiseData, remoteGroupsData, remoteSettingsFile, remoteSplitwiseFile, remoteGroupsFile, manifest } = ctx;

  setDriveActionBusy(['btnBackupDrive', 'globalDriveSyncBtn'], 'Pulling...');
  driveSyncProgress('Pulling Drive\'s latest...');
  try {
    if (conflicts.settings && remoteSettingsData) {
      await applyRestoredSettingsData(remoteSettingsData, remoteSettingsFile ? remoteSettingsFile.id : null);
    }
    if (conflicts.splitwise && remoteSplitwiseData) {
      await applyRestoredSplitwiseData(remoteSplitwiseData, remoteSplitwiseFile ? remoteSplitwiseFile.id : null);
    }
    if (conflicts.groups && remoteGroupsData) {
      await applyRestoredGroupsData(remoteGroupsData, remoteGroupsFile ? remoteGroupsFile.id : null);
    }

    for (const month of conflicts.months) {
      const remoteChunk = manifest.chunks[month];
      const remoteExpenses = remoteChunk
        ? await fetchJsonFile(remoteChunk.fileId).then(c => c.expenses || []).catch(() => [])
        : [];
      const localMonthExpenses = appData.expenses.filter(e => yearMonthOf(e.date) === month);
      const merged = mergeExpensesByIdForConflict(localMonthExpenses, remoteExpenses);
      appData.expenses = appData.expenses.filter(e => yearMonthOf(e.date) !== month).concat(merged);
    }

    // Persist. Settings/Splitwise bookkeeping was already handled by the
    // applyRestored*Data() calls above; expenses genuinely changed via the
    // merge above, so a normal (non-skip) saveState() correctly re-flags
    // those months dirty for the follow-up upload below.
    await saveState();
    await saveSyncMeta({ lastRestoreAt: new Date().toISOString() });

    const freshMeta = await getSyncMeta();
    const stillDirty = freshMeta.dirtyMonths || [];

    if (stillDirty.length > 0) {
      driveSyncProgress(`Merged with Drive's version - uploading the result...`);
      const resultMessage = await performBackupWrite({ ...ctx, dirtyMonths: stillDirty, syncMeta: freshMeta });
      driveSyncDone(`Pulled + ${resultMessage}`, false);
    } else {
      driveSyncDone('Pulled Drive\'s latest. Redo any pending Settings/Splitwise edit, then Upload again.', false);
    }

    if (currentTab === 'settings') renderSettings(document.getElementById('mainContainer'));
    else if (currentTab === 'home' || currentTab === 'expenses') navigate(currentTab);
  } catch (err) {
    console.error(err);
    driveSyncDone('Pull failed: ' + err.message, true);
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
  if (!gdriveToken) { driveSyncDone('Authenticate with Google first!', true); return; }
  if (!(await showConfirm('This permanently deletes your Drive backup - all expense history, Splitwise groups, and Groups stored there - EXCEPT settings.json (categories/recurring items/due items/budgets/family members). Data on THIS device is untouched. This cannot be undone. Continue?'))) return;

  setDriveActionBusy('btnBackupDrive', 'Deleting Drive backup...');
  driveSyncProgress('Deleting Drive backup...');

  try {
    const folderName = GOOGLE_DRIVE_BACKUP_FOLDER_NAME;
    const rootId = await resolveRootFolderId(folderName);
    const syncMeta = await getSyncMeta();

    const [manifestFile, splitwiseFile, groupsFile, legacyFile, expensesFolder] = await Promise.all([
      findFileByIdOrName(syncMeta.manifestFileId, MANIFEST_FILE_NAME, rootId),
      findFileByIdOrName(syncMeta.splitwiseFileId, SPLITWISE_FILE_NAME, rootId),
      findFileByIdOrName(syncMeta.groupsFileId, GROUPS_FILE_NAME, rootId),
      findFileByName(LEGACY_BACKUP_FILE_NAME, rootId),
      findFolder(EXPENSES_FOLDER_NAME, rootId)
    ]);

    // Deleting the "expenses" FOLDER takes every monthly chunk inside it
    // along with it in one call - no need to enumerate them individually.
    await Promise.all(
      [manifestFile, splitwiseFile, groupsFile, legacyFile, expensesFolder]
        .filter(Boolean)
        .map(f => deleteDriveFile(f.id))
    );

    // Forget local bookkeeping for everything just deleted, but KEEP
    // settingsFileId untouched - settings.json wasn't touched on Drive.
    // Clearing dirtyMonths/remoteChunkVersions here isn't strictly required
    // (backupToGoogleDrive's remoteManifestMissing check will rebuild both
    // from scratch the moment it notices the manifest is gone) but there's
    // no reason to leave stale bookkeeping lying around either.
    await saveSyncMeta({ manifestFileId: null, splitwiseFileId: null, groupsFileId: null, dirtyMonths: [], remoteChunkVersions: {} });

    driveSyncDone('Drive backup deleted (settings kept). Next Backup re-uploads everything fresh.', false);
    if (currentTab === 'settings') renderSettings(document.getElementById('mainContainer'));
  } catch (err) {
    console.error(err);
    driveSyncDone('Error deleting Drive backup: ' + err.message, true);
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

// --- Conflict resolution: id-based expense merge -------------------------
// Used ONLY when a backup detects another device already pushed a newer
// copy of a month this device is also trying to push (see
// findSyncConflicts/resolveConflictPull below). Unlike mergeExpensesForMonths
// above (a normal restore's deliberate "Drive wins, replace this month"),
// the goal here is the opposite: neither side's new expenses should be
// silently dropped, since both devices independently added real data.
//
// Expenses don't carry their own last-edited timestamp, so the one case
// this can't resolve with confidence - the exact same id edited DIFFERENTLY
// on both sides - is handled by keeping BOTH copies (remote keeps its
// original id, local's gets a fresh one) rather than guessing a winner and
// deleting money data on a coin flip. Worst case the user sees a harmless
// duplicate to clean up by hand; best case (the common one - both sides
// just ADDED different new expenses) it's a perfect, invisible merge.
function mergeExpensesByIdForConflict(localExpenses, remoteExpenses) {
  const merged = new Map(remoteExpenses.map(e => [e.id, e]));
  localExpenses.forEach(e => {
    const remoteMatch = merged.get(e.id);
    if (!remoteMatch) {
      merged.set(e.id, e); // local-only addition - keep it
    } else if (JSON.stringify(remoteMatch) !== JSON.stringify(e)) {
      const dupId = `${e.id}_dup${Math.random().toString(36).slice(2, 8)}`;
      merged.set(dupId, { ...e, id: dupId });
    }
    // else: identical on both sides, nothing to do - remote's copy already covers it
  });
  return Array.from(merged.values());
}

// True if Drive has moved on, for any piece this backup is about to
// overwrite, since the last time THIS device actually looked. Settings and
// Splitwise are compared by their `savedAt` stamp against what this device
// last recorded seeing (knownRemote*SavedAt); expense months are compared
// against the manifest's per-month `updatedAt` vs this device's own
// remoteChunkVersions record - but only for months this device is actually
// dirty on (a month neither side is touching can't conflict).
function findSyncConflicts({ syncMeta, manifest, dirtyMonths, remoteSettingsData, remoteSplitwiseData, remoteGroupsData }) {
  const conflicts = { settings: false, splitwise: false, groups: false, months: [] };

  if (remoteSettingsData && remoteSettingsData.savedAt !== (syncMeta.knownRemoteSettingsSavedAt || null)) {
    conflicts.settings = true;
  }
  if (remoteSplitwiseData && remoteSplitwiseData.savedAt !== (syncMeta.knownRemoteSplitwiseSavedAt || null)) {
    conflicts.splitwise = true;
  }
  if (remoteGroupsData && remoteGroupsData.savedAt !== (syncMeta.knownRemoteGroupsSavedAt || null)) {
    conflicts.groups = true;
  }

  const remoteVersions = syncMeta.remoteChunkVersions || {};
  const chunks = (manifest && manifest.chunks) || {};
  dirtyMonths.forEach(month => {
    const remoteChunk = chunks[month];
    if (remoteChunk && remoteChunk.updatedAt !== remoteVersions[month]) {
      conflicts.months.push(month);
    }
  });

  conflicts.hasAny = conflicts.settings || conflicts.splitwise || conflicts.groups || conflicts.months.length > 0;
  return conflicts;
}

// Unlike expenses, Splitwise groups aren't year-scoped and there's no
// diffing/merge needed - it's a full REPLACE of the local store with
// whatever's on Drive, same wholesale treatment as settings.json. Safe to
// call unconditionally (no-ops if there's nothing to restore) from every
// restore code path, including the early-return "no expense history yet"
// branches that never reach the year-picker/confirmYearRestore flow at all.
async function applyRestoredSplitwiseData(splitwiseData, splitwiseFileId) {
  if (!splitwiseData || !Array.isArray(splitwiseData.groups)) return;

  await IDB.replaceAll('splitGroups', splitwiseData.groups);

  // Local now matches Drive exactly for Splitwise - record that so
  // hasLocalChangesToSync()/findSyncConflicts() don't think there's
  // something new to push (or a conflict) moments after a restore/pull
  // that already brought this device fully up to date. Fingerprinted via a
  // FRESH IndexedDB read (not splitwiseData.groups directly) so it's byte-
  // for-byte comparable with what hasLocalChangesToSync() reads later -
  // IndexedDB's own key ordering on getAll() isn't guaranteed to match
  // whatever order the source JSON array happened to be in.
  const freshGroups = await IDB.getAll('splitGroups');
  await saveSyncMeta({
    splitwiseFileId,
    lastSyncedSplitwiseFingerprint: JSON.stringify(freshGroups),
    knownRemoteSplitwiseSavedAt: splitwiseData.savedAt || null
  });

  // If the Splitwise overlay happens to be open right now, refresh it in
  // place so it doesn't keep showing stale pre-restore data until the user
  // backs out and back in. (openSplitwise() itself always re-fetches fresh
  // from IndexedDB anyway, so this is only needed for the "already open"
  // case.)
  const overlay = document.getElementById('splitwiseOverlay');
  if (overlay && !overlay.classList.contains('hidden')) {
    splitGroups = freshGroups;
    splitGroups.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    renderSplitwiseView();
  }
}

// Same wholesale-replace treatment as applyRestoredSplitwiseData() above,
// just for the general-purpose Groups feature (js/groups.js) and its own
// 'contactGroups' store/groups.json file.
async function applyRestoredGroupsData(groupsData, groupsFileId) {
  if (!groupsData || !Array.isArray(groupsData.groups)) return;

  await IDB.replaceAll('contactGroups', groupsData.groups);

  const freshGroups = await IDB.getAll('contactGroups');
  await saveSyncMeta({
    groupsFileId,
    lastSyncedGroupsFingerprint: JSON.stringify(freshGroups),
    knownRemoteGroupsSavedAt: groupsData.savedAt || null
  });

  // If the Groups page happens to be open right now, refresh it in place
  // instead of leaving stale pre-restore data on screen until the user
  // navigates away and back (renderGroupsPage() itself always re-fetches
  // fresh from IndexedDB anyway, so this is only needed for "already open").
  if (typeof currentTab !== 'undefined' && currentTab === 'groups') {
    contactGroups = freshGroups;
    contactGroups.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    renderGroupsPage(document.getElementById('mainContainer'));
  }
}

// Wrapper around mergeIntoAppData() specifically for the Drive-restore path.
// mergeIntoAppData() itself stays Drive-agnostic (data-model.js has no
// business knowing about sync bookkeeping) - this is the one place that
// bridges the two, recording that this device's settings now mirror EXACTLY
// what Drive had at settingsData.savedAt. Same reasoning as
// applyRestoredSplitwiseData() above.
async function applyRestoredSettingsData(settingsData, settingsFileId) {
  if (!settingsData) return;
  mergeIntoAppData(settingsData);
  await saveSyncMeta({
    settingsFileId,
    lastSyncedSettingsFingerprint: _settingsSyncFingerprint(),
    knownRemoteSettingsSavedAt: settingsData.savedAt || null
  });
}

async function restoreFromGoogleDrive() {
  if (!gdriveToken) { driveSyncDone('Authenticate with Google first!', true); return; }
  setDriveActionBusy('btnRestoreDrive', 'Checking...');
  driveSyncProgress('Checking Drive...');

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
      driveSyncProgress('Syncing Splitwise groups...');
      await applyRestoredSplitwiseData(splitwiseData, splitwiseFile.id);
    }

    // Same unconditional, up-front treatment for the general-purpose Groups
    // feature (js/groups.js) - not year-scoped, wholesale-synced, so it
    // always pulls immediately too, independent of the expense year-picker
    // flow below.
    const groupsFile = await findFileByIdOrName(syncMeta.groupsFileId, GROUPS_FILE_NAME, rootId);
    const groupsData = groupsFile ? await fetchJsonFile(groupsFile.id).catch(() => null) : null;
    if (groupsData) {
      driveSyncProgress('Syncing Groups...');
      await applyRestoredGroupsData(groupsData, groupsFile.id);
    }

    const manifestFile = await findFileByIdOrName(syncMeta.manifestFileId, MANIFEST_FILE_NAME, rootId);

    if (!manifestFile) {
      // No chunked backup yet - fall back to an old-format single-file backup.
      // It's already ONE full download either way, so there's no extra network
      // cost to also offering a year filter here - just filter client-side
      // after the (already required) full fetch.
      const legacyFile = await findFileByName(LEGACY_BACKUP_FILE_NAME, rootId);
      if (!legacyFile) {
        driveSyncDone(`No backup found in folder '${folderName}'.`, false);
        return;
      }

      driveSyncProgress('Downloading legacy backup...');
      const legacyData = await fetchJsonFile(legacyFile.id);
      const legacyExpenses = Array.isArray(legacyData.expenses) ? legacyData.expenses : [];
      const years = Array.from(new Set(legacyExpenses.map(e => yearMonthOf(e.date).slice(0, 4)))).sort().reverse();

      if (years.length === 0) {
        // Nothing dated at all - nothing to pick a year for, just bring in settings.
        mergeIntoAppData({ ...legacyData, expenses: undefined });
        await saveState({ skipDirtyTracking: true });
        driveSyncDone('Restored settings from legacy backup (no expenses found).', false);
        navigate('home');
        return;
      }

      _pendingRestore = { mode: 'legacy', legacyData, legacyExpenses };
      hideDriveBusyModal(); // hand off to the interactive year-picker - it can't be reached with the busy modal on top
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
      if (settingsData) await applyRestoredSettingsData(settingsData, settingsFile ? settingsFile.id : null);
      await saveState({ skipDirtyTracking: true });
      driveSyncDone('Backup found, but it has no expense history yet. Settings synced.', false);
      navigate('home');
      return;
    }

    const years = Array.from(new Set(remoteMonths.map(m => m.slice(0, 4)))).sort().reverse();
    _pendingRestore = { mode: 'chunked', manifest, settingsData, manifestFile, settingsFile, remoteMonths };
    hideDriveBusyModal(); // hand off to the interactive year-picker - it can't be reached with the busy modal on top
    openYearPickerModal(years, {});
  } catch (err) {
    console.error(err);
    driveSyncDone('Restore Error: ' + err.message, true);
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

    <p class="text-[10px] text-slate-400 mb-3">Categories, recurring items, due items, Splitwise groups, and Groups always sync in full - they're tiny.</p>

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

  // Hand off from the interactive year-picker to the blocking busy modal -
  // the actual restore involves real network round-trips (fetching months
  // from Drive), and the busy modal is what keeps the rest of the app
  // (Expenses, Add Entry, etc) genuinely locked out while that happens.
  closeFormModal();

  const targetYears = new Set(checked);
  const currentYear = currentYearStr();
  const restoringCurrentYear = targetYears.has(currentYear);

  driveSyncProgress(`Restoring ${Array.from(targetYears).join(', ')}...`);

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
      driveSyncProgress(`Restored ${filteredExpenses.length} expense(s) for ${Array.from(targetYears).join(', ')}. Upgrading Drive format...`);
      await backupToGoogleDrive(); // seeds settings.json + chunked expenses/manifest from here on - shows its own driveSyncDone() when it finishes
      navigate('home');
      return;
    }

    const { manifest, settingsData, manifestFile, settingsFile, remoteMonths } = pending;
    const targetMonths = remoteMonths.filter(m => targetYears.has(m.slice(0, 4)));

    if (settingsData) await applyRestoredSettingsData(settingsData, settingsFile ? settingsFile.id : null);

    if (targetMonths.length === 0) {
      // Local data for the selected year(s) was already purged above (and
      // baked into the snapshot as non-dirty) even though Drive turned out
      // to have nothing for them - that's the whole point of "overwrite":
      // Drive's emptiness IS the answer, not a reason to keep stale local
      // data around. Nothing changed since that bake-in, so there's
      // nothing new to mark dirty here either.
      await saveState({ skipDirtyTracking: true });
      driveSyncDone(`No expense data found on Drive for ${Array.from(targetYears).join(', ')}.${restoringCurrentYear ? ' Local data for it was cleared to match.' : ' Settings synced.'}`, false);
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

    driveSyncProgress(`Merging ${targetMonths.length} month(s) (${fetchedCount} downloaded, ${skippedCount} already up to date)...`);

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

    driveSyncDone(`Restored ${Array.from(targetYears).join(', ')} (${targetMonths.length} month(s)).`, false);
    navigate('home');
  } catch (err) {
    console.error(err);
    driveSyncDone('Restore Error: ' + err.message, true);
  }
}
