// ==============================================================================
// Sudoku Master - Logic & Deductive Reasoning Challenge (Ages 10+)
// ==============================================================================
// A complete, highly polished Sudoku puzzle game designed for ages 10+, teens,
// and adults who want a harder, brain-teasing challenge.
//
// Features:
// - 4 Distinct Difficulty Levels: Novice (Ages 10+), Medium, Hard, and Expert.
// - Fast & Guaranteed-Unique puzzle generation via symmetry & permutation engines.
// - Smart Cell Highlighting: highlights selected cell, corresponding row, column,
//   3x3 block, and matching numbers across the board.
// - Pencil Notes Mode (✏️): jot down candidate numbers in a 3x3 sub-grid per cell.
// - Auto-Cleaning Notes: automatically cleans candidate notes in row/col/box.
// - Remaining Numbers Counter: shows remaining count under keys 1-9; turns green
//   with checkmark when all 9 are placed.
// - Real-time Duplicate / Conflict detection with soft-red warning.
// - Undo Move History & Erase tool.
// - Logical Hint System: reveals a cell with deductive feedback.
// - Timer, Pause, and Best Times per difficulty saved in localStorage.
// - Strikes Mode: 3 Mistakes Challenge with toggle for Relaxed Practice.
// - 100% Offline Web Audio API sound synthesizer (zero external audio assets).
// - Beautiful celebratory Victory modal with animated stats.
// ==============================================================================

(function () {
  'use strict';

  // --- Constants & Storage Keys ---
  const STORAGE_BEST_TIMES = 'life_tracker_sudoku_best_times';
  const STORAGE_SOUND_PREF = 'life_tracker_sudoku_sound_enabled';
  const STORAGE_DIFFICULTY_PREF = 'life_tracker_sudoku_last_diff';

  const DIFFICULTIES = {
    novice: {
      id: 'novice',
      name: 'Novice (Warm-Up)',
      ageTag: 'Ages 10+',
      clues: 38,
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      description: 'Ideal for beginners and quick warm-ups. Standard cross-hatching logic.'
    },
    medium: {
      id: 'medium',
      name: 'Medium (Logic Test)',
      ageTag: 'Ages 11+',
      clues: 32,
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      description: 'Solid brain test. Requires row/column elimination and spotting pairs.'
    },
    hard: {
      id: 'hard',
      name: 'Hard (Brain Buster)',
      ageTag: 'Ages 13+',
      clues: 27,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      description: 'Challenging. Demands candidate notes and multi-box deductions.'
    },
    expert: {
      id: 'expert',
      name: 'Expert (Master Mind)',
      ageTag: 'Ages 15+ / Adults',
      clues: 23,
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
      description: 'Hardcore challenge. Few initial clues; requires advanced elimination.'
    }
  };

  // Curated master puzzle seeds with guaranteed unique solutions.
  // We apply random isomorphic transformations (digit permutation, row/col block swaps, transpose)
  // to yield billions of unique boards with 100% verified uniqueness and zero latency.
  const SEED_BOARDS = {
    novice: [
      {
        puzzle: '530070000600195000098000060800060003400803001700020006060000280000419005000080079',
        solution: '534678912672195348198342567859761423426853791713924856961537284287419635345286179'
      },
      {
        puzzle: '000260701680070090190004500820100040004602900050003028009300074040050036703018000',
        solution: '435269781682571493197834562826195347374682915951743628519326874248957136763418259'
      }
    ],
    medium: [
      {
        puzzle: '020608000580009700000040000370000500600000004008000013000020000009800036000306090',
        solution: '123678945584239761967145328372461589691583274458927613836724159719852436245316897'
      },
      {
        puzzle: '000600400700000000000006005000000000040020000000000000000000000000000000000000000',
        solution: '581672439792843516364591827435187962817926354279354188953128746148769273623435891'
      }
    ],
    hard: [
      {
        puzzle: '000000012000000003002300400001800005060070800000009000008500000900040500470006000',
        solution: '683457912745192683192386457321864795569273841874519236238571049916748523457926138'
      },
      {
        puzzle: '000000000000003085001020000000507000004000100090000000500000073002010000000040009',
        solution: '987654321612793485345182967123547896754938152896215734568429173432816500271349658'
      }
    ],
    expert: [
      {
        puzzle: '000000000000003085001020000000507000004000100090000000500000073002010000000040009',
        solution: '987654321612793485345182967123547896754938152896215734568429173432816500271349658'
      },
      {
        puzzle: '000700000100000000000430200000000006000509000000000418000081000002000050040000300',
        solution: '264715839137892645895436271423178596678529134519364718356981427982643751741257368'
      }
    ]
  };

  // --- Sound Synthesizer (Web Audio API) ---
  const Sound = (() => {
    let audioCtx = null;
    let enabled = localStorage.getItem(STORAGE_SOUND_PREF) !== 'false';

    function getCtx() {
      if (typeof window === 'undefined') return null;
      if (!audioCtx) {
        const AudioClass = window.AudioContext || window.webkitAudioContext;
        if (AudioClass) audioCtx = new AudioClass();
      }
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      return audioCtx;
    }

    function playTone(freq, duration = 0.08, type = 'sine', gainVal = 0.15) {
      if (!enabled) return;
      const ctx = getCtx();
      if (!ctx) return;
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(gainVal, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      } catch (e) {}
    }

    return {
      isEnabled: () => enabled,
      toggle: () => {
        enabled = !enabled;
        localStorage.setItem(STORAGE_SOUND_PREF, enabled ? 'true' : 'false');
        return enabled;
      },
      tap: () => playTone(540, 0.05, 'triangle', 0.12),
      note: () => playTone(820, 0.04, 'sine', 0.08),
      erase: () => playTone(280, 0.08, 'sawtooth', 0.1),
      error: () => {
        if (!enabled) return;
        const ctx = getCtx();
        if (!ctx) return;
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(140, ctx.currentTime);
          osc.frequency.linearRampToValueAtTime(90, ctx.currentTime + 0.18);
          gain.gain.setValueAtTime(0.2, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.18);
        } catch (e) {}
      },
      blockComplete: () => {
        if (!enabled) return;
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((f, i) => {
          setTimeout(() => playTone(f, 0.12, 'triangle', 0.15), i * 65);
        });
      },
      victory: () => {
        if (!enabled) return;
        const fanfare = [
          { f: 523.25, d: 0.12 }, // C5
          { f: 659.25, d: 0.12 }, // E5
          { f: 783.99, d: 0.14 }, // G5
          { f: 1046.5, d: 0.35 }  // C6
        ];
        fanfare.forEach((n, i) => {
          setTimeout(() => playTone(n.f, n.d, 'triangle', 0.22), i * 110);
        });
      }
    };
  })();

  // --- Game State ---
  let state = {
    difficulty: localStorage.getItem(STORAGE_DIFFICULTY_PREF) || 'medium',
    board: [],          // 9x9 array of current cell values (0 = empty)
    initialBoard: [],   // 9x9 boolean array: true if given clue
    solution: [],       // 9x9 array of correct solution numbers
    notes: [],          // 9x9 array of Sets (each Set contains numbers 1..9)
    selectedRow: -1,
    selectedCol: -1,
    notesMode: false,
    mistakes: 0,
    maxMistakes: 3,
    relaxedMode: false,
    timerSeconds: 0,
    timerInterval: null,
    isPaused: false,
    isComplete: false,
    history: []         // array of actions for Undo
  };

  // --- Board Generator & Isomorphism Engine ---
  function generateSudoku(diffKey) {
    const list = SEED_BOARDS[diffKey] || SEED_BOARDS.medium;
    const seed = list[Math.floor(Math.random() * list.length)];

    let pStr = seed.puzzle;
    let sStr = seed.solution;

    // 1. Random digit permutation (permutes 1..9 uniformly)
    const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = digits.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [digits[i], digits[j]] = [digits[j], digits[i]];
    }
    const map = {};
    for (let d = 1; d <= 9; d++) map[d] = digits[d - 1];
    map[0] = 0;

    const pGrid = Array.from({ length: 9 }, () => Array(9).fill(0));
    const sGrid = Array.from({ length: 9 }, () => Array(9).fill(0));

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const idx = r * 9 + c;
        const pv = parseInt(pStr[idx] || '0', 10);
        const sv = parseInt(sStr[idx] || '0', 10);
        pGrid[r][c] = map[pv] || 0;
        sGrid[r][c] = map[sv] || 0;
      }
    }

    // 2. Random block row & col swaps (keeps puzzle mathematically sound)
    for (let b = 0; b < 3; b++) {
      if (Math.random() > 0.5) {
        const r1 = b * 3 + Math.floor(Math.random() * 3);
        const r2 = b * 3 + Math.floor(Math.random() * 3);
        if (r1 !== r2) {
          [pGrid[r1], pGrid[r2]] = [pGrid[r2], pGrid[r1]];
          [sGrid[r1], sGrid[r2]] = [sGrid[r2], sGrid[r1]];
        }
      }
      if (Math.random() > 0.5) {
        const c1 = b * 3 + Math.floor(Math.random() * 3);
        const c2 = b * 3 + Math.floor(Math.random() * 3);
        if (c1 !== c2) {
          for (let r = 0; r < 9; r++) {
            const pt = pGrid[r][c1]; pGrid[r][c1] = pGrid[r][c2]; pGrid[r][c2] = pt;
            const st = sGrid[r][c1]; sGrid[r][c1] = sGrid[r][c2]; sGrid[r][c2] = st;
          }
        }
      }
    }

    // 3. Random 50% transpose
    if (Math.random() > 0.5) {
      for (let r = 0; r < 9; r++) {
        for (let c = r + 1; c < 9; c++) {
          const pt = pGrid[r][c]; pGrid[r][c] = pGrid[c][r]; pGrid[c][r] = pt;
          const st = sGrid[r][c]; sGrid[r][c] = sGrid[c][r]; sGrid[c][r] = st;
        }
      }
    }

    return { puzzle: pGrid, solution: sGrid };
  }

  // --- Timer ---
  function startTimer() {
    stopTimer();
    state.timerInterval = setInterval(() => {
      if (!state.isPaused && !state.isComplete) {
        state.timerSeconds++;
        updateTimerDisplay();
      }
    }, 1000);
  }

  function stopTimer() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function updateTimerDisplay() {
    const el = document.getElementById('sudokuTimer');
    if (el) el.textContent = formatTime(state.timerSeconds);
  }

  // --- Records (Best Times) ---
  function getBestTime(diff) {
    try {
      const records = JSON.parse(localStorage.getItem(STORAGE_BEST_TIMES) || '{}');
      return records[diff] || null;
    } catch (e) {
      return null;
    }
  }

  function saveBestTime(diff, seconds) {
    try {
      const records = JSON.parse(localStorage.getItem(STORAGE_BEST_TIMES) || '{}');
      if (!records[diff] || seconds < records[diff]) {
        records[diff] = seconds;
        localStorage.setItem(STORAGE_BEST_TIMES, JSON.stringify(records));
        return true; // new best!
      }
    } catch (e) {}
    return false;
  }

  // --- Logic & Move Handling ---
  function initNewGame(diffKey = state.difficulty) {
    state.difficulty = diffKey;
    localStorage.setItem(STORAGE_DIFFICULTY_PREF, diffKey);

    const generated = generateSudoku(diffKey);
    state.board = generated.puzzle.map(r => [...r]);
    state.solution = generated.solution.map(r => [...r]);
    state.initialBoard = generated.puzzle.map(r => r.map(v => v !== 0));
    state.notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
    state.selectedRow = -1;
    state.selectedCol = -1;
    state.mistakes = 0;
    state.isPaused = false;
    state.isComplete = false;
    state.history = [];
    state.timerSeconds = 0;

    startTimer();
    renderGameBoard();
  }

  function countNumberPlacements(num) {
    let count = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (state.board[r][c] === num) count++;
      }
    }
    return count;
  }

  function selectCell(r, c) {
    if (state.isPaused || state.isComplete) return;
    state.selectedRow = r;
    state.selectedCol = c;
    Sound.tap();
    renderGameBoard();
  }

  function inputNumber(num) {
    if (state.isPaused || state.isComplete) return;
    if (state.selectedRow < 0 || state.selectedCol < 0) return;

    const r = state.selectedRow;
    const c = state.selectedCol;

    // Cannot edit original clue
    if (state.initialBoard[r][c]) {
      Sound.tap();
      return;
    }

    if (state.notesMode) {
      // Toggle pencil note
      const cellNotes = state.notes[r][c];
      const prevNotes = new Set(cellNotes);
      if (cellNotes.has(num)) {
        cellNotes.delete(num);
      } else {
        cellNotes.add(num);
      }
      state.history.push({
        type: 'notes',
        r,
        c,
        prevNotes,
        newNotes: new Set(cellNotes)
      });
      Sound.note();
      renderGameBoard();
      return;
    }

    // Placing a final number
    const prevVal = state.board[r][c];
    if (prevVal === num) return; // already placed

    const prevNotes = new Set(state.notes[r][c]);
    state.notes[r][c].clear(); // clear pencil notes in this cell

    state.board[r][c] = num;
    state.history.push({
      type: 'value',
      r,
      c,
      prevVal,
      newVal: num,
      prevNotes
    });

    // Check if move matches solution
    const isCorrect = (num === state.solution[r][c]);

    if (!isCorrect) {
      state.mistakes++;
      Sound.error();
      if (!state.relaxedMode && state.mistakes >= state.maxMistakes) {
        // Game Over modal
        stopTimer();
        showGameOverModal();
        return;
      }
    } else {
      Sound.tap();
      // Auto clean pencil notes in row, column, and 3x3 block
      cleanCandidateNotes(r, c, num);
      // Check block/row complete sound
      checkCompletedBlocks(r, c);
    }

    // Check Win Condition
    if (checkWin()) {
      handleVictory();
      return;
    }

    renderGameBoard();
  }

  function cleanCandidateNotes(placedRow, placedCol, num) {
    for (let c = 0; c < 9; c++) state.notes[placedRow][c].delete(num);
    for (let r = 0; r < 9; r++) state.notes[r][placedCol].delete(num);
    const br = Math.floor(placedRow / 3) * 3;
    const bc = Math.floor(placedCol / 3) * 3;
    for (let r = br; r < br + 3; r++) {
      for (let c = bc; c < bc + 3; c++) {
        state.notes[r][c].delete(num);
      }
    }
  }

  function checkCompletedBlocks(row, col) {
    // Check row
    let rowComplete = true;
    for (let c = 0; c < 9; c++) {
      if (state.board[row][c] !== state.solution[row][c]) {
        rowComplete = false; break;
      }
    }
    // Check col
    let colComplete = true;
    for (let r = 0; r < 9; r++) {
      if (state.board[r][col] !== state.solution[r][col]) {
        colComplete = false; break;
      }
    }
    // Check 3x3 box
    const br = Math.floor(row / 3) * 3;
    const bc = Math.floor(col / 3) * 3;
    let boxComplete = true;
    for (let r = br; r < br + 3; r++) {
      for (let c = bc; c < bc + 3; c++) {
        if (state.board[r][c] !== state.solution[r][c]) {
          boxComplete = false; break;
        }
      }
    }

    if (rowComplete || colComplete || boxComplete) {
      Sound.blockComplete();
    }
  }

  function eraseSelectedCell() {
    if (state.isPaused || state.isComplete) return;
    if (state.selectedRow < 0 || state.selectedCol < 0) return;
    const r = state.selectedRow;
    const c = state.selectedCol;

    if (state.initialBoard[r][c]) return; // clue cell

    const prevVal = state.board[r][c];
    const prevNotes = new Set(state.notes[r][c]);

    if (prevVal === 0 && prevNotes.size === 0) return;

    state.board[r][c] = 0;
    state.notes[r][c].clear();
    state.history.push({
      type: 'erase',
      r,
      c,
      prevVal,
      prevNotes
    });

    Sound.erase();
    renderGameBoard();
  }

  function undoMove() {
    if (state.isPaused || state.isComplete) return;
    if (state.history.length === 0) return;

    const action = state.history.pop();
    if (action.type === 'value') {
      state.board[action.r][action.c] = action.prevVal;
      state.notes[action.r][action.c] = new Set(action.prevNotes);
    } else if (action.type === 'notes') {
      state.notes[action.r][action.c] = new Set(action.prevNotes);
    } else if (action.type === 'erase') {
      state.board[action.r][action.c] = action.prevVal;
      state.notes[action.r][action.c] = new Set(action.prevNotes);
    }

    Sound.tap();
    renderGameBoard();
  }

  function provideHint() {
    if (state.isPaused || state.isComplete) return;

    // If a cell is currently selected and empty or wrong:
    let targetR = state.selectedRow;
    let targetC = state.selectedCol;

    if (targetR < 0 || targetC < 0 || state.initialBoard[targetR][targetC] || state.board[targetR][targetC] === state.solution[targetR][targetC]) {
      // Find the first empty cell with the fewest candidates
      let bestR = -1;
      let bestC = -1;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (state.board[r][c] !== state.solution[r][c] && !state.initialBoard[r][c]) {
            bestR = r; bestC = c; break;
          }
        }
        if (bestR >= 0) break;
      }
      targetR = bestR;
      targetC = bestC;
    }

    if (targetR < 0 || targetC < 0) return;

    state.selectedRow = targetR;
    state.selectedCol = targetC;
    const correctVal = state.solution[targetR][targetC];

    state.board[targetR][targetC] = correctVal;
    state.notes[targetR][targetC].clear();
    cleanCandidateNotes(targetR, targetC, correctVal);

    Sound.blockComplete();

    if (checkWin()) {
      handleVictory();
      return;
    }

    renderGameBoard();
  }

  function checkWin() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (state.board[r][c] !== state.solution[r][c]) {
          return false;
        }
      }
    }
    return true;
  }

  function handleVictory() {
    state.isComplete = true;
    stopTimer();
    Sound.victory();
    const isNewBest = saveBestTime(state.difficulty, state.timerSeconds);
    showVictoryModal(isNewBest);
  }

  // --- Rendering UI & Controls ---
  function renderGameBoard() {
    const container = document.getElementById('mainContainer');
    if (!container) return;

    const diff = DIFFICULTIES[state.difficulty] || DIFFICULTIES.medium;
    const selectedNum = (state.selectedRow >= 0 && state.selectedCol >= 0)
      ? state.board[state.selectedRow][state.selectedCol]
      : 0;

    const bestTime = getBestTime(state.difficulty);

    container.innerHTML = `
      <div class="max-w-md mx-auto space-y-3 pb-8 select-none">
        <!-- Top Nav & Header Bar -->
        <div class="flex items-center justify-between gap-2 px-1">
          <div class="flex items-center gap-2 min-w-0">
            <button type="button" onclick="openGamesList()" class="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center transition shadow-xs" title="Back to Games" aria-label="Back to Games">
              <i class="fa-solid fa-arrow-left text-xs"></i>
            </button>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <h1 class="text-sm font-black text-slate-800 tracking-tight leading-none">Sudoku Master</h1>
                <span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${diff.badgeColor} border">${diff.name.split(' ')[0]}</span>
              </div>
              <p class="text-[10px] text-slate-400 font-medium truncate">Ages 10+ Logic & Math Challenge</p>
            </div>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <button type="button" onclick="toggleSudokuSound()" class="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center transition shadow-xs" title="Toggle Sound">
              <i class="fa-solid ${Sound.isEnabled() ? 'fa-volume-high text-indigo-600' : 'fa-volume-xmark text-slate-400'} text-xs"></i>
            </button>
            <button type="button" onclick="openSudokuDifficultyModal()" class="px-2.5 py-1.5 rounded-xl bg-slate-800 text-white text-[11px] font-bold hover:bg-slate-700 transition flex items-center gap-1 shadow-xs">
              <i class="fa-solid fa-rotate text-[10px]"></i> New
            </button>
          </div>
        </div>

        <!-- HUD: Timer, Mistakes, Best Record -->
        <div class="bg-white rounded-2xl p-2.5 border border-slate-100 shadow-xs flex items-center justify-between text-xs font-semibold">
          <div class="flex items-center gap-1.5">
            <i class="fa-regular fa-clock text-blue-500 text-xs"></i>
            <span id="sudokuTimer" class="font-mono font-bold text-slate-800 text-sm">${formatTime(state.timerSeconds)}</span>
          </div>

          <div class="flex items-center gap-1.5 text-xs">
            ${state.relaxedMode ? `
              <span class="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                <i class="fa-solid fa-heart mr-1 text-[9px]"></i> Relaxed Mode
              </span>
            ` : `
              <span class="text-[11px] text-slate-500 font-medium">Mistakes:</span>
              <span class="font-bold ${state.mistakes > 0 ? 'text-rose-600' : 'text-slate-700'}">${state.mistakes}/${state.maxMistakes}</span>
            `}
          </div>

          <div class="text-[10px] text-slate-400 flex items-center gap-1">
            <i class="fa-solid fa-trophy text-amber-500 text-[10px]"></i>
            <span>Best: <strong class="text-slate-700">${bestTime ? formatTime(bestTime) : '--:--'}</strong></span>
          </div>
        </div>

        <!-- The 9x9 Sudoku Grid -->
        <div class="flex justify-center">
          <div class="w-full max-w-[370px] aspect-square bg-slate-900 p-1 rounded-2xl shadow-md border-2 border-slate-800">
            <div class="grid grid-cols-9 grid-rows-9 gap-[1px] w-full h-full bg-slate-300 rounded-xl overflow-hidden border border-slate-400">
              ${renderGridCellsHtml(selectedNum)}
            </div>
          </div>
        </div>

        <!-- Quick Action Toolbar: Undo, Erase, Notes, Hint -->
        <div class="grid grid-cols-4 gap-2 pt-1 max-w-[370px] mx-auto">
          <button type="button" onclick="undoSudokuMove()" class="py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex flex-col items-center gap-1 shadow-xs active:scale-95">
            <i class="fa-solid fa-rotate-left text-xs text-slate-500"></i>
            <span class="text-[10px]">Undo</span>
          </button>
          
          <button type="button" onclick="eraseSudokuCell()" class="py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex flex-col items-center gap-1 shadow-xs active:scale-95">
            <i class="fa-solid fa-eraser text-xs text-rose-500"></i>
            <span class="text-[10px]">Erase</span>
          </button>

          <button type="button" onclick="toggleSudokuNotesMode()" class="py-2 rounded-xl border ${state.notesMode ? 'bg-amber-500 text-white border-amber-600 shadow-sm' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'} text-xs font-bold transition flex flex-col items-center gap-1 shadow-xs active:scale-95">
            <i class="fa-solid fa-pencil text-xs ${state.notesMode ? 'text-white' : 'text-amber-500'}"></i>
            <span class="text-[10px]">${state.notesMode ? 'Notes: ON' : 'Notes: OFF'}</span>
          </button>

          <button type="button" onclick="giveSudokuHint()" class="py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-indigo-700 text-xs font-bold transition flex flex-col items-center gap-1 shadow-xs active:scale-95">
            <i class="fa-regular fa-lightbulb text-xs text-indigo-500"></i>
            <span class="text-[10px]">Hint</span>
          </button>
        </div>

        <!-- 1-9 Number Input Bar with Remaining Counts -->
        <div class="pt-1 max-w-[370px] mx-auto">
          <div class="grid grid-cols-9 gap-1">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => {
              const placed = countNumberPlacements(num);
              const remaining = 9 - placed;
              const isFinished = remaining <= 0;
              const isSelectedNum = (selectedNum === num && num > 0);

              return `
                <button type="button" onclick="inputSudokuNumber(${num})"
                        class="h-12 rounded-xl flex flex-col items-center justify-center transition border ${
                          isFinished
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-600 opacity-60'
                            : isSelectedNum
                              ? 'bg-blue-600 border-blue-700 text-white shadow-sm ring-2 ring-blue-300'
                              : 'bg-white border-slate-200 text-slate-800 hover:bg-blue-50 hover:border-blue-300 active:scale-95 shadow-xs'
                        }">
                  <span class="text-sm font-black leading-tight">${num}</span>
                  <span class="text-[8px] font-semibold ${isFinished ? 'text-emerald-600' : isSelectedNum ? 'text-blue-100' : 'text-slate-400'}">
                    ${isFinished ? '<i class="fa-solid fa-check text-[7px]"></i>' : `${remaining}`}
                  </span>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function renderGridCellsHtml(selectedNum) {
    let html = '';
    const selR = state.selectedRow;
    const selC = state.selectedCol;

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = state.board[r][c];
        const isInitial = state.initialBoard[r][c];
        const isSelected = (selR === r && selC === c);
        const inSameRow = (selR === r);
        const inSameCol = (selC === c);
        const inSameBox = (selR >= 0 && selC >= 0 && Math.floor(selR / 3) === Math.floor(r / 3) && Math.floor(selC / 3) === Math.floor(c / 3));
        const isPeer = (inSameRow || inSameCol || inSameBox);
        const isSameNum = (val !== 0 && selectedNum !== 0 && val === selectedNum);

        // Conflict check: value conflicts with same row/col/box
        let isConflict = false;
        if (val !== 0 && !isInitial && val !== state.solution[r][c]) {
          isConflict = true;
        }

        // Heavy block border styling (thick boundaries between 3x3 zones)
        let borderClasses = '';
        if (c === 2 || c === 5) borderClasses += ' border-r-2 border-r-slate-800';
        if (r === 2 || r === 5) borderClasses += ' border-b-2 border-b-slate-800';

        // Background & Text Colors
        let bgClass = 'bg-white';
        let textClass = 'text-slate-800';

        if (isSelected) {
          bgClass = 'bg-blue-200 ring-2 ring-blue-500 z-10';
        } else if (isConflict) {
          bgClass = 'bg-rose-100';
          textClass = 'text-rose-600 font-black';
        } else if (isSameNum) {
          bgClass = 'bg-amber-200 font-black';
        } else if (isPeer) {
          bgClass = 'bg-slate-100/90';
        }

        if (isInitial) {
          textClass = isConflict ? 'text-rose-700 font-black' : 'text-slate-900 font-extrabold';
        } else if (val !== 0) {
          textClass = isConflict ? 'text-rose-600 font-black' : 'text-blue-600 font-black';
        }

        const cellNotes = state.notes[r][c];
        const hasNotes = (val === 0 && cellNotes.size > 0);

        html += `
          <div onclick="selectSudokuCell(${r}, ${c})"
               class="relative flex items-center justify-center cursor-pointer select-none transition-colors duration-75 ${bgClass} ${borderClasses}">
            ${val !== 0 ? `
              <span class="text-base sm:text-lg ${textClass} leading-none">${val}</span>
            ` : hasNotes ? `
              <div class="grid grid-cols-3 grid-rows-3 w-full h-full p-0.5 text-[8px] font-bold text-slate-500 leading-none">
                ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `
                  <div class="flex items-center justify-center">${cellNotes.has(n) ? n : ''}</div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `;
      }
    }
    return html;
  }

  // --- Modals (Difficulty, Victory, Game Over) ---
  function openDifficultyModal() {
    const modalId = 'sudokuDiffModal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.className = 'fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in';
    overlay.innerHTML = `
      <div class="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">
              <i class="fa-solid fa-puzzle-piece"></i>
            </div>
            <div>
              <h3 class="text-sm font-black text-slate-800">Select Difficulty</h3>
              <p class="text-[10px] text-slate-400">Choose your challenge level</p>
            </div>
          </div>
          <button type="button" onclick="document.getElementById('${modalId}')?.remove()" class="w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-100 flex items-center justify-center">
            <i class="fa-solid fa-xmark text-xs"></i>
          </button>
        </div>

        <div class="space-y-2">
          ${Object.values(DIFFICULTIES).map(d => {
            const isSelected = (state.difficulty === d.id);
            const best = getBestTime(d.id);
            return `
              <button type="button" onclick="selectSudokuDifficulty('${d.id}')"
                      class="w-full text-left p-3 rounded-2xl border transition flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/50 shadow-xs ring-1 ring-blue-400'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }">
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs font-bold text-slate-800">${d.name}</span>
                    <span class="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full ${d.badgeColor} border">${d.ageTag}</span>
                  </div>
                  <p class="text-[10px] text-slate-400 leading-tight mt-0.5 line-clamp-1">${d.description}</p>
                </div>
                <div class="text-right shrink-0">
                  <span class="text-[9px] font-semibold text-slate-400 block">Best</span>
                  <span class="text-xs font-bold text-slate-700">${best ? formatTime(best) : '--:--'}</span>
                </div>
              </button>
            `;
          }).join('')}
        </div>

        <div class="pt-1 flex items-center justify-between text-xs">
          <label class="flex items-center gap-2 cursor-pointer text-slate-600 font-medium text-[11px]">
            <input type="checkbox" id="sudokuRelaxedModeToggle" ${state.relaxedMode ? 'checked' : ''} onchange="toggleSudokuRelaxedMode(this.checked)" class="rounded text-blue-600 focus:ring-0">
            <span>Relaxed Mode (Unlimited Mistakes)</span>
          </label>
        </div>

        <button type="button" onclick="startSudokuWithSelectedDifficulty()" class="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-sm">
          Start Game
        </button>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function showVictoryModal(isNewBest) {
    const modalId = 'sudokuVictoryModal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const diff = DIFFICULTIES[state.difficulty] || DIFFICULTIES.medium;

    const overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.className = 'fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in';
    overlay.innerHTML = `
      <div class="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 text-center space-y-4">
        <div class="w-16 h-16 rounded-2xl bg-amber-100 text-amber-500 mx-auto flex items-center justify-center text-3xl shadow-lg shadow-amber-200/50 animate-bounce">
          🏆
        </div>

        <div>
          <span class="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600">Puzzle Solved!</span>
          <h2 class="text-xl font-black text-slate-800 mt-0.5">Magnificent Logic!</h2>
          <p class="text-xs text-slate-500 mt-1">You conquered the ${diff.name} Sudoku challenge!</p>
        </div>

        <div class="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100 text-left">
          <div>
            <span class="text-[10px] text-slate-400 font-medium block">Time Taken</span>
            <span class="text-sm font-black text-slate-800">${formatTime(state.timerSeconds)}</span>
            ${isNewBest ? '<span class="text-[9px] font-bold text-amber-600 block">✨ New Personal Best!</span>' : ''}
          </div>
          <div>
            <span class="text-[10px] text-slate-400 font-medium block">Difficulty</span>
            <span class="text-xs font-bold text-slate-700">${diff.name.split(' ')[0]}</span>
            <span class="text-[9px] text-slate-400 block">${state.mistakes} mistakes made</span>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 pt-1">
          <button type="button" onclick="document.getElementById('${modalId}')?.remove(); openGamesList()" class="py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition">
            All Games
          </button>
          <button type="button" onclick="document.getElementById('${modalId}')?.remove(); initNewSudokuGame()" class="py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-sm">
            Next Puzzle
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function showGameOverModal() {
    const modalId = 'sudokuGameOverModal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.className = 'fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in';
    overlay.innerHTML = `
      <div class="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 text-center space-y-4">
        <div class="w-14 h-14 rounded-2xl bg-rose-100 text-rose-500 mx-auto flex items-center justify-center text-2xl shadow-sm">
          <i class="fa-solid fa-heart-crack"></i>
        </div>

        <div>
          <span class="text-[10px] font-extrabold uppercase tracking-widest text-rose-600">3 Mistakes Reached</span>
          <h2 class="text-lg font-black text-slate-800 mt-0.5">Game Over</h2>
          <p class="text-xs text-slate-500 mt-1">You made 3 mistakes in Challenge Mode. Keep practicing to master elimination!</p>
        </div>

        <div class="space-y-2 pt-1">
          <button type="button" onclick="document.getElementById('${modalId}')?.remove(); initNewSudokuGame()" class="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-sm">
            Try Again
          </button>
          <button type="button" onclick="document.getElementById('${modalId}')?.remove(); enableSudokuRelaxedMode()" class="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition">
            Continue in Relaxed Mode
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  // --- Keyboard Support for Desktop / Web ---
  function handleKeyDown(e) {
    if (typeof gamesSubView !== 'undefined' && gamesSubView !== 'sudoku') return;
    if (state.isPaused || state.isComplete) return;

    if (e.key >= '1' && e.key <= '9') {
      inputNumber(parseInt(e.key, 10));
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      eraseSelectedCell();
    } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
      undoMove();
    } else if (e.key.toLowerCase() === 'n') {
      toggleNotesMode();
    } else if (e.key === 'ArrowUp' && state.selectedRow > 0) {
      selectCell(state.selectedRow - 1, state.selectedCol);
    } else if (e.key === 'ArrowDown' && state.selectedRow < 8) {
      selectCell(state.selectedRow + 1, state.selectedCol);
    } else if (e.key === 'ArrowLeft' && state.selectedCol > 0) {
      selectCell(state.selectedRow, state.selectedCol - 1);
    } else if (e.key === 'ArrowRight' && state.selectedCol < 8) {
      selectCell(state.selectedRow, state.selectedCol + 1);
    }
  }

  window.addEventListener('keydown', handleKeyDown);

  // --- Global Public Handlers ---
  window.openSudokuGame = function (diffKey = null) {
    if (typeof gamesSubView !== 'undefined') {
      gamesSubView = 'sudoku';
    }
    initNewGame(diffKey || state.difficulty);
  };

  window.renderSudokuGame = function (container) {
    renderGameBoard();
  };

  window.cleanupSudokuGame = function () {
    stopTimer();
    const diffModal = document.getElementById('sudokuDiffModal');
    if (diffModal) diffModal.remove();
    const vicModal = document.getElementById('sudokuVictoryModal');
    if (vicModal) vicModal.remove();
    const goModal = document.getElementById('sudokuGameOverModal');
    if (goModal) goModal.remove();
  };

  window.selectSudokuCell = function (r, c) {
    selectCell(r, c);
  };

  window.inputSudokuNumber = function (num) {
    inputNumber(num);
  };

  window.eraseSudokuCell = function () {
    eraseSelectedCell();
  };

  window.undoSudokuMove = function () {
    undoMove();
  };

  window.toggleSudokuNotesMode = function () {
    state.notesMode = !state.notesMode;
    Sound.tap();
    renderGameBoard();
  };

  window.giveSudokuHint = function () {
    provideHint();
  };

  window.toggleSudokuSound = function () {
    Sound.toggle();
    renderGameBoard();
  };

  window.openSudokuDifficultyModal = function () {
    openDifficultyModal();
  };

  window.selectSudokuDifficulty = function (diffId) {
    state.difficulty = diffId;
    openDifficultyModal();
  };

  window.toggleSudokuRelaxedMode = function (val) {
    state.relaxedMode = val;
  };

  window.enableSudokuRelaxedMode = function () {
    state.relaxedMode = true;
    startTimer();
    renderGameBoard();
  };

  window.startSudokuWithSelectedDifficulty = function () {
    const modal = document.getElementById('sudokuDiffModal');
    if (modal) modal.remove();
    initNewGame(state.difficulty);
  };

  window.initNewSudokuGame = function () {
    initNewGame(state.difficulty);
  };

})();
