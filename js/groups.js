// --- Groups (general-purpose reusable contact lists) -----------------------
// A plain "name + list of people" concept, deliberately kept independent of
// any one feature - unlike a Splitwise group (js/splitwise.js), a Group here
// has no expenses/balances of its own. Today its only consumer is
// Splitwise's "Add Person -> From a Group" tab (copy members from a Group
// into a Splitwise group instead of retyping names), but it's built as its
// own first-class page/store specifically so future features can plug into
// the SAME reusable member lists without caring about Splitwise at all.
//
// Rendered as a normal in-app page (navigate('groups') -> #mainContainer),
// same list -> detail -> back pattern as js/loans.js, not a modal and not a
// separate overlay like Splitwise needs (no nested sub-navigation here).
//
// Lives in its own IndexedDB store ('contactGroups', see js/idb.js) rather
// than appData, mirroring splitGroups - a nested members array is easiest to
// keep as one nested document, and it gets synced to Drive wholesale via its
// own groups.json file (see drive-sync.js) rather than folding into
// settings.json.

let contactGroups = [];
let groupsStep = 'list'; // 'list' | 'detail'
let activeContactGroupId = null;

function _cgId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function _refreshDriveButtonAfterGroupsChange() {
  if (typeof updateDriveUploadButtonState === 'function') updateDriveUploadButtonState();
}

// Re-reads the whole store fresh from IndexedDB - called both when this
// page itself is opened AND by splitwise.js's "From a Group" tab, since
// that tab can be reached without ever having visited the Groups page this
// session (so the in-memory array alone can't be trusted to be populated).
async function loadContactGroups() {
  contactGroups = await IDB.getAll('contactGroups');
  contactGroups.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return contactGroups;
}

// --- FAB quick-add entry point ---------------------------------------------

// Just jumps to the Groups page - does NOT auto-open the create form. The
// page's own "+ New Group" button (see _groupsListHtml below) is the one
// and only place that form gets opened from, so there's a single, obvious
// entry point instead of the FAB silently duplicating it.
function quickNewGroup() {
  navigate('groups');
}

async function renderGroupsPage(container) {
  await loadContactGroups();
  const group = activeContactGroupId ? contactGroups.find(g => g.id === activeContactGroupId) : null;
  if (groupsStep === 'detail' && group) {
    container.innerHTML = _groupDetailHtml(group);
  } else {
    groupsStep = 'list';
    activeContactGroupId = null;
    container.innerHTML = _groupsListHtml();
  }
}

function openGroupDetailPage(groupId) {
  activeContactGroupId = groupId;
  groupsStep = 'detail';
  renderGroupsPage(document.getElementById('mainContainer'));
}

function backToGroupsList() {
  groupsStep = 'list';
  activeContactGroupId = null;
  renderGroupsPage(document.getElementById('mainContainer'));
}

// --- List view --------------------------------------------------------------

function _groupsListHtml() {
  return `
    <h2 class="text-sm font-bold text-slate-800 mb-1">Groups</h2>
    <p class="text-[11px] text-slate-400 mb-3">Reusable lists of people - build one once (family, flatmates, a trip crew) and pull members from it into Splitwise or other features later, instead of retyping names every time. Backs up to Google Drive along with the rest of your data.</p>

    <button onclick="openAddGroupForm()" class="w-full py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition mb-3">
      <i class="fa-solid fa-plus mr-1"></i> New Group
    </button>

    <div class="space-y-2.5">
      ${contactGroups.length === 0 ? '<p class="text-center text-xs text-slate-400 py-10">No groups yet.<br>Create one to reuse its members anywhere in the app.</p>' : ''}
      ${contactGroups.map(g => `
        <div onclick="openGroupDetailPage('${g.id}')" class="p-3.5 rounded-xl border border-slate-100 bg-white shadow-sm flex items-center justify-between cursor-pointer hover:bg-slate-50 transition">
          <div>
            <p class="text-xs font-bold text-slate-800">${g.name}</p>
            <p class="text-[10px] text-slate-400">${g.members.length} member${g.members.length === 1 ? '' : 's'}</p>
          </div>
          <button onclick="event.stopPropagation(); deleteGroup('${g.id}')" class="text-rose-500 hover:text-rose-600 px-2"><i class="fa-solid fa-trash text-xs"></i></button>
        </div>
      `).join('')}
    </div>
  `;
}

function openAddGroupForm() {
  const modal = document.getElementById('formModal');
  const content = document.getElementById('formModalContent');
  modal.classList.remove('hidden');
  content.innerHTML = `
    <h3 class="text-sm font-bold text-slate-800 mb-3">New Group</h3>
    <form onsubmit="saveNewGroup(event)" class="space-y-3">
      <div>
        <label class="text-[11px] font-semibold text-slate-400">Group Name</label>
        <input type="text" required id="newGroupName" placeholder="e.g. Family, Flatmates, Goa Trip" class="w-full text-sm p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
      </div>
      <div>
        <div class="flex items-center justify-between">
          <label class="text-[11px] font-semibold text-slate-400">Members (optional - can add more later)</label>
          <button type="button" onclick="addNewGroupMemberRow()" class="text-[10px] font-semibold text-blue-600 hover:text-blue-700">+ Add another</button>
        </div>
        <div id="newGroupMemberRows" class="space-y-2 mt-1">
          <input type="text" class="newGroupMemberInput w-full text-sm p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500" placeholder="e.g. Priya">
        </div>
      </div>
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="closeFormModal()" class="flex-1 py-2.5 text-xs border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition">Cancel</button>
        <button type="submit" class="flex-1 py-2.5 text-xs bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">Create</button>
      </div>
    </form>
  `;
  document.getElementById('newGroupName').focus();
}

// Appends one more blank "member name" input to the New Group form - no cap
// here, a group's member list is just a plain array with no ceiling.
function addNewGroupMemberRow() {
  const container = document.getElementById('newGroupMemberRows');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'newGroupMemberInput w-full text-sm p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500';
  input.placeholder = 'e.g. Rohit';
  container.appendChild(input);
  input.focus();
}

async function saveNewGroup(e) {
  e.preventDefault();
  const name = document.getElementById('newGroupName').value.trim();
  if (!name) return;

  // Blank rows (the form always starts with one, and "+ Add another" can
  // leave trailing empties) are silently dropped - members here are
  // explicitly optional, per the form's own label.
  const members = Array.from(document.querySelectorAll('.newGroupMemberInput'))
    .map(input => input.value.trim())
    .filter(Boolean)
    .map(memberName => ({ id: _cgId('m'), name: memberName }));

  const group = { id: _cgId('grp'), name, createdAt: new Date().toISOString(), members };
  contactGroups.push(group);
  await IDB.put('contactGroups', group);
  _refreshDriveButtonAfterGroupsChange();

  closeFormModal();
  activeContactGroupId = group.id;
  groupsStep = 'detail';
  renderGroupsPage(document.getElementById('mainContainer'));
}

async function deleteGroup(groupId) {
  const group = contactGroups.find(g => g.id === groupId);
  if (!group) return;
  if (!(await showConfirm(`Delete "${group.name}" and its member list? This can't be undone. (Anyone already copied into a Splitwise group stays there - this only removes the reusable Group itself.)`))) return;

  contactGroups = contactGroups.filter(g => g.id !== groupId);
  await IDB.delete('contactGroups', groupId);
  _refreshDriveButtonAfterGroupsChange();
  if (activeContactGroupId === groupId) { groupsStep = 'list'; activeContactGroupId = null; }
  renderGroupsPage(document.getElementById('mainContainer'));
}

// --- Detail view --------------------------------------------------------

function _groupDetailHtml(group) {
  return `
    <div class="flex items-center gap-2 mb-3">
      <button onclick="backToGroupsList()" aria-label="Back to groups" class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition">
        <i class="fa-solid fa-arrow-left"></i>
      </button>
      <select onchange="openGroupDetailPage(this.value)" class="flex-1 text-xs font-bold p-2 rounded-xl border border-slate-200 outline-none focus:border-blue-500 bg-white">
        ${contactGroups.map(g => `<option value="${g.id}" ${g.id === group.id ? 'selected' : ''}>${g.name}</option>`).join('')}
      </select>
    </div>

    <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2 mb-3">
      <div class="flex items-center justify-between">
        <h3 class="text-xs font-bold text-slate-800">Members</h3>
        <button onclick="openAddGroupMemberForm('${group.id}')" class="text-[10px] font-semibold text-blue-600 hover:text-blue-700">+ Add Person</button>
      </div>
      ${group.members.length === 0 ? `
        <p class="text-[11px] text-slate-400">No members yet - add people so they're ready to pull into Splitwise (or any future feature) later.</p>
      ` : `
        <div class="space-y-1.5">
          ${group.members.map(m => `
            <div class="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span class="text-xs font-semibold text-slate-700">${m.name}</span>
              <button onclick="deleteGroupMember('${group.id}', '${m.id}')" class="text-slate-300 hover:text-rose-500 transition"><i class="fa-solid fa-xmark text-xs"></i></button>
            </div>
          `).join('')}
        </div>
      `}
    </div>

    <button onclick="deleteGroup('${group.id}')" class="w-full py-2.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold hover:bg-rose-100 transition">
      <i class="fa-solid fa-trash mr-1"></i> Delete This Group
    </button>
  `;
}

function openAddGroupMemberForm(groupId) {
  const modal = document.getElementById('formModal');
  const content = document.getElementById('formModalContent');
  modal.classList.remove('hidden');
  content.innerHTML = `
    <h3 class="text-sm font-bold text-slate-800 mb-3">Add Person</h3>
    <form onsubmit="saveNewGroupMember(event, '${groupId}')" class="space-y-3">
      <div>
        <label class="text-[11px] font-semibold text-slate-400">Name</label>
        <input type="text" required id="newGroupMemberName" placeholder="e.g. Priya" class="w-full text-sm p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500">
      </div>
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="closeFormModal()" class="flex-1 py-2.5 text-xs border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition">Cancel</button>
        <button type="submit" class="flex-1 py-2.5 text-xs bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">Add</button>
      </div>
    </form>
  `;
  document.getElementById('newGroupMemberName').focus();
}

async function saveNewGroupMember(e, groupId) {
  e.preventDefault();
  const group = contactGroups.find(g => g.id === groupId);
  if (!group) return;
  const name = document.getElementById('newGroupMemberName').value.trim();
  if (!name) return;

  group.members.push({ id: _cgId('m'), name });
  await IDB.put('contactGroups', group);
  _refreshDriveButtonAfterGroupsChange();

  closeFormModal();
  renderGroupsPage(document.getElementById('mainContainer'));
}

async function deleteGroupMember(groupId, memberId) {
  const group = contactGroups.find(g => g.id === groupId);
  if (!group) return;
  const member = group.members.find(m => m.id === memberId);
  if (!(await showConfirm(`Remove ${member ? member.name : 'this person'} from the group?`))) return;

  group.members = group.members.filter(m => m.id !== memberId);
  await IDB.put('contactGroups', group);
  _refreshDriveButtonAfterGroupsChange();
  renderGroupsPage(document.getElementById('mainContainer'));
}

