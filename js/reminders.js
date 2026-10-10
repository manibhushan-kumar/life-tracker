// --- Reminders & Notifications Manager --------------------------------------
// Full-page view manager (like Splitwise / Loans) for creating, listing,
// viewing details, modifying, toggling, and deleting repeating notifications.
// Works seamlessly in both environments:
// 1. Android Native (Capacitor LocalNotifications): Uses native AlarmManager so
//    notifications fire even when the app is COMPLETELY CLOSED.
// 2. Browser / PWA: Uses Web Notification API & background timers with live testing.

const REMINDERS_LIST_STORAGE_KEY = 'lifeTracker_reminders_list';
let _browserTimers = {}; // { reminderId: intervalId }

// View step state: 'list' | 'form' (same pattern as loans.js / splitwise.js)
let reminderViewStep = 'list';
let activeReminderEditId = null;

// Default sample reminder seeded on first visit if none exists
const SEED_REMINDERS = [
  {
    id: 'rem_default_1',
    title: 'Daily Expense Check-in',
    message: "Take a moment to record today's expenses and receipts!",
    enabled: true,
    intervalType: 'preset',
    presetInterval: '1hour',
    customMinutes: 60,
    dailyTime: '20:00',
    createdAt: new Date().toISOString(),
    lastTriggered: null
  }
];

// Returns all reminders
function getRemindersList() {
  try {
    if (typeof appData !== 'undefined' && Array.isArray(appData.reminders) && appData.reminders.length > 0) {
      return appData.reminders;
    }
    const raw = localStorage.getItem(REMINDERS_LIST_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (typeof appData !== 'undefined') appData.reminders = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to parse reminders list:', err);
  }

  // Fallback to seed list if nothing exists yet
  saveRemindersList(SEED_REMINDERS);
  return SEED_REMINDERS;
}

// Saves reminders list to localStorage and appData
function saveRemindersList(list) {
  try {
    localStorage.setItem(REMINDERS_LIST_STORAGE_KEY, JSON.stringify(list));
    if (typeof appData !== 'undefined') {
      appData.reminders = list;
      if (typeof saveState === 'function') saveState();
    }
  } catch (err) {
    console.error('Failed to save reminders list:', err);
  }
  applyAllReminderSchedules();
}

// Check if running inside Capacitor native shell
function isCapacitorNative() {
  return typeof window.Capacitor !== 'undefined' &&
         typeof window.Capacitor.isNativePlatform === 'function' &&
         window.Capacitor.isNativePlatform();
}

// Generates numeric ID from string ID (needed for Capacitor LocalNotifications integer IDs)
function numericNotificationId(strId) {
  let hash = 0;
  for (let i = 0; i < strId.length; i++) {
    hash = ((hash << 5) - hash) + strId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 100000) + 1000;
}

// Converts interval settings into human-readable label
function getReminderIntervalDisplay(reminder) {
  if (reminder.intervalType === 'daily') {
    const time = reminder.dailyTime || '20:00';
    return `📅 Daily at ${formatTimeDisplay(time)}`;
  }
  if (reminder.intervalType === 'custom') {
    const mins = Number(reminder.customMinutes) || 60;
    return mins >= 60 ? `⏱️ Every ${Math.round(mins / 60)} hr` : `⏱️ Every ${mins} min`;
  }
  const presetMap = {
    '1min': '⚡ Every 1 min (Test)',
    '15min': '⏱️ Every 15 min',
    '30min': '⏱️ Every 30 min',
    '1hour': '🔔 Every 1 hr',
    '2hours': '🔔 Every 2 hrs',
    '4hours': '🔔 Every 4 hrs',
    '8hours': '🔔 Every 8 hrs',
    '12hours': '🔔 Every 12 hrs'
  };
  return presetMap[reminder.presetInterval] || '🔔 Every 1 hr';
}

function formatTimeDisplay(time24) {
  if (!time24) return '20:00';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

// Converts interval settings to milliseconds
function getIntervalMsFromReminder(reminder) {
  if (reminder.intervalType === 'custom') {
    const mins = Math.max(1, Number(reminder.customMinutes) || 60);
    return mins * 60 * 1000;
  }
  const presetMap = {
    '1min': 60 * 1000,
    '15min': 15 * 60 * 1000,
    '30min': 30 * 60 * 1000,
    '1hour': 60 * 60 * 1000,
    '2hours': 2 * 60 * 60 * 1000,
    '4hours': 4 * 60 * 60 * 1000,
    '8hours': 8 * 60 * 60 * 1000,
    '12hours': 12 * 60 * 60 * 1000
  };
  return presetMap[reminder.presetInterval] || (60 * 60 * 1000);
}

// Requests notification permissions
async function requestReminderPermission() {
  if (isCapacitorNative() && window.Capacitor?.Plugins?.LocalNotifications) {
    try {
      const perm = await window.Capacitor.Plugins.LocalNotifications.requestPermissions();
      return perm.display === 'granted';
    } catch (e) {
      console.error('Capacitor permission error:', e);
      return false;
    }
  }

  if ('Notification' in window) {
    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  return false;
}

// Dispatches an immediate test or scheduled notification
async function triggerNotificationNow(title, message, isTest = false, reminderId = null) {
  const displayTitle = (isTest ? '[Test] ' : '') + (title || 'Life Tracker');
  const displayBody = message || "Notification alert from Life Tracker";

  // 1. Native Capacitor Local Notifications
  if (isCapacitorNative() && window.Capacitor?.Plugins?.LocalNotifications) {
    try {
      await window.Capacitor.Plugins.LocalNotifications.schedule({
        notifications: [
          {
            id: isTest ? 99999 : (reminderId ? numericNotificationId(reminderId) : 1001),
            title: displayTitle,
            body: displayBody,
            schedule: { at: new Date(Date.now() + 500) },
            sound: 'default',
            smallIcon: 'ic_stat_icon',
            iconColor: '#2563eb'
          }
        ]
      });
      return true;
    } catch (err) {
      console.error('Native notification trigger failed:', err);
    }
  }

  // 2. Service Worker showNotification
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration && registration.showNotification) {
        await registration.showNotification(displayTitle, {
          body: displayBody,
          icon: './icons/icon-192.png',
          badge: './icons/icon-192.png',
          vibrate: [100, 50, 100],
          tag: reminderId ? `rem_${reminderId}` : 'life-tracker-alert',
          renotify: true
        });
        if (reminderId) markReminderTriggered(reminderId);
        return true;
      }
    } catch (err) {
      console.warn('Service worker notification failed:', err);
    }
  }

  // 3. Web Notification API fallback
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(displayTitle, {
        body: displayBody,
        icon: './icons/icon-192.png'
      });
      if (reminderId) markReminderTriggered(reminderId);
      return true;
    } catch (err) {
      console.error('Web notification failed:', err);
    }
  }

  return false;
}

// Updates lastTriggered timestamp on reminder
function markReminderTriggered(reminderId) {
  const list = getRemindersList();
  const item = list.find(r => r.id === reminderId);
  if (item) {
    item.lastTriggered = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    try {
      localStorage.setItem(REMINDERS_LIST_STORAGE_KEY, JSON.stringify(list));
      if (typeof appData !== 'undefined') appData.reminders = list;
    } catch (e) {}
    const tsEl = document.getElementById(`lastTriggered-${reminderId}`);
    if (tsEl) tsEl.textContent = `Last sent: ${item.lastTriggered}`;
  }
}

// Cancels and reschedules all active reminders
async function applyAllReminderSchedules() {
  const list = getRemindersList();

  // 1. Clear all browser interval timers
  Object.keys(_browserTimers).forEach(id => {
    clearInterval(_browserTimers[id]);
  });
  _browserTimers = {};

  // 2. Clear native Capacitor notifications if running native
  if (isCapacitorNative() && window.Capacitor?.Plugins?.LocalNotifications) {
    try {
      const pending = await window.Capacitor.Plugins.LocalNotifications.getPending();
      if (pending && pending.notifications && pending.notifications.length > 0) {
        await window.Capacitor.Plugins.LocalNotifications.cancel({
          notifications: pending.notifications.map(n => ({ id: n.id }))
        });
      }
    } catch (e) {
      console.warn('Could not cancel native pending notifications:', e);
    }
  }

  // 3. Reschedule all enabled reminders
  const enabledReminders = list.filter(r => r.enabled);
  if (enabledReminders.length === 0) return;

  // Native Android Scheduling
  if (isCapacitorNative() && window.Capacitor?.Plugins?.LocalNotifications) {
    for (const rem of enabledReminders) {
      try {
        let scheduleConfig = { allowWhileIdle: true };
        if (rem.intervalType === 'daily') {
          const [hour, minute] = (rem.dailyTime || '20:00').split(':').map(Number);
          scheduleConfig.on = { hour, minute };
        } else if (rem.intervalType === 'custom') {
          const mins = Math.max(1, Number(rem.customMinutes) || 60);
          scheduleConfig.every = mins >= 60 ? 'hour' : 'minute';
          scheduleConfig.count = mins >= 60 ? Math.floor(mins / 60) : mins;
        } else {
          if (rem.presetInterval === '1min') scheduleConfig.every = 'minute';
          else if (rem.presetInterval === '15min') { scheduleConfig.every = 'minute'; scheduleConfig.count = 15; }
          else if (rem.presetInterval === '30min') { scheduleConfig.every = 'minute'; scheduleConfig.count = 30; }
          else if (rem.presetInterval === '1hour') scheduleConfig.every = 'hour';
          else if (rem.presetInterval === '2hours') { scheduleConfig.every = 'hour'; scheduleConfig.count = 2; }
          else if (rem.presetInterval === '4hours') { scheduleConfig.every = 'hour'; scheduleConfig.count = 4; }
          else if (rem.presetInterval === '8hours') { scheduleConfig.every = 'hour'; scheduleConfig.count = 8; }
          else scheduleConfig.every = 'hour';
        }

        await window.Capacitor.Plugins.LocalNotifications.schedule({
          notifications: [
            {
              id: numericNotificationId(rem.id),
              title: rem.title || 'Life Tracker',
              body: rem.message || "Notification reminder",
              schedule: scheduleConfig,
              sound: 'default',
              smallIcon: 'ic_stat_icon',
              iconColor: '#2563eb'
            }
          ]
        });
      } catch (err) {
        console.error('Failed to schedule native reminder:', rem.id, err);
      }
    }
    return;
  }

  // Browser / PWA Scheduling
  enabledReminders.forEach(rem => {
    const intervalMs = getIntervalMsFromReminder(rem);
    _browserTimers[rem.id] = setInterval(() => {
      triggerNotificationNow(rem.title, rem.message, false, rem.id);
    }, intervalMs);
  });
}

// Toggle enabled status directly from the list
async function toggleReminderStatus(id, enable) {
  if (enable) {
    const granted = await requestReminderPermission();
    if (!granted) {
      alert('Please allow notification permissions in your browser or device settings.');
      const cb = document.getElementById(`toggle-cb-${id}`);
      if (cb) cb.checked = false;
      return;
    }
  }

  const list = getRemindersList();
  const item = list.find(r => r.id === id);
  if (item) {
    item.enabled = enable;
    saveRemindersList(list);
    const container = document.getElementById('mainContainer');
    if (container && typeof currentTab !== 'undefined' && currentTab === 'reminders') {
      renderRemindersPage(container);
    }
  }
}

// Delete reminder from list
function deleteReminderItem(id, event) {
  if (event) event.stopPropagation();
  const list = getRemindersList();
  const item = list.find(r => r.id === id);
  const title = item ? item.title : 'this reminder';

  if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

  const updated = list.filter(r => r.id !== id);
  saveRemindersList(updated);

  const container = document.getElementById('mainContainer');
  if (container && typeof currentTab !== 'undefined' && currentTab === 'reminders') {
    renderRemindersPage(container);
  }
}

// Test specific reminder
async function testReminderItem(id, event) {
  if (event) event.stopPropagation();
  const list = getRemindersList();
  const item = list.find(r => r.id === id);
  if (!item) return;

  const granted = await requestReminderPermission();
  if (!granted) {
    alert('Notification permissions are required. Please grant permission in your browser/device settings.');
    return;
  }

  const success = await triggerNotificationNow(item.title, item.message, true, item.id);
  if (success) {
    if (typeof showToast === 'function') {
      showToast('Test notification sent!');
    } else {
      alert(`Test notification sent for "${item.title}"!`);
    }
  }
}

// --- Navigation / Step Controls (Full page, no popup modal) ---

function openReminderForm(editId = null) {
  activeReminderEditId = editId;
  reminderViewStep = 'form';
  const container = document.getElementById('mainContainer');
  if (container) {
    renderRemindersPage(container);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function backToRemindersList() {
  activeReminderEditId = null;
  reminderViewStep = 'list';
  const container = document.getElementById('mainContainer');
  if (container) {
    renderRemindersPage(container);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// --- Main Page Render Entrypoint ---
function renderRemindersPage(container) {
  if (reminderViewStep === 'form') {
    container.innerHTML = renderReminderFormView();
  } else {
    container.innerHTML = renderRemindersListView();
  }
}

// --- List View (Full page screen) ---
function renderRemindersListView() {
  const list = getRemindersList();
  const isNative = isCapacitorNative();
  const activeCount = list.filter(r => r.enabled).length;

  return `
    <div class="space-y-4 max-w-lg mx-auto pb-10">

      <!-- Header Banner -->
      <div class="bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-700 rounded-2xl p-5 text-white shadow-lg shadow-indigo-500/20 relative overflow-hidden">
        <div class="absolute -right-4 -bottom-4 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white text-lg shadow-inner">
              <i class="fa-solid fa-bell"></i>
            </div>
            <div>
              <h2 class="text-base font-bold leading-tight">Reminders & Alerts</h2>
              <p class="text-[11px] text-blue-100 mt-0.5">${activeCount} active &bull; ${list.length} total</p>
            </div>
          </div>
          <button onclick="openReminderForm()" class="px-3.5 py-2 rounded-xl bg-white text-indigo-700 hover:bg-blue-50 font-bold text-xs shadow-sm flex items-center gap-1.5 transition active:scale-95">
            <i class="fa-solid fa-plus text-[11px]"></i>
            <span>New Alert</span>
          </button>
        </div>

        <!-- Platform Status Pill -->
        <div class="mt-4 pt-3 border-t border-white/15 flex items-start gap-2.5 text-[11px] leading-relaxed text-blue-100">
          <i class="fa-solid ${isNative ? 'fa-mobile-screen-button' : 'fa-globe'} mt-0.5 text-xs text-white"></i>
          <div>
            ${
              isNative
                ? '<strong class="text-white">Android Native:</strong> Scheduled in Android AlarmManager. Fires even when app is closed.'
                : '<strong class="text-white">Browser/PWA:</strong> Active while tab is open. In Android APK, alarms run 24/7 even when closed!'
            }
          </div>
        </div>
      </div>

      <!-- Reminders List -->
      <div class="space-y-3">
        <div class="flex items-center justify-between px-1">
          <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">All Notifications (${list.length})</h3>
          <span class="text-[10px] text-slate-400">Tap to edit details</span>
        </div>

        ${list.length === 0 ? renderEmptyRemindersState() : list.map(r => renderReminderCard(r)).join('')}
      </div>

      <!-- Quick Action / Add Button -->
      ${list.length > 0 ? `
        <button onclick="openReminderForm()" class="w-full py-3.5 px-4 rounded-xl border-2 border-dashed border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-indigo-600 font-bold text-xs flex items-center justify-center gap-2 transition">
          <i class="fa-solid fa-plus text-xs"></i>
          <span>Create Another Notification</span>
        </button>
      ` : ''}

    </div>
  `;
}

// Card Renderer for list view
function renderReminderCard(rem) {
  const intervalDisplay = getReminderIntervalDisplay(rem);
  return `
    <div onclick="openReminderForm('${rem.id}')"
      class="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm hover:border-indigo-300 hover:shadow-md transition cursor-pointer relative group">
      
      <div class="flex items-start justify-between gap-3">
        
        <!-- Left: Status Indicator & Content -->
        <div class="flex items-start gap-3 min-w-0 flex-1">
          <div class="w-9 h-9 rounded-xl ${rem.enabled ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'} flex items-center justify-center shrink-0 mt-0.5 transition">
            <i class="fa-solid fa-bell text-sm"></i>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <h4 class="text-xs font-bold text-slate-800 leading-snug truncate">${_esc(rem.title || 'Life Tracker')}</h4>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                rem.enabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
              }">
                ${rem.enabled ? '● Active' : '○ Off'}
              </span>
            </div>

            <!-- Message Preview -->
            <p class="text-[11px] text-slate-600 line-clamp-2 mt-1 leading-relaxed">${_esc(rem.message || '')}</p>

            <!-- Bottom Metadata: Frequency Chip & Last sent -->
            <div class="flex items-center gap-2 mt-2 flex-wrap text-[10px] text-slate-400">
              <span class="inline-flex items-center gap-1 font-bold text-indigo-600 bg-indigo-50/80 px-2 py-0.5 rounded-md">
                ${intervalDisplay}
              </span>
              ${rem.lastTriggered ? `<span id="lastTriggered-${rem.id}" class="truncate">&bull; Last sent: ${rem.lastTriggered}</span>` : ''}
            </div>
          </div>
        </div>

        <!-- Right: Actions (Toggle, Test, Delete) -->
        <div class="flex items-center gap-2 shrink-0 pt-0.5" onclick="event.stopPropagation()">
          
          <!-- Test Button -->
          <button onclick="testReminderItem('${rem.id}', event)" title="Test this notification now"
            class="w-7 h-7 rounded-lg border border-slate-200 bg-slate-50 hover:bg-amber-50 hover:border-amber-200 text-slate-500 hover:text-amber-600 flex items-center justify-center transition active:scale-95">
            <i class="fa-solid fa-bolt text-[11px]"></i>
          </button>

          <!-- Delete Button -->
          <button onclick="deleteReminderItem('${rem.id}', event)" title="Delete notification"
            class="w-7 h-7 rounded-lg border border-slate-200 bg-slate-50 hover:bg-rose-50 hover:border-rose-200 text-slate-500 hover:text-rose-600 flex items-center justify-center transition active:scale-95">
            <i class="fa-solid fa-trash text-[11px]"></i>
          </button>

          <!-- Enable/Disable Toggle -->
          <label class="relative inline-flex items-center cursor-pointer ml-1">
            <input type="checkbox" id="toggle-cb-${rem.id}" class="sr-only peer" ${rem.enabled ? 'checked' : ''}
              onchange="toggleReminderStatus('${rem.id}', this.checked)">
            <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>

        </div>

      </div>

    </div>
  `;
}

// Empty state renderer
function renderEmptyRemindersState() {
  return `
    <div class="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-3">
      <div class="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto text-2xl">
        <i class="fa-regular fa-bell"></i>
      </div>
      <div>
        <h4 class="text-sm font-bold text-slate-800">No Reminders Yet</h4>
        <p class="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Set up repeating notifications with custom messages to alert you throughout the day.</p>
      </div>
      <button onclick="openReminderForm()" class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm shadow-indigo-500/20 inline-flex items-center gap-2 transition">
        <i class="fa-solid fa-plus text-xs"></i>
        <span>Create Reminder</span>
      </button>
    </div>
  `;
}

// --- Detail & Edit View (Full in-page view like Splitwise / Loans) ---
function renderReminderFormView() {
  const list = getRemindersList();
  const existing = activeReminderEditId ? list.find(r => r.id === activeReminderEditId) : null;
  const isEditing = Boolean(existing);

  const initial = existing || {
    id: null,
    title: 'Life Tracker',
    message: "Don't forget to track today's expenses and check your dues!",
    enabled: true,
    intervalType: 'preset',
    presetInterval: '1hour',
    customMinutes: 60,
    dailyTime: '20:00'
  };

  return `
    <div class="space-y-4 max-w-lg mx-auto pb-12">
      
      <!-- Top Navigation Bar: Back to Reminders -->
      <div class="flex items-center justify-between pb-2 border-b border-slate-200/80">
        <button onclick="backToRemindersList()" class="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-xl bg-slate-100/80 hover:bg-slate-200 transition active:scale-95">
          <i class="fa-solid fa-arrow-left text-xs"></i>
          <span>Back to Reminders</span>
        </button>
        <span class="text-xs font-bold text-slate-800">${isEditing ? 'Edit Alert Details' : 'New Alert'}</span>
      </div>

      <!-- Hidden ID -->
      <input type="hidden" id="formReminderId" value="${isEditing ? existing.id : ''}">

      <!-- Title & Message Card -->
      <div class="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wider">Alert Content</h3>
          <span class="text-[10px] text-slate-400">Custom text</span>
        </div>

        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Notification Title</label>
          <input type="text" id="formReminderTitle" value="${_escAttr(initial.title || 'Life Tracker')}"
            placeholder="e.g. Life Tracker"
            class="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            oninput="updatePageFormPreview()">
        </div>

        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Message Body</label>
          <textarea id="formReminderMessage" rows="2"
            placeholder="What should this reminder say?"
            class="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition resize-none"
            oninput="updatePageFormPreview()">${_esc(initial.message || '')}</textarea>
        </div>

        <!-- Quick Suggestions -->
        <div>
          <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Quick Suggestions</p>
          <div class="flex flex-wrap gap-1.5">
            <button type="button" onclick="setPageFormQuickText('Expense Tracker', 'Log your recent expenses and receipts!')"
              class="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-100 text-[10px] font-medium text-slate-600 transition">
              💰 Log Expenses
            </button>
            <button type="button" onclick="setPageFormQuickText('Bill Due Date', 'Check upcoming bills, EMI, and subscription renewals!')"
              class="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-100 text-[10px] font-medium text-slate-600 transition">
              🧾 Check Bills
            </button>
            <button type="button" onclick="setPageFormQuickText('Daily Review', 'Review today\\'s budget and progress.')"
              class="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-100 text-[10px] font-medium text-slate-600 transition">
              📊 Daily Wrap-up
            </button>
            <button type="button" onclick="setPageFormQuickText('Habit & Water', 'Drink some water and take a quick moment to update Life Tracker.')"
              class="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-100 text-[10px] font-medium text-slate-600 transition">
              💧 Hydrate & Habit
            </button>
          </div>
        </div>
      </div>

      <!-- Frequency & Interval Card -->
      <div class="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wider">Interval & Frequency</h3>
          <span class="text-[10px] text-slate-400">How often to trigger</span>
        </div>

        <div class="grid grid-cols-2 gap-2">
          ${renderPageFormIntervalOption('1min', '⚡ Every 1 Min (Test)', initial.presetInterval === '1min' && initial.intervalType === 'preset')}
          ${renderPageFormIntervalOption('15min', '⏱️ Every 15 Min', initial.presetInterval === '15min' && initial.intervalType === 'preset')}
          ${renderPageFormIntervalOption('30min', '⏱️ Every 30 Min', initial.presetInterval === '30min' && initial.intervalType === 'preset')}
          ${renderPageFormIntervalOption('1hour', '🔔 Every 1 Hour', initial.presetInterval === '1hour' && initial.intervalType === 'preset')}
          ${renderPageFormIntervalOption('2hours', '🔔 Every 2 Hours', initial.presetInterval === '2hours' && initial.intervalType === 'preset')}
          ${renderPageFormIntervalOption('4hours', '🔔 Every 4 Hours', initial.presetInterval === '4hours' && initial.intervalType === 'preset')}
          ${renderPageFormIntervalOption('daily', '📅 Daily at specific time', initial.intervalType === 'daily')}
          ${renderPageFormIntervalOption('custom', '⚙️ Custom Minutes', initial.intervalType === 'custom')}
        </div>

        <!-- Daily Time Picker -->
        <div id="pageDailyTimeRow" class="${initial.intervalType === 'daily' ? '' : 'hidden'} pt-2.5 border-t border-slate-100 flex items-center justify-between">
          <label class="text-[11px] font-semibold text-slate-600">Daily Trigger Time:</label>
          <input type="time" id="pageDailyTimeInput" value="${initial.dailyTime || '20:00'}"
            class="px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
        </div>

        <!-- Custom Minutes Input -->
        <div id="pageCustomMinutesRow" class="${initial.intervalType === 'custom' ? '' : 'hidden'} pt-2.5 border-t border-slate-100 flex items-center justify-between">
          <label class="text-[11px] font-semibold text-slate-600">Repeat Every (Minutes):</label>
          <input type="number" id="pageCustomMinutesInput" value="${initial.customMinutes || 60}" min="1" max="1440"
            class="w-28 px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
        </div>
      </div>

      <!-- Active Toggle Switch Card -->
      <div class="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div>
          <p class="text-xs font-bold text-slate-800">Enable Alert Immediately</p>
          <p class="text-[10px] text-slate-400">Keep active on schedule</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" id="pageEnableToggle" class="sr-only peer" ${initial.enabled ? 'checked' : ''}>
          <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
        </label>
      </div>

      <!-- Live Notification Preview Card -->
      <div class="bg-slate-100/90 rounded-2xl p-4 border border-slate-200 space-y-2">
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <i class="fa-brands fa-android text-emerald-600"></i>
          <span>Live Notification Preview</span>
        </p>
        <div class="bg-white rounded-xl p-3 border border-slate-200 shadow-sm flex items-start gap-3">
          <div class="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
            <i class="fa-solid fa-layer-group text-xs"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between text-[10px] text-slate-400">
              <span class="font-bold text-slate-500 uppercase">Life Tracker</span>
              <span>now</span>
            </div>
            <p id="pagePreviewTitle" class="text-xs font-bold text-slate-800 truncate mt-0.5">${_esc(initial.title || 'Life Tracker')}</p>
            <p id="pagePreviewMessage" class="text-[11px] text-slate-600 line-clamp-2 mt-0.5">${_esc(initial.message || '')}</p>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2 pt-2">
        ${isEditing ? `
          <button type="button" onclick="deleteFromPageForm('${existing.id}')"
            class="py-3 px-4 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold flex items-center gap-1.5 transition active:scale-95">
            <i class="fa-solid fa-trash text-xs"></i>
            <span>Delete</span>
          </button>
        ` : ''}

        <button type="button" onclick="testFromPageForm()"
          class="py-3 px-4 rounded-xl border border-slate-200 bg-white hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition active:scale-95">
          <i class="fa-solid fa-bolt text-xs text-amber-500"></i>
          <span>Test Now</span>
        </button>

        <button type="button" onclick="saveReminderFromPageForm()"
          class="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 transition active:scale-[0.98]">
          <i class="fa-solid fa-floppy-disk text-xs"></i>
          <span>${isEditing ? 'Save Changes' : 'Create Alert'}</span>
        </button>
      </div>

    </div>
  `;
}

function renderPageFormIntervalOption(id, label, isSelected) {
  return `
    <button type="button" onclick="selectPageFormIntervalOption('${id}')" id="page-opt-${id}"
      class="page-interval-btn p-2.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition ${
        isSelected ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100'
      }">
      <span class="truncate">${label}</span>
      <i class="fa-solid fa-circle-check text-xs ${isSelected ? 'text-indigo-600' : 'hidden'} check-icon"></i>
    </button>
  `;
}

function selectPageFormIntervalOption(id) {
  document.querySelectorAll('.page-interval-btn').forEach(btn => {
    btn.classList.remove('bg-indigo-50', 'border-indigo-500', 'text-indigo-700', 'shadow-sm');
    btn.classList.add('bg-slate-50', 'border-slate-100', 'text-slate-700');
    const check = btn.querySelector('.check-icon');
    if (check) check.classList.add('hidden');
  });

  const selectedBtn = document.getElementById(`page-opt-${id}`);
  if (selectedBtn) {
    selectedBtn.classList.add('bg-indigo-50', 'border-indigo-500', 'text-indigo-700', 'shadow-sm');
    selectedBtn.classList.remove('bg-slate-50', 'border-slate-100', 'text-slate-700');
    const check = selectedBtn.querySelector('.check-icon');
    if (check) check.classList.remove('hidden');
  }

  const dailyRow = document.getElementById('pageDailyTimeRow');
  const customRow = document.getElementById('pageCustomMinutesRow');

  if (id === 'daily') {
    if (dailyRow) dailyRow.classList.remove('hidden');
    if (customRow) customRow.classList.add('hidden');
  } else if (id === 'custom') {
    if (dailyRow) dailyRow.classList.add('hidden');
    if (customRow) customRow.classList.remove('hidden');
  } else {
    if (dailyRow) dailyRow.classList.add('hidden');
    if (customRow) customRow.classList.add('hidden');
  }
}

function setPageFormQuickText(title, msg) {
  const tInput = document.getElementById('formReminderTitle');
  const mInput = document.getElementById('formReminderMessage');
  if (tInput) tInput.value = title;
  if (mInput) mInput.value = msg;
  updatePageFormPreview();
}

function updatePageFormPreview() {
  const tInput = document.getElementById('formReminderTitle');
  const mInput = document.getElementById('formReminderMessage');
  const prevTitle = document.getElementById('pagePreviewTitle');
  const prevMsg = document.getElementById('pagePreviewMessage');
  if (prevTitle && tInput) prevTitle.textContent = tInput.value.trim() || 'Life Tracker';
  if (prevMsg && mInput) prevMsg.textContent = mInput.value.trim() || 'Notification body will appear here.';
}

// Instant test notification from page form
async function testFromPageForm() {
  const tInput = document.getElementById('formReminderTitle');
  const mInput = document.getElementById('formReminderMessage');
  const title = (tInput && tInput.value.trim()) || 'Life Tracker';
  const msg = (mInput && mInput.value.trim()) || 'Test notification from Life Tracker!';

  const granted = await requestReminderPermission();
  if (!granted) {
    alert('Please grant notification permission in device/browser settings.');
    return;
  }
  const ok = await triggerNotificationNow(title, msg, true);
  if (ok) {
    if (typeof showToast === 'function') showToast('Test notification sent!');
    else alert('Test notification sent! Check your notification tray.');
  }
}

// Delete from page form
function deleteFromPageForm(id) {
  deleteReminderItem(id);
  backToRemindersList();
}

// Save or Update reminder from page form
async function saveReminderFromPageForm() {
  const idInput = document.getElementById('formReminderId');
  const tInput = document.getElementById('formReminderTitle');
  const mInput = document.getElementById('formReminderMessage');
  const enableToggle = document.getElementById('pageEnableToggle');
  const dailyTimeInput = document.getElementById('pageDailyTimeInput');
  const customMinsInput = document.getElementById('pageCustomMinutesInput');

  const title = (tInput && tInput.value.trim()) || 'Life Tracker';
  const message = (mInput && mInput.value.trim()) || "Don't forget to track your expenses!";
  const enabled = enableToggle ? enableToggle.checked : true;
  const editId = (idInput && idInput.value) || null;

  // Determine interval
  let intervalType = 'preset';
  let presetInterval = '1hour';

  const dailyRow = document.getElementById('pageDailyTimeRow');
  const customRow = document.getElementById('pageCustomMinutesRow');

  if (dailyRow && !dailyRow.classList.contains('hidden')) {
    intervalType = 'daily';
  } else if (customRow && !customRow.classList.contains('hidden')) {
    intervalType = 'custom';
  } else {
    const presets = ['1min', '15min', '30min', '1hour', '2hours', '4hours'];
    for (const p of presets) {
      const btn = document.getElementById(`page-opt-${p}`);
      if (btn && btn.classList.contains('border-indigo-500')) {
        presetInterval = p;
        break;
      }
    }
  }

  if (enabled) {
    const granted = await requestReminderPermission();
    if (!granted) {
      alert('Notification permissions are required to enable alerts. Please allow them in your settings.');
      if (enableToggle) enableToggle.checked = false;
      return;
    }
  }

  const list = getRemindersList();

  if (editId) {
    const existingIndex = list.findIndex(r => r.id === editId);
    if (existingIndex >= 0) {
      list[existingIndex] = {
        ...list[existingIndex],
        title,
        message,
        enabled,
        intervalType,
        presetInterval,
        dailyTime: (dailyTimeInput && dailyTimeInput.value) || '20:00',
        customMinutes: (customMinsInput && Number(customMinsInput.value)) || 60
      };
    }
  } else {
    const newReminder = {
      id: `rem_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      title,
      message,
      enabled,
      intervalType,
      presetInterval,
      dailyTime: (dailyTimeInput && dailyTimeInput.value) || '20:00',
      customMinutes: (customMinsInput && Number(customMinsInput.value)) || 60,
      createdAt: new Date().toISOString(),
      lastTriggered: null
    };
    list.push(newReminder);
  }

  saveRemindersList(list);
  backToRemindersList();

  if (typeof showToast === 'function') {
    showToast(editId ? 'Reminder updated!' : 'New reminder created!');
  }
}

// Helpers for escaping strings
function _esc(str) {
  return String(str == null ? '' : str).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
}
function _escAttr(str) {
  return String(str == null ? '' : str).replace(/[&"<>]/g, ch => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[ch]));
}

// Auto-initialize when script loads
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    applyAllReminderSchedules();
  });
}
