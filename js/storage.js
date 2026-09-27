// --- Persistence Layer (IndexedDB) ---------------------------------------
// appData stays a plain in-memory object - every render function in
// index.html reads/writes it exactly like before. What changed is what
// backs it: instead of one giant JSON blob in localStorage (a hard ~5-10MB
// ceiling, and a synchronous stringify/parse that blocks the UI thread as
// the blob grows), each concern now lives in its own IndexedDB store and
// saves happen off the main thread.
//
// This file also tracks which calendar months of `expenses` have changed
// since the last successful Google Drive backup ("dirty months"), so
// drive-sync.js can upload just those months instead of the entire history
// every time - see _markDirtyMonthsFromDiff() below.

const LEGACY_LOCALSTORAGE_KEY = 'life_tracker_pwa_data';

let appData = getDefaultAppData();

// Snapshot of {id -> JSON string} for whatever's currently persisted, used
// purely to cheaply diff "what changed" on the next saveState() call.
// Rebuilt from IndexedDB on load, refreshed after every save.
let _lastSavedExpenseSnapshot = new Map();

// Compares `expenses` against the last-saved snapshot and records which
// months touched an add/edit/delete into the sync bookkeeping row. Doesn't
// care WHY something changed - just that it did - so it works no matter
// which of the handful of call sites in index.html mutated the array
// (push/splice/filter-reassign all fall out the same way here).
async function _markDirtyMonthsFromDiff(expenses) {
  const dirty = new Set();
  const seenIds = new Set();

  for (const exp of expenses) {
    seenIds.add(exp.id);
    const serialized = JSON.stringify(exp);
    const prev = _lastSavedExpenseSnapshot.get(exp.id);
    if (prev !== serialized) {
      dirty.add(yearMonthOf(exp.date));
      if (prev) {
        try { dirty.add(yearMonthOf(JSON.parse(prev).date)); } catch (e) { /* ignore malformed prior snapshot */ }
      }
    }
  }

  for (const [id, serialized] of _lastSavedExpenseSnapshot) {
    if (!seenIds.has(id)) {
      try { dirty.add(yearMonthOf(JSON.parse(serialized).date)); } catch (e) { /* ignore */ }
    }
  }

  _lastSavedExpenseSnapshot = new Map(expenses.map(e => [e.id, JSON.stringify(e)]));
  if (dirty.size === 0) return;

  const syncMeta = await getSyncMeta();
  const merged = new Set([...(syncMeta.dirtyMonths || []), ...dirty]);
  await saveSyncMeta({ dirtyMonths: Array.from(merged) });
}

// --- Sync bookkeeping row (small, lives in the 'meta' store alongside
// settings - it never needs chunking, same as categories/recurringItems) --

async function getSyncMeta() {
  const row = await IDB.get('meta', 'sync');
  return row || {
    key: 'sync',
    dirtyMonths: [],
    remoteChunkVersions: {},
    manifestFileId: null,
    settingsFileId: null,
    splitwiseFileId: null,
    lastBackupAt: null,
    lastRestoreAt: null
  };
}

async function saveSyncMeta(partial) {
  const current = await getSyncMeta();
  const updated = { ...current, ...partial };
  await IDB.put('meta', updated);
  return updated;
}

async function getDirtyMonths() {
  const meta = await getSyncMeta();
  return meta.dirtyMonths || [];
}

// Called by drive-sync.js after a successful backup: clears the months that
// just got uploaded and records what version (updatedAt) Drive now has for
// each, so a later restore can skip re-downloading anything unchanged.
async function clearDirtyMonths(monthsSynced, remoteVersions) {
  const meta = await getSyncMeta();
  const remaining = (meta.dirtyMonths || []).filter(m => !monthsSynced.includes(m));
  const updatedVersions = { ...(meta.remoteChunkVersions || {}), ...remoteVersions };
  await saveSyncMeta({ dirtyMonths: remaining, remoteChunkVersions: updatedVersions, lastBackupAt: new Date().toISOString() });
}

// --- Load / one-time migration off localStorage ---------------------------

// Existing installs have their entire history sitting in one localStorage
// blob. On first run under the new storage engine we pull it in, then hand
// it through the NORMAL (non-skipped) saveState() diff path below - which,
// diffed against an empty snapshot, naturally marks every single month as
// dirty. That's exactly what we want: the very next Drive backup ships the
// whole history once, and every backup after that is incremental again.
async function _migrateFromLocalStorageIfNeeded() {
  const legacyRaw = localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
  if (!legacyRaw) return false;

  try {
    const legacyData = JSON.parse(legacyRaw);
    mergeIntoAppData(legacyData);
    await saveState();
    console.info('Life Tracker: migrated existing localStorage data into IndexedDB.');
    return true;
  } catch (e) {
    console.error('Life Tracker: failed to migrate legacy localStorage data.', e);
    return false;
  }
}

async function loadAppData() {
  const [expenses, items, settingsRow] = await Promise.all([
    IDB.getAll('expenses'),
    IDB.getAll('items'),
    IDB.get('meta', 'settings')
  ]);

  const hasAnyIdbData = expenses.length > 0 || items.length > 0 || !!settingsRow;

  if (!hasAnyIdbData) {
    const migrated = await _migrateFromLocalStorageIfNeeded();
    if (migrated) return; // saveState() during migration already populated appData + the snapshot
  }

  appData = getDefaultAppData();
  if (expenses.length) appData.expenses = expenses;
  if (items.length) appData.items = items;
  if (settingsRow) mergeIntoAppData(settingsRow);

  _lastSavedExpenseSnapshot = new Map(appData.expenses.map(e => [e.id, JSON.stringify(e)]));
}

// Persists the current in-memory appData snapshot into IndexedDB. Same call
// pattern the rest of the app already uses everywhere (`saveState()` after
// every mutation) - only the "how" changed under the hood. Pass
// { skipDirtyTracking: true } only when the caller has ALREADY reconciled
// dirty/remote-version bookkeeping itself (this is exactly what
// restoreFromGoogleDrive() does - local now matches Drive by definition, so
// marking it dirty again would just cause a pointless re-upload).
async function saveState(opts) {
  const skipDirtyTracking = opts && opts.skipDirtyTracking;

  if (skipDirtyTracking) {
    _lastSavedExpenseSnapshot = new Map(appData.expenses.map(e => [e.id, JSON.stringify(e)]));
  } else {
    await _markDirtyMonthsFromDiff(appData.expenses);
  }

  try {
    await Promise.all([
      IDB.replaceAll('expenses', appData.expenses),
      IDB.replaceAll('items', appData.items),
      IDB.put('meta', { key: 'settings', recurringItems: appData.recurringItems, categories: appData.categories, budgets: appData.budgets, familyMembers: appData.familyMembers, tags: appData.tags, vehicles: appData.vehicles, fuelLogs: appData.fuelLogs })
    ]);
  } catch (e) {
    console.error('Life Tracker: failed to persist to IndexedDB.', e);
  }
}

// Called once on boot (see the DOMContentLoaded listener at the bottom of
// index.html). Loads/migrates data FIRST, then renders - so Home never
// flashes an empty state while IndexedDB is still opening.
//
// Resumes whatever tab the user was last on (see navigate() in index.html,
// which keeps LAST_TAB_STORAGE_KEY in sync on every switch) instead of
// always snapping back to Home. Mainly a backstop for the rare reload that
// slips past the overscroll-behavior CSS fix (e.g. the OS itself killing
// and relaunching the PWA) - validated against a known-tabs list so a
// stale/corrupted localStorage value can never navigate somewhere invalid.
const VALID_TABS = ['home', 'expenses', 'compare', 'items', 'settings', 'reports', 'fuel'];

async function initStorage() {
  await loadAppData();

  // Lock in any months that became "the past" since the last time the app
  // was opened, BEFORE anything renders - so Home/Compare/Settings all see
  // already-frozen history, never a race where they'd read a not-yet-frozen
  // month. See freezePastMonthBudgets in js/data-model.js.
  if (freezePastMonthBudgets()) await saveState();

  document.getElementById('headerDate').innerText = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const lastTab = localStorage.getItem(LAST_TAB_STORAGE_KEY);
  navigate(VALID_TABS.includes(lastTab) ? lastTab : 'home');

  // Splitwise is an overlay on top of whatever tab, not a tab itself, so it
  // gets its own resume step (see resumeSplitwiseIfWasOpen in splitwise.js)
  // rather than being folded into the navigate() call above.
  await resumeSplitwiseIfWasOpen();

  tryRestoreDriveSession();
}

// --- Year-scoped local deletion -------------------------------------------

// Low-level primitive: drops the given years' worth of expenses from
// in-memory appData and forgets Drive's version bookkeeping for those
// months - but does NOT persist or touch Google Drive itself. Callers
// decide when to save (some, like a restore, bundle this into a larger
// operation that saves once at the end anyway, so persisting here too
// would just be a wasted extra IndexedDB write).
async function purgeYearsFromMemory(years) {
  const yearSet = new Set(years);
  if (yearSet.size === 0) return;

  appData.expenses = appData.expenses.filter(e => !yearSet.has(yearMonthOf(e.date).slice(0, 4)));

  const syncMeta = await getSyncMeta();
  const remainingVersions = { ...(syncMeta.remoteChunkVersions || {}) };
  Object.keys(remainingVersions).forEach(month => {
    if (yearSet.has(month.slice(0, 4))) delete remainingVersions[month];
  });
  await saveSyncMeta({ remoteChunkVersions: remainingVersions });
}

// Drops a calendar year's expenses from appData + IndexedDB WITHOUT telling
// Google Drive anything about it - Drive keeps the full history exactly as
// it was, this is purely "stop keeping this year on THIS device". Restore
// Data (Settings) can always pull it back down later.
//
// Skips dirty-tracking on purpose (same trick restoreFromGoogleDrive uses):
// if we let this get marked dirty, the next backup would see the
// now-missing months as "changed" and push that emptiness up to Drive,
// silently deleting the very history we just chose to keep remotely.
//
// Hard-refuses the CURRENT year - Home and Expenses are built around always
// having this year's data on-device, so deleting it out from under them
// would break the main app, not just "free up space". The Settings UI
// already never offers this button for the current year, but a function
// this destructive shouldn't rely solely on its caller behaving - it
// enforces the rule itself too.
async function deleteYearDataLocally(year) {
  if (year === currentYearStr()) {
    throw new Error(`${year} is the active year - Home and Expenses need it, so it can't be deleted from local storage.`);
  }

  await purgeYearsFromMemory([year]);
  await saveState({ skipDirtyTracking: true });
}
