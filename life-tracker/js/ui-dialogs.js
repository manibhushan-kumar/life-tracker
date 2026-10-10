// --- Custom Alert / Confirm dialogs -----------------------------------------
// Replaces the browser's native alert()/confirm() EVERYWHERE in the app with
// a small Promise-based modal that actually matches the rest of the UI
// (rounded-2xl card, brand colors, Font Awesome icon) instead of jarring OS
// chrome that looks wildly inconsistent (and sometimes behaves oddly) inside
// an installed-to-homescreen PWA.
//
// Two functions, both return Promises so call sites just `await` them:
//   showAlert(message, { title, tone })                          -> Promise<void>
//   showConfirm(message, { title, tone, confirmLabel, cancelLabel, danger }) -> Promise<boolean>
//
// Every old `alert('...')` call site becomes `await showAlert('...')` (its
// containing function needs the `async` keyword - onclick="fn()" handlers in
// the HTML work completely fine calling an async function as-is, nothing
// needs to await the click itself). Every old `if (!confirm('...')) return;`
// becomes `if (!(await showConfirm('...'))) return;` for the same reason.
//
// #dialogModal/#dialogModalContent live in index.html, styled the same way
// as #formModal/#driveBusyModal right next to them. Sits at a higher
// z-index than both (see index.html) since a confirmation can legitimately
// need to appear ON TOP of an open form (e.g. confirming a loan overpayment
// while the "Add Payment" form is still showing underneath it).

const DIALOG_TONE_ICONS = {
  info: { icon: 'fa-circle-info', color: 'text-blue-500', bg: 'bg-blue-50' },
  warning: { icon: 'fa-triangle-exclamation', color: 'text-amber-500', bg: 'bg-amber-50' },
  danger: { icon: 'fa-trash', color: 'text-rose-500', bg: 'bg-rose-50' },
  success: { icon: 'fa-circle-check', color: 'text-emerald-500', bg: 'bg-emerald-50' }
};

// Single low-level renderer both showAlert/showConfirm build on - exactly
// one place that knows how to paint the modal and wire up its buttons, so
// the two public functions below are just "which buttons + what each one
// resolves to". window.__dialogResolve is a single mutable slot rather than
// a stack - fine here because these are always modal/blocking and the app
// never opens a second one before the first resolves.
function _renderDialog({ title, message, tone, buttons }) {
  return new Promise(resolve => {
    const modal = document.getElementById('dialogModal');
    const content = document.getElementById('dialogModalContent');
    const toneInfo = DIALOG_TONE_ICONS[tone] || DIALOG_TONE_ICONS.info;

    window.__dialogResolve = (value) => {
      modal.classList.add('hidden');
      resolve(value);
    };

    content.innerHTML = `
      <div class="w-12 h-12 mx-auto rounded-full ${toneInfo.bg} ${toneInfo.color} flex items-center justify-center mb-3">
        <i class="fa-solid ${toneInfo.icon} text-lg" aria-hidden="true"></i>
      </div>
      ${title ? `<h3 class="text-sm font-bold text-slate-800 mb-1">${title}</h3>` : ''}
      <p class="text-xs text-slate-500 leading-relaxed whitespace-pre-line mb-4">${message}</p>
      <div class="flex gap-2">
        ${buttons.map(b => `
          <button onclick="window.__dialogResolve(${JSON.stringify(b.value)})" class="flex-1 py-2.5 text-xs font-bold rounded-xl transition ${
            b.style === 'danger' ? 'bg-rose-600 text-white hover:bg-rose-700'
            : b.style === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
          }">${b.label}</button>
        `).join('')}
      </div>
    `;
    modal.classList.remove('hidden');
  });
}

// One-button "OK" dialog - drop-in replacement for alert(message).
function showAlert(message, options = {}) {
  const { title = null, tone = 'info', okLabel = 'OK' } = options;
  return _renderDialog({ title, message, tone, buttons: [{ label: okLabel, style: 'primary', value: undefined }] });
}

// Two-button Cancel/Confirm dialog - drop-in replacement for
// `confirm(message)`, resolving true/false the same way. Defaults to a
// "warning" tone + red confirm button since almost every confirm() in this
// app guards a delete or other hard-to-undo action; pass `danger: false`
// for a neutral confirmation (e.g. the loan-overpayment prompt, which isn't
// destructive, just worth double-checking).
function showConfirm(message, options = {}) {
  const { title = null, tone = 'warning', confirmLabel = 'Yes, Continue', cancelLabel = 'Cancel', danger = true } = options;
  return _renderDialog({
    title, message, tone,
    buttons: [
      { label: cancelLabel, style: 'secondary', value: false },
      { label: confirmLabel, style: danger ? 'danger' : 'primary', value: true }
    ]
  });
}
