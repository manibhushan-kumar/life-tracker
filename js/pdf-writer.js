// --- SimplePdf: minimal, dependency-free PDF file writer ------------------
// Hand-rolled, spec-minimal PDF byte generator - no library, no CDN, works
// fully offline (this is deliberate: relying on window.print()'s "Save as
// PDF" was distorting the layout - different browsers/OSes paginate and
// rescale print output unpredictably. Generating the actual PDF bytes
// ourselves means WE control every coordinate, with zero surprises).
//
// Scope is intentionally narrow - exactly what a text+rectangle report
// needs: multi-page documents, filled/stroked rectangles, straight lines,
// and left/right/center-aligned text in the standard (non-embedded)
// Helvetica/Helvetica-Bold fonts. No curves/arcs, no images, no embedded
// fonts - those would drag in real complexity (Bezier math for circular
// charts, font subsetting + ToUnicode CMaps for custom glyphs) that a
// personal expense report doesn't need. Bar-style visuals (plain colored
// rectangles) cover "colorful chart" just fine in vector form.
//
// IMPORTANT ENCODING CAVEAT: the standard 14 PDF fonts only support
// WinAnsiEncoding (roughly Latin-1) - there is NO Rupee sign (\u20b9) glyph
// available without embedding a whole custom font, which is a much bigger
// undertaking than this report warrants. Callers should format money as
// "Rs. 1,234" rather than using the \u20b9 symbol (see _pdfMoney in
// pdf-report.js) - this writer also defensively swaps any other character
// outside printable ASCII for '?' rather than silently corrupting the file.

const _HELVETICA_WIDTHS = { // per-1000-em advance widths, standard AFM metrics, char codes 32-126
  32: 278, 33: 278, 34: 355, 35: 556, 36: 556, 37: 889, 38: 667, 39: 191, 40: 333, 41: 333, 42: 389, 43: 584,
  44: 278, 45: 333, 46: 278, 47: 278, 48: 556, 49: 556, 50: 556, 51: 556, 52: 556, 53: 556, 54: 556, 55: 556,
  56: 556, 57: 556, 58: 278, 59: 278, 60: 584, 61: 584, 62: 584, 63: 556, 64: 1015, 65: 667, 66: 667, 67: 722,
  68: 722, 69: 667, 70: 611, 71: 778, 72: 722, 73: 278, 74: 500, 75: 667, 76: 556, 77: 833, 78: 722, 79: 778,
  80: 667, 81: 778, 82: 722, 83: 667, 84: 611, 85: 722, 86: 667, 87: 944, 88: 667, 89: 667, 90: 611, 91: 278,
  92: 278, 93: 278, 94: 469, 95: 556, 96: 333, 97: 556, 98: 556, 99: 500, 100: 556, 101: 556, 102: 278, 103: 556,
  104: 556, 105: 222, 106: 222, 107: 500, 108: 222, 109: 833, 110: 556, 111: 556, 112: 556, 113: 556, 114: 333,
  115: 500, 116: 278, 117: 556, 118: 500, 119: 722, 120: 500, 121: 500, 122: 500, 123: 334, 124: 260, 125: 334, 126: 584
};

function _pdfTextWidth(str, size, bold) {
  let units = 0;
  for (let i = 0; i < str.length; i++) units += _HELVETICA_WIDTHS[str.charCodeAt(i)] || 556;
  return (units / 1000) * size * (bold ? 1.07 : 1); // rough bold-width bump - see file comment, nothing here is precisely center/right-aligned in bold
}

function _pdfSanitizeText(str) {
  return String(str).replace(/[^\x20-\x7e]/g, '?');
}

// Unlike HTML, nothing here clips overflowing glyphs automatically - text
// that's wider than its column would just visually run into whatever's
// drawn next to it. Any caller placing text into a fixed-width column
// (table cells, stat card values, etc.) should route it through this first.
function pdfTruncateToWidth(str, maxWidth, size, bold) {
  const clean = _pdfSanitizeText(str);
  if (_pdfTextWidth(clean, size, bold) <= maxWidth) return clean;
  let truncated = clean;
  while (truncated.length > 1 && _pdfTextWidth(truncated + '...', size, bold) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '...';
}

function _pdfEscapeLiteral(str) {
  return str.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function hexToRgb01(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

class SimplePdf {
  constructor() {
    this.pageWidth = 595.28;  // A4, in points (1pt = 1/72in)
    this.pageHeight = 841.89;
    this.margin = 36;
    this.pages = [];
    this._newPage();
  }

  get y() { return this._y; }
  set y(v) { this._y = v; }

  get contentWidth() { return this.pageWidth - this.margin * 2; }

  _newPage() {
    this.pages.push([]);
    this._y = this.margin;
  }

  get _ops() { return this.pages[this.pages.length - 1]; }

  advance(dy) { this._y += dy; }

  // Starts a new page if `h` more points of content won't fit below the
  // cursor. Returns true if a new page was actually started, so callers
  // (e.g. a table) know to redraw a header row on the fresh page.
  ensureSpace(h) {
    if (this._y + h > this.pageHeight - this.margin) {
      this._newPage();
      return true;
    }
    return false;
  }

  rect(x, yTop, w, h, { fill, stroke, lineWidth = 1 } = {}) {
    const pdfY = this.pageHeight - yTop - h;
    if (fill) this._ops.push(`${fill[0].toFixed(3)} ${fill[1].toFixed(3)} ${fill[2].toFixed(3)} rg`);
    if (stroke) this._ops.push(`${stroke[0].toFixed(3)} ${stroke[1].toFixed(3)} ${stroke[2].toFixed(3)} RG ${lineWidth} w`);
    const mode = fill && stroke ? 'B' : fill ? 'f' : 'S';
    this._ops.push(`${x.toFixed(2)} ${pdfY.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${mode}`);
  }

  line(x1, y1Top, x2, y2Top, color = [0.85, 0.87, 0.9], lineWidth = 1) {
    const py1 = this.pageHeight - y1Top;
    const py2 = this.pageHeight - y2Top;
    this._ops.push(`${color[0]} ${color[1]} ${color[2]} RG ${lineWidth} w ${x1.toFixed(2)} ${py1.toFixed(2)} m ${x2.toFixed(2)} ${py2.toFixed(2)} l S`);
  }

  // --- Circular arcs -----------------------------------------------------
  // PDF has no native arc/curve-to-a-circle operator - only cubic beziers
  // (the `c` operator). Approximating a circular arc with beziers in
  // <=90-degree chunks is the standard, well-documented technique for this
  // (same trick every SVG/canvas-to-PDF library uses under the hood).
  // Angle convention matches canvas's arc(): 0 = pointing right, increasing
  // = clockwise (this class's Y already increases downward like canvas, so
  // the ordinary cos/sin formulas just work without any sign-flipping).

  _pdfY(yTop) { return this.pageHeight - yTop; }

  // Fills one pie/doughnut wedge centered at (cx, cyTop) with radius r,
  // sweeping clockwise from startAngle to endAngle (radians).
  pieSlice(cx, cyTop, r, startAngle, endAngle, color) {
    this._ops.push(`${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} rg`);
    this._ops.push(`${cx.toFixed(2)} ${this._pdfY(cyTop).toFixed(2)} m`); // start the path AT the center
    this._ops.push(`${(cx + r * Math.cos(startAngle)).toFixed(2)} ${this._pdfY(cyTop + r * Math.sin(startAngle)).toFixed(2)} l`); // spoke out to the arc's start point
    let a = startAngle;
    const maxStep = Math.PI / 2;
    while (a < endAngle - 1e-6) {
      const segEnd = Math.min(a + maxStep, endAngle);
      const theta = segEnd - a;
      const t = (4 / 3) * Math.tan(theta / 4);
      const p0x = cx + r * Math.cos(a), p0y = cyTop + r * Math.sin(a);
      const p3x = cx + r * Math.cos(segEnd), p3y = cyTop + r * Math.sin(segEnd);
      const p1x = p0x - t * r * Math.sin(a), p1y = p0y + t * r * Math.cos(a);
      const p2x = p3x + t * r * Math.sin(segEnd), p2y = p3y - t * r * Math.cos(segEnd);
      this._ops.push(`${p1x.toFixed(2)} ${this._pdfY(p1y).toFixed(2)} ${p2x.toFixed(2)} ${this._pdfY(p2y).toFixed(2)} ${p3x.toFixed(2)} ${this._pdfY(p3y).toFixed(2)} c`);
      a = segEnd;
    }
    this._ops.push('h f');
  }

  // Fills a plain circle - used to punch a doughnut's center "hole" (drawn
  // in the surrounding card's background color on top of the wedges, since
  // there's no simple compositing/clip-punch operator worth reaching for
  // here) and anywhere else a plain dot/circle is handy.
  filledCircle(cx, cyTop, r, color) {
    const k = 0.5522847498 * r; // standard 4-bezier-quarter circle constant
    this._ops.push(`${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} rg`);
    this._ops.push(`${(cx + r).toFixed(2)} ${this._pdfY(cyTop).toFixed(2)} m`);
    this._ops.push(`${(cx + r).toFixed(2)} ${this._pdfY(cyTop + k).toFixed(2)} ${(cx + k).toFixed(2)} ${this._pdfY(cyTop + r).toFixed(2)} ${cx.toFixed(2)} ${this._pdfY(cyTop + r).toFixed(2)} c`);
    this._ops.push(`${(cx - k).toFixed(2)} ${this._pdfY(cyTop + r).toFixed(2)} ${(cx - r).toFixed(2)} ${this._pdfY(cyTop + k).toFixed(2)} ${(cx - r).toFixed(2)} ${this._pdfY(cyTop).toFixed(2)} c`);
    this._ops.push(`${(cx - r).toFixed(2)} ${this._pdfY(cyTop - k).toFixed(2)} ${(cx - k).toFixed(2)} ${this._pdfY(cyTop - r).toFixed(2)} ${cx.toFixed(2)} ${this._pdfY(cyTop - r).toFixed(2)} c`);
    this._ops.push(`${(cx + k).toFixed(2)} ${this._pdfY(cyTop - r).toFixed(2)} ${(cx + r).toFixed(2)} ${this._pdfY(cyTop - k).toFixed(2)} ${(cx + r).toFixed(2)} ${this._pdfY(cyTop).toFixed(2)} c`);
    this._ops.push('h f');
  }

  // `yTop` is the top of the text's line box (not the baseline) - matches
  // how every other coordinate in this class is measured, so callers never
  // have to think in PDF's bottom-up coordinate space or baseline offsets.
  text(x, yTop, str, { size = 10, bold = false, color = [0.1, 0.13, 0.2], align = 'left', width = 0 } = {}) {
    const clean = _pdfSanitizeText(str);
    const font = bold ? 'F2' : 'F1';
    let drawX = x;
    if (align === 'right') drawX = x + width - _pdfTextWidth(clean, size, bold);
    else if (align === 'center') drawX = x + width / 2 - _pdfTextWidth(clean, size, bold) / 2;
    const pdfY = this.pageHeight - yTop - size * 0.85;
    this._ops.push(`BT /${font} ${size} Tf ${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} rg ${drawX.toFixed(2)} ${pdfY.toFixed(2)} Td (${_pdfEscapeLiteral(clean)}) Tj ET`);
  }

  toBytes() {
    const objects = [];
    const fontRegularNum = objects.length + 1;
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const fontBoldNum = objects.length + 1;
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

    const contentObjNums = [];
    this.pages.forEach(ops => {
      const stream = ops.join('\n');
      contentObjNums.push(objects.length + 1);
      objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    });

    // Page objects reference the (not-yet-created) Pages object by number -
    // safe to precompute since we know exactly how many more objects come
    // before it (one per page, in the loop right below).
    const pagesObjNum = objects.length + 1 + this.pages.length;
    const pageObjNums = [];
    this.pages.forEach((_, i) => {
      pageObjNums.push(objects.length + 1);
      objects.push(`<< /Type /Page /Parent ${pagesObjNum} 0 R /MediaBox [0 0 ${this.pageWidth.toFixed(2)} ${this.pageHeight.toFixed(2)}] /Resources << /Font << /F1 ${fontRegularNum} 0 R /F2 ${fontBoldNum} 0 R >> >> /Contents ${contentObjNums[i]} 0 R >>`);
    });

    objects.push(`<< /Type /Pages /Kids [${pageObjNums.map(n => n + ' 0 R').join(' ')}] /Count ${pageObjNums.length} >>`); // this IS pagesObjNum
    const catalogObjNum = objects.length + 1;
    objects.push(`<< /Type /Catalog /Pages ${pagesObjNum} 0 R >>`);

    let out = '%PDF-1.4\n';
    const offsets = [0]; // object 0 is always the free-list head
    objects.forEach((body, i) => {
      offsets.push(out.length);
      out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xrefStart = out.length;
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach(off => { out += `${String(off).padStart(10, '0')} 00000 n \n`; });
    out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObjNum} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

    // Every byte we've written is guaranteed printable-ASCII (7-bit) by
    // construction (fixed template strings + _pdfSanitizeText on all
    // caller-supplied text), so a straight charCode->byte map is safe.
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
    return bytes;
  }

  download(filename) {
    const blob = new Blob([this.toBytes()], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}
