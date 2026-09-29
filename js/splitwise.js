// --- Splitwise (bill splitting) --------------------------------------------
// A self-contained "who owes who" feature for group expenses (trips,
// flatmates, events). Structurally isolated from the rest of the app even
// though it now syncs to Drive:
//
//   - Its own IndexedDB store ('splitGroups', see js/idb.js) - NOT part of
//     `appData`, so saveState() and all the expense/settings-specific logic
//     in storage.js/drive-sync.js never has to know its shape. It DOES sync
//     to Google Drive, just via its own dedicated splitwise.json file
//     (uploaded/restored wholesale, same pattern as settings.json - see
//     backupToGoogleDrive/restoreFromGoogleDrive in drive-sync.js) rather
//     than being folded into the expenses/settings sync machinery.
//   - Its own full-screen overlay (#splitwiseOverlay in index.html), not a
//     tab, since it has its own two-level nested navigation (group list ->
//     group detail) that doesn't fit the app's single-level bottom nav.
//
// Each group document embeds its own members + expenses (small, capped
// dataset - max 5 groups total) so "delete a group" is one IDB.delete call
// that removes everything in it, with nothing left to orphan elsewhere -
// and so a Drive restore can just replace the WHOLE store in one shot too.

let splitGroups = [];
let activeSplitGroupId = null;
const MAX_SPLIT_GROUPS = 5;

// Splitwise groups live in their OWN IndexedDB store, entirely outside
// appData/saveState() (see the file-level comment above) - which means
// every one of storage.js's saveState() calls that normally keeps the
// Drive upload button's disabled state honest never even runs for a
// Splitwise edit. Every mutation function below calls this right after its
// IDB write, so "add a group/member/expense" enables the button live just
// like an expense or settings edit does, no refresh needed.
function _refreshDriveButtonAfterSplitwiseChange() {
  if (typeof updateDriveUploadButtonState === 'function') updateDriveUploadButtonState();
}

// Persists "is the overlay open, and on which group" across a reload -
// mirrors the LAST_TAB_STORAGE_KEY trick in data-model.js/storage.js. Lives
// here (not data-model.js) since only this file and initStorage() need it,
// and initStorage() reaches this file's own resume function directly rather
// than needing to know the key itself.
const SPLITWISE_UI_STATE_KEY = 'lifeTracker_splitwiseUiState';

function _saveSplitwiseUiState() {
  localStorage.setItem(SPLITWISE_UI_STATE_KEY, JSON.stringify({ open: true, activeGroupId: activeSplitGroupId }));
}

function _clearSplitwiseUiState() {
  localStorage.removeItem(SPLITWISE_UI_STATE_KEY);
}

// Short, collision-safe-enough id for a dataset this small (max 5 groups,
// a handful of members/expenses each) - no need for a UUID library.
function _sgId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

// Splitwise deliberately doesn't cover the real app header/nav like a
// typical full-screen overlay - it sits in the gap between them so both
// stay visible/usable. That gap's size depends on the real header/nav's
// actual rendered height (which can vary - e.g. the Drive status pill
// wrapping, or font differences across devices) so it's measured here at
// runtime rather than hardcoded, and applied as inline top/bottom styles.
function _positionSplitwiseOverlay() {
  const overlay = document.getElementById('splitwiseOverlay');
  const header = document.querySelector('header');
  const nav = document.getElementById('bottomNav');
  if (!overlay) return;
  overlay.style.top = header ? `${header.offsetHeight}px` : '0px';
  overlay.style.bottom = nav ? `${nav.offsetHeight}px` : '0px';
}

// --- Open / close / view dispatch -----------------------------------------

async function openSplitwise() {
  const overlay = document.getElementById('splitwiseOverlay');
  overlay.classList.remove('hidden');
  _positionSplitwiseOverlay();
  setAppHeaderCrumb(TAB_DISPLAY_NAMES.splitwise);
  splitGroups = await IDB.getAll('splitGroups');
  splitGroups.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  activeSplitGroupId = null;
  _saveSplitwiseUiState();
  renderSplitwiseView();
}

// Called once from initStorage() on boot (AFTER the normal tab has already
// been restored/rendered underneath) - reopens this overlay on top of it if
// the user was in the middle of using Splitwise when a reload happened, so
// "refresh while on Splitwise" lands back on Splitwise instead of Home.
async function resumeSplitwiseIfWasOpen() {
  const raw = localStorage.getItem(SPLITWISE_UI_STATE_KEY);
  if (!raw) return;

  let state;
  try {
    state = JSON.parse(raw);
  } catch (e) {
    localStorage.removeItem(SPLITWISE_UI_STATE_KEY);
    return;
  }
  if (!state || !state.open) return;

  const overlay = document.getElementById('splitwiseOverlay');
  overlay.classList.remove('hidden');
  _positionSplitwiseOverlay();
  setAppHeaderCrumb(TAB_DISPLAY_NAMES.splitwise);
  splitGroups = await IDB.getAll('splitGroups');
  splitGroups.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  // Only resume straight into a group's detail page if that group still
  // exists - it may have been deleted since the saved state was written -
  // otherwise fall back to the list view rather than rendering nothing.
  activeSplitGroupId = (state.activeGroupId && splitGroups.some(g => g.id === state.activeGroupId))
    ? state.activeGroupId
    : null;
  renderSplitwiseView();
}

function closeSplitwise() {
  document.getElementById('splitwiseOverlay').classList.add('hidden');
  _clearSplitwiseUiState();
  // Hand the header title back to whatever tab is actually showing
  // underneath - it never stopped being "current", Splitwise was just
  // sitting on top of it in the shared content area.
  setAppHeaderCrumb(TAB_DISPLAY_NAMES[currentTab]);
}

function openGroupDetail(groupId) {
  activeSplitGroupId = groupId;
  _saveSplitwiseUiState();
  renderSplitwiseView();
}

function backToGroupList() {
  activeSplitGroupId = null;
  _saveSplitwiseUiState();
  renderSplitwiseView();
}

// Single render entry point so every mutation function below just calls
// this instead of deciding for itself which view is "current".
function renderSplitwiseView() {
  const group = splitGroups.find(g => g.id === activeSplitGroupId);
  if (group) renderSplitGroupDetail(group);
  else renderSplitwiseGroupList();
}

// --- Group list view --------------------------------------------------

function renderSplitwiseGroupList() {
  document.getElementById('splitwiseSubHeader').classList.add('hidden');

  const atLimit = splitGroups.length >= MAX_SPLIT_GROUPS;
  const content = document.getElementById('splitwiseContent');
  content.innerHTML = `
    <p class="text-[11px] text-slate-400">Backs up to Google Drive along with the rest of your data (Settings → Upload/Restore). Deleting a group wipes everything in it, right here and on Drive next sync.</p>

    <button onclick="openNewGroupForm()" ${atLimit ? 'disabled' : ''} class="w-full py-2.5 rounded-xl text-xs font-bold transition ${atLimit ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}">
      <i class="fa-solid fa-plus mr-1"></i> ${atLimit ? 'Max 5 groups reached' : 'New Group'}
    </button>

    <div class="space-y-2">
      ${splitGroups.length === 0 ? '<p class="text-center text-xs text-slate-400 py-10">No split groups yet.<br>Create one for a trip, flatmates, or an event.</p>' : ''}
      ${splitGroups.map(g => {
        const total = g.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
        return `
          <div onclick="openGroupDetail('${g.id}')" class="p-3.5 rounded-xl border border-slate-100 bg-white shadow-sm flex items-center justify-between cursor-pointer hover:bg-slate-50 transition">
            <div>
              <p class="text-xs font-bold text-slate-800">${g.name}</p>
              <p class="text-[10px] text-slate-400">${g.members.length} member(s) &bull; ₹${total.toLocaleString()} logged</p>
            </div>
            <button onclick="event.stopPropagation(); deleteSplitGroup('${g.id}')" class="text-rose-500 hover:text-rose-600 px-2"><i class="fa-solid fa-trash text-xs"></i></button>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function openNewGroupForm() {
  if (splitGroups.length >= MAX_SPLIT_GROUPS) {
    alert(`You can only have ${MAX_SPLIT_GROUPS} split groups at a time. Delete one first.`);
    return;
  }
  const modal = document.getElementById('formModal');
  const content = document.getElementById('formModalContent');
  modal.classList.remove('hidden');
  content.innerHTML = `
    <h3 class="text-sm font-bold text-slate-800 mb-3">New Split Group</h3>
    <form onsubmit="saveNewSplitGroup(event)" class="space-y-3">
      <div>
        <label class="text-[11px] font-semibold text-slate-400">Group Name</label>
        <input type="text" required id="newSplitGroupName" placeholder="e.g. Goa Trip, Flatmates" class="w-full text-sm p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
      </div>
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="closeFormModal()" class="flex-1 py-2.5 text-xs border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition">Cancel</button>
        <button type="submit" class="flex-1 py-2.5 text-xs bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">Create</button>
      </div>
    </form>
  `;
}

async function saveNewSplitGroup(e) {
  e.preventDefault();
  if (splitGroups.length >= MAX_SPLIT_GROUPS) {
    alert(`You can only have ${MAX_SPLIT_GROUPS} split groups at a time. Delete one first.`);
    closeFormModal();
    return;
  }
  const name = document.getElementById('newSplitGroupName').value.trim();
  if (!name) return;

  const group = { id: _sgId('sg'), name, createdAt: new Date().toISOString(), members: [], expenses: [] };
  splitGroups.push(group);
  await IDB.put('splitGroups', group);
  _refreshDriveButtonAfterSplitwiseChange();

  closeFormModal();
  activeSplitGroupId = group.id;
  renderSplitwiseView();
}

// Deletes a group and everything embedded in it (members + expenses) - one
// IDB.delete call is all it takes since the whole group is one document.
// Called from both the list row's trash icon AND the detail view's danger
// button - same operation either way, so no need for two functions.
async function deleteSplitGroup(groupId) {
  const group = splitGroups.find(g => g.id === groupId);
  if (!group) return;
  if (!confirm(`Delete "${group.name}" and everything in it (members + expenses)? This can't be undone.`)) return;

  splitGroups = splitGroups.filter(g => g.id !== groupId);
  await IDB.delete('splitGroups', groupId);
  _refreshDriveButtonAfterSplitwiseChange();
  if (activeSplitGroupId === groupId) activeSplitGroupId = null;
  _saveSplitwiseUiState();
  renderSplitwiseView();
}

// Wipes every split group and everything embedded in them (members +
// expenses) in one shot - used by the Settings > Danger Zone "Clear All
// Expenses" button, which per its own copy promises to also nuke Splitwise
// data, not just `appData.expenses`. Deliberately a thin wrapper around
// IDB.replaceAll (same primitive Drive restore uses to replace the whole
// store) rather than looping deleteSplitGroup() one at a time - no need for
// per-group confirms here, the caller already got one confirmation covering
// everything.
async function clearAllSplitGroups() {
  await IDB.replaceAll('splitGroups', []);
  _refreshDriveButtonAfterSplitwiseChange();
  splitGroups = [];
  activeSplitGroupId = null;

  // If Splitwise happens to be open right now, refresh it in place instead
  // of leaving stale group cards on screen until the user backs out and in.
  const overlay = document.getElementById('splitwiseOverlay');
  if (overlay && !overlay.classList.contains('hidden')) {
    _saveSplitwiseUiState();
    renderSplitwiseView();
  }
}

// --- Group detail view --------------------------------------------------

// Net balance per member across every expense in the group: whoever PAID an
// expense is credited the full amount, everyone it's split among is debited
// an equal share of it. Positive = this person is owed money overall,
// negative = they owe. Purely derived from expenses each render - nothing
// cached, so there's no separate "balance" state that could drift.
function calculateSplitBalances(group) {
  const balances = {};
  group.members.forEach(m => { balances[m.id] = 0; });

  group.expenses.forEach(e => {
    const participants = e.splitAmong.filter(id => Object.prototype.hasOwnProperty.call(balances, id));
    if (participants.length === 0) return;
    const share = Number(e.amount) / participants.length;
    if (Object.prototype.hasOwnProperty.call(balances, e.paidBy)) balances[e.paidBy] += Number(e.amount);
    participants.forEach(id => { balances[id] -= share; });
  });

  return balances;
}

// Turns net balances into the SMALLEST set of "X pays Y" transactions that
// settles everyone up - the classic Splitwise "simplify debts" move.
// Without this, a group shows every member's balance in isolation ("Alice
// owes ₹300", "Bob owes ₹200", "Charlie is owed ₹500") and leaves the actual
// who-pays-who math to the humans. This greedily matches the biggest debtor
// against the biggest creditor each round, which in practice collapses most
// groups down to far fewer actual payments than there are members - e.g. 3
// people who all owe each other different amounts can often settle in just
// 1-2 transactions instead of everyone paying everyone.
function simplifySplitDebts(balances) {
  const EPSILON = 0.01;
  const creditors = [];
  const debtors = [];

  Object.entries(balances).forEach(([id, amount]) => {
    if (amount > EPSILON) creditors.push({ id, amount });
    else if (amount < -EPSILON) debtors.push({ id, amount: -amount });
  });
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transactions = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const settled = Math.min(debtor.amount, creditor.amount);
    if (settled > EPSILON) {
      transactions.push({ from: debtor.id, to: creditor.id, amount: settled });
    }
    debtor.amount -= settled;
    creditor.amount -= settled;
    if (debtor.amount <= EPSILON) i++;
    if (creditor.amount <= EPSILON) j++;
  }
  return transactions;
}

function renderSplitGroupDetail(group) {
  document.getElementById('splitwiseSubHeader').classList.remove('hidden');
  document.getElementById('splitwiseTitle').textContent = group.name;

  const balances = calculateSplitBalances(group);
  const settleUp = simplifySplitDebts(balances);
  const memberName = id => (group.members.find(m => m.id === id) || {}).name || 'Removed member';
  const canAddExpense = group.members.length >= 2;

  const content = document.getElementById('splitwiseContent');
  content.innerHTML = `
    <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2">
      <div class="flex items-center justify-between">
        <h3 class="text-xs font-bold text-slate-800">Members</h3>
        <button onclick="openAddMemberForm('${group.id}')" class="text-[10px] font-semibold text-blue-600 hover:text-blue-700">+ Add Person</button>
      </div>
      ${group.members.length === 0 ? `
        <p class="text-[11px] text-slate-400">No members yet - add people before logging expenses.</p>
      ` : `
        <div class="space-y-1.5">
          ${group.members.map(m => {
            const bal = balances[m.id] || 0;
            const balLabel = bal > 0.5
              ? `<span class="text-emerald-600 font-semibold">gets back ₹${bal.toFixed(2)}</span>`
              : bal < -0.5
                ? `<span class="text-rose-600 font-semibold">owes ₹${Math.abs(bal).toFixed(2)}</span>`
                : `<span class="text-slate-400">settled up</span>`;
            return `
              <div class="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span class="text-xs font-semibold text-slate-700">${m.name}</span>
                <div class="flex items-center gap-2">
                  <span class="text-[10px]">${balLabel}</span>
                  <button onclick="deleteSplitMember('${group.id}', '${m.id}')" class="text-slate-300 hover:text-rose-500 transition"><i class="fa-solid fa-xmark text-xs"></i></button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>

    ${group.expenses.length > 0 ? `
      <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2">
        <h3 class="text-xs font-bold text-slate-800">Settle Up <span class="font-normal text-slate-400">(simplified)</span></h3>
        ${settleUp.length === 0 ? `
          <p class="text-[11px] text-emerald-600 font-semibold text-center py-1"><i class="fa-solid fa-circle-check mr-1"></i>Everyone's settled up!</p>
        ` : `
          <div class="space-y-1.5">
            ${settleUp.map(t => `
              <div class="flex items-center gap-2 p-2 rounded-lg bg-violet-50 border border-violet-100 text-[11px]">
                <span class="font-bold text-slate-700">${memberName(t.from)}</span>
                <i class="fa-solid fa-arrow-right text-violet-400"></i>
                <span class="font-bold text-slate-700">${memberName(t.to)}</span>
                <span class="ml-auto font-bold text-violet-700">₹${t.amount.toFixed(2)}</span>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    ` : ''}

    <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2">
      <div class="flex items-center justify-between">
        <h3 class="text-xs font-bold text-slate-800">Expenses</h3>
        <button onclick="openAddSplitExpenseForm('${group.id}')" ${canAddExpense ? '' : 'disabled'} class="text-[10px] font-semibold transition ${canAddExpense ? 'text-blue-600 hover:text-blue-700' : 'text-slate-300 cursor-not-allowed'}">+ Add Expense</button>
      </div>
      ${!canAddExpense ? '<p class="text-[11px] text-slate-400">Add at least 2 people before logging an expense to split.</p>' : ''}
      ${canAddExpense && group.expenses.length === 0 ? '<p class="text-[11px] text-slate-400 text-center py-2">No expenses logged yet.</p>' : ''}
      <div class="space-y-1.5">
        ${group.expenses.slice().sort((a, b) => b.date.localeCompare(a.date)).map(e => `
          <div class="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
            <div class="flex items-center justify-between gap-2">
              <p class="text-xs font-bold text-slate-800 truncate">${e.description || 'Expense'}</p>
              <div class="flex items-center gap-2 shrink-0">
                <p class="text-xs font-bold text-slate-800">₹${Number(e.amount).toLocaleString()}</p>
                <button onclick="openEditSplitExpenseForm('${group.id}', '${e.id}')" class="text-slate-300 hover:text-blue-500 transition"><i class="fa-solid fa-pen text-[10px]"></i></button>
                <button onclick="deleteSplitExpense('${group.id}', '${e.id}')" class="text-slate-300 hover:text-rose-500 transition"><i class="fa-solid fa-trash text-[10px]"></i></button>
              </div>
            </div>
            <p class="text-[10px] text-slate-400">Paid by ${memberName(e.paidBy)} &bull; split ${e.splitAmong.length} way(s) &bull; ${e.date}</p>
          </div>
        `).join('')}
      </div>
    </div>

    <button onclick="deleteSplitGroup('${group.id}')" class="w-full py-2.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold hover:bg-rose-100 transition">
      <i class="fa-solid fa-trash mr-1"></i> Delete This Group
    </button>
  `;
}

// --- Members --------------------------------------------------------------

// When "+ New Person" is tapped from INSIDE the expense form (see
// _splitExpenseFormHtml below), we stash whatever's already been typed
// there so adding a person - or even cancelling out of the add-person form -
// brings the user straight back into a fully restored expense form, instead
// of silently discarding an in-progress entry.
let _pendingExpenseFormReturn = null;

function openAddMemberForm(groupId) {
  const modal = document.getElementById('formModal');
  const content = document.getElementById('formModalContent');
  modal.classList.remove('hidden');
  const isMidExpenseEntry = _pendingExpenseFormReturn && _pendingExpenseFormReturn.groupId === groupId;
  const cancelHandler = isMidExpenseEntry ? `cancelAddPersonFromExpenseForm('${groupId}')` : 'closeFormModal()';
  content.innerHTML = `
    <h3 class="text-sm font-bold text-slate-800 mb-3">Add Person</h3>
    <form onsubmit="saveNewSplitMember(event, '${groupId}')" class="space-y-3">
      <div>
        <label class="text-[11px] font-semibold text-slate-400">Name</label>
        <input type="text" required id="newSplitMemberName" placeholder="e.g. Priya" class="w-full text-sm p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
      </div>
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="${cancelHandler}" class="flex-1 py-2.5 text-xs border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition">Cancel</button>
        <button type="submit" class="flex-1 py-2.5 text-xs bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">Add</button>
      </div>
    </form>
  `;
}

// Bounces back to a still-in-progress expense form after cancelling out of
// the add-person detour, instead of just closing the whole modal.
function cancelAddPersonFromExpenseForm(groupId) {
  const restore = _pendingExpenseFormReturn;
  _pendingExpenseFormReturn = null;
  const group = splitGroups.find(g => g.id === groupId);
  if (!group || !restore) { closeFormModal(); return; }

  const existing = restore.expenseId ? group.expenses.find(ex => ex.id === restore.expenseId) : null;
  document.getElementById('formModalContent').innerHTML = _splitExpenseFormHtml(group, existing, restore);
}


async function saveNewSplitMember(e, groupId) {
  e.preventDefault();
  const group = splitGroups.find(g => g.id === groupId);
  if (!group) return;
  const name = document.getElementById('newSplitMemberName').value.trim();
  if (!name) return;

  const newMember = { id: _sgId('m'), name };
  group.members.push(newMember);
  await IDB.put('splitGroups', group);
  _refreshDriveButtonAfterSplitwiseChange();

  // If this person was added mid-way through filling out an expense, jump
  // straight back into that (still-filled-in) form instead of the group
  // list/detail view - and auto-check the person you JUST added so you
  // don't have to hunt for them in the split list a second time.
  if (_pendingExpenseFormReturn && _pendingExpenseFormReturn.groupId === groupId) {
    const restore = _pendingExpenseFormReturn;
    _pendingExpenseFormReturn = null;
    restore.splitAmong = [...restore.splitAmong, newMember.id];
    const existing = restore.expenseId ? group.expenses.find(ex => ex.id === restore.expenseId) : null;
    document.getElementById('formModalContent').innerHTML = _splitExpenseFormHtml(group, existing, restore);
    return;
  }

  closeFormModal();
  renderSplitwiseView();
}

// Blocks removal if the person is tied to any logged expense (as payer or
// as a split participant) instead of silently leaving expenses pointing at
// a member that no longer exists - keeps calculateSplitBalances() honest
// without needing to rewrite history.
async function deleteSplitMember(groupId, memberId) {
  const group = splitGroups.find(g => g.id === groupId);
  if (!group) return;

  const usedInExpense = group.expenses.some(e => e.paidBy === memberId || e.splitAmong.includes(memberId));
  if (usedInExpense) {
    alert("This person is tied to one or more logged expenses in this group. Delete those expenses first if you really want to remove them.");
    return;
  }

  const member = group.members.find(m => m.id === memberId);
  if (!confirm(`Remove ${member ? member.name : 'this person'} from the group?`)) return;

  group.members = group.members.filter(m => m.id !== memberId);
  await IDB.put('splitGroups', group);
  _refreshDriveButtonAfterSplitwiseChange();
  renderSplitwiseView();
}

// --- Expenses ---------------------------------------------------------

// Shared by both Add and Edit - same fields either way, just pre-filled
// differently and routed to a different onsubmit. Keeping one builder means
// a future field addition (e.g. a category) only needs to happen once.
//
// `restoreState` (shape: { description, amount, date, paidBy, splitAmong })
// takes priority over `existing` when both could supply a value - it's how
// we repaint this exact form after an "+ New Person" detour, with whatever
// the user had already typed still intact.
function _splitExpenseFormHtml(group, existing, restoreState) {
  const isEdit = !!existing;
  const prefill = restoreState || existing || {};
  const checkedIds = prefill.splitAmong || group.members.map(m => m.id);
  return `
    <h3 class="text-sm font-bold text-slate-800 mb-3">${isEdit ? 'Edit' : 'Add'} Expense - ${group.name}</h3>
    <form onsubmit="${isEdit ? `saveSplitExpense(event, '${group.id}', '${existing.id}')` : `saveSplitExpense(event, '${group.id}')`}" class="space-y-3">
      <div>
        <label class="text-[11px] font-semibold text-slate-400">Description (optional)</label>
        <input type="text" id="splitExpDesc" value="${prefill.description || ''}" placeholder="e.g. Dinner, Cab, Hotel" class="w-full text-sm p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[11px] font-semibold text-slate-400">Amount (₹)</label>
          <input type="number" required step="any" min="0.01" id="splitExpAmount" value="${prefill.amount != null ? prefill.amount : ''}" class="w-full text-sm p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
        </div>
        <div>
          <label class="text-[11px] font-semibold text-slate-400">Date</label>
          <input type="date" required id="splitExpDate" value="${prefill.date || getTodayStr()}" class="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500 bg-white">
        </div>
      </div>
      <div>
        <label class="text-[11px] font-semibold text-slate-400">Paid By</label>
        <select required id="splitExpPaidBy" class="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500 bg-white">
          ${group.members.map(m => `<option value="${m.id}" ${prefill.paidBy === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}
        </select>
      </div>
      <div>
        <div class="flex items-center justify-between">
          <label class="text-[11px] font-semibold text-slate-400">Split Equally Among</label>
          <button type="button" onclick="addPersonFromExpenseForm('${group.id}'${isEdit ? `, '${existing.id}'` : ''})" class="text-[10px] font-semibold text-blue-600 hover:text-blue-700">+ New Person</button>
        </div>
        <div class="space-y-1 mt-1 max-h-40 overflow-y-auto">
          ${group.members.map(m => `
            <label class="flex items-center gap-2 text-xs text-slate-600 p-1.5 rounded-lg hover:bg-slate-50">
              <input type="checkbox" class="splitExpMemberCheckbox" value="${m.id}" ${checkedIds.includes(m.id) ? 'checked' : ''}> ${m.name}
            </label>
          `).join('')}
        </div>
      </div>
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="closeFormModal()" class="flex-1 py-2.5 text-xs border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition">Cancel</button>
        <button type="submit" class="flex-1 py-2.5 text-xs bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">${isEdit ? 'Save Changes' : 'Save'}</button>
      </div>
    </form>
  `;
}

// Captures whatever's currently typed into the (still open) expense form,
// then hands off to the add-person flow. saveNewSplitMember() and
// cancelAddPersonFromExpenseForm() both know how to resume from this.
function addPersonFromExpenseForm(groupId, expenseId) {
  _pendingExpenseFormReturn = {
    groupId,
    expenseId: expenseId || null,
    description: document.getElementById('splitExpDesc').value,
    amount: document.getElementById('splitExpAmount').value,
    date: document.getElementById('splitExpDate').value,
    paidBy: document.getElementById('splitExpPaidBy').value,
    splitAmong: Array.from(document.querySelectorAll('.splitExpMemberCheckbox:checked')).map(cb => cb.value)
  };
  openAddMemberForm(groupId);
}

function openAddSplitExpenseForm(groupId) {
  const group = splitGroups.find(g => g.id === groupId);
  if (!group || group.members.length < 2) return;

  const modal = document.getElementById('formModal');
  const content = document.getElementById('formModalContent');
  modal.classList.remove('hidden');
  content.innerHTML = _splitExpenseFormHtml(group, null);
}

// Opens the same form pre-filled with an existing expense's values - lets
// you fix a typo'd amount, change who paid, or adjust who it's split among
// without deleting and re-creating the whole entry (which would also lose
// its original id/createdAt for no reason).
function openEditSplitExpenseForm(groupId, expenseId) {
  const group = splitGroups.find(g => g.id === groupId);
  if (!group) return;
  const expense = group.expenses.find(ex => ex.id === expenseId);
  if (!expense) return;

  const modal = document.getElementById('formModal');
  const content = document.getElementById('formModalContent');
  modal.classList.remove('hidden');
  content.innerHTML = _splitExpenseFormHtml(group, expense);
}

// Handles BOTH create and update - pass expenseId to update an existing
// entry in place (keeps its id/createdAt), omit it to push a new one.
async function saveSplitExpense(e, groupId, expenseId) {
  e.preventDefault();
  const group = splitGroups.find(g => g.id === groupId);
  if (!group) return;

  const amount = parseFloat(document.getElementById('splitExpAmount').value);
  const paidBy = document.getElementById('splitExpPaidBy').value;
  const date = document.getElementById('splitExpDate').value;
  const description = document.getElementById('splitExpDesc').value.trim();
  const splitAmong = Array.from(document.querySelectorAll('.splitExpMemberCheckbox:checked')).map(cb => cb.value);

  if (isNaN(amount) || amount <= 0) { alert('Enter a valid amount.'); return; }
  if (splitAmong.length === 0) { alert('Select at least one person to split this with.'); return; }

  if (expenseId) {
    const expense = group.expenses.find(ex => ex.id === expenseId);
    if (!expense) return;
    Object.assign(expense, { description, amount, paidBy, splitAmong, date });
  } else {
    group.expenses.push({
      id: _sgId('se'),
      description,
      amount,
      paidBy,
      splitAmong,
      date,
      createdAt: new Date().toISOString()
    });
  }
  await IDB.put('splitGroups', group);
  _refreshDriveButtonAfterSplitwiseChange();
  closeFormModal();
  renderSplitwiseView();
}

async function deleteSplitExpense(groupId, expenseId) {
  const group = splitGroups.find(g => g.id === groupId);
  if (!group) return;
  if (!confirm('Delete this expense from the group?')) return;

  group.expenses = group.expenses.filter(e => e.id !== expenseId);
  await IDB.put('splitGroups', group);
  _refreshDriveButtonAfterSplitwiseChange();
  renderSplitwiseView();
}
