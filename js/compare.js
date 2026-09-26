// --- Year Comparison View --------------------------------------------
// Lets you look at two years side-by-side (month-by-month totals and a
// category breakdown) so restoring old history is actually USEFUL - the
// whole point of pulling in e.g. 2023 alongside 2024 is to compare them,
// not just have them silently sitting in storage.
//
// Deliberately no charting library here - a handful of CSS width bars gets
// the same "at a glance" comparison across without adding a CDN dependency
// (and another thing for sw.js to worry about caching) for something this
// simple. YAGNI until proven otherwise.

let _compareYearA = null;
let _compareYearB = null;

const COMPARE_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Every year that has at least one expense, plus the current year (even if
// empty) so a brand-new install still has something sensible to show.
function getAvailableCompareYears() {
  const years = new Set(appData.expenses.map(e => yearMonthOf(e.date).slice(0, 4)));
  years.add(String(new Date().getFullYear()));
  return Array.from(years).filter(Boolean).sort().reverse();
}

function monthlyTotalsForYear(year) {
  const totals = new Array(12).fill(0);
  appData.expenses.forEach(e => {
    if (yearMonthOf(e.date).slice(0, 4) === year) {
      const monthIdx = Number(e.date.slice(5, 7)) - 1;
      if (monthIdx >= 0 && monthIdx < 12) totals[monthIdx] += Number(e.amount) || 0;
    }
  });
  return totals;
}

function categoryTotalsForYear(year) {
  const totals = {};
  appData.expenses.forEach(e => {
    if (yearMonthOf(e.date).slice(0, 4) !== year) return;
    const cat = e.category || 'Uncategorized';
    totals[cat] = (totals[cat] || 0) + (Number(e.amount) || 0);
  });
  return totals;
}

function onCompareYearChange(which, value) {
  if (which === 'A') _compareYearA = value;
  else _compareYearB = value;
  navigate('compare');
}

function renderCompare(container) {
  const years = getAvailableCompareYears();

  // Default to the two most recent years so there's an immediate, sensible
  // comparison on first visit instead of an empty picker.
  if (!_compareYearA || !years.includes(_compareYearA)) _compareYearA = years[0];
  if (!_compareYearB || !years.includes(_compareYearB)) _compareYearB = years[1] || years[0];

  const monthsA = monthlyTotalsForYear(_compareYearA);
  const monthsB = monthlyTotalsForYear(_compareYearB);
  const totalA = monthsA.reduce((sum, v) => sum + v, 0);
  const totalB = monthsB.reduce((sum, v) => sum + v, 0);
  const delta = totalA - totalB;
  const deltaPct = totalB !== 0 ? (delta / totalB) * 100 : (totalA !== 0 ? 100 : 0);
  const maxMonthVal = Math.max(1, ...monthsA, ...monthsB);

  const catA = categoryTotalsForYear(_compareYearA);
  const catB = categoryTotalsForYear(_compareYearB);
  const allCats = Array.from(new Set([...Object.keys(catA), ...Object.keys(catB)]))
    .sort((c1, c2) => ((catA[c2] || 0) + (catB[c2] || 0)) - ((catA[c1] || 0) + (catB[c1] || 0)));

  const yearOptions = (selected) => years.map(y => `<option value="${y}" ${y === selected ? 'selected' : ''}>${y}</option>`).join('');

  container.innerHTML = `
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-bold text-slate-800">Compare Years</h2>
    </div>

    <div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm grid grid-cols-2 gap-3">
      <div>
        <label class="text-[10px] font-semibold text-slate-400 block mb-1"><span class="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1"></span>Year A</label>
        <select onchange="onCompareYearChange('A', this.value)" class="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-500">
          ${yearOptions(_compareYearA)}
        </select>
      </div>
      <div>
        <label class="text-[10px] font-semibold text-slate-400 block mb-1"><span class="inline-block w-2 h-2 rounded-full bg-violet-500 mr-1"></span>Year B</label>
        <select onchange="onCompareYearChange('B', this.value)" class="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-500">
          ${yearOptions(_compareYearB)}
        </select>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-2">
      <div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm text-center">
        <p class="text-[9px] font-semibold text-slate-400 uppercase">${_compareYearA} Total</p>
        <p class="text-base font-bold text-blue-700 mt-0.5">₹${totalA.toLocaleString()}</p>
      </div>
      <div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm text-center">
        <p class="text-[9px] font-semibold text-slate-400 uppercase">${_compareYearB} Total</p>
        <p class="text-base font-bold text-violet-700 mt-0.5">₹${totalB.toLocaleString()}</p>
      </div>
      <div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm text-center">
        <p class="text-[9px] font-semibold text-slate-400 uppercase">Change</p>
        <p class="text-base font-bold mt-0.5 ${delta >= 0 ? 'text-rose-600' : 'text-emerald-600'}">${delta >= 0 ? '+' : ''}${deltaPct.toFixed(0)}%</p>
      </div>
    </div>

    <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
      <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Month by Month</h3>
      <div class="space-y-2">
        ${COMPARE_MONTH_NAMES.map((m, i) => `
          <div class="flex items-center gap-2 text-[10px]">
            <span class="w-7 text-slate-400 font-semibold shrink-0">${m}</span>
            <div class="flex-1 space-y-1">
              <div class="h-2 rounded-full bg-blue-50 overflow-hidden"><div class="h-full bg-blue-500 rounded-full" style="width:${(monthsA[i] / maxMonthVal * 100).toFixed(1)}%"></div></div>
              <div class="h-2 rounded-full bg-violet-50 overflow-hidden"><div class="h-full bg-violet-500 rounded-full" style="width:${(monthsB[i] / maxMonthVal * 100).toFixed(1)}%"></div></div>
            </div>
            <div class="w-16 text-right shrink-0">
              <p class="text-slate-700 font-semibold">₹${monthsA[i].toLocaleString()}</p>
              <p class="text-slate-400">₹${monthsB[i].toLocaleString()}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
      <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">By Category</h3>
      <div class="divide-y divide-slate-50">
        ${allCats.length === 0 ? '<p class="text-xs text-slate-400 text-center py-4">No expenses recorded for either year.</p>' : allCats.map(cat => {
          const a = catA[cat] || 0;
          const b = catB[cat] || 0;
          const catDelta = a - b;
          return `
            <div class="py-2 flex items-center justify-between gap-2">
              <span class="text-xs font-semibold text-slate-700 truncate flex-1 min-w-0">${cat}</span>
              <div class="flex items-center gap-3 text-[11px] shrink-0">
                <span class="text-blue-700 font-bold w-16 text-right">₹${a.toLocaleString()}</span>
                <span class="text-violet-600 font-bold w-16 text-right">₹${b.toLocaleString()}</span>
                <span class="w-16 text-right font-semibold ${catDelta >= 0 ? 'text-rose-500' : 'text-emerald-500'}">${catDelta >= 0 ? '+' : '-'}₹${Math.abs(catDelta).toLocaleString()}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}
