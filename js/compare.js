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
  years.add(currentYearStr());
  return Array.from(years).filter(Boolean).sort().reverse();
}

function monthlyTotalsForYear(year) {
  const totals = new Array(12).fill(0);
  expensesInYear(year).forEach(e => {
    const monthIdx = Number(e.date.slice(5, 7)) - 1;
    if (monthIdx >= 0 && monthIdx < 12) totals[monthIdx] += Number(e.amount) || 0;
  });
  return totals;
}

function categoryTotalsForYear(year) {
  const totals = {};
  expensesInYear(year).forEach(e => {
    const cat = e.category || 'Uncategorized';
    totals[cat] = (totals[cat] || 0) + (Number(e.amount) || 0);
  });
  return totals;
}

function sortedCategoryEntries(totals) {
  return Object.entries(totals).sort((a, b) => b[1] - a[1]);
}

// --- Spend by Family Member (per year) --------------------------------------
// Only expenses that actually have a `paidBy` tag count here (see the
// optional "Paid By" dropdown on Add Expense / due-item payments in
// index.html) - untagged expenses simply don't show up in either total,
// same spirit as categories only counting expenses that have one.

function memberTotalsForYear(year) {
  const totals = {};
  expensesInYear(year).forEach(e => {
    if (!e.paidBy) return;
    totals[e.paidBy] = (totals[e.paidBy] || 0) + (Number(e.amount) || 0);
  });
  return totals;
}

// One entry per month, each an {memberId: amount} map - the "month wise"
// half of the member breakdown; memberTotalsForYear() above covers the
// "annually" half. Kept as two small functions rather than one that
// computes both, since Home/other future call sites may only ever want one.
function monthlyMemberTotalsForYear(year) {
  const months = Array.from({ length: 12 }, () => ({}));
  expensesInYear(year).forEach(e => {
    if (!e.paidBy) return;
    const idx = Number(e.date.slice(5, 7)) - 1;
    if (idx < 0 || idx >= 12) return;
    months[idx][e.paidBy] = (months[idx][e.paidBy] || 0) + (Number(e.amount) || 0);
  });
  return months;
}

// Month-by-month "who paid what" chips plus an annual per-member total
// list - covers both the "month wise" and "year wise" halves of the member
// comparison in one card, same pattern as renderBudgetVsActualCard above.
// Renders nothing at all if there are no family members configured yet
// (YAGNI - no point showing an empty "by member" card to someone not using
// the feature) or if none of this year's expenses were tagged with one.
function renderMemberSpendCard(year) {
  if (!appData.familyMembers || appData.familyMembers.length === 0) return '';

  const monthlyTotals = monthlyMemberTotalsForYear(year);
  const yearTotals = memberTotalsForYear(year);
  const hasAnyPaidByData = Object.keys(yearTotals).length > 0;

  return `
    <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
      <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">${year} Spend by Family Member</h3>
      ${!hasAnyPaidByData ? '<p class="text-xs text-slate-400 text-center py-4">No expenses have a "Paid By" tag for this year yet.</p>' : `
        <div class="space-y-2 mb-4">
          ${COMPARE_MONTH_NAMES.map((m, i) => {
            const entries = Object.entries(monthlyTotals[i]).sort((a, b) => b[1] - a[1]);
            if (entries.length === 0) return '';
            return `
              <div class="flex items-start gap-2 text-[10px]">
                <span class="w-7 text-slate-400 font-semibold shrink-0 pt-1">${m}</span>
                <div class="flex-1 flex flex-wrap gap-1.5">
                  ${entries.map(([memberId, amt]) => `
                    <span class="px-2 py-1 rounded-full bg-slate-50 border border-slate-100 font-semibold text-slate-600">${getFamilyMemberName(memberId)}: ₹${amt.toLocaleString()}</span>
                  `).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="pt-3 border-t border-slate-100 space-y-1.5">
          <p class="text-[10px] font-semibold text-slate-400 uppercase mb-1.5">Annual Total by Member</p>
          ${Object.entries(yearTotals).sort((a, b) => b[1] - a[1]).map(([memberId, amt]) => `
            <div class="flex items-center justify-between text-xs">
              <span class="font-semibold text-slate-700">${getFamilyMemberName(memberId)}</span>
              <span class="font-bold text-blue-700">₹${amt.toLocaleString()}</span>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

// --- Budget vs Actual (per year) -------------------------------------------
// Reuses the exact same effective-budget lookup and color thresholds Home
// uses (see getBudgetForMonth/getBudgetStatus in js/data-model.js) - one
// definition of "what's this month's budget" and "how worried should this
// look", used everywhere in the app instead of Compare inventing its own.

function monthlyBudgetsForYear(year) {
  return COMPARE_MONTH_NAMES.map((_, i) => getBudgetForMonth(`${year}-${String(i + 1).padStart(2, '0')}`));
}

// One year's month-by-month budget-vs-actual bars plus a year-total roll-up
// row at the bottom - this single card covers BOTH halves of "month wise
// budget comparison for a year" and "year wise budget comparison" for that
// year; the two-year comparison view then renders one of these per year
// side-by-side-ish (stacked, given the narrow mobile layout) plus its own
// extra head-to-head summary - see renderYearBudgetTotalsComparison below.
function renderBudgetVsActualCard(year, monthsActual, monthsBudget) {
  const yearActual = monthsActual.reduce((s, v) => s + v, 0);
  const yearBudget = monthsBudget.reduce((s, v) => s + v, 0);
  const yearPercent = yearBudget > 0 ? (yearActual / yearBudget) * 100 : 0;
  const yearStatus = getBudgetStatus(yearPercent);

  return `
    <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">${year} Budget vs Actual</h3>
        ${yearBudget > 0 ? `<span class="text-[10px] font-bold ${yearStatus.text}">${yearStatus.label}</span>` : '<span class="text-[10px] font-semibold text-slate-300">No budget set</span>'}
      </div>

      <div class="space-y-2 mb-4">
        ${COMPARE_MONTH_NAMES.map((m, i) => {
          const actual = monthsActual[i];
          const budget = monthsBudget[i];
          const percent = budget > 0 ? (actual / budget) * 100 : 0;
          const status = getBudgetStatus(percent);
          const barWidth = budget > 0 ? Math.min(100, percent) : (actual > 0 ? 100 : 0);
          return `
            <div class="flex items-center gap-2 text-[10px]">
              <span class="w-7 text-slate-400 font-semibold shrink-0">${m}</span>
              <div class="flex-1 h-2 rounded-full ${budget > 0 ? status.track : 'bg-slate-100'} overflow-hidden">
                <div class="h-full ${budget > 0 ? status.bar : 'bg-slate-300'} rounded-full" style="width:${barWidth.toFixed(1)}%"></div>
              </div>
              <span class="w-28 text-right shrink-0 text-slate-700 font-semibold">
                ₹${actual.toLocaleString()}${budget > 0 ? ` / ₹${budget.toLocaleString()}` : ' (no budget)'}
              </span>
            </div>
          `;
        }).join('')}
      </div>

      <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
        <span class="text-[10px] font-semibold text-slate-400 uppercase">Year Total</span>
        <span class="text-xs font-bold text-slate-800">
          ₹${yearActual.toLocaleString()}${yearBudget > 0 ? ` / ₹${yearBudget.toLocaleString()} (${yearPercent.toFixed(0)}%)` : ' (no budget set)'}
        </span>
      </div>
    </div>
  `;
}

// Head-to-head "who did better against their own budget" summary for the
// two-year comparison view - the explicit "final year wise budget
// comparison" the two per-year cards above don't directly give you, since
// each only compares itself to itself.
function renderYearBudgetTotalsComparison(yearA, yearB, budgetA, actualA, budgetB, actualB) {
  const pctA = budgetA > 0 ? (actualA / budgetA) * 100 : 0;
  const pctB = budgetB > 0 ? (actualB / budgetB) * 100 : 0;
  const statusA = getBudgetStatus(pctA);
  const statusB = getBudgetStatus(pctB);

  const col = (year, budget, actual, pct, status, accentClass) => `
    <div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm text-center">
      <p class="text-[9px] font-semibold text-slate-400 uppercase">${year} Budget Used</p>
      <p class="text-base font-bold mt-0.5 ${budget > 0 ? status.text : 'text-slate-300'}">${budget > 0 ? pct.toFixed(0) + '%' : 'N/A'}</p>
      <p class="text-[9px] ${accentClass} mt-0.5 font-semibold">₹${actual.toLocaleString()}${budget > 0 ? ` of ₹${budget.toLocaleString()}` : ' (no budget)'}</p>
    </div>
  `;

  return `
    <div class="grid grid-cols-2 gap-2">
      ${col(yearA, budgetA, actualA, pctA, statusA, 'text-blue-600')}
      ${col(yearB, budgetB, actualB, pctB, statusB, 'text-violet-600')}
    </div>
  `;
}

function onCompareYearChange(which, value) {
  if (which === 'A') _compareYearA = value;
  else _compareYearB = value;
  navigate('compare');
}

function renderYearPicker(years) {
  const yearOptions = (selected) => years.map(y => `<option value="${y}" ${y === selected ? 'selected' : ''}>${y}</option>`).join('');
  return `
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
  `;
}

// Single-year view: no second year selected (or no second year exists yet)
// so a side-by-side delta would just be comparing a year against itself.
// Same cards, just one column of numbers instead of two.
function renderSingleYearSection(year) {
  const months = monthlyTotalsForYear(year);
  const total = months.reduce((sum, v) => sum + v, 0);
  const maxMonthVal = Math.max(1, ...months);
  const catEntries = sortedCategoryEntries(categoryTotalsForYear(year));

  return `
    <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-center">
      <p class="text-[10px] font-semibold text-slate-400 uppercase">${year} Total Spend</p>
      <p class="text-2xl font-bold text-blue-700 mt-1">₹${total.toLocaleString()}</p>
      <p class="text-[10px] text-slate-400 mt-1">Pick a different Year B above to compare against another year.</p>
    </div>

    <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
      <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Month by Month</h3>
      <div class="space-y-2">
        ${COMPARE_MONTH_NAMES.map((m, i) => `
          <div class="flex items-center gap-2 text-[10px]">
            <span class="w-7 text-slate-400 font-semibold shrink-0">${m}</span>
            <div class="flex-1 h-2 rounded-full bg-blue-50 overflow-hidden"><div class="h-full bg-blue-500 rounded-full" style="width:${(months[i] / maxMonthVal * 100).toFixed(1)}%"></div></div>
            <span class="w-16 text-right text-slate-700 font-semibold shrink-0">₹${months[i].toLocaleString()}</span>
          </div>
        `).join('')}
      </div>
    </div>

    ${renderBudgetVsActualCard(year, months, monthlyBudgetsForYear(year))}

    ${renderMemberSpendCard(year)}

    <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
      <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">By Category</h3>
      <div class="divide-y divide-slate-50">
        ${catEntries.length === 0 ? '<p class="text-xs text-slate-400 text-center py-4">No expenses recorded for this year.</p>' : catEntries.map(([cat, amt]) => `
          <div class="py-2 flex items-center justify-between gap-2">
            <span class="text-xs font-semibold text-slate-700 truncate flex-1 min-w-0">${cat}</span>
            <span class="text-xs font-bold text-blue-700">₹${amt.toLocaleString()}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Two-year side-by-side comparison view.
function renderComparisonSection(yearA, yearB) {
  const monthsA = monthlyTotalsForYear(yearA);
  const monthsB = monthlyTotalsForYear(yearB);
  const totalA = monthsA.reduce((sum, v) => sum + v, 0);
  const totalB = monthsB.reduce((sum, v) => sum + v, 0);
  const delta = totalA - totalB;
  const deltaPct = totalB !== 0 ? (delta / totalB) * 100 : (totalA !== 0 ? 100 : 0);
  const maxMonthVal = Math.max(1, ...monthsA, ...monthsB);

  const budgetsA = monthlyBudgetsForYear(yearA);
  const budgetsB = monthlyBudgetsForYear(yearB);

  const catA = categoryTotalsForYear(yearA);
  const catB = categoryTotalsForYear(yearB);
  const allCats = Array.from(new Set([...Object.keys(catA), ...Object.keys(catB)]))
    .sort((c1, c2) => ((catA[c2] || 0) + (catB[c2] || 0)) - ((catA[c1] || 0) + (catB[c1] || 0)));

  return `
    <div class="grid grid-cols-3 gap-2">
      <div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm text-center">
        <p class="text-[9px] font-semibold text-slate-400 uppercase">${yearA} Total</p>
        <p class="text-base font-bold text-blue-700 mt-0.5">₹${totalA.toLocaleString()}</p>
      </div>
      <div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm text-center">
        <p class="text-[9px] font-semibold text-slate-400 uppercase">${yearB} Total</p>
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

    ${renderYearBudgetTotalsComparison(yearA, yearB, budgetsA.reduce((s, v) => s + v, 0), totalA, budgetsB.reduce((s, v) => s + v, 0), totalB)}

    ${renderBudgetVsActualCard(yearA, monthsA, budgetsA)}
    ${renderBudgetVsActualCard(yearB, monthsB, budgetsB)}

    ${renderMemberSpendCard(yearA)}
    ${renderMemberSpendCard(yearB)}

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

function renderCompare(container) {
  const years = getAvailableCompareYears();

  // Default to the two most recent years so there's an immediate, sensible
  // comparison on first visit instead of an empty picker.
  if (!_compareYearA || !years.includes(_compareYearA)) _compareYearA = years[0];
  if (!_compareYearB || !years.includes(_compareYearB)) _compareYearB = years[1] || years[0];

  const isSingleYear = _compareYearA === _compareYearB;

  container.innerHTML = `
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-bold text-slate-800">Compare Years</h2>
    </div>
    ${renderYearPicker(years)}
    ${isSingleYear ? renderSingleYearSection(_compareYearA) : renderComparisonSection(_compareYearA, _compareYearB)}
  `;
}
