// ==============================================================================
// Memory Match - Delightful Card Pair Matching Game
// ==============================================================================
// Complete child-friendly & family-friendly memory match game for Life Tracker PWA.
// Features:
// - 5 Charming Themes: Cute Animals 🐶, Yummy Fruits 🍓, Cosmic Space 🚀, Vehicles 🚗, Sweet Candies 🍭
// - 5 Difficulty Grid Sizes: Starter (2x3), Easy (3x4), Classic (4x4), Hard (4x5), Master (4x6)
// - CSS 3D card-flip animations with tactile mismatch shakes and match pop bounces
// - Web Audio API synthesized playful sound effects (100% offline, zero assets)
// - Gentle timer, move counter, and 3-Star achievement rating
// - Magic Peek hint button (flashes cards face-up for a brief moment with fairy chime)
// - LocalStorage record tracking (Best Moves & Best Time per difficulty/theme)
// - Victory celebration modal with star rating and celebration animations
// - Full cleanup and lifecycle management
// ==============================================================================

(function () {
  'use strict';

  // --- Decks & Themes ---
  const THEMES = {
    animals: {
      id: 'animals',
      name: 'Cute Animals',
      icon: '🐶',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      cardBackGrad: 'from-amber-400 via-orange-400 to-amber-500',
      items: [
        { id: 'dog', name: 'Puppy', emoji: '🐶', bg: 'bg-amber-50 text-amber-900 border-amber-200' },
        { id: 'cat', name: 'Kitten', emoji: '🐱', bg: 'bg-rose-50 text-rose-900 border-rose-200' },
        { id: 'panda', name: 'Panda', emoji: '🐼', bg: 'bg-emerald-50 text-emerald-900 border-emerald-200' },
        { id: 'lion', name: 'Lion', emoji: '🦁', bg: 'bg-yellow-50 text-yellow-900 border-yellow-200' },
        { id: 'elephant', name: 'Elephant', emoji: '🐘', bg: 'bg-sky-50 text-sky-900 border-sky-200' },
        { id: 'monkey', name: 'Monkey', emoji: '🐵', bg: 'bg-orange-50 text-orange-900 border-orange-200' },
        { id: 'bunny', name: 'Bunny', emoji: '🐰', bg: 'bg-pink-50 text-pink-900 border-pink-200' },
        { id: 'fox', name: 'Fox', emoji: '🦊', bg: 'bg-orange-50 text-orange-900 border-orange-200' },
        { id: 'penguin', name: 'Penguin', emoji: '🐧', bg: 'bg-cyan-50 text-cyan-900 border-cyan-200' },
        { id: 'bear', name: 'Bear', emoji: '🐻', bg: 'bg-amber-50 text-amber-900 border-amber-200' },
        { id: 'unicorn', name: 'Unicorn', emoji: '🦄', bg: 'bg-purple-50 text-purple-900 border-purple-200' },
        { id: 'frog', name: 'Froggy', emoji: '🐸', bg: 'bg-lime-50 text-lime-900 border-lime-200' }
      ]
    },
    fruits: {
      id: 'fruits',
      name: 'Yummy Fruits',
      icon: '🍓',
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
      cardBackGrad: 'from-rose-400 via-pink-400 to-rose-500',
      items: [
        { id: 'strawberry', name: 'Strawberry', emoji: '🍓', bg: 'bg-rose-50 text-rose-900 border-rose-200' },
        { id: 'watermelon', name: 'Watermelon', emoji: '🍉', bg: 'bg-red-50 text-red-900 border-red-200' },
        { id: 'banana', name: 'Banana', emoji: '🍌', bg: 'bg-yellow-50 text-yellow-900 border-yellow-200' },
        { id: 'apple', name: 'Apple', emoji: '🍎', bg: 'bg-rose-50 text-rose-900 border-rose-200' },
        { id: 'grape', name: 'Grapes', emoji: '🍇', bg: 'bg-purple-50 text-purple-900 border-purple-200' },
        { id: 'pineapple', name: 'Pineapple', emoji: '🍍', bg: 'bg-amber-50 text-amber-900 border-amber-200' },
        { id: 'cherry', name: 'Cherries', emoji: '🍒', bg: 'bg-red-50 text-red-900 border-red-200' },
        { id: 'avocado', name: 'Avocado', emoji: '🥑', bg: 'bg-emerald-50 text-emerald-900 border-emerald-200' },
        { id: 'peach', name: 'Peach', emoji: '🍑', bg: 'bg-orange-50 text-orange-900 border-orange-200' },
        { id: 'kiwi', name: 'Kiwi', emoji: '🥝', bg: 'bg-lime-50 text-lime-900 border-lime-200' },
        { id: 'orange', name: 'Orange', emoji: '🍊', bg: 'bg-orange-50 text-orange-900 border-orange-200' },
        { id: 'lemon', name: 'Lemon', emoji: '🍋', bg: 'bg-yellow-50 text-yellow-900 border-yellow-200' }
      ]
    },
    space: {
      id: 'space',
      name: 'Cosmic Space',
      icon: '🚀',
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      cardBackGrad: 'from-indigo-500 via-purple-500 to-indigo-600',
      items: [
        { id: 'rocket', name: 'Rocket', emoji: '🚀', bg: 'bg-indigo-50 text-indigo-900 border-indigo-200' },
        { id: 'astronaut', name: 'Astronaut', emoji: '👨‍🚀', bg: 'bg-blue-50 text-blue-900 border-blue-200' },
        { id: 'planet', name: 'Saturn', emoji: '🪐', bg: 'bg-purple-50 text-purple-900 border-purple-200' },
        { id: 'ufo', name: 'Flying UFO', emoji: '🛸', bg: 'bg-teal-50 text-teal-900 border-teal-200' },
        { id: 'alien', name: 'Alien Buddy', emoji: '👽', bg: 'bg-emerald-50 text-emerald-900 border-emerald-200' },
        { id: 'star', name: 'Golden Star', emoji: '🌟', bg: 'bg-yellow-50 text-yellow-900 border-yellow-200' },
        { id: 'comet', name: 'Comet', emoji: '☄️', bg: 'bg-cyan-50 text-cyan-900 border-cyan-200' },
        { id: 'telescope', name: 'Telescope', emoji: '🔭', bg: 'bg-slate-50 text-slate-900 border-slate-200' },
        { id: 'moon', name: 'Full Moon', emoji: '🌕', bg: 'bg-amber-50 text-amber-900 border-amber-200' },
        { id: 'sun', name: 'Bright Sun', emoji: '☀️', bg: 'bg-yellow-50 text-yellow-900 border-yellow-200' },
        { id: 'satellite', name: 'Satellite', emoji: '🛰️', bg: 'bg-sky-50 text-sky-900 border-sky-200' },
        { id: 'bolt', name: 'Cosmic Bolt', emoji: '⚡', bg: 'bg-amber-50 text-amber-900 border-amber-200' }
      ]
    },
    vehicles: {
      id: 'vehicles',
      name: 'Vehicles',
      icon: '🚗',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      cardBackGrad: 'from-blue-500 via-cyan-500 to-blue-600',
      items: [
        { id: 'car', name: 'Race Car', emoji: '🏎️', bg: 'bg-red-50 text-red-900 border-red-200' },
        { id: 'fire', name: 'Fire Truck', emoji: '🚒', bg: 'bg-rose-50 text-rose-900 border-rose-200' },
        { id: 'police', name: 'Police Car', emoji: '🚓', bg: 'bg-blue-50 text-blue-900 border-blue-200' },
        { id: 'plane', name: 'Airplane', emoji: '✈️', bg: 'bg-sky-50 text-sky-900 border-sky-200' },
        { id: 'helicopter', name: 'Helicopter', emoji: '🚁', bg: 'bg-teal-50 text-teal-900 border-teal-200' },
        { id: 'train', name: 'Train', emoji: '🚂', bg: 'bg-amber-50 text-amber-900 border-amber-200' },
        { id: 'boat', name: 'Sailboat', emoji: '⛵', bg: 'bg-cyan-50 text-cyan-900 border-cyan-200' },
        { id: 'tractor', name: 'Tractor', emoji: '🚜', bg: 'bg-lime-50 text-lime-900 border-lime-200' },
        { id: 'bus', name: 'School Bus', emoji: '🚌', bg: 'bg-yellow-50 text-yellow-900 border-yellow-200' },
        { id: 'bicycle', name: 'Bicycle', emoji: '🚲', bg: 'bg-emerald-50 text-emerald-900 border-emerald-200' },
        { id: 'motorcycle', name: 'Motorbike', emoji: '🏍️', bg: 'bg-slate-50 text-slate-900 border-slate-200' },
        { id: 'ambulance', name: 'Ambulance', emoji: '🚑', bg: 'bg-orange-50 text-orange-900 border-orange-200' }
      ]
    },
    candies: {
      id: 'candies',
      name: 'Sweet Treats',
      icon: '🍭',
      badgeColor: 'bg-pink-100 text-pink-800 border-pink-200',
      cardBackGrad: 'from-pink-400 via-rose-400 to-purple-400',
      items: [
        { id: 'lollipop', name: 'Lollipop', emoji: '🍭', bg: 'bg-pink-50 text-pink-900 border-pink-200' },
        { id: 'icecream', name: 'Ice Cream', emoji: '🍦', bg: 'bg-amber-50 text-amber-900 border-amber-200' },
        { id: 'cupcake', name: 'Cupcake', emoji: '🧁', bg: 'bg-purple-50 text-purple-900 border-purple-200' },
        { id: 'donut', name: 'Donut', emoji: '🍩', bg: 'bg-orange-50 text-orange-900 border-orange-200' },
        { id: 'candy', name: 'Candy', emoji: '🍬', bg: 'bg-rose-50 text-rose-900 border-rose-200' },
        { id: 'cake', name: 'Birthday Cake', emoji: '🎂', bg: 'bg-yellow-50 text-yellow-900 border-yellow-200' },
        { id: 'cookie', name: 'Cookie', emoji: '🍪', bg: 'bg-amber-50 text-amber-900 border-amber-200' },
        { id: 'chocolate', name: 'Chocolate', emoji: '🍫', bg: 'bg-stone-50 text-stone-900 border-stone-200' },
        { id: 'popcorn', name: 'Popcorn', emoji: '🍿', bg: 'bg-red-50 text-red-900 border-red-200' },
        { id: 'pudding', name: 'Pudding', emoji: '🍮', bg: 'bg-yellow-50 text-yellow-900 border-yellow-200' },
        { id: 'waffle', name: 'Waffle', emoji: '🧇', bg: 'bg-amber-50 text-amber-900 border-amber-200' },
        { id: 'honey', name: 'Honey Pot', emoji: '🍯', bg: 'bg-yellow-50 text-yellow-900 border-yellow-200' }
      ]
    }
  };

  // --- Grid Difficulties ---
  const DIFFICULTIES = [
    { id: 'starter', label: 'Starter', pairs: 3, cols: 3, ageTag: 'Ages 3-4', icon: '⭐' },
    { id: 'easy', label: 'Easy', pairs: 6, cols: 3, ageTag: 'Ages 4-5', icon: '⭐⭐' },
    { id: 'classic', label: 'Classic', pairs: 8, cols: 4, ageTag: 'Ages 5+', icon: '⭐⭐⭐' },
    { id: 'hard', label: 'Hard', pairs: 10, cols: 4, ageTag: 'Family', icon: '🔥' },
    { id: 'expert', label: 'Expert', pairs: 12, cols: 4, ageTag: 'Master', icon: '👑' }
  ];

  // Storage Keys
  const STORAGE_THEME = 'memory_match_theme';
  const STORAGE_DIFF = 'memory_match_diff';
  const STORAGE_SOUND = 'memory_match_sound_enabled';

  // --- Web Audio Synthesizer (Cute 100% Offline Chimes) ---
  const Sound = (() => {
    let ctx = null;
    let enabled = localStorage.getItem(STORAGE_SOUND) !== 'false';

    function getCtx() {
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
      isEnabled: () => enabled,
      toggle: () => {
        enabled = !enabled;
        localStorage.setItem(STORAGE_SOUND, enabled ? 'true' : 'false');
        return enabled;
      },
      playFlip() {
        if (!enabled) return;
        try {
          const c = getCtx();
          if (!c) return;
          const osc = c.createOscillator();
          const gain = c.createGain();
          const now = c.currentTime;

          osc.type = 'sine';
          osc.frequency.setValueAtTime(380, now);
          osc.frequency.exponentialRampToValueAtTime(620, now + 0.08);

          gain.gain.setValueAtTime(0.12, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

          osc.connect(gain);
          gain.connect(c.destination);
          osc.start(now);
          osc.stop(now + 0.08);
        } catch (_) {}
      },
      playMatch() {
        if (!enabled) return;
        try {
          const c = getCtx();
          if (!c) return;
          const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (Joyful arpeggio)
          notes.forEach((freq, i) => {
            const osc = c.createOscillator();
            const gain = c.createGain();
            const t = c.currentTime + i * 0.055;

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t);

            gain.gain.setValueAtTime(0.16, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

            osc.connect(gain);
            gain.connect(c.destination);
            osc.start(t);
            osc.stop(t + 0.15);
          });
        } catch (_) {}
      },
      playMismatch() {
        if (!enabled) return;
        try {
          const c = getCtx();
          if (!c) return;
          const now = c.currentTime;
          const osc = c.createOscillator();
          const gain = c.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(260, now);
          osc.frequency.exponentialRampToValueAtTime(190, now + 0.14);

          gain.gain.setValueAtTime(0.12, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

          osc.connect(gain);
          gain.connect(c.destination);
          osc.start(now);
          osc.stop(now + 0.14);
        } catch (_) {}
      },
      playPeek() {
        if (!enabled) return;
        try {
          const c = getCtx();
          if (!c) return;
          const notes = [659.25, 830.61, 987.77, 1318.51]; // E5, G#5, B5, E6
          notes.forEach((freq, i) => {
            const osc = c.createOscillator();
            const gain = c.createGain();
            const t = c.currentTime + i * 0.04;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t);

            gain.gain.setValueAtTime(0.12, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

            osc.connect(gain);
            gain.connect(c.destination);
            osc.start(t);
            osc.stop(t + 0.12);
          });
        } catch (_) {}
      },
      playVictory() {
        if (!enabled) return;
        try {
          const c = getCtx();
          if (!c) return;
          const chords = [
            [523.25, 659.25, 783.99], // C major
            [587.33, 739.99, 880.00], // D major
            [659.25, 830.61, 987.77], // E major
            [1046.50, 1318.51, 1567.98] // High C fanfare
          ];
          chords.forEach((chord, step) => {
            chord.forEach(freq => {
              const osc = c.createOscillator();
              const gain = c.createGain();
              const t = c.currentTime + step * 0.14;

              osc.type = 'triangle';
              osc.frequency.setValueAtTime(freq, t);

              gain.gain.setValueAtTime(0.14, t);
              gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

              osc.connect(gain);
              gain.connect(c.destination);
              osc.start(t);
              osc.stop(t + 0.28);
            });
          });
        } catch (_) {}
      },
      playClick() {
        if (!enabled) return;
        try {
          const c = getCtx();
          if (!c) return;
          const now = c.currentTime;
          const osc = c.createOscillator();
          const gain = c.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, now);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

          osc.connect(gain);
          gain.connect(c.destination);
          osc.start(now);
          osc.stop(now + 0.04);
        } catch (_) {}
      }
    };
  })();

  // --- Game State Variables ---
  let selectedTheme = localStorage.getItem(STORAGE_THEME) || 'animals';
  if (!THEMES[selectedTheme]) selectedTheme = 'animals';

  let selectedDifficulty = localStorage.getItem(STORAGE_DIFF) || 'classic';
  if (!DIFFICULTIES.find(d => d.id === selectedDifficulty)) selectedDifficulty = 'classic';

  let cards = [];
  let flippedIndices = [];
  let isLocked = false;
  let matchesCount = 0;
  let movesCount = 0;
  let secondsElapsed = 0;
  let timerInterval = null;
  let timerStarted = false;
  let peeksLeft = 3;
  let isPeeking = false;

  // --- Helper Functions ---
  function getDiffConfig() {
    return DIFFICULTIES.find(d => d.id === selectedDifficulty) || DIFFICULTIES[2];
  }

  function getThemeConfig() {
    return THEMES[selectedTheme] || THEMES.animals;
  }

  function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function calculateStarRating(moves, pairs) {
    const perfectMoves = pairs;
    if (moves <= perfectMoves + 2) return 3;
    if (moves <= perfectMoves * 1.7) return 2;
    return 1;
  }

  // Best score storage
  function getBestRecordKey() {
    return `memory_match_best_${selectedTheme}_${selectedDifficulty}`;
  }

  function getBestRecord() {
    try {
      const saved = localStorage.getItem(getBestRecordKey());
      return saved ? JSON.parse(saved) : null;
    } catch (_) {
      return null;
    }
  }

  function saveBestRecordIfBetter(moves, timeSeconds, stars) {
    const current = getBestRecord();
    let isNewBest = false;
    if (!current || moves < current.moves || (moves === current.moves && timeSeconds < current.timeSeconds)) {
      isNewBest = true;
      localStorage.setItem(getBestRecordKey(), JSON.stringify({ moves, timeSeconds, stars, date: new Date().toISOString() }));
    }
    return isNewBest;
  }

  // --- Timer Operations ---
  function startTimerIfNeeded() {
    if (!timerStarted) {
      timerStarted = true;
      timerInterval = setInterval(() => {
        secondsElapsed++;
        const timerEl = document.getElementById('memoryTimerDisplay');
        if (timerEl) timerEl.innerText = formatTime(secondsElapsed);
      }, 1000);
    }
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  // --- Deck Setup & Shuffle ---
  function setupDeck() {
    stopTimer();
    secondsElapsed = 0;
    timerStarted = false;
    movesCount = 0;
    matchesCount = 0;
    flippedIndices = [];
    isLocked = false;
    peeksLeft = 3;
    isPeeking = false;

    const theme = getThemeConfig();
    const diff = getDiffConfig();

    // Pick subset of items
    const shuffledItems = [...theme.items].sort(() => Math.random() - 0.5);
    const chosenItems = shuffledItems.slice(0, diff.pairs);

    // Duplicate each item to make pairs
    const deck = [];
    chosenItems.forEach((item, index) => {
      deck.push({
        pairId: index,
        name: item.name,
        emoji: item.emoji,
        bg: item.bg,
        isMatched: false,
        isFlipped: false
      });
      deck.push({
        pairId: index,
        name: item.name,
        emoji: item.emoji,
        bg: item.bg,
        isMatched: false,
        isFlipped: false
      });
    });

    // Shuffle deck
    cards = deck.sort(() => Math.random() - 0.5);
  }

  // --- Card Interaction ---
  function onCardClick(index) {
    if (isLocked || isPeeking) return;
    const card = cards[index];
    if (!card || card.isFlipped || card.isMatched) return;

    startTimerIfNeeded();
    Sound.playFlip();

    card.isFlipped = true;
    flippedIndices.push(index);
    updateCardElement(index);

    if (flippedIndices.length === 2) {
      movesCount++;
      updateHud();
      checkMatch();
    }
  }

  function checkMatch() {
    isLocked = true;
    const [idx1, idx2] = flippedIndices;
    const card1 = cards[idx1];
    const card2 = cards[idx2];

    if (card1.pairId === card2.pairId) {
      // MATCH!
      card1.isMatched = true;
      card2.isMatched = true;
      matchesCount++;

      setTimeout(() => {
        Sound.playMatch();
        triggerCardEffect(idx1, 'is-matched');
        triggerCardEffect(idx2, 'is-matched');

        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(20); } catch (_) {}
        }

        flippedIndices = [];
        isLocked = false;
        updateHud();

        const diff = getDiffConfig();
        if (matchesCount === diff.pairs) {
          triggerVictory();
        }
      }, 300);
    } else {
      // MISMATCH!
      setTimeout(() => {
        Sound.playMismatch();
        triggerCardEffect(idx1, 'is-shaking');
        triggerCardEffect(idx2, 'is-shaking');

        setTimeout(() => {
          card1.isFlipped = false;
          card2.isFlipped = false;
          updateCardElement(idx1);
          updateCardElement(idx2);
          flippedIndices = [];
          isLocked = false;
        }, 600);
      }, 450);
    }
  }

  function triggerCardEffect(index, effectClass) {
    const el = document.getElementById(`memoryCardInner_${index}`);
    if (el) {
      el.classList.add(effectClass);
      setTimeout(() => el.classList.remove(effectClass), 600);
    }
  }

  function updateCardElement(index) {
    const inner = document.getElementById(`memoryCardInner_${index}`);
    const card = cards[index];
    if (inner && card) {
      if (card.isFlipped || card.isMatched) {
        inner.classList.add('is-flipped');
      } else {
        inner.classList.remove('is-flipped');
      }
      if (card.isMatched) {
        inner.classList.add('opacity-85');
      }
    }
  }

  // --- Magic Peek Feature ---
  function triggerMagicPeek() {
    if (isPeeking || isLocked || peeksLeft <= 0) return;
    peeksLeft--;
    isPeeking = true;
    Sound.playPeek();
    startTimerIfNeeded();

    // Flash all unmatched cards face-up
    cards.forEach((card, idx) => {
      if (!card.isMatched) {
        const inner = document.getElementById(`memoryCardInner_${idx}`);
        if (inner) inner.classList.add('is-flipped');
      }
    });

    const peekBtn = document.getElementById('memoryPeekBtn');
    if (peekBtn) {
      peekBtn.disabled = true;
      peekBtn.classList.add('opacity-50');
      peekBtn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles text-amber-400"></i> Peeking...`;
    }

    setTimeout(() => {
      cards.forEach((card, idx) => {
        if (!card.isMatched && !flippedIndices.includes(idx)) {
          card.isFlipped = false;
          const inner = document.getElementById(`memoryCardInner_${idx}`);
          if (inner) inner.classList.remove('is-flipped');
        }
      });
      isPeeking = false;
      updateHud();
    }, 1200);
  }

  // --- Victory Handler ---
  function triggerVictory() {
    stopTimer();
    Sound.playVictory();

    const diff = getDiffConfig();
    const stars = calculateStarRating(movesCount, diff.pairs);
    const isNewBest = saveBestRecordIfBetter(movesCount, secondsElapsed, stars);

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([40, 60, 40, 100]); } catch (_) {}
    }

    // Populate Victory Modal
    const modal = document.getElementById('memoryVictoryModal');
    if (!modal) return;

    const starsEl = document.getElementById('memoryVictoryStars');
    const movesEl = document.getElementById('memoryVictoryMoves');
    const timeEl = document.getElementById('memoryVictoryTime');
    const badgeEl = document.getElementById('memoryVictoryBadge');

    if (starsEl) {
      let starsHtml = '';
      for (let i = 1; i <= 3; i++) {
        starsHtml += `<span class="text-3xl transform ${i <= stars ? 'text-amber-400 scale-110 drop-shadow-md' : 'text-slate-300 opacity-40'} transition">★</span>`;
      }
      starsEl.innerHTML = starsHtml;
    }

    if (movesEl) movesEl.innerText = movesCount;
    if (timeEl) timeEl.innerText = formatTime(secondsElapsed);
    if (badgeEl) {
      badgeEl.classList.toggle('hidden', !isNewBest);
    }

    modal.classList.remove('hidden');
  }

  function hideVictoryModal() {
    const modal = document.getElementById('memoryVictoryModal');
    if (modal) modal.classList.add('hidden');
  }

  // --- HUD Updates ---
  function updateHud() {
    const diff = getDiffConfig();
    const movesEl = document.getElementById('memoryMovesDisplay');
    const pairsEl = document.getElementById('memoryPairsDisplay');
    const peekBtn = document.getElementById('memoryPeekBtn');
    const soundBtn = document.getElementById('memorySoundToggleBtn');

    if (movesEl) movesEl.innerText = movesCount;
    if (pairsEl) pairsEl.innerText = `${matchesCount} / ${diff.pairs}`;

    if (peekBtn) {
      peekBtn.disabled = peeksLeft <= 0;
      peekBtn.classList.toggle('opacity-50', peeksLeft <= 0);
      peekBtn.innerHTML = `
        <i class="fa-solid fa-wand-magic-sparkles text-amber-500"></i>
        <span>Peek (${peeksLeft})</span>
      `;
    }

    if (soundBtn) {
      soundBtn.innerHTML = Sound.isEnabled()
        ? '<i class="fa-solid fa-volume-high text-amber-500"></i>'
        : '<i class="fa-solid fa-volume-xmark text-slate-400"></i>';
    }
  }

  // --- Theme & Difficulty Changes ---
  function changeTheme(themeId) {
    if (!THEMES[themeId]) return;
    selectedTheme = themeId;
    localStorage.setItem(STORAGE_THEME, themeId);
    Sound.playClick();
    restartGame();
  }

  function changeDifficulty(diffId) {
    if (!DIFFICULTIES.find(d => d.id === diffId)) return;
    selectedDifficulty = diffId;
    localStorage.setItem(STORAGE_DIFF, diffId);
    Sound.playClick();
    restartGame();
  }

  function restartGame() {
    Sound.playClick();
    hideVictoryModal();
    setupDeck();
    renderGameBoard();
    updateHud();
  }

  function toggleSound() {
    Sound.toggle();
    Sound.playClick();
    updateHud();
  }

  // --- Cleanup Function ---
  function cleanupMemoryMatchGame() {
    stopTimer();
    hideVictoryModal();
    flippedIndices = [];
    isLocked = false;
  }

  // --- DOM Rendering ---
  function renderGameBoard() {
    const gridContainer = document.getElementById('memoryCardsGrid');
    if (!gridContainer) return;

    const diff = getDiffConfig();
    const theme = getThemeConfig();

    // Dynamic grid columns based on difficulty
    const colClass = diff.cols === 3 ? 'grid-cols-3' : 'grid-cols-4';

    gridContainer.className = `w-full max-w-md mx-auto grid ${colClass} gap-2.5 sm:gap-3 p-1`;

    gridContainer.innerHTML = cards.map((card, idx) => `
      <div class="memory-card-scene aspect-[3/4] cursor-pointer" onclick="MemoryMatchAPI.onCardClick(${idx})">
        <div id="memoryCardInner_${idx}" class="memory-card-inner ${card.isFlipped ? 'is-flipped' : ''}">
          <!-- Card Back (Unflipped) -->
          <div class="memory-card-face memory-card-back rounded-2xl bg-gradient-to-tr ${theme.cardBackGrad} p-1.5 shadow-md flex flex-col items-center justify-center border-2 border-white/60 select-none group hover:scale-[1.02] active:scale-95 transition-transform">
            <div class="w-full h-full rounded-xl border border-white/30 flex items-center justify-center text-white/90">
              <span class="text-2xl sm:text-3xl transform drop-shadow-sm group-hover:rotate-12 transition-transform">${theme.icon}</span>
            </div>
          </div>

          <!-- Card Front (Revealed Face) -->
          <div class="memory-card-face memory-card-front rounded-2xl ${card.bg} p-1.5 shadow-md flex flex-col items-center justify-center border-2 border-slate-200 select-none">
            <span class="text-3xl sm:text-4xl mb-1 filter drop-shadow-sm">${card.emoji}</span>
            <span class="text-[10px] sm:text-[11px] font-black tracking-tight leading-tight text-center truncate w-full px-1">${card.name}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  function renderMemoryMatchGame(container) {
    if (!container) container = document.getElementById('mainContainer');
    if (!container) return;

    cleanupMemoryMatchGame();
    setupDeck();

    const theme = getThemeConfig();
    const diff = getDiffConfig();
    const bestRecord = getBestRecord();

    container.innerHTML = `
      <!-- Embedded CSS for 3D Flip & Tactile Animations -->
      <style>
        .memory-card-scene {
          perspective: 900px;
        }
        .memory-card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          text-align: center;
          transition: transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1);
          transform-style: preserve-3d;
        }
        .memory-card-inner.is-flipped {
          transform: rotateY(180deg);
        }
        .memory-card-face {
          position: absolute;
          width: 100%;
          height: 100%;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          border-radius: 1rem;
        }
        .memory-card-back {
          transform: rotateY(0deg);
        }
        .memory-card-front {
          transform: rotateY(180deg);
        }
        @keyframes memoryShake {
          0%, 100% { transform: rotateY(180deg) translateX(0); }
          20%, 60% { transform: rotateY(180deg) translateX(-6px); }
          40%, 80% { transform: rotateY(180deg) translateX(6px); }
        }
        .memory-card-inner.is-shaking {
          animation: memoryShake 0.45s ease-in-out;
        }
        @keyframes memoryMatchPop {
          0% { transform: rotateY(180deg) scale(1); }
          50% { transform: rotateY(180deg) scale(1.08); }
          100% { transform: rotateY(180deg) scale(1); }
        }
        .memory-card-inner.is-matched {
          animation: memoryMatchPop 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
      </style>

      <div class="max-w-md mx-auto flex flex-col items-center select-none pb-4">
        <!-- Top Navigation Bar -->
        <div class="w-full flex items-center justify-between mb-2.5 px-1">
          <button onclick="openGamesList()" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200/90 text-slate-700 text-xs font-bold shadow-xs hover:bg-slate-50 active:scale-95 transition">
            <i class="fa-solid fa-arrow-left text-[11px] text-slate-400"></i>
            <span>All Games</span>
          </button>

          <!-- Top Actions -->
          <div class="flex items-center gap-1.5">
            ${bestRecord ? `
              <div class="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-200 text-[11px] font-black text-amber-700 flex items-center gap-1.5 shadow-xs" title="Best moves on this board">
                <i class="fa-solid fa-trophy text-amber-500 text-[10px]"></i>
                <span>${bestRecord.moves} moves (${formatTime(bestRecord.timeSeconds)})</span>
              </div>
            ` : ''}

            <button id="memorySoundToggleBtn" onclick="MemoryMatchAPI.toggleSound()" class="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xs shadow-xs hover:bg-slate-50 active:scale-95 transition" title="Toggle Sound">
              ${Sound.isEnabled() ? '<i class="fa-solid fa-volume-high text-amber-500"></i>' : '<i class="fa-solid fa-volume-xmark text-slate-400"></i>'}
            </button>

            <button onclick="MemoryMatchAPI.restartGame()" class="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xs shadow-xs hover:bg-slate-50 active:scale-95 transition" title="Restart Round">
              <i class="fa-solid fa-rotate-right text-slate-400"></i>
            </button>
          </div>
        </div>

        <!-- Theme Selector Tabs -->
        <div class="w-full flex items-center gap-1.5 overflow-x-auto hide-scrollbar mb-2 px-1 py-0.5">
          ${Object.values(THEMES).map(t => `
            <button onclick="MemoryMatchAPI.changeTheme('${t.id}')" class="px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
              t.id === selectedTheme
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }">
              <span>${t.icon}</span>
              <span>${t.name}</span>
            </button>
          `).join('')}
        </div>

        <!-- Difficulty Pill Selector -->
        <div class="w-full bg-white/80 border border-slate-200/90 rounded-2xl p-2 mb-3 flex items-center justify-between gap-2 px-3 shadow-xs">
          <span class="text-xs font-bold text-slate-600 flex items-center gap-1.5">
            <i class="fa-solid fa-sliders text-amber-500 text-xs"></i>
            <span>Board Size:</span>
          </span>
          <div class="flex items-center gap-1">
            ${DIFFICULTIES.map(d => `
              <button onclick="MemoryMatchAPI.changeDifficulty('${d.id}')" class="px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                d.id === selectedDifficulty
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }" title="${d.pairs} pairs (${d.ageTag})">
                ${d.label}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- HUD Scoreboard Bar -->
        <div class="w-full bg-white rounded-2xl border border-slate-200/90 p-3 mb-3 shadow-xs flex items-center justify-between">
          <!-- Moves Counter -->
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-xs">
              <i class="fa-solid fa-hand-pointer"></i>
            </div>
            <div>
              <span class="text-[9px] uppercase font-bold text-slate-400 block leading-none">Moves</span>
              <span id="memoryMovesDisplay" class="font-bold text-sm text-slate-800 leading-none">0</span>
            </div>
          </div>

          <!-- Matched Pairs -->
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs">
              <i class="fa-solid fa-check"></i>
            </div>
            <div>
              <span class="text-[9px] uppercase font-bold text-slate-400 block leading-none">Pairs</span>
              <span id="memoryPairsDisplay" class="font-bold text-sm text-slate-800 leading-none">0 / ${diff.pairs}</span>
            </div>
          </div>

          <!-- Gentle Timer -->
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold text-xs">
              <i class="fa-solid fa-clock"></i>
            </div>
            <div>
              <span class="text-[9px] uppercase font-bold text-slate-400 block leading-none">Time</span>
              <span id="memoryTimerDisplay" class="font-mono font-bold text-sm text-slate-800 leading-none">00:00</span>
            </div>
          </div>

          <!-- Magic Peek Button -->
          <button id="memoryPeekBtn" onclick="MemoryMatchAPI.triggerMagicPeek()" class="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 font-bold text-[11px] flex items-center gap-1 active:scale-95 transition" title="Briefly reveal all cards">
            <i class="fa-solid fa-wand-magic-sparkles text-amber-500"></i>
            <span>Peek (3)</span>
          </button>
        </div>

        <!-- Cards Grid Container -->
        <div id="memoryCardsGrid" class="w-full"></div>

        <!-- Victory Modal Overlay -->
        <div id="memoryVictoryModal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4">
          <div class="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4 transform animate-bounce-short">
            <!-- Star Celebration Header -->
            <div class="relative w-20 h-20 mx-auto">
              <div class="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 text-3xl animate-pulse">
                🏆
              </div>
              <span class="absolute -top-1 -right-1 text-2xl animate-bounce">🎉</span>
              <span class="absolute -bottom-1 -left-1 text-2xl animate-bounce">✨</span>
            </div>

            <!-- New High Score Badge -->
            <div id="memoryVictoryBadge" class="hidden inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-800 font-black text-xs animate-pulse">
              <i class="fa-solid fa-crown text-amber-600"></i>
              <span>NEW BEST RECORD!</span>
            </div>

            <div>
              <h3 class="text-xl font-black text-slate-800">Spectacular Memory!</h3>
              <p class="text-xs text-slate-500 mt-1">You found every single matching pair!</p>
            </div>

            <!-- Stars Rating -->
            <div id="memoryVictoryStars" class="flex items-center justify-center gap-2 py-1"></div>

            <!-- Stats Overview -->
            <div class="grid grid-cols-2 gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-center">
              <div>
                <span class="text-[10px] uppercase font-bold text-slate-400 block">Total Moves</span>
                <span id="memoryVictoryMoves" class="font-black text-lg text-slate-800">0</span>
              </div>
              <div>
                <span class="text-[10px] uppercase font-bold text-slate-400 block">Time Elapsed</span>
                <span id="memoryVictoryTime" class="font-mono font-black text-lg text-slate-800">00:00</span>
              </div>
            </div>

            <!-- Actions -->
            <div class="space-y-2 pt-1">
              <button onclick="MemoryMatchAPI.restartGame()" class="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-xs shadow-md shadow-amber-500/25 active:scale-95 transition flex items-center justify-center gap-2">
                <i class="fa-solid fa-rotate-right text-xs"></i>
                <span>Play Again</span>
              </button>
              <button onclick="MemoryMatchAPI.hideVictoryModal(); openGamesList()" class="w-full py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs transition">
                Choose Another Game
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    renderGameBoard();
    updateHud();
  }

  // --- Public Interface ---
  function openMemoryMatchGame() {
    if (typeof _slidingPuzzleCleanupGame === 'function') {
      _slidingPuzzleCleanupGame();
    }
    if (typeof cleanupBombDefusalGame === 'function') {
      cleanupBombDefusalGame();
    }
    gamesSubView = 'memory_match';
    renderGamesPage(document.getElementById('mainContainer'));
  }

  // Expose to window
  window.openMemoryMatchGame = openMemoryMatchGame;
  window.renderMemoryMatchGame = renderMemoryMatchGame;
  window.cleanupMemoryMatchGame = cleanupMemoryMatchGame;
  window.MemoryMatchAPI = {
    onCardClick,
    triggerMagicPeek,
    changeTheme,
    changeDifficulty,
    restartGame,
    toggleSound,
    hideVictoryModal
  };
})();
