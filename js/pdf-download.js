// --- Generate PDF - actual downloadable file --------------------------
// Builds the real, byte-for-byte PDF file for the "Download PDF" button
// (see js/pdf-report.js's _pdfReportResultHtml) using the generic SimplePdf
// writer (js/pdf-writer.js). This is a SEPARATE render path from the
// on-screen HTML report - relying on window.print()/"Save as PDF" was
// distorting the layout (every browser/OS paginates and rescales print
// output a little differently), so the actual downloadable artifact is now
// generated with fully explicit, deterministic coordinates instead, with
// zero dependency on the browser's print engine.
//
// The on-screen page keeps its <canvas> doughnut/bar charts for quick
// in-app browsing (see _drawDoughnutChart/_drawBarChart in pdf-report.js) -
// this file re-expresses the same data as simple colored bars instead,
// since SimplePdf deliberately doesn't support curves/arcs (see its file
// comment). Money is formatted as "Rs. 1,234" rather than using the Rupee
// sign (\u20b9) - the standard PDF fonts' built-in encoding has no glyph for
// it (see pdf-writer.js's file comment for why embedding a custom font
// just for this one symbol isn't worth the added complexity here).

const _BUDGET_BAR_HEX = {
  'bg-rose-600': '#e11d48',
  'bg-rose-500': '#f43f5e',
  'bg-orange-500': '#f97316',
  'bg-amber-500': '#f59e0b',
  'bg-emerald-500': '#10b981'
};

function _pdfMoney(n) {
  return 'Rs. ' + Math.round(Number(n)).toLocaleString();
}

function _pdfReportFilenameSlug(data) {
  const slug = data.periodLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
  return `expense-report-${slug || 'report'}`;
}

// --- Visual charts (mirrors the on-screen canvas doughnut/bar charts - see
// _drawDoughnutChart/_drawBarChart in pdf-report.js) using SimplePdf's
// pieSlice()/filledCircle() (real circular arcs via bezier approximation -
// see pdf-writer.js) and plain rectangles. Each draws a full bordered card
// and leaves `pdf.y` positioned right after it, same convention as every
// other section in downloadPdfReport(). ---

function _pdfDrawCategoryDoughnutCard(pdf, categoryRows, total) {
  const M = pdf.margin, CW = pdf.contentWidth;
  const legendRows = Math.ceil(categoryRows.length / 2);
  const doughnutAreaH = 150;
  const cardH = 24 + doughnutAreaH + legendRows * 14 + 8;
  pdf.ensureSpace(cardH);
  const cardTop = pdf.y;
  pdf.rect(M, cardTop, CW, cardH, { stroke: [0.86, 0.88, 0.93], lineWidth: 0.75 });
  pdf.text(M + 10, cardTop + 10, 'SPEND BY CATEGORY', { size: 9, bold: true, color: [0.45, 0.48, 0.56] });

  const outerR = 62, innerR = 34;
  const cx = M + CW / 2;
  const cy = cardTop + 24 + doughnutAreaH / 2;
  let angle = -Math.PI / 2;
  categoryRows.forEach((cat, i) => {
    const sweep = total > 0 ? (cat.total / total) * Math.PI * 2 : 0;
    if (sweep > 0.0005) pdf.pieSlice(cx, cy, outerR, angle, angle + sweep, hexToRgb01(_pdfReportColor(i)));
    angle += sweep;
  });
  pdf.filledCircle(cx, cy, innerR, [1, 1, 1]);
  pdf.text(cx - 50, cy - 12, 'Total', { size: 8, bold: true, color: [0.4, 0.44, 0.52], align: 'center', width: 100 });
  pdf.text(cx - 50, cy + 2, pdfTruncateToWidth(_pdfMoney(total), 96, 11, true), { size: 11, bold: true, color: [0.1, 0.13, 0.2], align: 'center', width: 100 });

  const legendTop = cardTop + 24 + doughnutAreaH;
  const colW = (CW - 20) / 2;
  categoryRows.forEach((cat, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = M + 10 + col * colW;
    const y = legendTop + row * 14;
    pdf.rect(x, y + 3, 7, 7, { fill: hexToRgb01(_pdfReportColor(i)) });
    pdf.text(x + 11, y, pdfTruncateToWidth(cat.name, colW - 15, 8, false), { size: 8, color: [0.35, 0.38, 0.46], width: colW - 15 });
  });

  pdf.y = cardTop + cardH + 16;
}

function _pdfDrawTagBarChartCard(pdf, tagRows) {
  const M = pdf.margin, CW = pdf.contentWidth;
  const chartH = 100;
  const cardH = 24 + chartH + 12;
  pdf.ensureSpace(cardH);
  const cardTop = pdf.y;
  pdf.rect(M, cardTop, CW, cardH, { stroke: [0.86, 0.88, 0.93], lineWidth: 0.75 });
  pdf.text(M + 10, cardTop + 10, 'SPEND BY TAG', { size: 9, bold: true, color: [0.45, 0.48, 0.56] });

  const chartTop = cardTop + 24;
  const labelSpace = 12; // room above the tallest bar for its amount label
  const chartBottom = chartTop + chartH - 16; // room below bars for the name label
  const maxAmt = Math.max.apply(null, tagRows.map(t => t.amount).concat([1]));
  const gap = 10;
  const innerW = CW - 20;
  const barW = Math.max(14, (innerW - gap * (tagRows.length - 1)) / tagRows.length);

  tagRows.forEach((t, i) => {
    const x = M + 10 + i * (barW + gap);
    const barH = (t.amount / maxAmt) * (chartBottom - chartTop - labelSpace);
    const y = chartBottom - barH;
    const color = hexToRgb01(_pdfReportColor(i + 2));
    pdf.rect(x, y, barW, barH, { fill: color });
    pdf.text(x, y - 11, pdfTruncateToWidth(_pdfMoney(t.amount), barW + 10, 7, true), { size: 7, bold: true, color: [0.3, 0.33, 0.4], align: 'center', width: barW });
    pdf.text(x, chartBottom + 4, pdfTruncateToWidth(t.name, barW + 6, 7, false), { size: 7, color: [0.5, 0.53, 0.6], align: 'center', width: barW });
  });

  pdf.y = cardTop + cardH + 16;
}

function downloadPdfReport(data) {
  const pdf = new SimplePdf();
  const M = pdf.margin;
  const CW = pdf.contentWidth;
  const userName = (appData.userName || '').trim();
  const title = userName ? `${userName}'s Expense Report` : 'Expense Report';
  const generatedAt = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const topCategory = data.categoryRows[0] ? data.categoryRows[0].name : '-';
  const topTag = data.tagRows[0] || null;

  // --- Header banner ---
  pdf.rect(M, pdf.y, CW, 60, { fill: hexToRgb01('#4f46e5') });
  pdf.text(M + 14, pdf.y + 12, title, { size: 17, bold: true, color: [1, 1, 1] });
  pdf.text(M + 14, pdf.y + 34, data.periodLabel, { size: 11, bold: true, color: [0.95, 0.95, 1] });
  pdf.text(M + 14, pdf.y + 48, `Generated ${generatedAt}`, { size: 8, color: [0.85, 0.85, 0.97] });
  pdf.advance(76);

  // --- Stat cards ---
  const stats = [
    ['TOTAL SPENT', _pdfMoney(data.total)],
    ['EXPENSES', String(data.expenses.length)],
    ['TOP CATEGORY', topCategory],
    ['TOP TAG', topTag ? topTag.name : '-']
  ];
  const statGap = 8;
  const statW = (CW - statGap * 3) / 4;
  stats.forEach((s, i) => {
    const x = M + i * (statW + statGap);
    pdf.rect(x, pdf.y, statW, 46, { fill: [0.97, 0.98, 1], stroke: [0.86, 0.88, 0.93], lineWidth: 0.75 });
    pdf.text(x + 8, pdf.y + 10, s[0], { size: 7, bold: true, color: [0.45, 0.48, 0.56], width: statW - 16 });
    pdf.text(x + 8, pdf.y + 26, pdfTruncateToWidth(s[1], statW - 16, 11, true), { size: 11, bold: true, color: [0.1, 0.13, 0.2], width: statW - 16 });
  });
  pdf.advance(46 + 16);

  // --- Budget vs Actual (same gating rules as the on-screen version - see
  // _pdfBudgetDetails in pdf-report.js: only when a budget is configured
  // AND no tag filter is active) ---
  if (data.budget) {
    pdf.ensureSpace(60);
    pdf.rect(M, pdf.y, CW, 46, { stroke: [0.86, 0.88, 0.93], lineWidth: 0.75 });
    pdf.text(M + 10, pdf.y + 10, 'BUDGET', { size: 8, bold: true, color: [0.4, 0.44, 0.52] });
    pdf.text(M + 10, pdf.y + 10, `${data.budget.status.label} - ${Math.round(data.budget.percent)}%`, { size: 8, bold: true, color: [0.4, 0.44, 0.52], align: 'right', width: CW - 20 });
    const barY = pdf.y + 20;
    const barW = CW - 20;
    pdf.rect(M + 10, barY, barW, 8, { fill: [0.92, 0.93, 0.96] });
    const fillPct = Math.max(0, Math.min(100, data.budget.percent));
    if (fillPct > 0) pdf.rect(M + 10, barY, barW * (fillPct / 100), 8, { fill: hexToRgb01(_BUDGET_BAR_HEX[data.budget.status.bar] || '#10b981') });
    pdf.text(M + 10, pdf.y + 34, `${_pdfMoney(data.budget.totalSpent)} spent of ${_pdfMoney(data.budget.totalBudget)} budget`, { size: 8, color: [0.45, 0.48, 0.56] });
    pdf.advance(46 + 16);
  }

  // --- Category & sub-category breakdown - a real doughnut chart card
  // (mirrors the on-screen canvas version) followed by the detailed
  // numeric bars-list, same order as the on-screen page. ---
  if (data.categoryRows.length === 0) {
    pdf.ensureSpace(38);
    pdf.text(M, pdf.y, 'BY CATEGORY & SUB-CATEGORY', { size: 9, bold: true, color: [0.45, 0.48, 0.56] });
    pdf.advance(20);
    pdf.text(M, pdf.y, `No expenses found for this period${data.tagFilterLabel ? ' under tag(s): ' + data.tagFilterLabel : ''}.`, { size: 9, color: [0.5, 0.53, 0.6] });
    pdf.advance(18);
  } else {
    _pdfDrawCategoryDoughnutCard(pdf, data.categoryRows, data.total);
    if (data.tagLabels.length > 0) _pdfDrawTagBarChartCard(pdf, data.tagRows);

    pdf.ensureSpace(20);
    pdf.text(M, pdf.y, 'BY CATEGORY & SUB-CATEGORY', { size: 9, bold: true, color: [0.45, 0.48, 0.56] });
    pdf.advance(20);

    data.categoryRows.forEach((cat, i) => {
      const color = hexToRgb01(_pdfReportColor(i));
      const pct = data.total > 0 ? Math.round((cat.total / data.total) * 100) : 0;
      pdf.ensureSpace(20);
      pdf.rect(M, pdf.y + 1, 4, 14, { fill: color });
      pdf.text(M + 10, pdf.y, pdfTruncateToWidth(cat.name, CW * 0.55, 10, true), { size: 10, bold: true, color: [0.1, 0.13, 0.2], width: CW * 0.6 });
      pdf.text(M, pdf.y, `${_pdfMoney(cat.total)} (${pct}%)`, { size: 10, bold: true, color, align: 'right', width: CW });
      pdf.advance(18);
      cat.subs.forEach(([subName, amt]) => {
        const subPct = cat.total > 0 ? Math.round((amt / cat.total) * 100) : 0;
        pdf.ensureSpace(14);
        pdf.text(M + 16, pdf.y, pdfTruncateToWidth(subName, CW * 0.5, 8, false), { size: 8, color: [0.5, 0.53, 0.6], width: CW * 0.55 });
        pdf.text(M, pdf.y, `${_pdfMoney(amt)} (${subPct}%)`, { size: 8, color: [0.5, 0.53, 0.6], align: 'right', width: CW });
        pdf.advance(13);
      });
      pdf.advance(6);
    });
  }

  // --- All Tags overview (period-wide, unaffected by the tag filter - same
  // as the on-screen version) ---
  if (data.tagRows.length > 0) {
    pdf.ensureSpace(20);
    pdf.text(M, pdf.y, 'ALL TAGS (TOTAL SPEND)', { size: 9, bold: true, color: [0.45, 0.48, 0.56] });
    pdf.advance(20);
    data.tagRows.forEach((t, i) => {
      const color = hexToRgb01(_pdfReportColor(i + 2));
      pdf.ensureSpace(18);
      pdf.rect(M, pdf.y + 3, 8, 8, { fill: color });
      pdf.text(M + 14, pdf.y, pdfTruncateToWidth(t.name, CW * 0.55, 9, true), { size: 9, bold: true, color: [0.2, 0.23, 0.32], width: CW * 0.6 });
      pdf.text(M, pdf.y, _pdfMoney(t.amount), { size: 9, bold: true, color, align: 'right', width: CW });
      pdf.advance(16);
    });
    pdf.advance(8);
  }

  // --- Paid By overview (same total-list treatment as All Tags above) plus
  // a month-wise "who paid what" matrix for a 'year' report only - mirrors
  // the on-screen version exactly (see _pdfReportResultHtml in
  // pdf-report.js for the shared rationale on both pieces). ---
  if (data.memberRows.length > 0) {
    pdf.ensureSpace(20);
    pdf.text(M, pdf.y, 'PAID BY (TOTAL SPEND)', { size: 9, bold: true, color: [0.45, 0.48, 0.56] });
    pdf.advance(20);
    data.memberRows.forEach((m, i) => {
      const color = hexToRgb01(_pdfReportColor(i + 2));
      pdf.ensureSpace(18);
      pdf.rect(M, pdf.y + 3, 8, 8, { fill: color });
      pdf.text(M + 14, pdf.y, pdfTruncateToWidth(m.name, CW * 0.55, 9, true), { size: 9, bold: true, color: [0.2, 0.23, 0.32], width: CW * 0.6 });
      pdf.text(M, pdf.y, _pdfMoney(m.amount), { size: 9, bold: true, color, align: 'right', width: CW });
      pdf.advance(16);
    });
    pdf.advance(8);

    if (data.monthlyMemberRows.length > 0) {
      const PDF_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      pdf.ensureSpace(20);
      pdf.text(M, pdf.y, 'PAID BY - MONTH WISE', { size: 9, bold: true, color: [0.45, 0.48, 0.56] });
      pdf.advance(20);

      // Columns are exactly the payers from memberRows (same order/subset
      // as the total-list above) - generic key-driven cols, same DRY
      // pattern the All Expenses table below uses, since the number of
      // member columns varies per household.
      const memberNames = data.memberRows.map(m => m.name);
      const mCols = [
        { key: 'month', label: 'MONTH', w: 0.28, align: 'left' },
        ...memberNames.map(name => ({ key: name, label: name.toUpperCase(), w: 0.72 / memberNames.length, align: 'right' }))
      ];
      const mColWidths = mCols.map(c => c.w * CW);
      const mColX = [];
      let mCursor = M;
      mColWidths.forEach(w => { mColX.push(mCursor); mCursor += w; });

      function drawMemberTableHeader() {
        pdf.rect(M, pdf.y, CW, 18, { fill: [0.12, 0.16, 0.24] });
        mCols.forEach((c, i) => pdf.text(mColX[i] + 5, pdf.y + 5, c.label, { size: 7, bold: true, color: [1, 1, 1], align: c.align, width: mColWidths[i] - 10 }));
        pdf.advance(18);
      }

      pdf.ensureSpace(18);
      drawMemberTableHeader();

      data.monthlyMemberRows.forEach((row, i) => {
        const brokeToNewPage = pdf.ensureSpace(16);
        if (brokeToNewPage) drawMemberTableHeader();
        if (i % 2 === 1) pdf.rect(M, pdf.y, CW, 16, { fill: [0.97, 0.98, 1] });
        const byName = {};
        row.members.forEach(m => { byName[m.name] = m.amount; });
        const monthLabel = `${PDF_MONTH_NAMES[Number(row.month.slice(5, 7)) - 1]} ${row.month.slice(0, 4)}`;
        mCols.forEach((c, ci) => {
          const isMonth = c.key === 'month';
          const text = isMonth ? monthLabel : (byName[c.key] != null ? _pdfMoney(byName[c.key]) : '-');
          pdf.text(mColX[ci] + 5, pdf.y + 4, text, { size: 8, bold: isMonth, color: isMonth ? [0.2, 0.23, 0.32] : [0.35, 0.38, 0.46], align: c.align, width: mColWidths[ci] - 10 });
        });
        pdf.advance(16);
      });
      pdf.advance(8);
    }
  }

  // --- All Expenses table (paginated - header row redraws on every new
  // page via ensureSpace()'s return value). Skipped entirely when the user
  // unchecked "include full expense list" on the filter form - a whole
  // year's worth of rows can get long, and totals/charts/breakdowns above
  // already tell the full story without it. ---
  if (data.expenses.length > 0 && data.includeExpenseList) {
    pdf.ensureSpace(20);
    const heading = 'ALL EXPENSES' + (data.tagFilterLabel ? ` (tags: ${data.tagFilterLabel})` : '');
    pdf.text(M, pdf.y, heading, { size: 9, bold: true, color: [0.45, 0.48, 0.56] });
    pdf.advance(20);

    const cols = [
      { label: 'DATE', w: 0.20, align: 'left' },
      { label: 'CATEGORY', w: 0.55, align: 'left' },
      { label: 'AMOUNT', w: 0.25, align: 'right' }
    ];
    const colWidths = cols.map(c => c.w * CW);
    const colX = [];
    let cursor = M;
    colWidths.forEach(w => { colX.push(cursor); cursor += w; });

    function drawTableHeader() {
      pdf.rect(M, pdf.y, CW, 18, { fill: [0.12, 0.16, 0.24] });
      cols.forEach((c, i) => pdf.text(colX[i] + 5, pdf.y + 5, c.label, { size: 7, bold: true, color: [1, 1, 1], align: c.align, width: colWidths[i] - 10 }));
      pdf.advance(18);
    }

    pdf.ensureSpace(18);
    drawTableHeader();

    data.expenses.forEach((e, i) => {
      const brokeToNewPage = pdf.ensureSpace(16);
      if (brokeToNewPage) drawTableHeader();
      if (i % 2 === 1) pdf.rect(M, pdf.y, CW, 16, { fill: [0.97, 0.98, 1] });
      const catText = e.category + (e.subCategory ? ' > ' + e.subCategory : '');
      pdf.text(colX[0] + 5, pdf.y + 4, e.date, { size: 8, color: [0.35, 0.38, 0.46], width: colWidths[0] - 10 });
      pdf.text(colX[1] + 5, pdf.y + 4, pdfTruncateToWidth(catText, colWidths[1] - 10, 8, false), { size: 8, color: [0.2, 0.23, 0.32], width: colWidths[1] - 10 });
      pdf.text(colX[2] + 5, pdf.y + 4, _pdfMoney(e.amount), { size: 8, bold: true, color: [0.1, 0.13, 0.2], align: 'right', width: colWidths[2] - 10 });
      pdf.advance(16);
    });
  }

  pdf.download(`${_pdfReportFilenameSlug(data)}.pdf`);
}
