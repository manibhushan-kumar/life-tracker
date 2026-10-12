// ==============================================================================
// Ludo Express - System Bot & Real-Time Multiplayer Game Engine
// ==============================================================================
// Complete, beautifully animated Ludo game supporting:
// 1. Play vs System / AI Bot (Single Player 2-4 players, 100% offline)
// 2. Real-Time Online Multiplayer (Room 2-4 players)
// 3. Live match synchronization & Spectator support
// 4. Commercial-grade SVG Vector Board with authentic blocks, safe stars, and 3D tokens
// ==============================================================================

(function () {
  'use strict';

  // --- Sound Synthesizer ---
  const Sound = (() => {
    let ctx = null;
    function getCtx() {
      if (typeof window === 'undefined') return null;
      if (!ctx) {
        const AudioClass = window.AudioContext || window.webkitAudioContext;
        if (AudioClass) ctx = new AudioClass();
      }
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      return ctx;
    }

    function playTone(freq, duration = 0.08, type = 'sine', gainVal = 0.15) {
      const c = getCtx();
      if (!c) return;
      try {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, c.currentTime);
        gain.gain.setValueAtTime(gainVal, c.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start();
        osc.stop(c.currentTime + duration);
      } catch (e) {}
    }

    return {
      roll: () => {
        for (let i = 0; i < 4; i++) {
          setTimeout(() => playTone(300 + Math.random() * 200, 0.04, 'triangle', 0.1), i * 50);
        }
      },
      hop: () => playTone(600, 0.05, 'sine', 0.12),
      capture: () => {
        playTone(220, 0.1, 'sawtooth', 0.2);
        setTimeout(() => playTone(440, 0.12, 'square', 0.15), 100);
      },
      win: () => {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
          setTimeout(() => playTone(f, 0.2, 'triangle', 0.2), i * 120);
        });
      }
    };
  })();

  // --- Board Geometry & Coordinates ---
  // A standard 15x15 Ludo board has 600x600 SVG viewBox (40px per grid cell).
  // The outer track consists of 52 sequential circuit tiles.
  const TRACK_TILES = [
    // Red quadrant exit into left arm (rows 6..8, cols 0..5)
    { r: 6, c: 1 },  // 0  Red Start (Safe ★)
    { r: 6, c: 2 },  // 1
    { r: 6, c: 3 },  // 2
    { r: 6, c: 4 },  // 3
    { r: 6, c: 5 },  // 4
    // Up into top arm (rows 0..5, cols 6..8)
    { r: 5, c: 6 },  // 5
    { r: 4, c: 6 },  // 6
    { r: 3, c: 6 },  // 7
    { r: 2, c: 6 },  // 8  Safe ★
    { r: 1, c: 6 },  // 9
    { r: 0, c: 6 },  // 10
    { r: 0, c: 7 },  // 11
    { r: 0, c: 8 },  // 12
    { r: 1, c: 8 },  // 13 Green Start (Safe ★)
    { r: 2, c: 8 },  // 14
    { r: 3, c: 8 },  // 15
    { r: 4, c: 8 },  // 16
    { r: 5, c: 8 },  // 17
    // Right into right arm (rows 6..8, cols 9..14)
    { r: 6, c: 9 },  // 18
    { r: 6, c: 10 }, // 19
    { r: 6, c: 11 }, // 20
    { r: 6, c: 12 }, // 21 Safe ★
    { r: 6, c: 13 }, // 22
    { r: 6, c: 14 }, // 23
    { r: 7, c: 14 }, // 24
    { r: 8, c: 14 }, // 25
    { r: 8, c: 13 }, // 26 Yellow Start (Safe ★)
    { r: 8, c: 12 }, // 27
    { r: 8, c: 11 }, // 28
    { r: 8, c: 10 }, // 29
    { r: 8, c: 9 },  // 30
    // Down into bottom arm (rows 9..14, cols 6..8)
    { r: 9, c: 8 },  // 31
    { r: 10, c: 8 }, // 32
    { r: 11, c: 8 }, // 33
    { r: 12, c: 8 }, // 34 Safe ★
    { r: 13, c: 8 }, // 35
    { r: 14, c: 8 }, // 36
    { r: 14, c: 7 }, // 37
    { r: 14, c: 6 }, // 38
    { r: 13, c: 6 }, // 39 Blue Start (Safe ★)
    { r: 12, c: 6 }, // 40
    { r: 11, c: 6 }, // 41
    { r: 10, c: 6 }, // 42
    { r: 9, c: 6 },  // 43
    // Left into left arm
    { r: 8, c: 5 },  // 44
    { r: 8, c: 4 },  // 45
    { r: 8, c: 3 },  // 46
    { r: 8, c: 2 },  // 47 Safe ★
    { r: 8, c: 1 },  // 48
    { r: 8, c: 0 },  // 49
    { r: 7, c: 0 },  // 50
    { r: 6, c: 0 }   // 51
  ];

  // The 8 universal safe star tiles on the circuit:
  const SAFE_TILES = [0, 8, 13, 21, 26, 34, 39, 47];

  // Starting track tile offset for each color:
  const START_OFFSETS = {
    red: 0,
    green: 13,
    yellow: 26,
    blue: 39
  };

  // Colored Home Runways (5 steps leading from track to the center finish triangle):
  const RUNWAYS = {
    red:    [{ r: 7, c: 1 },  { r: 7, c: 2 },  { r: 7, c: 3 },  { r: 7, c: 4 },  { r: 7, c: 5 }],
    green:  [{ r: 1, c: 7 },  { r: 2, c: 7 },  { r: 3, c: 7 },  { r: 4, c: 7 },  { r: 5, c: 7 }],
    yellow: [{ r: 7, c: 13 }, { r: 7, c: 12 }, { r: 7, c: 11 }, { r: 7, c: 10 }, { r: 7, c: 9 }],
    blue:   [{ r: 13, c: 7 }, { r: 12, c: 7 }, { r: 11, c: 7 }, { r: 10, c: 7 }, { r: 9, c: 7 }]
  };

  // 4 Home Base pocket coordinates (center x, y in SVG pixels):
  const YARD_POCKETS = {
    red:    [{ x: 76, y: 76 },   { x: 164, y: 76 },  { x: 76, y: 164 },  { x: 164, y: 164 }],
    green:  [{ x: 436, y: 76 },  { x: 524, y: 76 },  { x: 436, y: 164 }, { x: 524, y: 164 }],
    yellow: [{ x: 436, y: 436 }, { x: 524, y: 436 }, { x: 436, y: 524 }, { x: 524, y: 524 }],
    blue:   [{ x: 76, y: 436 },  { x: 164, y: 436 }, { x: 76, y: 524 },  { x: 164, y: 524 }]
  };

  // Center Finish Triangle Goal coordinates:
  const GOAL_COORDS = {
    red:    { x: 265, y: 300 },
    green:  { x: 300, y: 265 },
    yellow: { x: 335, y: 300 },
    blue:   { x: 300, y: 335 }
  };

  const COLOR_PALETTE = {
    red:    { primary: '#ef4444', dark: '#b91c1c', light: '#fee2e2', border: '#f87171', name: 'Red' },
    green:  { primary: '#10b981', dark: '#047857', light: '#d1fae5', border: '#34d399', name: 'Green' },
    yellow: { primary: '#f59e0b', dark: '#b45309', light: '#fef3c7', border: '#fbbf24', name: 'Yellow' },
    blue:   { primary: '#3b82f6', dark: '#1d4ed8', light: '#dbeafe', border: '#60a5fa', name: 'Blue' }
  };

  function getPlayerInfoByColor(color, session) {
    if (!color) return { name: 'Player', color: 'red' };
    const roomData = (session && session.roomData) || {};
    const players = roomData.players || {};

    // 1. Direct color key check (system mode)
    if (players[color] && players[color].color === color && players[color].name) {
      return players[color];
    }

    // 2. Search values by player.color (online mode keyed by uid)
    const pList = Object.values(players);
    const found = pList.find(p => p && p.color === color);
    if (found && found.name) {
      return found;
    }

    // 3. Check active session if it matches this color
    if (session && session.myColor === color && session.myName) {
      return { id: session.myUid, name: session.myName, color: color, isHost: session.isHost, online: true };
    }

    // 4. Fallback to palette display name
    const palName = COLOR_PALETTE[color]?.name || color;
    return { name: `${palName} Player`, color: color };
  }

  function getTurnBannerText(turnColor, session) {
    const pInfo = getPlayerInfoByColor(turnColor, session);
    const rawName = pInfo.name || COLOR_PALETTE[turnColor]?.name || turnColor;
    const isMe = (session && !session.isSpectator && session.myColor === turnColor);

    // Clean up emojis from raw name for clean display
    let cleanName = rawName.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').replace(/\(You\)/i, '').trim();

    if (isMe) {
      if (cleanName.toLowerCase() === 'you' || !cleanName) {
        return session.myName ? `${session.myName} (You)` : 'You';
      }
      return `${cleanName} (You)`;
    }

    if (cleanName.toLowerCase() === 'you') {
      return 'Opponent';
    }

    return cleanName || COLOR_PALETTE[turnColor]?.name || 'Player';
  }

  function getActiveGameColors(game, session) {
    if (game && Array.isArray(game.colors) && game.colors.length > 0) {
      return game.colors;
    }
    const roomData = (session && session.roomData) || {};
    if (roomData.players) {
      const pColors = Object.values(roomData.players).filter(p => p && !p.isSpectator && p.color).map(p => p.color);
      if (pColors.length > 0) return pColors;
    }
    return window.LudoService ? window.LudoService.PLAYER_COLORS.slice(0, session.playerCount || 2) : ['red', 'green'];
  }

  // --- Zoomify & Laptop / Desktop Fit Support ---
  let ludoIsZoomed = false;

  function initLudoZoomState() {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('lifeTracker_ludo_zoomify');
      if (saved !== null) {
        ludoIsZoomed = saved === 'true';
        return;
      }
    }
    // Default to true on laptop / desktop screens (>= 768px)
    ludoIsZoomed = typeof window !== 'undefined' && window.innerWidth >= 768;
  }
  initLudoZoomState();

  function applyLudoZoomify() {
    // Zoomify should ONLY be applied when actively playing on the game board screen
    if (_ludoSubView !== 'board') {
      resetLudoZoomify();
      return;
    }
    const main = document.getElementById('mainContainer');
    const nav = document.getElementById('bottomNav');
    if (ludoIsZoomed) {
      if (main) {
        main.classList.remove('max-w-md');
        main.classList.add('max-w-5xl');
      }
      if (nav) {
        nav.classList.add('hidden');
      }
    } else {
      resetLudoZoomify();
    }
  }

  function resetLudoZoomify() {
    const main = document.getElementById('mainContainer');
    const nav = document.getElementById('bottomNav');
    if (main) {
      main.classList.remove('max-w-5xl');
      if (!main.classList.contains('max-w-md')) {
        main.classList.add('max-w-md');
      }
    }
    if (nav) {
      nav.classList.remove('hidden');
    }
  }

  window.toggleLudoZoomify = function () {
    ludoIsZoomed = !ludoIsZoomed;
    try {
      localStorage.setItem('lifeTracker_ludo_zoomify', ludoIsZoomed ? 'true' : 'false');
    } catch (e) {}

    if (ludoIsZoomed && _ludoSubView === 'board') {
      applyLudoZoomify();
    } else {
      resetLudoZoomify();
    }

    const container = document.getElementById('mainContainer');
    if (container && (typeof gamesSubView !== 'undefined' && gamesSubView === 'ludo')) {
      renderLudoGame(container);
    }
  };

  function getRoomSpectatorsList(session) {
    if (!session || !session.roomData) return [];
    const roomData = session.roomData;
    const spectatorsMap = roomData.spectators || {};
    const playersMap = roomData.players || {};

    const list = [];
    const seenUids = new Set();

    // 1. From roomData.spectators
    Object.entries(spectatorsMap).forEach(([uid, sp]) => {
      if (!uid || seenUids.has(uid)) return;
      seenUids.add(uid);
      if (!sp || typeof sp !== 'object') {
        list.push({
          id: uid,
          name: (uid === session.myUid ? session.myName : 'Spectator') || 'Spectator',
          online: true,
          joinedAt: Date.now()
        });
      } else {
        list.push({
          id: sp.id || uid,
          name: sp.name || (uid === session.myUid ? session.myName : 'Spectator') || 'Spectator',
          online: sp.online !== false,
          joinedAt: sp.joinedAt || Date.now()
        });
      }
    });

    // 2. From roomData.players where isSpectator is true
    Object.entries(playersMap).forEach(([uid, p]) => {
      if (!p || !p.isSpectator || !uid || seenUids.has(uid)) return;
      seenUids.add(uid);
      list.push({
        id: p.id || uid,
        name: p.name || (uid === session.myUid ? session.myName : 'Spectator') || 'Spectator',
        online: p.online !== false,
        joinedAt: p.joinedAt || Date.now()
      });
    });

    // 3. Ensure self is included if watching as spectator
    if (session.isSpectator && session.myUid && !seenUids.has(session.myUid)) {
      list.push({
        id: session.myUid,
        name: session.myName || 'Spectator',
        online: true,
        joinedAt: Date.now()
      });
    }

    return list;
  }

  let _ludoSubView = (() => {
    try {
      return localStorage.getItem('ludo_active_subview') || 'hub';
    } catch (e) {
      return 'hub';
    }
  })();
  let _botTimer = null;
  let _isDiceRolling = false;

  function setLudoSubView(view) {
    _ludoSubView = view;
    try {
      localStorage.setItem('ludo_active_subview', view);
      localStorage.setItem('lifeTracker_gamesSubView', 'ludo');
      localStorage.setItem('lifeTracker_lastTab', 'games');
    } catch (e) {}
  }

  // --- UI Routing & Lifecycle ---
  window.openLudoGame = function () {
    if (typeof gamesSubView !== 'undefined') {
      gamesSubView = 'ludo';
    }
    if (window.LudoService && typeof window.LudoService.setUserOnlineStatus === 'function') {
      window.LudoService.setUserOnlineStatus(true);
    }
    setLudoSubView('hub');
    renderLudoGame(document.getElementById('mainContainer'));
  };

  window.cleanupLudoGame = function () {
    if (_botTimer) {
      clearTimeout(_botTimer);
      _botTimer = null;
    }
    resetLudoZoomify();
    // Set user presence to offline when navigating away from Ludo
    if (window.LudoService) {
      window.LudoService.setUserOnlineStatus(false);
      if (window.LudoService.saveSessionToStorage) {
        window.LudoService.saveSessionToStorage();
      }
    }
  };

  window.resumeLudoGame = function () {
    if (window.LudoService) {
      window.LudoService.resumeSavedSession();
      if (typeof window.LudoService.setUserOnlineStatus === 'function') {
        window.LudoService.setUserOnlineStatus(true);
      }
      const session = window.LudoService.getSession();
      if (session && session.mode === 'online' && session.roomData && session.roomData.meta && session.roomData.meta.status === 'waiting') {
        setLudoSubView('waiting');
      } else {
        setLudoSubView('board');
      }
      renderLudoGame(document.getElementById('mainContainer'));
    }
  };

  window.deleteLudoRoomPrompt = async function () {
    const session = window.LudoService ? window.LudoService.getSession() : {};
    if (!session || session.mode !== 'online' || !isUserHost(session)) {
      if (typeof showAlert === 'function') {
        await showAlert('Only the host who created this game can delete the room.', { title: 'Host Only', tone: 'warning' });
      } else if (typeof showToast === 'function') {
        showToast('Only the host who created this game can delete the room.', 'warning');
      }
      return;
    }

    const confirmMsg = 'Are you sure you want to delete and disband this game room? This will immediately end the match for all players and remove the room from the server.';

    let confirmed = false;
    if (typeof showConfirm === 'function') {
      confirmed = await showConfirm(confirmMsg, {
        title: 'Delete & Disband Room?',
        confirmLabel: 'Delete Room',
        cancelLabel: 'Keep Room',
        danger: true,
        tone: 'danger'
      });
    } else {
      confirmed = true;
    }

    if (!confirmed) return;

    if (_botTimer) {
      clearTimeout(_botTimer);
      _botTimer = null;
    }

    if (window.LudoService && window.LudoService.deleteOnlineRoom) {
      const res = await window.LudoService.deleteOnlineRoom();
      if (res && !res.success) {
        if (typeof showAlert === 'function') {
          await showAlert(res.error || 'Failed to delete room.', { title: 'Delete Failed', tone: 'danger' });
        } else if (typeof showToast === 'function') {
          showToast(res.error || 'Failed to delete room.', 'error');
        }
        return;
      }
    }

    setLudoSubView('hub');
    const container = document.getElementById('mainContainer');
    if (container) {
      renderLudoGame(container);
    }
    if (typeof showToast === 'function') {
      showToast('Game room has been deleted.', 'success');
    }
  };

  window.abandonLudoSessionPrompt = async function () {
    const session = window.LudoService ? window.LudoService.getSession() : {};

    // If active session is an online match hosted by this player, offer deletion or pause
    if (session && session.mode === 'online' && isUserHost(session)) {
      if (typeof showConfirm === 'function') {
        const deleteOk = await showConfirm('You are the host of this room. Do you want to delete and disband this game for everyone, or pause it to the hub?', {
          title: 'Host Options: Delete or Pause?',
          confirmLabel: 'Delete & Disband Room',
          cancelLabel: 'Keep & Pause to Hub',
          danger: true,
          tone: 'danger'
        });
        if (deleteOk) {
          await window.deleteLudoRoomPrompt();
        } else {
          window.pauseLudoToHub();
        }
      } else {
        window.pauseLudoToHub();
      }
      return;
    }

    const doAbandon = () => {
      if (_botTimer) {
        clearTimeout(_botTimer);
        _botTimer = null;
      }
      if (window.LudoService) {
        window.LudoService.abandonActiveSession();
      }
      setLudoSubView('hub');
      renderLudoGame(document.getElementById('mainContainer'));
    };

    const isSpectator = session && session.isSpectator;
    const promptMsg = isSpectator
      ? 'Leave spectator mode and return to games menu?'
      : 'Are you sure you want to leave this game? Your active match progress will be cleared.';
    const promptTitle = isSpectator ? 'Leave Match?' : 'Leave Game?';
    const confirmLabel = isSpectator ? 'Leave Match' : 'Leave Game';

    if (typeof showConfirm === 'function') {
      const ok = await showConfirm(promptMsg, {
        title: promptTitle,
        confirmLabel: confirmLabel,
        cancelLabel: 'Keep Playing',
        danger: true,
        tone: 'danger'
      });
      if (ok) doAbandon();
    } else {
      doAbandon();
    }
  };

  window.pauseLudoToHub = function () {
    if (_botTimer) {
      clearTimeout(_botTimer);
      _botTimer = null;
    }
    if (window.LudoService) {
      window.LudoService.setUserOnlineStatus(false);
      if (window.LudoService.saveSessionToStorage) {
        window.LudoService.saveSessionToStorage();
      }
    }
    setLudoSubView('hub');
    renderLudoGame(document.getElementById('mainContainer'));
  };

  window.copyLudoRoomCode = async function (code, targetId = null) {
    if (!code || code === '---') return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const ta = document.createElement('textarea');
        ta.value = code;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    } catch (err) {
      try {
        const ta = document.createElement('textarea');
        ta.value = code;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (e2) {
        console.warn('Copy failed:', e2);
      }
    }

    Sound.hop();

    // Feedback for main waiting lobby box
    const box = document.getElementById('ludoRoomCodeBox');
    const badge = document.getElementById('ludoCopyStatusBadge');
    const hint = document.getElementById('ludoCopyHintText');
    if (box && badge) {
      box.classList.add('ring-4', 'ring-emerald-300', 'border-emerald-500', 'bg-emerald-50/70');
      badge.className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-extrabold shadow-sm animate-bounce';
      badge.innerHTML = '<i class="fa-solid fa-check text-[10px]"></i><span>Copied to Clipboard!</span>';
      if (hint) {
        hint.innerHTML = '<span class="text-emerald-700 font-bold">Room code copied! Send it to your friend to join.</span>';
      }

      setTimeout(() => {
        if (box) box.classList.remove('ring-4', 'ring-emerald-300', 'border-emerald-500', 'bg-emerald-50/70');
        if (badge) {
          badge.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/80 border border-indigo-200 text-indigo-600 font-bold transition-all';
          badge.innerHTML = '<i class="fa-regular fa-clone text-[9px]"></i><span>Click box to copy</span>';
        }
        if (hint) {
          hint.innerText = 'Tap anywhere in this card to copy code';
        }
      }, 2500);
    }

    // Feedback for target element if called from hub or board view
    if (targetId) {
      const pill = document.getElementById(targetId);
      if (pill) {
        const originalContent = pill.innerHTML;
        pill.innerHTML = '<i class="fa-solid fa-check text-[9px] text-emerald-600"></i> <span class="text-emerald-700 font-extrabold">Copied!</span>';
        setTimeout(() => {
          if (pill) pill.innerHTML = originalContent;
        }, 2000);
      }
    }
  };

  function isUserHost(session) {
    if (!session || session.mode !== 'online') return false;
    if (session.isSpectator) return false;
    const meta = (session.roomData && session.roomData.meta) || {};
    if (meta.hostUid && session.myUid) {
      return meta.hostUid === session.myUid;
    }
    return !!session.isHost;
  }

  window.confirmRemoveParticipant = async function (targetUid, targetName, isSpectator = false) {
    const session = window.LudoService ? window.LudoService.getSession() : {};
    if (!isUserHost(session)) {
      if (typeof showAlert === 'function') {
        await showAlert('Only the host who created this game can remove participants.', { title: 'Host Only', tone: 'warning' });
      } else if (typeof showToast === 'function') {
        showToast('Only the host who created this game can remove participants.', 'warning');
      }
      return;
    }

    const typeLabel = isSpectator ? 'spectator' : 'player';
    const message = `Are you sure you want to remove ${typeLabel} "${targetName}" from this game room?`;

    const proceed = async () => {
      const res = await window.LudoService.removeParticipant(targetUid, isSpectator);
      if (res && !res.success) {
        if (typeof showAlert === 'function') {
          await showAlert(res.error || 'Failed to remove participant.', { title: 'Action Failed', tone: 'danger' });
        } else if (typeof showToast === 'function') {
          showToast(res.error || 'Failed to remove participant.', 'error');
        }
      } else {
        if (typeof showToast === 'function') {
          showToast(`Removed ${targetName} from the room.`, 'info');
        }
        renderLudoGame(document.getElementById('mainContainer'));
      }
    };

    if (typeof showConfirm === 'function') {
      const ok = await showConfirm(message, {
        title: `Remove ${isSpectator ? 'Spectator' : 'Player'}?`,
        confirmLabel: 'Remove',
        cancelLabel: 'Cancel',
        danger: true,
        tone: 'danger'
      });
      if (ok) proceed();
    } else {
      proceed();
    }
  };

  window.renderLudoGame = function (container) {
    if (!container) container = document.getElementById('mainContainer');
    if (!container) return;

    if (ludoIsZoomed && _ludoSubView === 'board') {
      applyLudoZoomify();
    } else {
      resetLudoZoomify();
    }

    try {
      localStorage.setItem('ludo_active_subview', _ludoSubView);
      localStorage.setItem('lifeTracker_gamesSubView', 'ludo');
      localStorage.setItem('lifeTracker_lastTab', 'games');
    } catch (e) {}

    if (window.LudoService && typeof window.LudoService.resumeSavedSession === 'function') {
      window.LudoService.resumeSavedSession();
      if (typeof window.LudoService.setUserOnlineStatus === 'function') {
        window.LudoService.setUserOnlineStatus(true);
      }
    }

    const session = window.LudoService ? window.LudoService.getSession() : null;
    const hasSession = session && session.roomData && session.roomData.game && !session.roomData.game.winner;

    if ((_ludoSubView === 'waiting' || _ludoSubView === 'board') && !hasSession) {
      setLudoSubView('hub');
    }

    if (_ludoSubView === 'hub') {
      renderLudoHub(container);
    } else if (_ludoSubView === 'waiting') {
      renderLudoWaitingRoom(container);
    } else if (_ludoSubView === 'board') {
      renderLudoBoardView(container);
    }
  };

  // --- 1. Ludo Hub Screen (Mode Selection & Active Session) ---
  function renderLudoHub(container) {
    const activeInfo = window.LudoService ? window.LudoService.hasActiveSession() : { hasSession: false };

    container.innerHTML = `
      <div class="max-w-md mx-auto space-y-4 pb-8 select-none animate-fade-in">
        <!-- Top Nav & Header -->
        <div class="flex items-center justify-between gap-2 px-1">
          <div class="flex items-center gap-2 min-w-0">
            <button type="button" onclick="openGamesList()" class="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center transition shadow-xs" title="Back to Games" aria-label="Back to Games">
              <i class="fa-solid fa-arrow-left text-xs"></i>
            </button>
            <div class="min-w-0">
              <h1 class="text-sm font-black text-slate-800 tracking-tight leading-none">Ludo Express</h1>
              <p class="text-[10px] text-slate-400 font-medium">Multiplayer & System Bot Board Game</p>
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold shadow-xs">
              <i class="fa-solid fa-dice text-purple-600 text-[11px]"></i>
              <span>Express</span>
            </div>
          </div>
        </div>

        <!-- Active Session Resume Card (If match in progress) -->
        ${activeInfo.hasSession ? `
        <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-indigo-500/10 p-4 border-2 border-amber-300 shadow-md space-y-3 animate-fade-in">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="relative flex h-2.5 w-2.5">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span class="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-300">
                Active Match In Progress
              </span>
            </div>
            <span class="text-[10px] font-extrabold text-slate-500 capitalize">
              ${activeInfo.session.mode === 'system' ? 'Offline System Bot' : 'Online Room'}
            </span>
          </div>

          <div class="bg-white/90 backdrop-blur-xs p-3 rounded-2xl border border-amber-200/80 flex items-center justify-between gap-3 shadow-xs">
            <div class="space-y-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-xs font-black text-slate-800 truncate">
                  ${activeInfo.session.mode === 'system'
                    ? `You vs ${activeInfo.session.playerCount - 1} AI Bots (${activeInfo.session.playerCount} Players)`
                    : `<span onclick="event.stopPropagation(); copyLudoRoomCode('${activeInfo.session.roomCode || ''}', 'hubCodePill')" id="hubCodePill" class="cursor-pointer inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition active:scale-95" title="Click anywhere to copy code">
                        Room: <b class="font-mono tracking-wider">${activeInfo.session.roomCode}</b>
                        <i class="fa-regular fa-clone text-[9px]"></i>
                       </span>`
                  }
                </span>
              </div>
              <div class="flex items-center gap-2 text-[10px] font-semibold text-slate-500">
                <span class="flex items-center gap-1">
                  Turn:
                  <span class="w-2 h-2 rounded-full inline-block" style="background-color: ${(COLOR_PALETTE[activeInfo.game.currentTurnColor] || {}).primary || '#ef4444'}"></span>
                  <b class="font-black text-slate-800">${getPlayerInfoByColor(activeInfo.game.currentTurnColor, activeInfo.session).name}</b>
                </span>
                <span>•</span>
                <span>Your Color: <b class="capitalize text-slate-800">${activeInfo.session.myColor || 'red'}</b></span>
              </div>
            </div>

            <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center text-sm shadow-md shadow-amber-500/30 shrink-0">
              <i class="fa-solid fa-play"></i>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2 pt-0.5">
            <button type="button" onclick="resumeLudoGame()" class="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-black shadow-md hover:opacity-95 transition flex items-center justify-center gap-1.5 active:scale-98">
              <i class="fa-solid fa-rotate-right text-xs"></i>
              <span>Resume Game</span>
            </button>
            <button type="button" onclick="abandonLudoSessionPrompt()" class="py-2.5 px-3 rounded-2xl bg-white border border-rose-200 text-rose-600 text-xs font-bold hover:bg-rose-50 transition shadow-xs flex items-center justify-center gap-1.5 active:scale-98">
              <i class="fa-solid fa-trash-can text-xs"></i>
              <span>Abandon Match</span>
            </button>
          </div>
        </div>
        ` : ''}

        <!-- Banner Card -->
        <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500/20 via-purple-500/15 to-pink-500/20 p-5 border border-indigo-100 shadow-sm text-slate-800">
          <div class="flex items-center justify-between gap-3">
            <div class="space-y-1">
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/90 border border-indigo-200 text-[10px] font-extrabold text-indigo-700">
                <span>🎲</span> Classic Board Strategy
              </span>
              <h2 class="text-base font-black tracking-tight text-slate-800 leading-snug">Roll, Race & Conquer!</h2>
              <p class="text-xs text-slate-500 leading-tight">Play offline against smart System Bots or challenge friends in real-time online rooms.</p>
            </div>
            <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0 text-2xl rotate-3">
              <i class="fa-solid fa-dice"></i>
            </div>
          </div>
        </div>

        <!-- Mode 1: Play with System / Bot (Instant Offline Play) -->
        <div class="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm font-bold">
                <i class="fa-solid fa-robot"></i>
              </div>
              <div>
                <h3 class="text-xs font-black text-slate-800">Play with System (AI Bot)</h3>
                <p class="text-[10px] text-slate-400">Instant play offline • 1 Human vs AI Bots</p>
              </div>
            </div>
            <span class="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">100% Offline</span>
          </div>

          <div class="pt-1">
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Select Number of Players</label>
            <div class="grid grid-cols-3 gap-2">
              <button type="button" onclick="startLudoSystemMode(2)" class="py-2.5 px-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 text-slate-800 text-xs font-bold transition flex flex-col items-center gap-0.5 shadow-xs">
                <span>2 Players</span>
                <span class="text-[9px] text-slate-400 font-normal">You vs 1 Bot</span>
              </button>
              <button type="button" onclick="startLudoSystemMode(3)" class="py-2.5 px-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 text-slate-800 text-xs font-bold transition flex flex-col items-center gap-0.5 shadow-xs">
                <span>3 Players</span>
                <span class="text-[9px] text-slate-400 font-normal">You vs 2 Bots</span>
              </button>
              <button type="button" onclick="startLudoSystemMode(4)" class="py-2.5 px-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 text-slate-800 text-xs font-bold transition flex flex-col items-center gap-0.5 shadow-xs">
                <span>4 Players</span>
                <span class="text-[9px] text-slate-400 font-normal">You vs 3 Bots</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Mode 2: Online Multiplayer -->
        <div class="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-sm font-bold">
                <i class="fa-solid fa-users"></i>
              </div>
              <div>
                <h3 class="text-xs font-black text-slate-800">Online Multiplayer</h3>
                <p class="text-[10px] text-slate-400">Play with friends across Android & Web</p>
              </div>
            </div>
            <span class="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>Real-Time</span>
          </div>

          <div class="grid grid-cols-2 gap-2 pt-1">
            <button type="button" onclick="openCreateRoomModal()" class="py-3 px-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold hover:opacity-95 transition shadow-sm flex flex-col items-center justify-center gap-1">
              <i class="fa-solid fa-plus text-xs"></i>
              <span>Create Room</span>
            </button>
            <button type="button" onclick="openJoinRoomModal()" class="py-3 px-3 rounded-2xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition shadow-xs flex flex-col items-center justify-center gap-1">
              <i class="fa-solid fa-right-to-bracket text-xs text-purple-600"></i>
              <span>Join with Code</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // --- 2. System Mode Launcher ---
  window.startLudoSystemMode = async function (numPlayers = 2) {
    if (!window.LudoService) return;
    const active = window.LudoService.hasActiveSession();
    if (active && active.hasSession) {
      const startNew = () => {
        window.LudoService.abandonActiveSession();
        window.LudoService.startSystemGame(numPlayers, 'red');
        setLudoSubView('board');
        renderLudoGame(document.getElementById('mainContainer'));
      };
      if (typeof showConfirm === 'function') {
        const ok = await showConfirm('Starting a new match will overwrite your current active game. Do you want to continue?', {
          title: 'Start New Game?',
          confirmLabel: 'Start New Match',
          cancelLabel: 'Keep Current Match',
          tone: 'warning'
        });
        if (ok) startNew();
      } else {
        startNew();
      }
      return;
    }
    window.LudoService.startSystemGame(numPlayers, 'red');
    setLudoSubView('board');
    renderLudoGame(document.getElementById('mainContainer'));
  };

  // --- 3. Create & Join Room Modals ---
  window.openCreateRoomModal = function () {
    const modalId = 'ludoCreateRoomModal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.className = 'fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in';
    overlay.innerHTML = `
      <div class="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-black text-slate-800">Create Multiplayer Room</h3>
          <button type="button" onclick="document.getElementById('${modalId}')?.remove()" class="w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-100 flex items-center justify-center">
            <i class="fa-solid fa-xmark text-xs"></i>
          </button>
        </div>

        <div>
          <label class="text-[10px] font-bold text-slate-400 block mb-1">Your Display Name <span class="text-rose-500 font-bold">*</span></label>
          <input type="text" id="ludoHostName" value="" placeholder="Enter your name..." oninput="this.classList.remove('border-rose-400', 'ring-2', 'ring-rose-200')" onkeydown="if(event.key==='Enter'){event.preventDefault();submitCreateRoom();}" class="w-full text-xs p-3 rounded-xl border border-slate-200 font-semibold outline-none focus:border-indigo-500 bg-slate-50 transition">
        </div>

        <div>
          <label class="text-[10px] font-bold text-slate-400 block mb-1">Number of Players</label>
          <div class="grid grid-cols-3 gap-2">
            <button type="button" onclick="selectRoomPlayerCount(2, this)" class="ludo-count-btn active py-2 rounded-xl border-2 border-indigo-600 bg-indigo-50 text-indigo-700 font-bold text-xs">2</button>
            <button type="button" onclick="selectRoomPlayerCount(3, this)" class="ludo-count-btn py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs">3</button>
            <button type="button" onclick="selectRoomPlayerCount(4, this)" class="ludo-count-btn py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs">4</button>
          </div>
          <input type="hidden" id="ludoSelectedCount" value="2">
        </div>

        <div>
          <label class="text-[10px] font-bold text-slate-400 block mb-1">Choose Your Color</label>
          <div class="grid grid-cols-4 gap-1.5" id="ludoHostColorPicker">
            ${['red', 'green', 'yellow', 'blue'].map(c => `
              <button type="button" onclick="selectHostColor('${c}', this)"
                      class="ludo-host-color-btn py-2 px-1 rounded-xl border flex flex-col items-center gap-1 transition ${c === 'red' ? 'border-2 border-indigo-600 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'}"
                      data-color="${c}">
                <span class="w-3.5 h-3.5 rounded-full shadow-xs" style="background-color: ${COLOR_PALETTE[c].primary}"></span>
                <span class="text-[10px] font-extrabold capitalize">${c}</span>
              </button>
            `).join('')}
          </div>
          <input type="hidden" id="ludoHostChosenColor" value="red">
        </div>

        <button type="button" onclick="submitCreateRoom()" class="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-xs shadow-md hover:opacity-95 transition">
          Create Room & Share Code
        </button>
      </div>
    `;
    document.body.appendChild(overlay);

    setTimeout(() => {
      const nameInput = document.getElementById('ludoHostName');
      if (nameInput) nameInput.focus();
    }, 100);
  };

  window.selectHostColor = function (col, btn) {
    document.getElementById('ludoHostChosenColor').value = col;
    document.querySelectorAll('.ludo-host-color-btn').forEach(b => {
      b.className = 'ludo-host-color-btn py-2 px-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex flex-col items-center gap-1 transition';
    });
    btn.className = 'ludo-host-color-btn active py-2 px-1 rounded-xl border-2 border-indigo-600 bg-indigo-50 text-indigo-800 flex flex-col items-center gap-1 transition shadow-xs';
  };

  window.selectRoomPlayerCount = function (count, btn) {
    document.getElementById('ludoSelectedCount').value = count;
    document.querySelectorAll('.ludo-count-btn').forEach(b => {
      b.className = 'ludo-count-btn py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs';
    });
    btn.className = 'ludo-count-btn active py-2 rounded-xl border-2 border-indigo-600 bg-indigo-50 text-indigo-700 font-bold text-xs';
  };

  window.submitCreateRoom = async function () {
    const nameInput = document.getElementById('ludoHostName');
    const name = nameInput?.value.trim();
    if (!name) {
      if (typeof showAlert === 'function') {
        showAlert('Please enter your name to continue.', { title: 'Name Required', tone: 'warning' });
      } else if (typeof showToast === 'function') {
        showToast('Please enter your name to continue.', 'warning');
      }
      if (nameInput) {
        nameInput.focus();
        nameInput.classList.add('border-rose-400', 'ring-2', 'ring-rose-200');
      }
      return;
    }
    const count = parseInt(document.getElementById('ludoSelectedCount')?.value) || 2;
    const hostColor = document.getElementById('ludoHostChosenColor')?.value || 'red';
    const btn = document.querySelector('#ludoCreateRoomModal button[onclick="submitCreateRoom()"]');
    let origText = '';
    if (btn) {
      origText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin text-xs"></i> Initializing Room...';
    }

    if (!window.LudoService) {
      if (btn) { btn.disabled = false; btn.innerHTML = origText; }
      return;
    }

    try {
      const res = await window.LudoService.createOnlineRoom(count, name, hostColor);
      if (res.success) {
        document.getElementById('ludoCreateRoomModal')?.remove();
        setLudoSubView('waiting');
        renderLudoGame(document.getElementById('mainContainer'));
      } else {
        if (btn) { btn.disabled = false; btn.innerHTML = origText; }
        if (typeof showAlert === 'function') {
          showAlert(res.error || 'Failed to create room. Please check your internet connection.', { title: 'Room Error', tone: 'danger' });
        } else if (typeof showToast === 'function') {
          showToast(res.error || 'Failed to create room.', 'error');
        }
      }
    } catch (e) {
      if (btn) { btn.disabled = false; btn.innerHTML = origText; }
      if (typeof showAlert === 'function') {
        showAlert(e.message || 'An unexpected error occurred.', { title: 'Room Error', tone: 'danger' });
      } else if (typeof showToast === 'function') {
        showToast(e.message || 'An unexpected error occurred.', 'error');
      }
    }
  };

  window.openJoinRoomModal = function () {
    const modalId = 'ludoJoinRoomModal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.className = 'fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in';
    overlay.innerHTML = `
      <div class="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-black text-slate-800">Join Multiplayer Room</h3>
          <button type="button" onclick="document.getElementById('${modalId}')?.remove()" class="w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-100 flex items-center justify-center">
            <i class="fa-solid fa-xmark text-xs"></i>
          </button>
        </div>

        <div>
          <label class="text-[10px] font-bold text-slate-400 block mb-1">Your Name <span class="text-rose-500 font-bold">*</span></label>
          <input type="text" id="ludoJoinPlayerName" value="" placeholder="Enter your name..." oninput="this.classList.remove('border-rose-400', 'ring-2', 'ring-rose-200')" onkeydown="if(event.key==='Enter'){event.preventDefault();document.getElementById('ludoJoinCode')?.focus();}" class="w-full text-xs p-3 rounded-xl border border-slate-200 font-semibold outline-none focus:border-indigo-500 bg-slate-50 transition">
        </div>

        <div>
          <label class="text-[10px] font-bold text-slate-400 block mb-1">Room Code (e.g. LD-4821)</label>
          <div class="flex gap-1.5">
            <input type="text" id="ludoJoinCode" placeholder="LD-XXXX" oninput="handleJoinCodeInput(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();submitJoinRoom();}" class="flex-1 text-sm p-3 rounded-xl border border-slate-200 font-mono font-bold uppercase tracking-wider outline-none focus:border-indigo-500 bg-slate-50">
            <button type="button" onclick="checkRoomColors()" class="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition">
              Check
            </button>
          </div>
          <p id="ludoRoomCodeStatusHint" class="text-[9px] text-slate-500 mt-1 font-medium"></p>
        </div>

        <div>
          <label class="text-[10px] font-bold text-slate-400 block mb-1">Your Role</label>
          <div class="grid grid-cols-2 gap-2" id="ludoJoinRoleSelector">
            <button type="button" id="ludoRolePlayerBtn" onclick="setJoinRole('player')"
                    class="py-2 px-3 rounded-xl border-2 border-indigo-600 bg-indigo-50 text-indigo-800 text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs">
              <i class="fa-solid fa-gamepad text-xs"></i>
              <span>Play Match</span>
            </button>
            <button type="button" id="ludoRoleSpectatorBtn" onclick="setJoinRole('spectator')"
                    class="py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition hover:bg-slate-50">
              <i class="fa-solid fa-eye text-xs text-indigo-500"></i>
              <span>Watch Live</span>
            </button>
          </div>
          <input type="hidden" id="ludoJoinRole" value="player">
        </div>

        <div id="ludoJoinColorPickerSection">
          <label class="text-[10px] font-bold text-slate-400 block mb-1">Select Your Color (No Duplicates Allowed)</label>
          <div class="grid grid-cols-4 gap-1.5" id="ludoJoinColorPicker">
            ${['red', 'green', 'yellow', 'blue'].map(c => `
              <button type="button" onclick="selectJoinColor('${c}', this)"
                      class="ludo-join-color-btn py-2 px-1 rounded-xl border flex flex-col items-center gap-0.5 transition ${c === 'green' ? 'border-2 border-indigo-600 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'}"
                      data-color="${c}">
                <span class="w-3.5 h-3.5 rounded-full shadow-xs" style="background-color: ${COLOR_PALETTE[c].primary}"></span>
                <span class="text-[10px] font-extrabold capitalize">${c}</span>
                <span class="text-[8px] font-bold text-slate-400 join-color-tag">Available</span>
              </button>
            `).join('')}
          </div>
          <input type="hidden" id="ludoJoinChosenColor" value="green">
        </div>

        <button type="button" id="ludoJoinSubmitBtn" onclick="submitJoinRoom()" class="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-xs shadow-md hover:opacity-95 transition">
          Join Game
        </button>
      </div>
    `;
    document.body.appendChild(overlay);

    setTimeout(() => {
      const nameInput = document.getElementById('ludoJoinPlayerName');
      const codeInput = document.getElementById('ludoJoinCode');
      if (nameInput && !nameInput.value.trim()) {
        nameInput.focus();
      } else if (codeInput) {
        codeInput.focus();
      }
    }, 100);
  };

  window.selectJoinColor = function (col, btn) {
    if (btn.disabled) return;
    document.getElementById('ludoJoinChosenColor').value = col;
    document.querySelectorAll('.ludo-join-color-btn:not([disabled])').forEach(b => {
      b.className = 'ludo-join-color-btn py-2 px-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex flex-col items-center gap-0.5 transition cursor-pointer';
    });
    btn.className = 'ludo-join-color-btn active py-2 px-1 rounded-xl border-2 border-indigo-600 bg-indigo-50 text-indigo-800 flex flex-col items-center gap-0.5 transition shadow-xs cursor-pointer';
  };

  window.setJoinRole = function (role) {
    const hidden = document.getElementById('ludoJoinRole');
    if (hidden) hidden.value = role;
    const playerBtn = document.getElementById('ludoRolePlayerBtn');
    const spectatorBtn = document.getElementById('ludoRoleSpectatorBtn');
    const colorSection = document.getElementById('ludoJoinColorPickerSection');
    const submitBtn = document.getElementById('ludoJoinSubmitBtn');

    if (role === 'spectator') {
      if (spectatorBtn) spectatorBtn.className = 'py-2 px-3 rounded-xl border-2 border-indigo-600 bg-indigo-50 text-indigo-800 text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs';
      if (playerBtn) playerBtn.className = 'py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition hover:bg-slate-50';
      if (colorSection) colorSection.classList.add('hidden');
      if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-eye mr-1"></i> Watch as Spectator';
    } else {
      if (playerBtn) playerBtn.className = 'py-2 px-3 rounded-xl border-2 border-indigo-600 bg-indigo-50 text-indigo-800 text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs';
      if (spectatorBtn) spectatorBtn.className = 'py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition hover:bg-slate-50';
      if (colorSection) colorSection.classList.remove('hidden');
      if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-gamepad mr-1"></i> Join Game';
    }
  };

  let _ludoJoinCodeTimer = null;
  window.handleJoinCodeInput = function (val) {
    if (!val) {
      const hint = document.getElementById('ludoRoomCodeStatusHint');
      if (hint) hint.innerHTML = '';
      return;
    }

    clearTimeout(_ludoJoinCodeTimer);
    _ludoJoinCodeTimer = setTimeout(() => {
      let clean = val.trim().toUpperCase().replace(/\s+/g, '');
      if (!clean.startsWith('LD-')) {
        if (clean.startsWith('LD') && clean.length > 2) {
          clean = 'LD-' + clean.substring(2);
        } else if (clean.length === 4) {
          clean = 'LD-' + clean;
        }
      }

      // Automatically check once user enters 4 or more characters
      if (clean.length >= 6) {
        checkRoomColors(clean);
      }
    }, 250);
  };

  window.checkRoomColors = async function (explicitCode = null) {
    let code = explicitCode || document.getElementById('ludoJoinCode')?.value.trim();
    if (!code) return;

    code = code.toUpperCase().replace(/\s+/g, '');
    if (!code.startsWith('LD-')) {
      if (code.startsWith('LD') && code.length > 2) {
        code = 'LD-' + code.substring(2);
      } else if (code.length === 4) {
        code = 'LD-' + code;
      }
    }

    const inputEl = document.getElementById('ludoJoinCode');
    if (inputEl && inputEl.value !== code) {
      inputEl.value = code;
    }

    const hint = document.getElementById('ludoRoomCodeStatusHint');
    if (hint) {
      hint.innerHTML = `<span class="text-indigo-600 font-semibold flex items-center gap-1"><i class="fa-solid fa-spinner fa-spin text-[8px]"></i> Checking room ${code}...</span>`;
    }

    if (!window.LudoService || !window.LudoService.getRoomAvailableColors) return;
    const res = await window.LudoService.getRoomAvailableColors(code);
    if (!res.success) {
      if (hint) {
        hint.innerHTML = `<span class="text-rose-600 font-bold flex items-center gap-1"><i class="fa-solid fa-circle-xmark text-[9px]"></i> ${res.error}</span>`;
      }
      return;
    }

    if (res.isFull) {
      if (hint) hint.innerHTML = `<span class="text-amber-600 font-bold flex items-center gap-1"><i class="fa-solid fa-eye text-[9px]"></i> All player seats filled (${res.currentCount}/${res.playerCount}). Switching to Spectator mode.</span>`;
      setJoinRole('spectator');
      const playerBtn = document.getElementById('ludoRolePlayerBtn');
      if (playerBtn) {
        playerBtn.disabled = true;
        playerBtn.classList.add('opacity-40', 'cursor-not-allowed');
      }
    } else {
      if (hint) hint.innerHTML = `<span class="text-emerald-600 font-bold flex items-center gap-1"><i class="fa-solid fa-circle-check text-[9px]"></i> Room open (${res.currentCount}/${res.playerCount} players). Select role & color:</span>`;
      const playerBtn = document.getElementById('ludoRolePlayerBtn');
      if (playerBtn) {
        playerBtn.disabled = false;
        playerBtn.classList.remove('opacity-40', 'cursor-not-allowed');
      }
    }

    const buttons = document.querySelectorAll('.ludo-join-color-btn');
    let firstAvailable = null;
    buttons.forEach(btn => {
      const c = btn.getAttribute('data-color');
      const tag = btn.querySelector('.join-color-tag');
      const isTaken = res.takenColors && res.takenColors.includes(c);

      if (isTaken) {
        btn.disabled = true;
        btn.className = 'ludo-join-color-btn py-2 px-1 rounded-xl border border-dashed border-rose-200 bg-rose-50/70 text-rose-500 opacity-60 cursor-not-allowed flex flex-col items-center gap-0.5 line-through';
        const takenByName = res.takenMap && res.takenMap[c];
        if (tag) tag.textContent = takenByName ? `Taken (${takenByName})` : 'Taken';
      } else {
        btn.disabled = false;
        btn.className = 'ludo-join-color-btn py-2 px-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex flex-col items-center gap-0.5 transition cursor-pointer';
        if (tag) tag.textContent = 'Available';
        if (!firstAvailable) firstAvailable = { col: c, btn };
      }
    });

    const chosenInput = document.getElementById('ludoJoinChosenColor');
    const currentVal = chosenInput?.value;
    if ((res.takenColors && res.takenColors.includes(currentVal)) && firstAvailable) {
      selectJoinColor(firstAvailable.col, firstAvailable.btn);
    }
  };

  window.submitJoinRoom = async function () {
    const nameInput = document.getElementById('ludoJoinPlayerName');
    const name = nameInput?.value.trim();
    if (!name) {
      if (typeof showAlert === 'function') {
        showAlert('Please enter your name to continue.', { title: 'Name Required', tone: 'warning' });
      } else if (typeof showToast === 'function') {
        showToast('Please enter your name to continue.', 'warning');
      }
      if (nameInput) {
        nameInput.focus();
        nameInput.classList.add('border-rose-400', 'ring-2', 'ring-rose-200');
      }
      return;
    }

    const codeInput = document.getElementById('ludoJoinCode');
    const code = codeInput?.value.trim();
    if (!code) {
      if (typeof showAlert === 'function') {
        showAlert('Please enter a room code.', { title: 'Code Required', tone: 'warning' });
      } else if (typeof showToast === 'function') {
        showToast('Please enter a room code.', 'warning');
      }
      if (codeInput) {
        codeInput.focus();
        codeInput.classList.add('border-rose-400', 'ring-2', 'ring-rose-200');
      }
      return;
    }

    const btn = document.getElementById('ludoJoinSubmitBtn') || document.querySelector('#ludoJoinRoomModal button[onclick="submitJoinRoom()"]');
    let origText = '';
    if (btn) {
      origText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin text-xs"></i> Connecting...';
    }

    if (!window.LudoService) {
      if (btn) { btn.disabled = false; btn.innerHTML = origText; }
      return;
    }

    try {
      const res = await window.LudoService.joinOnlineRoom(code, name, chosenColor, isSpectator);
      if (res.success) {
        document.getElementById('ludoJoinRoomModal')?.remove();
        const session = window.LudoService.getSession();
        const meta = (session.roomData && session.roomData.meta) || {};
        setLudoSubView(meta.status === 'playing' ? 'board' : 'waiting');
        renderLudoGame(document.getElementById('mainContainer'));
        if (res.isSpectator) {
          if (typeof showToast === 'function') {
            showToast('Watching as Spectator (Live view).', 'info');
          }
        }
      } else {
        if (btn) { btn.disabled = false; btn.innerHTML = origText; }
        if (typeof showAlert === 'function') {
          showAlert(res.error || 'Failed to join room.', { title: 'Join Failed', tone: 'danger' });
        } else if (typeof showToast === 'function') {
          showToast(res.error || 'Failed to join room.', 'error');
        }
        checkRoomColors(code);
      }
    } catch (e) {
      if (btn) { btn.disabled = false; btn.innerHTML = origText; }
      if (typeof showAlert === 'function') {
        showAlert(e.message || 'An unexpected error occurred.', { title: 'Join Failed', tone: 'danger' });
      } else if (typeof showToast === 'function') {
        showToast(e.message || 'An unexpected error occurred.', 'error');
      }
    }
  };

  // --- 4. Waiting Room View ---
  function renderLudoWaitingRoom(container) {
    const session = window.LudoService ? window.LudoService.getSession() : {};
    const roomData = session.roomData || {};
    const meta = roomData.meta || {};
    const players = Object.values(roomData.players || {}).filter(p => p && !p.isSpectator && p.color);
    const spectators = getRoomSpectatorsList(session);

    if (meta.status === 'playing') {
      setLudoSubView('board');
      renderLudoBoardView(container);
      return;
    }

    container.innerHTML = `
      <div class="max-w-sm mx-auto space-y-4 pb-8 select-none text-center animate-fade-in pt-2">
        <!-- Top Controls: Back to Hub -->
        <div class="flex items-center justify-between gap-2 px-1">
          <button type="button" onclick="pauseLudoToHub()" class="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center transition shadow-xs" title="Back to Hub">
            <i class="fa-solid fa-arrow-left text-xs"></i>
          </button>
        </div>

        <div class="w-16 h-16 rounded-3xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto text-2xl animate-pulse">
          <i class="fa-solid fa-users"></i>
        </div>

        <div>
          <span class="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600">Waiting for Players</span>
          <h2 class="text-xl font-black text-slate-800 mt-1">Multiplayer Lobby</h2>
          <p class="text-xs text-slate-400 mt-0.5">Share this room code with friends to join</p>
        </div>

        <!-- Room Code Interactive Area (Click anywhere in this box to copy) -->
        <div id="ludoRoomCodeBox"
             onclick="copyLudoRoomCode('${session.roomCode || ''}')"
             class="group relative p-5 bg-gradient-to-br from-indigo-50/90 via-purple-50/60 to-indigo-100/80 border-2 border-indigo-200 hover:border-indigo-400 active:border-emerald-500 rounded-3xl space-y-2 cursor-pointer transition-all duration-200 active:scale-98 shadow-sm hover:shadow-md select-none"
             title="Click anywhere in this box to copy code">
          <div class="flex items-center justify-between text-[10px] font-extrabold text-indigo-700">
            <span class="uppercase tracking-wider flex items-center gap-1">
              <i class="fa-solid fa-hashtag text-[9px] opacity-70"></i> Room Code
            </span>
            <span id="ludoCopyStatusBadge" class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/90 border border-indigo-200 text-indigo-600 font-bold transition-all shadow-xs">
              <i class="fa-regular fa-clone text-[9px]"></i>
              <span>Click box to copy</span>
            </span>
          </div>

          <div id="ludoRoomCodeDisplay" class="text-3xl font-black font-mono tracking-widest text-indigo-900 py-1 transition-transform group-hover:scale-105">
            ${session.roomCode || '---'}
          </div>

          <p id="ludoCopyHintText" class="text-[10px] text-slate-500 font-medium">
            Tap anywhere in this area to copy code
          </p>
        </div>

        ${session.isSpectator ? `
        <!-- Spectator Notice Banner -->
        <div class="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs font-bold flex items-center justify-center gap-2 shadow-xs">
          <i class="fa-solid fa-eye text-amber-600"></i>
          <span>${players.length >= (meta.playerCount || 2) ? 'All player seats are full • You are spectating this match' : 'You are watching this match as a spectator'}</span>
        </div>
        ` : ''}

        <!-- Joined Players List -->
        <div class="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm space-y-2 text-left">
          <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block px-1">
            Joined Players (${players.length}/${meta.playerCount || 2})
            ${session.isSpectator ? '<span class="ml-1 text-amber-700 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded-full font-black text-[8px]">You: Spectator</span>' : ''}
          </span>
          <div class="space-y-1.5">
            ${players.map(p => {
              const isMe = (p.id === session.myUid);
              const isOnline = p.online !== false;
              const canHostRemove = isUserHost(session) && !p.isHost && p.id !== session.myUid;
              return `
              <div class="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 border border-slate-100 gap-2">
                <div class="flex items-center gap-2 min-w-0 flex-1">
                  <div class="w-7 h-7 rounded-full flex items-center justify-center text-[10px] text-white font-bold shrink-0 shadow-xs" style="background-color: ${COLOR_PALETTE[p.color]?.primary || '#64748b'}">
                    <i class="fa-solid fa-user"></i>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="text-xs font-black text-slate-800 truncate">${p.name}${isMe ? ' (You)' : ''}</span>
                      ${p.isHost ? '<span class="text-[8px] bg-indigo-100 text-indigo-800 font-black px-1.5 py-0.2 rounded-full">Host</span>' : ''}
                    </div>
                    <div class="flex items-center gap-1.5 mt-0.5">
                      <span class="inline-flex items-center gap-1 text-[8px] font-extrabold px-1.5 py-0.2 rounded-full ${isOnline ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}">
                        <span class="w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}"></span>
                        ${isOnline ? 'Online' : 'Offline'}
                      </span>
                      <span class="text-[9px] font-bold capitalize text-slate-400">• ${p.color}</span>
                    </div>
                  </div>
                </div>

                ${canHostRemove ? `
                  <button type="button" onclick="confirmRemoveParticipant('${p.id}', '${(p.name || '').replace(/'/g, "\\'")}', false)"
                          class="px-2 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px] font-extrabold border border-rose-200 transition flex items-center gap-1 shadow-2xs shrink-0"
                          title="Remove Player (Host)">
                    <i class="fa-solid fa-user-xmark text-[9px]"></i>
                    <span>Kick</span>
                  </button>
                ` : ''}
              </div>
            `;
            }).join('')}
          </div>
        </div>

        <!-- Waiting Room Spectators Section (Always visible) -->
        <div class="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm space-y-2 text-left animate-fade-in">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block px-1">
              Spectators (${spectators.length})
            </span>
            <span class="text-[9px] text-slate-400 font-medium">Watching lobby</span>
          </div>
          ${spectators.length === 0 ? `
            <div class="py-2.5 px-3 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center text-slate-400 text-xs font-medium">
              <i class="fa-regular fa-eye-slash mr-1"></i> No spectators watching yet
            </div>
          ` : `
            <div class="space-y-1.5">
              ${spectators.map(sp => {
                const isMe = (sp.id === session.myUid);
                const isOnline = sp.online !== false;
                const canHostRemove = isUserHost(session) && sp.id !== session.myUid;
                return `
                <div class="flex items-center justify-between p-2 rounded-2xl bg-slate-50 border border-slate-100 gap-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <div class="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] shrink-0">
                      <i class="fa-solid fa-eye text-[9px]"></i>
                    </div>
                    <span class="text-xs font-bold text-slate-700 truncate">${sp.name}${isMe ? ' (You)' : ''}</span>
                    <span class="inline-flex items-center gap-1 text-[8px] font-extrabold px-1.5 py-0.2 rounded-full ${isOnline ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}">
                      <span class="w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
                      ${isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  ${canHostRemove ? `
                    <button type="button" onclick="confirmRemoveParticipant('${sp.id}', '${(sp.name || '').replace(/'/g, "\\'")}', true)"
                            class="px-2 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px] font-extrabold border border-rose-200 transition flex items-center gap-1 shadow-2xs shrink-0"
                            title="Remove Spectator (Host)">
                      <i class="fa-solid fa-xmark text-[9px]"></i>
                      <span>Remove</span>
                    </button>
                  ` : ''}
                </div>
              `;
              }).join('')}
            </div>
          `}
        </div>

        ${isUserHost(session) ? `
        <div class="space-y-2 pt-2">
          <button type="button" onclick="deleteLudoRoomPrompt()" class="w-full py-2.5 px-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs hover:bg-rose-100 transition shadow-xs flex items-center justify-center gap-2 active:scale-98">
            <i class="fa-solid fa-trash-can text-rose-600"></i>
            <span>Delete & Disband Room (Host)</span>
          </button>
          <button type="button" onclick="pauseLudoToHub()" class="w-full py-2 px-3 rounded-2xl border border-slate-200 text-slate-500 font-bold text-xs hover:bg-slate-50 transition active:scale-98">
            Back to Hub (Keep Room Open)
          </button>
        </div>
        ` : `
        <button type="button" onclick="leaveLudoRoom()" class="w-full py-2.5 rounded-2xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition">
          ${session.isSpectator ? 'Leave Match' : 'Leave Room'}
        </button>
        `}
      </div>
    `;
  }

  window.leaveLudoRoom = function () {
    if (_botTimer) {
      clearTimeout(_botTimer);
      _botTimer = null;
    }
    if (window.LudoService) {
      window.LudoService.abandonActiveSession();
    }
    setLudoSubView('hub');
    renderLudoGame(document.getElementById('mainContainer'));
  };

  // --- 5. Ludo Board View & Gameplay Logic ---
  function renderLudoBoardView(container) {
    const session = window.LudoService ? window.LudoService.getSession() : {};
    const roomData = session.roomData || {};
    const game = roomData.game || {};
    const turnColor = game.currentTurnColor || 'red';
    const isMyTurn = (turnColor === session.myColor);
    const diceVal = game.diceValue;
    const currentPalette = COLOR_PALETTE[turnColor] || COLOR_PALETTE.red;
    const winner = game.winner;

    const turnPlayerInfo = getPlayerInfoByColor(turnColor, session);
    const turnPlayerName = turnPlayerInfo.name || currentPalette.name;

    // Check if player has movable tokens
    const tokens = (game.tokens && game.tokens[turnColor]) || [-1, -1, -1, -1];
    const hasMovableTokens = game.diceRolled && tokens.some((pos, idx) => canMoveToken(turnColor, idx, diceVal, game));

    container.innerHTML = `
      <div class="${ludoIsZoomed ? 'max-w-5xl' : 'max-w-md'} mx-auto space-y-3 pb-8 select-none animate-fade-in">
        <!-- Top App Bar -->
        <div class="flex items-center justify-between gap-2 px-1">
          <div class="flex items-center gap-1.5 min-w-0">
            <button type="button" onclick="pauseLudoToHub()" class="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center transition shadow-xs shrink-0" title="Pause & Back to Hub">
              <i class="fa-solid fa-arrow-left text-xs"></i>
            </button>
            <!-- Room ID Badge -->
            <div class="min-w-0 flex items-center shrink-0">
              ${session.mode === 'system'
                ? `<span class="text-xs text-slate-400 font-bold hidden xs:inline">vs Bot</span>`
                : `<span onclick="copyLudoRoomCode('${session.roomCode || ''}', 'boardCodePill')" id="boardCodePill" class="cursor-pointer inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition font-mono font-black text-xs shadow-2xs active:scale-95 shrink-0" title="Click to copy code">
                     <span>${session.roomCode}</span>
                     <i class="fa-regular fa-clone text-[8px] text-indigo-500"></i>
                   </span>`
              }
            </div>
            <!-- Logged-in / Playing Person Name Badge -->
            <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-slate-800 shadow-2xs text-xs font-bold shrink-0 max-w-[130px] sm:max-w-[170px]" title="Logged in player">
              ${session.isSpectator
                ? `<i class="fa-solid fa-eye text-amber-500 text-[10px] shrink-0"></i>`
                : `<span class="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs" style="background-color: ${COLOR_PALETTE[session.myColor]?.primary || '#6366f1'}"></span>`
              }
              <span class="truncate font-black">${session.myName || (session.isSpectator ? 'Spectator' : 'You')}${!session.isSpectator ? ' (You)' : ''}</span>
            </div>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">

            <!-- Laptop Zoomify Button -->
            <button type="button" onclick="toggleLudoZoomify()"
                    class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border ${ludoIsZoomed ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600'} hover:bg-indigo-100 transition shadow-xs text-xs font-bold shrink-0"
                    title="${ludoIsZoomed ? 'Switch to Compact / Mobile View' : 'Zoomify to fit laptop screen'}">
              <i class="fa-solid ${ludoIsZoomed ? 'fa-compress text-indigo-600' : 'fa-expand text-slate-500'} text-[11px]"></i>
              <span class="hidden sm:inline">${ludoIsZoomed ? 'Fit Mobile' : 'Zoomify'}</span>
            </button>

            <!-- Abandon / Quit Option -->
            <button type="button" onclick="abandonLudoSessionPrompt()" class="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition shadow-xs shrink-0" title="${session.isSpectator ? 'Leave Match' : 'Abandon Match'}">
              <i class="fa-solid fa-arrow-right-from-bracket text-xs"></i>
            </button>
          </div>
        </div>

        ${ludoIsZoomed ? `
        <!-- Zoomify Desktop Fit Side-by-Side Layout -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start pt-1">
          <!-- Left Column: Big Ludo Board Canvas (7 cols) -->
          <div class="lg:col-span-7 flex justify-center">
            <div class="w-full max-w-[560px] aspect-square bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 p-2 sm:p-3 rounded-3xl shadow-2xl border-4 border-slate-800 relative select-none">
              <svg viewBox="0 0 600 600" class="w-full h-full rounded-2xl bg-white shadow-2xl overflow-hidden" style="touch-action: manipulation;">
                ${renderSvgBoardContents(game, session)}
              </svg>
            </div>
          </div>

          <!-- Right Column: Dice HUD, Token Progress & Spectators (5 cols) -->
          <div class="lg:col-span-5 space-y-3">
            <!-- Dice Roll & Turn Controls HUD -->
            <div class="bg-white rounded-3xl p-3.5 sm:p-4 border border-slate-100 shadow-md flex items-center justify-between gap-3.5">
              <div class="flex items-center gap-3.5 min-w-0">
                <div class="relative shrink-0">
                  <button type="button" id="ludoDiceBtn" onclick="handleDiceRollClick()"
                          class="w-20 h-20 sm:w-24 sm:h-24 p-1 rounded-3xl shadow-xl border-2 flex items-center justify-center transition-all duration-200 active:scale-95 relative ${
                            !session.isSpectator && !game.diceRolled && isMyTurn
                              ? 'bg-gradient-to-br from-white via-amber-50 to-amber-100 border-amber-400 ring-4 ring-amber-300 ring-offset-2 cursor-pointer dice-glowing-turn shadow-amber-500/30'
                              : 'bg-gradient-to-br from-white via-slate-50 to-slate-100 border-slate-200'
                          }"
                          title="${session.isSpectator ? 'Spectator Mode (Watch Only)' : (isMyTurn && !game.diceRolled ? 'Tap to Roll Dice!' : '')}">
                    ${getDiceFaceHtml(diceVal, _isDiceRolling)}
                  </button>

                  ${!session.isSpectator && !game.diceRolled && isMyTurn ? `
                    <span class="absolute -bottom-2 -right-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-black uppercase tracking-wider shadow-sm pointer-events-none animate-pulse">
                      ROLL
                    </span>
                  ` : ''}
                </div>

                <div class="min-w-0 space-y-1">
                  <div class="flex items-center gap-1.5">
                    <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${currentPalette.primary}"></span>
                    <span class="text-xs font-black uppercase tracking-wider truncate max-w-[150px]" style="color: ${currentPalette.dark}">
                      ${turnPlayerName}
                    </span>
                    ${isMyTurn && !session.isSpectator ? '<span class="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded-full">YOU</span>' : ''}
                    ${session.isSpectator ? '<span class="text-[9px] bg-slate-100 text-slate-700 font-extrabold px-1.5 py-0.2 rounded-full">SPECTATING</span>' : ''}
                  </div>

                  <p class="text-xs sm:text-sm font-bold text-slate-800 leading-tight">
                    ${
                      session.isSpectator
                        ? (!game.diceRolled
                            ? `${turnPlayerName} is rolling the dice...`
                            : (hasMovableTokens ? `${turnPlayerName} rolled ${diceVal}! Picking token...` : `${turnPlayerName} rolled ${diceVal} (no moves).`))
                        : (!game.diceRolled
                            ? (isMyTurn ? 'Tap the dice to roll!' : `Waiting for ${turnPlayerName} to roll...`)
                            : (hasMovableTokens
                                ? (isMyTurn ? `Rolled ${diceVal}! Pick a glowing token.` : `${turnPlayerName} rolled ${diceVal}! Picking token...`)
                                : (isMyTurn ? `Rolled ${diceVal}! No moves available.` : `${turnPlayerName} rolled ${diceVal} (no moves).`)))
                    }
                  </p>

                  ${
                    session.isSpectator
                      ? '<p class="text-[10px] font-bold text-slate-400 flex items-center gap-1"><i class="fa-solid fa-eye text-slate-500"></i> Spectator Mode • Watching live</p>'
                      : (game.diceRolled && diceVal === 6
                          ? '<p class="text-[10px] font-black text-amber-600 flex items-center gap-1"><i class="fa-solid fa-star"></i> Rolled 6! You get an extra roll!</p>'
                          : '')
                  }
                </div>
              </div>

              ${
                !session.isSpectator && game.diceRolled && isMyTurn && hasMovableTokens
                  ? `
                  <div class="shrink-0 flex flex-col items-center gap-1">
                    <span class="text-[10px] bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black px-3 py-1.5 rounded-2xl shadow-sm animate-pulse uppercase tracking-wider">
                      Pick Token
                    </span>
                  </div>
                `
                  : ''
              }
            </div>

            <!-- Token Progress Summary Bar -->
            <div class="grid grid-cols-2 gap-2 text-[10px] font-bold">
              ${renderPlayerProgressPills(game, session)}
            </div>

            <!-- Live Spectators Section (Online match) -->
            ${renderSpectatorsSection(session)}
          </div>
        </div>
        ` : `
        <!-- Standard Mobile Stack Layout -->
        <div class="flex justify-center px-0.5">
          <div class="w-full max-w-[440px] aspect-square bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 p-2 sm:p-3 rounded-3xl shadow-2xl border-4 border-slate-800 relative select-none">
            <svg viewBox="0 0 600 600" class="w-full h-full rounded-2xl bg-white shadow-2xl overflow-hidden" style="touch-action: manipulation;">
              ${renderSvgBoardContents(game, session)}
            </svg>
          </div>
        </div>

        <!-- Dice Roll & Turn Controls HUD -->
        <div class="bg-white rounded-3xl p-3.5 sm:p-4 border border-slate-100 shadow-md flex items-center justify-between gap-3.5 max-w-[440px] mx-auto">
          <div class="flex items-center gap-3.5 min-w-0">
            <div class="relative shrink-0">
              <button type="button" id="ludoDiceBtn" onclick="handleDiceRollClick()"
                      class="w-20 h-20 sm:w-24 sm:h-24 p-1 rounded-3xl shadow-xl border-2 flex items-center justify-center transition-all duration-200 active:scale-95 relative ${
                        !session.isSpectator && !game.diceRolled && isMyTurn
                          ? 'bg-gradient-to-br from-white via-amber-50 to-amber-100 border-amber-400 ring-4 ring-amber-300 ring-offset-2 cursor-pointer dice-glowing-turn shadow-amber-500/30'
                          : 'bg-gradient-to-br from-white via-slate-50 to-slate-100 border-slate-200'
                      }"
                      title="${session.isSpectator ? 'Spectator Mode (Watch Only)' : (isMyTurn && !game.diceRolled ? 'Tap to Roll Dice!' : '')}">
                ${getDiceFaceHtml(diceVal, _isDiceRolling)}
              </button>

              ${!session.isSpectator && !game.diceRolled && isMyTurn ? `
                <span class="absolute -bottom-2 -right-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-black uppercase tracking-wider shadow-sm pointer-events-none animate-pulse">
                  ROLL
                </span>
              ` : ''}
            </div>

            <div class="min-w-0 space-y-1">
              <div class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${currentPalette.primary}"></span>
                <span class="text-xs font-black uppercase tracking-wider truncate max-w-[150px]" style="color: ${currentPalette.dark}">
                  ${turnPlayerName}
                </span>
                ${isMyTurn && !session.isSpectator ? '<span class="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded-full">YOU</span>' : ''}
                ${session.isSpectator ? '<span class="text-[9px] bg-slate-100 text-slate-700 font-extrabold px-1.5 py-0.2 rounded-full">SPECTATING</span>' : ''}
              </div>

              <p class="text-xs sm:text-sm font-bold text-slate-800 leading-tight">
                ${
                  session.isSpectator
                    ? (!game.diceRolled
                        ? `${turnPlayerName} is rolling the dice...`
                        : (hasMovableTokens ? `${turnPlayerName} rolled ${diceVal}! Picking token...` : `${turnPlayerName} rolled ${diceVal} (no moves).`))
                    : (!game.diceRolled
                        ? (isMyTurn ? 'Tap the dice to roll!' : `Waiting for ${turnPlayerName} to roll...`)
                        : (hasMovableTokens
                            ? (isMyTurn ? `Rolled ${diceVal}! Pick a glowing token.` : `${turnPlayerName} rolled ${diceVal}! Picking token...`)
                            : (isMyTurn ? `Rolled ${diceVal}! No moves available.` : `${turnPlayerName} rolled ${diceVal} (no moves).`)))
                }
              </p>

              ${
                session.isSpectator
                  ? '<p class="text-[10px] font-bold text-slate-400 flex items-center gap-1"><i class="fa-solid fa-eye text-slate-500"></i> Spectator Mode • Watching live</p>'
                  : (game.diceRolled && diceVal === 6
                      ? '<p class="text-[10px] font-black text-amber-600 flex items-center gap-1"><i class="fa-solid fa-star"></i> Rolled 6! You get an extra roll!</p>'
                      : '')
              }
            </div>
          </div>

          ${
            !session.isSpectator && game.diceRolled && isMyTurn && hasMovableTokens
              ? `
              <div class="shrink-0 flex flex-col items-center gap-1">
                <span class="text-[10px] bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black px-3 py-1.5 rounded-2xl shadow-sm animate-pulse uppercase tracking-wider">
                  Pick Token
                </span>
              </div>
            `
              : ''
          }
        </div>

        <!-- Token Progress Summary Bar (Strictly 2 per row: 1 & 2 in row 1, 3 & 4 in row 2) -->
        <div class="grid grid-cols-2 gap-2 max-w-[440px] mx-auto text-[10px] font-bold">
          ${renderPlayerProgressPills(game, session)}
        </div>

        <!-- Live Spectators Section (Online match) -->
        ${renderSpectatorsSection(session)}
        `}

        <!-- Winner Modal Celebration Overlay -->
        ${
          winner
            ? `
          <div class="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div class="bg-white rounded-3xl p-6 max-w-xs w-full text-center space-y-4 shadow-2xl border-4 border-amber-400">
              <div class="w-16 h-16 rounded-full bg-amber-100 text-amber-500 mx-auto flex items-center justify-center text-3xl animate-bounce">
                🏆
              </div>
              <div>
                <span class="text-[10px] font-black uppercase tracking-widest text-amber-600">Victory!</span>
                <h2 class="text-xl font-black text-slate-800 mt-1 flex items-center justify-center gap-1.5">
                  <span class="w-3 h-3 rounded-full shrink-0" style="background-color: ${COLOR_PALETTE[winner]?.primary || '#fbbf24'}"></span>
                  <span>${getPlayerInfoByColor(winner, session).name} Wins!</span>
                </h2>
                <p class="text-xs text-slate-500 mt-1">All 4 tokens reached home safely!</p>
              </div>
              <button type="button" onclick="leaveLudoRoom()" class="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-xs shadow-lg hover:opacity-95 transition">
                Play Again
              </button>
            </div>
          </div>
        `
            : ''
        }
      </div>
    `;

    // Bot automation trigger (if it's Bot's turn in system mode)
    if (session.mode === 'system' && turnColor !== session.myColor && !winner) {
      triggerBotTurn();
    }
  }

  function renderPlayerProgressPills(game, session) {
    const colors = getActiveGameColors(game, session);

    return colors
      .map(col => {
        const pal = COLOR_PALETTE[col];
        const pInfo = getPlayerInfoByColor(col, session);
        const isMe = (pInfo.id && pInfo.id === session.myUid) || (session.myColor === col && !session.isSpectator);
        const rawName = pInfo?.name || pal.name;
        const cleanName = rawName.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').replace(/\(You\)/i, '').trim();
        const displayName = isMe
          ? (cleanName ? `${cleanName} (You)` : 'You')
          : (cleanName || pal.name);

        const tokens = (game.tokens && game.tokens[col]) || [-1, -1, -1, -1];
        const homeCount = tokens.filter(p => p >= 56).length;
        const isCurrent = (game.currentTurnColor === col);

        let statusBadge = '';
        if (session.mode === 'online') {
          if (pInfo.removed) {
            statusBadge = '<span class="text-[8px] font-black text-rose-600 bg-rose-50 border border-rose-200 px-1 py-0.2 rounded shrink-0">Removed</span>';
          } else if (pInfo.left) {
            statusBadge = '<span class="text-[8px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.2 rounded shrink-0">Left</span>';
          } else if (pInfo.online === false) {
            statusBadge = '<span class="inline-flex items-center gap-1 text-[8px] font-extrabold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded-full shrink-0"><span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>Offline</span>';
          } else {
            statusBadge = '<span class="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Online"></span>';
          }
        }

        const canHostRemove = isUserHost(session) && session.mode === 'online' && pInfo.id && pInfo.id !== session.myUid && !pInfo.removed;

        return `
          <div class="p-2.5 rounded-2xl bg-white border ${isCurrent ? 'border-amber-400 ring-2 ring-amber-300 shadow-sm' : 'border-slate-200'} flex items-center justify-between gap-1 shadow-xs transition-all min-w-0">
            <div class="flex items-center gap-1.5 min-w-0 flex-1">
              <span class="w-3 h-3 rounded-full shrink-0 shadow-xs" style="background-color: ${pal.primary}"></span>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1 min-w-0">
                  <span class="font-black text-slate-800 truncate text-[11px] leading-tight" title="${displayName}">${displayName}</span>
                  ${statusBadge}
                </div>
              </div>
            </div>

            <div class="flex items-center gap-1 shrink-0">
              <span class="text-[10px] font-black text-slate-600 whitespace-nowrap">${homeCount}/4 🏆</span>
              ${canHostRemove ? `
                <button type="button" onclick="event.stopPropagation(); window.confirmRemoveParticipant('${pInfo.id}', '${(pInfo.name || '').replace(/'/g, "\\'")}', false)"
                        class="w-5 h-5 rounded-md hover:bg-rose-50 text-slate-300 hover:text-rose-600 flex items-center justify-center transition shrink-0 ml-0.5" title="Remove Player (Host)">
                  <i class="fa-solid fa-xmark text-[10px]"></i>
                </button>
              ` : ''}
            </div>
          </div>
        `;
      })
      .join('');
  }

  function renderSpectatorsSection(session) {
    if (!session || session.mode !== 'online') return '';
    const spectators = getRoomSpectatorsList(session);

    return `
      <div class="${ludoIsZoomed ? 'w-full' : 'max-w-[440px]'} mx-auto p-3 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2 text-left animate-fade-in">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <i class="fa-solid fa-eye text-indigo-500"></i>
            <span>Spectators (${spectators.length})</span>
          </span>
          <span class="text-[9px] text-slate-400 font-medium">Watching live</span>
        </div>

        ${spectators.length === 0 ? `
          <div class="py-2.5 px-3 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-slate-400 text-xs font-medium">
            <i class="fa-regular fa-eye-slash mr-1"></i> No spectators watching yet
          </div>
        ` : `
          <div class="flex flex-wrap gap-1.5">
            ${spectators.map(sp => {
              const isMe = (sp.id === session.myUid);
              const isOnline = sp.online !== false;
              const canHostRemove = isUserHost(session) && sp.id !== session.myUid;
              return `
                <div class="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-xl border ${isMe ? 'bg-indigo-50 border-indigo-200 text-indigo-900' : 'bg-slate-50 border-slate-200 text-slate-700'} text-[10px] font-bold shadow-2xs">
                  <span class="w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
                  <span class="truncate max-w-[120px]">${sp.name}${isMe ? ' (You)' : ''}</span>
                  <span class="text-[8px] font-extrabold ${isOnline ? 'text-emerald-600' : 'text-slate-400'}">${isOnline ? 'Online' : 'Offline'}</span>
                  ${canHostRemove ? `
                    <button type="button" onclick="event.stopPropagation(); window.confirmRemoveParticipant('${sp.id}', '${(sp.name || '').replace(/'/g, "\\'")}', true)"
                            class="w-4 h-4 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition ml-0.5" title="Remove Spectator (Host)">
                      <i class="fa-solid fa-xmark text-[8px]"></i>
                    </button>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;
  }

  function getDiceFaceHtml(val, isRolling) {
    const diceStyles = `
      <style>
        @keyframes diceGlowTurn {
          0%, 100% {
            box-shadow: 0 0 10px rgba(245, 158, 11, 0.4), 0 0 20px rgba(251, 191, 36, 0.25);
            border-color: #f59e0b;
          }
          50% {
            box-shadow: 0 0 22px rgba(245, 158, 11, 0.8), 0 0 38px rgba(251, 191, 36, 0.55);
            border-color: #fbbf24;
          }
        }
        .dice-glowing-turn {
          animation: diceGlowTurn 1.6s ease-in-out infinite !important;
        }
        @keyframes diceGlowPulse {
          0%, 100% {
            filter: drop-shadow(0 0 5px rgba(245, 158, 11, 0.5)) drop-shadow(0 0 12px rgba(251, 191, 36, 0.3));
            transform: scale(0.98);
          }
          50% {
            filter: drop-shadow(0 0 16px rgba(245, 158, 11, 0.95)) drop-shadow(0 0 26px rgba(251, 191, 36, 0.65));
            transform: scale(1.03);
          }
        }
        .dice-glowing-roll {
          animation: diceGlowPulse 0.5s ease-in-out infinite;
          transform-origin: 48px 48px;
        }
      </style>
    `;

    const defs = `
      <defs>
        ${diceStyles}
        <!-- Contact ambient drop shadow -->
        <filter id="diceShadowFilter" x="-20%" y="-20%" width="150%" height="150%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#090d16" flood-opacity="0.32"/>
        </filter>

        <!-- Ivory porcelain luxury face gradient with bevel depth -->
        <linearGradient id="ivoryFaceGrad" x1="10%" y1="5%" x2="90%" y2="95%">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="30%" stop-color="#fdfdfd"/>
          <stop offset="70%" stop-color="#f1f5f9"/>
          <stop offset="92%" stop-color="#e2e8f0"/>
          <stop offset="100%" stop-color="#cbd5e1"/>
        </linearGradient>

        <!-- Acrylic specular gloss reflection sweep -->
        <linearGradient id="glassGlossGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.65"/>
          <stop offset="40%" stop-color="#ffffff" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.0"/>
        </linearGradient>

        <!-- Deep Indented Pip dimple gradient (black onyx/sapphire) -->
        <radialGradient id="pipDimpleGrad" cx="30%" cy="25%" r="75%">
          <stop offset="0%" stop-color="#020617"/>
          <stop offset="55%" stop-color="#0f172a"/>
          <stop offset="85%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#334155"/>
        </radialGradient>

        <!-- Royal Ruby Ace Gemstone Gradient -->
        <radialGradient id="rubyAceGrad" cx="30%" cy="26%" r="74%">
          <stop offset="0%" stop-color="#ff7b7b"/>
          <stop offset="28%" stop-color="#ef4444"/>
          <stop offset="68%" stop-color="#b91c1c"/>
          <stop offset="90%" stop-color="#7f1d1d"/>
          <stop offset="100%" stop-color="#450a0a"/>
        </radialGradient>
      </defs>
    `;

    const renderCubeBody = `
      <!-- Ambient Floor Contact Shadow -->
      <ellipse cx="48" cy="88" rx="38" ry="5.5" fill="#0f172a" opacity="0.32" filter="url(#diceShadowFilter)"/>

      <!-- 3D Extrusion Depth Layers (Creates palpable physical cube thickness) -->
      <rect x="7" y="19" width="82" height="66" rx="20" fill="#334155"/>
      <rect x="7" y="16" width="82" height="68" rx="20" fill="#475569"/>
      <rect x="7" y="13" width="82" height="70" rx="20" fill="#64748b"/>
      <rect x="8" y="10" width="80" height="72" rx="19.5" fill="#94a3b8"/>
      <rect x="8" y="8" width="80" height="73" rx="19" fill="#cbd5e1"/>

      <!-- Main Elevated Playing Face -->
      <rect x="8" y="6" width="80" height="74" rx="18.5" fill="url(#ivoryFaceGrad)" stroke="#cbd5e1" stroke-width="1.2"/>

      <!-- Upper Glass Sheen Arc Reflection -->
      <path d="M 17 12 Q 48 9 79 12 Q 78 36 48 42 Q 18 36 17 12 Z" fill="url(#glassGlossGrad)"/>

      <!-- Specular Chamfer Highlight Line (Light catching top-left rounded edge) -->
      <path d="M 28 8 L 68 8 Q 85 8 85 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity="0.85"/>
      <path d="M 11 25 Q 11 9 27 8" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity="0.85"/>
    `;

    function renderIndentedPip(cx, cy, r) {
      return `
        <!-- Recessed outer drill bevel shadow -->
        <circle cx="${cx}" cy="${cy + 0.5}" r="${r + 0.8}" fill="#94a3b8" opacity="0.45"/>
        <!-- Carved concave dimple -->
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#pipDimpleGrad)"/>
        <!-- Bottom rim reflection (ambient bounce light on concave sphere) -->
        <ellipse cx="${cx}" cy="${cy + r * 0.42}" rx="${r * 0.72}" ry="${r * 0.32}" fill="#64748b" opacity="0.55"/>
        <!-- Top-left specular glare bead -->
        <circle cx="${cx - r * 0.32}" cy="${cy - r * 0.32}" r="${r * 0.28}" fill="#ffffff" opacity="0.9"/>
      `;
    }

    function renderRubyAce(cx = 48, cy = 43, r = 13) {
      return `
        <!-- Deep ruby bezel socket -->
        <circle cx="${cx}" cy="${cy + 0.6}" r="${r + 1.5}" fill="#450a0a" opacity="0.95"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#rubyAceGrad)"/>
        <!-- Bottom ambient fire glow -->
        <ellipse cx="${cx}" cy="${cy + r * 0.5}" rx="${r * 0.65}" ry="${r * 0.32}" fill="#f87171" opacity="0.65"/>
        <!-- Brilliant diamond facet specular glint -->
        <ellipse cx="${cx - r * 0.35}" cy="${cy - r * 0.3}" rx="${r * 0.28}" ry="${r * 0.16}" transform="rotate(-30 ${cx - r * 0.35} ${cy - r * 0.3})" fill="#ffffff" opacity="0.95"/>
        <circle cx="${cx - r * 0.5}" cy="${cy}" r="${r * 0.1}" fill="#ffffff" opacity="0.85"/>
        <ellipse cx="${cx + r * 0.38}" cy="${cy + r * 0.3}" rx="${r * 0.15}" ry="${r * 0.09}" fill="#ffffff" opacity="0.45"/>
      `;
    }

    let pipsSvg = '';
    const faceVal = val || 1;
    if (faceVal === 1) {
      pipsSvg = renderRubyAce(48, 43, 13);
    } else if (faceVal === 2) {
      pipsSvg = renderIndentedPip(27, 23, 7.5) + renderIndentedPip(69, 63, 7.5);
    } else if (faceVal === 3) {
      pipsSvg = renderIndentedPip(27, 23, 7.5) + renderIndentedPip(48, 43, 7.5) + renderIndentedPip(69, 63, 7.5);
    } else if (faceVal === 4) {
      pipsSvg = renderIndentedPip(27, 23, 7) + renderIndentedPip(69, 23, 7) +
                renderIndentedPip(27, 63, 7) + renderIndentedPip(69, 63, 7);
    } else if (faceVal === 5) {
      pipsSvg = renderIndentedPip(27, 23, 6.8) + renderIndentedPip(69, 23, 6.8) +
                renderIndentedPip(48, 43, 6.8) +
                renderIndentedPip(27, 63, 6.8) + renderIndentedPip(69, 63, 6.8);
    } else if (faceVal === 6) {
      pipsSvg = renderIndentedPip(27, 21, 6.2) + renderIndentedPip(69, 21, 6.2) +
                renderIndentedPip(27, 43, 6.2) + renderIndentedPip(69, 43, 6.2) +
                renderIndentedPip(27, 65, 6.2) + renderIndentedPip(69, 65, 6.2);
    }

    if (!val && !isRolling) {
      return `
        <svg viewBox="0 0 96 96" class="w-full h-full select-none transform transition-transform duration-150">
          ${defs}
          ${renderCubeBody}
          ${renderRubyAce(48, 38, 12)}
          <text x="48" y="70" text-anchor="middle" font-size="9" fill="#64748b" font-weight="900" letter-spacing="1">ROLL</text>
        </svg>
      `;
    }

    const animClass = isRolling ? 'dice-glowing-roll' : 'transform transition-transform duration-150';
    return `
      <svg viewBox="0 0 96 96" class="w-full h-full select-none ${animClass}">
        ${defs}
        ${renderCubeBody}
        ${pipsSvg}
      </svg>
    `;
  }

  // --- 6. SVG Board Contents Renderer ---
  function renderSvgBoardContents(game, session) {
    let svg = '';

    // 1. Defs: Drop Shadows, Luxury Gradients, and Token Materials
    svg += `
      <defs>
        <!-- Drop Shadows -->
        <filter id="boardShadow" x="-20%" y="-20%" width="150%" height="150%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.22"/>
        </filter>
        <filter id="tokenShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="3.5" flood-color="#0f172a" flood-opacity="0.45"/>
        </filter>
        <filter id="tokenGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#fbbf24" flood-opacity="0.95"/>
        </filter>
        <filter id="starGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#f59e0b" flood-opacity="0.5"/>
        </filter>

        <!-- Base Quadrant Gradients -->
        <linearGradient id="redBaseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ff4b4b"/>
          <stop offset="100%" stop-color="#b91c1c"/>
        </linearGradient>
        <linearGradient id="greenBaseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#10b981"/>
          <stop offset="100%" stop-color="#047857"/>
        </linearGradient>
        <linearGradient id="yellowBaseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fbbf24"/>
          <stop offset="100%" stop-color="#b45309"/>
        </linearGradient>
        <linearGradient id="blueBaseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#3b82f6"/>
          <stop offset="100%" stop-color="#1d4ed8"/>
        </linearGradient>

        <!-- Golden Metal Gradient -->
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fef08a"/>
          <stop offset="50%" stop-color="#f59e0b"/>
          <stop offset="100%" stop-color="#b45309"/>
        </linearGradient>

        <!-- 3D Spherical Token Gradients -->
        <radialGradient id="redTokenGrad" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#fca5a5"/>
          <stop offset="55%" stop-color="#ef4444"/>
          <stop offset="100%" stop-color="#991b1b"/>
        </radialGradient>
        <radialGradient id="greenTokenGrad" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#a7f3d0"/>
          <stop offset="55%" stop-color="#10b981"/>
          <stop offset="100%" stop-color="#065f46"/>
        </radialGradient>
        <radialGradient id="yellowTokenGrad" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#fef08a"/>
          <stop offset="55%" stop-color="#f59e0b"/>
          <stop offset="100%" stop-color="#92400e"/>
        </radialGradient>
        <radialGradient id="blueTokenGrad" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#bfdbfe"/>
          <stop offset="55%" stop-color="#3b82f6"/>
          <stop offset="100%" stop-color="#1e40af"/>
        </radialGradient>
      </defs>
    `;

    // 2. Luxury Board Framing
    svg += `
      <!-- Outer Board Frame -->
      <rect x="0" y="0" width="600" height="600" rx="28" fill="#0f172a"/>
      <rect x="5" y="5" width="590" height="590" rx="24" fill="#1e293b" stroke="#334155" stroke-width="2"/>
      <rect x="10" y="10" width="580" height="580" rx="20" fill="#f8fafc"/>
      <!-- Golden Inlay Perimeter -->
      <rect x="13" y="13" width="574" height="574" rx="18" fill="none" stroke="#f59e0b" stroke-width="2" stroke-opacity="0.8" stroke-dasharray="24 6 6 6"/>
      <!-- Corner Rivets -->
      <circle cx="20" cy="20" r="3.5" fill="#fbbf24" stroke="#92400e" stroke-width="1"/>
      <circle cx="580" cy="20" r="3.5" fill="#fbbf24" stroke="#92400e" stroke-width="1"/>
      <circle cx="20" cy="580" r="3.5" fill="#fbbf24" stroke="#92400e" stroke-width="1"/>
      <circle cx="580" cy="580" r="3.5" fill="#fbbf24" stroke="#92400e" stroke-width="1"/>
    `;

    // 3. Four Corner Home Yards (6x6 cells = 240x240 px each)
    svg += renderCornerYardSvg('red', 0, 0);
    svg += renderCornerYardSvg('green', 360, 0);
    svg += renderCornerYardSvg('yellow', 360, 360);
    svg += renderCornerYardSvg('blue', 0, 360);

    // 4. Center Finish Hub (3x3 cells = rows 6..8, cols 6..8: 240..360 px)
    svg += renderCenterFinishSvg();

    // 5. The 72 Pathway & Runway Blocks (40x40 px each)
    svg += renderPathwayBlocksSvg();

    // 6. Interactive Token Pieces Layer
    svg += renderTokensLayerSvg(game, session);

    return svg;
  }

  function renderCornerYardSvg(color, x, y) {
    const pal = COLOR_PALETTE[color];
    const pockets = YARD_POCKETS[color];
    const cardX = x === 0 ? 24 : 384;
    const cardY = y === 0 ? 24 : 384;
    const centerX = cardX + 96;
    const centerY = cardY + 96;

    let svg = `
      <g id="yard-${color}">
        <!-- Yard Base Border & Gradient -->
        <rect x="${x}" y="${y}" width="240" height="240" rx="18" fill="url(#${color}BaseGrad)" stroke="#0f172a" stroke-width="2"/>
        
        <!-- Inner Recessed White Card with Soft Shadow -->
        <rect x="${cardX}" y="${cardY}" width="192" height="192" rx="24" fill="#ffffff" stroke="${pal.border}" stroke-width="2.5" filter="url(#boardShadow)"/>
        
        <!-- Subtle Watermark Badge in Center -->
        <circle cx="${centerX}" cy="${centerY}" r="44" fill="${pal.light}" opacity="0.45"/>
        <text x="${centerX}" y="${centerY + 1}" text-anchor="middle" dominant-baseline="central" font-size="22" fill="${pal.primary}" opacity="0.25" font-weight="900" letter-spacing="2">
          ${pal.name.toUpperCase()}
        </text>
    `;

    // 4 Token Saucer Pedestals
    pockets.forEach(p => {
      svg += `
        <!-- Outer metallic saucer rim -->
        <circle cx="${p.x}" cy="${p.y}" r="24" fill="${pal.light}" stroke="${pal.border}" stroke-width="2.5"/>
        <!-- Inner beveled ring -->
        <circle cx="${p.x}" cy="${p.y}" r="17" fill="#ffffff" stroke="${pal.primary}" stroke-width="1.5" stroke-dasharray="3 3"/>
        <!-- Center guide dot -->
        <circle cx="${p.x}" cy="${p.y}" r="5" fill="${pal.primary}" opacity="0.35"/>
      `;
    });

    svg += `</g>`;
    return svg;
  }

  function renderCenterFinishSvg() {
    return `
      <g id="center-hub">
        <!-- 4 Colored Triangles pointing to center (300, 300) with Bevels -->
        <!-- Red Left -->
        <polygon points="240,240 240,360 300,300" fill="url(#redBaseGrad)" stroke="#ffffff" stroke-width="2.5"/>
        <!-- Green Top -->
        <polygon points="240,240 360,240 300,300" fill="url(#greenBaseGrad)" stroke="#ffffff" stroke-width="2.5"/>
        <!-- Yellow Right -->
        <polygon points="360,240 360,360 300,300" fill="url(#yellowBaseGrad)" stroke="#ffffff" stroke-width="2.5"/>
        <!-- Blue Bottom -->
        <polygon points="240,360 360,360 300,300" fill="url(#blueBaseGrad)" stroke="#ffffff" stroke-width="2.5"/>

        <!-- Center Golden Victory Medallion -->
        <circle cx="300" cy="300" r="22" fill="url(#goldGrad)" stroke="#b45309" stroke-width="2" filter="url(#boardShadow)"/>
        <circle cx="300" cy="300" r="16" fill="#ffffff" stroke="#f59e0b" stroke-width="1.5"/>
        <text x="300" y="302" text-anchor="middle" dominant-baseline="central" font-size="15">👑</text>
      </g>
    `;
  }

  function renderPathwayBlocksSvg() {
    let svg = '<g id="pathway-blocks">';

    // 1. Draw 52 Circuit Tiles
    TRACK_TILES.forEach((tile, idx) => {
      const x = tile.c * 40;
      const y = tile.r * 40;
      let fill = '#ffffff';
      let stroke = '#334155';
      let content = '';

      if (idx === 0) {
        fill = 'url(#redBaseGrad)';
        content = `
          <text x="${x + 20}" y="${y + 16}" text-anchor="middle" dominant-baseline="central" font-size="14" fill="#ffffff" font-weight="900">★</text>
          <text x="${x + 20}" y="${y + 28}" text-anchor="middle" dominant-baseline="central" font-size="11" fill="#ffffff" font-weight="900">▶</text>
        `;
      } else if (idx === 13) {
        fill = 'url(#greenBaseGrad)';
        content = `
          <text x="${x + 20}" y="${y + 16}" text-anchor="middle" dominant-baseline="central" font-size="14" fill="#ffffff" font-weight="900">★</text>
          <text x="${x + 20}" y="${y + 28}" text-anchor="middle" dominant-baseline="central" font-size="11" fill="#ffffff" font-weight="900">▼</text>
        `;
      } else if (idx === 26) {
        fill = 'url(#yellowBaseGrad)';
        content = `
          <text x="${x + 20}" y="${y + 16}" text-anchor="middle" dominant-baseline="central" font-size="14" fill="#ffffff" font-weight="900">★</text>
          <text x="${x + 20}" y="${y + 28}" text-anchor="middle" dominant-baseline="central" font-size="11" fill="#ffffff" font-weight="900">◀</text>
        `;
      } else if (idx === 39) {
        fill = 'url(#blueBaseGrad)';
        content = `
          <text x="${x + 20}" y="${y + 16}" text-anchor="middle" dominant-baseline="central" font-size="14" fill="#ffffff" font-weight="900">★</text>
          <text x="${x + 20}" y="${y + 28}" text-anchor="middle" dominant-baseline="central" font-size="11" fill="#ffffff" font-weight="900">▲</text>
        `;
      } else if (SAFE_TILES.includes(idx)) {
        fill = '#f8fafc';
        stroke = '#f59e0b';
        content = `
          <circle cx="${x + 20}" cy="${y + 20}" r="14" fill="#fef3c7" stroke="#fbbf24" stroke-width="1.2"/>
          <text x="${x + 20}" y="${y + 21}" text-anchor="middle" dominant-baseline="central" font-size="16" fill="#b45309" font-weight="900" filter="url(#starGlow)">★</text>
        `;
      }

      svg += `
        <rect x="${x}" y="${y}" width="40" height="40" fill="${fill}" stroke="${stroke}" stroke-width="1.3" rx="3.5"/>
        ${content}
      `;
    });

    // 2. Draw 4 Home Runways (5 blocks each = 20 blocks total)
    const arrowMap = { red: '▶', green: '▼', yellow: '◀', blue: '▲' };

    ['red', 'green', 'yellow', 'blue'].forEach(col => {
      const runway = RUNWAYS[col];
      const arrow = arrowMap[col];
      runway.forEach((tile, rIdx) => {
        const x = tile.c * 40;
        const y = tile.r * 40;
        svg += `
          <rect x="${x}" y="${y}" width="40" height="40" fill="url(#${col}BaseGrad)" stroke="#ffffff" stroke-width="1.4" rx="3.5"/>
          <text x="${x + 20}" y="${y + 16}" text-anchor="middle" dominant-baseline="central" font-size="13" fill="#ffffff" font-weight="900">${arrow}</text>
          <text x="${x + 20}" y="${y + 28}" text-anchor="middle" dominant-baseline="central" font-size="10" fill="#ffffff" opacity="0.75" font-weight="bold">${rIdx + 1}</text>
        `;
      });
    });

    svg += '</g>';
    return svg;
  }

  function renderTokensLayerSvg(game, session) {
    let svg = '<g id="tokens-layer">';
    const activeColors = getActiveGameColors(game, session);
    const turnColor = game.currentTurnColor || 'red';
    const isHumanTurn = !session.isSpectator && (turnColor === session.myColor);

    // Group tokens by cell coordinates to offset overlapping tokens nicely
    const cellGroups = {};

    activeColors.forEach(col => {
      const tokens = (game.tokens && game.tokens[col]) || [-1, -1, -1, -1];
      tokens.forEach((pos, idx) => {
        const coords = getTokenCenter(col, idx, pos);
        const key = `${Math.round(coords.x)}_${Math.round(coords.y)}`;
        if (!cellGroups[key]) cellGroups[key] = [];
        cellGroups[key].push({ color: col, tokenIdx: idx, pos: pos, coords: coords });
      });
    });

    // Render tokens with slight offsets if multiple tokens occupy the same cell
    Object.values(cellGroups).forEach(group => {
      const count = group.length;
      group.forEach((item, gIdx) => {
        let offsetX = 0;
        let offsetY = 0;
        let radius = 16;

        if (count > 1) {
          radius = 12;
          const offsets = [
            { x: -7, y: -7 },
            { x: 7, y: 7 },
            { x: 7, y: -7 },
            { x: -7, y: 7 }
          ];
          offsetX = offsets[gIdx % 4].x;
          offsetY = offsets[gIdx % 4].y;
        }

        const cx = item.coords.x + offsetX;
        const cy = item.coords.y + offsetY;
        const pal = COLOR_PALETTE[item.color];
        const isMovable = game.diceRolled && (item.color === turnColor) && isHumanTurn && canMoveToken(item.color, item.tokenIdx, game.diceValue, game);

        svg += `
          <g onclick="handleTokenClick('${item.color}', ${item.tokenIdx})"
             class="${isMovable ? 'cursor-pointer' : ''}" style="user-select: none;">
            <!-- Generous transparent hit area for mobile touch screens -->
            <circle cx="${cx}" cy="${cy}" r="${radius + 12}" fill="transparent"/>

            <!-- Movable Pulsing Ring Indicator -->
            ${
              isMovable
                ? `
              <circle cx="${cx}" cy="${cy}" r="${radius + 7}" fill="none" stroke="#fbbf24" stroke-width="3.5" stroke-dasharray="5 3" filter="url(#tokenGlow)">
                <animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="3s" repeatCount="indefinite"/>
              </circle>
              <circle cx="${cx}" cy="${cy}" r="${radius + 5}" fill="none" stroke="#f59e0b" stroke-width="2">
                <animate attributeName="r" values="${radius + 4};${radius + 9};${radius + 4}" dur="1s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.7;1;0.7" dur="1s" repeatCount="indefinite"/>
              </circle>
            `
                : ''
            }

            <!-- 3D Glossy Token Body -->
            <circle cx="${cx}" cy="${cy}" r="${radius}" fill="url(#${item.color}TokenGrad)" stroke="#ffffff" stroke-width="2.8" filter="url(#tokenShadow)"/>
            <circle cx="${cx}" cy="${cy}" r="${radius - 3.5}" fill="${pal.dark}" opacity="0.3"/>
            
            <!-- Specular Highlight Crescent Reflection -->
            <ellipse cx="${cx - radius * 0.28}" cy="${cy - radius * 0.32}" rx="${radius * 0.38}" ry="${radius * 0.22}" fill="#ffffff" opacity="0.7" transform="rotate(-25 ${cx} ${cy})"/>

            <!-- Token Identifier Number -->
            <text x="${cx}" y="${cy + 1}" text-anchor="middle" dominant-baseline="central" font-size="${radius > 13 ? '11' : '9'}" fill="#ffffff" font-weight="900" filter="url(#boardShadow)">
              ${item.tokenIdx + 1}
            </text>
          </g>
        `;
      });
    });

    svg += '</g>';
    return svg;
  }

  function getTokenCenter(color, tokenIdx, pos) {
    if (pos === -1) {
      // In Yard Base pocket
      return YARD_POCKETS[color][tokenIdx];
    }
    if (pos >= 0 && pos <= 50) {
      // On main circuit track (0..50)
      const trackIdx = (START_OFFSETS[color] + pos) % 52;
      const tile = TRACK_TILES[trackIdx];
      return { x: tile.c * 40 + 20, y: tile.r * 40 + 20 };
    }
    if (pos >= 51 && pos <= 55) {
      // On colored Home Runway (51..55)
      const step = pos - 51;
      const tile = RUNWAYS[color][step];
      return { x: tile.c * 40 + 20, y: tile.r * 40 + 20 };
    }
    // Reached Home Finish Goal (56)
    return GOAL_COORDS[color];
  }

  function canMoveToken(color, tokenIdx, rollVal, game) {
    if (!rollVal) return false;
    const tokens = (game.tokens && game.tokens[color]) || [];
    const pos = tokens[tokenIdx];
    if (pos === -1) {
      return rollVal === 6; // Needs a 6 to exit home base
    }
    if (pos >= 0 && pos < 56) {
      return (pos + rollVal) <= 56; // Exact or within reach of home
    }
    return false; // Already finished at 56
  }

  // --- 7. Dice & Turn Gameplay Actions ---
  window.handleDiceRollClick = async function () {
    const session = window.LudoService ? window.LudoService.getSession() : {};
    const game = (session.roomData && session.roomData.game) || {};
    if (game.diceRolled || _isDiceRolling || session.isSpectator) return;

    if (session.mode === 'online' && game.currentTurnColor !== session.myColor) {
      return;
    }
    if (session.mode === 'system' && game.currentTurnColor !== session.myColor) {
      return;
    }

    _isDiceRolling = true;
    Sound.roll();

    const diceBtn = document.getElementById('ludoDiceBtn');
    let rollInterval = null;
    if (diceBtn) {
      rollInterval = setInterval(() => {
        const rFace = Math.floor(Math.random() * 6) + 1;
        diceBtn.innerHTML = getDiceFaceHtml(rFace, true);
      }, 50);
    }

    try {
      await new Promise(r => setTimeout(r, 380));
      if (rollInterval) clearInterval(rollInterval);

      const val = await window.LudoService.rollDice();
      _isDiceRolling = false;

      // Force instant UI re-render with the rolled value
      const container = document.getElementById('mainContainer');
      if (container && _ludoSubView === 'board') {
        renderLudoBoardView(container);
      }

      // Check if player has any valid moves
      checkAndAdvanceTurnIfNoMoves(val);
    } catch (err) {
      console.error('[Ludo] Dice roll error:', err);
    } finally {
      if (rollInterval) clearInterval(rollInterval);
      _isDiceRolling = false;
    }
  };

  window.handleTokenClick = function (color, tokenIdx) {
    const session = window.LudoService ? window.LudoService.getSession() : {};
    const game = (session.roomData && session.roomData.game) || {};
    if (!game.diceRolled || game.currentTurnColor !== color || session.isSpectator) return;

    // Check if player is allowed to move this color
    if (session.mode === 'online' && session.myColor !== color) return;
    if (session.mode === 'system' && session.myColor !== color) return;

    if (!canMoveToken(color, tokenIdx, game.diceValue, game)) {
      return;
    }

    moveToken(color, tokenIdx, game.diceValue);
  };

  function moveToken(color, tokenIdx, rollVal) {
    const session = window.LudoService ? window.LudoService.getSession() : {};
    const game = (session.roomData && session.roomData.game) || {};
    const tokens = game.tokens[color];
    const currentPos = tokens[tokenIdx];

    Sound.hop();

    let newPos = currentPos;
    if (currentPos === -1) {
      if (rollVal === 6) {
        newPos = 0; // Enter track at player's start square
      } else {
        return;
      }
    } else {
      if (currentPos + rollVal <= 56) {
        newPos = currentPos + rollVal;
      } else {
        return;
      }
    }

    tokens[tokenIdx] = newPos;

    // Check for capturing opponent token on main track
    let capturedOpponent = false;
    if (newPos >= 0 && newPos <= 50) {
      capturedOpponent = checkCapture(color, newPos);
    }

    // Check if player won (all 4 tokens reached 56)
    if (tokens.every(p => p >= 56)) {
      game.winner = color;
      Sound.win();
      window.LudoService.updateGameState(game);
      const container = document.getElementById('mainContainer');
      if (container && _ludoSubView === 'board') {
        renderLudoBoardView(container);
      }
      return;
    }

    // Next turn unless player rolled 6 or captured opponent (grants bonus roll!)
    const grantBonusRoll = (rollVal === 6 || capturedOpponent);

    if (grantBonusRoll) {
      game.diceRolled = false;
      game.diceValue = null;
      window.LudoService.updateGameState(game);
      const container = document.getElementById('mainContainer');
      if (container && _ludoSubView === 'board') {
        renderLudoBoardView(container);
      }
    } else {
      advanceTurn();
    }
  }

  function checkCapture(moverColor, moverTrackPos) {
    const session = window.LudoService ? window.LudoService.getSession() : {};
    const game = (session.roomData && session.roomData.game) || {};
    const moverCircuitIdx = (START_OFFSETS[moverColor] + moverTrackPos) % 52;

    // Safe star tiles prevent capture
    if (SAFE_TILES.includes(moverCircuitIdx)) return false;

    let captured = false;
    const colors = window.LudoService.PLAYER_COLORS;

    colors.forEach(col => {
      if (col === moverColor) return;
      const oppTokens = game.tokens[col] || [];
      oppTokens.forEach((pos, idx) => {
        if (pos >= 0 && pos <= 50) {
          const oppCircuitIdx = (START_OFFSETS[col] + pos) % 52;
          if (oppCircuitIdx === moverCircuitIdx) {
            // Captured! Send opponent token back to yard (-1)
            oppTokens[idx] = -1;
            captured = true;
            Sound.capture();
          }
        }
      });
    });

    return captured;
  }

  function checkAndAdvanceTurnIfNoMoves(rollVal) {
    const session = window.LudoService ? window.LudoService.getSession() : {};
    const game = (session.roomData && session.roomData.game) || {};
    const turnColor = game.currentTurnColor;
    const tokens = (game.tokens && game.tokens[turnColor]) || [];

    const hasAnyMove = tokens.some((pos, idx) => canMoveToken(turnColor, idx, rollVal, game));

    if (!hasAnyMove) {
      setTimeout(() => {
        advanceTurn();
      }, 900);
    }
  }

  function advanceTurn() {
    const session = window.LudoService ? window.LudoService.getSession() : {};
    const game = (session.roomData && session.roomData.game) || {};
    const colors = getActiveGameColors(game, session);
    const currIdx = colors.indexOf(game.currentTurnColor);
    const nextColor = colors[(currIdx + 1) % colors.length];

    game.currentTurnColor = nextColor;
    game.diceRolled = false;
    game.diceValue = null;

    window.LudoService.updateGameState(game);

    const container = document.getElementById('mainContainer');
    if (container && _ludoSubView === 'board') {
      renderLudoBoardView(container);
    }
  }

  // --- 8. AI Bot Automation Engine ---
  function triggerBotTurn() {
    if (_botTimer) clearTimeout(_botTimer);
    _botTimer = setTimeout(async () => {
      const session = window.LudoService ? window.LudoService.getSession() : {};
      const game = (session.roomData && session.roomData.game) || {};
      if (game.currentTurnColor === session.myColor || game.winner) return;

      // 1. Bot visual rolling animation
      Sound.roll();
      const diceBtn = document.getElementById('ludoDiceBtn');
      let rollInterval = null;
      if (diceBtn) {
        rollInterval = setInterval(() => {
          const rFace = Math.floor(Math.random() * 6) + 1;
          diceBtn.innerHTML = getDiceFaceHtml(rFace, true);
        }, 50);
      }

      await new Promise(r => setTimeout(r, 400));
      if (rollInterval) clearInterval(rollInterval);

      // 2. Bot rolls dice
      const val = await window.LudoService.rollDice();

      // Immediately render so human sees Bot's rolled dice!
      const container = document.getElementById('mainContainer');
      if (container && _ludoSubView === 'board') {
        renderLudoBoardView(container);
      }

      // 3. Bot selects best token after brief realistic hesitation
      _botTimer = setTimeout(() => {
        const botColor = game.currentTurnColor;
        const tokens = (game.tokens && game.tokens[botColor]) || [];

        // Collect all legal moves
        const validIndices = [];
        tokens.forEach((pos, idx) => {
          if (canMoveToken(botColor, idx, val, game)) {
            validIndices.push(idx);
          }
        });

        if (validIndices.length === 0) {
          advanceTurn();
          return;
        }

        // Strategic Bot evaluation
        let bestIdx = validIndices[0];
        let bestScore = -100;

        validIndices.forEach(idx => {
          const pos = tokens[idx];
          let score = 0;

          // Priority 1: Reach finish goal (+1000)
          if (pos + val === 56) score += 1000;

          // Priority 2: Capture opponent token (+500)
          if (pos >= 0 && pos + val <= 50) {
            const nextCircuit = (START_OFFSETS[botColor] + pos + val) % 52;
            if (!SAFE_TILES.includes(nextCircuit)) {
              window.LudoService.PLAYER_COLORS.forEach(c => {
                if (c !== botColor) {
                  (game.tokens[c] || []).forEach(oppPos => {
                    if (oppPos >= 0 && oppPos <= 50) {
                      const oppCircuit = (START_OFFSETS[c] + oppPos) % 52;
                      if (oppCircuit === nextCircuit) score += 500;
                    }
                  });
                }
              });
            }
          }

          // Priority 3: Emerge from base yard (+300)
          if (pos === -1 && val === 6) score += 300;

          // Priority 4: Land on safe star tile (+150)
          if (pos >= 0 && pos + val <= 50) {
            const nextCircuit = (START_OFFSETS[botColor] + pos + val) % 52;
            if (SAFE_TILES.includes(nextCircuit)) score += 150;
          }

          // Priority 5: Advance token furthest along
          score += pos;

          if (score > bestScore) {
            bestScore = score;
            bestIdx = idx;
          }
        });

        moveToken(botColor, bestIdx, val);
      }, 700);
    }, 800);
  }

  // Diagnostics modal removed per user instruction
  window.openFirebaseDiagnosticsModal = function () {};

  // Connect single global room state change subscriber for both online and system modes
  if (typeof window !== 'undefined' && window.LudoService) {
    window.LudoService.onRoomStateChange(session => {
      const container = document.getElementById('mainContainer');
      if (!container) return;
      if (typeof gamesSubView !== 'undefined' && gamesSubView !== 'ludo') return;

      // Check if current user was kicked/removed from room by the host
      if (session && session.wasKicked) {
        if (_botTimer) {
          clearTimeout(_botTimer);
          _botTimer = null;
        }
        setLudoSubView('hub');
        renderLudoHub(container);
        if (typeof showAlert === 'function') {
          showAlert('You have been removed from the game room by the host.', {
            title: 'Removed from Room',
            tone: 'danger'
          });
        } else if (typeof showToast === 'function') {
          showToast('You have been removed from the game room by the host.', 'error');
        }
        return;
      }

      // Check if online room was closed or deleted by the host
      if (session && session.mode === 'online' && (!session.roomData || (session.roomData.meta && session.roomData.meta.status === 'deleted'))) {
        if (_ludoSubView === 'waiting' || _ludoSubView === 'board') {
          if (_botTimer) {
            clearTimeout(_botTimer);
            _botTimer = null;
          }
          setLudoSubView('hub');
          renderLudoHub(container);
          if (typeof showToast === 'function') {
            showToast('The host has closed and deleted this game room.', 'info');
          }
        }
        return;
      }

      const meta = (session && session.roomData && session.roomData.meta) || {};
      if (_ludoSubView === 'waiting' && meta.status === 'playing') {
        setLudoSubView('board');
      }

      if (_ludoSubView === 'board') {
        renderLudoBoardView(container);
      } else if (_ludoSubView === 'waiting') {
        renderLudoWaitingRoom(container);
      }
    });
  }

  // --- Window Presence & Visibility State Synchronization ---
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (window.LudoService && typeof window.LudoService.setUserOnlineStatus === 'function') {
        const isOnline = (document.visibilityState === 'visible');
        if (typeof gamesSubView !== 'undefined' && gamesSubView === 'ludo') {
          window.LudoService.setUserOnlineStatus(isOnline);
        }
      }
    });
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      if (window.LudoService && typeof window.LudoService.setUserOnlineStatus === 'function') {
        window.LudoService.setUserOnlineStatus(false);
      }
    });

    window.addEventListener('pagehide', () => {
      if (window.LudoService && typeof window.LudoService.setUserOnlineStatus === 'function') {
        window.LudoService.setUserOnlineStatus(false);
      }
    });
  }

})();

