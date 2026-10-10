// --- Reminders Feature (Full Page Overlay like Splitwise) -----------------
// Opens as a full-page overlay between header and bottomNav (identical to Splitwise).
// - List page matches Splitwise: clean rows, no arrow ">", no DONE button in list
// - Clear status tags shown on list page: ACTIVE, PAUSED, OVERDUE, COMPLETED
// - Pause / Enable toggle for any reminder
// - Mark Completed / Re-open for one-time and recurring reminders
// - Configurable per notification:
//     * "both": Banner + Sound
//     * "sound_only": Sound Only (plays chime/sound, no popup banner)
//     * "banner_only": Banner Only (silent notification banner)
// - Inside reminder detail: "Delete This Reminder" button matching Splitwise's "Delete This Split"
// - Once deleted: cleanly lands on list page
// - Live notification preview banner and test notification button with audio chime
// - Android APK Local Notifications with high priority / sound-only channel support

// --------------- Notification Sounds Engine ------------------------------
// Supports default 2-tone chime, crisp presets, and user-uploaded custom sounds (.mp3, .wav, .ogg, .m4a).
// If no sound is chosen, or if a custom sound fails, it automatically notifies with the default sound.

function playNotificationChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    // Friendly 2-tone chime: E5 (659Hz) -> G#5 (830Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(830.61, now + 0.15);
    gain2.gain.setValueAtTime(0.25, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.55);
  } catch (e) {
    // Audio context may require user interaction on some platforms
  }
}

function playBellChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return playNotificationChime();
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    // Crisp dual-harmonic bell chime: 880Hz (A5) + 1760Hz (A6)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.6);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1760, now);
    gain2.gain.setValueAtTime(0.12, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.4);
  } catch (e) {
    playNotificationChime();
  }
}

function playDigitalBeep() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return playNotificationChime();
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    // Double digital beep: 1046.5Hz (C6)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1046.5, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.setValueAtTime(0.001, now + 0.08);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.08);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046.5, now + 0.12);
    gain2.gain.setValueAtTime(0.2, now + 0.12);
    gain2.gain.setValueAtTime(0.001, now + 0.20);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.20);
  } catch (e) {
    playNotificationChime();
  }
}

function playMarimbaSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return playNotificationChime();
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    // Gentle 4-note ascending chord: C5 -> E5 -> G5 -> C6
    const freqs = [523.25, 659.25, 783.99, 1046.50];
    freqs.forEach((freq, idx) => {
      const t = now + (idx * 0.07);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  } catch (e) {
    playNotificationChime();
  }
}

// Unified reminder sound player
// Plays preset sounds, custom uploaded sounds, or defaults to 2-tone chime if unselected or missing
function playReminderSound(soundId) {
  if (!soundId || soundId === 'default') {
    playNotificationChime();
    return;
  }
  if (soundId === 'bell') {
    playBellChime();
    return;
  }
  if (soundId === 'digital') {
    playDigitalBeep();
    return;
  }
  if (soundId === 'marimba') {
    playMarimbaSound();
    return;
  }

  // Custom uploaded sound lookup
  const custom = (appData.reminderSounds || []).find(s => s.id === soundId);
  if (custom && custom.data) {
    try {
      const audio = new Audio(custom.data);
      audio.volume = 1.0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn('Custom sound playback blocked, falling back to default sound:', err);
          playNotificationChime();
        });
      }
      return;
    } catch (e) {
      console.warn('Custom sound play error, falling back to default:', e);
      playNotificationChime();
      return;
    }
  }

  // Fallback to default chime
  playNotificationChime();
}

function getReminderSoundLabel(soundId) {
  if (!soundId || soundId === 'default') return 'Default Chime';
  if (soundId === 'bell') return 'Bell Ding';
  if (soundId === 'digital') return 'Digital Beep';
  if (soundId === 'marimba') return 'Gentle Marimba';
  const custom = (appData.reminderSounds || []).find(s => s.id === soundId);
  if (custom) return custom.name;
  return 'Default Chime';
}

function renderReminderSoundOptionsHtml(selectedId = 'default') {
  const presets = [
    { id: 'default', label: '🔔 Default Chime (2-Tone)' },
    { id: 'bell', label: '🛎️ Bell Ding' },
    { id: 'digital', label: '📟 Digital Beep' },
    { id: 'marimba', label: '🎵 Gentle Marimba' }
  ];
  const custom = appData.reminderSounds || [];

  let html = '<optgroup label="Preset Sounds">';
  presets.forEach(p => {
    const isSelected = (!selectedId && p.id === 'default') || (selectedId === p.id);
    html += `<option value="${p.id}" ${isSelected ? 'selected' : ''}>${p.label}</option>`;
  });
  html += '</optgroup>';

  if (custom.length > 0) {
    html += '<optgroup label="Custom Uploaded Sounds">';
    custom.forEach(c => {
      const isSelected = selectedId === c.id;
      // Name only without size in the dropdown as requested
      html += `<option value="${c.id}" ${isSelected ? 'selected' : ''}>🎶 ${_escapeHtml(c.name)}</option>`;
    });
    html += '</optgroup>';
  }

  return html;
}

// --------------- Quiet Hours / Sleep Time Frame Helpers ------------------

function _isTimeInQuietHours(date, quietStart, quietEnd) {
  if (!quietStart || !quietEnd) return false;
  const startParts = quietStart.split(':').map(n => parseInt(n, 10));
  const endParts = quietEnd.split(':').map(n => parseInt(n, 10));
  if (isNaN(startParts[0]) || isNaN(endParts[0])) return false;

  const startMinutes = startParts[0] * 60 + (startParts[1] || 0);
  const endMinutes = endParts[0] * 60 + (endParts[1] || 0);
  const currentMinutes = date.getHours() * 60 + date.getMinutes();

  if (startMinutes === endMinutes) return false;

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Spans overnight, e.g. 22:00 (10 PM) to 07:00 (7 AM)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

function _calculateQuietHoursEndTime(fromDate, quietEnd) {
  const parts = (quietEnd || '07:00').split(':').map(n => parseInt(n, 10));
  const endDt = new Date(fromDate);
  endDt.setHours(parts[0] || 7, parts[1] || 0, 0, 0);
  if (endDt <= fromDate) {
    endDt.setDate(endDt.getDate() + 1);
  }
  return endDt;
}

function _formatTime12h(hhmm) {
  if (!hhmm) return '10:00 PM';
  const parts = hhmm.split(':');
  let h = parseInt(parts[0], 10);
  if (isNaN(h)) return '10:00 PM';
  const m = String(parts[1] || '00').padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

function toggleQuietHoursInputs(isChecked) {
  const box = document.getElementById('quietHoursTimeInputs');
  if (box) {
    if (isChecked) box.classList.remove('hidden');
    else box.classList.add('hidden');
  }
}

// --------------- Alert Sounds Page View (Native Screen, No Popup) ---------

function renderReminderSoundsView(returnToView = 'list', returnToId = null) {
  _saveRemindersUiState('sounds', returnToId);
  const subHeader = document.getElementById('remindersSubHeader');
  const subHeaderTitle = document.getElementById('remindersOverlayTitle');
  const subHeaderActions = document.getElementById('remindersOverlayHeaderActions');
  const content = document.getElementById('remindersOverlayContent');
  const backBtn = document.getElementById('remindersBackBtn');

  if (subHeader) subHeader.classList.remove('hidden');
  if (subHeaderTitle) subHeaderTitle.textContent = 'Alert Sounds';
  if (backBtn) {
    backBtn.onclick = () => {
      if (returnToView === 'form') renderReminderFormView(returnToId);
      else if (returnToView === 'detail' && returnToId) renderReminderDetailView(returnToId);
      else renderRemindersListView();
    };
    backBtn.setAttribute('aria-label', 'Back');
  }
  if (subHeaderActions) subHeaderActions.innerHTML = '';

  const custom = appData.reminderSounds || [];
  const presets = [
    { id: 'default', name: 'Default Chime (2-Tone)', icon: 'fa-bell', desc: 'Pleasant 2-tone harmonic chime' },
    { id: 'bell', name: 'Bell Ding', icon: 'fa-concierge-bell', desc: 'Crisp double bell alert' },
    { id: 'digital', name: 'Digital Beep', icon: 'fa-clock', desc: 'Digital watch reminder beep' },
    { id: 'marimba', name: 'Gentle Marimba', icon: 'fa-music', desc: 'Soft acoustic wooden chord' }
  ];

  content.innerHTML = `
    <div class="space-y-4">
      <div class="text-[11px] text-slate-400">
        <p>Upload, preview, and manage custom reminder alert sounds</p>
      </div>

      <!-- Upload Custom Sound Card -->
      <div class="p-4 bg-gradient-to-br from-purple-50/70 to-indigo-50/50 rounded-2xl border border-purple-100 space-y-2.5">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h3 class="text-xs font-bold text-purple-900">Upload Custom Alert Sound</h3>
            <p class="text-[10px] text-purple-700/80 mt-0.5">Upload audio clips (.mp3, .wav, .m4a, .ogg, max 4MB)</p>
          </div>
          <div class="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center text-xs shrink-0 shadow-sm shadow-purple-500/30">
            <i class="fa-solid fa-cloud-arrow-up"></i>
          </div>
        </div>

        <button type="button" onclick="triggerReminderSoundUpload()" class="w-full py-2.5 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 active:scale-[0.98] transition shadow-sm flex items-center justify-center gap-2">
          <i class="fa-solid fa-file-audio"></i>
          <span>Choose Audio File to Upload</span>
        </button>
        <input type="file" id="reminderSoundFileInput" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.webm" class="hidden" onchange="handleReminderSoundUpload(event, '${returnToView}', ${returnToId ? `'${returnToId}'` : 'null'})">
        <div id="soundUploadFeedbackMsg" class="hidden text-[10px] text-emerald-700 font-medium text-center"></div>
      </div>

      <!-- Custom Uploaded Sounds Section -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Custom Uploaded Sounds (${custom.length})</span>
        </div>

        ${custom.length === 0 ? `
          <div class="p-5 rounded-2xl border border-dashed border-slate-200 text-center space-y-1.5 bg-slate-50/50">
            <i class="fa-solid fa-music text-xl text-slate-300"></i>
            <p class="text-xs text-slate-500 font-medium">No custom sounds uploaded yet</p>
            <p class="text-[10px] text-slate-400">Tap "Choose Audio File to Upload" above to add your own alert sound.</p>
          </div>
        ` : `
          <div class="space-y-2">
            ${custom.map(s => `
              <div class="p-3 bg-white rounded-2xl border border-slate-200 flex items-center justify-between gap-3 shadow-xs hover:border-purple-200 transition">
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-xs shrink-0">
                    <i class="fa-solid fa-music"></i>
                  </div>
                  <div class="min-w-0">
                    <p class="text-xs font-bold text-slate-800 truncate">${_escapeHtml(s.name)}</p>
                    <p class="text-[10px] text-slate-400">${s.size || 'Audio clip'}</p>
                  </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <button type="button" onclick="playReminderSound('${s.id}')" class="px-2.5 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-[11px] font-bold hover:bg-purple-100 transition flex items-center gap-1" title="Play sound">
                    <i class="fa-solid fa-play text-[9px]"></i>
                    <span>Play</span>
                  </button>
                  <button type="button" onclick="deleteCustomReminderSound('${s.id}', '${returnToView}', ${returnToId ? `'${returnToId}'` : 'null'})" class="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 flex items-center justify-center transition" title="Delete sound">
                    <i class="fa-solid fa-trash text-xs"></i>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- Built-in Preset Sounds Section -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Preset Built-In Sounds</span>
        </div>
        <div class="space-y-1.5">
          ${presets.map(p => `
            <div class="p-3 bg-slate-50/70 rounded-2xl border border-slate-100 flex items-center justify-between gap-2 text-xs">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-500 flex items-center justify-center text-xs shrink-0">
                  <i class="fa-solid ${p.icon}"></i>
                </div>
                <div>
                  <p class="text-xs font-bold text-slate-700">${p.name}</p>
                  <p class="text-[9px] text-slate-400">${p.desc}</p>
                </div>
              </div>
              <button type="button" onclick="playReminderSound('${p.id}')" class="px-2.5 py-1 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-100 transition flex items-center gap-1 shrink-0">
                <i class="fa-solid fa-play text-[8px]"></i>
                <span>Test</span>
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// Backwards-compatible alias for any residual calls
function openReminderSoundsModal() {
  renderReminderSoundsView('list');
}

function triggerReminderSoundUpload() {
  const input = document.getElementById('reminderSoundFileInput');
  if (input) input.click();
}

async function handleReminderSoundUpload(e, returnToView = 'list', returnToId = null) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  if (file.size > 4 * 1024 * 1024) {
    if (typeof showAlert === 'function') await showAlert('Audio file is too large! Please choose an audio clip under 4 MB.');
    else alert('Audio file is too large! Please choose an audio clip under 4 MB.');
    e.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const base64Data = ev.target.result;
      let rawName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
      if (!rawName) rawName = 'Custom Sound ' + (((appData.reminderSounds || []).length) + 1);

      const newSound = {
        id: 'snd_' + Date.now(),
        name: rawName,
        data: base64Data,
        size: Math.round(file.size / 1024) + ' KB',
        createdAt: new Date().toISOString()
      };

      if (!appData.reminderSounds) appData.reminderSounds = [];
      appData.reminderSounds.push(newSound);
      await saveState();

      // Re-render the sounds page view
      renderReminderSoundsView(returnToView, returnToId);

      // Play audio preview immediately
      playReminderSound(newSound.id);

      const feedback = document.getElementById('soundUploadFeedbackMsg');
      if (feedback) {
        feedback.textContent = `✓ "${newSound.name}" uploaded successfully!`;
        feedback.className = 'text-[10px] text-emerald-700 font-medium text-center mt-1';
        feedback.classList.remove('hidden');
        setTimeout(() => { if (feedback) feedback.classList.add('hidden'); }, 4000);
      }
    } catch (err) {
      console.error('Failed to process sound upload:', err);
      if (typeof showAlert === 'function') await showAlert('Error saving custom sound.');
    } finally {
      e.target.value = '';
    }
  };

  reader.onerror = () => {
    if (typeof showAlert === 'function') showAlert('Failed to read the audio file.');
    e.target.value = '';
  };

  reader.readAsDataURL(file);
}

async function deleteCustomReminderSound(soundId, returnToView = 'list', returnToId = null) {
  const sound = (appData.reminderSounds || []).find(s => s.id === soundId);
  if (!sound) return;

  let ok = true;
  if (typeof showConfirm === 'function') {
    ok = await showConfirm(`Delete custom sound "${sound.name}"?\n\nAny reminders currently set to this sound will automatically use the default chime.`);
  } else if (typeof confirm === 'function') {
    ok = confirm(`Delete custom sound "${sound.name}"?\n\nAny reminders currently set to this sound will automatically use the default chime.`);
  }
  if (!ok) return;

  appData.reminderSounds = (appData.reminderSounds || []).filter(s => s.id !== soundId);
  (appData.reminders || []).forEach(r => {
    if (r.sound === soundId) r.sound = 'default';
  });

  await saveState();

  // Re-render the sounds page view
  renderReminderSoundsView(returnToView, returnToId);

  if (typeof showAlert === 'function') {
    await showAlert(`✓ Custom sound "${sound.name}" deleted.`);
  }
}

function testPreviewSelectedSound() {
  const select = document.getElementById('reminderSoundSelect');
  const soundId = select ? select.value : 'default';
  playReminderSound(soundId);
}

// --------------- Display & Status Helpers ---------------------------------

function getReminderRepeatLabel(r) {
  if (!r.repeat || r.repeat === 'None') return 'One-time';
  if (r.repeat === 'Custom') {
    const val = r.customInterval || 1;
    const unit = r.customUnit || 'minutes';
    return `Every ${val} ${unit}`;
  }
  return r.repeat;
}

function getReminderStatus(r) {
  if (r.completed) {
    return { key: 'completed', label: 'COMPLETED', badgeClass: 'bg-slate-100 text-slate-600 border border-slate-200' };
  }
  if (r.paused) {
    return { key: 'paused', label: 'PAUSED', badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200' };
  }
  const dt = new Date(r.datetime);
  if (dt <= new Date() && !r.notified) {
    return { key: 'overdue', label: 'OVERDUE', badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse' };
  }
  return { key: 'active', label: 'ACTIVE', badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200' };
}

function getAlertStyleInfo(style) {
  const s = style || 'both';
  if (s === 'sound_only') {
    return { label: 'Sound Only', icon: 'fa-volume-high', badgeClass: 'bg-purple-50 text-purple-700 border border-purple-100' };
  }
  if (s === 'banner_only') {
    return { label: 'Banner Only', icon: 'fa-message', badgeClass: 'bg-slate-100 text-slate-600 border border-slate-200' };
  }
  return { label: 'Banner + Sound', icon: 'fa-bell', badgeClass: 'bg-blue-50 text-blue-700 border border-blue-100' };
}

function _escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function _escapeAttr(str) {
  return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _toLocalDatetimeString(dt) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  const h = String(dt.getHours()).padStart(2, '0');
  const mi = String(dt.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${mi}`;
}

// --------------- UI State Persistence (Survives Refresh like Splitwise) ----
const REMINDERS_UI_STATE_KEY = 'lifeTracker_remindersUiState';

function _saveRemindersUiState(view = 'list', activeId = null) {
  try {
    localStorage.setItem(REMINDERS_UI_STATE_KEY, JSON.stringify({
      open: true,
      view: view,
      activeId: activeId
    }));
    localStorage.setItem(LAST_TAB_STORAGE_KEY, 'reminders');
  } catch (e) {}
}

function _clearRemindersUiState() {
  try {
    localStorage.removeItem(REMINDERS_UI_STATE_KEY);
    const lastTab = localStorage.getItem(LAST_TAB_STORAGE_KEY);
    if (lastTab === 'reminders') {
      const prev = localStorage.getItem('lifeTracker_prevTabBeforeReminders') || 'home';
      localStorage.setItem(LAST_TAB_STORAGE_KEY, (typeof VALID_TABS !== 'undefined' && VALID_TABS.includes(prev) && prev !== 'reminders') ? prev : 'home');
    }
  } catch (e) {}
}

async function resumeRemindersIfWasOpen() {
  const raw = localStorage.getItem(REMINDERS_UI_STATE_KEY);
  const lastTab = localStorage.getItem(LAST_TAB_STORAGE_KEY);

  if (!raw && lastTab !== 'reminders') return;

  let state = null;
  if (raw) {
    try {
      state = JSON.parse(raw);
    } catch (e) {
      localStorage.removeItem(REMINDERS_UI_STATE_KEY);
    }
  }

  if (state && state.open === false) return;

  // Close Splitwise if open
  const splitwiseOverlay = document.getElementById('splitwiseOverlay');
  if (splitwiseOverlay && !splitwiseOverlay.classList.contains('hidden')) {
    if (typeof closeSplitwise === 'function') closeSplitwise();
    else splitwiseOverlay.classList.add('hidden');
  }
  if (typeof _clearSplitwiseUiState === 'function') _clearSplitwiseUiState();

  const overlay = document.getElementById('remindersOverlay');
  if (!overlay) return;

  overlay.classList.remove('hidden');
  _positionRemindersOverlay();
  currentTab = 'reminders';
  setAppHeaderCrumb(TAB_DISPLAY_NAMES.reminders || 'Reminders');

  const view = state ? state.view : 'list';
  const activeId = state ? state.activeId : null;

  if (view === 'detail' && activeId && (appData.reminders || []).some(r => r.id === activeId)) {
    renderReminderDetailView(activeId);
  } else if (view === 'form') {
    renderReminderFormView(activeId);
  } else if (view === 'sounds') {
    renderReminderSoundsView('list');
  } else {
    renderRemindersListView();
  }
}

// --------------- Overlay Architecture (Identical to Splitwise) ------------

function _positionRemindersOverlay() {
  const overlay = document.getElementById('remindersOverlay');
  const header = document.querySelector('header');
  const nav = document.getElementById('bottomNav');
  if (!overlay) return;
  overlay.style.top = header ? `${header.offsetHeight}px` : '0px';
  overlay.style.bottom = nav ? `${nav.offsetHeight}px` : '0px';
}

function openRemindersOverlay(modeOrId = 'list') {
  if (typeof vaultLock === 'function') vaultLock();
  
  // Close Splitwise if open
  const splitwiseOverlay = document.getElementById('splitwiseOverlay');
  if (splitwiseOverlay && !splitwiseOverlay.classList.contains('hidden')) {
    if (typeof closeSplitwise === 'function') closeSplitwise();
    else splitwiseOverlay.classList.add('hidden');
  }
  if (typeof _clearSplitwiseUiState === 'function') _clearSplitwiseUiState();

  const overlay = document.getElementById('remindersOverlay');
  if (!overlay) return;

  if (typeof currentTab !== 'undefined' && currentTab && currentTab !== 'reminders') {
    try {
      localStorage.setItem('lifeTracker_prevTabBeforeReminders', currentTab);
    } catch (e) {}
  }

  currentTab = 'reminders';
  overlay.classList.remove('hidden');
  _positionRemindersOverlay();
  setAppHeaderCrumb(TAB_DISPLAY_NAMES.reminders || 'Reminders');

  if (modeOrId === 'new') {
    _saveRemindersUiState('form', null);
    renderReminderFormView(null);
  } else if (modeOrId === 'sounds') {
    _saveRemindersUiState('sounds', null);
    renderReminderSoundsView('list');
  } else if (modeOrId && modeOrId !== 'list') {
    _saveRemindersUiState('detail', modeOrId);
    renderReminderDetailView(modeOrId);
  } else {
    _saveRemindersUiState('list', null);
    renderRemindersListView();
  }
}

function closeRemindersOverlay() {
  const overlay = document.getElementById('remindersOverlay');
  if (overlay) overlay.classList.add('hidden');
  _clearRemindersUiState();
  const prevTab = localStorage.getItem('lifeTracker_prevTabBeforeReminders') || 'home';
  currentTab = (typeof VALID_TABS !== 'undefined' && VALID_TABS.includes(prevTab) && prevTab !== 'reminders') ? prevTab : 'home';
  if (typeof TAB_DISPLAY_NAMES !== 'undefined') {
    setAppHeaderCrumb(TAB_DISPLAY_NAMES[currentTab]);
  }
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('text-blue-600');
    btn.classList.add('text-slate-400');
  });
  const activeNav = document.getElementById(`nav-${currentTab}`);
  if (activeNav) {
    activeNav.classList.add('text-blue-600');
    activeNav.classList.remove('text-slate-400');
  }
}

// Tapping Reminder in plus (+) button directs to listing page (just like Splitwise)
function quickNewReminder() {
  openRemindersOverlay('list');
}

function renderRemindersPage(container) {
  openRemindersOverlay('list');
}

// --------------- Group/Reminder List View (Matching Splitwise) ------------
// Clean rows: NO arrow ">", NO Done button in list. Status shown clearly!

function renderRemindersListView() {
  _saveRemindersUiState('list', null);
  const subHeader = document.getElementById('remindersSubHeader');
  if (subHeader) subHeader.classList.add('hidden'); // Hidden in list view, exactly like Splitwise

  const content = document.getElementById('remindersOverlayContent');
  if (!content) return;

  const list = appData.reminders || [];
  const activeList = list.filter(r => !r.completed).sort((a, b) => a.datetime.localeCompare(b.datetime));
  const completedList = list.filter(r => r.completed).sort((a, b) => b.datetime.localeCompare(a.datetime));

  content.innerHTML = `
    <div class="text-[11px] text-slate-400">
      <p>Scheduled reminders & alert notifications</p>
    </div>

    <!-- Action buttons: "+ New Reminder" and "Alert Sounds" manager -->
    <div class="grid grid-cols-2 gap-2">
      <button onclick="renderReminderFormView(null)" class="py-2.5 px-3 rounded-xl text-xs font-bold transition bg-blue-600 text-white hover:bg-blue-700 shadow-sm flex items-center justify-center gap-1.5">
        <i class="fa-solid fa-plus text-xs"></i> New Reminder
      </button>
      <button onclick="renderReminderSoundsView('list')" class="py-2.5 px-3 rounded-xl text-xs font-bold transition bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm flex items-center justify-center gap-1.5">
        <i class="fa-solid fa-music text-purple-600 text-xs"></i> Alert Sounds <span class="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none">${(appData.reminderSounds || []).length}</span>
      </button>
    </div>

    <!-- Notification Permission Alert if default -->
    <div id="reminderPermBanner" class="hidden p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <i class="fa-solid fa-circle-exclamation text-amber-500 shrink-0"></i>
        <p class="text-[11px] text-amber-800">Enable notifications to receive alert sounds & banners.</p>
      </div>
      <button onclick="requestNotificationPermissionWithFeedback()" class="shrink-0 px-2.5 py-1 text-[11px] font-bold bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition">Enable</button>
    </div>

    <!-- Reminders list matching Splitwise list format -->
    <div class="space-y-2">
      ${activeList.length === 0 && completedList.length === 0 ? `
        <div class="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200 p-6 space-y-2">
          <i class="fa-solid fa-bell text-2xl text-slate-300"></i>
          <p class="text-xs text-slate-400">No reminders yet.<br>Tap "New Reminder" above to create an alert.</p>
        </div>
      ` : ''}

      ${activeList.map(r => _renderReminderListRow(r)).join('')}

      ${completedList.length > 0 ? `
        <details class="mt-4">
          <summary class="text-[10px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer select-none mb-2">Completed (${completedList.length})</summary>
          <div class="space-y-2">
            ${completedList.map(r => _renderReminderListRow(r)).join('')}
          </div>
        </details>
      ` : ''}
    </div>
  `;

  _checkPermBanner();
}

// Helper to format when a reminder was last sent
function _formatLastSent(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return null;

  const now = new Date();
  const diffSec = Math.floor((now - d) / 1000);

  if (diffSec < 0 || diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;

  const isToday = d.toDateString() === now.toDateString();
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (isToday) return `Today at ${timeStr}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday at ${timeStr}`;

  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${timeStr}`;
}

// Clean row identical to Splitwise: No arrow ">", No DONE button. Shows status & repeat tags.
function _renderReminderListRow(r) {
  const dt = new Date(r.datetime);
  const status = getReminderStatus(r);
  const repeatLabel = getReminderRepeatLabel(r);
  const alertInfo = getAlertStyleInfo(r.alertStyle);

  const dateLabel = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeLabel = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const lastSentFormatted = _formatLastSent(r.lastSentAt || (r.notified ? r.datetime : null));

  return `
    <div onclick="openRemindersOverlay('${r.id}')" class="p-3.5 rounded-xl border border-slate-100 bg-white shadow-sm cursor-pointer hover:bg-slate-50 transition">
      <div class="space-y-1.5">
        <div class="flex items-center gap-1.5 flex-wrap">
          <p class="text-xs font-bold text-slate-800 ${r.completed ? 'line-through text-slate-400' : ''}">
            ${_escapeHtml(r.title)}
          </p>
          <span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold ${status.badgeClass}">${status.label}</span>
          ${r.repeat && r.repeat !== 'None' ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 text-[9px] font-medium"><i class="fa-solid fa-repeat text-[8px] mr-1"></i>${repeatLabel}</span>` : ''}
          ${r.alertStyle === 'sound_only' ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100 text-[9px] font-medium"><i class="fa-solid fa-volume-high text-[8px] mr-1"></i>Sound Only</span>` : ''}
          ${r.alertStyle === 'banner_only' ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[9px] font-medium"><i class="fa-solid fa-message text-[8px] mr-1"></i>Banner Only</span>` : ''}
          ${r.quietHoursEnabled ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] font-medium"><i class="fa-solid fa-moon text-[8px] mr-1"></i>Quiet: ${_formatTime12h(r.quietStart || '22:00')} - ${_formatTime12h(r.quietEnd || '07:00')}</span>` : ''}
        </div>
        <div class="flex items-center justify-between text-[10px] text-slate-400 gap-2 flex-wrap pt-0.5">
          <p class="truncate min-w-0">
            <i class="fa-regular fa-clock text-[9px] mr-1 text-slate-400"></i>${r.completed ? 'Was' : 'Next'}: ${dateLabel} at ${timeLabel}
          </p>
          ${lastSentFormatted ? `
            <span class="inline-flex items-center gap-1 text-[9px] text-slate-600 font-semibold bg-slate-50 border border-slate-200/80 px-1.5 py-0.5 rounded-md shrink-0">
              <i class="fa-solid fa-paper-plane text-[7px] text-blue-500"></i>Last sent: ${lastSentFormatted}
            </span>
          ` : `
            <span class="text-[9px] text-slate-400 shrink-0 italic">Not sent yet</span>
          `}
        </div>
      </div>
    </div>
  `;
}

// --------------- View: Reminder Detail View (Opened on Notification Click) -
// Matches Splitwise's renderSplitGroupDetail with Pause/Enable, Complete, and Delete This Reminder

function renderReminderDetailView(id) {
  _saveRemindersUiState('detail', id);
  const rem = (appData.reminders || []).find(r => r.id === id);
  const subHeader = document.getElementById('remindersSubHeader');
  const subHeaderTitle = document.getElementById('remindersOverlayTitle');
  const subHeaderActions = document.getElementById('remindersOverlayHeaderActions');
  const content = document.getElementById('remindersOverlayContent');
  const backBtn = document.getElementById('remindersBackBtn');

  if (!rem) {
    renderRemindersListView();
    return;
  }

  // Show subHeader in detail view (just like Splitwise)
  if (subHeader) subHeader.classList.remove('hidden');
  if (subHeaderTitle) subHeaderTitle.textContent = rem.title;
  if (backBtn) {
    backBtn.onclick = () => renderRemindersListView();
    backBtn.setAttribute('aria-label', 'Back to reminders');
  }

  if (subHeaderActions) {
    subHeaderActions.innerHTML = `
      <button onclick="renderReminderFormView('${rem.id}')" class="w-8 h-8 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-slate-100 flex items-center justify-center transition" title="Edit reminder" aria-label="Edit reminder">
        <i class="fa-solid fa-pencil text-sm"></i>
      </button>
    `;
  }

  const dt = new Date(rem.datetime);
  const status = getReminderStatus(rem);
  const dateFormatted = dt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeFormatted = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const repeatLabel = getReminderRepeatLabel(rem);
  const alertInfo = getAlertStyleInfo(rem.alertStyle);

  content.innerHTML = `
    <!-- Top Action Row: Test Alert button & Edit Pencil in top right matching edit page -->
    <div class="flex items-center justify-between mb-1">
      <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Reminder Details</span>
      <div class="flex items-center gap-1.5">
        <button type="button" onclick="testSpecificReminderAlert('${rem.id}')" class="px-2.5 py-1 text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition flex items-center gap-1 shadow-xs">
          <i class="fa-solid fa-play text-[8px]"></i> Test Alert
        </button>
        <button type="button" onclick="renderReminderFormView('${rem.id}')" class="w-7 h-7 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-200 transition flex items-center justify-center shadow-xs" title="Edit reminder" aria-label="Edit reminder">
          <i class="fa-solid fa-pencil text-[10px]"></i>
        </button>
      </div>
    </div>

    <!-- Detail Card -->
    <div class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
      <div class="flex items-start justify-between gap-2">
        <div class="w-12 h-12 rounded-xl ${rem.completed ? 'bg-slate-100 text-slate-500' : rem.paused ? 'bg-amber-50 text-amber-600' : status.key === 'overdue' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'} flex items-center justify-center text-xl shrink-0">
          <i class="fa-solid ${rem.alertStyle === 'sound_only' ? 'fa-volume-high' : 'fa-bell'}"></i>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="text-[10px] font-bold px-2.5 py-1 rounded-full ${status.badgeClass}">${status.label}</span>
        </div>
      </div>

      <div>
        <h1 class="text-base font-bold text-slate-800 leading-snug">${_escapeHtml(rem.title)}</h1>
        <p class="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
          <i class="fa-regular fa-calendar text-blue-500"></i> ${dateFormatted}
        </p>
        <p class="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
          <i class="fa-regular fa-clock text-blue-500"></i> ${timeFormatted}
        </p>
      </div>

      <div class="grid grid-cols-2 gap-2 text-xs">
        <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
          <p class="text-[10px] text-slate-400">Recurrence</p>
          <p class="font-bold text-slate-800 mt-0.5 flex items-center gap-1">
            <i class="fa-solid fa-repeat text-indigo-500 text-[10px]"></i> ${repeatLabel}
          </p>
        </div>
        <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
          <p class="text-[10px] text-slate-400">Notification Style</p>
          <p class="font-bold text-slate-800 mt-0.5 flex items-center gap-1">
            <i class="fa-solid ${alertInfo.icon} text-blue-500 text-[10px]"></i> ${alertInfo.label}
          </p>
        </div>
        <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-100 col-span-2 flex items-center justify-between">
          <div>
            <p class="text-[10px] text-slate-400">Alert Sound</p>
            <p class="font-bold text-slate-800 mt-0.5 flex items-center gap-1.5">
              <i class="fa-solid fa-music text-purple-500 text-[10px]"></i> ${getReminderSoundLabel(rem.sound)}
            </p>
          </div>
          <button onclick="playReminderSound('${rem.sound || 'default'}')" class="px-2.5 py-1 bg-purple-50 text-purple-600 border border-purple-200 rounded-lg text-[10px] font-bold hover:bg-purple-100 transition flex items-center gap-1">
            <i class="fa-solid fa-play text-[8px]"></i> Preview Sound
          </button>
        </div>
      </div>

      ${rem.quietHoursEnabled ? `
        <div class="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between text-xs">
          <div class="flex items-center gap-2">
            <i class="fa-solid fa-moon text-indigo-600 text-xs"></i>
            <div>
              <p class="text-[10px] text-slate-400 font-medium">Quiet Hours (Do Not Disturb)</p>
              <p class="font-bold text-indigo-900">${_formatTime12h(rem.quietStart || '22:00')} – ${_formatTime12h(rem.quietEnd || '07:00')}</p>
            </div>
          </div>
          <span class="text-[9px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">Alarms Muted</span>
        </div>
      ` : ''}

      <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
        <span class="text-[10px] text-slate-400 font-medium">Last Reminder Sent</span>
        <span class="font-bold text-slate-700 flex items-center gap-1.5 text-[11px]">
          <i class="fa-solid fa-paper-plane text-blue-500 text-[9px]"></i>
          ${_formatLastSent(rem.lastSentAt || (rem.notified ? rem.datetime : null)) || 'Not sent yet'}
        </span>
      </div>

      ${rem.note ? `
        <div class="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
          <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Notes</p>
          <p class="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">${_escapeHtml(rem.note)}</p>
        </div>
      ` : ''}

      <!-- Status Action Buttons in SAME line, divided 50/50 -->
      <div class="pt-1">
        ${!rem.completed ? `
          <div class="grid grid-cols-2 gap-2">
            ${rem.paused ? `
              <button onclick="togglePauseReminder('${rem.id}')" class="py-2.5 px-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 active:scale-[0.98] transition flex items-center justify-center gap-1.5 shadow-xs">
                <i class="fa-solid fa-play text-xs"></i> Resume
              </button>
            ` : `
              <button onclick="togglePauseReminder('${rem.id}')" class="py-2.5 px-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold hover:bg-amber-100 active:scale-[0.98] transition flex items-center justify-center gap-1.5 shadow-xs">
                <i class="fa-solid fa-pause text-xs"></i> Pause
              </button>
            `}
            <button onclick="markReminderCompleted('${rem.id}')" class="py-2.5 px-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 active:scale-[0.98] transition flex items-center justify-center gap-1.5 shadow-sm">
              <i class="fa-solid fa-check text-xs"></i> Completed
            </button>
          </div>
        ` : `
          <div class="grid grid-cols-2 gap-2">
            <button onclick="reopenReminder('${rem.id}')" class="py-2.5 px-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 active:scale-[0.98] transition flex items-center justify-center gap-1.5 shadow-sm">
              <i class="fa-solid fa-rotate-left text-xs"></i> Re-open
            </button>
            <button onclick="deleteReminder('${rem.id}')" class="py-2.5 px-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold hover:bg-rose-100 active:scale-[0.98] transition flex items-center justify-center gap-1.5 shadow-xs">
              <i class="fa-solid fa-trash text-xs"></i> Delete
            </button>
          </div>
        `}
      </div>

      <!-- Quick Snooze (available when active) -->
      ${!rem.completed && !rem.paused ? `
        <div class="p-2.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
          <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quick Snooze</p>
          <div class="grid grid-cols-4 gap-1.5 text-center">
            <button onclick="snoozeReminder('${rem.id}', 5, 'minutes')" class="py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-blue-50 hover:border-blue-300 transition">+5m</button>
            <button onclick="snoozeReminder('${rem.id}', 15, 'minutes')" class="py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-blue-50 hover:border-blue-300 transition">+15m</button>
            <button onclick="snoozeReminder('${rem.id}', 60, 'minutes')" class="py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-blue-50 hover:border-blue-300 transition">+1h</button>
            <button onclick="snoozeReminder('${rem.id}', 1, 'days')" class="py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-blue-50 hover:border-blue-300 transition">+1 Day</button>
          </div>
        </div>
      ` : ''}
    </div>

    <!-- Delete button matching Splitwise's 'Delete This Split' exactly -->
    ${!rem.completed ? `
      <button onclick="deleteReminder('${rem.id}')" class="w-full py-2.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold hover:bg-rose-100 transition mt-2">
        <i class="fa-solid fa-trash mr-1"></i> Delete This Reminder
      </button>
    ` : ''}
  `;
}

// --------------- Status State Mutations (Pause / Enable / Complete) -------

async function togglePauseReminder(id) {
  const rem = (appData.reminders || []).find(r => r.id === id);
  if (!rem) return;

  rem.paused = !rem.paused;

  if (rem.paused) {
    // Cancel native scheduled notification
    if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications) {
      try {
        Capacitor.Plugins.LocalNotifications.cancel({
          notifications: [{ id: _reminderIdToInt(id) }]
        });
      } catch (e) { /* ignore */ }
    }
  } else {
    // If enabling and datetime is in past, advance or re-arm
    const now = new Date();
    if (new Date(rem.datetime) <= now) {
      if (rem.repeat && rem.repeat !== 'None') {
        rem.datetime = _calculateNextReminderDatetime(rem.datetime, rem.repeat, rem.customInterval, rem.customUnit);
      } else {
        // Advance to 10 mins from now
        const nextDt = new Date();
        nextDt.setMinutes(nextDt.getMinutes() + 10);
        rem.datetime = _toLocalDatetimeString(nextDt);
      }
    }
    rem.notified = false;
    await _scheduleNativeNotification(rem);
  }

  await saveState();
  renderReminderDetailView(id);
}

async function markReminderCompleted(id) {
  const rem = (appData.reminders || []).find(r => r.id === id);
  if (!rem) return;

  rem.completed = true;
  rem.paused = false;

  // Cancel native alarms
  if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications) {
    try {
      Capacitor.Plugins.LocalNotifications.cancel({
        notifications: [{ id: _reminderIdToInt(id) }]
      });
    } catch (e) { /* ignore */ }
  }

  await saveState();
  renderReminderDetailView(id);
}

async function reopenReminder(id) {
  const rem = (appData.reminders || []).find(r => r.id === id);
  if (!rem) return;

  rem.completed = false;
  rem.paused = false;

  // Ensure scheduled time is in future
  const now = new Date();
  if (new Date(rem.datetime) <= now) {
    const nextDt = new Date();
    nextDt.setMinutes(nextDt.getMinutes() + 10);
    rem.datetime = _toLocalDatetimeString(nextDt);
  }
  rem.notified = false;

  await _scheduleNativeNotification(rem);
  await saveState();
  renderReminderDetailView(id);
}

async function snoozeReminder(id, amount, unit) {
  const rem = (appData.reminders || []).find(r => r.id === id);
  if (!rem) return;

  const now = new Date();
  if (unit === 'minutes') now.setMinutes(now.getMinutes() + amount);
  else if (unit === 'hours') now.setHours(now.getHours() + amount);
  else if (unit === 'days') now.setDate(now.getDate() + amount);

  rem.datetime = _toLocalDatetimeString(now);
  rem.completed = false;
  rem.paused = false;
  rem.notified = false;

  await saveState();
  await _scheduleNativeNotification(rem);

  if (typeof showAlert === 'function') {
    await showAlert(`Snoozed! Next alert: ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`);
  }

  renderReminderDetailView(id);
}

// Deletes a reminder - once deleted, lands cleanly on the list page (matching Splitwise)
async function deleteReminder(id) {
  const rem = (appData.reminders || []).find(r => r.id === id);
  if (!rem) return;
  if (!(await showConfirm(`Delete reminder "${rem.title}"? This cannot be undone.`))) return;

  if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications) {
    try {
      Capacitor.Plugins.LocalNotifications.cancel({
        notifications: [{ id: _reminderIdToInt(id) }]
      });
    } catch (e) { /* ignore */ }
  }

  appData.reminders = appData.reminders.filter(r => r.id !== id);
  await saveState();
  // Lands on list page
  renderRemindersListView();
}

// --------------- View: Reminder Form View (Inside Full Overlay) -----------
// Allows setting alertStyle: 'both' | 'sound_only' | 'banner_only'

function renderReminderFormView(editId = null) {
  _saveRemindersUiState('form', editId);
  const subHeader = document.getElementById('remindersSubHeader');
  const subHeaderTitle = document.getElementById('remindersOverlayTitle');
  const subHeaderActions = document.getElementById('remindersOverlayHeaderActions');
  const content = document.getElementById('remindersOverlayContent');
  const backBtn = document.getElementById('remindersBackBtn');

  const existing = editId ? (appData.reminders || []).find(r => r.id === editId) : null;

  if (subHeader) subHeader.classList.remove('hidden');
  if (subHeaderTitle) subHeaderTitle.textContent = existing ? 'Edit Reminder' : 'New Reminder';
  if (backBtn) {
    backBtn.onclick = () => {
      if (existing) renderReminderDetailView(existing.id);
      else renderRemindersListView();
    };
    backBtn.setAttribute('aria-label', 'Back');
  }
  if (subHeaderActions) subHeaderActions.innerHTML = '';

  const defaultDt = new Date();
  defaultDt.setMinutes(defaultDt.getMinutes() + 10);
  const defaultDatetime = existing ? existing.datetime.slice(0, 16) : _toLocalDatetimeString(defaultDt);
  const repeat = existing ? (existing.repeat || 'None') : 'None';
  const customInterval = existing ? (existing.customInterval || 15) : 15;
  const customUnit = existing ? (existing.customUnit || 'minutes') : 'minutes';
  const alertStyle = existing ? (existing.alertStyle || 'both') : 'both';
  const sound = existing ? (existing.sound || 'default') : 'default';
  const quietHoursEnabled = existing ? !!existing.quietHoursEnabled : false;
  const quietStart = existing ? (existing.quietStart || '22:00') : '22:00';
  const quietEnd = existing ? (existing.quietEnd || '07:00') : '07:00';

  content.innerHTML = `
    <div class="space-y-4">
      <!-- Live Notification Banner / Sound Preview Card -->
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Live Alert Preview</span>
          <button type="button" onclick="testCurrentReminderForm()" class="px-2.5 py-1 text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition flex items-center gap-1">
            <i class="fa-solid fa-play text-[8px]"></i> Test Alert
          </button>
        </div>
        
        <div id="liveReminderPreviewBox" class="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-3.5 shadow-xl border border-slate-700/50 space-y-2">
          <div class="flex items-center justify-between text-[10px] text-slate-400">
            <div class="flex items-center gap-1.5">
              <div class="w-4 h-4 rounded-md bg-blue-600 flex items-center justify-center text-white text-[9px]">
                <i id="previewIcon" class="fa-solid fa-bell"></i>
              </div>
              <span class="font-bold text-slate-200">Life Tracker</span>
              <span>&bull;</span>
              <span id="previewTimeLabel">Scheduled time</span>
            </div>
            <span id="previewModeBadge" class="text-[9px] bg-slate-700/60 px-1.5 py-0.5 rounded text-slate-300">Banner + Sound</span>
          </div>
          <div>
            <p id="previewTitle" class="text-xs font-bold text-white leading-tight">Reminder Title</p>
            <p id="previewNote" class="text-[11px] text-slate-300 leading-snug mt-0.5 line-clamp-2">Reminder details or note will appear here...</p>
          </div>
          <div class="flex items-center justify-between pt-1 border-t border-slate-700/40 text-[9px]">
            <span id="previewRepeatBadge" class="text-blue-400 font-semibold"><i class="fa-solid fa-clock mr-1"></i>One-time</span>
            <span id="previewSoundBadge" class="text-purple-300 font-semibold flex items-center gap-1"><i class="fa-solid fa-music"></i>${getReminderSoundLabel(sound)}</span>
          </div>
          <div id="previewQuietBox" class="${quietHoursEnabled ? '' : 'hidden'} text-[9px] text-indigo-300 font-medium flex items-center gap-1 pt-0.5">
            <i class="fa-solid fa-moon text-indigo-400 text-[8px]"></i>
            <span id="previewQuietText">Quiet Hours: ${_formatTime12h(quietStart)} - ${_formatTime12h(quietEnd)} (Alarms Muted)</span>
          </div>
        </div>
        <div id="testFeedbackMsg" class="hidden text-[10px] text-emerald-600 font-medium text-center mt-1"></div>
      </div>

      <!-- The Form -->
      <form onsubmit="handleSaveReminderSubmit(event, ${existing ? `'${editId}'` : 'null'})" class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3.5">
        <div>
          <label class="text-[11px] font-semibold text-slate-500 block mb-1">Reminder Title *</label>
          <input type="text" required id="reminderTitle" oninput="updateReminderPreview()" value="${existing ? _escapeAttr(existing.title) : ''}" placeholder="e.g. Drink water, Pay credit card bill, Take medicine" class="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 bg-slate-50/50 font-medium">
        </div>

        <div>
          <label class="text-[11px] font-semibold text-slate-500 block mb-1">Date & Time *</label>
          <input type="datetime-local" required id="reminderDatetime" onchange="updateReminderPreview()" value="${defaultDatetime}" class="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 bg-slate-50/50 font-medium">
        </div>

        <!-- Notification Style Configuration (Banner+Sound, Sound Only, Banner Only) -->
        <div>
          <label class="text-[11px] font-semibold text-slate-500 block mb-1">Notification Style (Configurable per alert)</label>
          <div class="grid grid-cols-3 gap-2" id="alertStyleSelector">
            <label class="alert-style-label cursor-pointer border rounded-xl p-2.5 flex flex-col items-center text-center gap-1 transition ${alertStyle === 'both' ? 'border-blue-500 bg-blue-50/50 font-bold text-blue-700' : 'border-slate-200 bg-white text-slate-600'}">
              <input type="radio" name="alertStyle" value="both" ${alertStyle === 'both' ? 'checked' : ''} onchange="onAlertStyleRadioChange(this.value); updateReminderPreview()" class="hidden">
              <i class="fa-solid fa-bell text-sm ${alertStyle === 'both' ? 'text-blue-600' : 'text-slate-400'}"></i>
              <span class="text-[10px] leading-tight">Banner + Sound</span>
            </label>

            <label class="alert-style-label cursor-pointer border rounded-xl p-2.5 flex flex-col items-center text-center gap-1 transition ${alertStyle === 'sound_only' ? 'border-purple-500 bg-purple-50/50 font-bold text-purple-700' : 'border-slate-200 bg-white text-slate-600'}">
              <input type="radio" name="alertStyle" value="sound_only" ${alertStyle === 'sound_only' ? 'checked' : ''} onchange="onAlertStyleRadioChange(this.value); updateReminderPreview()" class="hidden">
              <i class="fa-solid fa-volume-high text-sm ${alertStyle === 'sound_only' ? 'text-purple-600' : 'text-slate-400'}"></i>
              <span class="text-[10px] leading-tight">Sound Only<br><span class="text-[8px] font-normal text-slate-400">(No banner)</span></span>
            </label>

            <label class="alert-style-label cursor-pointer border rounded-xl p-2.5 flex flex-col items-center text-center gap-1 transition ${alertStyle === 'banner_only' ? 'border-slate-600 bg-slate-100 font-bold text-slate-800' : 'border-slate-200 bg-white text-slate-600'}">
              <input type="radio" name="alertStyle" value="banner_only" ${alertStyle === 'banner_only' ? 'checked' : ''} onchange="onAlertStyleRadioChange(this.value); updateReminderPreview()" class="hidden">
              <i class="fa-solid fa-message text-sm ${alertStyle === 'banner_only' ? 'text-slate-700' : 'text-slate-400'}"></i>
              <span class="text-[10px] leading-tight">Banner Only<br><span class="text-[8px] font-normal text-slate-400">(Silent)</span></span>
            </label>
          </div>
        </div>

        <!-- Notification Sound Selector -->
        <div class="space-y-1.5" id="notificationSoundSection">
          <div class="flex items-center justify-between">
            <label class="text-[11px] font-semibold text-slate-500 block">Notification Sound</label>
            <button type="button" onclick="renderReminderSoundsView('form', ${existing ? `'${editId}'` : 'null'})" class="text-[10px] font-bold text-purple-600 hover:text-purple-700 transition flex items-center gap-1">
              <i class="fa-solid fa-sliders text-[10px]"></i> Manage Sounds
            </button>
          </div>

          <div class="flex items-center gap-2">
            <div class="relative flex-1">
              <select id="reminderSoundSelect" onchange="updateReminderPreview()" class="w-full text-xs p-3 pr-8 rounded-xl border border-slate-200 outline-none focus:border-blue-500 bg-slate-50/50 font-medium appearance-none">
                ${renderReminderSoundOptionsHtml(sound)}
              </select>
              <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                <i class="fa-solid fa-chevron-down text-[10px]"></i>
              </div>
            </div>

            <!-- Preview/Play Selected Sound -->
            <button type="button" onclick="testPreviewSelectedSound()" class="h-11 px-3 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold hover:bg-purple-100 transition flex items-center justify-center gap-1 shrink-0" title="Preview selected sound">
              <i class="fa-solid fa-play text-[10px]"></i>
              <span>Play</span>
            </button>
          </div>
        </div>

        <!-- Quiet Hours / Sleep Do Not Disturb Time Frame -->
        <div class="p-3.5 bg-slate-50/70 rounded-2xl border border-slate-200 space-y-2.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs">
                <i class="fa-solid fa-moon"></i>
              </div>
              <div>
                <label for="reminderQuietHoursToggle" class="text-xs font-bold text-slate-800 cursor-pointer">Quiet Hours (Do Not Disturb)</label>
                <p class="text-[10px] text-slate-400">Mute alarm during sleep or personal hours</p>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="reminderQuietHoursToggle" ${quietHoursEnabled ? 'checked' : ''} onchange="toggleQuietHoursInputs(this.checked); updateReminderPreview()" class="sr-only peer">
              <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div id="quietHoursTimeInputs" class="${quietHoursEnabled ? '' : 'hidden'} pt-2 border-t border-slate-200/60 grid grid-cols-2 gap-2.5">
            <div>
              <label class="text-[10px] font-semibold text-slate-500 block mb-1">Mute From (Start Time)</label>
              <input type="time" id="reminderQuietStart" value="${quietStart}" onchange="updateReminderPreview()" class="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-500 font-semibold text-slate-700">
            </div>
            <div>
              <label class="text-[10px] font-semibold text-slate-500 block mb-1">Until (End Time)</label>
              <input type="time" id="reminderQuietEnd" value="${quietEnd}" onchange="updateReminderPreview()" class="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-500 font-semibold text-slate-700">
            </div>
            <p class="text-[10px] text-indigo-700/80 col-span-2 flex items-center gap-1.5 font-medium">
              <i class="fa-solid fa-circle-info text-[9px]"></i> Alarms triggering within this time frame will not make sound or disturb you.
            </p>
          </div>
        </div>

        <div>
          <label class="text-[11px] font-semibold text-slate-500 block mb-1">Recurrence Frequency</label>
          <select id="reminderRepeat" onchange="onRepeatSelectChange(); updateReminderPreview()" class="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 bg-slate-50/50 font-medium">
            <option value="None" ${repeat === 'None' ? 'selected' : ''}>None (One time alert)</option>
            <option value="Every Minute" ${repeat === 'Every Minute' ? 'selected' : ''}>⚡ Every Minute</option>
            <option value="Hourly" ${repeat === 'Hourly' ? 'selected' : ''}>⏱ Hourly (Every 1 hour)</option>
            <option value="Daily" ${repeat === 'Daily' ? 'selected' : ''}>📅 Daily (Every day at this time)</option>
            <option value="Weekly" ${repeat === 'Weekly' ? 'selected' : ''}>🗓 Weekly (Once a week)</option>
            <option value="Monthly" ${repeat === 'Monthly' ? 'selected' : ''}>📆 Monthly (Once a month)</option>
            <option value="Yearly" ${repeat === 'Yearly' ? 'selected' : ''}>🎉 Yearly (Annual reminder)</option>
            <option value="Custom" ${repeat === 'Custom' ? 'selected' : ''}>⚙️ Custom Interval (e.g. Every 15 minutes / 2 hours)</option>
          </select>
        </div>

        <!-- Custom Repeat Details -->
        <div id="customIntervalBox" class="${repeat === 'Custom' ? '' : 'hidden'} p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
          <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Custom Repeat Interval</label>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-[10px] text-slate-500 block mb-0.5">Every (Number)</label>
              <input type="number" id="customIntervalNum" min="1" max="999" value="${customInterval}" oninput="updateReminderPreview()" class="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-500 font-bold">
            </div>
            <div>
              <label class="text-[10px] text-slate-500 block mb-0.5">Unit</label>
              <select id="customIntervalUnit" onchange="updateReminderPreview()" class="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-500 font-medium">
                <option value="minutes" ${customUnit === 'minutes' ? 'selected' : ''}>Minutes</option>
                <option value="hours" ${customUnit === 'hours' ? 'selected' : ''}>Hours</option>
                <option value="days" ${customUnit === 'days' ? 'selected' : ''}>Days</option>
                <option value="weeks" ${customUnit === 'weeks' ? 'selected' : ''}>Weeks</option>
                <option value="months" ${customUnit === 'months' ? 'selected' : ''}>Months</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <label class="text-[11px] font-semibold text-slate-500 block mb-1">Notes / Description (Optional)</label>
          <textarea id="reminderNote" oninput="updateReminderPreview()" rows="2" placeholder="Extra details (displayed in the notification body)" class="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 bg-slate-50/50">${existing ? _escapeHtml(existing.note || '') : ''}</textarea>
        </div>

        <div class="flex gap-2 pt-2">
          <button type="button" onclick="${existing ? `renderReminderDetailView('${existing.id}')` : 'renderRemindersListView()'}" class="flex-1 py-3 text-xs border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition">Cancel</button>
          <button type="submit" class="flex-1 py-3 text-xs bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-sm">${existing ? 'Save Changes' : 'Save Reminder'}</button>
        </div>
      </form>
    </div>
  `;

  updateReminderPreview();
}

function onAlertStyleRadioChange(val) {
  document.querySelectorAll('#alertStyleSelector .alert-style-label').forEach(label => {
    const radio = label.querySelector('input[type="radio"]');
    const icon = label.querySelector('i');
    if (radio && radio.value === val) {
      if (val === 'sound_only') {
        label.className = 'alert-style-label cursor-pointer border rounded-xl p-2.5 flex flex-col items-center text-center gap-1 transition border-purple-500 bg-purple-50/50 font-bold text-purple-700';
        if (icon) icon.className = 'fa-solid fa-volume-high text-sm text-purple-600';
      } else if (val === 'banner_only') {
        label.className = 'alert-style-label cursor-pointer border rounded-xl p-2.5 flex flex-col items-center text-center gap-1 transition border-slate-600 bg-slate-100 font-bold text-slate-800';
        if (icon) icon.className = 'fa-solid fa-message text-sm text-slate-700';
      } else {
        label.className = 'alert-style-label cursor-pointer border rounded-xl p-2.5 flex flex-col items-center text-center gap-1 transition border-blue-500 bg-blue-50/50 font-bold text-blue-700';
        if (icon) icon.className = 'fa-solid fa-bell text-sm text-blue-600';
      }
    } else {
      label.className = 'alert-style-label cursor-pointer border rounded-xl p-2.5 flex flex-col items-center text-center gap-1 transition border-slate-200 bg-white text-slate-600';
      if (icon) icon.className = `fa-solid ${radio?.value === 'sound_only' ? 'fa-volume-high' : radio?.value === 'banner_only' ? 'fa-message' : 'fa-bell'} text-sm text-slate-400`;
    }
  });
}

function onRepeatSelectChange() {
  const sel = document.getElementById('reminderRepeat');
  const customBox = document.getElementById('customIntervalBox');
  if (sel && customBox) {
    if (sel.value === 'Custom') {
      customBox.classList.remove('hidden');
    } else {
      customBox.classList.add('hidden');
    }
  }
}

function updateReminderPreview() {
  const titleEl = document.getElementById('reminderTitle');
  const noteEl = document.getElementById('reminderNote');
  const dtEl = document.getElementById('reminderDatetime');
  const repeatEl = document.getElementById('reminderRepeat');
  const customNumEl = document.getElementById('customIntervalNum');
  const customUnitEl = document.getElementById('customIntervalUnit');
  const alertStyleRadio = document.querySelector('input[name="alertStyle"]:checked');
  const soundEl = document.getElementById('reminderSoundSelect');

  const prevTitle = document.getElementById('previewTitle');
  const prevNote = document.getElementById('previewNote');
  const prevTime = document.getElementById('previewTimeLabel');
  const prevRepeat = document.getElementById('previewRepeatBadge');
  const prevSound = document.getElementById('previewSoundBadge');
  const prevMode = document.getElementById('previewModeBadge');
  const prevIcon = document.getElementById('previewIcon');
  const prevFooter = document.getElementById('previewFooterHint');

  if (!prevTitle) return;

  const title = (titleEl && titleEl.value.trim()) || 'Reminder Title';
  const note = (noteEl && noteEl.value.trim()) || 'Reminder details will appear here';
  const alertStyle = alertStyleRadio ? alertStyleRadio.value : 'both';
  const soundId = soundEl ? soundEl.value : 'default';
  
  prevTitle.textContent = title;
  prevNote.textContent = note;

  if (dtEl && dtEl.value) {
    const dt = new Date(dtEl.value);
    prevTime.textContent = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + ', ' + dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else {
    prevTime.textContent = 'Scheduled time';
  }

  if (repeatEl) {
    let repText = repeatEl.value;
    if (repText === 'Custom') {
      const num = customNumEl ? customNumEl.value : '15';
      const unit = customUnitEl ? customUnitEl.value : 'minutes';
      repText = `Every ${num} ${unit}`;
    }
    prevRepeat.innerHTML = `<i class="fa-solid fa-repeat mr-1"></i>${repText}`;
  }

  if (prevSound) {
    prevSound.innerHTML = `<i class="fa-solid fa-music mr-1"></i>${getReminderSoundLabel(soundId)}`;
  }

  if (prevMode && prevIcon) {
    if (alertStyle === 'sound_only') {
      prevMode.textContent = 'Sound Only (No Banner)';
      prevMode.className = 'text-[9px] bg-purple-700/80 px-1.5 py-0.5 rounded text-purple-200 font-bold';
      prevIcon.className = 'fa-solid fa-volume-high';
      if (prevFooter) prevFooter.textContent = 'Alert sound plays, no banner popup';
    } else if (alertStyle === 'banner_only') {
      prevMode.textContent = 'Banner Only (Silent)';
      prevMode.className = 'text-[9px] bg-slate-700/80 px-1.5 py-0.5 rounded text-slate-300 font-medium';
      prevIcon.className = 'fa-solid fa-message';
      if (prevFooter) prevFooter.textContent = 'Popup banner appears, silent';
    } else {
      prevMode.textContent = 'Banner + Sound';
      prevMode.className = 'text-[9px] bg-blue-700/80 px-1.5 py-0.5 rounded text-blue-200 font-bold';
      prevIcon.className = 'fa-solid fa-bell';
      if (prevFooter) prevFooter.textContent = 'Popup banner appears with sound';
    }
  }

  const quietToggle = document.getElementById('reminderQuietHoursToggle');
  const quietStartEl = document.getElementById('reminderQuietStart');
  const quietEndEl = document.getElementById('reminderQuietEnd');
  const prevQuietBox = document.getElementById('previewQuietBox');
  const prevQuietText = document.getElementById('previewQuietText');

  if (prevQuietBox && quietToggle) {
    if (quietToggle.checked) {
      prevQuietBox.classList.remove('hidden');
      if (prevQuietText) {
        const s = quietStartEl ? quietStartEl.value : '22:00';
        const e = quietEndEl ? quietEndEl.value : '07:00';
        prevQuietText.textContent = `Quiet Hours: ${_formatTime12h(s)} - ${_formatTime12h(e)} (Alarms Muted)`;
      }
    } else {
      prevQuietBox.classList.add('hidden');
    }
  }
}

// --------------- Test Notification Dispatcher ----------------------------

async function testCurrentReminderForm() {
  const titleEl = document.getElementById('reminderTitle');
  const noteEl = document.getElementById('reminderNote');
  const alertStyleRadio = document.querySelector('input[name="alertStyle"]:checked');
  const soundEl = document.getElementById('reminderSoundSelect');

  const title = (titleEl && titleEl.value.trim()) || 'Life Tracker Reminder (Test)';
  const note = (noteEl && noteEl.value.trim()) || 'This is how your alert will sound/appear.';
  const alertStyle = alertStyleRadio ? alertStyleRadio.value : 'both';
  const soundId = soundEl ? soundEl.value : 'default';

  const feedback = document.getElementById('testFeedbackMsg');

  if (alertStyle === 'sound_only') {
    // Only play sound, no banner!
    playReminderSound(soundId);
    if (feedback) {
      feedback.textContent = `✓ Notification sound played (${getReminderSoundLabel(soundId)})! (Sound-only mode, banner suppressed)`;
      feedback.className = 'text-[10px] text-purple-600 font-medium text-center mt-1';
      feedback.classList.remove('hidden');
      setTimeout(() => { if (feedback) feedback.classList.add('hidden'); }, 4000);
    }
    return;
  }

  if (alertStyle === 'banner_only') {
    // Only banner, silent
    await _dispatchNotificationNow(title, note, false);
    if (feedback) {
      feedback.textContent = '✓ Silent notification banner sent!';
      feedback.className = 'text-[10px] text-slate-600 font-medium text-center mt-1';
      feedback.classList.remove('hidden');
      setTimeout(() => { if (feedback) feedback.classList.add('hidden'); }, 4000);
    }
    return;
  }

  // 'both': Sound + Banner
  playReminderSound(soundId);
  await _dispatchNotificationNow(title, note, true);
  if (feedback) {
    feedback.textContent = `✓ Test notification banner sent with sound (${getReminderSoundLabel(soundId)})!`;
    feedback.className = 'text-[10px] text-emerald-600 font-medium text-center mt-1';
    feedback.classList.remove('hidden');
    setTimeout(() => { if (feedback) feedback.classList.add('hidden'); }, 4000);
  }
}

async function testSpecificReminderAlert(id) {
  const rem = (appData.reminders || []).find(r => r.id === id);
  if (!rem) return;

  const style = rem.alertStyle || 'both';
  const title = rem.title || 'Life Tracker Reminder';
  const note = rem.note || `Alert test for "${title}" (${getReminderRepeatLabel(rem)})`;
  const soundId = rem.sound || 'default';

  if (style === 'sound_only') {
    playReminderSound(soundId);
    return;
  }

  if (style === 'banner_only') {
    await _dispatchNotificationNow(title, note, false, rem.id);
    return;
  }

  // 'both': Sound + Banner
  playReminderSound(soundId);
  await _dispatchNotificationNow(title, note, true, rem.id);
}

async function testQuickBrowserPermission() {
  await requestNotificationPermissionWithFeedback();
  playNotificationChime();
  await _dispatchNotificationNow('Life Tracker Alert Test', 'Notifications are working! Tapping opens reminders like Splitwise.', true);
}

async function requestNotificationPermissionWithFeedback() {
  if (!('Notification' in window)) {
    if (typeof showAlert === 'function') await showAlert('This browser does not support Web Notifications.');
    return;
  }
  const result = await Notification.requestPermission();
  _checkPermBanner();
  if (result === 'granted') {
    if (typeof showAlert === 'function') await showAlert('Notifications enabled! You will now receive alerts.');
  }
}

function _checkPermBanner() {
  const banner = document.getElementById('reminderPermBanner');
  if (!banner) return;
  if ('Notification' in window && Notification.permission === 'default') {
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

async function _dispatchNotificationNow(title, body, withSound = true, reminderId = null) {
  // Show in-app banner so alert is immediately visible inside browser
  _showInAppAlertBanner(title, body, reminderId);

  if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications) {
    try {
      const { LocalNotifications } = Capacitor.Plugins;
      await _ensureNativeNotificationChannel();
      await LocalNotifications.requestPermissions();
      await LocalNotifications.schedule({
        notifications: [{
          title: title,
          body: body,
          id: Math.floor(Math.random() * 900000) + 100000,
          schedule: { at: new Date(Date.now() + 500), allowWhileIdle: true },
          channelId: withSound ? 'reminders_high_priority' : 'reminders_silent_banner',
          smallIcon: 'ic_notification',
          sound: withSound ? 'default' : undefined,
          extra: { reminderId: reminderId || '' }
        }]
      });
      return;
    } catch (e) {
      console.warn('Native test notification error:', e);
    }
  }

  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body: body,
            icon: './icons/icon-192.png',
            badge: './icons/icon-192.png',
            tag: 'test_alert_' + (reminderId || Date.now()),
            data: { reminderId: reminderId || '' },
            requireInteraction: true,
            silent: !withSound,
            vibrate: withSound ? [300, 100, 300] : undefined
          });
        }).catch(() => {
          _directWebNotificationFallback(title, body, reminderId);
        });
      } else {
        _directWebNotificationFallback(title, body, reminderId);
      }
    } else if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }
}

// --------------- Save Reminder -------------------------------------------

async function handleSaveReminderSubmit(e, editId) {
  e.preventDefault();
  const title = document.getElementById('reminderTitle').value.trim();
  const datetime = document.getElementById('reminderDatetime').value;
  const repeat = document.getElementById('reminderRepeat').value;
  const note = document.getElementById('reminderNote').value.trim();
  const alertStyleRadio = document.querySelector('input[name="alertStyle"]:checked');
  const alertStyle = alertStyleRadio ? alertStyleRadio.value : 'both';

  const soundEl = document.getElementById('reminderSoundSelect');
  const sound = soundEl ? soundEl.value : 'default';

  const quietToggle = document.getElementById('reminderQuietHoursToggle');
  const quietHoursEnabled = quietToggle ? quietToggle.checked : false;
  const quietStartEl = document.getElementById('reminderQuietStart');
  const quietStart = quietStartEl ? quietStartEl.value : '22:00';
  const quietEndEl = document.getElementById('reminderQuietEnd');
  const quietEnd = quietEndEl ? quietEndEl.value : '07:00';

  let customInterval = 15;
  let customUnit = 'minutes';
  if (repeat === 'Custom') {
    const numEl = document.getElementById('customIntervalNum');
    const unitEl = document.getElementById('customIntervalUnit');
    customInterval = parseInt(numEl ? numEl.value : '15', 10) || 15;
    customUnit = unitEl ? unitEl.value : 'minutes';
  }

  if (!title || !datetime) return;
  if (!appData.reminders) appData.reminders = [];

  let savedItem = null;

  if (editId) {
    const rem = appData.reminders.find(r => r.id === editId);
    if (rem) {
      rem.title = title;
      rem.datetime = datetime;
      rem.repeat = repeat;
      rem.customInterval = customInterval;
      rem.customUnit = customUnit;
      rem.alertStyle = alertStyle;
      rem.sound = sound;
      rem.quietHoursEnabled = quietHoursEnabled;
      rem.quietStart = quietStart;
      rem.quietEnd = quietEnd;
      rem.note = note;
      rem.completed = false;
      rem.notified = false;
      savedItem = rem;
    }
  } else {
    savedItem = {
      id: 'rem_' + Date.now(),
      title,
      datetime,
      repeat,
      customInterval,
      customUnit,
      alertStyle,
      sound,
      quietHoursEnabled,
      quietStart,
      quietEnd,
      note,
      paused: false,
      completed: false,
      notified: false,
      createdAt: new Date().toISOString()
    };
    appData.reminders.push(savedItem);
  }

  await saveState();

  if (alertStyle !== 'sound_only' && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  if (savedItem) {
    await _scheduleNativeNotification(savedItem);
    renderReminderDetailView(savedItem.id);
  } else {
    renderRemindersListView();
  }
}

function _calculateNextReminderDatetime(datetimeStr, repeat, customInterval, customUnit) {
  const dt = new Date(datetimeStr);
  const interval = Number(customInterval) || 1;

  if (repeat === 'Every Minute') dt.setMinutes(dt.getMinutes() + 1);
  else if (repeat === 'Hourly') dt.setHours(dt.getHours() + 1);
  else if (repeat === 'Daily') dt.setDate(dt.getDate() + 1);
  else if (repeat === 'Weekly') dt.setDate(dt.getDate() + 7);
  else if (repeat === 'Monthly') dt.setMonth(dt.getMonth() + 1);
  else if (repeat === 'Yearly') dt.setFullYear(dt.getFullYear() + 1);
  else if (repeat === 'Custom') {
    if (customUnit === 'minutes') dt.setMinutes(dt.getMinutes() + interval);
    else if (customUnit === 'hours') dt.setHours(dt.getHours() + interval);
    else if (customUnit === 'days') dt.setDate(dt.getDate() + interval);
    else if (customUnit === 'weeks') dt.setDate(dt.getDate() + (interval * 7));
    else if (customUnit === 'months') dt.setMonth(dt.getMonth() + interval);
  }

  const now = new Date();
  if (dt <= now) {
    if (repeat === 'Every Minute') dt.setTime(now.getTime() + 60000);
    else if (repeat === 'Hourly') dt.setTime(now.getTime() + 3600000);
    else if (repeat === 'Custom' && customUnit === 'minutes') dt.setTime(now.getTime() + (interval * 60000));
  }

  return _toLocalDatetimeString(dt);
}

// --------------- Background / Periodic Engine (Browser) -----------------
let _reminderCheckInterval = null;

function startReminderEngine() {
  if (_reminderCheckInterval) return;
  _ensureNativeNotificationChannel();
  _setupNativeNotificationClickListener();

  _reminderCheckInterval = setInterval(_checkAndFireReminders, 5000);
  setTimeout(_checkAndFireReminders, 1500);
}

function _checkAndFireReminders() {
  if (!appData.reminders || appData.reminders.length === 0) return;
  const now = new Date();
  let changed = false;

  appData.reminders.forEach(r => {
    // Skip if paused or completed or already notified
    if (r.paused || r.completed || r.notified) return;

    const dt = new Date(r.datetime);
    if (dt <= now) {
      // Check Quiet Hours / Do Not Disturb
      const isQuiet = r.quietHoursEnabled && _isTimeInQuietHours(now, r.quietStart, r.quietEnd);

      if (isQuiet) {
        // Between quiet hours timeframe: suppress all alarm sound & disturbance!
        console.log(`[Reminders] Quiet hours active for "${r.title}". Alarm sound suppressed.`);

        if (r.repeat && r.repeat !== 'None') {
          // Recurring: silently advance to next interval without disturbing the user
          r.datetime = _calculateNextReminderDatetime(r.datetime, r.repeat, r.customInterval, r.customUnit);
          r.notified = false;
          _scheduleNativeNotification(r);
        } else {
          // One-time: postpone until quiet hours end so user is notified when they wake up
          const endDt = _calculateQuietHoursEndTime(now, r.quietEnd);
          r.datetime = _toLocalDatetimeString(endDt);
          r.notified = false;
          _scheduleNativeNotification(r);
        }
        changed = true;
        return;
      }

      r.lastSentAt = now.toISOString();
      const style = r.alertStyle || 'both';

      // 1. Play sound if 'both' or 'sound_only'
      if (style === 'both' || style === 'sound_only') {
        playReminderSound(r.sound || 'default');
      }

      // 2. Dispatch banner if 'both' or 'banner_only'
      if (style === 'both' || style === 'banner_only') {
        _fireBrowserNotification(r);
      }

      // 3. Recurrence calculation vs one-time
      if (r.repeat && r.repeat !== 'None') {
        r.datetime = _calculateNextReminderDatetime(r.datetime, r.repeat, r.customInterval, r.customUnit);
        r.notified = false;
        _scheduleNativeNotification(r);
      } else {
        r.notified = true;
      }
      changed = true;
    }
  });

  if (changed) {
    saveState();
    const overlay = document.getElementById('remindersOverlay');
    if (overlay && !overlay.classList.contains('hidden')) {
      const subHeader = document.getElementById('remindersSubHeader');
      if (subHeader && subHeader.classList.contains('hidden')) {
        renderRemindersListView();
      }
    }
  }
}

// --------------- In-App Alert Banner & Browser Notifications -------------

function _showInAppAlertBanner(title, body, reminderId) {
  try {
    const existing = document.getElementById('inAppReminderAlertBanner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'inAppReminderAlertBanner';
    banner.className = 'fixed top-3 left-3 right-3 max-w-md mx-auto z-50 bg-slate-900/95 text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700/60 backdrop-blur-md transition-all duration-300 ease-out -translate-y-6 opacity-0 flex items-start gap-3 cursor-pointer';

    banner.innerHTML = `
      <div class="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white text-sm shrink-0 shadow-md shadow-blue-500/30">
        <i class="fa-solid fa-bell"></i>
      </div>
      <div class="flex-1 min-w-0" onclick="${reminderId ? `openRemindersOverlay('${reminderId}')` : `openRemindersOverlay('list')`}; document.getElementById('inAppReminderAlertBanner')?.remove();">
        <div class="flex items-center justify-between gap-1">
          <span class="text-[10px] font-bold uppercase tracking-wider text-blue-400">Life Tracker Alert</span>
          <span class="text-[9px] text-slate-400">Now</span>
        </div>
        <p class="text-xs font-bold text-white mt-0.5 truncate">${_escapeHtml(title)}</p>
        ${body ? `<p class="text-[11px] text-slate-300 mt-0.5 line-clamp-2">${_escapeHtml(body)}</p>` : ''}
        <p class="text-[9px] text-blue-300 mt-1 flex items-center gap-1 font-medium"><i class="fa-solid fa-arrow-right text-[8px]"></i> Tap to open reminder</p>
      </div>
      <button onclick="event.stopPropagation(); document.getElementById('inAppReminderAlertBanner')?.remove();" class="w-6 h-6 rounded-lg text-slate-400 hover:text-white flex items-center justify-center shrink-0" aria-label="Dismiss">
        <i class="fa-solid fa-xmark text-xs"></i>
      </button>
    `;

    document.body.appendChild(banner);

    requestAnimationFrame(() => {
      banner.classList.remove('-translate-y-6', 'opacity-0');
      banner.classList.add('translate-y-0', 'opacity-100');
    });

    setTimeout(() => {
      if (banner && banner.parentNode) {
        banner.classList.remove('translate-y-0', 'opacity-100');
        banner.classList.add('-translate-y-6', 'opacity-0');
        setTimeout(() => banner.remove(), 300);
      }
    }, 10000);
  } catch (e) {
    console.warn('Could not display in-app alert banner:', e);
  }
}

// Service worker message receiver to open reminder on notification click
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'OPEN_REMINDER' && event.data.reminderId) {
      if (typeof openRemindersOverlay === 'function') {
        openRemindersOverlay(event.data.reminderId);
      }
    }
  });
}

function _fireBrowserNotification(reminder) {
  const dt = new Date(reminder.datetime);
  const timeStr = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const rep = getReminderRepeatLabel(reminder);
  const title = `Life Tracker: ${reminder.title}`;
  const body = `${reminder.note ? reminder.note + '\n' : ''}Scheduled: ${timeStr} • ${rep}`;

  // 1. Always display guaranteed in-app visual banner if tab is open
  _showInAppAlertBanner(reminder.title, reminder.note, reminder.id);

  // 2. Dispatch system notification (via ServiceWorker or desktop Notification API)
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, {
          body: body,
          icon: './icons/icon-192.png',
          badge: './icons/icon-192.png',
          tag: reminder.id,
          data: { reminderId: reminder.id },
          requireInteraction: true,
          vibrate: [300, 100, 300]
        });
      }).catch(() => {
        _directWebNotificationFallback(title, body, reminder.id);
      });
    } else {
      _directWebNotificationFallback(title, body, reminder.id);
    }
  } else if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function _directWebNotificationFallback(title, body, reminderId) {
  try {
    const notif = new Notification(title, {
      body: body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: reminderId || undefined,
      requireInteraction: true,
      vibrate: [300, 100, 300]
    });
    notif.onclick = () => {
      window.focus();
      if (reminderId) openRemindersOverlay(reminderId);
      else openRemindersOverlay('list');
      notif.close();
    };
  } catch (err) {
    console.warn('Direct web notification fallback error:', err);
  }
}

// --------------- Capacitor / Android High Priority Channel & Listener ----
let _channelInitialized = false;

async function _ensureNativeNotificationChannel() {
  if (_channelInitialized) return;
  if (typeof Capacitor === 'undefined' || !Capacitor.Plugins || !Capacitor.Plugins.LocalNotifications) return;

  try {
    const { LocalNotifications } = Capacitor.Plugins;

    // High priority heads-up channel for banner + sound
    await LocalNotifications.createChannel({
      id: 'reminders_high_priority',
      name: 'Life Tracker Reminders (Heads-Up)',
      description: 'Banner reminder notifications and alerts',
      importance: 5, // IMPORTANCE_HIGH (heads-up banner)
      visibility: 1, // VISIBILITY_PUBLIC (lockscreen banner)
      sound: 'default',
      vibration: true,
      lights: true,
      lightColor: '#2563eb'
    });

    // Sound-only channel: standard importance (makes sound, no heads-up banner popup)
    await LocalNotifications.createChannel({
      id: 'reminders_sound_only',
      name: 'Life Tracker Reminders (Sound Only)',
      description: 'Sound-only reminder alerts without banner popup',
      importance: 3, // IMPORTANCE_DEFAULT (sound, standard tray)
      visibility: 1,
      sound: 'default',
      vibration: true
    });

    // Silent banner channel
    await LocalNotifications.createChannel({
      id: 'reminders_silent_banner',
      name: 'Life Tracker Reminders (Silent)',
      description: 'Silent banner notifications',
      importance: 4,
      visibility: 1,
      vibration: false
    });

    _channelInitialized = true;
  } catch (e) {
    console.warn('Could not initialize native notification channels:', e);
  }
}

function _setupNativeNotificationClickListener() {
  if (typeof Capacitor === 'undefined' || !Capacitor.Plugins || !Capacitor.Plugins.LocalNotifications) return;

  try {
    const { LocalNotifications } = Capacitor.Plugins;
    LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const extraId = action.notification?.extra?.reminderId;
      const notifId = action.notification?.id;
      
      const match = (appData.reminders || []).find(r => 
        (extraId && r.id === extraId) || 
        _reminderIdToInt(r.id) === notifId
      );

      if (match) {
        match.lastSentAt = new Date().toISOString();
        saveState();
        openRemindersOverlay(match.id);
      } else {
        openRemindersOverlay('list');
      }
    });

    LocalNotifications.addListener('localNotificationReceived', (notification) => {
      const extraId = notification?.extra?.reminderId;
      const notifId = notification?.id;
      const match = (appData.reminders || []).find(r => 
        (extraId && r.id === extraId) || 
        _reminderIdToInt(r.id) === notifId
      );
      if (match) {
        match.lastSentAt = new Date().toISOString();
        saveState();
      }
    });
  } catch (e) {
    console.warn('Failed to register notification action listener:', e);
  }
}

async function _scheduleNativeNotification(reminder) {
  if (!reminder) return;
  if (typeof Capacitor === 'undefined' || !Capacitor.Plugins || !Capacitor.Plugins.LocalNotifications) return;

  try {
    const { LocalNotifications } = Capacitor.Plugins;
    await _ensureNativeNotificationChannel();

    const idInt = _reminderIdToInt(reminder.id);

    // Cancel existing
    try {
      await LocalNotifications.cancel({ notifications: [{ id: idInt }] });
    } catch (ignore) {}

    // If paused or completed, do not schedule
    if (reminder.paused || reminder.completed) return;

    await LocalNotifications.requestPermissions();

    const dt = new Date(reminder.datetime);
    let targetDt = dt;
    if (reminder.quietHoursEnabled && _isTimeInQuietHours(dt, reminder.quietStart, reminder.quietEnd)) {
      targetDt = _calculateQuietHoursEndTime(dt, reminder.quietEnd);
    }

    let every = undefined;
    if (reminder.repeat === 'Every Minute') every = 'minute';
    else if (reminder.repeat === 'Hourly') every = 'hour';
    else if (reminder.repeat === 'Daily') every = 'day';
    else if (reminder.repeat === 'Weekly') every = 'week';
    else if (reminder.repeat === 'Monthly') every = 'month';
    else if (reminder.repeat === 'Yearly') every = 'year';

    const scheduleConfig = {
      at: targetDt,
      allowWhileIdle: true
    };

    if (every) {
      scheduleConfig.repeats = true;
      scheduleConfig.every = every;
    }

    const style = reminder.alertStyle || 'both';
    let channelId = 'reminders_high_priority';
    if (style === 'sound_only') channelId = 'reminders_sound_only';
    else if (style === 'banner_only') channelId = 'reminders_silent_banner';

    await LocalNotifications.schedule({
      notifications: [{
        title: reminder.title,
        body: reminder.note || `Life Tracker Reminder • ${getReminderRepeatLabel(reminder)}`,
        id: idInt,
        schedule: scheduleConfig,
        channelId: channelId,
        smallIcon: 'ic_notification',
        largeIcon: 'ic_notification',
        sound: style === 'banner_only' ? undefined : 'default',
        extra: { reminderId: reminder.id }
      }]
    });
  } catch (e) {
    console.warn('Native notification scheduling failed:', e);
  }
}

function _reminderIdToInt(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
