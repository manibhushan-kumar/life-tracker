// ==============================================================================
// Ludo Multiplayer & System Architecture Service
// ==============================================================================
// Modular service managing room lifecycle, state synchronization,
// system (AI Bot) player logic, and Firebase Realtime Database rooms.
// ==============================================================================

(function () {
  'use strict';

  const PLAYER_COLORS = ['red', 'green', 'yellow', 'blue'];
  const COLOR_NAMES = {
    red: 'Red 🔴',
    green: 'Green 🟢',
    yellow: 'Yellow 🟡',
    blue: 'Blue 🔵'
  };

  // State of the active session
  let _activeSession = {
    mode: 'system', // 'system' | 'online'
    roomCode: null,
    isHost: false,
    myColor: 'red',
    myUid: 'player_local',
    myName: 'Player 1',
    playerCount: 2, // 2, 3, or 4
    roomRef: null,
    roomData: null,
    unsubscribeRoom: null
  };

  let _roomStateListeners = [];

  // Generate a friendly 6-character room code (e.g., LD-8492)
  function generateRoomCode() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = 'LD-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // --- Initial Game State Factory ---
  function createInitialGameState(playerCount, playerColors) {
    const tokens = {
      red: [-1, -1, -1, -1],
      green: [-1, -1, -1, -1],
      yellow: [-1, -1, -1, -1],
      blue: [-1, -1, -1, -1]
    };

    return {
      status: 'playing', // 'waiting' | 'playing' | 'finished'
      colors: playerColors,
      currentTurnColor: playerColors[0],
      diceValue: null,
      diceRolled: false,
      consecutiveSixes: 0,
      mustMoveToken: false,
      winner: null,
      tokens: tokens,
      lastMoveAt: Date.now()
    };
  }

  // --- System / Local Bot Mode Session ---
  function startSystemGame(numPlayers = 2, humanColor = 'red') {
    const chosenHumanColor = (humanColor && PLAYER_COLORS.includes(humanColor.toLowerCase()))
      ? humanColor.toLowerCase()
      : 'red';
    const remainingColors = PLAYER_COLORS.filter(c => c !== chosenHumanColor);
    const colors = [chosenHumanColor, ...remainingColors].slice(0, numPlayers);
    const players = {};

    colors.forEach((col, idx) => {
      const isHuman = (col === chosenHumanColor);
      players[col] = {
        id: isHuman ? 'human_player' : `bot_${col}`,
        name: isHuman ? 'You' : `Bot (${COLOR_NAMES[col]})`,
        color: col,
        isBot: !isHuman,
        isHost: isHuman,
        online: true
      };
    });

    _activeSession = {
      mode: 'system',
      roomCode: 'LOCAL-BOT',
      isHost: true,
      myColor: chosenHumanColor,
      myUid: 'human_player',
      myName: 'You',
      playerCount: numPlayers,
      roomRef: null,
      roomData: {
        meta: {
          code: 'LOCAL-BOT',
          mode: 'system',
          createdAt: Date.now(),
          playerCount: numPlayers,
          status: 'playing'
        },
        players: players,
        game: createInitialGameState(numPlayers, colors)
      },
      unsubscribeRoom: null
    };

    saveSessionToStorage();
    _notifyStateChange();
    return _activeSession.roomData;
  }

  // --- Max 5 Sessions Pruning ---
  // Guarantees at most 5 rooms remain in Firebase Realtime Database
  async function pruneOldRooms(db, keepMax = 4) {
    if (!db) return;
    try {
      const snap = await db.ref('ludo_rooms').once('value');
      if (!snap || !snap.exists()) return;

      const rooms = [];
      snap.forEach(child => {
        const val = child.val() || {};
        const meta = val.meta || {};
        const game = val.game || {};
        const isFinished = !!(game.winner || meta.status === 'deleted' || meta.status === 'finished');
        const createdAt = Number(meta.createdAt) || 0;
        rooms.push({
          key: child.key,
          createdAt: createdAt,
          isFinished: isFinished
        });
      });

      if (rooms.length <= keepMax) return;

      // Prune finished/deleted rooms first, then oldest created rooms
      rooms.sort((a, b) => {
        if (a.isFinished !== b.isFinished) {
          return a.isFinished ? -1 : 1;
        }
        return a.createdAt - b.createdAt;
      });

      const excessCount = rooms.length - keepMax;
      const toRemove = rooms.slice(0, excessCount);

      for (const r of toRemove) {
        try {
          await db.ref(`ludo_rooms/${r.key}`).remove();
        } catch (err) {
          console.warn('[LudoService] Prune room removal error:', r.key, err);
        }
      }
    } catch (e) {
      console.warn('[LudoService] pruneOldRooms error:', e);
    }
  }

  function getTabSessionId() {
    try {
      let tid = sessionStorage.getItem('ludo_client_tab_id');
      if (!tid) {
        tid = Math.random().toString(36).substring(2, 9);
        sessionStorage.setItem('ludo_client_tab_id', tid);
      }
      return tid;
    } catch (e) {
      return Math.random().toString(36).substring(2, 9);
    }
  }

  // --- Online Firebase Realtime Database Room Management ---
  async function createOnlineRoom(playerCount = 2, playerName = 'Player', hostPreferredColor = 'red') {
    if (!window.FirebaseService) {
      return { success: false, error: 'Realtime network service is not available.' };
    }

    const authRes = await window.FirebaseService.ensureAuth();
    if (!authRes.success) {
      return { success: false, error: authRes.error || 'Network authentication required.' };
    }

    const db = window.FirebaseService.getDatabase();
    if (!db) {
      return { success: false, error: 'Realtime connection is unavailable. Please check your internet connection.' };
    }

    // Prune stale/excess rooms so at most 5 sessions stay in total
    await pruneOldRooms(db, 4);

    const uid = authRes.uid;
    const roomCode = generateRoomCode();
    const roomRef = db.ref(`ludo_rooms/${roomCode}`);

    // Set host color and construct allowed colors list starting with host color
    const chosenHostColor = (hostPreferredColor && PLAYER_COLORS.includes(hostPreferredColor.toLowerCase()))
      ? hostPreferredColor.toLowerCase()
      : 'red';
    const remainingColors = PLAYER_COLORS.filter(c => c !== chosenHostColor);
    const colors = [chosenHostColor, ...remainingColors].slice(0, playerCount);
    const hostColor = chosenHostColor;

    const players = {};
    players[uid] = {
      id: uid,
      name: playerName || 'Host',
      color: hostColor,
      isHost: true,
      isBot: false,
      joinedAt: Date.now(),
      online: true
    };

    const roomPayload = {
      meta: {
        code: roomCode,
        mode: 'online',
        hostUid: uid,
        createdAt: Date.now(),
        playerCount: playerCount,
        status: 'waiting' // waiting for other players
      },
      players: players,
      spectators: {},
      game: createInitialGameState(playerCount, colors)
    };

    try {
      const writePromise = roomRef.set(roomPayload);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timed out (10s). Please check your internet connection.')), 10000)
      );
      await Promise.race([writePromise, timeoutPromise]);

      // Setup presence: when host disconnects, mark online = false
      try {
        const playerPresenceRef = db.ref(`ludo_rooms/${roomCode}/players/${uid}/online`);
        playerPresenceRef.onDisconnect().set(false);
      } catch (e) {}

      _activeSession = {
        mode: 'online',
        roomCode: roomCode,
        isHost: true,
        isSpectator: false,
        myColor: hostColor,
        myUid: uid,
        myName: playerName || 'Host',
        playerCount: playerCount,
        roomRef: roomRef,
        roomData: roomPayload,
        joinedAt: Date.now(),
        wasKicked: false,
        unsubscribeRoom: null
      };

      saveSessionToStorage();
      _subscribeToRoom(roomRef);
      return { success: true, roomCode: roomCode, session: _activeSession };
    } catch (err) {
      console.error('[LudoService] Failed to create online room:', err);
      let errMsg = err.message || 'Network connection failed.';
      if (errMsg.toLowerCase().includes('permission_denied') || errMsg.toLowerCase().includes('permission denied')) {
        errMsg = 'Unable to create room at this time. Please check your network and try again.';
      }
      return { success: false, error: errMsg };
    }
  }

  async function joinOnlineRoom(roomCode, playerName = 'Player', preferredColor = null, joinAsSpectator = false) {
    if (!roomCode) return { success: false, error: 'Please enter a valid room code.' };
    roomCode = roomCode.trim().toUpperCase().replace(/\s+/g, '');
    if (!roomCode.startsWith('LD-')) {
      if (roomCode.startsWith('LD')) {
        roomCode = 'LD-' + roomCode.substring(2);
      } else if (roomCode.length === 4) {
        roomCode = 'LD-' + roomCode;
      }
    }

    if (!window.FirebaseService) {
      return { success: false, error: 'Realtime network service is not available.' };
    }

    const authRes = await window.FirebaseService.ensureAuth();
    if (!authRes.success) {
      return { success: false, error: authRes.error || 'Network authentication required.' };
    }

    const db = window.FirebaseService.getDatabase();
    if (!db) {
      return { success: false, error: 'Realtime connection is unavailable. Please check your internet connection.' };
    }

    const uid = authRes.uid;
    const roomRef = db.ref(`ludo_rooms/${roomCode}`);

    try {
      const readPromise = roomRef.once('value');
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timed out (10s). Please check your internet connection.')), 10000)
      );
      const snap = await Promise.race([readPromise, timeoutPromise]);
      if (!snap.exists()) {
        return { success: false, error: `Room ${roomCode} does not exist. Check the code and try again.` };
      }

      const data = snap.val();
      const meta = data.meta || {};
      const players = data.players || {};

      // Check if already in room (reconnect)
      if (players[uid] && !joinAsSpectator) {
        if (!players[uid].isSpectator && players[uid].color) {
          // Re-joining existing playing seat
          await db.ref(`ludo_rooms/${roomCode}/players/${uid}/online`).set(true);
          db.ref(`ludo_rooms/${roomCode}/players/${uid}/online`).onDisconnect().set(false);

          _activeSession = {
            mode: 'online',
            roomCode: roomCode,
            isHost: (meta.hostUid === uid),
            isSpectator: false,
            myColor: players[uid].color,
            myUid: uid,
            myName: players[uid].name,
            playerCount: meta.playerCount || 2,
            roomRef: roomRef,
            roomData: data,
            joinedAt: Date.now(),
            wasKicked: false,
            unsubscribeRoom: null
          };

          saveSessionToStorage();
          _subscribeToRoom(roomRef);
          return { success: true, roomCode: roomCode, session: _activeSession };
        }
      }

      // Check active playing players (excluding spectators!)
      const activePlayers = Object.values(players).filter(p => p && !p.isSpectator && p.color);
      const currentCount = activePlayers.length;
      const maxCount = meta.playerCount || 2;
      const isRoomFullOrPlaying = (currentCount >= maxCount) || (meta.status === 'playing');
      const shouldSpectate = joinAsSpectator || isRoomFullOrPlaying;

      if (shouldSpectate) {
        // Register spectator presence in Firebase RTDB
        const specObj = {
          id: uid,
          name: playerName || 'Spectator',
          isSpectator: true,
          color: null,
          joinedAt: Date.now(),
          online: true
        };

        // 1. Write to players node - 100% permitted by Firebase Security Rules for this authenticated user
        await db.ref(`ludo_rooms/${roomCode}/players/${uid}`).set(specObj);
        db.ref(`ludo_rooms/${roomCode}/players/${uid}/online`).onDisconnect().set(false);

        // 2. Also write to spectators node for dual-node persistence
        try {
          await db.ref(`ludo_rooms/${roomCode}/spectators/${uid}`).set(specObj);
          db.ref(`ludo_rooms/${roomCode}/spectators/${uid}/online`).onDisconnect().set(false);
        } catch (e) {}

        if (!data.spectators) data.spectators = {};
        data.spectators[uid] = specObj;
        if (!data.players) data.players = {};
        data.players[uid] = specObj;

        _activeSession = {
          mode: 'online',
          roomCode: roomCode,
          isHost: false,
          isSpectator: true,
          myColor: null, // Spectator has no piece color
          myUid: uid,
          myName: playerName || 'Spectator',
          playerCount: maxCount,
          roomRef: roomRef,
          roomData: data,
          joinedAt: specObj.joinedAt,
          wasKicked: false,
          unsubscribeRoom: null
        };

        saveSessionToStorage();
        _subscribeToRoom(roomRef);
        return { success: true, roomCode: roomCode, session: _activeSession, isSpectator: true };
      }

      // Check chosen color and ensure no two players have the same color
      const assignedColors = activePlayers.map(p => (p.color || '').toLowerCase());
      const allowedColors = PLAYER_COLORS; // All 4 colors allowed in any game!
      let availableColor = null;

      if (preferredColor) {
        const prefLower = preferredColor.trim().toLowerCase();
        if (assignedColors.includes(prefLower)) {
          const colorName = COLOR_NAMES[prefLower] || prefLower;
          return {
            success: false,
            error: `Color "${colorName}" is already chosen by another player in this room. Please select a different available color.`
          };
        }
        if (allowedColors.includes(prefLower)) {
          availableColor = prefLower;
        }
      }

      if (!availableColor) {
        availableColor = allowedColors.find(c => !assignedColors.includes(c)) || allowedColors[0];
      }

      const newPlayer = {
        id: uid,
        name: playerName || `Player ${currentCount + 1}`,
        color: availableColor,
        isHost: false,
        isBot: false,
        isSpectator: false,
        joinedAt: Date.now(),
        online: true
      };

      // Atomic add player
      await db.ref(`ludo_rooms/${roomCode}/players/${uid}`).set(newPlayer);
      db.ref(`ludo_rooms/${roomCode}/players/${uid}/online`).onDisconnect().set(false);

      // Collect active colors of all joined players in order
      const updatedActivePlayers = [...activePlayers, newPlayer];
      const activePlayerColors = updatedActivePlayers.map(p => p.color.toLowerCase());

      const roomUpdates = {
        'game/colors': activePlayerColors
      };

      // Check if all players joined -> transition to playing
      if (currentCount + 1 === maxCount) {
        roomUpdates['meta/status'] = 'playing';
        roomUpdates['game/currentTurnColor'] = activePlayerColors[0];
      }

      try {
        await db.ref(`ludo_rooms/${roomCode}`).update(roomUpdates);
      } catch (errUp) {
        console.warn('[LudoService] Room updates warning:', errUp);
        try {
          await db.ref(`ludo_rooms/${roomCode}/game`).update({
            colors: activePlayerColors,
            ...(currentCount + 1 === maxCount ? { currentTurnColor: activePlayerColors[0] } : {})
          });
        } catch (e) {}
        if (currentCount + 1 === maxCount) {
          try { await db.ref(`ludo_rooms/${roomCode}/meta`).update({ status: 'playing' }); } catch (e) {}
        }
      }

      _activeSession = {
        mode: 'online',
        roomCode: roomCode,
        isHost: false,
        isSpectator: false,
        myColor: availableColor,
        myUid: uid,
        myName: newPlayer.name,
        playerCount: maxCount,
        roomRef: roomRef,
        roomData: data,
        joinedAt: newPlayer.joinedAt,
        wasKicked: false,
        unsubscribeRoom: null
      };

      saveSessionToStorage();
      _subscribeToRoom(roomRef);
      return { success: true, roomCode: roomCode, session: _activeSession };
    } catch (err) {
      console.error('[LudoService] Failed to join room:', err);
      return { success: false, error: err.message || 'Failed to join room.' };
    }
  }

  function _subscribeToRoom(roomRef) {
    if (!roomRef) return;
    if (_activeSession.unsubscribeRoom) {
      try { _activeSession.unsubscribeRoom(); } catch (e) {}
    }

    const listener = snap => {
      if (snap && snap.exists()) {
        const data = snap.val();
        const meta = (data && data.meta) || {};
        if (meta.status === 'deleted') {
          // Room was explicitly deleted by the host
          _activeSession.roomData = null;
          try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
          _notifyStateChange();
          return;
        }

        // Check if current user was kicked/removed by the host AFTER this session joined
        const kickTime = Number(meta.kicked && meta.kicked[_activeSession.myUid]) || 0;
        const sessionJoinTime = Number(_activeSession.joinedAt) || 0;
        const wasKickedThisSession = (kickTime > 0) && (kickTime > sessionJoinTime);

        // Also check if spectator was removed from the database by the host
        let wasRemovedFromDb = false;
        if (_activeSession.isSpectator && _activeSession.myUid && sessionJoinTime > 0) {
          const inPlayers = data.players && data.players[_activeSession.myUid];
          const inSpecs = data.spectators && data.spectators[_activeSession.myUid];
          // If we joined more than 1.5 seconds ago, and neither players nor spectators has our record, host removed us
          if (!inPlayers && !inSpecs && (Date.now() - sessionJoinTime > 1500)) {
            wasRemovedFromDb = true;
          }
        }

        if (wasKickedThisSession || wasRemovedFromDb) {
          _activeSession.roomData = null;
          _activeSession.wasKicked = true;
          try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
          if (_activeSession.unsubscribeRoom) {
            try { _activeSession.unsubscribeRoom(); } catch (e) {}
          }
          _activeSession.mode = 'system';
          _activeSession.roomCode = null;
          _notifyStateChange();
          return;
        }

        _activeSession.roomData = data;

        // If host sees rejoining participant, host removes stale kick record from Firebase RTDB
        if (_activeSession.isHost && meta.kicked && roomRef) {
          Object.keys(meta.kicked).forEach(kickedUid => {
            const rejoiningPlayer = (data.players && data.players[kickedUid]) || (data.spectators && data.spectators[kickedUid]);
            if (rejoiningPlayer && (Number(rejoiningPlayer.joinedAt) > Number(meta.kicked[kickedUid]))) {
              try { roomRef.child(`meta/kicked/${kickedUid}`).remove(); } catch (e) {}
            }
          });
        }

        const myPlayerRec = data.players && data.players[_activeSession.myUid];
        const mySpecRec = data.spectators && data.spectators[_activeSession.myUid];

        if (_activeSession.isSpectator || mySpecRec || (myPlayerRec && myPlayerRec.isSpectator)) {
          _activeSession.isSpectator = true;
          _activeSession.isHost = false;
        } else if (_activeSession.mode === 'online' && meta.hostUid) {
          _activeSession.isHost = !_activeSession.isSpectator && (_activeSession.myUid === meta.hostUid);
        }
        saveSessionToStorage();
        _notifyStateChange();
      } else {
        // Room was deleted or removed from database
        _activeSession.roomData = null;
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
        _notifyStateChange();
      }
    };

    const errListener = err => {
      console.warn('[LudoService] RTDB listener error or canceled:', err);
    };

    roomRef.on('value', listener, errListener);

    _activeSession.unsubscribeRoom = () => {
      try { roomRef.off('value', listener); } catch (e) {}
    };
  }

  // --- Game Actions (Roll Dice, Move Token) ---
  async function rollDice() {
    const s = _activeSession;
    if (!s.roomData || !s.roomData.game || s.isSpectator) return;

    const game = s.roomData.game;
    if (game.diceRolled) return; // already rolled for this turn

    // Validate turn
    if (s.mode === 'online') {
      if (game.currentTurnColor !== s.myColor) {
        console.warn('[LudoService] Not your turn to roll!');
        return;
      }
    }

    const rollVal = Math.floor(Math.random() * 6) + 1;

    if (s.mode === 'system') {
      game.diceValue = rollVal;
      game.diceRolled = true;
      saveSessionToStorage();
      _notifyStateChange();
      return rollVal;
    } else if (s.mode === 'online' && s.roomRef) {
      try {
        await s.roomRef.child('game').update({
          diceValue: rollVal,
          diceRolled: true,
          lastMoveAt: Date.now()
        });
        saveSessionToStorage();
      } catch (e) {
        console.error('[LudoService] Roll dice sync error:', e);
      }
      return rollVal;
    }
  }

  async function updateGameState(updatedGame) {
    const s = _activeSession;
    if (s.isSpectator) return;

    if (s.mode === 'system') {
      s.roomData.game = updatedGame;
      saveSessionToStorage();
      _notifyStateChange();
    } else if (s.mode === 'online' && s.roomRef) {
      try {
        await s.roomRef.child('game').set(updatedGame);
        saveSessionToStorage();
      } catch (e) {
        console.error('[LudoService] Update game sync error:', e);
      }
    }
  }

  // --- Session Persistence (Local Storage) ---
  const STORAGE_KEY = 'ludo_saved_session_v1';

  function saveSessionToStorage() {
    try {
      if (_activeSession && _activeSession.roomData && _activeSession.roomData.game) {
        // Discard session if game is already completed
        if (_activeSession.roomData.game.winner) {
          localStorage.removeItem(STORAGE_KEY);
          return;
        }

        const serialized = {
          mode: _activeSession.mode,
          roomCode: _activeSession.roomCode,
          isHost: _activeSession.isHost,
          isSpectator: !!_activeSession.isSpectator,
          myColor: _activeSession.myColor,
          myUid: _activeSession.myUid,
          myName: _activeSession.myName,
          playerCount: _activeSession.playerCount,
          roomData: _activeSession.roomData,
          joinedAt: _activeSession.joinedAt || Date.now(),
          savedAt: Date.now()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
      }
    } catch (e) {
      console.warn('[LudoService] Failed to save session:', e);
    }
  }

  function loadSessionFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !data.roomData || !data.roomData.game) return null;

      if (data.roomData.game.winner) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      _activeSession = {
        mode: data.mode || 'system',
        roomCode: data.roomCode,
        isHost: !data.isSpectator && !!data.isHost,
        isSpectator: !!data.isSpectator,
        myColor: data.myColor || (data.isSpectator ? null : 'red'),
        myUid: data.myUid || 'player_local',
        myName: data.myName || (data.isSpectator ? 'Spectator' : 'You'),
        playerCount: data.playerCount || 2,
        roomRef: null,
        roomData: data.roomData,
        joinedAt: data.joinedAt || Date.now(),
        wasKicked: false,
        unsubscribeRoom: null
      };

      // In online mode, reconnect Firebase listener if available
      if (_activeSession.mode === 'online' && _activeSession.roomCode && window.FirebaseService) {
        const db = window.FirebaseService.getDatabase();
        if (db) {
          _activeSession.roomRef = db.ref(`ludo_rooms/${_activeSession.roomCode}`);
          _subscribeToRoom(_activeSession.roomRef);
        }
      }

      return _activeSession;
    } catch (e) {
      console.warn('[LudoService] Failed to load session:', e);
      return null;
    }
  }

  function hasActiveSession() {
    if (_activeSession && _activeSession.roomData && _activeSession.roomData.game && !_activeSession.roomData.game.winner) {
      return {
        hasSession: true,
        session: _activeSession,
        game: _activeSession.roomData.game,
        meta: _activeSession.roomData.meta || {}
      };
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.roomData && data.roomData.game && !data.roomData.game.winner) {
          return {
            hasSession: true,
            session: data,
            game: data.roomData.game,
            meta: data.roomData.meta || {}
          };
        }
      }
    } catch (e) {}
    return { hasSession: false };
  }

  function resumeSavedSession() {
    if (!_activeSession || !_activeSession.roomData) {
      loadSessionFromStorage();
    }
    return _activeSession;
  }

  function abandonActiveSession() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    leaveCurrentRoom();
  }

  async function leaveCurrentRoom() {
    const s = _activeSession;
    if (s.mode === 'online' && s.roomRef && s.myUid) {
      try {
        if (s.isSpectator) {
          // Spectator left: completely remove their presence from both nodes
          try { await s.roomRef.child(`players/${s.myUid}`).remove(); } catch (e) {}
          try { await s.roomRef.child(`spectators/${s.myUid}`).remove(); } catch (e) {}
        } else {
          const roomData = s.roomData || {};
          const meta = roomData.meta || {};
          const game = roomData.game || {};

          if (meta.status === 'waiting') {
            // Player left from waiting room: remove them completely so their seat & color are freed
            await s.roomRef.child(`players/${s.myUid}`).remove();
          } else {
            // Player left from active match: mark online = false and left = true
            await s.roomRef.child(`players/${s.myUid}`).update({
              online: false,
              left: true,
              leftAt: Date.now()
            });

            // If it was this player's turn, advance to next player so game continues
            if (game.currentTurnColor === s.myColor) {
              const colors = (game.colors && game.colors.length) ? game.colors : PLAYER_COLORS.slice(0, meta.playerCount || 2);
              const currIdx = colors.indexOf(s.myColor);
              const nextColor = colors[(currIdx + 1) % colors.length];
              await s.roomRef.child('game').update({
                currentTurnColor: nextColor,
                diceRolled: false,
                diceValue: null,
                lastMoveAt: Date.now()
              });
            }
          }
        }
      } catch (e) {
        console.warn('[LudoService] Error leaving room:', e);
      }
    }
    if (s.unsubscribeRoom) {
      s.unsubscribeRoom();
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}

    _activeSession = {
      mode: 'system',
      roomCode: null,
      isHost: false,
      myColor: 'red',
      myUid: 'player_local',
      myName: 'Player 1',
      playerCount: 2,
      roomRef: null,
      roomData: null,
      unsubscribeRoom: null
    };
    _notifyStateChange();
  }

  // --- Host Room Deletion ---
  // Only the host who hosted the game can delete it.
  async function deleteOnlineRoom() {
    const s = _activeSession;
    if (s.mode !== 'online' || !s.roomRef || !s.isHost) {
      return { success: false, error: 'Only the host who hosted this game can delete the room.' };
    }

    const roomCode = s.roomCode;
    const roomRef = s.roomRef;

    try {
      // 1. Mark status as deleted so connected guests and spectators are notified immediately
      try {
        await roomRef.child('meta').update({
          status: 'deleted',
          deletedAt: Date.now()
        });
      } catch (e) {}

      // 2. Remove the room record from Firebase Realtime Database
      try {
        await roomRef.remove();
      } catch (e) {}
    } catch (err) {
      console.warn('[LudoService] Failed to delete room:', err);
    }

    if (s.unsubscribeRoom) {
      try { s.unsubscribeRoom(); } catch (e) {}
    }

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}

    _activeSession = {
      mode: 'system',
      roomCode: null,
      isHost: false,
      isSpectator: false,
      myColor: 'red',
      myUid: 'player_local',
      myName: 'Player 1',
      playerCount: 2,
      roomRef: null,
      roomData: null,
      unsubscribeRoom: null
    };

    _notifyStateChange();
    return { success: true, roomCode: roomCode };
  }

  // --- Presence: Set Online/Offline Status ---
  async function setUserOnlineStatus(isOnline) {
    const s = _activeSession;
    if (s.mode !== 'online' || !s.roomRef || !s.myUid) return;
    try {
      await s.roomRef.child(`players/${s.myUid}`).update({ online: isOnline });
      if (s.isSpectator) {
        try { await s.roomRef.child(`spectators/${s.myUid}`).update({ online: isOnline }); } catch (e) {}
      }
    } catch (e) {
      console.warn('[LudoService] Failed to set online status:', e);
    }
  }

  // --- Host Participant Removal (Kick Player or Spectator) ---
  async function removeParticipant(targetUid, isSpectator = false) {
    const s = _activeSession;
    if (!s || s.mode !== 'online' || !s.roomRef || s.isSpectator || !s.isHost) {
      return { success: false, error: 'Only the host who created the room can remove participants.' };
    }
    const meta = (s.roomData && s.roomData.meta) || {};
    if (meta.hostUid && s.myUid && meta.hostUid !== s.myUid) {
      return { success: false, error: 'Only the host who created the room can remove participants.' };
    }

    try {
      if (isSpectator) {
        try { await s.roomRef.child(`players/${targetUid}`).remove(); } catch (e) {}
        try { await s.roomRef.child(`spectators/${targetUid}`).remove(); } catch (e) {}
      } else {
        const roomData = s.roomData || {};
        const meta = roomData.meta || {};
        const game = roomData.game || {};

        if (meta.status === 'waiting') {
          await s.roomRef.child(`players/${targetUid}`).remove();
        } else {
          const playerObj = roomData.players ? roomData.players[targetUid] : null;
          const removedColor = playerObj ? playerObj.color : null;
          await s.roomRef.child(`players/${targetUid}`).update({
            online: false,
            removed: true,
            removedAt: Date.now()
          });

          // Advance turn if it was removed player's turn
          if (removedColor && game.currentTurnColor === removedColor) {
            const colors = (game.colors && game.colors.length) ? game.colors : PLAYER_COLORS.slice(0, meta.playerCount || 2);
            const currIdx = colors.indexOf(removedColor);
            const nextColor = colors[(currIdx + 1) % colors.length];
            await s.roomRef.child('game').update({
              currentTurnColor: nextColor,
              diceRolled: false,
              diceValue: null,
              lastMoveAt: Date.now()
            });
          }
        }
      }

      // Mark kicked in meta so target device gets notified immediately
      await s.roomRef.child(`meta/kicked/${targetUid}`).set(Date.now());
      return { success: true };
    } catch (e) {
      console.error('[LudoService] removeParticipant error:', e);
      return { success: false, error: e.message };
    }
  }

  // --- Check Available Colors For Room ---
  async function getRoomAvailableColors(roomCode) {
    if (!roomCode) return { success: false, error: 'Please provide a room code.' };
    roomCode = roomCode.trim().toUpperCase().replace(/\s+/g, '');
    if (!roomCode.startsWith('LD-')) {
      if (roomCode.startsWith('LD')) {
        roomCode = 'LD-' + roomCode.substring(2);
      } else if (roomCode.length === 4) {
        roomCode = 'LD-' + roomCode;
      }
    }

    if (!window.FirebaseService) {
      return { success: false, error: 'Realtime network service is not available.' };
    }

    try {
      const authRes = await window.FirebaseService.ensureAuth();
      if (!authRes.success) {
        return { success: false, error: authRes.error || 'Authentication required.' };
      }
    } catch (e) {
      console.warn('[LudoService] ensureAuth in getRoomAvailableColors error:', e);
    }

    const db = window.FirebaseService.getDatabase();
    if (!db) {
      return { success: false, error: 'Realtime connection is unavailable. Please check your internet connection.' };
    }

    try {
      const snap = await db.ref(`ludo_rooms/${roomCode}`).once('value');
      if (!snap.exists()) {
        return { success: false, error: `Room ${roomCode} does not exist.` };
      }

      const data = snap.val();
      const meta = data.meta || {};
      const players = data.players || {};
      const maxCount = meta.playerCount || 2;
      const allowedColors = PLAYER_COLORS; // All 4 colors allowed in any room!

      const takenMap = {};
      Object.values(players).forEach(p => {
        if (p && !p.isSpectator && p.color) {
          takenMap[p.color.toLowerCase()] = p.name || 'Player';
        }
      });

      const takenColors = Object.keys(takenMap);
      const availableColors = allowedColors.filter(c => !takenColors.includes(c));
      const currentCount = Object.values(players).filter(p => p && !p.isSpectator && p.color).length;
      const isFull = currentCount >= maxCount || meta.status === 'playing';

      return {
        success: true,
        roomCode,
        status: meta.status,
        playerCount: maxCount,
        currentCount,
        isFull,
        allowedColors,
        takenColors,
        takenMap,
        availableColors
      };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to inspect room.' };
    }
  }

  function onRoomStateChange(cb) {
    if (typeof cb !== 'function') return () => {};
    _roomStateListeners.push(cb);
    return () => {
      _roomStateListeners = _roomStateListeners.filter(c => c !== cb);
    };
  }

  function _notifyStateChange() {
    _roomStateListeners.forEach(cb => {
      try { cb(_activeSession); } catch (e) { console.warn(e); }
    });
  }

  // Restore saved session on script initialization
  try {
    loadSessionFromStorage();
  } catch (e) {}

  // --- Global Public Export ---
  window.LudoService = {
    startSystemGame,
    createOnlineRoom,
    joinOnlineRoom,
    leaveCurrentRoom,
    deleteOnlineRoom,
    pruneOldRooms,
    setUserOnlineStatus,
    removeParticipant,
    getRoomAvailableColors,
    rollDice,
    updateGameState,
    getSession: () => _activeSession || resumeSavedSession(),
    onRoomStateChange,
    hasActiveSession,
    resumeSavedSession,
    abandonActiveSession,
    saveSessionToStorage,
    loadSessionFromStorage,
    PLAYER_COLORS,
    COLOR_NAMES
  };

})();
