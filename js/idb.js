// --- Generic IndexedDB helper -----------------------------------------
// A tiny promise-based wrapper around the native IndexedDB API. Deliberately
// dumb and generic - it has zero knowledge of "expenses" or "categories" or
// anything Life Tracker specific. That domain knowledge lives in storage.js.
// Splitting it this way keeps this file reusable/testable in isolation and
// keeps storage.js focused on "what do we store" rather than "how does
// IndexedDB work" (single responsibility, nothing fancier than that).
const IDB = (() => {
  const DB_NAME = 'life_tracker_db';
  const DB_VERSION = 4;
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('expenses')) {
          const store = db.createObjectStore('expenses', { keyPath: 'id' });
          // Handy for future date-range queries; cheap to maintain even
          // though today's Drive-chunking logic derives yearMonth on the fly.
          store.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('items')) {
          db.createObjectStore('items', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          // Single small key/value table for everything that ISN'T a
          // growing-forever list: categories, recurring items, and the
          // Google Drive sync bookkeeping (dirty months, known remote
          // chunk versions, cached file ids, etc). Rows are tiny and few,
          // so this store never needs chunking.
          db.createObjectStore('meta', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('splitGroups')) {
          // Splitwise-style group-expense-splitting feature (js/splitwise.js).
          // Its own store (not part of appData/saveState) since it has a
          // completely different shape (nested members/expenses per group)
          // and its own tiny 5-group cap - but it DOES sync to Google Drive,
          // via its own dedicated splitwise.json file (see drive-sync.js),
          // wholesale on every backup/restore just like settings.json.
          db.createObjectStore('splitGroups', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('contactGroups')) {
          // General-purpose reusable contact groups (js/groups.js) -
          // deliberately a SEPARATE store/concept from splitGroups above.
          // A Splitwise group has expenses/balances of its own; a Group here
          // is just a name + a list of people, meant to be pulled from by
          // Splitwise (and any future feature) rather than being tied to
          // one. Syncs to Drive wholesale via its own groups.json file, same
          // pattern as splitGroups/splitwise.json.
          db.createObjectStore('contactGroups', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('reminders')) {
          // Reminders (js/reminders.js) - timed alerts with optional repeat.
          // Its own store so it mirrors the expenses/items pattern (each
          // reminder is its own keyed record, easy to add/remove).
          db.createObjectStore('reminders', { keyPath: 'id' });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function wrap(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return {
    async getAll(storeName) {
      const db = await openDB();
      return wrap(db.transaction(storeName, 'readonly').objectStore(storeName).getAll());
    },

    async get(storeName, key) {
      const db = await openDB();
      return wrap(db.transaction(storeName, 'readonly').objectStore(storeName).get(key));
    },

    async put(storeName, value) {
      const db = await openDB();
      return wrap(db.transaction(storeName, 'readwrite').objectStore(storeName).put(value));
    },

    // Wipes the store and writes `values` in one transaction. Used for the
    // "appData is the source of truth in memory, IndexedDB just mirrors it"
    // pattern - see saveState() in storage.js.
    async replaceAll(storeName, values) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.clear();
        values.forEach(v => store.put(v));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },

    async delete(storeName, key) {
      const db = await openDB();
      return wrap(db.transaction(storeName, 'readwrite').objectStore(storeName).delete(key));
    }
  };
})();
