// --- Sliding Puzzle Gameplay, Gallery & Custom Photo Engine -----------------
// Complete implementation of the child-friendly Sliding Puzzle:
// - Category & Gallery view (Built-in + Custom Puzzles)
// - Custom Photo Uploader with interactive square crop & grid preview
// - IndexedDB persistence for user-created puzzles (images never in LocalStorage)
// - Genuine sliding-tile mechanic with guaranteed solvable shuffle
// - Responsive touch & mouse controls, timer, move counter
// - Hints (tile numbers + peek original picture)
// - Victory celebration with confetti, stars, and record tracking

let activePuzzle = null;
let puzzleGridSize = 3; // 3, 4, 5, or 6
let puzzleBoard = []; // Array of tile numbers 0 .. (N*N - 1), where (N*N - 1) is EMPTY
let puzzleInitialBoard = []; // Stored starting shuffle for Restart action
let puzzleEmptyIndex = 0;
let puzzleMoves = 0;
let puzzleSeconds = 0;
let puzzleTimerInterval = null;
let puzzleTimerStarted = false;
let puzzleIsSolved = false;
let puzzleShowNumbers = false;
let puzzleShowStars = true; // 5-year-old friendly helper stars on correctly placed tiles!
let puzzleSoundEnabled = true; // Web Audio API sound effects enabled
let puzzleShowPeekModal = false;
let puzzleGalleryFilter = 'all'; // 'all' | 'builtin' | 'custom'
let customPuzzlesList = [];

// A to Z Alphabet & Voice Sound Support
let puzzleLetterMode = false;
let puzzleSpeechEnabled = true;

// Zoomify Desktop Fit & Keyboard Controls Support
let puzzleIsZoomed = false;
let _puzzleKeyHandlerAttached = false;

// Web Audio API Synthesizer for 5yo child-friendly tactile sound effects (100% offline)
const PuzzleAudio = (() => {
  let ctx = null;
  let soundEnabled = true;

  function getContext() {
    if (typeof window === 'undefined') return null;
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) ctx = new AudioCtx();
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  return {
    isEnabled: () => soundEnabled,
    toggle: () => { soundEnabled = !soundEnabled; return soundEnabled; },
    playSlide() {
      if (!soundEnabled) return;
      try {
        const c = getContext();
        if (!c) return;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, c.currentTime);
        osc.frequency.exponentialRampToValueAtTime(480, c.currentTime + 0.08);
        gain.gain.setValueAtTime(0.12, c.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start();
        osc.stop(c.currentTime + 0.08);
      } catch (_) {}
    },
    playTilePlaced() {
      if (!soundEnabled) return;
      try {
        const c = getContext();
        if (!c) return;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(659.25, c.currentTime); // E5
        osc.frequency.setValueAtTime(880, c.currentTime + 0.06); // A5
        gain.gain.setValueAtTime(0.15, c.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start();
        osc.stop(c.currentTime + 0.18);
      } catch (_) {}
    },
    playVictory() {
      if (!soundEnabled) return;
      try {
        const c = getContext();
        if (!c) return;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
          const osc = c.createOscillator();
          const gain = c.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, c.currentTime + i * 0.1);
          gain.gain.setValueAtTime(0.18, c.currentTime + i * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.1 + 0.25);
          osc.connect(gain);
          gain.connect(c.destination);
          osc.start(c.currentTime + i * 0.1);
          osc.stop(c.currentTime + i * 0.1 + 0.25);
        });
      } catch (_) {}
    }
  };
})();

function togglePuzzleSound() {
  puzzleSoundEnabled = !puzzleSoundEnabled;
  PuzzleAudio.toggle();
  const btn = document.getElementById('puzzleSoundBtn');
  if (btn) {
    btn.innerHTML = `
      <i class="fa-solid ${puzzleSoundEnabled ? 'fa-music text-pink-500' : 'fa-volume-xmark text-slate-400'} text-xs"></i>
      <span>${puzzleSoundEnabled ? 'Sound' : 'Muted'}</span>
    `;
    if (puzzleSoundEnabled) {
      btn.className = 'flex-1 py-2 px-2 rounded-xl border border-pink-200 bg-pink-50 text-pink-700 font-bold text-xs flex items-center justify-center gap-1 transition';
    } else {
      btn.className = 'flex-1 py-2 px-2 rounded-xl border border-slate-200 bg-white text-slate-400 font-bold text-xs flex items-center justify-center gap-1 transition';
    }
  }
}

function togglePuzzleStarsHelper() {
  puzzleShowStars = !puzzleShowStars;
  _renderBoardTiles();
  const btn = document.getElementById('puzzleStarsHelperBtn');
  if (btn) {
    btn.innerHTML = `
      <i class="fa-solid fa-star ${puzzleShowStars ? 'text-amber-500' : 'text-slate-400'} text-xs"></i>
      <span>Stars</span>
    `;
    if (puzzleShowStars) {
      btn.className = 'flex-1 py-2 px-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-700 font-bold text-xs flex items-center justify-center gap-1 transition';
    } else {
      btn.className = 'flex-1 py-2 px-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-bold text-xs flex items-center justify-center gap-1 transition';
    }
  }
}

// Helper to look up tile letter / number label
function getTileLabel(tileVal) {
  const isAlpha = (activePuzzle && activePuzzle.isAlphabet) || puzzleLetterMode;
  if (isAlpha) {
    if (tileVal < 26) {
      return String.fromCharCode(65 + tileVal); // 'A', 'B', 'C', ... 'Z'
    }
    const extras = ['⭐', '💖', '🎈', '🌈', '🎉', '✨', '🌻', '🐶', '🐱', '🚀'];
    return extras[tileVal - 26] || `${tileVal + 1}`;
  }
  return `${tileVal + 1}`;
}

// Speaks letter aloud using Web Speech API for child-friendly auditory feedback
function speakTileLetter(label) {
  if (!puzzleSpeechEnabled) return;
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(label);
    utter.rate = 0.9;
    utter.pitch = 1.2; // cute, friendly higher pitch for kids
    window.speechSynthesis.speak(utter);
  } catch (e) {}
}

function togglePuzzleSpeech() {
  puzzleSpeechEnabled = !puzzleSpeechEnabled;
  const btn = document.getElementById('puzzleSpeechToggleBtn');
  if (btn) {
    btn.innerHTML = `
      <i class="fa-solid ${puzzleSpeechEnabled ? 'fa-volume-high text-amber-500' : 'fa-volume-xmark text-slate-400'} text-xs"></i>
      <span>${puzzleSpeechEnabled ? 'Voice' : 'Quiet'}</span>
    `;
    if (puzzleSpeechEnabled) {
      btn.classList.add('bg-amber-50', 'text-amber-700', 'border-amber-200');
    } else {
      btn.classList.remove('bg-amber-50', 'text-amber-700', 'border-amber-200');
    }
  }
}

async function startAtoZPuzzle(optionalGridSize) {
  puzzleLetterMode = true;
  puzzleShowNumbers = true; // Show letters by default for A to Z puzzle!
  await startSlidingPuzzle('sample_atoz', optionalGridSize || 4);
}

// --- Zoomify & Desktop Fit Support -------------------------------------------

function initPuzzleZoomState() {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('lifeTracker_puzzle_zoomify');
    if (saved !== null) {
      puzzleIsZoomed = saved === 'true';
      return;
    }
  }
  // If no saved preference, default to true on desktop/laptop screens (>= 768px)
  puzzleIsZoomed = typeof window !== 'undefined' && window.innerWidth >= 768;
}
initPuzzleZoomState();

function applyZoomifyContainerClass() {
  const main = document.getElementById('mainContainer');
  const nav = document.getElementById('bottomNav');
  if (puzzleIsZoomed) {
    if (main) {
      main.classList.remove('max-w-md');
      main.classList.add('max-w-5xl');
    }
    if (nav) {
      nav.classList.add('hidden');
    }
  } else {
    resetZoomifyContainerClass();
  }
}

function resetZoomifyContainerClass() {
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

function togglePuzzleZoomify() {
  puzzleIsZoomed = !puzzleIsZoomed;
  try {
    localStorage.setItem('lifeTracker_puzzle_zoomify', puzzleIsZoomed ? 'true' : 'false');
  } catch (e) {}

  if (puzzleIsZoomed) {
    applyZoomifyContainerClass();
  } else {
    resetZoomifyContainerClass();
  }

  const container = document.getElementById('mainContainer');
  if (container && gamesSubView === 'sliding_puzzle_play') {
    renderSlidingPuzzleGameBoard(container);
  }
}

function togglePuzzleFullscreen() {
  if (typeof document === 'undefined') return;
  if (!document.fullscreenElement) {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }
}

// --- Desktop Keyboard Arrow Controls -----------------------------------------

function _handlePuzzleKeyDown(e) {
  if (puzzleIsSolved || gamesSubView !== 'sliding_puzzle_play') return;
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
  const victoryModal = document.getElementById('puzzleVictoryModal');
  if (victoryModal && !victoryModal.classList.contains('hidden')) return;
  const peekModal = document.getElementById('puzzlePeekOverlay');
  if (peekModal && !peekModal.classList.contains('hidden')) {
    if (e.key === 'Escape') togglePuzzlePeekModal();
    return;
  }

  const N = puzzleGridSize;
  const empty = puzzleEmptyIndex;
  const eRow = Math.floor(empty / N);
  const eCol = empty % N;
  let targetIdx = -1;

  if (e.key === 'ArrowUp' || e.code === 'KeyW') {
    // Tile below empty moves UP into empty spot
    if (eRow < N - 1) targetIdx = empty + N;
  } else if (e.key === 'ArrowDown' || e.code === 'KeyS') {
    // Tile above empty moves DOWN into empty spot
    if (eRow > 0) targetIdx = empty - N;
  } else if (e.key === 'ArrowLeft' || e.code === 'KeyA') {
    // Tile to the right moves LEFT into empty spot
    if (eCol < N - 1) targetIdx = empty + 1;
  } else if (e.key === 'ArrowRight' || e.code === 'KeyD') {
    // Tile to the left moves RIGHT into empty spot
    if (eCol > 0) targetIdx = empty - 1;
  }

  if (targetIdx >= 0) {
    e.preventDefault();
    handleTileClick(targetIdx);
  }
}

function _attachPuzzleKeyboardListener() {
  if (typeof window === 'undefined' || _puzzleKeyHandlerAttached) return;
  window.addEventListener('keydown', _handlePuzzleKeyDown);
  _puzzleKeyHandlerAttached = true;
}

function _removePuzzleKeyboardListener() {
  if (typeof window === 'undefined' || !_puzzleKeyHandlerAttached) return;
  window.removeEventListener('keydown', _handlePuzzleKeyDown);
  _puzzleKeyHandlerAttached = false;
}

// Cropper State for "Create Puzzle from Photo"
let cropperImage = null;
let cropperZoom = 1;
let cropperOffsetX = 0;
let cropperOffsetY = 0;
let cropperIsDragging = false;
let cropperDragStartX = 0;
let cropperDragStartY = 0;
let cropperGridSize = 3;

// --- Storage & Data Layer ----------------------------------------------------

async function loadCustomPuzzles() {
  try {
    if (typeof IDB !== 'undefined') {
      const records = await IDB.getAll('puzzles');
      customPuzzlesList = (records || []).filter(p => p.gameType === 'sliding-puzzle');
      customPuzzlesList.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }
  } catch (err) {
    console.error('Failed to load custom puzzles from IDB:', err);
    customPuzzlesList = [];
  }
  return customPuzzlesList;
}

async function saveCustomPuzzle(puzzle) {
  try {
    if (typeof IDB !== 'undefined') {
      await IDB.put('puzzles', puzzle);
      await loadCustomPuzzles();
    }
  } catch (err) {
    console.error('Failed to save puzzle to IDB:', err);
    if (typeof showAlert === 'function') {
      await showAlert('Could not save custom puzzle due to storage limits.', { tone: 'warning' });
    }
  }
}

async function deleteCustomPuzzle(puzzleId) {
  const p = customPuzzlesList.find(x => x.id === puzzleId) || (activePuzzle && activePuzzle.id === puzzleId ? activePuzzle : null);
  const name = p ? p.name : 'this puzzle';

  const confirmed = typeof showConfirm === 'function'
    ? await showConfirm(`Are you sure you want to delete "${name}"?`, {
        title: 'Delete Puzzle',
        tone: 'danger',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel'
      })
    : confirm(`Are you sure you want to delete "${name}"?`);

  if (!confirmed) return;

  try {
    // 1. Delete puzzle entry and photo data from IndexedDB
    if (typeof IDB !== 'undefined') {
      await IDB.delete('puzzles', puzzleId);
    }

    // 2. Clear saved high score and stats
    try {
      localStorage.removeItem(`lifeTracker_puzzle_stats_${puzzleId}`);
    } catch (_) {}

    // 3. Update in-memory list
    customPuzzlesList = customPuzzlesList.filter(x => x.id !== puzzleId);

    // 4. If playing this puzzle right now, clean up and return to gallery
    if (activePuzzle && activePuzzle.id === puzzleId) {
      _slidingPuzzleStopTimer();
      activePuzzle = null;
    }

    // 5. Re-render gallery
    openSlidingPuzzleCategory();

    if (typeof showAlert === 'function') {
      await showAlert(`"${name}" has been deleted.`, {
        title: 'Deleted',
        tone: 'info',
        okLabel: 'OK'
      });
    }
  } catch (err) {
    console.error('Failed to delete puzzle:', err);
    if (typeof showAlert === 'function') {
      await showAlert('Could not delete puzzle. Please try again.', { tone: 'danger' });
    }
  }
}

function getBestStats(puzzleId) {
  try {
    const raw = localStorage.getItem(`lifeTracker_puzzle_stats_${puzzleId}`);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

async function updateBestStats(puzzleId, moves, seconds) {
  const existing = getBestStats(puzzleId) || {};
  const isNewBestMoves = !existing.bestMoves || moves < existing.bestMoves;
  const isNewBestTime = !existing.bestTimeSeconds || seconds < existing.bestTimeSeconds;

  const updated = {
    bestMoves: isNewBestMoves ? moves : existing.bestMoves,
    bestTimeSeconds: isNewBestTime ? seconds : existing.bestTimeSeconds,
    lastPlayed: new Date().toISOString()
  };

  try {
    localStorage.setItem(`lifeTracker_puzzle_stats_${puzzleId}`, JSON.stringify(updated));
  } catch (e) {}

  // Also update IDB if it's a custom puzzle
  const custom = customPuzzlesList.find(p => p.id === puzzleId);
  if (custom) {
    custom.bestMoves = updated.bestMoves;
    custom.bestTimeSeconds = updated.bestTimeSeconds;
    await IDB.put('puzzles', custom);
  }

  return { isNewBestMoves, isNewBestTime };
}

// --- Navigation Entry Points -------------------------------------------------

async function openSlidingPuzzleCategory() {
  _slidingPuzzleCleanupGame();
  gamesSubView = 'sliding_puzzle';
  await loadCustomPuzzles();
  renderGamesPage(document.getElementById('mainContainer'));
}

function setPuzzleGalleryFilter(filter) {
  puzzleGalleryFilter = filter;
  renderSlidingPuzzleCategory(document.getElementById('mainContainer'));
}

// --- Category & Gallery UI ---------------------------------------------------

function renderSlidingPuzzleCategory(container) {
  if (!container) container = document.getElementById('mainContainer');
  if (!container) return;

  const builtInPuzzles = typeof SAMPLE_PUZZLES !== 'undefined' ? SAMPLE_PUZZLES : [];
  const customCount = customPuzzlesList.length;

  let displayPuzzles = [];
  if (puzzleGalleryFilter === 'builtin') {
    displayPuzzles = builtInPuzzles;
  } else if (puzzleGalleryFilter === 'custom') {
    displayPuzzles = customPuzzlesList;
  } else {
    displayPuzzles = [...builtInPuzzles, ...customPuzzlesList];
  }

  container.innerHTML = `
    <!-- Top Action Bar -->
    <div class="flex items-center justify-between gap-2">
      <button onclick="openGamesList()" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs transition">
        <i class="fa-solid fa-arrow-left text-[11px]"></i>
        <span>All Games</span>
      </button>

      <span class="text-xs font-bold text-pink-600 bg-pink-50 border border-pink-200/60 px-2.5 py-1 rounded-full">
        <i class="fa-solid fa-puzzle-piece mr-1"></i>Sliding Puzzles
      </span>
    </div>

    <!-- Hero Card with "Upload Your Photo" Action -->
    <div class="relative overflow-hidden rounded-3xl bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 p-5 text-white shadow-lg shadow-pink-500/20">
      <div class="absolute -right-8 -bottom-8 w-36 h-36 rounded-full bg-white/10 blur-xl pointer-events-none"></div>

      <div class="relative space-y-3">
        <div class="space-y-1">
          <div class="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider bg-white/20 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-white">
            <span>✨ Creative & Fun</span>
          </div>
          <h2 class="text-lg font-black tracking-tight leading-tight">Picture Sliding Puzzles</h2>
          <p class="text-xs text-pink-100 leading-snug">Slide scrambled tiles into place or turn your favorite photos into custom puzzles!</p>
        </div>

        <button onclick="openCreatePuzzleModal()" class="w-full py-3 px-4 rounded-2xl bg-white text-pink-600 font-extrabold text-xs shadow-md hover:bg-pink-50 active:scale-98 transition flex items-center justify-center gap-2">
          <i class="fa-solid fa-camera-retro text-sm text-pink-500"></i>
          <span>Upload Your Photo & Create Puzzle</span>
          <i class="fa-solid fa-sparkles text-amber-400 ml-1"></i>
        </button>
      </div>
    </div>

    <!-- Filter Tabs -->
    <div class="flex items-center gap-2 overflow-x-auto hide-scrollbar py-1">
      <button onclick="setPuzzleGalleryFilter('all')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
        puzzleGalleryFilter === 'all'
          ? 'bg-slate-800 text-white shadow-sm'
          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
      }">
        All (${builtInPuzzles.length + customCount})
      </button>
      <button onclick="setPuzzleGalleryFilter('builtin')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
        puzzleGalleryFilter === 'builtin'
          ? 'bg-pink-600 text-white shadow-sm'
          : 'bg-white text-pink-700 border border-pink-200 hover:bg-pink-50'
      }">
        <i class="fa-solid fa-star text-[10px] mr-1"></i>Featured Samples (${builtInPuzzles.length})
      </button>
      <button onclick="setPuzzleGalleryFilter('custom')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
        puzzleGalleryFilter === 'custom'
          ? 'bg-indigo-600 text-white shadow-sm'
          : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50'
      }">
        <i class="fa-solid fa-image text-[10px] mr-1"></i>My Photo Puzzles (${customCount})
      </button>
    </div>

    <!-- Gallery Grid -->
    ${displayPuzzles.length === 0 ? `
      <!-- Friendly Empty State -->
      <div class="rounded-3xl border-2 border-dashed border-pink-200 bg-pink-50/50 p-8 text-center space-y-3">
        <div class="w-16 h-16 mx-auto rounded-full bg-white shadow-sm text-pink-400 flex items-center justify-center">
          <i class="fa-solid fa-images text-2xl"></i>
        </div>
        <div>
          <h3 class="text-sm font-bold text-slate-800">No Photo Puzzles Yet</h3>
          <p class="text-xs text-slate-500 mt-1 max-w-xs mx-auto">Upload any picture from your device to create your daughter's personalized sliding puzzle!</p>
        </div>
        <button onclick="openCreatePuzzleModal()" class="inline-flex items-center gap-2 py-2 px-4 rounded-xl bg-pink-600 text-white text-xs font-bold hover:bg-pink-700 transition shadow-sm">
          <i class="fa-solid fa-plus text-xs"></i>
          <span>Create First Photo Puzzle</span>
        </button>
      </div>
    ` : `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        ${displayPuzzles.map(puzzle => {
          const isCustom = !!puzzle.isCustom;
          const stats = getBestStats(puzzle.id) || {};
          const defaultGrid = puzzle.defaultGridSize || puzzle.gridSize || 3;
          const imgSrc = puzzle.thumbSrc || puzzle.imageSrc || puzzle.image || puzzle.thumb;

          return `
            <div class="rounded-2xl border border-slate-200/90 bg-white p-3 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <!-- Thumbnail Container -->
                <div class="relative w-full aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-100 mb-2.5">
                  <img src="${imgSrc}" alt="${puzzle.name}" class="w-full h-full object-cover select-none pointer-events-none" loading="lazy" />
                  
                  <!-- Tag badges -->
                  <div class="absolute top-2 left-2 flex items-center gap-1">
                    ${isCustom ? `
                      <span class="px-2 py-0.5 rounded-full bg-indigo-600/90 text-white text-[10px] font-bold shadow-xs backdrop-blur-xs">
                        <i class="fa-solid fa-camera mr-1 text-[9px]"></i>Custom Photo
                      </span>
                    ` : `
                      <span class="px-2 py-0.5 rounded-full bg-pink-600/90 text-white text-[10px] font-bold shadow-xs backdrop-blur-xs">
                        <i class="fa-solid fa-wand-magic mr-1 text-[9px]"></i>${puzzle.category || 'Sample'}
                      </span>
                    `}
                  </div>

                  <!-- Difficulty Pill -->
                  <div class="absolute top-2 right-2">
                    <span class="px-2 py-0.5 rounded-full bg-white/90 text-slate-700 text-[10px] font-bold shadow-xs border border-slate-200/80 backdrop-blur-xs">
                      ${defaultGrid}&times;${defaultGrid}
                    </span>
                  </div>

                  ${stats.bestMoves ? `
                    <div class="absolute bottom-2 left-2 right-2 bg-slate-900/75 backdrop-blur-xs text-white px-2 py-1 rounded-lg text-[10px] font-bold flex items-center justify-between">
                      <span><i class="fa-solid fa-trophy text-amber-400 mr-1"></i>Best: ${stats.bestMoves} moves</span>
                      <span>${Math.floor(stats.bestTimeSeconds / 60)}:${(stats.bestTimeSeconds % 60).toString().padStart(2, '0')}</span>
                    </div>
                  ` : ''}
                </div>

                <!-- Title & Meta -->
                <div class="flex items-center justify-between gap-1 mb-1">
                  <h4 class="text-xs font-bold text-slate-800 truncate">${puzzle.name}</h4>
                  ${isCustom ? `
                    <button onclick="deleteCustomPuzzle('${puzzle.id}')" class="px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 flex items-center gap-1 transition text-xs font-bold" title="Delete">
                      <i class="fa-solid fa-trash text-[10px]"></i>
                      <span>Delete</span>
                    </button>
                  ` : ''}
                </div>

                <p class="text-[11px] text-slate-400 line-clamp-1 mb-3">${puzzle.description || 'Sliding picture puzzle'}</p>
              </div>

              <!-- Grid Size Selector & Play Action -->
              <div class="space-y-2 pt-1 border-t border-slate-100">
                <div class="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                  <span>Difficulty:</span>
                  <div class="flex items-center gap-1">
                    ${[2, 3, 4, 5, 6].map(g => `
                      <button onclick="startSlidingPuzzle('${puzzle.id}', ${g})" class="w-6 h-6 rounded-md font-bold transition flex items-center justify-center ${
                        defaultGrid === g ? 'bg-pink-100 text-pink-700 border border-pink-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }" title="${g === 2 ? '2x2 Junior (Ages 4-5)' : `${g}x${g} grid`}">
                        ${g}
                      </button>
                    `).join('')}
                  </div>
                </div>

                <button onclick="startSlidingPuzzle('${puzzle.id}', ${defaultGrid})" class="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 active:scale-98 transition">
                  <i class="fa-solid fa-play text-[10px]"></i>
                  <span>Play (${defaultGrid}&times;${defaultGrid})</span>
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;
}

// --- Photo Upload & Interactive Cropper Modal --------------------------------

function openCreatePuzzleModal() {
  cropperImage = null;
  cropperZoom = 1;
  cropperOffsetX = 0;
  cropperOffsetY = 0;
  cropperGridSize = 3;

  const modal = document.getElementById('formModal');
  const content = document.getElementById('formModalContent');
  if (!modal || !content) return;

  modal.classList.remove('hidden');
  content.innerHTML = `
    <div class="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center">
          <i class="fa-solid fa-camera"></i>
        </div>
        <div>
          <h3 class="text-sm font-bold text-slate-800">Create Puzzle from Photo</h3>
          <p class="text-[10px] text-slate-400">Upload a picture to turn it into a custom puzzle</p>
        </div>
      </div>
      <button onclick="closeFormModal()" class="w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-100 flex items-center justify-center transition">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <!-- Step 1: Upload Dropzone -->
    <div id="cropperUploadArea" class="space-y-4">
      <label class="block w-full border-2 border-dashed border-pink-300 hover:border-pink-500 rounded-2xl p-6 text-center cursor-pointer bg-pink-50/40 hover:bg-pink-50 transition">
        <input type="file" id="puzzlePhotoFileInput" accept="image/*" class="hidden" onchange="_handlePhotoSelected(event)" />
        <div class="w-14 h-14 mx-auto rounded-2xl bg-white shadow-sm text-pink-500 flex items-center justify-center mb-2">
          <i class="fa-solid fa-cloud-arrow-up text-2xl"></i>
        </div>
        <p class="text-xs font-bold text-slate-800">Tap to Choose or Take Photo</p>
        <p class="text-[10px] text-slate-400 mt-1">Supports JPEG, PNG, WebP images from your phone or PC</p>
      </label>
    </div>

    <!-- Step 2: Interactive Cropper (hidden until photo picked) -->
    <div id="cropperAdjustArea" class="hidden space-y-4">
      <!-- Live Square Canvas Viewport -->
      <div class="relative w-full max-w-[320px] aspect-square mx-auto rounded-2xl overflow-hidden shadow-inner border-2 border-pink-200 bg-slate-900">
        <canvas id="cropperCanvas" width="600" height="600" class="w-full h-full cursor-move touch-none"></canvas>
        
        <!-- Live Grid Guide Overlay -->
        <div id="cropperGridOverlay" class="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-white/40">
          <!-- Injected dynamically based on cropperGridSize -->
        </div>

        <!-- Touch / Drag Hint -->
        <div class="absolute bottom-2 left-2 right-2 pointer-events-none text-center">
          <span class="inline-block px-2.5 py-1 rounded-full bg-slate-900/60 backdrop-blur-xs text-[10px] text-white/90 font-medium">
            <i class="fa-solid fa-arrows-up-down-left-right mr-1"></i>Drag to reposition &bull; Pinch/slider to zoom
          </span>
        </div>
      </div>

      <!-- Controls: Zoom & Fit -->
      <div class="space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
        <div class="flex items-center justify-between text-xs font-bold text-slate-700">
          <span class="flex items-center gap-1.5"><i class="fa-solid fa-magnifying-glass-plus text-slate-400"></i> Zoom</span>
          <div class="flex items-center gap-2">
            <button type="button" onclick="_cropperResetView()" class="text-[10px] text-pink-600 font-semibold hover:underline">Center & Fit</button>
            <span id="cropperZoomLabel" class="text-[10px] font-mono text-slate-500">1.0x</span>
          </div>
        </div>
        <input type="range" id="cropperZoomSlider" min="0.8" max="3.0" step="0.05" value="1.0" oninput="_handleCropperZoom(event)" class="w-full accent-pink-600" />
      </div>

      <!-- Form Inputs: Puzzle Name & Grid Size -->
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Puzzle Name</label>
          <input type="text" id="customPuzzleNameInput" placeholder="e.g., Mia's Birthday / Cute Kitty" class="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:border-pink-500" />
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Difficulty Grid Size</label>
          <div class="grid grid-cols-5 gap-1.5">
            <button type="button" onclick="_setCropperGrid(2)" id="cropperGridBtn-2" class="py-2 rounded-xl text-xs font-bold border transition bg-white text-slate-600 border-slate-200 hover:bg-slate-50">
              2&times;2<br><span class="text-[9px] font-normal opacity-90">Junior</span>
            </button>
            <button type="button" onclick="_setCropperGrid(3)" id="cropperGridBtn-3" class="py-2 rounded-xl text-xs font-bold border transition bg-pink-600 text-white border-pink-600 shadow-xs">
              3&times;3<br><span class="text-[9px] font-normal opacity-90">Easy</span>
            </button>
            <button type="button" onclick="_setCropperGrid(4)" id="cropperGridBtn-4" class="py-2 rounded-xl text-xs font-bold border transition bg-white text-slate-600 border-slate-200 hover:bg-slate-50">
              4&times;4<br><span class="text-[9px] font-normal opacity-90">Med</span>
            </button>
            <button type="button" onclick="_setCropperGrid(5)" id="cropperGridBtn-5" class="py-2 rounded-xl text-xs font-bold border transition bg-white text-slate-600 border-slate-200 hover:bg-slate-50">
              5&times;5<br><span class="text-[9px] font-normal opacity-90">Hard</span>
            </button>
            <button type="button" onclick="_setCropperGrid(6)" id="cropperGridBtn-6" class="py-2 rounded-xl text-xs font-bold border transition bg-white text-slate-600 border-slate-200 hover:bg-slate-50">
              6&times;6<br><span class="text-[9px] font-normal opacity-90">Expert</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="_chooseAnotherPhoto()" class="flex-1 py-2.5 text-xs font-bold border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition">
          Change Photo
        </button>
        <button type="button" onclick="_saveAndPlayCustomPuzzle()" class="flex-1 py-2.5 text-xs font-bold bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-xl shadow-md shadow-pink-500/25 transition">
          <i class="fa-solid fa-play mr-1 text-[11px]"></i>Save & Play
        </button>
      </div>
    </div>
  `;
}

function _handlePhotoSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      cropperImage = img;
      // Default puzzle name from file
      const nameInput = document.getElementById('customPuzzleNameInput');
      if (nameInput) {
        const baseName = (file.name || 'My Photo').replace(/\.[^/.]+$/, '');
        nameInput.value = baseName.charAt(0).toUpperCase() + baseName.slice(1);
      }

      document.getElementById('cropperUploadArea').classList.add('hidden');
      document.getElementById('cropperAdjustArea').classList.remove('hidden');

      _cropperResetView();
      _initCropperListeners();
      _updateCropperGridOverlay();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function _cropperResetView() {
  if (!cropperImage) return;
  // Fit image center
  const scale = Math.max(600 / cropperImage.width, 600 / cropperImage.height);
  cropperZoom = 1;
  const slider = document.getElementById('cropperZoomSlider');
  if (slider) slider.value = '1.0';
  const label = document.getElementById('cropperZoomLabel');
  if (label) label.textContent = '1.0x';

  cropperOffsetX = 0;
  cropperOffsetY = 0;
  _drawCropperCanvas();
}

function _setCropperGrid(grid) {
  cropperGridSize = grid;
  [2, 3, 4, 5, 6].forEach(g => {
    const btn = document.getElementById(`cropperGridBtn-${g}`);
    if (btn) {
      if (g === grid) {
        btn.className = 'py-2 rounded-xl text-xs font-bold border transition bg-pink-600 text-white border-pink-600 shadow-xs';
      } else {
        btn.className = 'py-2 rounded-xl text-xs font-bold border transition bg-white text-slate-600 border-slate-200 hover:bg-slate-50';
      }
    }
  });
  _updateCropperGridOverlay();
}

function _updateCropperGridOverlay() {
  const overlay = document.getElementById('cropperGridOverlay');
  if (!overlay) return;
  const N = cropperGridSize;
  overlay.className = 'absolute inset-0 pointer-events-none border border-white/50';
  overlay.style.display = 'grid';
  overlay.style.gridTemplateColumns = `repeat(${N}, minmax(0, 1fr))`;
  overlay.style.gridTemplateRows = `repeat(${N}, minmax(0, 1fr))`;
  
  let html = '';
  const total = N * N;
  for (let i = 0; i < total; i++) {
    const isBlank = (i === total - 1);
    html += `
      <div class="border border-white/40 flex items-center justify-center ${isBlank ? 'bg-pink-500/30' : ''}">
        ${isBlank ? '<span class="text-[10px] font-black text-white/90 bg-slate-900/40 px-1 rounded">EMPTY</span>' : ''}
      </div>
    `;
  }
  overlay.innerHTML = html;
}

function _drawCropperCanvas() {
  const canvas = document.getElementById('cropperCanvas');
  if (!canvas || !cropperImage) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 600, 600);

  // Base cover scale
  const baseScale = Math.max(600 / cropperImage.width, 600 / cropperImage.height);
  const currentScale = baseScale * cropperZoom;

  const scaledW = cropperImage.width * currentScale;
  const scaledH = cropperImage.height * currentScale;

  // Center plus offset
  const drawX = (600 - scaledW) / 2 + cropperOffsetX;
  const drawY = (600 - scaledH) / 2 + cropperOffsetY;

  ctx.drawImage(cropperImage, drawX, drawY, scaledW, scaledH);
}

function _handleCropperZoom(event) {
  cropperZoom = parseFloat(event.target.value) || 1;
  const label = document.getElementById('cropperZoomLabel');
  if (label) label.textContent = `${cropperZoom.toFixed(2)}x`;
  _drawCropperCanvas();
}

function _initCropperListeners() {
  const canvas = document.getElementById('cropperCanvas');
  if (!canvas) return;

  function getPos(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  canvas.onpointerdown = (e) => {
    cropperIsDragging = true;
    canvas.setPointerCapture(e.pointerId);
    cropperDragStartX = e.clientX;
    cropperDragStartY = e.clientY;
  };

  canvas.onpointermove = (e) => {
    if (!cropperIsDragging) return;
    const dx = e.clientX - cropperDragStartX;
    const dy = e.clientY - cropperDragStartY;
    cropperDragStartX = e.clientX;
    cropperDragStartY = e.clientY;

    cropperOffsetX += dx * (600 / canvas.clientWidth);
    cropperOffsetY += dy * (600 / canvas.clientHeight);
    _drawCropperCanvas();
  };

  canvas.onpointerup = (e) => {
    cropperIsDragging = false;
  };
  canvas.onpointercancel = (e) => {
    cropperIsDragging = false;
  };

  _drawCropperCanvas();
}

function _chooseAnotherPhoto() {
  document.getElementById('cropperAdjustArea').classList.add('hidden');
  document.getElementById('cropperUploadArea').classList.remove('hidden');
  const input = document.getElementById('puzzlePhotoFileInput');
  if (input) input.value = '';
}

async function _saveAndPlayCustomPuzzle() {
  const canvas = document.getElementById('cropperCanvas');
  if (!canvas || !cropperImage) return;

  const nameInput = document.getElementById('customPuzzleNameInput');
  const name = (nameInput && nameInput.value.trim()) || 'My Photo Puzzle';

  // Export 600x600 compressed JPEG data URI
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

  const newPuzzle = {
    id: `custom_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
    name: name,
    image: dataUrl,
    thumb: dataUrl,
    gridSize: cropperGridSize,
    gameType: 'sliding-puzzle',
    isCustom: true,
    createdAt: new Date().toISOString(),
    bestMoves: null,
    bestTimeSeconds: null
  };

  await saveCustomPuzzle(newPuzzle);
  closeFormModal();

  // Launch into play immediately
  startSlidingPuzzle(newPuzzle.id, cropperGridSize);
}

// --- Sliding Tile Solvability & Shuffling -------------------------------------

// Calculates number of inversions for solvability checking
function _countInversions(tiles, blankVal) {
  let inversions = 0;
  const filtered = tiles.filter(t => t !== blankVal);
  for (let i = 0; i < filtered.length; i++) {
    for (let j = i + 1; j < filtered.length; j++) {
      if (filtered[i] > filtered[j]) {
        inversions++;
      }
    }
  }
  return inversions;
}

// Rigorous mathematical check for N x N sliding puzzle solvability
function isPuzzleSolvable(tiles, N) {
  const blankVal = N * N - 1;
  const blankIdx = tiles.indexOf(blankVal);
  const inversions = _countInversions(tiles, blankVal);

  if (N % 2 !== 0) {
    // Odd grid (3x3, 5x5): solvable iff inversion count is even
    return inversions % 2 === 0;
  } else {
    // Even grid (4x4, 6x6):
    // Solvable iff blank row from bottom and inversions have opposite parity
    const blankRowFromBottom = N - Math.floor(blankIdx / N);
    return (blankRowFromBottom % 2 === 0) ? (inversions % 2 !== 0) : (inversions % 2 === 0);
  }
}

// Generates a 100% solvable shuffle by executing a random walk of valid legal
// moves starting from the solved state, and confirming with the inversion check.
function generateSolvableShuffle(N) {
  const total = N * N;
  const blankVal = total - 1;
  let board = Array.from({ length: total }, (_, i) => i);
  let emptyIdx = total - 1;
  let lastMove = -1;

  // Make N * 60 random valid sliding moves
  const moveCount = N * 60;
  for (let step = 0; step < moveCount; step++) {
    const r = Math.floor(emptyIdx / N);
    const c = emptyIdx % N;

    const validMoves = [];
    if (r > 0) validMoves.push(emptyIdx - N); // move tile above down
    if (r < N - 1) validMoves.push(emptyIdx + N); // move tile below up
    if (c > 0) validMoves.push(emptyIdx - 1); // move tile left right
    if (c < N - 1) validMoves.push(emptyIdx + 1); // move tile right left

    // Avoid immediately undoing the previous move
    const candidates = validMoves.filter(m => m !== lastMove);
    const chosen = candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : validMoves[Math.floor(Math.random() * validMoves.length)];

    lastMove = emptyIdx;
    board[emptyIdx] = board[chosen];
    board[chosen] = blankVal;
    emptyIdx = chosen;
  }

  // Safety assertions: ensure solvable and not already solved
  let isAlreadySolved = board.every((val, idx) => val === idx);
  if (isAlreadySolved || !isPuzzleSolvable(board, N)) {
    // If by freak chance it landed back on solved or parity failed, do a swap that preserves parity
    // or run another small sequence of legal moves
    const r = Math.floor(emptyIdx / N);
    const swapTarget = r > 0 ? emptyIdx - N : emptyIdx + N;
    board[emptyIdx] = board[swapTarget];
    board[swapTarget] = blankVal;
  }

  return board;
}

// --- Gameplay Engine ---------------------------------------------------------

async function startSlidingPuzzle(puzzleId, optionalGridSize) {
  // Find puzzle from built-ins or custom list
  let p = null;
  if (typeof SAMPLE_PUZZLES !== 'undefined') {
    p = SAMPLE_PUZZLES.find(x => x.id === puzzleId);
  }
  if (!p) {
    p = customPuzzlesList.find(x => x.id === puzzleId);
  }
  if (!p) {
    await loadCustomPuzzles();
    p = customPuzzlesList.find(x => x.id === puzzleId);
  }
  if (!p) {
    if (typeof showAlert === 'function') {
      await showAlert('Puzzle not found.');
    }
    return;
  }

  activePuzzle = p;
  puzzleGridSize = optionalGridSize || p.defaultGridSize || p.gridSize || 3;

  // Initialize Board
  const N = puzzleGridSize;
  const blankVal = N * N - 1;
  puzzleBoard = generateSolvableShuffle(N);
  puzzleInitialBoard = [...puzzleBoard];
  puzzleEmptyIndex = puzzleBoard.indexOf(blankVal);

  puzzleMoves = 0;
  puzzleSeconds = 0;
  puzzleTimerStarted = false;
  puzzleIsSolved = false;
  puzzleLetterMode = !!(p && p.isAlphabet);
  puzzleShowNumbers = !!(p && p.isAlphabet);
  puzzleShowPeekModal = false;

  _slidingPuzzleStopTimer();

  gamesSubView = 'sliding_puzzle_play';
  if (puzzleIsZoomed) {
    applyZoomifyContainerClass();
  } else {
    resetZoomifyContainerClass();
  }
  renderGamesPage(document.getElementById('mainContainer'));
}

function _slidingPuzzleStartTimer() {
  if (puzzleTimerStarted) return;
  puzzleTimerStarted = true;
  puzzleTimerInterval = setInterval(() => {
    if (!puzzleIsSolved) {
      puzzleSeconds++;
      _updateTimerDisplay();
    }
  }, 1000);
}

function _slidingPuzzleStopTimer() {
  if (puzzleTimerInterval) {
    clearInterval(puzzleTimerInterval);
    puzzleTimerInterval = null;
  }
}

function _slidingPuzzleCleanupGame() {
  _slidingPuzzleStopTimer();
  resetZoomifyContainerClass();
  _removePuzzleKeyboardListener();
  if (typeof document !== 'undefined' && document.fullscreenElement) {
    try { document.exitFullscreen(); } catch (e) {}
  }
}

function _updateTimerDisplay() {
  const el = document.getElementById('puzzleTimerText');
  if (el) {
    const mins = Math.floor(puzzleSeconds / 60);
    const secs = puzzleSeconds % 60;
    el.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

function _updateMovesDisplay() {
  const el = document.getElementById('puzzleMovesText');
  if (el) {
    el.textContent = `${puzzleMoves}`;
  }
}

// User Action: Click / Tap on Tile
function handleTileClick(clickedIdx) {
  if (puzzleIsSolved) return;

  const N = puzzleGridSize;
  const blankVal = N * N - 1;
  const emptyIdx = puzzleEmptyIndex;

  const cRow = Math.floor(clickedIdx / N);
  const cCol = clickedIdx % N;
  const eRow = Math.floor(emptyIdx / N);
  const eCol = emptyIdx % N;

  // Check if clicked tile is adjacent to empty tile
  const isAdjacent = (Math.abs(cRow - eRow) + Math.abs(cCol - eCol) === 1);

  if (isAdjacent) {
    // Single tile slide
    _moveSingleTile(clickedIdx);
  } else if (cRow === eRow || cCol === eCol) {
    // Multi-tile line slide in the row or column towards empty space
    _moveLineOfTiles(clickedIdx, cRow, cCol, eRow, eCol);
  } else {
    // Invalid move: friendly visual feedback (gentle wiggle)
    _wiggleTile(clickedIdx);
  }
}

function _moveSingleTile(tileIdx) {
  const blankVal = puzzleGridSize * puzzleGridSize - 1;
  const oldEmpty = puzzleEmptyIndex;
  const movedTileVal = puzzleBoard[tileIdx];

  puzzleBoard[oldEmpty] = puzzleBoard[tileIdx];
  puzzleBoard[tileIdx] = blankVal;
  puzzleEmptyIndex = tileIdx;

  puzzleMoves++;
  _slidingPuzzleStartTimer();
  _updateMovesDisplay();
  _renderBoardTiles();

  // Child-friendly sound effect: chime if placed into solved spot, slide pop otherwise
  if (movedTileVal === oldEmpty) {
    PuzzleAudio.playTilePlaced();
  } else {
    PuzzleAudio.playSlide();
  }

  if (activePuzzle && (activePuzzle.isAlphabet || puzzleLetterMode)) {
    speakTileLetter(getTileLabel(movedTileVal));
  }

  _checkPuzzleSolved();
}

function _moveLineOfTiles(clickedIdx, cRow, cCol, eRow, eCol) {
  const N = puzzleGridSize;
  const blankVal = N * N - 1;
  const movedTileVal = puzzleBoard[clickedIdx];

  if (cRow === eRow) {
    // Same row, horizontal slide
    const dir = cCol < eCol ? 1 : -1;
    for (let c = eCol; c !== cCol; c -= dir) {
      const prevC = c - dir;
      const targetIdx = cRow * N + c;
      const srcIdx = cRow * N + prevC;
      puzzleBoard[targetIdx] = puzzleBoard[srcIdx];
    }
    puzzleBoard[clickedIdx] = blankVal;
    puzzleEmptyIndex = clickedIdx;
  } else {
    // Same col, vertical slide
    const dir = cRow < eRow ? 1 : -1;
    for (let r = eRow; r !== cRow; r -= dir) {
      const prevR = r - dir;
      const targetIdx = r * N + cCol;
      const srcIdx = prevR * N + cCol;
      puzzleBoard[targetIdx] = puzzleBoard[srcIdx];
    }
    puzzleBoard[clickedIdx] = blankVal;
    puzzleEmptyIndex = clickedIdx;
  }

  puzzleMoves++;
  _slidingPuzzleStartTimer();
  _updateMovesDisplay();
  _renderBoardTiles();

  PuzzleAudio.playSlide();

  if (activePuzzle && (activePuzzle.isAlphabet || puzzleLetterMode)) {
    speakTileLetter(getTileLabel(movedTileVal));
  }

  _checkPuzzleSolved();
}

function _wiggleTile(idx) {
  const el = document.getElementById(`puzzleTile-${idx}`);
  if (el) {
    el.classList.add('animate-pulse');
    setTimeout(() => el.classList.remove('animate-pulse'), 300);
  }
}

// Victory Condition Check
async function _checkPuzzleSolved() {
  const total = puzzleGridSize * puzzleGridSize;
  const solved = puzzleBoard.every((val, idx) => val === idx);

  if (solved && !puzzleIsSolved) {
    puzzleIsSolved = true;
    _slidingPuzzleStopTimer();

    // Celebration victory sound fanfare!
    PuzzleAudio.playVictory();

    // Re-render board with the completed final tile visible
    _renderBoardTiles();

    // Update records in storage
    let statsResult = null;
    if (activePuzzle && activePuzzle.id) {
      statsResult = await updateBestStats(activePuzzle.id, puzzleMoves, puzzleSeconds);
    }

    // Trigger delightful celebration
    setTimeout(() => {
      _showVictoryCelebration(statsResult);
    }, 400);
  }
}

// --- Gameplay Actions --------------------------------------------------------

async function exitPuzzleToGallery() {
  if (puzzleMoves > 0 && !puzzleIsSolved) {
    const leave = typeof showConfirm === 'function'
      ? await showConfirm('Leave this puzzle? Your current progress will be reset.', {
          title: 'Exit Puzzle',
          tone: 'info',
          confirmLabel: 'Exit to Gallery',
          cancelLabel: 'Keep Playing',
          danger: false
        })
      : confirm('Exit to gallery?');
    if (!leave) return;
  }

  _slidingPuzzleCleanupGame();
  openSlidingPuzzleCategory();
}

function restartPuzzleGame() {
  const N = puzzleGridSize;
  const blankVal = N * N - 1;
  puzzleBoard = [...puzzleInitialBoard];
  puzzleEmptyIndex = puzzleBoard.indexOf(blankVal);
  puzzleMoves = 0;
  puzzleSeconds = 0;
  puzzleIsSolved = false;
  puzzleTimerStarted = false;
  _slidingPuzzleStopTimer();

  _updateMovesDisplay();
  _updateTimerDisplay();
  _renderBoardTiles();
}

function shufflePuzzleGame() {
  const N = puzzleGridSize;
  const blankVal = N * N - 1;
  puzzleBoard = generateSolvableShuffle(N);
  puzzleInitialBoard = [...puzzleBoard];
  puzzleEmptyIndex = puzzleBoard.indexOf(blankVal);
  puzzleMoves = 0;
  puzzleSeconds = 0;
  puzzleIsSolved = false;
  puzzleTimerStarted = false;
  _slidingPuzzleStopTimer();

  _updateMovesDisplay();
  _updateTimerDisplay();
  _renderBoardTiles();
}

function togglePuzzleNumbersHint() {
  puzzleShowNumbers = !puzzleShowNumbers;
  _renderBoardTiles();
  const btn = document.getElementById('puzzleNumberHintBtn');
  if (btn) {
    const isAlpha = (activePuzzle && activePuzzle.isAlphabet) || puzzleLetterMode;
    const isDesktop = btn.classList.contains('gap-1.5') || puzzleIsZoomed;
    btn.innerHTML = `
      <i class="fa-solid ${isAlpha ? 'fa-font' : 'fa-list-ol'} ${puzzleShowNumbers ? (isAlpha ? 'text-amber-500' : 'text-pink-500') : 'text-slate-400'} text-xs"></i>
      <span>${isAlpha ? 'Letters' : 'Numbers'}</span>
    `;
    if (puzzleShowNumbers) {
      btn.className = `${isDesktop ? 'flex-1 py-2 px-2' : 'flex-1 min-w-[58px] py-2 px-1.5'} rounded-xl border ${isAlpha ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-pink-300 bg-pink-50 text-pink-700'} font-bold text-xs flex items-center justify-center ${isDesktop ? 'gap-1.5' : 'gap-1'} transition`;
    } else {
      btn.className = `${isDesktop ? 'flex-1 py-2 px-2' : 'flex-1 min-w-[58px] py-2 px-1.5'} rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center ${isDesktop ? 'gap-1.5' : 'gap-1'} transition`;
    }
  }
}

function togglePuzzlePeekModal() {
  puzzleShowPeekModal = !puzzleShowPeekModal;
  const modal = document.getElementById('puzzlePeekOverlay');
  if (modal) {
    if (puzzleShowPeekModal) {
      modal.classList.remove('hidden');
    } else {
      modal.classList.add('hidden');
    }
  }
}

function changeGameDifficulty(newSize) {
  if (newSize === puzzleGridSize) return;
  startSlidingPuzzle(activePuzzle.id, newSize);
}

// --- Board & Tile Renderer ---------------------------------------------------

function _renderBoardTiles() {
  const boardEl = document.getElementById('slidingPuzzleGrid');
  if (!boardEl || !activePuzzle) return;

  const N = puzzleGridSize;
  const total = N * N;
  const blankVal = total - 1;
  const imgSrc = activePuzzle.imageSrc || activePuzzle.image || activePuzzle.thumbSrc || activePuzzle.thumb;

  boardEl.className = 'w-full h-full p-2 bg-slate-900/5 rounded-2xl select-none gap-1.5';
  boardEl.style.display = 'grid';
  boardEl.style.gridTemplateColumns = `repeat(${N}, minmax(0, 1fr))`;
  boardEl.style.gridTemplateRows = `repeat(${N}, minmax(0, 1fr))`;

  let html = '';
  for (let idx = 0; idx < total; idx++) {
    const tileVal = puzzleBoard[idx];
    const isBlank = (tileVal === blankVal);

    if (isBlank && !puzzleIsSolved) {
      // Empty cell
      html += `
        <div id="puzzleTile-${idx}" class="relative w-full h-full rounded-xl bg-slate-200/50 border-2 border-dashed border-slate-300/80 flex items-center justify-center transition-all duration-150">
          <div class="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
        </div>
      `;
    } else {
      // Solved or regular tile
      const origRow = Math.floor(tileVal / N);
      const origCol = tileVal % N;
      const posX = N > 1 ? (origCol / (N - 1)) * 100 : 0;
      const posY = N > 1 ? (origRow / (N - 1)) * 100 : 0;
      const sizeMultiplier = N * 100;

      // Determine if movable
      const cRow = Math.floor(idx / N);
      const cCol = idx % N;
      const eRow = Math.floor(puzzleEmptyIndex / N);
      const eCol = puzzleEmptyIndex % N;
      const isMovable = !puzzleIsSolved && (Math.abs(cRow - eRow) + Math.abs(cCol - eCol) === 1 || cRow === eRow || cCol === eCol);
      const isCorrectSpot = (tileVal === idx);

      html += `
        <button type="button" id="puzzleTile-${idx}" onclick="handleTileClick(${idx})" aria-label="Tile ${getTileLabel(tileVal)}"
          class="relative w-full h-full rounded-xl overflow-hidden shadow-xs active:scale-95 transition-transform duration-100 border focus:outline-hidden ${
            isMovable ? 'cursor-pointer hover:brightness-105' : 'cursor-default'
          } ${
            puzzleIsSolved && isBlank ? 'ring-2 ring-emerald-400 animate-fade-in' : ''
          } ${
            !puzzleIsSolved && isCorrectSpot && puzzleShowStars ? 'border-emerald-400 ring-2 ring-emerald-300/60' : 'border-black/10'
          }"
          style="
            background-image: url('${imgSrc}');
            background-size: ${sizeMultiplier}% ${sizeMultiplier}%;
            background-position: ${posX}% ${posY}%;
            background-repeat: no-repeat;
          ">
          ${puzzleShowNumbers ? `
            <span class="absolute top-1 left-1 px-1.5 py-0.5 rounded-md ${
              (activePuzzle && activePuzzle.isAlphabet) || puzzleLetterMode
                ? 'bg-amber-400 text-slate-900 shadow-sm font-black text-xs md:text-sm ring-1 ring-white/90'
                : 'bg-slate-900/75 backdrop-blur-xs text-[10px] md:text-xs font-black text-white shadow-xs'
            } pointer-events-none">
              ${getTileLabel(tileVal)}
            </span>
          ` : ''}
          ${puzzleShowStars && isCorrectSpot && !puzzleIsSolved ? `
            <span class="absolute top-1 right-1 w-5 h-5 md:w-6 md:h-6 rounded-full bg-amber-400 text-slate-900 shadow-sm font-black text-[11px] md:text-sm pointer-events-none flex items-center justify-center ring-1 ring-white/90 animate-pulse">
              ⭐
            </span>
          ` : ''}
        </button>
      `;
    }
  }

  boardEl.innerHTML = html;
}

// --- Swipe Gesture Support on Puzzle Board -----------------------------------

function _initBoardSwipeGestures() {
  const container = document.getElementById('slidingPuzzleContainer');
  if (!container) return;

  let touchStartX = 0;
  let touchStartY = 0;
  let touchTargetIdx = -1;

  container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      const tileBtn = e.target.closest('[id^="puzzleTile-"]');
      if (tileBtn) {
        touchTargetIdx = parseInt(tileBtn.id.replace('puzzleTile-', ''), 10);
      } else {
        touchTargetIdx = -1;
      }
    }
  }, { passive: true });

  container.addEventListener('touchend', (e) => {
    if (touchTargetIdx >= 0 && e.changedTouches.length === 1) {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const dx = touchEndX - touchStartX;
      const dy = touchEndY - touchStartY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 25) {
        // Swipe detected
        const N = puzzleGridSize;
        const eRow = Math.floor(puzzleEmptyIndex / N);
        const eCol = puzzleEmptyIndex % N;
        const tRow = Math.floor(touchTargetIdx / N);
        const tCol = touchTargetIdx % N;

        // Check if swipe direction matches direction toward empty space
        let swipedTowardsEmpty = false;
        if (Math.abs(dx) > Math.abs(dy)) {
          // Horizontal swipe
          if (dx > 0 && tRow === eRow && tCol < eCol) swipedTowardsEmpty = true;
          if (dx < 0 && tRow === eRow && tCol > eCol) swipedTowardsEmpty = true;
        } else {
          // Vertical swipe
          if (dy > 0 && tCol === eCol && tRow < eRow) swipedTowardsEmpty = true;
          if (dy < 0 && tCol === eCol && tRow > eRow) swipedTowardsEmpty = true;
        }

        if (swipedTowardsEmpty) {
          handleTileClick(touchTargetIdx);
        }
      }
    }
    touchTargetIdx = -1;
  }, { passive: true });
}

// --- Main Game Play Page Layout ----------------------------------------------

function renderSlidingPuzzleGameBoard(container) {
  if (!container) container = document.getElementById('mainContainer');
  if (!container || !activePuzzle) return;

  if (puzzleIsZoomed) {
    applyZoomifyContainerClass();
  } else {
    resetZoomifyContainerClass();
  }

  const N = puzzleGridSize;
  const bestStats = getBestStats(activePuzzle.id) || {};
  const imgSrc = activePuzzle.imageSrc || activePuzzle.image || activePuzzle.thumbSrc || activePuzzle.thumb;
  const mins = Math.floor(puzzleSeconds / 60);
  const secs = puzzleSeconds % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

  if (puzzleIsZoomed) {
    // --- Zoomify Desktop Fit Layout (Spacious 2-column view on desktop) ---
    container.innerHTML = `
      <!-- Top Action Navigation Bar -->
      <div class="flex items-center justify-between gap-2 mb-1">
        <button onclick="exitPuzzleToGallery()" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition">
          <i class="fa-solid fa-arrow-left text-[11px]"></i>
          <span>Puzzles</span>
        </button>

        <div class="flex items-center gap-1.5 min-w-0">
          <span class="text-xs sm:text-sm font-black text-slate-800 truncate max-w-[140px] sm:max-w-xs">${activePuzzle.name}</span>
          <span class="px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 border border-pink-200 text-[10px] font-black shrink-0">
            ${N}&times;${N}
          </span>
        </div>

        <div class="flex items-center gap-1.5">
          ${activePuzzle && activePuzzle.isCustom ? `
            <button onclick="deleteCustomPuzzle('${activePuzzle.id}')" class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs transition" title="Delete puzzle">
              <i class="fa-solid fa-trash text-xs"></i>
              <span class="hidden sm:inline">Delete</span>
            </button>
          ` : ''}

          <button id="puzzleZoomifyBtn" onclick="togglePuzzleZoomify()" class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-pink-300 bg-pink-100 text-pink-700 font-bold text-xs shadow-xs hover:bg-pink-200 transition" title="Desktop Fit is active. Click to switch to Mobile view">
            <i class="fa-solid fa-compress text-xs"></i>
            <span class="hidden sm:inline">Fit Mobile</span>
            <span class="sm:hidden">Mobile</span>
          </button>

          <button onclick="togglePuzzleFullscreen()" class="hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs transition" title="Toggle Fullscreen">
            <i class="fa-solid fa-expand text-xs"></i>
          </button>

          <button onclick="togglePuzzlePeekModal()" class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-pink-200 bg-pink-50 hover:bg-pink-100 text-pink-700 font-bold text-xs transition">
            <i class="fa-solid fa-eye text-[11px]"></i>
            <span>Peek</span>
          </button>
        </div>
      </div>

      <!-- Zoomify Desktop Layout: Board on left, controls and live reference on right -->
      <div class="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        <!-- Left: Big Interactive Puzzle Board -->
        <div class="md:col-span-7 lg:col-span-7 flex flex-col items-center">
          <div id="slidingPuzzleContainer" class="relative w-full max-w-[380px] md:max-w-[min(72vh,560px)] aspect-square mx-auto rounded-3xl p-2.5 md:p-3.5 bg-gradient-to-br from-pink-100/70 via-purple-100/50 to-indigo-100/70 border-2 border-pink-200/80 shadow-lg">
            <div id="slidingPuzzleGrid" class="w-full h-full">
              <!-- Rendered by _renderBoardTiles -->
            </div>
          </div>
          <p class="text-[11px] text-slate-400 font-medium text-center mt-2.5 flex items-center justify-center gap-1.5">
            <i class="fa-solid fa-keyboard text-slate-400 text-xs hidden md:inline"></i>
            <span class="hidden md:inline">Tip: Slide with Arrow Keys (&uarr; &darr; &larr; &rarr;) or click tiles</span>
            <span class="md:hidden">Tap adjacent tiles into the empty spot</span>
          </p>
        </div>

        <!-- Right: Stats, Goal Picture, Controls & Difficulty -->
        <div class="md:col-span-5 lg:col-span-5 space-y-3.5">
          <!-- Stats Card -->
          <div class="grid grid-cols-3 gap-2.5 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div class="text-center">
              <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-center gap-1">
                <i class="fa-solid fa-shoe-prints text-pink-500 text-[9px]"></i> Moves
              </p>
              <p id="puzzleMovesText" class="text-xl font-black text-slate-800 leading-tight">${puzzleMoves}</p>
            </div>

            <div class="text-center border-x border-slate-100">
              <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-center gap-1">
                <i class="fa-solid fa-stopwatch text-indigo-500 text-[9px]"></i> Time
              </p>
              <p id="puzzleTimerText" class="text-xl font-black text-slate-800 leading-tight">${timeStr}</p>
            </div>

            <div class="text-center">
              <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-center gap-1">
                <i class="fa-solid fa-trophy text-amber-500 text-[9px]"></i> Record
              </p>
              <p class="text-xl font-black text-slate-800 leading-tight truncate">
                ${bestStats.bestMoves ? `${bestStats.bestMoves} m` : 'None'}
              </p>
            </div>
          </div>

          <!-- Desktop Live Reference Preview Card -->
          <div class="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-slate-200 shadow-inner shrink-0 cursor-pointer group" onclick="togglePuzzlePeekModal()" title="Click to view full preview">
              <img src="${imgSrc}" alt="${activePuzzle.name}" class="w-full h-full object-cover select-none group-hover:scale-105 transition" />
            </div>
            <div class="space-y-1 text-left min-w-0">
              <div class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-pink-600 bg-pink-50 px-2 py-0.5 rounded-md">
                <i class="fa-solid fa-image text-[9px]"></i> Goal Picture
              </div>
              <h4 class="text-xs font-black text-slate-800 truncate">${activePuzzle.name}</h4>
              <p class="text-[11px] text-slate-400 leading-snug">Slide tiles to match this picture!</p>
            </div>
          </div>

          <!-- Action Buttons Toolbar -->
          <div class="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs space-y-2">
            <div class="flex items-center justify-between gap-1.5">
              <button onclick="restartPuzzleGame()" class="flex-1 py-2 px-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition">
                <i class="fa-solid fa-rotate-left text-xs text-slate-500"></i>
                <span>Restart</span>
              </button>

              <button onclick="shufflePuzzleGame()" class="flex-1 py-2 px-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition">
                <i class="fa-solid fa-shuffle text-xs text-slate-500"></i>
                <span>Shuffle</span>
              </button>
            </div>

            <div class="flex items-center justify-between gap-1.5">
              <button id="puzzleStarsHelperBtn" onclick="togglePuzzleStarsHelper()" class="flex-1 py-2 px-2 rounded-xl border ${
                puzzleShowStars ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              } font-bold text-xs flex items-center justify-center gap-1.5 transition" title="Show stars on correctly placed pieces">
                <i class="fa-solid fa-star ${puzzleShowStars ? 'text-amber-500' : 'text-slate-400'} text-xs"></i>
                <span>Stars</span>
              </button>

              <button id="puzzleSoundBtn" onclick="togglePuzzleSound()" class="flex-1 py-2 px-2 rounded-xl border ${
                puzzleSoundEnabled ? 'border-pink-200 bg-pink-50 text-pink-700' : 'border-slate-200 bg-white text-slate-400'
              } font-bold text-xs flex items-center justify-center gap-1.5 transition" title="Sound effects">
                <i class="fa-solid ${puzzleSoundEnabled ? 'fa-music text-pink-500' : 'fa-volume-xmark text-slate-400'} text-xs"></i>
                <span>${puzzleSoundEnabled ? 'Sound' : 'Muted'}</span>
              </button>
            </div>

            <div class="flex items-center justify-between gap-1.5">
              <button id="puzzleNumberHintBtn" onclick="togglePuzzleNumbersHint()" class="flex-1 py-2 px-2 rounded-xl border ${
                puzzleShowNumbers
                  ? ((activePuzzle && activePuzzle.isAlphabet) || puzzleLetterMode ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-pink-300 bg-pink-50 text-pink-700')
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              } font-bold text-xs flex items-center justify-center gap-1.5 transition">
                <i class="fa-solid ${(activePuzzle && activePuzzle.isAlphabet) || puzzleLetterMode ? 'fa-font' : 'fa-list-ol'} ${
                  puzzleShowNumbers ? ((activePuzzle && activePuzzle.isAlphabet) || puzzleLetterMode ? 'text-amber-500' : 'text-pink-500') : 'text-slate-400'
                } text-xs"></i>
                <span>${(activePuzzle && activePuzzle.isAlphabet) || puzzleLetterMode ? 'Letters' : 'Numbers'}</span>
              </button>

              ${(activePuzzle && activePuzzle.isAlphabet) || puzzleLetterMode ? `
                <button id="puzzleSpeechToggleBtn" onclick="togglePuzzleSpeech()" class="flex-1 py-2 px-2 rounded-xl border ${
                  puzzleSpeechEnabled ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-400'
                } font-bold text-xs flex items-center justify-center gap-1.5 transition" title="Voice pronunciation">
                  <i class="fa-solid ${puzzleSpeechEnabled ? 'fa-volume-high text-amber-500' : 'fa-volume-xmark text-slate-400'} text-xs"></i>
                  <span>Voice</span>
                </button>
              ` : ''}
            </div>
          </div>

          <!-- Grid Size / Difficulty Quick Selector -->
          <div class="bg-white/80 border border-slate-200/80 rounded-2xl p-3 flex items-center justify-between gap-2 shadow-xs">
            <span class="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <i class="fa-solid fa-sliders text-pink-500 text-xs"></i>
              Difficulty:
            </span>
            <div class="flex items-center gap-1.5">
              ${[2, 3, 4, 5, 6].map(g => `
                <button onclick="changeGameDifficulty(${g})" class="px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  N === g
                    ? 'bg-pink-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }" title="${g === 2 ? '2x2 Junior Starter (Ages 4-5)' : `${g}x${g} grid`}">
                  ${g}&times;${g}${g === 2 ? ' ⭐' : ''}
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  } else {
    // --- Standard Mobile Layout ---
    container.innerHTML = `
      <!-- Top Action Navigation Bar -->
      <div class="flex items-center justify-between gap-2">
        <button onclick="exitPuzzleToGallery()" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition">
          <i class="fa-solid fa-arrow-left text-[11px]"></i>
          <span>Puzzles</span>
        </button>

        <div class="flex items-center gap-1.5 min-w-0">
          <span class="text-xs font-bold text-slate-700 truncate max-w-[130px] sm:max-w-[150px]">${activePuzzle.name}</span>
          <span class="px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 border border-pink-200 text-[10px] font-black shrink-0">
            ${N}&times;${N}
          </span>
        </div>

        <div class="flex items-center gap-1.5">
          ${activePuzzle && activePuzzle.isCustom ? `
            <button onclick="deleteCustomPuzzle('${activePuzzle.id}')" class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs transition" title="Delete puzzle">
              <i class="fa-solid fa-trash text-xs"></i>
              <span class="hidden sm:inline">Delete</span>
            </button>
          ` : ''}

          <button id="puzzleZoomifyBtn" onclick="togglePuzzleZoomify()" class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-xs transition" title="Zoomify to fit desktop screen">
            <i class="fa-solid fa-expand text-xs text-pink-500"></i>
            <span>Zoomify</span>
          </button>

          <button onclick="togglePuzzlePeekModal()" class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-pink-200 bg-pink-50 hover:bg-pink-100 text-pink-700 font-bold text-xs transition">
            <i class="fa-solid fa-eye text-[11px]"></i>
            <span>Peek</span>
          </button>
        </div>
      </div>

      <!-- Stats Bar (Moves, Timer, Best) -->
      <div class="grid grid-cols-3 gap-2.5 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        <div class="text-center">
          <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-center gap-1">
            <i class="fa-solid fa-shoe-prints text-pink-500 text-[9px]"></i> Moves
          </p>
          <p id="puzzleMovesText" class="text-base font-black text-slate-800 leading-tight">${puzzleMoves}</p>
        </div>

        <div class="text-center border-x border-slate-100">
          <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-center gap-1">
            <i class="fa-solid fa-stopwatch text-indigo-500 text-[9px]"></i> Time
          </p>
          <p id="puzzleTimerText" class="text-base font-black text-slate-800 leading-tight">${timeStr}</p>
        </div>

        <div class="text-center">
          <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-center gap-1">
            <i class="fa-solid fa-trophy text-amber-500 text-[9px]"></i> Record
          </p>
          <p class="text-base font-black text-slate-800 leading-tight truncate">
            ${bestStats.bestMoves ? `${bestStats.bestMoves} m` : 'None'}
          </p>
        </div>
      </div>

      <!-- Central Interactive Puzzle Board -->
      <div id="slidingPuzzleContainer" class="relative w-full max-w-[360px] aspect-square mx-auto rounded-3xl p-2 bg-gradient-to-br from-pink-100/60 via-purple-100/40 to-indigo-100/60 border-2 border-pink-200/80 shadow-md">
        <div id="slidingPuzzleGrid" class="w-full h-full">
          <!-- Rendered by _renderBoardTiles -->
        </div>
      </div>

      <!-- Gameplay Action Toolbar -->
      <div class="flex items-center justify-between gap-1.5 overflow-x-auto hide-scrollbar py-0.5">
        <button onclick="restartPuzzleGame()" class="flex-1 min-w-[58px] py-2 px-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1 transition">
          <i class="fa-solid fa-rotate-left text-xs text-slate-500"></i>
          <span>Restart</span>
        </button>

        <button onclick="shufflePuzzleGame()" class="flex-1 min-w-[58px] py-2 px-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1 transition">
          <i class="fa-solid fa-shuffle text-xs text-slate-500"></i>
          <span>Shuffle</span>
        </button>

        <button id="puzzleStarsHelperBtn" onclick="togglePuzzleStarsHelper()" class="flex-1 min-w-[58px] py-2 px-1.5 rounded-xl border ${
          puzzleShowStars ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
        } font-bold text-xs flex items-center justify-center gap-1 transition" title="Show stars on correctly placed pieces">
          <i class="fa-solid fa-star ${puzzleShowStars ? 'text-amber-500' : 'text-slate-400'} text-xs"></i>
          <span>Stars</span>
        </button>

        <button id="puzzleSoundBtn" onclick="togglePuzzleSound()" class="flex-1 min-w-[58px] py-2 px-1.5 rounded-xl border ${
          puzzleSoundEnabled ? 'border-pink-200 bg-pink-50 text-pink-700' : 'border-slate-200 bg-white text-slate-400'
        } font-bold text-xs flex items-center justify-center gap-1 transition" title="Sound effects">
          <i class="fa-solid ${puzzleSoundEnabled ? 'fa-music text-pink-500' : 'fa-volume-xmark text-slate-400'} text-xs"></i>
          <span>${puzzleSoundEnabled ? 'Sound' : 'Muted'}</span>
        </button>

        <button id="puzzleNumberHintBtn" onclick="togglePuzzleNumbersHint()" class="flex-1 min-w-[58px] py-2 px-1.5 rounded-xl border ${
          puzzleShowNumbers
            ? ((activePuzzle && activePuzzle.isAlphabet) || puzzleLetterMode ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-pink-300 bg-pink-50 text-pink-700')
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
        } font-bold text-xs flex items-center justify-center gap-1 transition">
          <i class="fa-solid ${(activePuzzle && activePuzzle.isAlphabet) || puzzleLetterMode ? 'fa-font' : 'fa-list-ol'} ${
            puzzleShowNumbers ? ((activePuzzle && activePuzzle.isAlphabet) || puzzleLetterMode ? 'text-amber-500' : 'text-pink-500') : 'text-slate-400'
          } text-xs"></i>
          <span>${(activePuzzle && activePuzzle.isAlphabet) || puzzleLetterMode ? 'Letters' : 'Numbers'}</span>
        </button>

        ${(activePuzzle && activePuzzle.isAlphabet) || puzzleLetterMode ? `
          <button id="puzzleSpeechToggleBtn" onclick="togglePuzzleSpeech()" class="flex-1 min-w-[52px] py-2 px-1.5 rounded-xl border ${
            puzzleSpeechEnabled ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-400'
          } font-bold text-xs flex items-center justify-center gap-1 transition" title="Voice pronunciation">
            <i class="fa-solid ${puzzleSpeechEnabled ? 'fa-volume-high text-amber-500' : 'fa-volume-xmark text-slate-400'} text-xs"></i>
            <span>Voice</span>
          </button>
        ` : ''}
      </div>

      <!-- Grid Size / Difficulty Quick Selector -->
      <div class="bg-white/80 border border-slate-200/80 rounded-2xl p-2.5 flex items-center justify-between gap-2">
        <span class="text-xs font-bold text-slate-600 flex items-center gap-1.5">
          <i class="fa-solid fa-sliders text-pink-500 text-xs"></i>
          Grid Difficulty:
        </span>
        <div class="flex items-center gap-1.5">
          ${[2, 3, 4, 5, 6].map(g => `
            <button onclick="changeGameDifficulty(${g})" class="px-2.5 py-1 rounded-lg text-xs font-bold transition ${
              N === g
                ? 'bg-pink-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }" title="${g === 2 ? '2x2 Junior Starter (Ages 4-5)' : `${g}x${g} grid`}">
              ${g}&times;${g}${g === 2 ? ' ⭐' : ''}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Floating Reference Image Modal ("Peek") & Victory Modal (common to both views)
  container.innerHTML += `
    <!-- Floating Reference Image Modal ("Peek") -->
    <div id="puzzlePeekOverlay" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4" onclick="togglePuzzlePeekModal()">
      <div class="bg-white rounded-3xl p-4 max-w-xs w-full shadow-2xl space-y-3" onclick="event.stopPropagation()">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <i class="fa-solid fa-image text-pink-500"></i>
            Original Picture
          </h4>
          <button onclick="togglePuzzlePeekModal()" class="w-6 h-6 rounded-lg text-slate-400 hover:bg-slate-100 flex items-center justify-center">
            <i class="fa-solid fa-xmark text-xs"></i>
          </button>
        </div>

        <div class="w-full aspect-square rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
          <img src="${imgSrc}" alt="${activePuzzle.name}" class="w-full h-full object-cover select-none" />
        </div>

        <p class="text-[10px] text-center text-slate-400">Match the scrambled tiles to look like this!</p>
        <button onclick="togglePuzzlePeekModal()" class="w-full py-2 bg-pink-600 text-white text-xs font-bold rounded-xl hover:bg-pink-700 transition">
          Got it!
        </button>
      </div>
    </div>

    <!-- Victory Celebration Overlay Modal -->
    <div id="puzzleVictoryModal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4">
      <div class="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4 transform animate-bounce-short">
        <!-- Confetti & Star Header -->
        <div class="relative w-20 h-20 mx-auto">
          <div class="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 text-3xl animate-pulse">
            ⭐
          </div>
          <span class="absolute -top-1 -right-1 text-2xl animate-bounce">🎉</span>
          <span class="absolute -bottom-1 -left-1 text-2xl animate-bounce">✨</span>
        </div>

        <div>
          <h3 class="text-xl font-black text-slate-800">You Did It, Superstar!</h3>
          <p class="text-xs text-pink-600 font-bold mt-1">Puzzle Solved Successfully!</p>
        </div>

        <!-- Solved Picture Preview -->
        <div class="w-28 h-28 mx-auto rounded-2xl overflow-hidden border-2 border-emerald-400 shadow-md">
          <img src="${imgSrc}" class="w-full h-full object-cover" />
        </div>

        <!-- Scores Breakdown -->
        <div class="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-left">
          <div>
            <p class="text-[10px] text-slate-400 font-bold uppercase">Moves Taken</p>
            <p class="text-sm font-black text-slate-800" id="victoryMovesCount">0</p>
          </div>
          <div>
            <p class="text-[10px] text-slate-400 font-bold uppercase">Time Elapsed</p>
            <p class="text-sm font-black text-slate-800" id="victoryTimeCount">0:00</p>
          </div>
        </div>

        <div id="victoryBadgeArea"></div>

        <!-- Action Buttons -->
        <div class="space-y-2 pt-2">
          <button onclick="shufflePuzzleGame(); _hideVictoryModal()" class="w-full py-3 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 text-white font-extrabold text-xs shadow-md shadow-pink-500/25 active:scale-98 transition flex items-center justify-center gap-2">
            <i class="fa-solid fa-rotate-right text-xs"></i>
            <span>Play Again</span>
          </button>

          <button onclick="_hideVictoryModal(); openSlidingPuzzleCategory()" class="w-full py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition">
            Choose Another Puzzle
          </button>
        </div>
      </div>
    </div>
  `;

  _renderBoardTiles();
  _initBoardSwipeGestures();
  _attachPuzzleKeyboardListener();
}

function _showVictoryCelebration(statsResult) {
  const modal = document.getElementById('puzzleVictoryModal');
  if (!modal) return;

  const movesEl = document.getElementById('victoryMovesCount');
  const timeEl = document.getElementById('victoryTimeCount');
  const badgeArea = document.getElementById('victoryBadgeArea');

  if (movesEl) movesEl.textContent = `${puzzleMoves} moves`;
  if (timeEl) {
    const mins = Math.floor(puzzleSeconds / 60);
    const secs = puzzleSeconds % 60;
    timeEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  if (activePuzzle && activePuzzle.isAlphabet) {
    speakTileLetter('Hooray! You solved the A to Z Alphabet puzzle! Fantastic job!');
  }

  if (badgeArea) {
    if (statsResult && (statsResult.isNewBestMoves || statsResult.isNewBestTime)) {
      badgeArea.innerHTML = `
        <div class="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold flex items-center justify-center gap-1.5 animate-pulse">
          <i class="fa-solid fa-crown text-amber-500"></i>
          <span>New Personal Best Record!</span>
        </div>
      `;
    } else {
      badgeArea.innerHTML = `
        <div class="flex items-center justify-center gap-2 text-amber-400 text-lg">
          <i class="fa-solid fa-star"></i>
          <i class="fa-solid fa-star"></i>
          <i class="fa-solid fa-star"></i>
        </div>
      `;
    }
  }

  modal.classList.remove('hidden');
}

function _hideVictoryModal() {
  const modal = document.getElementById('puzzleVictoryModal');
  if (modal) modal.classList.add('hidden');
}
