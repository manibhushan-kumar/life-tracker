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

// Today's calendar year as a string ("2026") - Home/Expenses treat this as
// the ONLY year they render; older years are Compare/restore territory.
function currentYearStr() {
  return String(new Date().getFullYear());
}

// Where the currently-viewed bottom-nav tab gets persisted (see navigate()
// in index.html and initStorage() below in storage.js). Living here - the
// first script loaded - means both of those agree on the key name without
// index.html and storage.js needing to know about each other's constants.
const LAST_TAB_STORAGE_KEY = 'lifeTracker_lastTab';

// Breadcrumb suffix shown after "Life Tracker" in the main header for each
// bottom-nav tab (see navigate() in index.html) plus Splitwise (see
// openSplitwise/closeSplitwise in splitwise.js) - one shared lookup so
// every "page" in the app, current or future, announces itself the SAME
// way instead of each view inventing its own title/close-button pattern.
// `null` for home means no suffix at all - just "Life Tracker" alone.
const TAB_DISPLAY_NAMES = {
  home: null,
  expenses: 'Expenses',
  items: 'Due Items',
  compare: 'Compare',
  settings: 'Settings',
  splitwise: 'Splitwise',
  reports: 'Reports',
  fuel: 'Fuel Log'
};

// Sets the " / PageName" breadcrumb suffix after the clickable "Life
// Tracker" root in the main header (see index.html). Passing a falsy value
// (e.g. TAB_DISPLAY_NAMES.home, which is null) clears it back down to just
// "Life Tracker" - this is what makes tapping that root feel like a real
// breadcrumb "go home" action, and it's also why full-page views like
// Splitwise no longer need their own separate close (X) button: the root
// is always sitting right there doing that job for every page at once.
function setAppHeaderCrumb(pageName) {
  const el = document.getElementById('appHeaderCrumb');
  if (el) el.textContent = pageName ? ` / ${pageName}` : '';
}

// All expenses whose date falls in the given calendar year ("YYYY").
// Single source of truth for year-filtering so Home, Expenses, and Compare
// don't each grow their own slightly-different filter logic.
function expensesInYear(year) {
  return appData.expenses.filter(e => yearMonthOf(e.date).slice(0, 4) === year);
}

// Returns a fresh copy of the default app data shape. Used on first run
// and as the base to rebuild onto when restoring from Google Drive.
function getDefaultAppData() {
  return {
    expenses: [],
    items: [],
    // Generic "tap a day to log it" items - milk, newspaper, whatever recurs
    // daily. Fully user-configurable in Settings (starts empty - no seeded
    // example item, since nothing here is meant to be a hardcoded default
    // anyone has to work around) and rides along in the same backup blob.
    // priceHistory is the source of truth for what a day COSTS; `price` is just a
    // cached "today's price" convenience field kept in sync alongside it.
    recurringItems: [],
    categories: {
      'Food': ['Restaurant', 'Delivery', 'Snacks', 'Coffee'],
      'Bills': ['Electricity', 'Water', 'Internet', 'Mobile', 'Rent', 'EMI'],
      'Groceries': ['Supermarket', 'Vegetables', 'Meat'],
      'Transport': ['Fuel', 'Taxi/Uber', 'Public Transit', 'Flights'],
      'Shopping': ['Clothes', 'Electronics', 'Gifts', 'Amazon'],
      'Entertainment': ['Netflix', 'Spotify', 'Movies', 'Gaming', 'Events'],
      'Health': ['Pharmacy', 'Doctor', 'Gym', 'Insurance'],
      'Travel': ['Hotels', 'Tickets', 'Tours']
    },
    // Monthly budget tracking. `global` is the fallback used by any month
    // that doesn't have its own entry in `monthly` - see getBudgetForMonth().
    // A value of 0 means "not configured", not "a real ₹0 budget" - callers
    // treat that as "don't render a budget bar yet". `frozenThroughMonth` is
    // freezePastMonthBudgets()'s bookmark - see there for why it exists.
    budgets: { global: 0, monthly: {}, frozenThroughMonth: null },
    // Optional "who actually paid" tagging for expenses/due-item payments -
    // see getFamilyMemberName() below. Purely a label list ({id, name}), no
    // relation to Splitwise's per-group members (js/splitwise.js) - that's a
    // separate, unrelated concept (splitting a shared bill vs just noting
    // who paid for something out of one household's own money).
    familyMembers: [],
    // Single-select "project/trip" labels ({id, name}) an expense can be
    // tagged with (see Reports view in index.html, which is the whole
    // reason these exist - "show me every expense under Trip-Goa"). A
    // deliberately SEPARATE concept from categories: categories answer
    // "what kind of spend is this" (Food, Bills, ...) and stay useful
    // forever, while tags answer "what one-off thing was this spend part
    // of" (Trip-Goa, House-Renovation, ...) and are meant to come and go.
    // Exactly one tag per expense, by design - same reasoning as paidBy:
    // an expense either belongs to a given trip/project or it doesn't; if
    // it genuinely spans two, that's arguably two expenses, not one
    // multi-tagged one. Full OVERWRITE on restore, same as familyMembers.
    tags: [],
    // Vehicles ({id, number}) a fuel-log entry can be filed under - same
    // plain-label-list shape/spirit as familyMembers/tags. Full OVERWRITE
    // on restore too.
    vehicles: [],
    // Fuel Tracker entries - see Fuel Log view in index.html. Each is a
    // SELF-CONTAINED mileage record (deliberately not a chain of "next
    // entry continues where the last left off" - simpler to reason about
    // and edit independently): startKm is the odometer reading AT this
    // fill-up, endKm is the odometer reading at the NEXT fill-up (set
    // later via "Update End KM", starts null), and the fuel added THIS
    // fill-up (`liters`, derived from amount/pricePerLiter) is what
    // powered the distance driven between startKm and endKm - classic
    // full-to-full mileage accounting. See computeFuelKmRun/
    // computeFuelMileage below for the actual math.
    //   { id, vehicleId, fuelType ('Petrol'|'Diesel'|'Gas'), date,
    //     startKm, endKm (null until set), pricePerLiter, amount,
    //     liters (derived, cached), paidBy, expenseId }
    // `expenseId` links to the real Expense auto-created when this entry
    // was added (category Transport > Fuel) - see saveFuelLog(). That
    // linked expense is a SNAPSHOT, same principle as everywhere else in
    // this app (price-history changes, category/tag/member deletes never
    // rewrite past expenses): editing or deleting a fuel entry later never
    // touches the expense it already created. Full OVERWRITE on restore.
    fuelLogs: []
  };
}

// The date a recurring item became loggable. Deliberately its own field
// (not just "priceHistory[0].from") so scheduling an earlier price change
// later can never silently drag the item's start date backwards - see
// savePriceChange in index.html, which enforces `from >= startDate`.
// Days before this date are never toggleable on the calendar; days on/after
// it are fair game, priced via getEffectivePrice.
function getItemStartDate(item) {
  return item.startDate || (Array.isArray(item.priceHistory) && item.priceHistory[0] && item.priceHistory[0].from) || '1970-01-01';
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

  // Family members: full OVERWRITE on restore (not merged on top of
  // defaults like categories are) - the whole point of restoring is
  // "Drive's list wins", including someone having been deleted there. Same
  // wholesale-replace treatment `items` above already gets.
  if (Array.isArray(parsedData.familyMembers)) {
    appData.familyMembers = parsedData.familyMembers;
  }

  // Tags: same wholesale-overwrite treatment as familyMembers, for the
  // same reason - restoring means "Drive's list wins", including any tag
  // that was deleted there since the last backup.
  if (Array.isArray(parsedData.tags)) {
    appData.tags = parsedData.tags;
  }

  // Vehicles and fuel log entries: same wholesale-overwrite treatment as
  // tags/familyMembers - restoring means "Drive's list wins" for both.
  if (Array.isArray(parsedData.vehicles)) {
    appData.vehicles = parsedData.vehicles;
  }
  if (Array.isArray(parsedData.fuelLogs)) {
    appData.fuelLogs = parsedData.fuelLogs;
  }

  // Recurring Daily Items - fully generic and user-configurable, so a
  // straight overwrite when present is all that's needed here.
  if (Array.isArray(parsedData.recurringItems)) {
    appData.recurringItems = parsedData.recurringItems;
  }

  // Normalize every recurring item so it always has a proper priceHistory,
  // even if it came from an older backup that only had a flat `price`.
  appData.recurringItems = appData.recurringItems.map(item => {
    const priceHistory = Array.isArray(item.priceHistory) && item.priceHistory.length
      ? item.priceHistory.slice().sort((a, b) => a.from.localeCompare(b.from))
      : [{ from: '1970-01-01', price: Number(item.price) || 0 }];
    // Backfill startDate for items saved before this field existed, so
    // existing users' historical calendar toggles don't suddenly get locked out.
    const startDate = item.startDate || priceHistory[0].from;
    return { ...item, priceHistory, startDate, price: getEffectivePrice({ priceHistory }) };
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
      // Merge saved categories on top of defaults so any newly introduced
      // built-in default category still shows up for existing users.
      appData.categories = { ...appData.categories, ...parsedData.categories };
    }
  }

  // Budgets: only overwrite if the incoming blob actually has one (older
  // Drive settings.json files won't) - otherwise the default/current
  // in-memory budgets (already seeded by getDefaultAppData) stand as-is.
  if (parsedData.budgets) {
    appData.budgets = {
      global: Number(parsedData.budgets.global) || 0,
      monthly: { ...(parsedData.budgets.monthly || {}) },
      frozenThroughMonth: parsedData.budgets.frozenThroughMonth || null
    };
  }
}

// Effective budget (in rupees) for a given "YYYY-MM" month: an explicit
// per-month override wins, otherwise it falls back to the global monthly
// default. Returns 0 if neither is configured - the single source of truth
// for "is there even a budget to compare against here", shared by Home's
// progress bar and the Settings budget editor.
function getBudgetForMonth(yearMonth) {
  const budgets = appData.budgets || { global: 0, monthly: {} };
  const override = budgets.monthly && budgets.monthly[yearMonth];
  return (typeof override === 'number' && override > 0) ? override : (Number(budgets.global) || 0);
}

// Color-coding thresholds for "how worried should this bar look" given a
// %-of-budget-spent figure. One shared lookup so the thresholds only ever
// need tuning in a single place:
//   < 50%  emerald  - plenty of room left
//   50-74% amber    - past the halfway mark, worth a glance
//   75-89% orange   - getting close, start being deliberate
//   90%+   rose     - right at/over the edge (100%+ still rose, just labeled differently)
function getBudgetStatus(percentSpent) {
  if (percentSpent >= 100) return { bar: 'bg-rose-600', track: 'bg-rose-100', text: 'text-rose-600', label: 'Over budget' };
  if (percentSpent >= 90) return { bar: 'bg-rose-500', track: 'bg-rose-100', text: 'text-rose-600', label: 'Almost there' };
  if (percentSpent >= 75) return { bar: 'bg-orange-500', track: 'bg-orange-100', text: 'text-orange-600', label: 'Getting close' };
  if (percentSpent >= 50) return { bar: 'bg-amber-500', track: 'bg-amber-100', text: 'text-amber-600', label: 'On watch' };
  return { bar: 'bg-emerald-500', track: 'bg-emerald-100', text: 'text-emerald-600', label: 'On track' };
}

// "YYYY-MM" + 1 month, rolling over into the next year as needed. Generic
// enough to belong here rather than inside freezePastMonthBudgets() alone -
// it's just date math, nothing budget-specific about it.
function nextYearMonth(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  const rolledOver = m === 12;
  return `${rolledOver ? y + 1 : y}-${String(rolledOver ? 1 : m + 1).padStart(2, '0')}`;
}

// A month is only editable in Settings' budget override picker if it's the
// current ("running") month or a future one - see saveMonthlyBudgetOverride/
// deleteMonthlyBudgetOverride in index.html, which both enforce this too
// (not just the UI's min= attribute, which a determined user could bypass).
function isBudgetMonthEditable(yearMonth) {
  return yearMonth >= getTodayStr().slice(0, 7);
}

// Locks in the ACTUAL effective budget for every month that has now become
// "the past" since the last time this ran, by writing it into
// budgets.monthly as an explicit override. Without this, a later edit to
// the global default would silently rewrite the budget for months the user
// already lived through - which defeats the point of ever looking back at
// "did I stay on budget in March". Called once on boot (see initStorage in
// storage.js) - cheap and idempotent, so booting twice in the same month
// (the common case) does nothing after the first call.
//
// Deliberately does NOT retroactively freeze anything on the very first run
// (frozenThroughMonth starts null) - we have no idea what budget was
// "actually in effect" for months before this feature existed, so inventing
// overrides for them from today's global value would just be guessing.
// Freezing only kicks in for months that pass FROM HERE ON.
function freezePastMonthBudgets() {
  if (!appData.budgets) appData.budgets = { global: 0, monthly: {}, frozenThroughMonth: null };
  const budgets = appData.budgets;
  const currentMonth = getTodayStr().slice(0, 7);

  if (!budgets.frozenThroughMonth) {
    budgets.frozenThroughMonth = currentMonth;
    return true; // bookmark itself is a real mutation - must be persisted so it isn't lost if nothing else triggers a save this session
  }
  if (budgets.frozenThroughMonth >= currentMonth) return false;

  let changed = false;
  for (let month = budgets.frozenThroughMonth; month < currentMonth; month = nextYearMonth(month)) {
    if (!(month in budgets.monthly)) {
      const effective = getBudgetForMonth(month);
      if (effective > 0) {
        budgets.monthly[month] = effective;
        changed = true;
      }
    }
  }
  budgets.frozenThroughMonth = currentMonth;
  return true;
}

// Display name for a family-member id, with a graceful fallback for ids
// that no longer resolve (the member was deleted after being tagged on an
// expense or due-item payment) - keeps Expenses/Compare from ever choking
// on a dangling reference. Returns null for a falsy id (i.e. "nobody was
// tagged") so callers can cleanly decide whether to show a "Paid by" bit
// at all.
function getFamilyMemberName(memberId) {
  if (!memberId) return null;
  const member = (appData.familyMembers || []).find(m => m.id === memberId);
  return member ? member.name : 'Former member';
}

// Display name for a tag id, with the same graceful "Former tag" fallback
// getFamilyMemberName above gives paidBy - keeps the Reports view and any
// expense row from choking on a dangling reference after the tag itself
// was deleted in Settings. Returns null for a falsy id ("no tag set").
function getTagName(tagId) {
  if (!tagId) return null;
  const tag = (appData.tags || []).find(t => t.id === tagId);
  return tag ? tag.name : 'Former tag';
}

// Display number for a vehicle id, same "Former X" fallback pattern as
// getFamilyMemberName/getTagName above - keeps the Fuel Log view and any
// fuel-entry row from choking on a dangling reference after the vehicle
// itself was deleted in Settings. Returns null for a falsy id.
function getVehicleNumber(vehicleId) {
  if (!vehicleId) return null;
  const vehicle = (appData.vehicles || []).find(v => v.id === vehicleId);
  return vehicle ? vehicle.number : 'Former vehicle';
}

// --- Fuel Tracker math -----------------------------------------------------
// Pure helpers so the Fuel Log view (index.html) and any future consumer
// (e.g. a Compare-style mileage-over-time chart) share the exact same math,
// never two slightly-different copies. See the `fuelLogs` shape comment in
// getDefaultAppData above for what each field means and why endKm/liters
// are computed the way they are.

// Liters filled, derived from what was actually entered at the pump
// (amount paid + price/liter) rather than typed in directly - matches the
// explicit ask that liters should be a calculated, not a manual, field.
// Rounded to 2 decimals purely for display sanity; guards divide-by-zero
// (a 0 or missing price just means "can't derive liters yet").
function computeFuelLiters(amount, pricePerLiter) {
  const amt = Number(amount) || 0;
  const price = Number(pricePerLiter) || 0;
  if (price <= 0) return 0;
  return Math.round((amt / price) * 100) / 100;
}

// Distance covered on the fuel put in at THIS entry - null (not 0) until
// endKm is actually recorded, so callers can tell "not driven yet" apart
// from "drove zero km" (the latter would be a data-entry mistake worth
// flagging, not silently rendering as a valid mileage of 0).
function computeFuelKmRun(entry) {
  if (entry.endKm === null || entry.endKm === undefined) return null;
  const run = Number(entry.endKm) - Number(entry.startKm);
  return run >= 0 ? run : null; // a negative run means bad data (endKm < startKm) - treat as "not computable" rather than showing a nonsense negative mileage
}

// Classic full-to-full mileage: km covered since this fill-up, per liter
// that THIS fill-up put in the tank. Null whenever either half of the
// fraction isn't known/valid yet (no endKm recorded, or liters is 0/absent
// because price wasn't entered) - same "null means not computable" contract
// as computeFuelKmRun above.
function computeFuelMileage(entry) {
  const kmRun = computeFuelKmRun(entry);
  const liters = Number(entry.liters) || 0;
  if (kmRun === null || liters <= 0) return null;
  return Math.round((kmRun / liters) * 100) / 100;
}
