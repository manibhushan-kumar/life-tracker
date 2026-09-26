// --- Core Data Model -----------------------------------------------------
// Shape of appData, defaults, and pure helpers for working with it. No
// storage-engine knowledge lives here (see idb.js / storage.js) and no
// Google Drive knowledge either (see drive-sync.js) - just "what does the
// data look like and how do we merge/migrate it".

// Formats a Date object as YYYY-MM-DD using its LOCAL calendar fields.
// Deliberately NOT using Date.prototype.toISOString() here - that's UTC-based,
// and for anyone ahead of UTC (e.g. India, UTC+5:30) it still reports
// "yesterday" during early local-morning hours, while for anyone behind UTC
// it reports "tomorrow" during the evening. That silently breaks any
// date-string comparison in this app (e.g. "was this price effective today?").
function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayStr() {
  return formatDateLocal(new Date());
}

// "YYYY-MM" bucket for a date string. This is THE unit of chunking for
// Google Drive backups (see drive-sync.js) and for local dirty-tracking
// (see storage.js) - one place defining it means both always agree.
function yearMonthOf(dateStr) {
  return (dateStr || '').slice(0, 7) || 'unknown';
}

// Returns a fresh copy of the default app data shape. Used on first run
// and as the base to rebuild onto when restoring from Google Drive.
function getDefaultAppData() {
  return {
    expenses: [],
    items: [],
    // Generic "tap a day to log it" items - milk, newspaper, whatever recurs daily.
    // Fully user-configurable in Settings, and rides along in the same backup blob.
    // priceHistory is the source of truth for what a day COSTS; `price` is just a
    // cached "today's price" convenience field kept in sync alongside it.
    recurringItems: [
      { id: 'milk', name: 'Milk', category: 'Milk', subCategory: null, price: 50, priceHistory: [{ from: '1970-01-01', price: 50 }] }
    ],
    categories: {
      'Food': ['Restaurant', 'Delivery', 'Snacks', 'Coffee'],
      'Bills': ['Electricity', 'Water', 'Internet', 'Mobile', 'Rent', 'EMI'],
      'Groceries': ['Supermarket', 'Vegetables', 'Meat'],
      'Transport': ['Fuel', 'Taxi/Uber', 'Public Transit', 'Flights'],
      'Shopping': ['Clothes', 'Electronics', 'Gifts', 'Amazon'],
      'Entertainment': ['Netflix', 'Spotify', 'Movies', 'Gaming', 'Events'],
      'Health': ['Pharmacy', 'Doctor', 'Gym', 'Insurance'],
      'Travel': ['Hotels', 'Tickets', 'Tours'],
      'Milk': ['Cow Milk', 'Buffalo Milk', 'Toned Milk']
    }
  };
}

// Given a recurring item, returns whatever price was actually in effect on
// `dateStr` (defaults to today). This is the single source of truth for
// "what does a day of this item cost" - a price change only affects days
// on/after its effective date; earlier days (and already-logged expenses,
// which store their own snapshot amount anyway) are never touched.
function getEffectivePrice(item, dateStr) {
  const targetDate = dateStr || getTodayStr();
  const history = Array.isArray(item.priceHistory) && item.priceHistory.length
    ? item.priceHistory
    : [{ from: '1970-01-01', price: Number(item.price) || 0 }];

  const sorted = history.slice().sort((a, b) => a.from.localeCompare(b.from));
  const applicable = sorted.filter(h => h.from <= targetDate);
  // If the target date predates every recorded change (e.g. toggling a day
  // before the item existed), fall back to the earliest known price.
  return applicable.length > 0 ? applicable[applicable.length - 1].price : sorted[0].price;
}

// Merges a parsed data blob (legacy localStorage dump, a Drive settings.json,
// a legacy single-file Drive backup, or a Drive expense chunk) into the
// current appData, applying backwards-compatibility upgrades along the way.
// Every field is checked individually and merged only if present, so this
// is safe to call with PARTIAL blobs (e.g. a settings-only object that has
// no `expenses` key at all) - shared by storage.js and drive-sync.js so
// there's one place to fix migrations, not several.
function mergeIntoAppData(parsedData) {
  if (!parsedData) return;

  if (parsedData.expenses) appData.expenses = parsedData.expenses;
  if (parsedData.items) appData.items = parsedData.items;

  // Recurring Daily Items (generic, user-configurable replacement for the
  // old hardcoded single "milkPrice" setting)
  if (Array.isArray(parsedData.recurringItems)) {
    appData.recurringItems = parsedData.recurringItems;
  } else if (typeof parsedData.milkPrice === 'number') {
    // Legacy upgrade path for users who saved data before this feature existed.
    appData.recurringItems = [{ id: 'milk', name: 'Milk', category: 'Milk', subCategory: null, price: parsedData.milkPrice }];
  }

  // Normalize every recurring item so it always has a proper priceHistory,
  // even if it came from an older backup that only had a flat `price`.
  appData.recurringItems = appData.recurringItems.map(item => {
    const priceHistory = Array.isArray(item.priceHistory) && item.priceHistory.length
      ? item.priceHistory.slice().sort((a, b) => a.from.localeCompare(b.from))
      : [{ from: '1970-01-01', price: Number(item.price) || 0 }];
    return { ...item, priceHistory, price: getEffectivePrice({ priceHistory }) };
  });

  // Backwards Compatibility Migration for Categories
  if (parsedData.categories) {
    if (Array.isArray(parsedData.categories)) {
      parsedData.categories.forEach(cat => {
        if (!appData.categories[cat]) {
          appData.categories[cat] = [];
        }
      });
    } else {
      // Merge saved categories on top of defaults so newly introduced
      // built-in categories (e.g. Milk) still show up for existing users.
      appData.categories = { ...appData.categories, ...parsedData.categories };
    }
  }
}
