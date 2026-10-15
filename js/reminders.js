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
function playReminderSound(soundId, onEnded) {
  let activeAudio = null;

  // If running on native Android, play sound via native MediaPlayer for crisp loud audio!
  if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.AlarmPlugin && typeof Capacitor.Plugins.AlarmPlugin.playSound === 'function') {
    try {
      Capacitor.Plugins.AlarmPlugin.playSound({ soundId: soundId || 'default' });
      if (typeof onEnded === 'function') {
        setTimeout(onEnded, 600);
      }
      return { audio: null };
    } catch (e) {
      console.warn('Native playSound error, fallback to web audio:', e);
    }
  }

  const triggerEnded = (durationMs = 600) => {
    if (typeof onEnded === 'function') {
      setTimeout(() => {
        onEnded();
      }, durationMs);
    }
  };

  if (!soundId || soundId === 'default') {
    playNotificationChime();
    triggerEnded(600);
    return { audio: null };
  }
  if (soundId === 'bell') {
    playBellChime();
    triggerEnded(650);
    return { audio: null };
  }
  if (soundId === 'digital') {
    playDigitalBeep();
    triggerEnded(250);
    return { audio: null };
  }
  if (soundId === 'marimba') {
    playMarimbaSound();
    triggerEnded(600);
    return { audio: null };
  }

  // Custom uploaded sound lookup
  const custom = (appData.reminderSounds || []).find(s => s.id === soundId);
  if (custom && custom.data) {
    try {
      const audio = new Audio(custom.data);
      audio.volume = 1.0;
      activeAudio = audio;
      let finished = false;
      const finishOnce = () => {
        if (!finished) {
          finished = true;
          if (typeof onEnded === 'function') onEnded();
        }
      };
      audio.addEventListener('ended', finishOnce, { once: true });
      audio.addEventListener('error', finishOnce, { once: true });
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn('Custom sound playback blocked, falling back to default sound:', err);
          playNotificationChime();
          triggerEnded(600);
        });
      }
      // Safety timeout for custom audio
      setTimeout(finishOnce, 15000);
      return { audio: activeAudio };
    } catch (e) {
      console.warn('Custom sound play error, falling back to default:', e);
      playNotificationChime();
      triggerEnded(600);
      return { audio: null };
    }
  }

  // Fallback to default chime
  playNotificationChime();
  triggerEnded(600);
  return { audio: null };
}

// Notification sound repetition sequence controller (fixed 2-second pause between chimes)
let _currentNotificationSequence = null;

function stopNotificationSoundSequence() {
  if (_currentNotificationSequence) {
    _currentNotificationSequence.stopped = true;
    if (_currentNotificationSequence.gapTimer) {
      clearTimeout(_currentNotificationSequence.gapTimer);
      _currentNotificationSequence.gapTimer = null;
    }
    if (_currentNotificationSequence.activeAudio) {
      try {
        _currentNotificationSequence.activeAudio.pause();
        _currentNotificationSequence.activeAudio.currentTime = 0;
      } catch (e) {}
      _currentNotificationSequence.activeAudio = null;
    }
    _hideNotificationStopPill();
    const onFinished = _currentNotificationSequence.onFinished;
    _currentNotificationSequence = null;
    if (typeof onFinished === 'function') {
      try { onFinished(false); } catch (e) {}
    }
  }

  // Also stop native Android notification sound if running on device
  if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.AlarmPlugin && typeof Capacitor.Plugins.AlarmPlugin.stopSound === 'function') {
    try {
      Capacitor.Plugins.AlarmPlugin.stopSound();
    } catch (e) {}
  }

  _hideNotificationStopPill();
}

function stopReminderSpeechSequence() {
  if (_currentSpeechSequence) {
    _currentSpeechSequence.stopped = true;
    if (_currentSpeechSequence.gapTimer) {
      clearTimeout(_currentSpeechSequence.gapTimer);
      _currentSpeechSequence.gapTimer = null;
    }
    const onFinished = _currentSpeechSequence.onFinished;
    _currentSpeechSequence = null;
    if (typeof onFinished === 'function') {
      try { onFinished(false); } catch (e) {}
    }
  }

  stopReminderSpeech();
  _hideNotificationStopPill();
}

function stopAnyReminderAlert() {
  stopNotificationSoundSequence();
  stopReminderSpeechSequence();
}

function playNotificationSoundSequence(soundId, playCount = 1, onFinished = null) {
  stopAnyReminderAlert();

  const totalPlays = Math.max(1, parseInt(playCount, 10) || 1);

  // If on native Android and playSound is available
  if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.AlarmPlugin && typeof Capacitor.Plugins.AlarmPlugin.playSound === 'function') {
    _setupNativeAlarmListener();
    if (totalPlays > 1) {
      _showNotificationStopPill(1, totalPlays, false);
    }
    Capacitor.Plugins.AlarmPlugin.playSound({ soundId: soundId || 'default', playCount: totalPlays })
      .then(() => {
        _hideNotificationStopPill();
        if (typeof onFinished === 'function') onFinished(true);
      })
      .catch(e => {
        console.warn('Native AlarmPlugin.playSound error, fallback to web audio:', e);
        _playWebNotificationSoundSequence(soundId, totalPlays, onFinished);
      });
    return;
  }

  _playWebNotificationSoundSequence(soundId, totalPlays, onFinished);
}

function _playWebNotificationSoundSequence(soundId, totalPlays, onFinished) {
  if (totalPlays <= 1) {
    playReminderSound(soundId, () => {
      if (typeof onFinished === 'function') onFinished(true);
    });
    return;
  }

  const seq = {
    stopped: false,
    currentPlay: 0,
    totalPlays: totalPlays,
    gapTimer: null,
    activeAudio: null,
    onFinished: onFinished
  };
  _currentNotificationSequence = seq;

  const playStep = () => {
    if (seq.stopped) return;
    seq.currentPlay += 1;

    _showNotificationStopPill(seq.currentPlay, seq.totalPlays, false);

    const soundRes = playReminderSound(soundId, () => {
      if (seq.stopped) return;
      if (seq.currentPlay >= seq.totalPlays) {
        // Completed all repetitions!
        _hideNotificationStopPill();
        const finishCb = seq.onFinished;
        _currentNotificationSequence = null;
        if (typeof finishCb === 'function') {
          try { finishCb(true); } catch (e) {}
        }
      } else {
        // Gap of exactly 2 seconds (2000 ms) before next repetition
        seq.gapTimer = setTimeout(() => {
          seq.gapTimer = null;
          playStep();
        }, 2000);
      }
    });

    if (soundRes && soundRes.audio) {
      seq.activeAudio = soundRes.audio;
    }
  };

  playStep();
}

function _showNotificationStopPill(current, total, isVoice = false) {
  let pill = document.getElementById('notificationSoundStopPill');
  if (!pill) {
    pill = document.createElement('div');
    pill.id = 'notificationSoundStopPill';
    pill.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 z-[10000] bg-slate-900/95 text-white px-3.5 py-2 rounded-full shadow-2xl border border-slate-700/80 backdrop-blur-md flex items-center gap-2.5 text-xs font-semibold transition-all pointer-events-auto';
    document.body.appendChild(pill);
  }
  const label = isVoice ? 'Speaking alert' : 'Playing alert';
  pill.innerHTML = `
    <span class="flex items-center gap-1.5 ${isVoice ? 'text-purple-400' : 'text-blue-400'}">
      <i class="fa-solid fa-volume-high animate-bounce text-xs"></i>
      <span class="text-[11px] text-white">${label} (${current}/${total})</span>
    </span>
    <button type="button" onclick="stopAnyReminderAlert()" class="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full text-[10px] font-bold transition flex items-center gap-1 shadow-sm">
      <i class="fa-solid fa-stop text-[8px]"></i> Stop
    </button>
  `;
  pill.classList.remove('hidden');
}

function _hideNotificationStopPill() {
  const pill = document.getElementById('notificationSoundStopPill');
  if (pill) {
    pill.classList.add('hidden');
  }
}

let _currentSpeechSequence = null;

function speakReminderTitleSequence(title, playCount = 1, onFinished = null) {
  stopAnyReminderAlert();

  if (!title) {
    if (typeof onFinished === 'function') onFinished(true);
    return;
  }

  const totalPlays = Math.max(1, parseInt(playCount, 10) || 1);

  // 1. If running on native Android, use native Android TTS via AlarmPlugin!
  if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.AlarmPlugin && typeof Capacitor.Plugins.AlarmPlugin.speak === 'function') {
    _setupNativeAlarmListener();
    if (totalPlays > 1) {
      _showNotificationStopPill(1, totalPlays, true);
    }
    let finished = false;
    const done = (success) => {
      if (!finished) {
        finished = true;
        _hideNotificationStopPill();
        if (typeof onFinished === 'function') onFinished(success);
      }
    };
    Capacitor.Plugins.AlarmPlugin.speak({ text: String(title), isAlarm: false, playCount: totalPlays })
      .then(() => {
        done(true);
      })
      .catch(err => {
        console.warn('Native AlarmPlugin.speak error, trying Web Speech sequence fallback:', err);
        _speakWebSpeechSequence(title, totalPlays, onFinished);
      });
    return;
  }

  // 2. Desktop browser / PWA fallback
  _speakWebSpeechSequence(title, totalPlays, onFinished);
}

function _speakWebSpeechSequence(title, totalPlays, onFinished) {
  if (totalPlays <= 1) {
    _speakWithWebSpeech(title, () => {
      if (typeof onFinished === 'function') onFinished(true);
    });
    return;
  }

  const seq = {
    stopped: false,
    currentPlay: 0,
    totalPlays: totalPlays,
    gapTimer: null,
    onFinished: onFinished
  };
  _currentSpeechSequence = seq;

  const playStep = () => {
    if (seq.stopped) return;
    seq.currentPlay += 1;

    _showNotificationStopPill(seq.currentPlay, seq.totalPlays, true);

    _speakWithWebSpeech(title, () => {
      if (seq.stopped) return;
      if (seq.currentPlay >= seq.totalPlays) {
        _hideNotificationStopPill();
        const finishCb = seq.onFinished;
        _currentSpeechSequence = null;
        if (typeof finishCb === 'function') {
          try { finishCb(true); } catch (e) {}
        }
      } else {
        // Gap of exactly 2 seconds (2000 ms) before next repetition
        seq.gapTimer = setTimeout(() => {
          seq.gapTimer = null;
          playStep();
        }, 2000);
      }
    });
  };

  playStep();
}

function speakReminderTitle(title, onComplete) {
  speakReminderTitleSequence(title, 1, onComplete);
}

function stopReminderSpeech() {
  if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.AlarmPlugin && typeof Capacitor.Plugins.AlarmPlugin.stopSpeech === 'function') {
    try { Capacitor.Plugins.AlarmPlugin.stopSpeech(); } catch (e) {}
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch (e) {}
  }
}

function previewReminderAlert(reminder) {
  if (!reminder) return;
  const playCount = (reminder.alertMode === 'notification') ? Math.max(1, parseInt(reminder.playCount, 10) || 1) : 1;
  if (reminder.speakTitle) {
    speakReminderTitleSequence(reminder.title, playCount);
  } else {
    playNotificationSoundSequence(reminder.sound || 'default', playCount);
  }
}

function previewReminderAlertById(id) {
  const rem = (appData.reminders || []).find(r => String(r.id) === String(id));
  if (rem) {
    previewReminderAlert(rem);
  }
}

function _speakWithWebSpeech(title, onComplete) {
  if (!title || typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (typeof onComplete === 'function') onComplete();
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(title);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      const match = voices.find(v => v.lang.startsWith(navigator.language.slice(0, 2))) || voices[0];
      if (match) utterance.voice = match;
    }

    let finished = false;
    const done = () => {
      if (!finished) {
        finished = true;
        if (typeof onComplete === 'function') onComplete();
      }
    };

    utterance.onend = done;
    utterance.onerror = done;
    setTimeout(done, 3500);

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('Speech synthesis error:', e);
    if (typeof onComplete === 'function') onComplete();
  }
}

// Looping sound player for continuous alarm clock ringing
let _currentAlarmAudio = null;
let _currentAlarmLoopInterval = null;

function playReminderSoundLoop(soundId) {
  stopReminderSoundLoop();

  const custom = (appData.reminderSounds || []).find(s => s.id === soundId);
  if (custom && custom.data) {
    try {
      const audio = new Audio(custom.data);
      audio.loop = true;
      audio.volume = 1.0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn('Custom loop playback blocked, using preset loop:', err);
          _startPresetToneLoop(soundId);
        });
      }
      _currentAlarmAudio = audio;
      return;
    } catch (e) {
      console.warn('Custom audio element error:', e);
    }
  }

  _startPresetToneLoop(soundId);
}

function _startPresetToneLoop(soundId) {
  playReminderSound(soundId);
  _currentAlarmLoopInterval = setInterval(() => {
    playReminderSound(soundId);
  }, 2200);
}

function stopReminderSoundLoop() {
  if (_currentAlarmAudio) {
    try {
      _currentAlarmAudio.pause();
      _currentAlarmAudio.currentTime = 0;
    } catch (e) {}
    _currentAlarmAudio = null;
  }
  if (_currentAlarmLoopInterval) {
    clearInterval(_currentAlarmLoopInterval);
    _currentAlarmLoopInterval = null;
  }
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

      // Sync custom sound to native Android storage for AlarmService playback when locked
      if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.AlarmPlugin) {
        try {
          await Capacitor.Plugins.AlarmPlugin.saveCustomSound({
            id: newSound.id,
            name: newSound.name,
            data: newSound.data
          });
        } catch (e) {
          console.warn('Native custom sound sync error:', e);
        }
      }

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

  // Delete from native Android storage
  if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.AlarmPlugin) {
    try {
      await Capacitor.Plugins.AlarmPlugin.deleteCustomSound({ id: soundId });
    } catch (e) {}
  }

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

// Filter state for Reminders list (All vs Favorites)
let _remindersFilter = 'all';

function setRemindersFilter(filter) {
  _remindersFilter = filter;
  renderRemindersListView();
}
window.setRemindersFilter = setRemindersFilter;

function renderRemindersListView() {
  _saveRemindersUiState('list', null);
  const subHeader = document.getElementById('remindersSubHeader');
  if (subHeader) subHeader.classList.add('hidden'); // Hidden in list view, exactly like Splitwise

  const content = document.getElementById('remindersOverlayContent');
  if (!content) return;

  const list = appData.reminders || [];
  const totalActive = list.filter(r => !r.completed);
  const totalFavCount = totalActive.filter(r => Boolean(r.favorite || r.favourite)).length;

  let activeList = list.filter(r => !r.completed);
  if (_remindersFilter === 'favorites') {
    activeList = activeList.filter(r => Boolean(r.favorite || r.favourite));
  }
  activeList.sort((a, b) => {
    const aFav = Boolean(a.favorite || a.favourite);
    const bFav = Boolean(b.favorite || b.favourite);
    if (aFav !== bFav) return aFav ? -1 : 1; // Favorites list at the top!
    return a.datetime.localeCompare(b.datetime);
  });

  let completedList = list.filter(r => r.completed);
  if (_remindersFilter === 'favorites') {
    completedList = completedList.filter(r => Boolean(r.favorite || r.favourite));
  }
  completedList.sort((a, b) => {
    const aFav = Boolean(a.favorite || a.favourite);
    const bFav = Boolean(b.favorite || b.favourite);
    if (aFav !== bFav) return aFav ? -1 : 1; // Favorites list at the top!
    return b.datetime.localeCompare(a.datetime);
  });

  const favActive = activeList.filter(r => Boolean(r.favorite || r.favourite));
  const regularActive = activeList.filter(r => !Boolean(r.favorite || r.favourite));

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

    <!-- Prominent Filter Tabs: All vs Favorites -->
    <div class="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
      <button type="button" onclick="setRemindersFilter('all')" class="flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${_remindersFilter === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'}">
        <span>All Reminders</span>
        <span class="text-[10px] px-1.5 py-0.2 rounded-full ${_remindersFilter === 'all' ? 'bg-slate-100 text-slate-700' : 'bg-slate-200/60 text-slate-500'} font-semibold">${totalActive.length}</span>
      </button>
      <button type="button" onclick="setRemindersFilter('favorites')" class="flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${_remindersFilter === 'favorites' ? 'bg-white text-amber-800 shadow-xs' : 'text-slate-500 hover:text-amber-600'}">
        <i class="fa-solid fa-star text-amber-500 text-[10px]"></i>
        <span>Favorites</span>
        <span class="text-[10px] px-1.5 py-0.2 rounded-full ${_remindersFilter === 'favorites' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200/60 text-slate-500'} font-semibold">${totalFavCount}</span>
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

    <!-- Exact Alarm Permission Banner for Android 12+ -->
    <div id="exactAlarmPermBanner" class="hidden p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <i class="fa-solid fa-clock text-rose-500 shrink-0"></i>
        <div>
          <p class="text-[11px] font-bold text-rose-800">Exact Alarm Access</p>
          <p class="text-[10px] text-rose-700">Allow Life Tracker to ring alarms when phone is locked.</p>
        </div>
      </div>
      <button onclick="requestExactAlarmPermission()" class="shrink-0 px-2.5 py-1 text-[11px] font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition">Allow</button>
    </div>

    <!-- Reminders list -->
    <div class="space-y-3">
      ${_remindersFilter === 'favorites' && activeList.length === 0 && completedList.length === 0 ? `
        <div class="text-center py-8 bg-white rounded-2xl border border-dashed border-amber-200 p-6 space-y-2">
          <i class="fa-solid fa-star text-2xl text-amber-400"></i>
          <p class="text-xs font-bold text-slate-700">No favorite reminders yet</p>
          <p class="text-[11px] text-slate-400 leading-relaxed">Tap the <span class="font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">★ Fav</span> button on any reminder to pin it here at the top.</p>
        </div>
      ` : ''}

      ${_remindersFilter === 'all' && activeList.length === 0 && completedList.length === 0 ? `
        <div class="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200 p-6 space-y-2">
          <i class="fa-solid fa-bell text-2xl text-slate-300"></i>
          <p class="text-xs text-slate-400">No reminders yet.<br>Tap "New Reminder" above to create an alert.</p>
        </div>
      ` : ''}

      ${_remindersFilter === 'all' && favActive.length > 0 ? `
        <!-- Pinned Favorites Section Header -->
        <div class="space-y-2">
          <div class="flex items-center justify-between px-1">
            <span class="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
              <i class="fa-solid fa-star text-amber-500 text-[10px]"></i> Pinned Favorites (${favActive.length})
            </span>
          </div>
          ${favActive.map(r => _renderReminderListRow(r)).join('')}
        </div>

        ${regularActive.length > 0 ? `
          <div class="space-y-2 pt-1">
            <div class="flex items-center justify-between px-1">
              <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Other Reminders (${regularActive.length})</span>
            </div>
            ${regularActive.map(r => _renderReminderListRow(r)).join('')}
          </div>
        ` : ''}
      ` : `
        ${activeList.length > 0 ? `
          <div class="space-y-2">
            ${activeList.map(r => _renderReminderListRow(r)).join('')}
          </div>
        ` : ''}
      `}

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
  _checkExactAlarmBanner();
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

// Clean row identical to Splitwise: Prominent Favorite button, quick pause/resume, status & repeat tags.
function _renderReminderListRow(r) {
  const dt = new Date(r.datetime);
  const status = getReminderStatus(r);
  const repeatLabel = getReminderRepeatLabel(r);
  const alertInfo = getAlertStyleInfo(r.alertStyle);
  const isFav = Boolean(r.favorite || r.favourite);

  const dateLabel = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeLabel = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const lastSentFormatted = _formatLastSent(r.lastSentAt || (r.notified ? r.datetime : null));

  return `
    <div onclick="openRemindersOverlay('${r.id}')" class="p-3.5 rounded-xl border ${isFav ? 'border-amber-300 bg-amber-50/30' : 'border-slate-100 bg-white'} shadow-sm cursor-pointer hover:bg-slate-50 transition relative">
      <div class="space-y-1.5">
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
            ${isFav ? `
              <span class="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-bold">
                <i class="fa-solid fa-star text-[8px] mr-1 text-amber-500"></i>Favorite
              </span>
            ` : ''}
            <p class="text-xs font-bold text-slate-800 truncate ${r.completed ? 'line-through text-slate-400' : ''}">
              ${_escapeHtml(r.title)}
            </p>
            <span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold ${status.badgeClass}">${status.label}</span>
            ${(r.alertMode !== 'notification') ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-100 text-[9px] font-bold"><i class="fa-solid fa-bell text-[8px] mr-1 text-rose-500"></i>Phone Alarm</span>` : `<span class="inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-[9px] font-medium"><i class="fa-regular fa-bell text-[8px] mr-1 text-blue-500"></i>Notification</span>`}
            ${r.alertMode === 'notification' && (parseInt(r.playCount, 10) || 1) > 1 ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-[9px] font-medium"><i class="fa-solid fa-repeat text-[8px] mr-1 text-blue-500"></i>${r.playCount}x (2s gap)</span>` : ''}
            ${r.repeat && r.repeat !== 'None' ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 text-[9px] font-medium"><i class="fa-solid fa-repeat text-[8px] mr-1"></i>${repeatLabel}</span>` : ''}
            ${r.alertStyle === 'sound_only' ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100 text-[9px] font-medium"><i class="fa-solid fa-volume-high text-[8px] mr-1"></i>Sound Only</span>` : ''}
            ${r.alertStyle === 'banner_only' ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[9px] font-medium"><i class="fa-solid fa-message text-[8px] mr-1"></i>Banner Only</span>` : ''}
            ${r.quietHoursEnabled ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] font-medium"><i class="fa-solid fa-moon text-[8px] mr-1"></i>Quiet: ${_formatTime12h(r.quietStart || '22:00')} - ${_formatTime12h(r.quietEnd || '07:00')}</span>` : ''}
          </div>

          <!-- Quick Action Controls: Prominent Fav Button & Pause/Resume -->
          <div class="flex items-center gap-1.5 shrink-0" onclick="event.stopPropagation()">
            <button type="button" onclick="toggleReminderFavorite('${r.id}')"
                    class="h-7 px-2 rounded-lg border ${isFav ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600'} flex items-center gap-1 text-[10px] font-bold transition shadow-xs"
                    title="${isFav ? 'Favorited (tap to unpin)' : 'Mark as favorite (pin to top)'}"
                    aria-label="${isFav ? 'Favorited (tap to unpin)' : 'Mark as favorite (pin to top)'}">
              <i class="fa-${isFav ? 'solid' : 'regular'} fa-star text-[10px] ${isFav ? 'text-amber-500' : 'text-slate-400'}"></i>
              <span>${isFav ? 'Fav' : 'Fav'}</span>
            </button>
            ${!r.completed ? `
              <button type="button" onclick="togglePauseReminder('${r.id}')"
                      class="h-7 px-2 rounded-lg border ${r.paused ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600'} flex items-center gap-1 text-[10px] font-bold transition shadow-xs"
                      title="${r.paused ? 'Resume reminder' : 'Pause reminder'}"
                      aria-label="${r.paused ? 'Resume reminder' : 'Pause reminder'}">
                <i class="fa-solid ${r.paused ? 'fa-play' : 'fa-pause'} text-[9px] ${r.paused ? 'text-emerald-600' : 'text-slate-400'}"></i>
                <span>${r.paused ? 'Resume' : 'Pause'}</span>
              </button>
            ` : ''}
          </div>
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
    subHeaderActions.innerHTML = '';
  }

  const dt = new Date(rem.datetime);
  const status = getReminderStatus(rem);
  const dateFormatted = dt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeFormatted = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const repeatLabel = getReminderRepeatLabel(rem);
  const alertInfo = getAlertStyleInfo(rem.alertStyle);
  const isFav = Boolean(rem.favorite || rem.favourite);

  content.innerHTML = `
    <!-- Top Action Row: Test Alert button & Edit Pencil in top right matching edit page -->
    <div class="flex items-center justify-between mb-1">
      <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Reminder Details</span>
      <div class="flex items-center gap-1.5">
        <button type="button" onclick="testSpecificReminderAlert('${rem.id}')" class="px-2.5 py-1 text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition flex items-center gap-1 shadow-xs">
          <i class="fa-solid fa-play text-[8px]"></i> Test Alert
        </button>
        <button type="button" onclick="toggleReminderFavorite('${rem.id}')" class="px-2.5 py-1 text-[10px] font-bold ${isFav ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-amber-50 hover:text-amber-700'} rounded-lg transition flex items-center gap-1 shadow-xs" title="${isFav ? 'Remove from favorites' : 'Mark as favorite'}">
          <i class="fa-solid fa-star ${isFav ? 'text-amber-500' : 'text-slate-400'} text-[9px]"></i>
          <span>${isFav ? 'Favorited' : 'Favorite'}</span>
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
        <div class="flex items-center gap-1.5 flex-wrap justify-end">
          ${isFav ? `
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
              <i class="fa-solid fa-star text-[9px] text-amber-500"></i>Favorite
            </span>
          ` : ''}
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
          <p class="text-[10px] text-slate-400">Alert Mode</p>
          <p class="font-bold text-slate-800 mt-0.5 flex items-center gap-1">
            <i class="fa-solid ${rem.alertMode !== 'notification' ? 'fa-bell text-rose-500' : 'fa-message text-blue-500'} text-[10px]"></i>
            ${rem.alertMode !== 'notification' ? 'Phone Alarm Clock' : 'Notification'}
          </p>
        </div>
        <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
          <p class="text-[10px] text-slate-400">Recurrence</p>
          <p class="font-bold text-slate-800 mt-0.5 flex items-center gap-1">
            <i class="fa-solid fa-repeat text-indigo-500 text-[10px]"></i> ${repeatLabel}
          </p>
        </div>
        <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-100 col-span-2">
          <p class="text-[10px] text-slate-400">Notification Style</p>
          <p class="font-bold text-slate-800 mt-0.5 flex items-center gap-1">
            <i class="fa-solid ${alertInfo.icon} text-blue-500 text-[10px]"></i> ${alertInfo.label}
          </p>
        </div>
        <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-100 col-span-2 flex items-center justify-between">
          <div>
            <p class="text-[10px] text-slate-400">Alert Sound ${rem.alertMode === 'notification' && (rem.playCount || 1) > 1 ? `(${rem.playCount} times)` : ''}</p>
            <p class="font-bold text-slate-800 mt-0.5 flex items-center gap-1.5 flex-wrap">
              ${rem.speakTitle ? `
                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 flex items-center gap-1">
                  <i class="fa-solid fa-volume-high"></i> Voice: "${_escapeHtml(rem.title)}"
                </span>
                <span class="text-[10px] text-slate-400 font-normal">(${getReminderSoundLabel(rem.sound)})</span>
              ` : `
                <i class="fa-solid fa-music text-purple-500 text-[10px]"></i> ${getReminderSoundLabel(rem.sound)}
              `}
            </p>
          </div>
          <button type="button" onclick="previewReminderAlertById('${rem.id}')" class="px-2.5 py-1 bg-purple-50 text-purple-600 border border-purple-200 rounded-lg text-[10px] font-bold hover:bg-purple-100 transition flex items-center gap-1 shadow-xs">
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

      <!-- Favorite Status Row -->
      <div class="p-2.5 rounded-xl ${isFav ? 'bg-amber-50/70 border border-amber-200' : 'bg-slate-50 border border-slate-100'} flex items-center justify-between text-xs">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-lg ${isFav ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'} flex items-center justify-center text-[10px]">
            <i class="fa-solid fa-star"></i>
          </div>
          <div>
            <p class="text-[10px] ${isFav ? 'text-amber-700 font-bold' : 'text-slate-400 font-medium'}">Favorite Status</p>
            <p class="font-bold ${isFav ? 'text-amber-900' : 'text-slate-700'}">${isFav ? 'Pinned to top of list' : 'Standard priority'}</p>
          </div>
        </div>
        <button type="button" onclick="toggleReminderFavorite('${rem.id}')" class="px-2.5 py-1 ${isFav ? 'bg-white border border-amber-300 text-amber-800 hover:bg-amber-100' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'} rounded-lg text-[10px] font-bold transition flex items-center gap-1 shadow-xs">
          <i class="fa-${isFav ? 'solid' : 'regular'} fa-star text-[9px] ${isFav ? 'text-amber-500' : 'text-slate-400'}"></i>
          <span>${isFav ? 'Unpin' : 'Pin to Top'}</span>
        </button>
      </div>

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

// Cancels both native AlarmPlugin alarm clock and LocalNotifications
async function _cancelNativeAlarmAndNotification(id) {
  if (typeof stopReminderSoundLoop === 'function') {
    stopReminderSoundLoop();
  }
  if (typeof stopAnyReminderAlert === 'function') {
    stopAnyReminderAlert();
  }
  const modal = document.getElementById('inAppAlarmModal');
  if (modal) modal.remove();

  if (typeof Capacitor === 'undefined' || !Capacitor.Plugins) return;
  try {
    if (Capacitor.Plugins.AlarmPlugin) {
      await Capacitor.Plugins.AlarmPlugin.cancelAlarm({ id: String(id) });
      await Capacitor.Plugins.AlarmPlugin.stopAlarm();
    }
  } catch (e) {}
  try {
    if (Capacitor.Plugins.LocalNotifications) {
      await Capacitor.Plugins.LocalNotifications.cancel({
        notifications: [{ id: _reminderIdToInt(id) }]
      });
    }
  } catch (e) {}
}

async function toggleReminderFavorite(id) {
  const rem = (appData.reminders || []).find(r => r.id === id);
  if (!rem) return;

  const isFav = !(rem.favorite || rem.favourite);
  rem.favorite = isFav;
  rem.favourite = isFav;

  await saveState();

  let currentView = 'list';
  try {
    const s = JSON.parse(localStorage.getItem(REMINDERS_UI_STATE_KEY) || '{}');
    if (s.view) currentView = s.view;
  } catch (e) {}

  if (currentView === 'detail') {
    renderReminderDetailView(id);
  } else {
    renderRemindersListView();
  }
}

async function togglePauseReminder(id) {
  const rem = (appData.reminders || []).find(r => r.id === id);
  if (!rem) return;

  rem.paused = !rem.paused;

  if (rem.paused) {
    if (typeof stopReminderSoundLoop === 'function') {
      stopReminderSoundLoop();
    }
    const modal = document.getElementById('inAppAlarmModal');
    if (modal) modal.remove();
    await _cancelNativeAlarmAndNotification(id);
  } else {
    // When resumed: next timer should happen after current time + recurrence duration
    const now = new Date();
    if (rem.repeat && rem.repeat !== 'None') {
      rem.datetime = _calculateNextReminderDatetime(now, rem.repeat, rem.customInterval, rem.customUnit);
    } else {
      if (new Date(rem.datetime) <= now) {
        const nextDt = new Date(now.getTime() + 10 * 60000);
        rem.datetime = _toLocalDatetimeString(nextDt);
      }
    }
    rem.notified = false;
    await _scheduleNativeNotification(rem);
  }

  await saveState();

  let currentView = 'list';
  try {
    const s = JSON.parse(localStorage.getItem(REMINDERS_UI_STATE_KEY) || '{}');
    if (s.view) currentView = s.view;
  } catch (e) {}

  if (currentView === 'detail') {
    renderReminderDetailView(id);
  } else {
    renderRemindersListView();
  }
}

window.toggleReminderFavorite = toggleReminderFavorite;
window.togglePauseReminder = togglePauseReminder;

async function markReminderCompleted(id) {
  const rem = (appData.reminders || []).find(r => r.id === id);
  if (!rem) return;

  rem.completed = true;
  rem.paused = false;

  if (typeof stopReminderSoundLoop === 'function') {
    stopReminderSoundLoop();
  }
  const modal = document.getElementById('inAppAlarmModal');
  if (modal) modal.remove();

  await _cancelNativeAlarmAndNotification(id);

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

  if (typeof stopReminderSoundLoop === 'function') {
    stopReminderSoundLoop();
  }
  const modal = document.getElementById('inAppAlarmModal');
  if (modal) modal.remove();
  if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.AlarmPlugin) {
    try { await Capacitor.Plugins.AlarmPlugin.stopAlarm(); } catch (e) {}
  }

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

  renderReminderDetailView(id);
}

// Deletes a reminder - once deleted, lands cleanly on the list page (matching Splitwise)
async function deleteReminder(id) {
  const rem = (appData.reminders || []).find(r => r.id === id);
  if (!rem) return;
  if (!(await showConfirm(`Delete reminder "${rem.title}"? This cannot be undone.`))) return;

  await _cancelNativeAlarmAndNotification(id);

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
  const alertMode = existing ? (existing.alertMode || 'alarm') : 'alarm';
  const repeat = existing ? (existing.repeat || 'None') : 'None';
  const customInterval = existing ? (existing.customInterval || 15) : 15;
  const customUnit = existing ? (existing.customUnit || 'minutes') : 'minutes';
  const alertStyle = existing ? (existing.alertStyle || 'both') : 'both';
  const sound = existing ? (existing.sound || 'default') : 'default';
  const speakTitle = existing ? !!existing.speakTitle : false;
  const quietHoursEnabled = existing ? !!existing.quietHoursEnabled : false;
  const quietStart = existing ? (existing.quietStart || '22:00') : '22:00';
  const quietEnd = existing ? (existing.quietEnd || '07:00') : '07:00';
  const isFavorite = existing ? Boolean(existing.favorite || existing.favourite) : false;
  const playCount = existing ? (parseInt(existing.playCount, 10) || 1) : 1;

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
              <div class="w-4 h-4 rounded-md bg-rose-600 flex items-center justify-center text-white text-[9px]">
                <i id="previewIcon" class="fa-solid fa-bell"></i>
              </div>
              <span class="font-bold text-slate-200">Life Tracker</span>
              <span>&bull;</span>
              <span id="previewTimeLabel">Scheduled time</span>
            </div>
            <span id="previewModeBadge" class="text-[9px] bg-rose-700/80 px-1.5 py-0.5 rounded text-white font-bold">Phone Alarm</span>
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

        <!-- Favorite Reminder Toggle -->
        <div class="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center text-xs">
              <i class="fa-solid fa-star"></i>
            </div>
            <div>
              <label for="reminderFavoriteToggle" class="text-xs font-bold text-slate-800 cursor-pointer">Favorite Reminder</label>
              <p class="text-[10px] text-slate-400">Pin reminder to top of the list</p>
            </div>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" id="reminderFavoriteToggle" ${isFavorite ? 'checked' : ''} class="sr-only peer">
            <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
          </label>
        </div>

        <div>
          <label class="text-[11px] font-semibold text-slate-500 block mb-1">Date & Time *</label>
          <input type="datetime-local" required id="reminderDatetime" onchange="updateReminderPreview()" value="${defaultDatetime}" class="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 bg-slate-50/50 font-medium">
        </div>

        <!-- Alert Mode: Phone Alarm vs Notification -->
        <div>
          <label class="text-[11px] font-semibold text-slate-500 block mb-1">Alert Mode (Alarm vs Notification)</label>
          <div class="grid grid-cols-2 gap-2" id="alertModeSelector">
            <label class="alert-mode-label cursor-pointer border rounded-xl p-2.5 flex flex-col items-center text-center gap-1.5 transition ${alertMode === 'alarm' ? 'border-rose-500 bg-rose-50/60 font-bold text-rose-700 shadow-xs' : 'border-slate-200 bg-white text-slate-600'}">
              <input type="radio" name="alertMode" value="alarm" ${alertMode === 'alarm' ? 'checked' : ''} onchange="onAlertModeRadioChange(this.value); updateReminderPreview()" class="hidden">
              <div class="flex items-center gap-1.5">
                <i class="fa-solid fa-bell text-sm ${alertMode === 'alarm' ? 'text-rose-600' : 'text-slate-400'}"></i>
                <span class="text-xs">Phone Alarm</span>
              </div>
              <span class="text-[9px] leading-tight text-slate-500 font-normal">Wakes locked phone screen, rings custom sound continuously until dismissed or snoozed.</span>
            </label>

            <label class="alert-mode-label cursor-pointer border rounded-xl p-2.5 flex flex-col items-center text-center gap-1.5 transition ${alertMode === 'notification' ? 'border-blue-500 bg-blue-50/60 font-bold text-blue-700 shadow-xs' : 'border-slate-200 bg-white text-slate-600'}">
              <input type="radio" name="alertMode" value="notification" ${alertMode === 'notification' ? 'checked' : ''} onchange="onAlertModeRadioChange(this.value); updateReminderPreview()" class="hidden">
              <div class="flex items-center gap-1.5">
                <i class="fa-regular fa-bell text-sm ${alertMode === 'notification' ? 'text-blue-600' : 'text-slate-400'}"></i>
                <span class="text-xs">Notification</span>
              </div>
              <span class="text-[9px] leading-tight text-slate-500 font-normal">Standard notification banner and short chime.</span>
            </label>
          </div>
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
              <i class="fa-solid fa-play text-[8px]"></i>
              <span>Play</span>
            </button>
          </div>
        </div>

        <!-- Notification Play Count Selector (Repetitions with 2s gap) -->
        <div class="space-y-1.5 ${alertMode === 'notification' && alertStyle !== 'banner_only' ? '' : 'hidden'}" id="notificationPlayCountSection">
          <label class="text-[11px] font-semibold text-slate-500 block">Sound Repetitions (2s gap)</label>
          <div class="relative">
            <select id="reminderPlayCountSelect" onchange="updateReminderPreview()" class="w-full text-xs p-3 pr-8 rounded-xl border border-slate-200 outline-none focus:border-blue-500 bg-slate-50/50 font-medium appearance-none">
              <option value="1" ${playCount === 1 ? 'selected' : ''}>Play 1 time</option>
              <option value="2" ${playCount === 2 ? 'selected' : ''}>Play 2 times</option>
              <option value="3" ${playCount === 3 ? 'selected' : ''}>Play 3 times</option>
              <option value="4" ${playCount === 4 ? 'selected' : ''}>Play 4 times</option>
              <option value="5" ${playCount === 5 ? 'selected' : ''}>Play 5 times</option>
              <option value="6" ${playCount === 6 ? 'selected' : ''}>Play 6 times</option>
              <option value="8" ${playCount === 8 ? 'selected' : ''}>Play 8 times</option>
              <option value="10" ${playCount === 10 ? 'selected' : ''}>Play 10 times</option>
            </select>
            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
              <i class="fa-solid fa-chevron-down text-[10px]"></i>
            </div>
          </div>
          <p class="text-[10px] text-slate-400 flex items-center gap-1 font-normal">
            <i class="fa-solid fa-circle-info text-[9px] text-blue-500"></i> Plays the alert chime repeatedly with a fixed 2-second pause between each chime.
          </p>
        </div>

        <!-- Speak Title Aloud Toggle (Text-to-Speech) -->
        <div class="p-3.5 bg-slate-50/70 rounded-2xl border border-slate-200 flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-xs">
              <i class="fa-solid fa-volume-high"></i>
            </div>
            <div>
              <label for="reminderSpeakTitleToggle" class="text-xs font-bold text-slate-800 cursor-pointer">Speak Title Aloud (Voice)</label>
              <p class="text-[10px] text-slate-400">Announces reminder title aloud using voice when alerting</p>
            </div>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" id="reminderSpeakTitleToggle" ${speakTitle ? 'checked' : ''} onchange="updateReminderPreview()" class="sr-only peer">
            <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
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

function onAlertModeRadioChange(val) {
  document.querySelectorAll('#alertModeSelector .alert-mode-label').forEach(label => {
    const radio = label.querySelector('input[type="radio"]');
    const icon = label.querySelector('i');
    if (radio && radio.value === val) {
      if (val === 'alarm') {
        label.className = 'alert-mode-label cursor-pointer border rounded-xl p-2.5 flex flex-col items-center text-center gap-1.5 transition border-rose-500 bg-rose-50/60 font-bold text-rose-700 shadow-xs';
        if (icon) icon.className = 'fa-solid fa-bell text-sm text-rose-600';
      } else {
        label.className = 'alert-mode-label cursor-pointer border rounded-xl p-2.5 flex flex-col items-center text-center gap-1.5 transition border-blue-500 bg-blue-50/60 font-bold text-blue-700 shadow-xs';
        if (icon) icon.className = 'fa-regular fa-bell text-sm text-blue-600';
      }
    } else {
      label.className = 'alert-mode-label cursor-pointer border rounded-xl p-2.5 flex flex-col items-center text-center gap-1.5 transition border-slate-200 bg-white text-slate-600';
      if (icon) icon.className = `fa-solid ${radio?.value === 'alarm' ? 'fa-bell' : 'fa-regular fa-bell'} text-sm text-slate-400`;
    }
  });

  const playCountSec = document.getElementById('notificationPlayCountSection');
  const alertStyleRadio = document.querySelector('input[name="alertStyle"]:checked');
  const style = alertStyleRadio ? alertStyleRadio.value : 'both';
  if (playCountSec) {
    if (val === 'notification' && style !== 'banner_only') {
      playCountSec.classList.remove('hidden');
    } else {
      playCountSec.classList.add('hidden');
    }
  }
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

  const playCountSec = document.getElementById('notificationPlayCountSection');
  const alertModeRadio = document.querySelector('input[name="alertMode"]:checked');
  const mode = alertModeRadio ? alertModeRadio.value : 'alarm';
  if (playCountSec) {
    if (mode === 'notification' && val !== 'banner_only') {
      playCountSec.classList.remove('hidden');
    } else {
      playCountSec.classList.add('hidden');
    }
  }
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
  const alertModeRadio = document.querySelector('input[name="alertMode"]:checked');
  const alertMode = alertModeRadio ? alertModeRadio.value : 'alarm';
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

  const speakToggle = document.getElementById('reminderSpeakTitleToggle');
  const isSpeakTitle = speakToggle ? speakToggle.checked : false;
  const playCountEl = document.getElementById('reminderPlayCountSelect');
  const playCount = parseInt(playCountEl ? playCountEl.value : '1', 10) || 1;

  if (prevSound) {
    let soundHtml = `<i class="fa-solid fa-music mr-1"></i>${getReminderSoundLabel(soundId)}`;
    if (alertMode === 'notification' && alertStyle !== 'banner_only' && playCount > 1) {
      soundHtml += ` • <span class="text-blue-300 font-bold">${playCount}x (2s gap)</span>`;
    }
    if (isSpeakTitle) {
      soundHtml += ` • <i class="fa-solid fa-volume-high text-purple-300 mr-0.5"></i>Voice`;
    }
    prevSound.innerHTML = soundHtml;
  }

  if (prevMode && prevIcon) {
    if (alertMode === 'alarm') {
      prevMode.textContent = 'Phone Alarm';
      prevMode.className = 'text-[9px] bg-rose-700/80 px-1.5 py-0.5 rounded text-white font-bold';
      prevIcon.className = 'fa-solid fa-bell text-white';
      if (prevFooter) prevFooter.textContent = 'Continuous looping sound • Wakes locked screen';
    } else if (alertStyle === 'sound_only') {
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
  const alertModeRadio = document.querySelector('input[name="alertMode"]:checked');
  const alertMode = alertModeRadio ? alertModeRadio.value : 'alarm';
  const alertStyleRadio = document.querySelector('input[name="alertStyle"]:checked');
  const soundEl = document.getElementById('reminderSoundSelect');
  const speakToggle = document.getElementById('reminderSpeakTitleToggle');
  const isSpeakTitle = speakToggle ? speakToggle.checked : false;

  const title = (titleEl && titleEl.value.trim()) || 'Life Tracker Alarm (Test)';
  const note = (noteEl && noteEl.value.trim()) || 'This is how your phone alarm sounds and behaves.';
  const alertStyle = alertStyleRadio ? alertStyleRadio.value : 'both';
  const soundId = soundEl ? soundEl.value : 'default';
  const playCountEl = document.getElementById('reminderPlayCountSelect');
  const playCount = alertMode === 'notification' ? (parseInt(playCountEl ? playCountEl.value : '1', 10) || 1) : 1;

  const feedback = document.getElementById('testFeedbackMsg');

  // Alarm Mode test: opens full-screen interactive alarm screen with continuous sound loop!
  if (alertMode === 'alarm') {
    _showInAppAlarmModal({
      id: 'test_alarm',
      title,
      note,
      sound: soundId,
      alertMode: 'alarm',
      repeat: 'None',
      speakTitle: isSpeakTitle,
      isTest: true
    }, true);
    return;
  }

  if (isSpeakTitle) {
    // If Text-to-Speech is enabled: speak title playCount times with 2s gap!
    speakReminderTitleSequence(title, playCount);
    if (alertStyle !== 'sound_only') {
      await _dispatchNotificationNow(title, note, false, 'test_alarm', playCount);
    }
    if (feedback) {
      feedback.innerHTML = `✓ Spoken title playing (${playCount}x${playCount > 1 ? ', 2s gap' : ''}): "${title}"${playCount > 1 ? ` <button type="button" onclick="stopAnyReminderAlert()" class="underline font-bold text-rose-600 ml-1">Stop</button>` : ''}`;
      feedback.className = 'text-[10px] text-purple-600 font-medium text-center mt-1';
      feedback.classList.remove('hidden');
      setTimeout(() => { if (feedback) feedback.classList.add('hidden'); }, Math.max(4000, playCount * 3000));
    }
    return;
  }

  if (alertStyle === 'sound_only') {
    // Only play sound, no banner!
    playNotificationSoundSequence(soundId, playCount);
    if (feedback) {
      feedback.innerHTML = `✓ Notification sound playing (${getReminderSoundLabel(soundId)}${playCount > 1 ? `, ${playCount} times with 2s gap` : ''})! (Sound-only mode, banner suppressed)${playCount > 1 ? ` <button type="button" onclick="stopAnyReminderAlert()" class="underline font-bold text-rose-600 ml-1">Stop</button>` : ''}`;
      feedback.className = 'text-[10px] text-purple-600 font-medium text-center mt-1';
      feedback.classList.remove('hidden');
      setTimeout(() => { if (feedback) feedback.classList.add('hidden'); }, Math.max(4000, playCount * 2600));
    }
    return;
  }

  if (alertStyle === 'banner_only') {
    // Only banner, silent
    await _dispatchNotificationNow(title, note, false, 'test_alarm', 1);
    if (feedback) {
      feedback.textContent = '✓ Silent notification banner sent!';
      feedback.className = 'text-[10px] text-slate-600 font-medium text-center mt-1';
      feedback.classList.remove('hidden');
      setTimeout(() => { if (feedback) feedback.classList.add('hidden'); }, 4000);
    }
    return;
  }

  // 'both': Sound + Banner
  playNotificationSoundSequence(soundId, playCount);
  await _dispatchNotificationNow(title, note, true, 'test_alarm', playCount);
  if (feedback) {
    feedback.innerHTML = `✓ Test notification banner sent with sound (${getReminderSoundLabel(soundId)}${playCount > 1 ? `, ${playCount} times with 2s gap` : ''})!${playCount > 1 ? ` <button type="button" onclick="stopAnyReminderAlert()" class="underline font-bold text-rose-600 ml-1">Stop</button>` : ''}`;
    feedback.className = 'text-[10px] text-emerald-600 font-medium text-center mt-1';
    feedback.classList.remove('hidden');
    setTimeout(() => { if (feedback) feedback.classList.add('hidden'); }, Math.max(4000, playCount * 2600));
  }
}

async function testSpecificReminderAlert(id) {
  const rem = (appData.reminders || []).find(r => r.id === id);
  if (!rem) return;

  if (rem.alertMode !== 'notification') {
    _showInAppAlarmModal(rem, true);
    return;
  }

  const style = rem.alertStyle || 'both';
  const title = rem.title || 'Life Tracker Reminder';
  const note = rem.note || `Alert test for "${title}" (${getReminderRepeatLabel(rem)})`;
  const soundId = rem.sound || 'default';
  const playCount = Math.max(1, parseInt(rem.playCount, 10) || 1);

  if (rem.speakTitle) {
    // If Text-to-Speech is enabled: speak title playCount times with 2s gap!
    speakReminderTitleSequence(title, playCount);
    if (style !== 'sound_only') {
      await _dispatchNotificationNow(title, note, false, 'test_' + rem.id, playCount);
    }
    return;
  }

  if (style === 'sound_only') {
    playNotificationSoundSequence(soundId, playCount);
    return;
  }

  if (style === 'banner_only') {
    await _dispatchNotificationNow(title, note, false, 'test_' + rem.id, 1);
    return;
  }

  // 'both': Sound + Banner
  playNotificationSoundSequence(soundId, playCount);
  await _dispatchNotificationNow(title, note, true, 'test_' + rem.id, playCount);
}

// --------------- In-App Alarm Clock Modal (Real Phone Alarm Experience) ---
function _showInAppAlarmModal(reminder, isTest = false) {
  const existing = document.getElementById('inAppAlarmModalOverlay');
  if (existing) {
    stopReminderSoundLoop();
    existing.remove();
  }

  const isTestMode = isTest || Boolean(reminder.isTest) || reminder.id === 'test_alarm' || String(reminder.id).startsWith('test_');

  if (reminder.speakTitle) {
    // Phone Alarm: Speak title once, and then continue playing mp3/alarm sound in a loop!
    speakReminderTitle(reminder.title, () => {
      if (document.getElementById('inAppAlarmModalOverlay')) {
        playReminderSoundLoop(reminder.sound || 'default');
      }
    });
  } else {
    // Play the custom uploaded sound or preset continuously in loop!
    playReminderSoundLoop(reminder.sound || 'default');
  }

  const modal = document.createElement('div');
  modal.id = 'inAppAlarmModalOverlay';
  modal.className = 'fixed inset-0 z-[100] bg-slate-950/95 text-white flex flex-col justify-between p-6 backdrop-blur-md select-none';

  const updateClock = () => {
    const now = new Date();
    const timeEl = document.getElementById('inAppAlarmLiveTime');
    const ampmEl = document.getElementById('inAppAlarmLiveAmPm');
    const dateEl = document.getElementById('inAppAlarmLiveDate');
    if (timeEl) {
      let hours = now.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      if (hours === 0) hours = 12;
      const minutes = String(now.getMinutes()).padStart(2, '0');
      timeEl.textContent = `${hours}:${minutes}`;
      if (ampmEl) ampmEl.textContent = ampm;
    }
    if (dateEl) dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  modal.innerHTML = `
    <div class="text-center pt-8 space-y-1">
      <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${isTestMode ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'} text-xs font-bold tracking-wider uppercase">
        <i class="fa-solid ${isTestMode ? 'fa-flask text-xs' : 'fa-bell animate-bounce text-xs'}"></i>
        <span>${isTestMode ? 'Life Tracker Phone Alarm (Test Preview)' : 'Life Tracker Phone Alarm'}</span>
      </div>
      <p id="inAppAlarmLiveDate" class="text-xs text-slate-400 mt-2"></p>
    </div>

    <div class="text-center space-y-4 my-auto">
      <div class="flex items-baseline justify-center gap-2">
        <span id="inAppAlarmLiveTime" class="text-6xl font-light tracking-tight text-white font-mono">07:00</span>
        <span id="inAppAlarmLiveAmPm" class="text-xl font-bold text-slate-400">AM</span>
      </div>

      <div class="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-rose-600 to-indigo-600 p-0.5 shadow-2xl shadow-rose-500/40 animate-pulse">
        <div class="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-rose-400 text-2xl">
          <i class="fa-solid fa-bell"></i>
        </div>
      </div>

      <div class="space-y-1.5 px-4">
        <h2 class="text-xl font-bold text-white leading-snug">${_escapeHtml(reminder.title || 'Alarm Alert')}</h2>
        ${reminder.note ? `<p class="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">${_escapeHtml(reminder.note)}</p>` : ''}
        <p class="text-[11px] text-rose-300 font-medium pt-1">
          ${reminder.speakTitle ? `<i class="fa-solid fa-volume-high mr-1"></i>Voice announcement & Sound: ${getReminderSoundLabel(reminder.sound)}` : `<i class="fa-solid fa-music mr-1"></i>Playing: ${getReminderSoundLabel(reminder.sound)}`}
        </p>
      </div>
    </div>

    <div class="space-y-3 pb-6 max-w-sm mx-auto w-full">
      <div class="grid grid-cols-3 gap-2">
        <button id="inAppAlarmSnoozeBtn" type="button" class="py-3.5 px-2 rounded-2xl bg-slate-800 text-slate-200 border border-slate-700 font-bold text-xs hover:bg-slate-700 active:scale-95 transition flex items-center justify-center gap-1 shadow-lg">
          <i class="fa-solid fa-bed"></i> Snooze
        </button>
        <button id="inAppAlarmDismissBtn" type="button" class="py-3.5 px-2 rounded-2xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-500 active:scale-95 transition flex items-center justify-center gap-1 shadow-lg shadow-rose-600/40">
          <i class="fa-solid fa-xmark"></i> Dismiss
        </button>
        <button id="inAppAlarmPauseBtn" type="button" class="py-3.5 px-2 rounded-2xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-500 active:scale-95 transition flex items-center justify-center gap-1 shadow-lg shadow-amber-600/40">
          <i class="fa-solid fa-pause"></i> Pause
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  updateClock();
  const clockInt = setInterval(updateClock, 1000);

  const cleanUp = () => {
    stopReminderSoundLoop();
    stopReminderSpeech();
    clearInterval(clockInt);
    modal.remove();
    if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.AlarmPlugin) {
      try { Capacitor.Plugins.AlarmPlugin.stopAlarm(); } catch (e) {}
    }
  };

  document.getElementById('inAppAlarmSnoozeBtn').onclick = async () => {
    cleanUp();
    if (!isTestMode && reminder.id && reminder.id !== 'test_alarm') {
      await snoozeReminder(reminder.id, 5, 'minutes');
    }
  };

  document.getElementById('inAppAlarmDismissBtn').onclick = async () => {
    cleanUp();
    if (!isTestMode && reminder.id && reminder.id !== 'test_alarm') {
      reminder.lastSentAt = new Date().toISOString();
      if (reminder.repeat && reminder.repeat !== 'None') {
        reminder.datetime = _calculateNextReminderDatetime(reminder.datetime, reminder.repeat, reminder.customInterval, reminder.customUnit);
        reminder.notified = false;
        await _scheduleNativeNotification(reminder);
      } else {
        reminder.completed = true;
      }
      await saveState();
      renderRemindersListView();
    }
  };

  const pauseBtn = document.getElementById('inAppAlarmPauseBtn');
  if (pauseBtn) {
    pauseBtn.onclick = async () => {
      cleanUp();
      if (!isTestMode && reminder.id && reminder.id !== 'test_alarm') {
        const rem = (appData.reminders || []).find(r => r.id === reminder.id);
        if (rem) {
          rem.paused = true;
          await _cancelNativeAlarmAndNotification(rem.id);
          await saveState();
          renderRemindersListView();
        }
      }
    };
  }
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

async function openNativeNotificationSettings() {
  if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.AlarmPlugin) {
    try {
      await Capacitor.Plugins.AlarmPlugin.openNotificationSettings();
      return;
    } catch (e) {}
  }
  if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications) {
    try {
      await Capacitor.Plugins.LocalNotifications.requestPermissions();
    } catch (e) {}
  }
}

async function _checkExactAlarmBanner() {
  const banner = document.getElementById('exactAlarmPermBanner');
  if (!banner) return;
  if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.AlarmPlugin) {
    try {
      const res = await Capacitor.Plugins.AlarmPlugin.checkAlarmPermissions();
      if (res) {
        if (res.notificationsEnabled === false) {
          banner.innerHTML = `
            <div class="flex items-center gap-2 min-w-0">
              <i class="fa-solid fa-bell-slash text-rose-500 shrink-0 text-sm"></i>
              <div>
                <p class="text-[11px] font-bold text-rose-800">Notification Permission Required</p>
                <p class="text-[10px] text-rose-700">Allow notifications so alarms and snooze/dismiss controls display when phone is locked.</p>
              </div>
            </div>
            <button onclick="openNativeNotificationSettings()" class="shrink-0 px-2.5 py-1 text-[11px] font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition">Enable</button>
          `;
          banner.classList.remove('hidden');
          return;
        }

        if (res.canScheduleExactAlarms === false) {
          banner.innerHTML = `
            <div class="flex items-center gap-2 min-w-0">
              <i class="fa-solid fa-clock text-rose-500 shrink-0 text-sm"></i>
              <div>
                <p class="text-[11px] font-bold text-rose-800">Exact Alarm Access Required</p>
                <p class="text-[10px] text-rose-700">Allow Life Tracker to ring alarms on exact time when phone is locked.</p>
              </div>
            </div>
            <button onclick="requestExactAlarmPermission()" class="shrink-0 px-2.5 py-1 text-[11px] font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition">Allow</button>
          `;
          banner.classList.remove('hidden');
          return;
        }

        if (res.canUseFullScreenIntent === false) {
          banner.innerHTML = `
            <div class="flex items-center gap-2 min-w-0">
              <i class="fa-solid fa-mobile-screen text-rose-500 shrink-0 text-sm"></i>
              <div>
                <p class="text-[11px] font-bold text-rose-800">Full-Screen Alarm Access Needed</p>
                <p class="text-[10px] text-rose-700">Allow full-screen intent so the alarm screen turns on over the lock screen.</p>
              </div>
            </div>
            <button onclick="openNativeNotificationSettings()" class="shrink-0 px-2.5 py-1 text-[11px] font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition">Enable</button>
          `;
          banner.classList.remove('hidden');
          return;
        }
      }
    } catch (e) {}
  }
  banner.classList.add('hidden');
}

async function requestExactAlarmPermission() {
  if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.AlarmPlugin) {
    try {
      await Capacitor.Plugins.AlarmPlugin.openAlarmSettings();
    } catch (e) {
      console.warn('Could not open alarm settings:', e);
    }
  }
}

async function _dispatchNotificationNow(title, body, withSound = true, reminderId = null, playCount = 1) {
  const count = parseInt(playCount, 10) || 1;
  const calculatedDuration = count > 1 ? Math.max(5000, (count * 600) + ((count - 1) * 2000) + 2000) : 5000;
  // Show in-app banner so alert is immediately visible inside browser
  _showInAppAlertBanner({
    title,
    body,
    reminderId,
    durationMs: calculatedDuration,
    playCount: count
  });

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
  const alertModeRadio = document.querySelector('input[name="alertMode"]:checked');
  const alertMode = alertModeRadio ? alertModeRadio.value : 'alarm';
  const alertStyleRadio = document.querySelector('input[name="alertStyle"]:checked');
  const alertStyle = alertStyleRadio ? alertStyleRadio.value : 'both';

  const soundEl = document.getElementById('reminderSoundSelect');
  const sound = soundEl ? soundEl.value : 'default';
  const speakToggle = document.getElementById('reminderSpeakTitleToggle');
  const speakTitle = speakToggle ? speakToggle.checked : false;

  const quietToggle = document.getElementById('reminderQuietHoursToggle');
  const quietHoursEnabled = quietToggle ? quietToggle.checked : false;
  const quietStartEl = document.getElementById('reminderQuietStart');
  const quietStart = quietStartEl ? quietStartEl.value : '22:00';
  const quietEndEl = document.getElementById('reminderQuietEnd');
  const quietEnd = quietEndEl ? quietEndEl.value : '07:00';

  const favToggle = document.getElementById('reminderFavoriteToggle');
  const isFavorite = favToggle ? favToggle.checked : false;

  const playCountEl = document.getElementById('reminderPlayCountSelect');
  const playCount = alertMode === 'notification' ? (parseInt(playCountEl ? playCountEl.value : '1', 10) || 1) : 1;

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
      rem.favorite = isFavorite;
      rem.favourite = isFavorite;
      rem.repeat = repeat;
      rem.customInterval = customInterval;
      rem.customUnit = customUnit;
      rem.alertMode = alertMode;
      rem.alertStyle = alertStyle;
      rem.sound = sound;
      rem.speakTitle = speakTitle;
      rem.quietHoursEnabled = quietHoursEnabled;
      rem.quietStart = quietStart;
      rem.quietEnd = quietEnd;
      rem.note = note;
      rem.playCount = playCount;
      rem.completed = false;
      rem.notified = false;
      savedItem = rem;
    }
  } else {
    savedItem = {
      id: 'rem_' + Date.now(),
      title,
      datetime,
      favorite: isFavorite,
      favourite: isFavorite,
      repeat,
      customInterval,
      customUnit,
      alertMode,
      alertStyle,
      sound,
      speakTitle,
      quietHoursEnabled,
      quietStart,
      quietEnd,
      note,
      playCount,
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

// --------------- Background / Periodic Engine (Browser & In-App) ---------
let _reminderCheckInterval = null;

async function _ensureNativePermissions() {
  if (typeof Capacitor === 'undefined' || !Capacitor.Plugins) return;
  try {
    if (Capacitor.Plugins.LocalNotifications) {
      const perm = await Capacitor.Plugins.LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        await Capacitor.Plugins.LocalNotifications.requestPermissions();
      }
    }
  } catch (e) {}
}

function _isNativeApp() {
  return typeof Capacitor !== 'undefined' &&
         typeof Capacitor.isNativePlatform === 'function' &&
         Capacitor.isNativePlatform();
}

async function _syncRemindersWithNative() {
  if (!_isNativeApp() || !Capacitor.Plugins || !Capacitor.Plugins.AlarmPlugin) {
    _catchUpPastRecurringReminders();
    return;
  }
  try {
    const res = await Capacitor.Plugins.AlarmPlugin.getPendingAlarms();
    const nativeAlarms = (res && Array.isArray(res.alarms)) ? res.alarms : [];
    let changed = false;
    const now = new Date();

    (appData.reminders || []).forEach(rem => {
      if (rem.paused || rem.completed) return;
      const found = nativeAlarms.find(a => a.id === rem.id);
      if (found) {
        if (found.lastTriggeredAt) {
          rem.lastSentAt = new Date(found.lastTriggeredAt).toISOString();
        }
        if (found.completed) {
          rem.completed = true;
          rem.notified = true;
          changed = true;
        } else if (found.timestamp && rem.repeat && rem.repeat !== 'None') {
          const nativeDt = new Date(found.timestamp);
          const nativeDtStr = _toLocalDatetimeString(nativeDt);
          if (rem.datetime !== nativeDtStr) {
            rem.datetime = nativeDtStr;
            rem.notified = false;
            changed = true;
          }
        } else if (!rem.repeat || rem.repeat === 'None') {
          let dt = new Date(rem.datetime);
          if (dt <= now || found.lastTriggeredAt) {
            rem.completed = true;
            rem.notified = true;
            changed = true;
          }
        }
      } else {
        // Not found in native pending alarms:
        let dt = new Date(rem.datetime);
        if (dt <= now) {
          if (rem.repeat && rem.repeat !== 'None') {
            while (dt <= now) {
              rem.datetime = _calculateNextReminderDatetime(rem.datetime, rem.repeat, rem.customInterval, rem.customUnit);
              dt = new Date(rem.datetime);
            }
            rem.notified = false;
            changed = true;
            _scheduleNativeNotification(rem);
          } else {
            rem.completed = true;
            rem.notified = true;
            changed = true;
          }
        }
      }
    });

    if (changed) {
      await saveState();
      renderRemindersListView();
    }
  } catch (e) {
    console.warn('Could not sync with native alarms:', e);
    _catchUpPastRecurringReminders();
  }
}

function _catchUpPastRecurringReminders() {
  if (!appData.reminders || appData.reminders.length === 0) return;
  const now = new Date();
  let changed = false;
  appData.reminders.forEach(rem => {
    if (rem.paused || rem.completed) return;
    let dt = new Date(rem.datetime);
    if (dt <= now) {
      if (rem.repeat && rem.repeat !== 'None') {
        while (dt <= now) {
          rem.datetime = _calculateNextReminderDatetime(rem.datetime, rem.repeat, rem.customInterval, rem.customUnit);
          dt = new Date(rem.datetime);
        }
        rem.notified = false;
        changed = true;
      } else {
        rem.completed = true;
        rem.notified = true;
        changed = true;
      }
    }
  });
  if (changed) {
    saveState();
    renderRemindersListView();
  }
}

async function startReminderEngine() {
  if (_reminderCheckInterval) return;
  _ensureNativePermissions();
  _ensureNativeNotificationChannel();
  _setupNativeNotificationClickListener();
  _setupNativeAlarmListener();
  _syncAllCustomSoundsToNative();
  await _syncRemindersWithNative();
  _rescheduleAllActiveReminders();

  _reminderCheckInterval = setInterval(_checkAndFireReminders, 5000);
  setTimeout(_checkAndFireReminders, 1500);
}

function _checkAndFireReminders() {
  if (!appData.reminders || appData.reminders.length === 0) return;
  const now = new Date();
  const isNative = _isNativeApp();
  let changed = false;

  appData.reminders.forEach(r => {
    // Skip if paused or completed or already notified
    if (r.paused || r.completed || r.notified) return;

    const dt = new Date(r.datetime);
    if (dt <= now) {
      if (isNative) {
        // ON NATIVE ANDROID:
        // Native AlarmReceiver is the sole authority for firing exact alarms and notification banners.
        // If a reminder datetime is in the past, Android AlarmManager ALREADY fired it!
        // We MUST NOT play duplicate audio, speech, or popups when opening/resuming the app.
        if (r.repeat && r.repeat !== 'None') {
          while (dt <= now) {
            r.datetime = _calculateNextReminderDatetime(r.datetime, r.repeat, r.customInterval, r.customUnit);
            dt = new Date(r.datetime);
          }
          r.notified = false;
        } else {
          r.completed = true;
          r.notified = true;
        }
        changed = true;
        return;
      }

      // Check Quiet Hours / Do Not Disturb (Web browser only)
      const isQuiet = r.quietHoursEnabled && _isTimeInQuietHours(now, r.quietStart, r.quietEnd);

      if (isQuiet) {
        console.log(`[Reminders] Quiet hours active for "${r.title}". Alarm sound suppressed.`);
        if (r.repeat && r.repeat !== 'None') {
          r.datetime = _calculateNextReminderDatetime(r.datetime, r.repeat, r.customInterval, r.customUnit);
          r.notified = false;
        } else {
          const endDt = _calculateQuietHoursEndTime(now, r.quietEnd);
          r.datetime = _toLocalDatetimeString(endDt);
          r.notified = false;
        }
        changed = true;
        return;
      }

      r.lastSentAt = now.toISOString();
      const isAlarm = (r.alertMode || 'alarm') !== 'notification';
      const diffMs = now.getTime() - dt.getTime();
      // On web browser: only fire in-app sounds if triggered in real-time (within 15 seconds)
      const isFresh = diffMs < 15000;

      if (isAlarm) {
        r.notified = true;
        changed = true;
        if (isFresh) {
          _showInAppAlarmModal(r);
        }
      } else {
        const style = r.alertStyle || 'both';
        const isAppOpen = (typeof document !== 'undefined' && document.visibilityState === 'visible');
        const playCount = Math.max(1, parseInt(r.playCount, 10) || 1);
        const estimatedPerPlay = r.speakTitle ? 2500 : 600;
        const calculatedBannerMs = Math.max(5000, (playCount * estimatedPerPlay) + ((playCount - 1) * 2000) + 2000);

        if (isAppOpen && isFresh) {
          if (r.speakTitle) {
            speakReminderTitleSequence(r.title, playCount);
          } else if (style !== 'banner_only') {
            playNotificationSoundSequence(r.sound || 'default', playCount);
          }
          if (style !== 'sound_only') {
            _showInAppAlertBanner({
              title: r.title,
              body: r.note,
              reminderId: r.id,
              durationMs: calculatedBannerMs,
              playCount: playCount
            });
          }
        } else if (!isAppOpen) {
          if (style === 'both' || style === 'sound_only') {
            if (r.speakTitle) {
              speakReminderTitleSequence(r.title, playCount);
            } else {
              playNotificationSoundSequence(r.sound || 'default', playCount);
            }
          }
          if (style === 'both' || style === 'banner_only') {
            _fireBrowserNotification(r);
          }
        }

        if (r.repeat && r.repeat !== 'None') {
          r.datetime = _calculateNextReminderDatetime(r.datetime, r.repeat, r.customInterval, r.customUnit);
          r.notified = false;
        } else {
          r.notified = true;
        }
        changed = true;
      }
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

let _inAppBannerDismissTimeout = null;

function _showInAppAlertBanner(titleOrOpts, body, reminderId, durationMs = 5000, playCount = 1) {
  try {
    // Support either positional args (title, body, reminderId, durationMs, playCount)
    // or options object: { title, body, message, reminderId, durationMs, icon, badgeText, onClick, playCount }
    let title = 'Reminder';
    let iconClass = 'fa-solid fa-bell';
    let badgeText = 'Reminder Alert';
    let onClickFn = null;
    let count = 1;

    if (titleOrOpts && typeof titleOrOpts === 'object') {
      const opts = titleOrOpts;
      title = opts.title || 'Notification';
      body = opts.body || opts.message || '';
      reminderId = opts.reminderId || null;
      count = parseInt(opts.playCount, 10) || 1;
      const defaultDuration = count > 1 ? Math.max(5000, (count * 2500) + ((count - 1) * 2000) + 2000) : 5000;
      durationMs = typeof opts.durationMs === 'number' ? opts.durationMs : defaultDuration;
      if (opts.icon) iconClass = opts.icon;
      if (opts.badgeText) badgeText = opts.badgeText;
      if (typeof opts.onClick === 'function') onClickFn = opts.onClick;
    } else {
      title = titleOrOpts || 'Reminder';
      count = parseInt(playCount, 10) || 1;
      const defaultDuration = count > 1 ? Math.max(5000, (count * 2500) + ((count - 1) * 2000) + 2000) : 5000;
      durationMs = typeof durationMs === 'number' ? durationMs : defaultDuration;
    }

    if (_inAppBannerDismissTimeout) {
      clearTimeout(_inAppBannerDismissTimeout);
      _inAppBannerDismissTimeout = null;
    }

    const existing = document.getElementById('inAppReminderAlertBanner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'inAppReminderAlertBanner';
    // Position comfortably below Android status bar and notch
    banner.style.top = 'max(20px, calc(env(safe-area-inset-top, 0px) + 14px))';
    banner.className = 'fixed left-3 right-3 max-w-md mx-auto z-[9999] select-none transition-all duration-300 ease-out -translate-y-8 opacity-0 scale-95 pointer-events-auto';

    function dismissBanner() {
      if (_inAppBannerDismissTimeout) {
        clearTimeout(_inAppBannerDismissTimeout);
        _inAppBannerDismissTimeout = null;
      }
      stopAnyReminderAlert();
      if (banner && banner.parentNode) {
        banner.classList.remove('translate-y-0', 'opacity-100', 'scale-100');
        banner.classList.add('-translate-y-8', 'opacity-0', 'scale-95');
        setTimeout(() => {
          if (banner && banner.parentNode) banner.remove();
        }, 250);
      }
    }

    banner.innerHTML = `
      <div id="inAppBannerCard" class="relative overflow-hidden rounded-2xl bg-slate-900/95 text-white p-3.5 shadow-2xl border border-slate-700/80 backdrop-blur-xl flex flex-col gap-2 cursor-pointer active:scale-[0.99] transition">
        <div class="flex items-center gap-3">
          <!-- Glowing Icon Badge with animated icon -->
          <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-base shrink-0 shadow-lg shadow-blue-500/30">
            <i class="${iconClass} animate-bounce text-sm"></i>
          </div>

          <!-- Title and Note -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-1">
              <span class="text-[9px] font-extrabold uppercase tracking-widest text-blue-400 font-mono">${_escapeHtml(badgeText)}</span>
              <span class="text-[9px] text-slate-400">Just now</span>
            </div>
            <p class="text-xs font-bold text-white mt-0.5 truncate leading-tight">${_escapeHtml(title || 'Reminder')}</p>
            ${body ? `<p class="text-[11px] text-slate-300 mt-0.5 truncate leading-tight">${_escapeHtml(body)}</p>` : ''}
          </div>

          <!-- Close button -->
          <button type="button" id="inAppBannerCloseBtn"
                  class="w-7 h-7 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center shrink-0 transition"
                  aria-label="Dismiss">
            <i class="fa-solid fa-xmark text-xs"></i>
          </button>
        </div>

        ${count > 1 ? `
          <div class="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px]" id="inAppBannerAudioRow">
            <span class="text-blue-400 font-semibold flex items-center gap-1">
              <i class="fa-solid fa-volume-high animate-bounce text-[9px]"></i> Repeating alert (${count}x, 2s gap)
            </span>
            <button type="button" id="inAppBannerStopAudioBtn" class="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[10px] font-bold transition flex items-center gap-1 shadow-xs">
              <i class="fa-solid fa-stop text-[8px]"></i> Stop Alert
            </button>
          </div>
        ` : ''}

        <!-- Animated Progress / Auto-Dismiss Countdown Bar -->
        <div class="w-full h-1 bg-slate-800/80 rounded-full overflow-hidden">
          <div id="inAppBannerProgress" class="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full w-full" style="transition: width ${durationMs}ms linear;"></div>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    // Event listeners
    const cardEl = banner.querySelector('#inAppBannerCard');
    const closeBtn = banner.querySelector('#inAppBannerCloseBtn');
    const stopAudioBtn = banner.querySelector('#inAppBannerStopAudioBtn');

    if (stopAudioBtn) {
      stopAudioBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        stopAnyReminderAlert();
        const row = banner.querySelector('#inAppBannerAudioRow');
        if (row) {
          row.innerHTML = `<span class="text-slate-400 text-[10px]"><i class="fa-solid fa-check text-[9px] text-emerald-400 mr-1"></i>Alert stopped</span>`;
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dismissBanner();
      });
    }

    if (cardEl) {
      cardEl.addEventListener('click', () => {
        if (onClickFn) {
          try { onClickFn(); } catch (e) { console.warn(e); }
        } else if (reminderId) {
          if (typeof openRemindersOverlay === 'function') openRemindersOverlay(reminderId);
        } else {
          if (typeof openRemindersOverlay === 'function') openRemindersOverlay('list');
        }
        dismissBanner();
      });
    }

    // Smooth Entrance Animation & Countdown Progress Bar
    requestAnimationFrame(() => {
      banner.classList.remove('-translate-y-8', 'opacity-0', 'scale-95');
      banner.classList.add('translate-y-0', 'opacity-100', 'scale-100');

      const progressEl = document.getElementById('inAppBannerProgress');
      if (progressEl) {
        requestAnimationFrame(() => {
          progressEl.style.width = '0%';
        });
      }
    });

    // Auto-dismiss smoothly after durationMs (default 5000ms = 5 sec)
    _inAppBannerDismissTimeout = setTimeout(() => {
      dismissBanner();
    }, durationMs);
  } catch (e) {
    console.warn('Could not display in-app alert banner:', e);
  }
}

// Global helper so any feature in the app can display dynamic 5-second notifications
if (typeof window !== 'undefined') {
  window.showDynamicInAppNotification = _showInAppAlertBanner;
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
  const playCount = Math.max(1, parseInt(reminder.playCount, 10) || 1);
  const calculatedBannerMs = Math.max(5000, (playCount * 600) + ((playCount - 1) * 2000) + 2000);

  // 1. Always display guaranteed in-app visual banner
  _showInAppAlertBanner({
    title: reminder.title,
    body: reminder.note,
    reminderId: reminder.id,
    durationMs: calculatedBannerMs,
    playCount: playCount
  });

  // Requirement: "if app is open it should not play notif."
  // When app is open / visible, do NOT post OS / browser system notifications!
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    return;
  }

  // 2. Dispatch system notification (via ServiceWorker or desktop Notification API) when app is in background
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
      requireInteraction: false,
      vibrate: [300, 100, 300]
    });
    notif.onclick = () => {
      window.focus();
      if (reminderId) openRemindersOverlay(reminderId);
      else openRemindersOverlay('list');
      notif.close();
    };
    // Auto-dismiss web notification after 5 seconds
    setTimeout(() => {
      try { notif.close(); } catch (e) {}
    }, 5000);
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
      sound: 'sound_alarm_chime',
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
      sound: 'sound_alarm_chime',
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

let _nativeAlarmListenersSetup = false;

function _setupNativeAlarmListener() {
  if (_nativeAlarmListenersSetup) return;
  if (typeof Capacitor === 'undefined' || !Capacitor.Plugins || !Capacitor.Plugins.AlarmPlugin) return;
  _nativeAlarmListenersSetup = true;

  try {
    Capacitor.Plugins.AlarmPlugin.addListener('alertProgress', (data) => {
      console.log('[AlarmPlugin] Native alert progress:', data);
      if (data && data.current && data.total && data.total > 1) {
        _showNotificationStopPill(data.current, data.total, !!data.isVoice);
      }
    });

    Capacitor.Plugins.AlarmPlugin.addListener('alertFinished', () => {
      console.log('[AlarmPlugin] Native alert finished');
      _hideNotificationStopPill();
    });

    Capacitor.Plugins.AlarmPlugin.addListener('alarmDismissed', async (data) => {
      console.log('[AlarmPlugin] Native alarm dismissed:', data);
      const alarmId = data?.id;
      if (!alarmId || String(alarmId).startsWith('test_')) return;

      const rem = (appData.reminders || []).find(r => r.id === alarmId);
      if (rem) {
        rem.lastSentAt = new Date().toISOString();
        if (rem.repeat && rem.repeat !== 'None') {
          rem.datetime = _calculateNextReminderDatetime(rem.datetime, rem.repeat, rem.customInterval, rem.customUnit);
          rem.notified = false;
          await _scheduleNativeNotification(rem);
        } else {
          rem.completed = true;
          rem.notified = true;
        }
        await saveState();
        renderRemindersListView();
      }
    });

    Capacitor.Plugins.AlarmPlugin.addListener('alarmSnoozed', async (data) => {
      console.log('[AlarmPlugin] Native alarm snoozed:', data);
      const alarmId = data?.id;
      if (!alarmId || String(alarmId).startsWith('test_')) return;

      await snoozeReminder(alarmId, 5, 'minutes');
    });

    Capacitor.Plugins.AlarmPlugin.addListener('alarmPaused', async (data) => {
      console.log('[AlarmPlugin] Native alarm paused:', data);
      const alarmId = data?.id;
      if (!alarmId || String(alarmId).startsWith('test_')) return;

      const rem = (appData.reminders || []).find(r => r.id === alarmId);
      if (rem) {
        rem.paused = true;
        await _cancelNativeAlarmAndNotification(alarmId);
        await saveState();
        renderRemindersListView();
      }
    });

    Capacitor.Plugins.AlarmPlugin.addListener('alarmTriggeredForeground', async (data) => {
      console.log('[AlarmPlugin] Alarm triggered in foreground:', data);
      const alarmId = data?.id;
      if (!alarmId) return;
      const rem = (appData.reminders || []).find(r => r.id === alarmId);
      if (rem && !rem.paused && !rem.completed) {
        rem.lastSentAt = new Date().toISOString();
        rem.notified = true;
        await saveState();
        _showInAppAlarmModal(rem);
      }
    });

    Capacitor.Plugins.AlarmPlugin.addListener('reminderTriggeredForeground', async (data) => {
      console.log('[AlarmPlugin] Reminder triggered in foreground:', data);
      const alarmId = data?.id;
      if (!alarmId) return;
      const rem = (appData.reminders || []).find(r => r.id === alarmId);
      if (rem && !rem.paused && !rem.completed) {
        rem.lastSentAt = new Date().toISOString();
        if (rem.repeat && rem.repeat !== 'None') {
          rem.datetime = _calculateNextReminderDatetime(rem.datetime, rem.repeat, rem.customInterval, rem.customUnit);
          rem.notified = false;
          await _scheduleNativeNotification(rem);
        } else {
          rem.notified = true;
        }
        await saveState();
        // Native AlarmReceiver has already displayed the native notification banner and played audio
        // according to alertStyle ('both' / 'sound_only' / 'banner_only').
        const overlay = document.getElementById('remindersOverlay');
        if (overlay && !overlay.classList.contains('hidden')) {
          renderRemindersListView();
        }
      }
    });

    if (Capacitor.Plugins.App) {
      Capacitor.Plugins.App.addListener('appStateChange', async (state) => {
        if (state && state.isActive) {
          await _syncRemindersWithNative();
        }
      });
    }
  } catch (e) {
    console.warn('Failed to register native alarm listeners:', e);
  }
}

async function _syncAllCustomSoundsToNative() {
  if (typeof Capacitor === 'undefined' || !Capacitor.Plugins || !Capacitor.Plugins.AlarmPlugin) return;
  const sounds = appData.reminderSounds || [];
  for (const sound of sounds) {
    if (sound.id && sound.data) {
      try {
        await Capacitor.Plugins.AlarmPlugin.saveCustomSound({
          id: sound.id,
          name: sound.name,
          data: sound.data
        });
      } catch (e) {
        console.warn('Failed to sync custom sound to native storage:', sound.name, e);
      }
    }
  }
}

async function _rescheduleAllActiveReminders() {
  if (typeof Capacitor === 'undefined' || !Capacitor.Plugins) return;
  const list = appData.reminders || [];
  for (const rem of list) {
    if (rem.paused || rem.completed) {
      await _cancelNativeAlarmAndNotification(rem.id);
    } else {
      await _scheduleNativeNotification(rem);
    }
  }
}

async function _scheduleNativeNotification(reminder) {
  if (!reminder) return;
  if (typeof Capacitor === 'undefined' || !Capacitor.Plugins) return;

  await _ensureNativePermissions();

  const idInt = _reminderIdToInt(reminder.id);
  const isAlarm = (reminder.alertMode || 'alarm') !== 'notification';

  // Always cancel legacy local notifications to eliminate double-sound
  if (Capacitor.Plugins.LocalNotifications) {
    try {
      await Capacitor.Plugins.LocalNotifications.cancel({ notifications: [{ id: idInt }] });
    } catch (ignore) {}
  }

  // If paused or completed, cancel native alarm and stop any ringing
  if (reminder.paused || reminder.completed) {
    if (Capacitor.Plugins.AlarmPlugin) {
      try {
        await Capacitor.Plugins.AlarmPlugin.cancelAlarm({ id: String(reminder.id) });
        await Capacitor.Plugins.AlarmPlugin.stopAlarm();
      } catch (ignore) {}
    }
    return;
  }

  // Primary scheduler: AlarmPlugin (Android AlarmManager.setAlarmClock)
  if (Capacitor.Plugins.AlarmPlugin) {
    try {
      const dt = new Date(reminder.datetime);
      let targetDt = dt;
      if (reminder.quietHoursEnabled && _isTimeInQuietHours(dt, reminder.quietStart, reminder.quietEnd)) {
        targetDt = _calculateQuietHoursEndTime(dt, reminder.quietEnd);
      }

      // Find custom sound base64 data if sound is custom
      let soundData = undefined;
      if (reminder.sound && reminder.sound !== 'default') {
        const found = (appData.reminderSounds || []).find(s => s.id === reminder.sound);
        if (found && found.data) {
          soundData = found.data;
        }
      }

      await Capacitor.Plugins.AlarmPlugin.setAlarm({
        id: String(reminder.id),
        timestamp: targetDt.getTime(),
        title: reminder.title,
        note: reminder.note || '',
        repeat: reminder.repeat || 'None',
        soundId: reminder.sound || 'default',
        soundData: soundData,
        customInterval: Number(reminder.customInterval) || 1,
        customUnit: reminder.customUnit || 'days',
        mode: isAlarm ? 'alarm' : 'notification',
        alertStyle: reminder.alertStyle || 'both',
        speakTitle: !!reminder.speakTitle,
        playCount: Number(reminder.playCount) || 1
      });
      return;
    } catch (e) {
      console.warn('AlarmPlugin.setAlarm failed, falling back to LocalNotifications:', e);
    }
  }

  // Fallback: LocalNotifications (e.g. non-Android or if AlarmPlugin fails)
  if (Capacitor.Plugins.LocalNotifications) {
    if (reminder.paused || reminder.completed) return;

    await _ensureNativeNotificationChannel();
    await Capacitor.Plugins.LocalNotifications.requestPermissions();

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

    await Capacitor.Plugins.LocalNotifications.schedule({
      notifications: [{
        title: reminder.title,
        body: reminder.note || `Life Tracker Reminder • ${getReminderRepeatLabel(reminder)}`,
        id: idInt,
        schedule: scheduleConfig,
        channelId: channelId,
        smallIcon: 'ic_notification',
        largeIcon: 'ic_notification',
        sound: style === 'banner_only' ? undefined : 'sound_alarm_chime',
        extra: { reminderId: reminder.id }
      }]
    });
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

// Hook called whenever reminders are restored (from Google Drive or local JSON backup).
// Resyncs custom audio, cleans up removed native alarms, catches up recurring timers,
// reschedules all active alarms with native Android AlarmManager / LocalNotifications,
// and re-renders the Reminders UI if currently open.
async function onRemindersRestored() {
  if (typeof _syncAllCustomSoundsToNative === 'function') {
    try { await _syncAllCustomSoundsToNative(); } catch (e) { console.warn('Sync custom sounds error:', e); }
  }

  // Clean up any obsolete alarms from native Android that are no longer in appData.reminders
  if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.AlarmPlugin) {
    try {
      const res = await Capacitor.Plugins.AlarmPlugin.getPendingAlarms();
      const nativeAlarms = (res && Array.isArray(res.alarms)) ? res.alarms : [];
      const currentIds = new Set((appData.reminders || []).map(r => String(r.id)));
      for (const na of nativeAlarms) {
        if (!currentIds.has(String(na.id))) {
          await _cancelNativeAlarmAndNotification(na.id);
        }
      }
    } catch (e) {
      console.warn('Error cleaning up obsolete native alarms:', e);
    }
  }

  // Fast-forward any recurring reminders whose trigger datetime passed while offline/restoring
  if (typeof _catchUpPastRecurringReminders === 'function') {
    try { _catchUpPastRecurringReminders(); } catch (e) { console.warn(e); }
  }

  // Reschedule all active reminders with Android AlarmManager & LocalNotifications
  if (typeof _rescheduleAllActiveReminders === 'function') {
    try { await _rescheduleAllActiveReminders(); } catch (e) { console.warn(e); }
  }

  // Refresh Reminders view if currently open on screen
  const overlay = document.getElementById('remindersOverlay');
  if (overlay && !overlay.classList.contains('hidden')) {
    if (typeof renderRemindersListView === 'function') renderRemindersListView();
  } else if (typeof currentTab !== 'undefined' && currentTab === 'reminders') {
    if (typeof renderRemindersPage === 'function') renderRemindersPage(document.getElementById('mainContainer'));
  }
}

window.onRemindersRestored = onRemindersRestored;
window.scheduleAllReminders = onRemindersRestored;

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => _setupNativeAlarmListener());
  } else {
    _setupNativeAlarmListener();
  }
}

