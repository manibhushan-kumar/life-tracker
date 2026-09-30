// --- World Clock (live time zones by country) -------------------------------
// Rendered as a normal in-app page (navigate('worldClock') -> #mainContainer),
// same "render function takes the container" pattern as every other page
// (Groups, Loans, Reports, ...) - see js/groups.js for the convention this
// follows. Lives in the side drawer next to Settings (see index.html) rather
// than the bottom nav or the Quick Add (+) sheet, since it's a utility/lookup
// screen, not a record type you're adding data to.
//
// Country/timezone data comes from js/timezone-data.js (TZ_COUNTRY_ZONES),
// loaded right before this file. Everything DATE- or OFFSET-specific (the
// actual local time, UTC offset, DST handling, abbreviation) is computed
// live here via Intl.DateTimeFormat against the real IANA zone id - nothing
// is ever hardcoded, so it stays correct across DST transitions and however
// far into the future the app is used, with zero maintenance.
//
// Storage: only the user's last-picked country CODE persists (localStorage,
// same lightweight mechanism as LAST_TAB_STORAGE_KEY) - none of the
// timezone/offset data itself is ever written to IndexedDB or appData, so it
// never touches Google Drive sync and adds nothing to the backup payload.

const WORLD_CLOCK_COUNTRY_STORAGE_KEY = 'lifeTracker_worldClockCountry';

let wcSelectedCountry = null; // ISO alpha-2 code, or null = "no country picked yet"
let wcCountryDropdownOpen = false;
let wcSearchQuery = '';
let wcTickIntervalId = null;
let _wcRegionDisplayNames = null;

// --- Small Intl helpers -----------------------------------------------------

// Full country name for an ISO alpha-2 code via the browser's own locale
// data - deliberately not a hand-maintained name table, so it can never
// drift out of sync with the codes used as keys in TZ_COUNTRY_ZONES.
function _wcCountryName(code) {
  try {
    if (!_wcRegionDisplayNames) _wcRegionDisplayNames = new Intl.DisplayNames(['en'], { type: 'region' });
    const name = _wcRegionDisplayNames.of(code);
    return name && name !== code ? name : code;
  } catch (e) {
    return code;
  }
}

// Regional-indicator flag emoji, built purely from the two ASCII letters of
// the ISO code (each letter maps to a Unicode "regional indicator symbol") -
// no flag image/data asset needed, and it degrades harmlessly (shows the
// bare letters) on the rare platform that doesn't render flag emoji.
function _wcFlagEmoji(code) {
  if (!code || code.length !== 2) return '';
  const points = code.toUpperCase().split('').map(c => 0x1F1E6 + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...points);
}

// Friendly city/region label from an IANA zone id - just its last path
// segment with underscores turned into spaces (e.g. "America/New_York" ->
// "New York", "Asia/Kolkata" -> "Kolkata"). Generic by construction, so it
// works for every zone id without a per-country display-name table.
function _wcZoneLabel(tz) {
  const last = tz.split('/').pop() || tz;
  return last.replace(/_/g, ' ');
}

// Current UTC offset (in minutes, +ve east of UTC) for a zone at a given
// instant. Computed by formatting `date` INTO that zone's wall-clock fields,
// re-interpreting those same fields as UTC, and diffing against the real
// instant - this is the standard DST-safe way to get an arbitrary zone's
// offset with nothing but Intl, and it automatically returns the right
// answer whether or not (and whenever) that zone happens to observe DST.
function _wcOffsetMinutes(tz, date) {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const parts = {};
    dtf.formatToParts(date).forEach(p => { if (p.type !== 'literal') parts[p.type] = p.value; });
    const asUtc = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second)
    );
    return Math.round((asUtc - date.getTime()) / 60000);
  } catch (e) {
    return null;
  }
}

function _wcFormatOffset(offsetMinutes) {
  if (offsetMinutes === null || Number.isNaN(offsetMinutes)) return '';
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `UTC${sign}${hh}:${mm}`;
}

// Zone-name abbreviation (EST, IST, GMT+5:30, ...) - "where available" per
// the spec, since not every zone has a short named abbreviation in ICU's
// data; falls back to an empty string rather than guessing one.
function _wcAbbreviation(tz, date) {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short', hour: '2-digit' });
    const part = dtf.formatToParts(date).find(p => p.type === 'timeZoneName');
    return part ? part.value : '';
  } catch (e) {
    return '';
  }
}

function _wcFormatTime(tz, date) {
  try {
    return date.toLocaleTimeString('en-US', { timeZone: tz, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch (e) {
    return '--:--:--';
  }
}

// Same "Thu, Jan 1" shape as updateHeaderGreeting() in data-model.js, plus
// the year (a world clock can easily show "tomorrow" relative to the device,
// so the year matters more here than it does for the app's own header).
function _wcFormatDate(tz, date) {
  try {
    return date.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return '';
  }
}

// ICU ships its own web of legacy zone-id aliases (e.g. "Asia/Kolkata" and
// "Asia/Calcutta" name the exact same zone), and different environments
// disagree on which alias they report as canonical - confirmed by testing
// this against Node's own ICU build, which normalizes "Asia/Kolkata" back to
// "Asia/Calcutta". A raw string comparison between the browser's reported
// zone and this file's ids would silently fail to detect India (and any
// other aliased zone) purely because of which name happened to be typed on
// which side - resolving BOTH sides through the same formatter's
// resolvedOptions() first means they always compare equal whenever they
// really are the same zone, regardless of which alias either side started as.
function _wcCanonicalZone(tz) {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz }).resolvedOptions().timeZone;
  } catch (e) {
    return tz;
  }
}

// Auto-detects a default country from the browser's own configured time
// zone (Intl.DateTimeFormat().resolvedOptions().timeZone) - no geolocation
// permission prompt, works fully offline, and only ever claims a match when
// that zone resolves to the same canonical zone as one we actually track for
// some country (see the curation note in timezone-data.js for why a handful
// of obscure sub-zones aren't listed). Returns null - "couldn't determine it
// reliably" - rather than guessing, exactly per the spec's own fallback wording.
function _wcDetectDefaultCountry() {
  try {
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browserTz) return null;
    const canonicalBrowserTz = _wcCanonicalZone(browserTz);
    const code = Object.keys(TZ_COUNTRY_ZONES).find(c =>
      TZ_COUNTRY_ZONES[c].some(z => _wcCanonicalZone(z) === canonicalBrowserTz)
    );
    return code || null;
  } catch (e) {
    return null;
  }
}

// --- Country list / search ---------------------------------------------------

// Built once and cached - TZ_COUNTRY_ZONES never changes at runtime, so
// there's no reason to rebuild+re-sort this on every keystroke.
let _wcCountryIndex = null;
function _wcGetCountryIndex() {
  if (_wcCountryIndex) return _wcCountryIndex;
  _wcCountryIndex = Object.keys(TZ_COUNTRY_ZONES).map(code => {
    const name = _wcCountryName(code);
    const cities = TZ_COUNTRY_ZONES[code].map(_wcZoneLabel).join(' ');
    return { code, name, searchText: `${name} ${code} ${cities}`.toLowerCase() };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return _wcCountryIndex;
}

function _wcFilteredCountries(query) {
  const q = (query || '').trim().toLowerCase();
  const index = _wcGetCountryIndex();
  if (!q) return index;
  return index.filter(c => c.searchText.includes(q));
}

// --- Page render --------------------------------------------------------------

function renderWorldClockPage(container) {
  if (wcSelectedCountry === null) {
    // localStorage.getItem distinguishes "key was never set" (returns null)
    // from "user explicitly cleared it" (wcClearSelection() stores '') -
    // `!stored` would be true for BOTH, which silently re-ran auto-detect
    // and re-selected the same country the instant someone tapped the X
    // button. Only the true "never visited this page before" case (`===
    // null`) should trigger auto-detect; an explicit clear must stick.
    const stored = localStorage.getItem(WORLD_CLOCK_COUNTRY_STORAGE_KEY);
    if (stored && TZ_COUNTRY_ZONES[stored]) {
      wcSelectedCountry = stored;
    } else if (stored === null) {
      wcSelectedCountry = _wcDetectDefaultCountry();
    }
  }

  container.innerHTML = _wcPageHtml();
  _wcStartTicker();
}

function _wcPageHtml() {
  const zones = wcSelectedCountry ? (TZ_COUNTRY_ZONES[wcSelectedCountry] || []) : [];
  const countryName = wcSelectedCountry ? _wcCountryName(wcSelectedCountry) : '';

  return `
    <h2 class="text-sm font-bold text-slate-800 mb-1">World Clock</h2>
    <p class="text-[11px] text-slate-400 mb-3">Pick any country to see the live local time in every time zone it observes - handles Daylight Saving Time automatically, no manual offsets involved.</p>

    <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-4">
      <label class="text-[10px] font-semibold text-slate-400 block mb-1">Country</label>
      <div class="relative">
        <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs pointer-events-none"></i>
        <input type="text" id="wcCountrySearch" autocomplete="off" placeholder="Search country..."
          value="${wcCountryDropdownOpen ? _escAttr(wcSearchQuery) : ''}"
          oninput="wcOnSearchInput(this.value)" onfocus="wcOpenDropdown()"
          class="w-full text-xs p-2.5 pl-8 pr-8 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
        ${wcSelectedCountry ? `
          <button type="button" onclick="wcClearSelection()" aria-label="Clear selected country" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-rose-500">
            <i class="fa-solid fa-xmark text-xs"></i>
          </button>
        ` : ''}
        <div id="wcCountryDropdown" class="${wcCountryDropdownOpen ? '' : 'hidden'} absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg hide-scrollbar">
          ${_wcDropdownRowsHtml()}
        </div>
      </div>
    </div>

    ${wcSelectedCountry ? `
      <div class="flex items-center gap-2 mb-3 px-1">
        <span class="text-xl leading-none">${_wcFlagEmoji(wcSelectedCountry)}</span>
        <span class="text-xs font-bold text-slate-800">${countryName}</span>
        <span class="text-[10px] text-slate-400">&bull; ${zones.length} time zone${zones.length === 1 ? '' : 's'}</span>
      </div>
      <div class="space-y-3" id="wcClockCards">
        ${zones.map(tz => _wcCardHtml(tz)).join('')}
      </div>
      ${zones.length === 0 ? `
        <div class="bg-white p-6 rounded-2xl border border-dashed border-slate-200 text-center space-y-2">
          <i class="fa-solid fa-triangle-exclamation text-2xl text-slate-300"></i>
          <p class="text-xs text-slate-400">No time zone data available for ${countryName}.</p>
        </div>
      ` : ''}
    ` : `
      <div class="bg-white p-6 rounded-2xl border border-dashed border-slate-200 text-center space-y-2">
        <i class="fa-solid fa-earth-americas text-2xl text-slate-300"></i>
        <p class="text-xs text-slate-400">Search and select a country above to see its live local time.</p>
      </div>
    `}
  `;
}

function _wcDropdownRowsHtml() {
  const matches = _wcFilteredCountries(wcSearchQuery).slice(0, 60); // keep the DOM light - a live filter narrows this fast anyway
  if (matches.length === 0) {
    return `<p class="text-[11px] text-slate-400 text-center py-3">No country matches "${_escHtml(wcSearchQuery)}".</p>`;
  }
  return matches.map(c => `
    <button type="button" onclick="wcSelectCountry('${c.code}')" class="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50 transition ${c.code === wcSelectedCountry ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700'}">
      <span class="text-base leading-none">${_wcFlagEmoji(c.code)}</span>
      <span class="flex-1 truncate">${c.name}</span>
      ${c.code === wcSelectedCountry ? '<i class="fa-solid fa-check text-[10px]"></i>' : ''}
    </button>
  `).join('');
}

function _wcCardHtml(tz) {
  const now = new Date();
  const abbr = _wcAbbreviation(tz, now);
  return `
    <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm" data-tz="${tz}">
      <div class="flex items-center justify-between mb-1 gap-2">
        <p class="text-xs font-bold text-slate-800 truncate">${_wcZoneLabel(tz)}</p>
        ${abbr ? `<span class="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 shrink-0" data-role="abbr">${abbr}</span>` : '<span class="hidden" data-role="abbr"></span>'}
      </div>
      <p class="text-[10px] text-slate-400 mb-2 font-mono truncate">${tz}</p>
      <p class="text-2xl font-bold text-slate-800 tabular-nums" data-role="time">${_wcFormatTime(tz, now)}</p>
      <div class="flex items-center justify-between mt-1 gap-2">
        <p class="text-[10px] text-slate-400" data-role="date">${_wcFormatDate(tz, now)}</p>
        <p class="text-[10px] font-semibold text-slate-500 shrink-0" data-role="offset">${_wcFormatOffset(_wcOffsetMinutes(tz, now))}</p>
      </div>
    </div>
  `;
}

// --- Interactions --------------------------------------------------------

function wcOpenDropdown() {
  wcCountryDropdownOpen = true;
  const dropdown = document.getElementById('wcCountryDropdown');
  if (dropdown) dropdown.classList.remove('hidden');
}

function wcOnSearchInput(value) {
  wcSearchQuery = value;
  wcCountryDropdownOpen = true;
  const dropdown = document.getElementById('wcCountryDropdown');
  if (dropdown) {
    dropdown.innerHTML = _wcDropdownRowsHtml();
    dropdown.classList.remove('hidden');
  }
}

function wcSelectCountry(code) {
  wcSelectedCountry = code;
  wcSearchQuery = '';
  wcCountryDropdownOpen = false;
  localStorage.setItem(WORLD_CLOCK_COUNTRY_STORAGE_KEY, code);
  renderWorldClockPage(document.getElementById('mainContainer'));
}

// Explicit "clear" is remembered as its own state (an empty string, not just
// absence) - otherwise the very next visit would auto-detect right back to
// the same country, which would make the X button look broken.
function wcClearSelection() {
  wcSelectedCountry = null;
  wcSearchQuery = '';
  wcCountryDropdownOpen = false;
  localStorage.setItem(WORLD_CLOCK_COUNTRY_STORAGE_KEY, '');
  renderWorldClockPage(document.getElementById('mainContainer'));
}

// Closes the dropdown on an outside tap/click without needing a full
// re-render - mirrors closeQuickAddModal's backdrop-click pattern elsewhere
// in the app, just scoped to this one page's own dropdown.
document.addEventListener('click', (e) => {
  if (!wcCountryDropdownOpen) return;
  const wrapper = document.getElementById('wcCountrySearch');
  const dropdown = document.getElementById('wcCountryDropdown');
  if (!wrapper || !dropdown) return;
  if (e.target === wrapper || wrapper.contains(e.target) || dropdown.contains(e.target)) return;
  wcCountryDropdownOpen = false;
  dropdown.classList.add('hidden');
});

// --- Live ticking ----------------------------------------------------------

// Updates each card's existing text nodes in place rather than re-rendering
// the page - re-running _wcPageHtml() every second would wipe out whatever
// the user is mid-typing into the country search box and reset dropdown
// scroll position, for a part of the screen (the clocks) that doesn't need
// a full re-render to just update some numbers.
function _wcTick() {
  const cardsContainer = document.getElementById('wcClockCards');
  if (!cardsContainer) { _wcStopTicker(); return; }
  const now = new Date();
  cardsContainer.querySelectorAll('[data-tz]').forEach(card => {
    const tz = card.getAttribute('data-tz');
    const timeEl = card.querySelector('[data-role="time"]');
    const dateEl = card.querySelector('[data-role="date"]');
    const offsetEl = card.querySelector('[data-role="offset"]');
    const abbrEl = card.querySelector('[data-role="abbr"]');
    if (timeEl) timeEl.textContent = _wcFormatTime(tz, now);
    if (dateEl) dateEl.textContent = _wcFormatDate(tz, now);
    if (offsetEl) offsetEl.textContent = _wcFormatOffset(_wcOffsetMinutes(tz, now));
    if (abbrEl) {
      const abbr = _wcAbbreviation(tz, now);
      abbrEl.textContent = abbr;
      abbrEl.classList.toggle('hidden', !abbr);
    }
  });
}

function _wcStartTicker() {
  _wcStopTicker();
  wcTickIntervalId = setInterval(_wcTick, 1000);
}

// Called both when this page unmounts (see navigate() in index.html, which
// stops it before rendering whatever tab comes next) and defensively from
// inside _wcTick() itself if the cards container ever disappears out from
// under it - a stray interval left running on some OTHER tab would just be
// silently wasted battery/CPU for no visible benefit.
function _wcStopTicker() {
  if (wcTickIntervalId !== null) {
    clearInterval(wcTickIntervalId);
    wcTickIntervalId = null;
  }
}

// --- Tiny escaping helpers (no existing shared one in this codebase) -------
function _wcEscape(str, forAttr) {
  const map = forAttr
    ? { '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }
    : { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
  return String(str).replace(/[&"<>]/g, ch => map[ch] || ch);
}
function _escAttr(str) { return _wcEscape(str, true); }
function _escHtml(str) { return _wcEscape(str, false); }
