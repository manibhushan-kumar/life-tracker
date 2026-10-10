// --- Share-as-image helper --------------------------------------------------
// Turns a list of declarative "blocks" (title/subtitle/section headers/rows)
// into a single tall PNG card, so a feature can share a whole screen's worth
// of data (e.g. a full Splitwise split - name, members, settle-up, expenses)
// as one image instead of a screenshot. Entirely hand-rolled with the 2D
// canvas API - no html2canvas/dom-to-image dependency, same "no third-party
// rendering library" philosophy as js/pdf-writer.js's from-scratch PDF byte
// writer.
//
// Why blocks instead of a fixed-size template: canvas has no layout engine,
// and the content here is unbounded (a split can have 2 members or 20,
// zero expenses or fifty) - so the canvas has to be sized AFTER we know how
// much content there is, not before. Every block declares its own pixel
// `height`; _renderShareBlocks sums them to size the canvas exactly once,
// then draws each block at its accumulated Y offset. There's no separate
// "measure pass" to keep in sync with the "draw pass" - the height used to
// size the canvas IS the height used to lay it out, by construction.
//
// Block shapes (all take a `height` in px, chosen by the caller). The card
// row kinds (memberRow/settleRow/expenseRow) deliberately mirror the exact
// Tailwind colors the on-screen Splitwise view uses for the same data (see
// js/splitwise.js's renderSplitGroupDetail) so the shared image reads as a
// snapshot of that screen rather than a generic report:
//   { kind: 'title',        text }
//   { kind: 'subtitle',     text }
//   { kind: 'divider' }
//   { kind: 'sectionHeader',text }
//   { kind: 'memberRow',    name, label, color }            // slate card, like the Members list
//   { kind: 'settleRow',    leftName, rightName, amount, settled }  // violet/emerald card, like Settle Up
//   { kind: 'expenseRow',   desc, amount, meta }             // slate card, like the Expenses list
//   { kind: 'note',         text }                   // single emphasized line (e.g. "Everyone's settled up!")
//   { kind: 'footer',       text }
//
// Usage: _shareOrDownloadCanvas(_renderShareBlocks(blocks), filename, title)

const _SHARE_CARD_W = 1080;
const _SHARE_TOP_PAD = 100;
const _SHARE_BOTTOM_PAD = 40;
const _SHARE_SIDE_PAD = 80;

// Exposed separately from _renderShareBlocks so a caller can check "would
// this be too tall to render reliably" BEFORE actually building a canvas -
// see shareSplitGroupImage() in js/splitwise.js, which falls back to a
// paginated PDF (js/pdf-writer.js's SimplePdf) once a split has enough
// members/transactions/expenses to push this past a safe canvas-height
// ceiling. Mobile WebKit in particular has historically capped canvas
// dimensions/area well below what a very long single-page image would need;
// there's no such ceiling on a multi-page PDF.
function _shareBlocksTotalHeight(blocks) {
  return _SHARE_TOP_PAD + blocks.reduce((sum, b) => sum + b.height, 0) + _SHARE_BOTTOM_PAD;
}

function _renderShareBlocks(blocks) {
  const width = _SHARE_CARD_W;
  const totalHeight = _shareBlocksTotalHeight(blocks);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, totalHeight);
  ctx.fillStyle = '#2563eb'; // top accent bar - just a visual anchor so the card reads as "from an app"
  ctx.fillRect(0, 0, width, 16);

  let y = _SHARE_TOP_PAD;
  blocks.forEach(b => {
    _drawShareBlock(ctx, b, y, width);
    y += b.height;
  });

  return canvas;
}

function _drawShareBlock(ctx, b, y, width) {
  const pad = _SHARE_SIDE_PAD;
  const innerWidth = width - pad * 2;
  const FONT = '-apple-system, Helvetica, Arial, sans-serif';

  switch (b.kind) {
    case 'title':
      ctx.fillStyle = '#0f172a';
      ctx.font = `700 52px ${FONT}`;
      ctx.fillText(_truncateText(ctx, b.text, innerWidth), pad, y + 52);
      break;

    case 'subtitle':
      ctx.fillStyle = '#64748b';
      ctx.font = `500 32px ${FONT}`;
      ctx.fillText(_truncateText(ctx, b.text, innerWidth), pad, y + 32);
      break;

    case 'divider':
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pad, y + b.height / 2);
      ctx.lineTo(width - pad, y + b.height / 2);
      ctx.stroke();
      break;

    case 'sectionHeader':
      ctx.fillStyle = '#1e293b';
      ctx.font = `700 36px ${FONT}`;
      ctx.fillText(b.text, pad, y + 36);
      break;

    // Matches the Members list's `bg-slate-50 border-slate-100` row: name on
    // the left, the colored "gets back/owes/settled up" label on the right
    // (color passed in by the caller, same emerald/rose/slate-400 choice the
    // HTML makes).
    case 'memberRow': {
      const boxTop = y + 6, boxH = b.height - 12;
      ctx.fillStyle = '#f8fafc';
      _roundRect(ctx, pad, boxTop, innerWidth, boxH, 14); ctx.fill();
      ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = 2;
      _roundRect(ctx, pad, boxTop, innerWidth, boxH, 14); ctx.stroke();

      const textY = y + b.height / 2 + 10;
      ctx.font = `700 30px ${FONT}`;
      ctx.fillStyle = '#334155';
      ctx.fillText(_truncateText(ctx, b.name, innerWidth * 0.5), pad + 28, textY);

      ctx.font = `700 28px ${FONT}`;
      ctx.fillStyle = b.color || '#0f172a';
      const labelW = ctx.measureText(b.label).width;
      ctx.fillText(b.label, pad + innerWidth - labelW - 28, textY);
      break;
    }

    // Matches the Settle Up list's violet (unpaid) / emerald (checked off)
    // card, including a small status dot standing in for the HTML's
    // fa-circle / fa-circle-check icon.
    case 'settleRow': {
      const theme = b.settled
        ? { bg: '#ecfdf5', border: '#a7f3d0', accent: '#047857' }
        : { bg: '#f5f3ff', border: '#ddd6fe', accent: '#6d28d9' };
      const boxTop = y + 6, boxH = b.height - 12;
      ctx.fillStyle = theme.bg;
      _roundRect(ctx, pad, boxTop, innerWidth, boxH, 14); ctx.fill();
      ctx.strokeStyle = theme.border; ctx.lineWidth = 2;
      _roundRect(ctx, pad, boxTop, innerWidth, boxH, 14); ctx.stroke();

      const midY = y + b.height / 2;
      const dotX = pad + 26;
      ctx.beginPath();
      ctx.arc(dotX, midY, 9, 0, Math.PI * 2);
      if (b.settled) {
        ctx.fillStyle = theme.accent; ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(dotX - 4, midY); ctx.lineTo(dotX - 1, midY + 3); ctx.lineTo(dotX + 4, midY - 4);
        ctx.stroke();
      } else {
        ctx.strokeStyle = theme.border; ctx.lineWidth = 2; ctx.stroke();
      }

      const textY = midY + 10;
      const textX = pad + 54;
      ctx.font = `700 28px ${FONT}`;
      const amount = b.amount;
      const amtW = ctx.measureText(amount).width;
      const maxNamesWidth = innerWidth - 54 - amtW - 40;
      const combined = `${b.leftName} → ${b.rightName}`;
      if (ctx.measureText(combined).width <= maxNamesWidth) {
        let x = textX;
        ctx.fillStyle = '#334155';
        ctx.fillText(b.leftName, x, textY);
        x += ctx.measureText(b.leftName + ' ').width;
        ctx.fillStyle = theme.accent;
        ctx.fillText('→', x, textY);
        x += ctx.measureText('→ ').width;
        ctx.fillStyle = '#334155';
        ctx.fillText(b.rightName, x, textY);
      } else {
        ctx.fillStyle = '#334155';
        ctx.fillText(_truncateText(ctx, combined, maxNamesWidth), textX, textY);
      }

      ctx.fillStyle = theme.accent;
      ctx.fillText(amount, pad + innerWidth - amtW - 26, textY);
      break;
    }

    // Matches the Expenses list's `bg-slate-50 border-slate-100` row: bold
    // description + amount on the top line, "Paid by X • split N way(s) •
    // date" in muted gray underneath.
    case 'expenseRow': {
      const boxTop = y + 6, boxH = b.height - 12;
      ctx.fillStyle = '#f8fafc';
      _roundRect(ctx, pad, boxTop, innerWidth, boxH, 14); ctx.fill();
      ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = 2;
      _roundRect(ctx, pad, boxTop, innerWidth, boxH, 14); ctx.stroke();

      const line1Y = y + 40;
      ctx.font = `700 30px ${FONT}`;
      ctx.fillStyle = '#1e293b';
      const amountW = ctx.measureText(b.amount).width;
      ctx.fillText(_truncateText(ctx, b.desc, innerWidth - amountW - 48), pad + 24, line1Y);
      ctx.fillText(b.amount, pad + innerWidth - amountW - 24, line1Y);

      ctx.font = `500 24px ${FONT}`;
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(_truncateText(ctx, b.meta, innerWidth - 48), pad + 24, line1Y + 36);
      break;
    }

    case 'note':
      ctx.font = `600 30px ${FONT}`;
      ctx.fillStyle = '#10b981';
      ctx.fillText(_truncateText(ctx, b.text, innerWidth), pad, y + 32);
      break;

    case 'footer':
      // Small and centered, with the block's own height acting as the top
      // margin that visually separates it from the Expenses section above.
      ctx.font = `500 22px ${FONT}`;
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText(b.text, width / 2, y + b.height / 2 + 8);
      ctx.textAlign = 'left'; // reset - every other block assumes left alignment
      break;
  }
}

// Rounded-rectangle path, drawn manually (not every browser/canvas version
// this PWA targets can be assumed to have ctx.roundRect) - matches the
// Tailwind `rounded-lg`/`rounded-xl` look used throughout the app's actual
// HTML cards, which the row kinds above are deliberately mimicking.
function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Single-line ellipsis truncation (canvas has no CSS `text-overflow`) - used
// instead of multi-line wrapping everywhere here so every block's height is
// a known constant the caller can declare up front (see the file header
// comment on why that matters for sizing the canvas in one pass).
function _truncateText(ctx, text, maxWidth) {
  let str = String(text == null ? '' : text);
  if (ctx.measureText(str).width <= maxWidth) return str;
  while (str.length > 1 && ctx.measureText(str + '…').width > maxWidth) {
    str = str.slice(0, -1);
  }
  return str + '…';
}

// Tries the native share sheet first (mobile Chrome/Safari support sharing
// FILES, not just text/links - any mime type, not just images) and falls
// back to a plain download - the exact Blob -> object URL -> temporary
// <a download> -> click -> revokeObjectURL sequence js/pdf-writer.js's
// SimplePdf.download() already uses. Shared by both the PNG card
// (_shareOrDownloadCanvas below) and the PDF fallback for large splits
// (see shareSplitGroupImage in js/splitwise.js) so there's exactly one
// "share this file, or download it" implementation in the app.
function _shareOrDownloadBlob(blob, filename, mimeType, shareTitle) {
  const file = new File([blob], filename, { type: mimeType });

  const tryShare = navigator.canShare && navigator.canShare({ files: [file] })
    ? navigator.share({ files: [file], title: shareTitle }).then(() => true).catch(err => {
        if (err && err.name === 'AbortError') return true; // user dismissed the share sheet - not an error, don't also download
        return false; // any other failure (e.g. share target rejected the file) - fall through to download
      })
    : Promise.resolve(false);

  tryShare.then(shared => {
    if (shared) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

function _shareOrDownloadCanvas(canvas, filename, shareTitle) {
  canvas.toBlob(blob => {
    if (!blob) return;
    _shareOrDownloadBlob(blob, filename, 'image/png', shareTitle);
  }, 'image/png');
}
