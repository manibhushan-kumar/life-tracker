// --- Loans (money you've borrowed) -----------------------------------------
// Tracks loans/money TAKEN from someone (a person, a bank, anyone) - not
// money lent out, and deliberately a separate concept from Splitwise (which
// is about a shared/group expense being split, not a personal debt with a
// principal that shrinks as you pay it off over time).
//
// Opened via the Quick Add (+) sheet and rendered as a normal in-app page
// (navigate('loans') -> #mainContainer), same pattern as Tag Reports/Fuel
// Log/Generate PDF - NOT a modal, NOT a separate overlay. Internally it's a
// two-step "list -> detail -> back" flow, the same shape Splitwise uses,
// just without needing Splitwise's own overlay/nested-nav machinery since
// this fits fine as a single page with local step state (see loansStep
// below - same trick pdfReportStep in js/pdf-report.js already uses).
//
// Each loan embeds its own partial-payment history directly (loan.payments)
// - same self-contained-document spirit as a Splitwise group embedding its
// own members+expenses - so deleting a loan is one array splice that wipes
// everything in it, nothing left to orphan. Unlike Splitwise, this lives
// straight in appData (see getDefaultAppData in js/data-model.js) rather
// than its own IndexedDB store/Drive file: every mutation here just calls
// the normal saveState(), which ALREADY keeps the Drive upload button
// honest and ALREADY backs up to settings.json - no separate
// "_refreshDriveButtonAfterLoanChange" plumbing needed the way Splitwise's
// file-level comment explains it had to build for itself.

let loansStep = 'list'; // 'list' | 'detail'
let activeLoanId = null;

function _loanId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

// Signed day difference from `fromStr` to `toStr` (both "YYYY-MM-DD").
// Positive means toStr is in the future. Parsed as UTC on both sides purely
// so the SUBTRACTION is immune to any DST shift - this never displays an
// absolute date, only a difference, so UTC-vs-local doesn't matter here.
function _daysBetween(fromStr, toStr) {
  const a = new Date(fromStr + 'T00:00:00Z').getTime();
  const b = new Date(toStr + 'T00:00:00Z').getTime();
  return Math.round((b - a) / 86400000);
}

// Unpaid loans first (soonest target date first within that group; no
// target date sinks to the bottom), fully paid-off loans last - surfaces
// whatever actually needs your attention at the top of the list instead of
// making you scroll past settled loans to find the one that's overdue.
function _sortedLoansForList() {
  return appData.loans.slice().sort((a, b) => {
    const aPaid = getLoanRemaining(a) <= 0;
    const bPaid = getLoanRemaining(b) <= 0;
    if (aPaid !== bPaid) return aPaid ? 1 : -1;
    const aDate = a.targetDate || '9999-99-99';
    const bDate = b.targetDate || '9999-99-99';
    return aDate.localeCompare(bDate);
  });
}

function renderLoansPage(container) {
  const loan = activeLoanId ? appData.loans.find(l => l.id === activeLoanId) : null;
  if (loansStep === 'detail' && loan) {
    container.innerHTML = _loanDetailHtml(loan);
  } else {
    loansStep = 'list';
    activeLoanId = null;
    container.innerHTML = _loansListHtml();
  }
}

function openLoanDetail(loanId) {
  activeLoanId = loanId;
  loansStep = 'detail';
  renderLoansPage(document.getElementById('mainContainer'));
}

function backToLoanList() {
  loansStep = 'list';
  activeLoanId = null;
  renderLoansPage(document.getElementById('mainContainer'));
}

// --- List view -----------------------------------------------------------

function _loanCardHtml(loan) {
  const remaining = getLoanRemaining(loan);
  const paidTotal = getLoanPaidTotal(loan);
  const pct = Number(loan.amount) > 0 ? Math.min(100, (paidTotal / Number(loan.amount)) * 100) : 0;
  const status = getLoanStatusInfo(loan);
  const daysLeft = loan.targetDate ? _daysBetween(getTodayStr(), loan.targetDate) : null;
  const dueText = status.key === 'paid'
    ? ''
    : daysLeft === null
      ? ''
      : daysLeft >= 0
        ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
        : `${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} overdue`;

  return `
    <div onclick="openLoanDetail('${loan.id}')" class="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm cursor-pointer hover:bg-slate-50 transition space-y-2">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="text-sm font-bold text-slate-800 truncate">${loan.name}</p>
          <p class="text-[10px] text-slate-400 truncate">From ${loan.from || 'Unknown'} &bull; Taken ${loan.dateTaken}</p>
        </div>
        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${status.badge}">${status.label}</span>
      </div>
      <div class="w-full h-2 rounded-full ${status.track} overflow-hidden">
        <div class="h-full ${status.bar} rounded-full" style="width:${pct}%"></div>
      </div>
      <div class="flex items-center justify-between text-[11px]">
        <span class="text-slate-500">\u20b9${remaining.toLocaleString()} <span class="text-slate-400">left of \u20b9${Number(loan.amount).toLocaleString()}</span></span>
        ${dueText ? `<span class="font-semibold ${daysLeft < 0 ? 'text-rose-600' : 'text-slate-400'}">${dueText}</span>` : ''}
      </div>
    </div>
  `;
}

function _loansListHtml() {
  const loans = _sortedLoansForList();
  return `
    <h2 class="text-sm font-bold text-slate-800 mb-1">Loans</h2>
    <p class="text-[11px] text-slate-400 mb-3">Track money you've borrowed - from a person, a bank, anyone - and chip away at it with partial payments. Backs up to Google Drive along with the rest of your data.</p>

    <button onclick="openAddLoanForm()" class="w-full py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition mb-3">
      <i class="fa-solid fa-plus mr-1"></i> Add Loan
    </button>

    <div class="space-y-2.5">
      ${loans.length === 0 ? '<p class="text-center text-xs text-slate-400 py-10">No loans tracked yet.<br>Add one to start chipping away at it.</p>' : ''}
      ${loans.map(_loanCardHtml).join('')}
    </div>
  `;
}

function openAddLoanForm() {
  const modal = document.getElementById('formModal');
  const content = document.getElementById('formModalContent');
  modal.classList.remove('hidden');
  content.innerHTML = `
    <h3 class="text-sm font-bold text-slate-800 mb-3">Add Loan</h3>
    <form onsubmit="saveNewLoan(event)" class="space-y-3">
      <div>
        <label class="text-[11px] font-semibold text-slate-400">Loan Name</label>
        <input type="text" required id="newLoanName" placeholder="e.g. Car Loan, Dad's Loan" class="w-full text-sm p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[11px] font-semibold text-slate-400">Amount (\u20b9)</label>
          <input type="number" required step="any" min="0.01" id="newLoanAmount" class="w-full text-sm p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
        </div>
        <div>
          <label class="text-[11px] font-semibold text-slate-400">From</label>
          <input type="text" required id="newLoanFrom" placeholder="e.g. HDFC Bank, Dad" class="w-full text-sm p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[11px] font-semibold text-slate-400">Date Taken</label>
          <input type="date" required id="newLoanDateTaken" value="${getTodayStr()}" class="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500 bg-white">
        </div>
        <div>
          <label class="text-[11px] font-semibold text-slate-400">Target Clear-off Date</label>
          <input type="date" id="newLoanTargetDate" class="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500 bg-white">
        </div>
      </div>
      <p class="text-[9px] text-slate-400 -mt-1">Target date is optional - leave it blank if you're not sure yet. It's only used to flag a loan as overdue.</p>
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="closeFormModal()" class="flex-1 py-2.5 text-xs border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition">Cancel</button>
        <button type="submit" class="flex-1 py-2.5 text-xs bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">Save</button>
      </div>
    </form>
  `;
}

async function saveNewLoan(e) {
  e.preventDefault();
  const name = document.getElementById('newLoanName').value.trim();
  const amount = parseFloat(document.getElementById('newLoanAmount').value);
  const from = document.getElementById('newLoanFrom').value.trim();
  const dateTaken = document.getElementById('newLoanDateTaken').value;
  const targetDate = document.getElementById('newLoanTargetDate').value || null;

  if (!name) { await showAlert('Give this loan a name.'); return; }
  if (isNaN(amount) || amount <= 0) { await showAlert('Enter a valid loan amount.'); return; }
  if (!from) { await showAlert('Who (or where) is this loan from?'); return; }
  if (!dateTaken) { await showAlert('Pick the date the loan was taken.'); return; }
  if (targetDate && targetDate < dateTaken) { await showAlert('Target clear-off date must be on or after the date taken.'); return; }

  appData.loans.push({
    id: _loanId('loan'),
    name,
    amount,
    from,
    dateTaken,
    targetDate,
    createdAt: new Date().toISOString(),
    payments: []
  });
  saveState();
  closeFormModal();
  renderLoansPage(document.getElementById('mainContainer'));
}

// --- Detail view -----------------------------------------------------------

function _loanPaymentRowHtml(loan, payment) {
  return `
    <div class="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
      <div class="min-w-0">
        <p class="text-xs font-bold text-slate-800">\u20b9${Number(payment.amount).toLocaleString()}</p>
        <p class="text-[10px] text-slate-400 truncate">${payment.date}${payment.note ? ' &bull; ' + payment.note : ''}</p>
      </div>
      <button onclick="deleteLoanPayment('${loan.id}', '${payment.id}')" class="text-slate-300 hover:text-rose-500 transition shrink-0" title="Delete this payment">
        <i class="fa-solid fa-trash text-[11px]"></i>
      </button>
    </div>
  `;
}

function _loanDetailHtml(loan) {
  const remaining = getLoanRemaining(loan);
  const paidTotal = getLoanPaidTotal(loan);
  const pct = Number(loan.amount) > 0 ? Math.min(100, (paidTotal / Number(loan.amount)) * 100) : 0;
  const status = getLoanStatusInfo(loan);
  const payments = loan.payments.slice().sort((a, b) => b.date.localeCompare(a.date));
  const otherLoans = _sortedLoansForList();

  return `
    <div class="flex items-center gap-2 mb-3">
      <button onclick="backToLoanList()" aria-label="Back to loans" class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition">
        <i class="fa-solid fa-arrow-left"></i>
      </button>
      <select onchange="openLoanDetail(this.value)" class="flex-1 text-xs font-bold p-2 rounded-xl border border-slate-200 outline-none focus:border-blue-500 bg-white">
        ${otherLoans.map(l => `<option value="${l.id}" ${l.id === loan.id ? 'selected' : ''}>${l.name}</option>`).join('')}
      </select>
    </div>

    <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3 mb-3">
      <div class="flex items-start justify-between gap-2">
        <div>
          <p class="text-sm font-bold text-slate-800">${loan.name}</p>
          <p class="text-[11px] text-slate-400">From ${loan.from || 'Unknown'}</p>
        </div>
        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${status.badge}">${status.label}</span>
      </div>

      <div class="w-full h-2.5 rounded-full ${status.track} overflow-hidden">
        <div class="h-full ${status.bar} rounded-full" style="width:${pct}%"></div>
      </div>
      <div class="flex items-center justify-between text-[11px]">
        <span class="text-slate-500">\u20b9${paidTotal.toLocaleString()} paid</span>
        <span class="text-slate-400">of \u20b9${Number(loan.amount).toLocaleString()} principal</span>
      </div>

      <div class="grid grid-cols-2 gap-2 pt-1">
        <div class="bg-slate-50 rounded-xl p-2.5 text-center">
          <p class="text-[10px] font-bold text-slate-400 uppercase m-0">Remaining</p>
          <p class="text-sm font-extrabold text-slate-800 mt-0.5 mb-0">\u20b9${remaining.toLocaleString()}</p>
        </div>
        <div class="bg-slate-50 rounded-xl p-2.5 text-center">
          <p class="text-[10px] font-bold text-slate-400 uppercase m-0">Target Date</p>
          <p class="text-sm font-extrabold text-slate-800 mt-0.5 mb-0">${loan.targetDate || '-'}</p>
        </div>
      </div>
      <p class="text-[10px] text-slate-400">Taken on ${loan.dateTaken}</p>
    </div>

    <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2 mb-3">
      <div class="flex items-center justify-between">
        <h3 class="text-xs font-bold text-slate-800">Payments</h3>
        <button onclick="openAddLoanPaymentForm('${loan.id}')" ${remaining <= 0 ? 'disabled' : ''} class="text-[10px] font-semibold transition ${remaining <= 0 ? 'text-slate-300 cursor-not-allowed' : 'text-blue-600 hover:text-blue-700'}">+ Add Payment</button>
      </div>
      ${remaining <= 0 ? '<p class="text-[11px] text-emerald-600 font-semibold text-center py-1"><i class="fa-solid fa-circle-check mr-1"></i>Fully paid off!</p>' : ''}
      ${payments.length === 0 ? '<p class="text-[11px] text-slate-400 text-center py-2">No payments logged yet.</p>' : ''}
      <div class="space-y-1.5">
        ${payments.map(p => _loanPaymentRowHtml(loan, p)).join('')}
      </div>
    </div>

    <button onclick="deleteLoan('${loan.id}')" class="w-full py-2.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold hover:bg-rose-100 transition">
      <i class="fa-solid fa-trash mr-1"></i> Delete This Loan
    </button>
  `;
}

function openAddLoanPaymentForm(loanId) {
  const loan = appData.loans.find(l => l.id === loanId);
  if (!loan) return;
  const remaining = getLoanRemaining(loan);
  if (remaining <= 0) return;

  const modal = document.getElementById('formModal');
  const content = document.getElementById('formModalContent');
  modal.classList.remove('hidden');
  content.innerHTML = `
    <h3 class="text-sm font-bold text-slate-800 mb-1">Add Payment</h3>
    <p class="text-[11px] text-slate-400 mb-3">${loan.name} &bull; \u20b9${remaining.toLocaleString()} remaining</p>
    <form onsubmit="saveLoanPayment(event, '${loanId}')" class="space-y-3">
      <div>
        <label class="text-[11px] font-semibold text-slate-400">Amount (\u20b9)</label>
        <input type="number" required step="any" min="0.01" id="newLoanPaymentAmount" class="w-full text-sm p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
      </div>
      <div>
        <label class="text-[11px] font-semibold text-slate-400">Date</label>
        <input type="date" required id="newLoanPaymentDate" value="${getTodayStr()}" class="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500 bg-white">
      </div>
      <div>
        <label class="text-[11px] font-semibold text-slate-400">Note (optional)</label>
        <input type="text" id="newLoanPaymentNote" placeholder="e.g. EMI, part payment" class="w-full text-sm p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
      </div>
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="closeFormModal()" class="flex-1 py-2.5 text-xs border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition">Cancel</button>
        <button type="submit" class="flex-1 py-2.5 text-xs bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">Save</button>
      </div>
    </form>
  `;
}

async function saveLoanPayment(e, loanId) {
  e.preventDefault();
  const loan = appData.loans.find(l => l.id === loanId);
  if (!loan) return;

  const amount = parseFloat(document.getElementById('newLoanPaymentAmount').value);
  const date = document.getElementById('newLoanPaymentDate').value;
  const note = document.getElementById('newLoanPaymentNote').value.trim();

  if (isNaN(amount) || amount <= 0) { await showAlert('Enter a valid payment amount.'); return; }
  if (!date) { await showAlert('Pick a date for this payment.'); return; }

  // Overpaying isn't blocked outright (getLoanRemaining clamps at 0 either
  // way - see js/data-model.js), but it's worth a nudge in case it's a typo
  // rather than an intentional round-up/early payoff.
  const remaining = getLoanRemaining(loan);
  if (amount > remaining) {
    const proceed = await showConfirm(
      `You're logging \u20b9${amount.toLocaleString()}, but only \u20b9${remaining.toLocaleString()} is remaining on this loan. This will overpay it by \u20b9${(amount - remaining).toLocaleString()}.`,
      { title: 'Pay more than remaining?', tone: 'warning', confirmLabel: 'Yes, Pay Anyway', danger: false }
    );
    if (!proceed) return;
  }

  loan.payments.push({ id: _loanId('lp'), amount, date, note, createdAt: new Date().toISOString() });
  saveState();
  closeFormModal();
  renderLoansPage(document.getElementById('mainContainer'));
}

async function deleteLoanPayment(loanId, paymentId) {
  const loan = appData.loans.find(l => l.id === loanId);
  if (!loan) return;
  const confirmed = await showConfirm('Delete this payment? The amount will go back to being owed on this loan.');
  if (!confirmed) return;

  loan.payments = loan.payments.filter(p => p.id !== paymentId);
  saveState();
  renderLoansPage(document.getElementById('mainContainer'));
}

async function deleteLoan(loanId) {
  const loan = appData.loans.find(l => l.id === loanId);
  if (!loan) return;
  const confirmed = await showConfirm(`Delete "${loan.name}" and its entire payment history? This can't be undone.`);
  if (!confirmed) return;

  appData.loans = appData.loans.filter(l => l.id !== loanId);
  saveState();
  if (activeLoanId === loanId) {
    loansStep = 'list';
    activeLoanId = null;
  }
  renderLoansPage(document.getElementById('mainContainer'));
}
