// --- Generate PDF (expense report) - pure data crunching --------------------
// Split out of pdf-report.js purely to keep that file under a sane line
// count - everything here is a pure function of appData + filters (no DOM,
// no rendering) that computes what a PDF report period actually contains.
// pdf-report.js (the filter form + on-screen result HTML) and
// pdf-download.js (the actual downloadable PDF bytes) both call
// _buildPdfReportData() and consume the same resulting shape, so there's
// exactly one place that decides what counts as "this report's data".

function _filterExpensesForPdfPeriod(filters) {
  if (filters.mode === 'month') return appData.expenses.filter(e => e.date.startsWith(filters.month));
  if (filters.mode === 'year') return appData.expenses.filter(e => e.date.startsWith(String(filters.year)));
  return appData.expenses.filter(e => e.date >= filters.from && e.date <= filters.to);
}

function _pdfReportPeriodLabel(filters) {
  if (filters.mode === 'month') {
    const [y, m] = filters.month.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  if (filters.mode === 'year') return `Year ${filters.year}`;
  return `${filters.from} to ${filters.to}`;
}

// category -> { total, subs: [[name, amount], ...] }, sorted biggest spend
// first at both levels - same convention Tag Reports already uses.
function _groupByCategoryAndSub(expenses) {
  const byCategory = {};
  expenses.forEach(e => {
    const cat = e.category || 'Uncategorized';
    const sub = e.subCategory || '(No sub-category)';
    if (!byCategory[cat]) byCategory[cat] = { total: 0, subs: {} };
    byCategory[cat].total += Number(e.amount);
    byCategory[cat].subs[sub] = (byCategory[cat].subs[sub] || 0) + Number(e.amount);
  });
  return Object.entries(byCategory)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([name, data]) => ({
      name,
      total: data.total,
      subs: Object.entries(data.subs).sort((a, b) => b[1] - a[1])
    }));
}

// Total spend per tag for the PERIOD ONLY (deliberately ignores the report's
// own tag-selection filter) - the "All Tags" overview, giving useful context
// no matter which tags were picked. A tag with zero expenses in the period
// simply never produces an entry here (this is built from what expenses
// actually carry, not by enumerating appData.tags) - which is exactly what
// keeps a tag with no matching spend from ever getting its own row/section.
function _totalsByTagForPeriod(periodExpenses) {
  // Untagged expenses are deliberately excluded (no "No tag" bucket) - this
  // section is specifically about TAGS, and an expense with none isn't one;
  // it still shows up fine in the raw expense table's Tag column as "-".
  const totals = {};
  periodExpenses.forEach(e => {
    if (e.tag) totals[e.tag] = (totals[e.tag] || 0) + Number(e.amount);
  });
  return Object.entries(totals)
    .map(([tagId, amount]) => ({ name: getTagName(tagId) || 'Former tag', amount }))
    .sort((a, b) => b.amount - a.amount);
}

// --- Paid By (family members) -------------------------------------------
// Total spend per payer for the PERIOD (deliberately the tag-filtered
// `reportExpenses`, not the wider period - this section answers "of what
// I'm actually looking at right now, who paid for it", consistent with the
// category/tag breakdown above it). Same "untagged simply doesn't count"
// convention as _totalsByTagForPeriod and compare.js's memberTotalsForYear
// - an expense with no paidBy isn't "paid by nobody", it's just not part of
// this particular breakdown.
function _totalsByMemberForExpenses(expenses) {
  const totals = {};
  expenses.forEach(e => {
    if (e.paidBy) totals[e.paidBy] = (totals[e.paidBy] || 0) + Number(e.amount);
  });
  return Object.entries(totals)
    .map(([memberId, amount]) => ({ name: getFamilyMemberName(memberId) || 'Former member', amount }))
    .sort((a, b) => b.amount - a.amount);
}

// Month-wise version of the above, only meaningful for a 'year' (or a
// custom range spanning multiple months) report - one row per month that
// actually has at least one paidBy expense, each a small {name, amount}
// breakdown sorted the same way as the whole-period totals. Months with
// zero paidBy activity are simply omitted rather than padding the table
// with empty rows - consistent with "a tag with zero expenses never gets
// its own row" above.
function _monthlyMemberTotalsForExpenses(expenses) {
  const monthTotals = {};
  expenses.forEach(e => {
    if (!e.paidBy) return;
    const ym = yearMonthOf(e.date);
    if (!monthTotals[ym]) monthTotals[ym] = {};
    monthTotals[ym][e.paidBy] = (monthTotals[ym][e.paidBy] || 0) + Number(e.amount);
  });
  return Object.keys(monthTotals).sort().map(ym => ({
    month: ym,
    members: Object.entries(monthTotals[ym])
      .map(([memberId, amount]) => ({ name: getFamilyMemberName(memberId) || 'Former member', amount }))
      .sort((a, b) => b.amount - a.amount)
  }));
}

// --- Budget vs Actual --------------------------------------------------
// This app's budgets are a single whole-month figure (global default + any
// per-month override - see getBudgetForMonth/appData.budgets in
// js/data-model.js), NOT broken out per-category, so "budget detail" here
// means "your configured budget vs what you actually spent", aggregated
// across every month the report's period touches. Only shown for the true
// "All Tags" view (no tags picked) - sanity-checking a whole-month budget
// against a tag-filtered SUBSET of spend would be misleading (the budget
// doesn't know or care about any one tag), and only shown at all when a
// budget is actually configured (totalBudget > 0) - otherwise the section
// is omitted entirely rather than showing an empty/zero budget bar.

function _monthsTouchedByPeriod(filters) {
  if (filters.mode === 'month') return [filters.month];
  if (filters.mode === 'year') return Array.from({ length: 12 }, (_, i) => `${filters.year}-${String(i + 1).padStart(2, '0')}`);
  const months = [];
  let cursor = filters.from.slice(0, 7);
  const end = filters.to.slice(0, 7);
  while (cursor <= end) {
    months.push(cursor);
    cursor = nextYearMonth(cursor);
  }
  return months;
}

function _pdfBudgetDetails(filters, periodExpenses) {
  if ((filters.tagIds || []).length > 0) return null;
  const totalBudget = _monthsTouchedByPeriod(filters).reduce((sum, m) => sum + getBudgetForMonth(m), 0);
  if (totalBudget <= 0) return null;
  const totalSpent = periodExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const percent = (totalSpent / totalBudget) * 100;
  return { totalBudget, totalSpent, percent, status: getBudgetStatus(percent) };
}

function _buildPdfReportData(filters) {
  const periodExpenses = _filterExpensesForPdfPeriod(filters);
  const tagIds = filters.tagIds || [];
  // Multi-select is OR logic: any expense carrying ANY of the picked tags
  // qualifies. Empty selection (nothing checked) means "All Tags", i.e. no
  // tag filtering at all - the explicit default asked for.
  const reportExpenses = tagIds.length > 0 ? periodExpenses.filter(e => e.tag && tagIds.includes(e.tag)) : periodExpenses;

  // Deliberately NOT blocking here even if reportExpenses ends up empty
  // (e.g. a selected tag has zero expenses this period, or the period
  // itself has none) - the report still generates, with graceful empty
  // states for the tag-filtered sections (see _pdfReportResultHtml). Never
  // pop an alert that stops the user from getting a PDF at all.

  const total = reportExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const categoryRows = _groupByCategoryAndSub(reportExpenses);
  const tagRows = _totalsByTagForPeriod(periodExpenses);
  // Paid By totals follow the report's OWN tag filter (unlike the "All
  // Tags" section above, which is deliberately period-wide) - "who paid"
  // is a different dimension than "which tag", so if you've filtered down
  // to just Trip-Goa expenses, this correctly answers "who paid for
  // Trip-Goa", not "who paid for everything this period". Month-wise
  // breakdown only bothers computing anything for a 'year' report - the
  // explicit ask was "if yearly report, show ... month wise as well", and
  // a month/custom-range report showing its own single-bucket total again
  // broken "by month" would just be the same number restated.
  const memberRows = _totalsByMemberForExpenses(reportExpenses);
  const monthlyMemberRows = filters.mode === 'year' ? _monthlyMemberTotalsForExpenses(reportExpenses) : [];
  const budget = _pdfBudgetDetails(filters, periodExpenses);
  const periodLabel = _pdfReportPeriodLabel(filters);
  // Only used as a small aside on the "All Expenses" heading, never in the
  // report's header banner - null means "All Tags" (default), which isn't
  // worth calling out since it's not really a filter at all.
  const tagFilterLabel = tagIds.length > 0 ? tagIds.map(id => getTagName(id) || 'Former tag').join(', ') : null;

  return {
    periodLabel,
    tagFilterLabel,
    total,
    budget,
    categoryRows,
    tagRows,
    memberRows,
    monthlyMemberRows,
    includeExpenseList: filters.includeExpenseList !== false,
    expenses: reportExpenses.slice().sort((a, b) => a.date.localeCompare(b.date)),
    categoryLabels: categoryRows.map(c => c.name),
    categoryValues: categoryRows.map(c => c.total),
    categoryColors: categoryRows.map((_, i) => _pdfReportColor(i)),
    tagLabels: tagRows.map(t => t.name),
    tagValues: tagRows.map(t => t.amount),
    tagColors: tagRows.map((_, i) => _pdfReportColor(i + 2))
  };
}
