// --- Expandable Game Catalogue & Games Module --------------------------------
// Central architecture for registering, displaying, and managing game modules.
// Designed so future games (like Ludo, Memory Match, Tic-Tac-Toe) can be added
// simply by registering their definition without rewriting navigation or core logic.

let gamesSubView = 'catalogue'; // 'catalogue' | 'sliding_puzzle' | 'sliding_puzzle_play'
let activeGameFilter = 'all'; // 'all' | 'available' | 'coming_soon'

const GAME_CATALOGUE = [
  {
    id: 'sliding-puzzle',
    title: 'Sliding Puzzle',
    description: 'Arrange scrambled picture tiles to recreate beautiful pictures and custom photos!',
    icon: 'fa-puzzle-piece',
    iconColor: 'text-pink-500',
    iconBg: 'bg-pink-500/10',
    bgGradient: 'from-pink-500/10 via-rose-500/5 to-amber-500/10',
    badgeText: 'Playable Now',
    badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    category: 'Picture Puzzle',
    status: 'available', // 'available' | 'coming_soon'
    ageRange: 'Ages 4+',
    tags: ['Custom Photos', 'Brain Teaser', 'Child-Friendly'],
    onLaunch: () => openSlidingPuzzleCategory()
  },
  {
    id: 'memory-match',
    title: 'Memory Match',
    description: 'Flip cute cards and match delightful pairs of animals, fruits, and cheerful shapes.',
    icon: 'fa-clone',
    iconColor: 'text-amber-500',
    iconBg: 'bg-amber-500/10',
    bgGradient: 'from-amber-500/10 via-orange-500/5 to-yellow-500/10',
    badgeText: 'Coming Soon',
    badgeColor: 'bg-slate-100 text-slate-500 border-slate-200',
    category: 'Memory Game',
    status: 'coming_soon',
    ageRange: 'Ages 3+',
    tags: ['Memory', 'Cute Animals', 'Quick Match'],
    upcomingFeatures: 'Animal card decks, sound effects, and gentle timer!'
  },
  {
    id: 'tic-tac-toe',
    title: 'Tic-Tac-Toe Stars',
    description: 'Connect 3 stars or hearts in a row against a friendly computer buddy or family member.',
    icon: 'fa-shapes',
    iconColor: 'text-emerald-500',
    iconBg: 'bg-emerald-500/10',
    bgGradient: 'from-emerald-500/10 via-teal-500/5 to-cyan-500/10',
    badgeText: 'Coming Soon',
    badgeColor: 'bg-slate-100 text-slate-500 border-slate-200',
    category: 'Classic Strategy',
    status: 'coming_soon',
    ageRange: 'Ages 4+',
    tags: ['2 Players', 'Star Power', 'Quick Fun'],
    upcomingFeatures: 'Play against friendly bot or pass-and-play with a friend!'
  },
  {
    id: 'ludo',
    title: 'Ludo Express',
    description: 'Roll the lucky dice, race colorful tokens, and celebrate reaching home safely!',
    icon: 'fa-dice',
    iconColor: 'text-indigo-500',
    iconBg: 'bg-indigo-500/10',
    bgGradient: 'from-indigo-500/10 via-purple-500/5 to-pink-500/10',
    badgeText: 'Coming Soon',
    badgeColor: 'bg-slate-100 text-slate-500 border-slate-200',
    category: 'Board Game',
    status: 'coming_soon',
    ageRange: 'Ages 5+',
    tags: ['Multiplayer', 'Family Fun', 'Dice Roll'],
    upcomingFeatures: 'Simplified child-friendly board, fun token animations, and family turn-taking!'
  }
];

// Catalogue API for future module expansion
function registerGame(definition) {
  if (!definition || !definition.id) return;
  const existingIdx = GAME_CATALOGUE.findIndex(g => g.id === definition.id);
  if (existingIdx >= 0) {
    GAME_CATALOGUE[existingIdx] = definition;
  } else {
    GAME_CATALOGUE.push(definition);
  }
}

function getGameById(id) {
  return GAME_CATALOGUE.find(g => g.id === id) || null;
}

function getAllGames() {
  return GAME_CATALOGUE;
}

// Router dispatcher for the Games tab
function renderGamesPage(container) {
  if (!container) container = document.getElementById('mainContainer');
  if (!container) return;

  if (gamesSubView === 'catalogue') {
    setAppHeaderCrumb(TAB_DISPLAY_NAMES.games || 'Games');
    renderGamesList(container);
  } else if (gamesSubView === 'sliding_puzzle') {
    setAppHeaderCrumb('Games / Sliding Puzzle');
    if (typeof renderSlidingPuzzleCategory === 'function') {
      renderSlidingPuzzleCategory(container);
    }
  } else if (gamesSubView === 'sliding_puzzle_play') {
    setAppHeaderCrumb('Games / Playing Puzzle');
    if (typeof renderSlidingPuzzleGameBoard === 'function') {
      renderSlidingPuzzleGameBoard(container);
    }
  }
}

// Navigates back to the main Games List
function openGamesList() {
  if (typeof _slidingPuzzleCleanupGame === 'function') {
    _slidingPuzzleCleanupGame();
  }
  gamesSubView = 'catalogue';
  renderGamesPage(document.getElementById('mainContainer'));
}

// Game launch handler
async function launchGame(id) {
  const game = getGameById(id);
  if (!game) return;

  if (game.status === 'available') {
    if (typeof game.onLaunch === 'function') {
      game.onLaunch();
    }
  } else {
    showComingSoonInfo(id);
  }
}

// Information dialog for upcoming games
async function showComingSoonInfo(id) {
  const game = getGameById(id);
  if (!game) return;

  const msg = `${game.title} is currently in development!\n\n${game.description}\n\n✨ Planned Highlights:\n${game.upcomingFeatures || 'Engaging child-friendly gameplay coming in the next update!'}`;

  if (typeof showAlert === 'function') {
    await showAlert(msg, {
      title: `${game.title} (Coming Soon)`,
      tone: 'info',
      okLabel: 'Can\'t Wait!'
    });
  } else {
    alert(msg);
  }
}

// Filter games list
function setGamesFilter(filter) {
  activeGameFilter = filter;
  renderGamesPage(document.getElementById('mainContainer'));
}

// Cleanup callback when leaving games tab
function cleanupGamesModule() {
  if (typeof _slidingPuzzleCleanupGame === 'function') {
    _slidingPuzzleCleanupGame();
  }
}

// Main Games Catalogue View
function renderGamesList(container) {
  const filtered = GAME_CATALOGUE.filter(g => {
    if (activeGameFilter === 'available') return g.status === 'available';
    if (activeGameFilter === 'coming_soon') return g.status === 'coming_soon';
    return true;
  });

  const availableCount = GAME_CATALOGUE.filter(g => g.status === 'available').length;
  const comingSoonCount = GAME_CATALOGUE.filter(g => g.status === 'coming_soon').length;

  container.innerHTML = `
    <!-- Child-Friendly Friendly Header Banner -->
    <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-pink-500/20 via-purple-500/15 to-indigo-500/20 p-5 border border-pink-100 shadow-sm">
      <div class="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-pink-300/30 blur-2xl pointer-events-none"></div>
      <div class="absolute -left-6 -top-6 w-28 h-28 rounded-full bg-purple-300/30 blur-2xl pointer-events-none"></div>

      <div class="relative flex items-center justify-between gap-3">
        <div class="space-y-1">
          <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/80 border border-pink-200 text-[10px] font-bold text-pink-700 shadow-xs">
            <span class="animate-bounce">🎮</span>
            <span>Kids Fun Zone</span>
          </div>
          <h2 class="text-lg font-black tracking-tight text-slate-800">Games & Puzzles</h2>
          <p class="text-xs text-slate-500 leading-snug">Child-friendly, colorful games designed for fun and learning!</p>
        </div>
        <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-400 text-white flex items-center justify-center shadow-lg shadow-pink-500/30 shrink-0 transform rotate-3">
          <i class="fa-solid fa-gamepad text-2xl"></i>
        </div>
      </div>
    </div>

    <!-- Category Filter Chips -->
    <div class="flex items-center gap-2 overflow-x-auto hide-scrollbar py-1">
      <button onclick="setGamesFilter('all')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
        activeGameFilter === 'all'
          ? 'bg-slate-800 text-white shadow-sm'
          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
      }">
        All Games (${GAME_CATALOGUE.length})
      </button>
      <button onclick="setGamesFilter('available')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
        activeGameFilter === 'available'
          ? 'bg-emerald-600 text-white shadow-sm'
          : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
      }">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        Playable (${availableCount})
      </button>
      <button onclick="setGamesFilter('coming_soon')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
        activeGameFilter === 'coming_soon'
          ? 'bg-indigo-600 text-white shadow-sm'
          : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
      }">
        Upcoming (${comingSoonCount})
      </button>
    </div>

    <!-- Game Cards Grid -->
    <div class="grid grid-cols-1 gap-4">
      ${filtered.map(game => {
        const isPlayable = game.status === 'available';
        return `
          <div class="group relative rounded-2xl border ${
            isPlayable ? 'border-pink-200/80 hover:border-pink-400 bg-white shadow-sm hover:shadow-md' : 'border-slate-200/80 bg-slate-50/70'
          } p-4 transition-all duration-200">
            <div class="flex items-start gap-3.5">
              <!-- Game Icon Box -->
              <div class="w-14 h-14 rounded-2xl bg-gradient-to-br ${game.bgGradient} flex items-center justify-center shrink-0 border border-slate-100 ${
                isPlayable ? 'shadow-sm group-hover:scale-105 transition-transform' : 'opacity-85'
              }">
                <i class="fa-solid ${game.icon} text-2xl ${game.iconColor}"></i>
              </div>

              <!-- Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-2 mb-1">
                  <h3 class="text-sm font-bold text-slate-800 truncate">${game.title}</h3>
                  <span class="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${game.badgeColor}">
                    ${game.badgeText}
                  </span>
                </div>

                <p class="text-xs text-slate-500 leading-relaxed mb-2.5 line-clamp-2">${game.description}</p>

                <!-- Tags & Meta -->
                <div class="flex flex-wrap items-center gap-1.5 mb-3">
                  <span class="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                    <i class="fa-solid fa-child mr-1 text-[9px]"></i>${game.ageRange}
                  </span>
                  <span class="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                    ${game.category}
                  </span>
                  ${(game.tags || []).slice(0, 2).map(tag => `
                    <span class="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100/70 text-slate-500">
                      #${tag}
                    </span>
                  `).join('')}
                </div>

                <!-- Action Button -->
                ${isPlayable ? `
                  <button onclick="launchGame('${game.id}')" class="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 hover:from-pink-600 hover:to-rose-600 text-white font-bold text-xs shadow-md shadow-pink-500/25 flex items-center justify-center gap-2 active:scale-98 transition">
                    <i class="fa-solid fa-play text-xs"></i>
                    <span>Play ${game.title}</span>
                    <i class="fa-solid fa-arrow-right text-[10px] opacity-75 ml-1"></i>
                  </button>
                ` : `
                  <button onclick="showComingSoonInfo('${game.id}')" class="w-full py-2 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold text-xs flex items-center justify-center gap-2 transition">
                    <i class="fa-solid fa-lock text-[11px] text-slate-400"></i>
                    <span>In Development &bull; Preview</span>
                  </button>
                `}
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <!-- Extensible Note for User/Parent -->
    <div class="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-3.5 text-center">
      <p class="text-[11px] text-slate-400">
        <i class="fa-solid fa-wand-magic-sparkles text-pink-400 mr-1"></i>
        More child-friendly games and interactive boards will be added right here!
      </p>
    </div>
  `;
}
