// --- Generate PDF (expense report) -----------------------------------------
// Opened via the Quick Add (+) sheet, but rendered as a normal in-app page
// (navigate('pdfReport') -> #mainContainer), same pattern as Tag Reports/
// Fuel Log - NOT a modal, NOT a separate window/tab. Two internal steps
// live in one page (see pdfReportStep below): a filter FORM, then a
// generated RESULT with a "back" arrow to return to the form - the same
// "list -> detail -> back" shape Splitwise uses, just without needing its
// own overlay since this doesn't have to coexist with a different nested
// nav structure.
//
// Rendering inside the app's own DOM (instead of window.open()+
// document.write() into a brand new document) is also what makes this
// genuinely offline-safe: it reuses whatever CSS/fonts/icons the main app
// already has loaded - nothing extra to fetch. Charts are still hand-rolled
// <canvas> 2D drawing (see _drawDoughnutChart/_drawBarChart) rather than a
// charting library, so there's still zero network dependency for the data
// visualization itself either.
//
// "Download PDF" builds an actual PDF file byte-for-byte using the hand-
// rolled SimplePdf writer (js/pdf-writer.js) and the report-specific layout
// in js/pdf-download.js, then downloads it directly - no browser print
// dialog involved at all. That used to rely on window.print()'s "Save as
// PDF", but different browsers/OSes paginate and rescale print output
// noticeably differently, which was distorting the layout - generating the
// PDF bytes ourselves means every coordinate is explicit and deterministic,
// with nothing left to a print engine's judgment. A small "print this page"
// link stays available for anyone who wants the on-screen view printed
// instead - see the global `@media print` rule in index.html's <style>
// block for how the app chrome gets hidden for that path.

const PDF_REPORT_COLORS = [
  '#2563eb', '#db2777', '#16a34a', '#d97706', '#7c3aed', '#0891b2',
  '#dc2626', '#65a30d', '#c026d3', '#0d9488', '#ea580c', '#4f46e5'
];

function _pdfReportColor(index) {
  return PDF_REPORT_COLORS[index % PDF_REPORT_COLORS.length];
}

// --- Page state ------------------------------------------------------------
// Plain in-memory state, same spirit as expenseFilterMonth/reportSelectedTagId
// elsewhere in this app - persists across navigating away and back within
// the same session, but always starts fresh at 'form' on a cold reload since
// pdfReportData is never persisted anywhere.
let pdfReportStep = 'form'; // 'form' | 'result'
let pdfReportFilters = null; // last-submitted filters, so "Back" reopens the form pre-filled instead of reset
let pdfReportData = null; // computed report payload for the 'result' step

function renderPdfReportPage(container) {
  if (pdfReportStep === 'result' && pdfReportData) {
    container.innerHTML = _pdfReportResultHtml(pdfReportData);
    _drawDoughnutChart('categoryChart', 'categoryChartLegend', pdfReportData.categoryLabels, pdfReportData.categoryValues, pdfReportData.categoryColors);
    if (pdfReportData.tagLabels.length > 0) _drawBarChart('tagChart', pdfReportData.tagLabels, pdfReportData.tagValues, pdfReportData.tagColors);
  } else {
    container.innerHTML = _pdfReportFormHtml();
  }
}

function goBackToPdfReportForm() {
  pdfReportStep = 'form';
  renderPdfReportPage(document.getElementById('mainContainer'));
}

// --- Filter form -------------------------------------------------------

function _pdfReportFormHtml() {
  const currentYear = currentYearStr();
  const currentMonth = getTodayStr().slice(0, 7);
  const f = pdfReportFilters || { mode: 'month', tagIds: [] };

  return `
    <h2 class="text-sm font-bold text-slate-800 mb-1">Generate PDF Report</h2>
    <p class="text-[11px] text-slate-400 mb-3">Pick a period and, optionally, one or more tags - generates a colorful, chart-backed report right here that you can print or download.</p>

    <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
      <div>
        <label class="text-[11px] font-semibold text-slate-400">Period</label>
        <select id="pdfPeriodMode" onchange="onPdfPeriodModeChange(this.value)" class="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500 bg-white">
          <option value="month" ${f.mode === 'month' ? 'selected' : ''}>Month</option>
          <option value="year" ${f.mode === 'year' ? 'selected' : ''}>Complete Year</option>
          <option value="range" ${f.mode === 'range' ? 'selected' : ''}>Custom Date Range</option>
        </select>
      </div>

      <div id="pdfMonthField" class="${f.mode === 'month' ? '' : 'hidden'}">
        <label class="text-[11px] font-semibold text-slate-400">Month</label>
        <input type="month" id="pdfMonthValue" value="${f.month || currentMonth}" class="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500 bg-white">
      </div>

      <div id="pdfYearField" class="${f.mode === 'year' ? '' : 'hidden'}">
        <label class="text-[11px] font-semibold text-slate-400">Year</label>
        <input type="number" id="pdfYearValue" value="${f.year || currentYear}" min="2000" max="2100" class="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
      </div>

      <div id="pdfRangeFields" class="${f.mode === 'range' ? '' : 'hidden'} grid grid-cols-2 gap-2">
        <div>
          <label class="text-[11px] font-semibold text-slate-400">From</label>
          <input type="date" id="pdfRangeFrom" value="${f.from || currentMonth + '-01'}" class="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500 bg-white">
        </div>
        <div>
          <label class="text-[11px] font-semibold text-slate-400">To</label>
          <input type="date" id="pdfRangeTo" value="${f.to || getTodayStr()}" class="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500 bg-white">
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between">
          <label class="text-[11px] font-semibold text-slate-400">Tags (optional)</label>
          ${appData.tags.length > 0 ? `
            <div class="flex gap-2">
              <button type="button" onclick="_pdfSelectAllTags(true)" class="text-[10px] font-semibold text-blue-600 hover:text-blue-700">Select All</button>
              <button type="button" onclick="_pdfSelectAllTags(false)" class="text-[10px] font-semibold text-slate-400 hover:text-slate-600">Uncheck All</button>
            </div>
          ` : ''}
        </div>
        ${appData.tags.length === 0 ? `
          <p class="text-[11px] text-slate-400 mt-1">No tags configured yet - the report will include every expense in the period.</p>
        ` : `
          <div class="grid grid-cols-2 gap-x-3 gap-y-1 max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2.5 mt-1">
            ${appData.tags.map(t => `
              <label class="flex items-center gap-2 text-xs text-slate-600 py-0.5 min-w-0">
                <input type="checkbox" class="pdfTagCheckbox w-4 h-4 rounded border-slate-300 shrink-0" value="${t.id}" ${f.tagIds.includes(t.id) ? 'checked' : ''}>
                <span class="truncate">${t.name}</span>
              </label>
            `).join('')}
          </div>
          <p class="text-[9px] text-slate-400 mt-1">Select one or more, or leave all unchecked to include every tag (default).</p>
        `}
      </div>

      <label class="flex items-center gap-2 text-xs text-slate-600 py-1">
        <input type="checkbox" id="pdfIncludeExpenseList" class="w-4 h-4 rounded border-slate-300" ${f.includeExpenseList !== false ? 'checked' : ''}>
        Include the full expense list (table) in the report
      </label>
      <p class="text-[9px] text-slate-400 -mt-2">Uncheck this for a shorter summary-only report - handy for a whole year with lots of rows. Totals, budget, charts, and category/tag breakdowns always show either way.</p>

      <button onclick="generatePdfReportFromForm()" class="w-full py-2.5 bg-fuchsia-600 text-white rounded-xl text-xs font-bold hover:bg-fuchsia-700 transition mt-1">Generate Report</button>
    </div>
  `;
}

function _pdfSelectAllTags(checked) {
  document.querySelectorAll('.pdfTagCheckbox').forEach(cb => { cb.checked = checked; });
}

function onPdfPeriodModeChange(mode) {
  document.getElementById('pdfMonthField').classList.toggle('hidden', mode !== 'month');
  document.getElementById('pdfYearField').classList.toggle('hidden', mode !== 'year');
  document.getElementById('pdfRangeFields').classList.toggle('hidden', mode !== 'range');
}

async function generatePdfReportFromForm() {
  const mode = document.getElementById('pdfPeriodMode').value;
  let tagIds = Array.from(document.querySelectorAll('.pdfTagCheckbox:checked')).map(cb => cb.value);
  // Ticking every configured tag via "Select All" should behave exactly
  // like leaving none checked (the true "All Tags" default, which also
  // includes untagged expenses) - not the narrower "every expense that has
  // ANY tag" reading, which would silently exclude untagged spend and
  // surprise anyone who just clicked Select All expecting "everything".
  if (appData.tags.length > 0 && tagIds.length === appData.tags.length) tagIds = [];
  const includeExpenseList = document.getElementById('pdfIncludeExpenseList').checked;
  const filters = { mode, tagIds, includeExpenseList };

  if (mode === 'month') {
    filters.month = document.getElementById('pdfMonthValue').value;
    if (!filters.month) { await showAlert('Pick a month.'); return; }
  } else if (mode === 'year') {
    filters.year = document.getElementById('pdfYearValue').value;
    if (!filters.year) { await showAlert('Enter a year.'); return; }
  } else {
    filters.from = document.getElementById('pdfRangeFrom').value;
    filters.to = document.getElementById('pdfRangeTo').value;
    if (!filters.from || !filters.to) { await showAlert('Pick both a "From" and "To" date.'); return; }
    if (filters.from > filters.to) { await showAlert('"From" date must be on or before "To" date.'); return; }
  }

  const built = _buildPdfReportData(filters);

  pdfReportFilters = filters;
  pdfReportData = built;
  pdfReportStep = 'result';
  renderPdfReportPage(document.getElementById('mainContainer'));
}

// --- Result page ---------------------------------------------------------

function _pdfReportResultHtml(data) {
  const { periodLabel, tagFilterLabel, total, budget, categoryRows, tagRows, memberRows, monthlyMemberRows, expenses, includeExpenseList } = data;
  const topCategory = categoryRows[0] ? categoryRows[0].name : '-';
  const topTag = tagRows[0] || null;
  const generatedAt = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  // If a name is set in Settings ("Your Name"), lead with it right in the
  // report's own title - more visible than a small subtitle line, and it's
  // the one thing every page of a printed/saved report carries regardless
  // of period/tag filters.
  const userName = (appData.userName || '').trim();
  const reportTitle = userName ? `\ud83d\udcca ${userName}'s Expense Report` : '\ud83d\udcca Expense Report';

  const categoryHtml = categoryRows.map((cat, i) => {
    const color = _pdfReportColor(i);
    const pct = total > 0 ? Math.round((cat.total / total) * 100) : 0;
    const subsHtml = cat.subs.map(([subName, amt]) => {
      const subPct = cat.total > 0 ? Math.round((amt / cat.total) * 100) : 0;
      return `
        <div class="flex items-center justify-between text-[11px] text-slate-500 py-1 pl-4 border-l-2" style="border-color:${color}55">
          <span>${subName}</span>
          <span class="font-semibold text-slate-600">\u20b9${Number(amt).toLocaleString()} <span class="text-slate-400 font-normal">(${subPct}%)</span></span>
        </div>`;
    }).join('');
    return `
      <div class="mb-3 rounded-xl border border-slate-100 overflow-hidden">
        <div class="flex items-center justify-between px-3 py-2" style="background:${color}1a;">
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full inline-block" style="background:${color}"></span>
            <span class="font-bold text-sm text-slate-800">${cat.name}</span>
          </div>
          <span class="font-bold text-sm" style="color:${color}">\u20b9${Number(cat.total).toLocaleString()} <span class="text-slate-400 font-normal text-xs">(${pct}%)</span></span>
        </div>
        <div class="px-3 py-2 bg-white">${subsHtml}</div>
      </div>`;
  }).join('');

  const tagOverviewHtml = tagRows.map((t, i) => {
    const color = _pdfReportColor(i + 2);
    return `
      <div class="flex items-center justify-between text-xs py-2 px-3 rounded-lg" style="background:${color}14;">
        <span class="flex items-center gap-2 font-semibold text-slate-700"><span class="w-2.5 h-2.5 rounded-full inline-block" style="background:${color}"></span>${t.name}</span>
        <span class="font-bold" style="color:${color}">\u20b9${Number(t.amount).toLocaleString()}</span>
      </div>`;
  }).join('');

  // "Paid By" total list - same visual treatment as the tag overview above,
  // just a different dimension of the same data. Column order for the
  // month-wise matrix below follows this same biggest-payer-first sort.
  const PDF_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const memberOverviewHtml = memberRows.map((m, i) => {
    const color = _pdfReportColor(i + 2);
    return `
      <div class="flex items-center justify-between text-xs py-2 px-3 rounded-lg" style="background:${color}14;">
        <span class="flex items-center gap-2 font-semibold text-slate-700"><span class="w-2.5 h-2.5 rounded-full inline-block" style="background:${color}"></span>${m.name}</span>
        <span class="font-bold" style="color:${color}">\u20b9${Number(m.amount).toLocaleString()}</span>
      </div>`;
  }).join('');

  // Month-wise "who paid what" matrix - columns are exactly the payers who
  // show up in memberRows (same order), rows are only the months that
  // actually had at least one paidBy expense (see
  // _monthlyMemberTotalsForExpenses - months with none simply don't exist
  // in this array, so there's nothing to filter here).
  const memberColumnNames = memberRows.map(m => m.name);
  const monthlyMemberTableHtml = monthlyMemberRows.length > 0 ? `
    <div class="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm mb-4">
      <div class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr class="bg-slate-800 text-white text-[10px] uppercase">
              <th class="px-2 py-2 text-left font-bold">Month</th>
              ${memberColumnNames.map(name => `<th class="px-2 py-2 text-right font-bold">${name}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${monthlyMemberRows.map((row, i) => {
              const byName = {};
              row.members.forEach(m => { byName[m.name] = m.amount; });
              const monthLabel = `${PDF_MONTH_NAMES[Number(row.month.slice(5, 7)) - 1]} ${row.month.slice(0, 4)}`;
              return `
                <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}">
                  <td class="px-2 py-1.5 text-[11px] font-semibold text-slate-700 whitespace-nowrap">${monthLabel}</td>
                  ${memberColumnNames.map(name => `<td class="px-2 py-1.5 text-[11px] text-slate-600 text-right whitespace-nowrap">${byName[name] != null ? '\u20b9' + Number(byName[name]).toLocaleString() : '-'}</td>`).join('')}
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  ` : '';

  const expenseRowsHtml = expenses.map((e, i) => `
    <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}">
      <td class="px-2 py-1.5 text-[11px] text-slate-500 whitespace-nowrap">${e.date}</td>
      <td class="px-2 py-1.5 text-[11px] text-slate-700">${e.category}${e.subCategory ? ' &raquo; ' + e.subCategory : ''}</td>
      <td class="px-2 py-1.5 text-[11px] font-bold text-slate-800 text-right whitespace-nowrap">\u20b9${Number(e.amount).toLocaleString()}</td>
    </tr>`).join('');

  return `
    <div class="no-print flex items-center gap-2 mb-1">
      <button onclick="goBackToPdfReportForm()" aria-label="Back to filters" class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition">
        <i class="fa-solid fa-arrow-left"></i>
      </button>
      <h2 class="text-sm font-bold text-slate-800 flex-1">Generate PDF Report</h2>
      <button onclick="downloadPdfReport(pdfReportData)" class="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition whitespace-nowrap">
        <i class="fa-solid fa-download mr-1"></i>Download PDF
      </button>
    </div>
    <p class="no-print text-[9px] text-slate-400 mb-3">Generates a real PDF file and downloads it straight away - no print dialog. (Prefer to print instead? <a href="javascript:window.print()" class="underline">print this page</a>.)</p>

    <div id="pdfReportPrintArea">
      <div class="rounded-2xl p-6 mb-4 text-white shadow-lg" style="background: linear-gradient(135deg, #4f46e5, #db2777, #f59e0b);">
        <h1 class="text-lg font-extrabold m-0">${reportTitle}</h1>
        <p class="text-sm font-semibold mt-1 mb-0 opacity-95">${periodLabel}</p>
        <p class="text-[11px] opacity-80 mt-2 mb-0">Generated ${generatedAt}</p>
      </div>

      <div class="grid grid-cols-2 gap-3 mb-4">
        <div class="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm text-center">
          <p class="text-[10px] font-bold text-slate-400 uppercase m-0">Total Spent</p>
          <p class="text-lg font-extrabold text-indigo-600 mt-1 mb-0">\u20b9${Number(total).toLocaleString()}</p>
        </div>
        <div class="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm text-center">
          <p class="text-[10px] font-bold text-slate-400 uppercase m-0">Expenses</p>
          <p class="text-lg font-extrabold text-pink-600 mt-1 mb-0">${expenses.length}</p>
        </div>
        <div class="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm text-center">
          <p class="text-[10px] font-bold text-slate-400 uppercase m-0">Top Category</p>
          <p class="text-sm font-extrabold text-amber-600 mt-1 mb-0 truncate">${topCategory}</p>
        </div>
        <div class="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm text-center">
          <p class="text-[10px] font-bold text-slate-400 uppercase m-0">Top Tag</p>
          <p class="text-sm font-extrabold text-emerald-600 mt-1 mb-0 truncate">${topTag ? topTag.name : '-'}</p>
        </div>
      </div>

      ${budget ? `
      <div class="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm mb-4">
        <div class="flex items-center justify-between mb-2">
          <p class="text-[11px] font-bold text-slate-500 uppercase tracking-wide"><i class="fa-solid fa-wallet mr-1"></i>Budget</p>
          <span class="text-[10px] font-bold ${budget.status.text}">${budget.status.label} &bull; ${Math.round(budget.percent)}%</span>
        </div>
        <div class="w-full h-2.5 rounded-full ${budget.status.track} overflow-hidden mb-2">
          <div class="h-full ${budget.status.bar} rounded-full" style="width:${Math.min(100, budget.percent)}%"></div>
        </div>
        <div class="flex items-center justify-between text-[11px]">
          <span class="text-slate-500">\u20b9${Number(budget.totalSpent).toLocaleString()} spent</span>
          <span class="text-slate-400">of \u20b9${Number(budget.totalBudget).toLocaleString()} budget</span>
        </div>
      </div>
      ` : ''}

      ${expenses.length === 0 ? `
        <div class="bg-white p-6 rounded-2xl border border-dashed border-slate-200 text-center mb-4">
          <i class="fa-solid fa-receipt text-2xl text-slate-300 mb-2"></i>
          <p class="text-xs text-slate-400">No expenses found for this period${tagFilterLabel ? ` under tag(s): ${tagFilterLabel}` : ''}. Everything else on this report (Budget, All Tags overview) still reflects the full period.</p>
        </div>
      ` : `
        <div class="grid grid-cols-1 gap-4 mb-4 break-inside-avoid">
          <div class="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
            <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Spend by Category</h3>
            <div style="height:240px;"><canvas id="categoryChart"></canvas></div>
            <div class="flex flex-wrap gap-2 mt-2 text-[9px] text-slate-500 font-semibold" id="categoryChartLegend"></div>
          </div>
          ${data.tagLabels.length > 0 ? `
          <div class="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
            <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Spend by Tag</h3>
            <div style="height:240px;"><canvas id="tagChart"></canvas></div>
          </div>` : ''}
        </div>

        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">By Category &amp; Sub-category</h3>
        <div class="mb-4">${categoryHtml}</div>
      `}

      ${tagRows.length > 0 ? `
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">All Tags (Total Spend)</h3>
        <div class="space-y-1.5 mb-4 break-inside-avoid">${tagOverviewHtml}</div>
      ` : ''}

      ${memberRows.length > 0 ? `
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Paid By (Total Spend)</h3>
        <div class="space-y-1.5 mb-4 break-inside-avoid">${memberOverviewHtml}</div>
        ${monthlyMemberTableHtml ? `
          <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Paid By - Month Wise</h3>
          ${monthlyMemberTableHtml}
        ` : ''}
      ` : ''}

      ${expenses.length > 0 && includeExpenseList ? `
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">All Expenses${tagFilterLabel ? ` <span class="text-slate-400 font-normal normal-case">(tags: ${tagFilterLabel})</span>` : ''}</h3>
        <div class="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm mb-4">
          <div class="overflow-x-auto">
            <table class="w-full border-collapse">
              <thead>
                <tr class="bg-slate-800 text-white text-[10px] uppercase">
                  <th class="px-2 py-2 text-left font-bold">Date</th>
                  <th class="px-2 py-2 text-left font-bold">Category</th>
                  <th class="px-2 py-2 text-right font-bold">Amount</th>
                </tr>
              </thead>
              <tbody>${expenseRowsHtml}</tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <p class="text-center text-[10px] text-slate-400 pb-4">Generated by Life Tracker &bull; ${generatedAt}</p>
    </div>
  `;
}

// --- Dependency-free canvas 2D charts ---------------------------------
// No charting library (see file-level comment) - plain <canvas> drawing so
// this never depends on any network fetch succeeding.

function _sizeCanvasToParent(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.parentElement.clientWidth;
  const h = canvas.parentElement.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

function _drawDoughnutChart(canvasId, legendId, labels, values, colors) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const { ctx, w, h } = _sizeCanvasToParent(canvas);
  const total = values.reduce((a, b) => a + b, 0);
  const cx = w / 2, cy = h / 2, radius = Math.min(w, h) / 2 - 8, inner = radius * 0.58;
  let start = -Math.PI / 2;

  values.forEach((v, i) => {
    const angle = total > 0 ? (v / total) * Math.PI * 2 : 0;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, start + angle);
    ctx.closePath();
    ctx.fillStyle = colors[i];
    ctx.fill();
    start += angle;
  });

  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(cx, cy, inner, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  ctx.fillStyle = '#1e293b';
  ctx.textAlign = 'center';
  ctx.font = "700 11px system-ui, sans-serif";
  ctx.fillText('Total', cx, cy - 4);
  ctx.font = "700 13px system-ui, sans-serif";
  ctx.fillText('\u20b9' + Math.round(total).toLocaleString(), cx, cy + 13);

  const legendEl = document.getElementById(legendId);
  if (legendEl) {
    legendEl.innerHTML = labels.map((l, i) =>
      `<span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full inline-block" style="background:${colors[i]}"></span>${l}</span>`
    ).join('');
  }
}

function _drawBarChart(canvasId, labels, values, colors) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const { ctx, w, h } = _sizeCanvasToParent(canvas);
  const padding = { top: 20, right: 8, bottom: 34, left: 8 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;
  const maxVal = Math.max.apply(null, values.concat([1]));
  const gap = 14;
  const barW = Math.max(10, (chartW - gap * (values.length - 1)) / values.length);

  ctx.strokeStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top + chartH);
  ctx.lineTo(padding.left + chartW, padding.top + chartH);
  ctx.stroke();

  values.forEach((v, i) => {
    const barH = maxVal > 0 ? (v / maxVal) * chartH : 0;
    const x = padding.left + i * (barW + gap);
    const y = padding.top + chartH - barH;
    const r = Math.min(4, barW / 2);
    ctx.fillStyle = colors[i];
    ctx.beginPath();
    ctx.moveTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.lineTo(x + barW - r, y);
    ctx.arcTo(x + barW, y, x + barW, y + r, r);
    ctx.lineTo(x + barW, y + barH);
    ctx.lineTo(x, y + barH);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#334155';
    ctx.textAlign = 'center';
    ctx.font = "700 9px system-ui, sans-serif";
    ctx.fillText('\u20b9' + Math.round(v).toLocaleString(), x + barW / 2, Math.max(10, y - 4));

    ctx.fillStyle = '#94a3b8';
    ctx.font = "9px system-ui, sans-serif";
    const label = labels[i].length > 10 ? labels[i].slice(0, 9) + '\u2026' : labels[i];
    ctx.fillText(label, x + barW / 2, padding.top + chartH + 16);
  });
}
