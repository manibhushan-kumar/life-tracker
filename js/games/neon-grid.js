// ==============================================================================
// Neon Grid — Cyberpunk Logic Puzzle Game
// ==============================================================================
// A futuristic, addictive grid-based logic puzzle PWA game with a dark cyberpunk
// neon aesthetic. Players activate nodes, beam laser lines, manipulate diagonal
// rotors, synchronize quantum twin nodes, and satisfy locked barrier cores.
//
// Features:
// - 100% Solvable mathematical puzzle engine powered by GF(2) linear solver
// - 52 Handcrafted Campaign Levels across 4 progressive tiers (Beginner -> Expert)
// - Deterministic Daily Challenge generated from date (YYYY-MM-DD) with streaks
// - Endless Overdrive Mode with procedurally scaling complexity
// - Time Attack Mode with countdown timer and bonus time extensions
// - Practice Sandbox Mode with custom grid sizing and auto-solve assistance
// - Step-by-step interactive Tutorial & Onboarding
// - Full Undo History Stack, Reset, and Infallible Step-by-Step Hint system
// - Target Pattern Preview with Real-time Diff Highlighter Overlay
// - Offline Web Audio API Synthesizer (procedural cyber blips, laser chirps, chimes)
// - Celebratory Victory Overlay with Star Ratings, Confetti Sparks & Cyber Share Card
// - LocalStorage Persistence for progress, best moves, streaks, and settings
// - Keyboard Navigation & Accessibility (Arrow keys, Space/Enter, U, R, H, D, Esc)
// ==============================================================================

(function () {
  'use strict';

  // --- Constants & Storage Keys ---
  const STORAGE_KEYS = {
    PROGRESS: 'life_tracker_neon_progress_v1',
    DAILY: 'life_tracker_neon_daily_v1',
    STATS: 'life_tracker_neon_stats_v1',
    SETTINGS: 'life_tracker_neon_settings_v1',
    ACTIVE_MODE: 'life_tracker_neon_active_mode_v1',
  };

  // --- Procedural Web Audio API Synthesizer (100% Offline) ---
  const NeonAudio = (() => {
    let ctx = null;
    let enabled = true;
    let volume = 0.55;
    let ambientDrone = null;
    let ambientGain = null;
    let ambientEnabled = false;

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

    if (typeof window !== 'undefined') {
      ['touchstart', 'mousedown'].forEach(ev => {
        window.addEventListener(ev, () => { getContext(); }, { once: true, passive: true });
      });
    }

    return {
      isEnabled: () => enabled,
      setEnabled(val) {
        enabled = !!val;
        if (!enabled && ambientGain) {
          ambientGain.gain.setValueAtTime(0, ctx?.currentTime || 0);
        }
      },
      getVolume: () => volume,
      setVolume(val) {
        volume = Math.max(0, Math.min(1, val));
        if (ambientGain && ctx) {
          ambientGain.gain.setTargetAtTime(enabled && ambientEnabled ? volume * 0.03 : 0, ctx.currentTime, 0.1);
        }
      },
      setAmbient(val) {
        ambientEnabled = !!val;
        const c = getContext();
        if (!c) return;
        if (ambientEnabled && enabled) {
          if (!ambientDrone) {
            try {
              const osc = c.createOscillator();
              const gain = c.createGain();
              const filter = c.createBiquadFilter();
              osc.type = 'sawtooth';
              osc.frequency.setValueAtTime(55, c.currentTime);
              filter.type = 'lowpass';
              filter.frequency.setValueAtTime(130, c.currentTime);
              gain.gain.setValueAtTime(0.001, c.currentTime);
              gain.gain.setTargetAtTime(volume * 0.025, c.currentTime + 0.1, 0.4);
              osc.connect(filter);
              filter.connect(gain);
              gain.connect(c.destination);
              osc.start();
              ambientDrone = osc;
              ambientGain = gain;
            } catch (e) {}
          } else if (ambientGain) {
            ambientGain.gain.setTargetAtTime(volume * 0.025, c.currentTime, 0.2);
          }
        } else if (ambientGain) {
          ambientGain.gain.setTargetAtTime(0, c.currentTime, 0.2);
        }
      },
      playTap(tileType = 'standard') {
        if (!enabled) return;
        const c = getContext();
        if (!c) return;
        const t = c.currentTime;
        const master = c.createGain();
        master.gain.setValueAtTime(volume * 0.45, t);
        master.connect(c.destination);

        if (tileType === 'laser') {
          // Cross laser blast
          const osc = c.createOscillator();
          const filter = c.createBiquadFilter();
          const gain = c.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(880, t);
          osc.frequency.exponentialRampToValueAtTime(140, t + 0.14);
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(1100, t);
          filter.Q.setValueAtTime(3.5, t);
          gain.gain.setValueAtTime(0.4, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(master);
          osc.start(t);
          osc.stop(t + 0.16);
        } else if (tileType === 'rotor') {
          // Diagonal rotor dual ping
          [523.25, 783.99].forEach((freq, idx) => {
            const osc = c.createOscillator();
            const gain = c.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t + idx * 0.03);
            gain.gain.setValueAtTime(0.3, t + idx * 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.03 + 0.11);
            osc.connect(gain);
            gain.connect(master);
            osc.start(t + idx * 0.03);
            osc.stop(t + idx * 0.03 + 0.13);
          });
        } else if (tileType === 'quantum') {
          // Shimmering entangled dual sine
          const osc1 = c.createOscillator();
          const osc2 = c.createOscillator();
          const gain = c.createGain();
          osc1.type = 'sine';
          osc2.type = 'sine';
          osc1.frequency.setValueAtTime(659.25, t);
          osc2.frequency.setValueAtTime(663.25, t); // beat shimmer
          gain.gain.setValueAtTime(0.35, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(master);
          osc1.start(t);
          osc2.start(t);
          osc1.stop(t + 0.22);
          osc2.stop(t + 0.22);
        } else if (tileType === 'locked') {
          // Low error buzz: access denied
          const osc = c.createOscillator();
          const gain = c.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(110, t);
          osc.frequency.setValueAtTime(85, t + 0.05);
          gain.gain.setValueAtTime(0.28, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
          osc.connect(gain);
          gain.connect(master);
          osc.start(t);
          osc.stop(t + 0.13);
        } else {
          // Standard node electric blip
          const osc = c.createOscillator();
          const gain = c.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(520, t);
          osc.frequency.exponentialRampToValueAtTime(880, t + 0.03);
          osc.frequency.exponentialRampToValueAtTime(440, t + 0.09);
          gain.gain.setValueAtTime(0.4, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
          osc.connect(gain);
          gain.connect(master);
          osc.start(t);
          osc.stop(t + 0.1);
        }
      },
      playUndo() {
        if (!enabled) return;
        const c = getContext();
        if (!c) return;
        const t = c.currentTime;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(580, t);
        osc.frequency.exponentialRampToValueAtTime(200, t + 0.12);
        gain.gain.setValueAtTime(volume * 0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(t);
        osc.stop(t + 0.14);
      },
      playReset() {
        if (!enabled) return;
        const c = getContext();
        if (!c) return;
        const t = c.currentTime;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, t);
        osc.frequency.exponentialRampToValueAtTime(140, t + 0.16);
        gain.gain.setValueAtTime(volume * 0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(t);
        osc.stop(t + 0.18);
      },
      playHint() {
        if (!enabled) return;
        const c = getContext();
        if (!c) return;
        const t = c.currentTime;
        [880, 1318.51, 1760].forEach((freq, idx) => {
          const osc = c.createOscillator();
          const gain = c.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t + idx * 0.04);
          gain.gain.setValueAtTime(volume * 0.28, t + idx * 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.04 + 0.3);
          osc.connect(gain);
          gain.connect(c.destination);
          osc.start(t + idx * 0.04);
          osc.stop(t + idx * 0.04 + 0.35);
        });
      },
      playSuccess() {
        if (!enabled) return;
        const c = getContext();
        if (!c) return;
        const t = c.currentTime;
        // Cyber triumph chord: C5 -> E5 -> G5 -> C6 -> E6
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
        notes.forEach((freq, idx) => {
          const startAt = t + idx * 0.06;
          const osc = c.createOscillator();
          const gain = c.createGain();
          osc.type = idx === notes.length - 1 ? 'triangle' : 'sine';
          osc.frequency.setValueAtTime(freq, startAt);
          gain.gain.setValueAtTime(0.001, startAt);
          gain.gain.linearRampToValueAtTime(volume * 0.35, startAt + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.6);
          osc.connect(gain);
          gain.connect(c.destination);
          osc.start(startAt);
          osc.stop(startAt + 0.65);
        });
      }
    };
  })();

  // --- Seeded PRNG & Utilities ---
  function createRng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
    }
    return hash;
  }

  function getLocalDateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function cloneMatrix(mat) {
    return mat.map(row => [...row]);
  }

  function isMatrixEqual(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (let r = 0; r < a.length; r++) {
      for (let c = 0; c < a[r].length; c++) {
        if (a[r][c] !== b[r][c]) return false;
      }
    }
    return true;
  }

  // --- Math GF(2) Matrix Solver & Rule Engine ---
  const NeonEngine = (() => {
    function getAffectedCells(r, c, rows, cols, tiles) {
      const tile = tiles[r]?.[c];
      if (!tile || tile.type === 'locked') return [];

      const affectedMap = new Map();
      const add = (row, col) => {
        if (row >= 0 && row < rows && col >= 0 && col < cols) {
          affectedMap.set(`${row},${col}`, { r: row, c: col });
        }
      };

      switch (tile.type) {
        case 'laser':
          for (let j = 0; j < cols; j++) add(r, j);
          for (let i = 0; i < rows; i++) add(i, c);
          break;
        case 'rotor':
          add(r, c);
          add(r - 1, c - 1);
          add(r - 1, c + 1);
          add(r + 1, c - 1);
          add(r + 1, c + 1);
          break;
        case 'quantum':
          add(r, c);
          add(r - 1, c);
          add(r + 1, c);
          add(r, c - 1);
          add(r, c + 1);
          if (tile.pairCoord) add(tile.pairCoord.r, tile.pairCoord.c);
          break;
        case 'standard':
        default:
          add(r, c);
          add(r - 1, c);
          add(r + 1, c);
          add(r, c - 1);
          add(r, c + 1);
          break;
      }

      return Array.from(affectedMap.values());
    }

    function applyMove(current, r, c, rows, cols, tiles) {
      const tile = tiles[r]?.[c];
      if (!tile || tile.type === 'locked') return null;

      const affected = getAffectedCells(r, c, rows, cols, tiles);
      const next = cloneMatrix(current);
      for (const coord of affected) {
        next[coord.r][coord.c] = next[coord.r][coord.c] === 1 ? 0 : 1;
      }
      return { nextState: next, affected };
    }

    /**
     * Solves M * x = b over GF(2) using Gaussian elimination to find minimal click sequence
     */
    function solve(current, target, rows, cols, tiles) {
      const N = rows * cols;
      const toIdx = (r, c) => r * cols + c;

      const b = new Array(N).fill(0);
      let diffCount = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = toIdx(r, c);
          b[idx] = current[r][c] ^ target[r][c];
          if (b[idx] === 1) diffCount++;
        }
      }

      if (diffCount === 0) {
        return { solvable: true, optimalMoves: [], minMoveCount: 0 };
      }

      const clickables = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (tiles[r][c].type !== 'locked') {
            clickables.push({ r, c });
          }
        }
      }

      const K = clickables.length;
      if (K === 0) return { solvable: false, optimalMoves: [], minMoveCount: Infinity };

      const M = Array.from({ length: N }, () => new Array(K + 1).fill(0));
      for (let k = 0; k < K; k++) {
        const { r, c } = clickables[k];
        const affected = getAffectedCells(r, c, rows, cols, tiles);
        for (const aff of affected) {
          M[toIdx(aff.r, aff.c)][k] = 1;
        }
      }
      for (let i = 0; i < N; i++) M[i][K] = b[i];

      const pivotRowForCol = new Array(K).fill(-1);
      let pivotRow = 0;

      for (let col = 0; col < K && pivotRow < N; col++) {
        let sel = -1;
        for (let r = pivotRow; r < N; r++) {
          if (M[r][col] === 1) {
            sel = r;
            break;
          }
        }
        if (sel === -1) continue;

        if (sel !== pivotRow) {
          const tmp = M[pivotRow];
          M[pivotRow] = M[sel];
          M[sel] = tmp;
        }

        pivotRowForCol[col] = pivotRow;
        for (let r = 0; r < N; r++) {
          if (r !== pivotRow && M[r][col] === 1) {
            for (let c = col; c <= K; c++) {
              M[r][c] ^= M[pivotRow][c];
            }
          }
        }
        pivotRow++;
      }

      // Check contradiction
      for (let r = 0; r < N; r++) {
        let allZero = true;
        for (let c = 0; c < K; c++) {
          if (M[r][c] !== 0) {
            allZero = false;
            break;
          }
        }
        if (allZero && M[r][K] === 1) {
          return { solvable: false, optimalMoves: [], minMoveCount: Infinity };
        }
      }

      const freeVars = [];
      for (let c = 0; c < K; c++) {
        if (pivotRowForCol[c] === -1) freeVars.push(c);
      }

      const particular = new Array(K).fill(0);
      for (let c = 0; c < K; c++) {
        const pr = pivotRowForCol[c];
        if (pr !== -1) particular[c] = M[pr][K];
      }

      const basis = [];
      for (const freeCol of freeVars) {
        const vec = new Array(K).fill(0);
        vec[freeCol] = 1;
        for (let c = 0; c < K; c++) {
          const pr = pivotRowForCol[c];
          if (pr !== -1) vec[c] = M[pr][freeCol];
        }
        basis.push(vec);
      }

      let bestSol = [...particular];
      let minWeight = bestSol.reduce((sum, v) => sum + v, 0);

      if (basis.length <= 10) {
        const limit = 1 << basis.length;
        for (let mask = 0; mask < limit; mask++) {
          const cand = [...particular];
          for (let i = 0; i < basis.length; i++) {
            if ((mask >> i) & 1) {
              for (let k = 0; k < K; k++) cand[k] ^= basis[i][k];
            }
          }
          const weight = cand.reduce((sum, v) => sum + v, 0);
          if (weight < minWeight) {
            minWeight = weight;
            bestSol = cand;
          }
        }
      }

      const optimalMoves = [];
      for (let k = 0; k < K; k++) {
        if (bestSol[k] === 1) optimalMoves.push(clickables[k]);
      }

      return { solvable: true, optimalMoves, minMoveCount: minWeight };
    }

    return {
      getAffectedCells,
      applyMove,
      solve
    };
  })();

  // --- Campaign Levels Definition (52 Levels) ---
  const CAMPAIGN_LEVEL_DATA = [
    // Tier 1: Beginner (1 - 10)
    { num: 1, title: 'Power Initialization', tier: 'beginner', r: 3, c: 3, clicks: [[1, 1]], desc: 'Tap the center node to activate the cross pattern.' },
    { num: 2, title: 'Dual Pulse', tier: 'beginner', r: 3, c: 3, clicks: [[0, 0], [2, 2]], desc: 'Activate diagonal nodes to balance circuit interference.' },
    { num: 3, title: 'Subnet Echo', tier: 'beginner', r: 3, c: 3, clicks: [[0, 1], [2, 1]], desc: 'Synchronize edge nodes to configure the vertical bus.' },
    { num: 4, title: 'Triad Array', tier: 'beginner', r: 3, c: 3, clicks: [[0, 0], [1, 1], [2, 0]], desc: 'Triangular node harmonics.' },
    { num: 5, title: 'Corner Inversion', tier: 'beginner', r: 3, c: 3, clicks: [[0, 0], [0, 2], [2, 0], [2, 2]], desc: 'Four corners illuminate the outer circuit perimeter.' },
    { num: 6, title: 'Diamond Pulse', tier: 'beginner', r: 3, c: 3, clicks: [[0, 1], [1, 0], [1, 2], [2, 1]], desc: 'Diamond boundary resonance.' },
    { num: 7, title: 'Center Bypass', tier: 'beginner', r: 3, c: 3, clicks: [[0, 0], [1, 2], [2, 1]], desc: 'Asymmetric activation requires deliberate step planning.' },
    { num: 8, title: 'Logic Mesh', tier: 'beginner', r: 3, c: 3, clicks: [[0, 1], [1, 1], [2, 1]], desc: 'Central column cascade.' },
    { num: 9, title: 'Peripheral Loop', tier: 'beginner', r: 3, c: 3, clicks: [[0, 0], [0, 1], [2, 1], [2, 2]], desc: 'Calculate overlapping fields along the circuit perimeter.' },
    { num: 10, title: 'Gateway Override', tier: 'beginner', r: 3, c: 3, clicks: [[0, 2], [1, 0], [1, 2], [2, 0]], desc: 'Beginner apex challenge. Complete to unlock Intermediate tier.' },

    // Tier 2: Intermediate (11 - 25) - Introduces Laser & Rotor
    { num: 11, title: 'Laser Injection', tier: 'intermediate', r: 4, c: 4, spec: (t) => { t[1][1].type = 'laser'; }, clicks: [[1, 1]], desc: 'Laser nodes sweep energy across their entire row and column.' },
    { num: 12, title: 'Crossfire Matrix', tier: 'intermediate', r: 4, c: 4, spec: (t) => { t[1][1].type = 'laser'; t[2][2].type = 'laser'; }, clicks: [[1, 1], [2, 2]], desc: 'Intersecting laser channels cancel out at cross points.' },
    { num: 13, title: 'Laser & Pulse', tier: 'intermediate', r: 4, c: 4, spec: (t) => { t[0][3].type = 'laser'; }, clicks: [[0, 3], [2, 1]], desc: 'Combine standard local pulses with full-grid laser sweeps.' },
    { num: 14, title: 'Diagonal Rotor', tier: 'intermediate', r: 4, c: 4, spec: (t) => { t[2][1].type = 'rotor'; }, clicks: [[2, 1]], desc: 'Rotor nodes cast energy diagonally across angled circuits.' },
    { num: 15, title: 'Dual Rotors', tier: 'intermediate', r: 4, c: 4, spec: (t) => { t[1][1].type = 'rotor'; t[2][2].type = 'rotor'; }, clicks: [[1, 1], [2, 2], [0, 0]], desc: 'Interlocking diagonal fields.' },
    { num: 16, title: 'Photon Convergence', tier: 'intermediate', r: 4, c: 4, spec: (t) => { t[0][0].type = 'laser'; t[3][3].type = 'rotor'; }, clicks: [[0, 0], [3, 3], [1, 2]], desc: 'Orthogonal laser beams meet diagonal rotor fields.' },
    { num: 17, title: 'Quadratic Surge', tier: 'intermediate', r: 4, c: 4, clicks: [[0, 1], [1, 3], [2, 0], [3, 2]], desc: 'Wide-area 4x4 matrix logic.' },
    { num: 18, title: 'Prism Sweep', tier: 'intermediate', r: 4, c: 4, spec: (t) => { t[1][2].type = 'laser'; t[2][1].type = 'laser'; }, clicks: [[1, 2], [2, 1], [0, 0]], desc: 'Off-axis laser intersection.' },
    { num: 19, title: 'Helix Rotation', tier: 'intermediate', r: 4, c: 4, spec: (t) => { t[1][2].type = 'rotor'; t[2][1].type = 'rotor'; }, clicks: [[1, 2], [2, 1], [3, 3]], desc: 'Opposing diagonal flux patterns.' },
    { num: 20, title: 'Grid Partition', tier: 'intermediate', r: 4, c: 4, spec: (t) => { t[0][1].type = 'laser'; t[3][2].type = 'rotor'; }, clicks: [[0, 1], [3, 2], [1, 1], [2, 3]], desc: 'Four-stage operational sequence.' },
    { num: 21, title: 'Sector Sweep', tier: 'intermediate', r: 4, c: 4, spec: (t) => { t[1][1].type = 'laser'; t[1][2].type = 'rotor'; }, clicks: [[1, 1], [1, 2], [3, 0]], desc: 'Adjacent special nodes create asymmetric interference.' },
    { num: 22, title: 'Lattice Inversion', tier: 'intermediate', r: 4, c: 4, clicks: [[0, 0], [0, 3], [3, 0], [3, 3], [1, 1]], desc: 'Four corners and an internal node create a balanced lattice.' },
    { num: 23, title: 'Tri-Beam Cascade', tier: 'intermediate', r: 4, c: 4, spec: (t) => { t[0][0].type = 'laser'; t[1][1].type = 'laser'; t[2][2].type = 'laser'; }, clicks: [[0, 0], [1, 1], [2, 2], [3, 3]], desc: 'Triple laser echelon.' },
    { num: 24, title: 'Vortex Chamber', tier: 'intermediate', r: 4, c: 4, spec: (t) => { t[1][1].type = 'rotor'; t[1][2].type = 'rotor'; t[2][1].type = 'rotor'; t[2][2].type = 'rotor'; }, clicks: [[1, 1], [2, 2], [0, 3]], desc: 'Central rotor quadrant requires precise timing.' },
    { num: 25, title: 'Subroutine Apex', tier: 'intermediate', r: 4, c: 4, spec: (t) => { t[0][2].type = 'laser'; t[3][1].type = 'rotor'; }, clicks: [[0, 2], [3, 1], [1, 0], [2, 3]], desc: 'Master Intermediate puzzle. Solves unlock the Advanced tier.' },

    // Tier 3: Advanced (26 - 40) - Introduces Quantum Pairs & Locked Cores
    { num: 26, title: 'Entangled Nodes', tier: 'advanced', r: 4, c: 4, spec: (t) => { t[0][0] = { type: 'quantum', pairCoord: { r: 3, c: 3 } }; t[3][3] = { type: 'quantum', pairCoord: { r: 0, c: 0 } }; }, clicks: [[0, 0]], desc: 'Quantum nodes are telepathically linked. Activating one triggers its twin.' },
    { num: 27, title: 'Quantum Resonance', tier: 'advanced', r: 4, c: 4, spec: (t) => { t[0][3] = { type: 'quantum', pairCoord: { r: 3, c: 0 } }; t[3][0] = { type: 'quantum', pairCoord: { r: 0, c: 3 } }; }, clicks: [[0, 3], [1, 1], [2, 2]], desc: 'Teleporting energy packets across opposing corners.' },
    { num: 28, title: 'The Locked Core', tier: 'advanced', r: 4, c: 4, spec: (t) => { t[1][1].type = 'locked'; }, clicks: [[0, 1], [1, 2], [2, 1]], desc: 'Locked Cores cannot be clicked directly. Satisfy them via adjacent nodes.' },
    { num: 29, title: 'Dual Barriers', tier: 'advanced', r: 4, c: 4, spec: (t) => { t[1][2].type = 'locked'; t[2][1].type = 'locked'; t[0][0].type = 'laser'; }, clicks: [[0, 0], [3, 3], [0, 3]], desc: 'Navigate around static barrier circuits using laser penetration.' },
    { num: 30, title: 'Entangled Barriers', tier: 'advanced', r: 4, c: 4, spec: (t) => { t[0][0] = { type: 'quantum', pairCoord: { r: 3, c: 3 } }; t[3][3] = { type: 'quantum', pairCoord: { r: 0, c: 0 } }; t[1][2].type = 'locked'; }, clicks: [[0, 0], [2, 1], [1, 0]], desc: 'Quantum pairs transmit energy across locked security barriers.' },
    { num: 31, title: '5x5 Expansion', tier: 'advanced', r: 5, c: 5, clicks: [[2, 2], [1, 1], [3, 3]], desc: 'Expanded to 5x5 grid. Multi-step logical state complexity deepens.' },
    { num: 32, title: 'Central Bastion', tier: 'advanced', r: 5, c: 5, spec: (t) => { t[2][2].type = 'locked'; }, clicks: [[1, 2], [3, 2], [2, 1], [2, 3]], desc: 'Encircle the locked center nexus.' },
    { num: 33, title: 'Crosshair Nexus', tier: 'advanced', r: 5, c: 5, spec: (t) => { t[2][2].type = 'laser'; }, clicks: [[2, 2], [0, 0], [4, 4]], desc: '5-wide laser sweep commands the entire board.' },
    { num: 34, title: 'Dual Quantum Bonds', tier: 'advanced', r: 5, c: 5, spec: (t) => { t[0][1] = { type: 'quantum', pairCoord: { r: 4, c: 3 } }; t[4][3] = { type: 'quantum', pairCoord: { r: 0, c: 1 } }; }, clicks: [[0, 1], [2, 2], [3, 1]], desc: 'Multi-node non-local quantum state changes.' },
    { num: 35, title: 'Rotor Perimeter', tier: 'advanced', r: 5, c: 5, spec: (t) => { t[1][1].type = 'rotor'; t[3][3].type = 'rotor'; t[1][3].type = 'rotor'; t[3][1].type = 'rotor'; }, clicks: [[1, 1], [3, 3], [2, 2]], desc: 'Four rotors forming an internal diagonal ring.' },
    { num: 36, title: 'Laser Vault', tier: 'advanced', r: 5, c: 5, spec: (t) => { t[0][4].type = 'laser'; t[4][0].type = 'laser'; t[2][2].type = 'locked'; }, clicks: [[0, 4], [4, 0], [1, 2], [3, 2]], desc: 'Lock state in the center while firing perimeter laser arrays.' },
    { num: 37, title: 'Ghost Node Matrix', tier: 'advanced', r: 5, c: 5, spec: (t) => { t[1][3] = { type: 'quantum', pairCoord: { r: 3, c: 1 } }; t[3][1] = { type: 'quantum', pairCoord: { r: 1, c: 3 } }; t[2][2].type = 'rotor'; }, clicks: [[1, 3], [2, 2], [0, 0], [4, 4]], desc: 'Combined quantum pairing with central rotor divergence.' },
    { num: 38, title: 'Fortress Array', tier: 'advanced', r: 5, c: 5, spec: (t) => { t[1][1].type = 'locked'; t[1][3].type = 'locked'; t[3][1].type = 'locked'; t[3][3].type = 'locked'; }, clicks: [[0, 2], [2, 0], [2, 4], [4, 2]], desc: 'Four internal locked bastions test neighbor isolation logic.' },
    { num: 39, title: 'Prism Synapse', tier: 'advanced', r: 5, c: 5, spec: (t) => { t[0][2].type = 'laser'; t[2][0].type = 'laser'; t[2][4].type = 'rotor'; }, clicks: [[0, 2], [2, 0], [2, 4], [4, 2], [2, 2]], desc: 'Complex multi-component interference mesh.' },
    { num: 40, title: 'Core Breach', tier: 'advanced', r: 5, c: 5, spec: (t) => { t[0][0] = { type: 'quantum', pairCoord: { r: 4, c: 4 } }; t[4][4] = { type: 'quantum', pairCoord: { r: 0, c: 0 } }; t[2][2].type = 'locked'; t[0][4].type = 'laser'; }, clicks: [[0, 0], [0, 4], [3, 2], [1, 3]], desc: 'Advanced tier finale. Master this test to unlock Expert.' },

    // Tier 4: Expert (41 - 52)
    { num: 41, title: 'Cyber Grid Zero', tier: 'expert', r: 5, c: 5, clicks: [[0, 0], [0, 4], [4, 0], [4, 4], [2, 2], [1, 3]], desc: 'High-density pattern requiring optimal step deduction.' },
    { num: 42, title: 'Laser Labyrinth', tier: 'expert', r: 5, c: 5, spec: (t) => { t[1][1].type = 'laser'; t[1][3].type = 'laser'; t[3][1].type = 'laser'; t[3][3].type = 'laser'; }, clicks: [[1, 1], [3, 3], [0, 2], [4, 2]], desc: 'Quadratic laser grid with severe cross-cancellation.' },
    { num: 43, title: 'Quantum Quad', tier: 'expert', r: 5, c: 5, spec: (t) => { t[0][2] = { type: 'quantum', pairCoord: { r: 4, c: 2 } }; t[4][2] = { type: 'quantum', pairCoord: { r: 0, c: 2 } }; t[2][0] = { type: 'quantum', pairCoord: { r: 2, c: 4 } }; t[2][4] = { type: 'quantum', pairCoord: { r: 2, c: 0 } }; }, clicks: [[0, 2], [2, 0], [1, 1], [3, 3]], desc: 'Cross-axis dual quantum pairs.' },
    { num: 44, title: 'Singularity', tier: 'expert', r: 5, c: 5, spec: (t) => { t[2][2].type = 'rotor'; t[1][2].type = 'locked'; t[3][2].type = 'locked'; t[2][1].type = 'locked'; t[2][3].type = 'locked'; }, clicks: [[2, 2], [0, 0], [4, 4], [0, 4]], desc: 'The core rotor is insulated by 4 locked barrier nodes.' },
    { num: 45, title: 'Hyperflux', tier: 'expert', r: 5, c: 5, spec: (t) => { t[0][0].type = 'laser'; t[4][4].type = 'laser'; t[0][4].type = 'rotor'; t[4][0].type = 'rotor'; }, clicks: [[0, 0], [4, 4], [0, 4], [2, 2]], desc: 'Corner polarity warfare: two lasers vs two rotors.' },
    { num: 46, title: 'Entangled Bastion', tier: 'expert', r: 5, c: 5, spec: (t) => { t[0][1] = { type: 'quantum', pairCoord: { r: 4, c: 3 } }; t[4][3] = { type: 'quantum', pairCoord: { r: 0, c: 1 } }; t[2][2].type = 'locked'; t[1][4].type = 'laser'; }, clicks: [[0, 1], [1, 4], [3, 0], [2, 3], [4, 1]], desc: 'Multi-layer dependency graph.' },
    { num: 47, title: 'Neurogrid Sync', tier: 'expert', r: 5, c: 5, clicks: [[0, 1], [1, 4], [2, 2], [3, 0], [4, 3]], desc: 'Five-knight traversal pattern requiring deep parity analysis.' },
    { num: 48, title: 'Overdrive Matrix', tier: 'expert', r: 5, c: 5, spec: (t) => { t[0][2].type = 'laser'; t[4][2].type = 'laser'; t[2][0].type = 'rotor'; t[2][4].type = 'rotor'; t[2][2].type = 'locked'; }, clicks: [[0, 2], [2, 0], [4, 2], [1, 1], [3, 3]], desc: 'High-voltage circuitry with locked central processor.' },
    { num: 49, title: 'Quantum Paradox', tier: 'expert', r: 5, c: 5, spec: (t) => { t[1][1] = { type: 'quantum', pairCoord: { r: 3, c: 3 } }; t[3][3] = { type: 'quantum', pairCoord: { r: 1, c: 1 } }; t[0][4].type = 'laser'; t[4][0].type = 'rotor'; }, clicks: [[1, 1], [0, 4], [4, 0], [2, 3], [0, 1]], desc: 'Unravel entangled loops within laser radiation fields.' },
    { num: 50, title: 'Mainframe Nexus', tier: 'expert', r: 5, c: 5, spec: (t) => { t[2][2].type = 'laser'; t[1][1].type = 'rotor'; t[3][3].type = 'rotor'; t[0][2].type = 'locked'; t[4][2].type = 'locked'; }, clicks: [[2, 2], [1, 1], [3, 3], [1, 4], [3, 0]], desc: 'The neural core of the Neon Grid.' },
    { num: 51, title: 'Sub-Zero Parity', tier: 'expert', r: 5, c: 5, spec: (t) => { t[0][0] = { type: 'quantum', pairCoord: { r: 4, c: 4 } }; t[4][4] = { type: 'quantum', pairCoord: { r: 0, c: 0 } }; t[0][4] = { type: 'quantum', pairCoord: { r: 4, c: 0 } }; t[4][0] = { type: 'quantum', pairCoord: { r: 0, c: 4 } }; t[2][2].type = 'laser'; }, clicks: [[0, 0], [0, 4], [2, 2], [1, 2], [3, 2]], desc: 'Quad-corner entangled network pierced by a central laser.' },
    { num: 52, title: 'Grand Architect', tier: 'expert', r: 5, c: 5, spec: (t) => { t[1][1] = { type: 'quantum', pairCoord: { r: 3, c: 3 } }; t[3][3] = { type: 'quantum', pairCoord: { r: 1, c: 1 } }; t[2][2].type = 'locked'; t[0][2].type = 'laser'; t[4][2].type = 'rotor'; }, clicks: [[1, 1], [0, 2], [4, 2], [0, 0], [4, 4], [2, 1]], desc: 'The ultimate apex puzzle. Master-level logic deduction.' },
  ];

  function buildLevel(data) {
    const { r: rows, c: cols } = data;
    const tiles = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ type: 'standard' }))
    );
    if (data.spec) data.spec(tiles);

    const initialState = Array.from({ length: rows }, () => Array(cols).fill(0));
    const targetState = Array.from({ length: rows }, () => Array(cols).fill(0));

    for (const [cr, cc] of data.clicks) {
      const affected = NeonEngine.getAffectedCells(cr, cc, rows, cols, tiles);
      for (const aff of affected) {
        targetState[aff.r][aff.c] ^= 1;
      }
    }

    const sol = NeonEngine.solve(initialState, targetState, rows, cols, tiles);
    const parMoves = sol.solvable && sol.minMoveCount > 0 ? sol.minMoveCount : data.clicks.length;

    return {
      id: `campaign-${data.num}`,
      number: data.num,
      title: data.title,
      tier: data.tier,
      rows,
      cols,
      tiles,
      initialState,
      targetState,
      parMoves,
      description: data.desc
    };
  }

  // --- Procedural Generators (Daily, Endless, Practice) ---
  function generateDailyLevel(dateKey = getLocalDateKey()) {
    const seed = hashString(`neon-grid-daily-${dateKey}`);
    const rng = createRng(seed);

    const parts = dateKey.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const day = d.getDay();

    let rows = 4, cols = 4, steps = 3 + (day % 3);
    if (day === 0 || day === 6) { rows = 5; cols = 5; steps = 4; }

    const tiles = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ type: 'standard' }))
    );

    if (day >= 2) {
      tiles[Math.floor(rng() * rows)][Math.floor(rng() * cols)].type = 'laser';
    }
    if (day >= 4) {
      const rr = Math.floor(rng() * rows), rc = Math.floor(rng() * cols);
      if (tiles[rr][rc].type === 'standard') tiles[rr][rc].type = 'rotor';
    }
    if (day === 0 || day === 6) {
      tiles[0][0] = { type: 'quantum', pairCoord: { r: rows - 1, c: cols - 1 } };
      tiles[rows - 1][cols - 1] = { type: 'quantum', pairCoord: { r: 0, c: 0 } };
    }

    const initialState = Array.from({ length: rows }, () => Array(cols).fill(0));
    const targetState = Array.from({ length: rows }, () => Array(cols).fill(0));

    const clickables = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (tiles[r][c].type !== 'locked') clickables.push({ r, c });
      }
    }

    const chosen = new Set();
    while (chosen.size < Math.min(steps, clickables.length)) {
      chosen.add(Math.floor(rng() * clickables.length));
    }

    for (const idx of chosen) {
      const { r, c } = clickables[idx];
      const affected = NeonEngine.getAffectedCells(r, c, rows, cols, tiles);
      for (const aff of affected) targetState[aff.r][aff.c] ^= 1;
    }

    const sol = NeonEngine.solve(initialState, targetState, rows, cols, tiles);
    const parMoves = sol.solvable && sol.minMoveCount > 0 ? sol.minMoveCount : steps;

    return {
      id: `daily-${dateKey}`,
      number: 1,
      title: `Daily Protocol: ${dateKey}`,
      tier: rows === 3 ? 'beginner' : rows === 4 ? 'intermediate' : 'advanced',
      rows,
      cols,
      tiles,
      initialState,
      targetState,
      parMoves,
      description: `Daily neural encryption puzzle for ${dateKey}. Keep your streak alive!`
    };
  }

  function generateEndlessLevel(streak) {
    const seed = Date.now() + streak * 7919;
    const rng = createRng(seed);

    let rows = 3, cols = 3, steps = 2;
    if (streak >= 4) { rows = 4; cols = 4; steps = 3; }
    if (streak >= 10) { rows = 4; cols = 4; steps = 4; }
    if (streak >= 20) { rows = 5; cols = 5; steps = 4; }

    const tiles = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ type: 'standard' }))
    );

    if (streak >= 6 && rng() > 0.4) {
      tiles[Math.floor(rng() * rows)][Math.floor(rng() * cols)].type = 'laser';
    }
    if (streak >= 12 && rng() > 0.4) {
      const rr = Math.floor(rng() * rows), rc = Math.floor(rng() * cols);
      if (tiles[rr][rc].type === 'standard') tiles[rr][rc].type = 'rotor';
    }

    const initialState = Array.from({ length: rows }, () => Array(cols).fill(0));
    const targetState = Array.from({ length: rows }, () => Array(cols).fill(0));

    const clickables = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (tiles[r][c].type !== 'locked') clickables.push({ r, c });
      }
    }

    const chosen = new Set();
    while (chosen.size < Math.min(steps, clickables.length)) {
      chosen.add(Math.floor(rng() * clickables.length));
    }

    for (const idx of chosen) {
      const { r, c } = clickables[idx];
      const affected = NeonEngine.getAffectedCells(r, c, rows, cols, tiles);
      for (const aff of affected) targetState[aff.r][aff.c] ^= 1;
    }

    const sol = NeonEngine.solve(initialState, targetState, rows, cols, tiles);
    const parMoves = sol.solvable && sol.minMoveCount > 0 ? sol.minMoveCount : steps;

    return {
      id: `endless-${streak}-${Date.now()}`,
      number: streak,
      title: `Overdrive Stage #${streak}`,
      tier: rows === 3 ? 'beginner' : rows === 4 ? 'intermediate' : 'expert',
      rows,
      cols,
      tiles,
      initialState,
      targetState,
      parMoves,
      description: `Continuous stream stage #${streak}. Solve fast for bonus score!`
    };
  }

  function generatePracticeLevel(options = {}) {
    const { rows = 4, cols = 4, laser = true, rotor = true, steps = 3 } = options;
    const rng = Math.random;

    const tiles = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ type: 'standard' }))
    );

    if (laser && rows >= 4) {
      tiles[Math.floor(rng() * rows)][Math.floor(rng() * cols)].type = 'laser';
    }
    if (rotor && rows >= 4) {
      const rr = Math.floor(rng() * rows), rc = Math.floor(rng() * cols);
      if (tiles[rr][rc].type === 'standard') tiles[rr][rc].type = 'rotor';
    }

    const initialState = Array.from({ length: rows }, () => Array(cols).fill(0));
    const targetState = Array.from({ length: rows }, () => Array(cols).fill(0));

    const clickables = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (tiles[r][c].type !== 'locked') clickables.push({ r, c });
      }
    }

    const chosen = new Set();
    while (chosen.size < Math.min(steps, clickables.length)) {
      chosen.add(Math.floor(rng() * clickables.length));
    }

    for (const idx of chosen) {
      const { r, c } = clickables[idx];
      const affected = NeonEngine.getAffectedCells(r, c, rows, cols, tiles);
      for (const aff of affected) targetState[aff.r][aff.c] ^= 1;
    }

    const sol = NeonEngine.solve(initialState, targetState, rows, cols, tiles);
    const parMoves = sol.solvable && sol.minMoveCount > 0 ? sol.minMoveCount : steps;

    return {
      id: `practice-${Date.now()}`,
      number: 0,
      title: `Simulation Matrix (${rows}x${cols})`,
      tier: 'beginner',
      rows,
      cols,
      tiles,
      initialState,
      targetState,
      parMoves,
      description: 'Practice sandbox: test hypotheses and learn node patterns.'
    };
  }

  // --- Game State Store ---
  let state = {
    mode: 'campaign', // 'campaign' | 'daily' | 'endless' | 'timeAttack' | 'practice'
    campaignIndex: 0, // 0 to 51
    currentLevel: null,
    currentState: null,
    history: [], // [{ r, c, state }]
    movesTaken: 0,
    startTime: 0,
    elapsedSeconds: 0,
    timerInterval: null,
    isComplete: false,
    hintsUsed: 0,
    hintHighlight: null, // { r, c } or null
    diffHighlightEnabled: false,
    scanlines: false,
    reducedMotion: false,
    selectedCell: null, // { r, c } for keyboard navigation

    // Endless & Time Attack states
    endlessStreak: 1,
    timeAttackTimeLeft: 90,
    timeAttackScore: 0,
    timeAttackTimer: null,
  };

  // --- Storage Helpers ---
  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PROGRESS);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveLevelProgress(levelId, stars, moves, time) {
    const progress = loadProgress();
    const existing = progress[levelId];
    progress[levelId] = {
      levelId,
      completed: true,
      stars: existing ? Math.max(existing.stars, stars) : stars,
      bestMoves: existing ? Math.min(existing.bestMoves, moves) : moves,
      bestTime: existing ? Math.min(existing.bestTime, time) : time,
    };
    try {
      localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progress));
    } catch (e) {}

    // Update global stats
    const stats = loadStats();
    stats.totalSolved = Object.keys(progress).length;
    stats.totalStars = Object.values(progress).reduce((acc, p) => acc + (p.stars || 0), 0);
    saveStats(stats);
  }

  function loadDailyRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DAILY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveDailyRecord(dateKey, stars, moves) {
    const recs = loadDailyRecords();
    const wasAlready = recs[dateKey]?.completed;
    recs[dateKey] = { dateKey, completed: true, stars, moves };
    try {
      localStorage.setItem(STORAGE_KEYS.DAILY, JSON.stringify(recs));
    } catch (e) {}

    if (!wasAlready) {
      const stats = loadStats();
      stats.dailySolved = (stats.dailySolved || 0) + 1;
      stats.dailyStreak = (stats.dailyStreak || 0) + 1;
      if (stats.dailyStreak > (stats.dailyHighestStreak || 0)) {
        stats.dailyHighestStreak = stats.dailyStreak;
      }
      saveStats(stats);
    }
  }

  function loadStats() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.STATS);
      return raw ? JSON.parse(raw) : { totalSolved: 0, totalStars: 0, dailyStreak: 0, dailyHighestStreak: 0, dailySolved: 0, endlessBest: 0, timeAttackBest: 0 };
    } catch (e) {
      return { totalSolved: 0, totalStars: 0, dailyStreak: 0, dailyHighestStreak: 0, dailySolved: 0, endlessBest: 0, timeAttackBest: 0 };
    }
  }

  function saveStats(stats) {
    try {
      localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
    } catch (e) {}
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.soundEnabled !== undefined) NeonAudio.setEnabled(s.soundEnabled);
        if (s.soundVolume !== undefined) NeonAudio.setVolume(s.soundVolume);
        if (s.scanlines !== undefined) state.scanlines = s.scanlines;
        if (s.reducedMotion !== undefined) state.reducedMotion = s.reducedMotion;
        if (s.diffHighlightEnabled !== undefined) state.diffHighlightEnabled = s.diffHighlightEnabled;
        return s;
      }
    } catch (e) {}
    return { soundEnabled: true, soundVolume: 0.55, scanlines: false, reducedMotion: false, diffHighlightEnabled: false };
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({
        soundEnabled: NeonAudio.isEnabled(),
        soundVolume: NeonAudio.getVolume(),
        scanlines: state.scanlines,
        reducedMotion: state.reducedMotion,
        diffHighlightEnabled: state.diffHighlightEnabled,
      }));
    } catch (e) {}
  }

  // --- Game Lifecycle & Timers ---
  function startTimer() {
    stopTimer();
    state.startTime = Date.now();
    state.elapsedSeconds = 0;
    state.timerInterval = setInterval(() => {
      if (state.isComplete) return;
      state.elapsedSeconds = Math.floor((Date.now() - state.startTime) / 1000);
      updateTimerDisplay();
    }, 1000);
  }

  function stopTimer() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
    if (state.timeAttackTimer) {
      clearInterval(state.timeAttackTimer);
      state.timeAttackTimer = null;
    }
  }

  function updateTimerDisplay() {
    const el = document.getElementById('neonTimer');
    if (!el) return;
    const m = Math.floor(state.elapsedSeconds / 60);
    const s = state.elapsedSeconds % 60;
    el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function initLevel(levelDef) {
    stopTimer();
    state.currentLevel = levelDef;
    state.currentState = cloneMatrix(levelDef.initialState);
    state.history = [];
    state.movesTaken = 0;
    state.isComplete = false;
    state.hintsUsed = 0;
    state.hintHighlight = null;
    state.selectedCell = { r: 0, c: 0 };

    if (state.mode === 'timeAttack') {
      if (!state.timeAttackTimer) {
        state.timeAttackTimeLeft = 90;
        state.timeAttackScore = 0;
        startTimeAttackCountdown();
      }
    } else {
      startTimer();
    }

    renderGameScreen();
  }

  function startTimeAttackCountdown() {
    if (state.timeAttackTimer) clearInterval(state.timeAttackTimer);
    state.timeAttackTimer = setInterval(() => {
      state.timeAttackTimeLeft--;
      const el = document.getElementById('neonTimeAttackBar');
      if (el) {
        el.textContent = `${state.timeAttackTimeLeft}s`;
        if (state.timeAttackTimeLeft <= 15) {
          el.className = 'font-mono font-bold text-xs text-rose-400 animate-pulse';
        }
      }
      if (state.timeAttackTimeLeft <= 0) {
        clearInterval(state.timeAttackTimer);
        state.timeAttackTimer = null;
        onTimeAttackGameOver();
      }
    }, 1000);
  }

  function onTimeAttackGameOver() {
    NeonAudio.playTap('locked');
    const stats = loadStats();
    if (state.timeAttackScore > (stats.timeAttackBest || 0)) {
      stats.timeAttackBest = state.timeAttackScore;
      saveStats(stats);
    }
    showTimeAttackSummaryModal();
  }

  // --- Move & Interaction Handlers ---
  function onCellClicked(r, c) {
    if (state.isComplete) return;
    const lvl = state.currentLevel;
    if (!lvl) return;

    const tile = lvl.tiles[r]?.[c];
    if (!tile || tile.type === 'locked') {
      NeonAudio.playTap('locked');
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([30, 40, 30]); } catch (e) {}
      }
      wiggleCell(r, c);
      return;
    }

    // Record previous state for undo
    state.history.push({
      r,
      c,
      state: cloneMatrix(state.currentState)
    });

    // Apply move
    const result = NeonEngine.applyMove(
      state.currentState,
      r,
      c,
      lvl.rows,
      lvl.cols,
      lvl.tiles
    );

    if (!result) return;

    state.currentState = result.nextState;
    state.movesTaken++;
    state.hintHighlight = null; // Clear hint on action

    // Sound effect & light tactile haptic
    NeonAudio.playTap(tile.type);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(10); } catch (e) {}
    }

    // Ripple effect on affected cells
    flashAffectedCells(result.affected);

    // Check Win Condition
    if (isMatrixEqual(state.currentState, lvl.targetState)) {
      onLevelCompleted();
    } else {
      updateHUD();
      renderGridCells();
    }
  }

  function undoMove() {
    if (state.history.length === 0 || state.isComplete) return;
    const last = state.history.pop();
    state.currentState = last.state;
    state.movesTaken = Math.max(0, state.movesTaken - 1);
    state.hintHighlight = null;

    NeonAudio.playUndo();
    updateHUD();
    renderGridCells();
  }

  function resetLevel() {
    if (state.isComplete) return;
    if (!state.currentLevel) return;

    state.currentState = cloneMatrix(state.currentLevel.initialState);
    state.history = [];
    state.movesTaken = 0;
    state.hintHighlight = null;

    NeonAudio.playReset();
    updateHUD();
    renderGridCells();
  }

  function giveHint() {
    if (state.isComplete || !state.currentLevel) return;
    const sol = NeonEngine.solve(
      state.currentState,
      state.currentLevel.targetState,
      state.currentLevel.rows,
      state.currentLevel.cols,
      state.currentLevel.tiles
    );

    if (sol.solvable && sol.optimalMoves.length > 0) {
      const nextMove = sol.optimalMoves[0];
      state.hintHighlight = nextMove;
      state.hintsUsed++;
      NeonAudio.playHint();
      renderGridCells();

      // Show toast
      showNeonToast(`💡 Next Step: Tap cell at Row ${nextMove.r + 1}, Col ${nextMove.c + 1} (${sol.minMoveCount} moves remaining)`);
    } else {
      showNeonToast('Grid is already at the target configuration!');
    }
  }

  function toggleDiffOverlay() {
    state.diffHighlightEnabled = !state.diffHighlightEnabled;
    saveSettings();
    renderGridCells();
    showNeonToast(state.diffHighlightEnabled ? 'Highlighting Mismatched Nodes' : 'Difference Highlight OFF');
  }

  function onLevelCompleted() {
    state.isComplete = true;
    stopTimer();
    NeonAudio.playSuccess();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([40, 80, 50]); } catch (e) {}
    }

    const lvl = state.currentLevel;
    const par = lvl.parMoves;
    const moves = state.movesTaken;

    // Calculate stars
    let stars = 1;
    if (state.hintsUsed > 0) {
      stars = moves <= par ? 2 : 1;
    } else if (moves <= par) {
      stars = 3;
    } else if (moves <= par + 2) {
      stars = 2;
    }

    // Save based on mode
    if (state.mode === 'campaign') {
      saveLevelProgress(lvl.id, stars, moves, state.elapsedSeconds);
    } else if (state.mode === 'daily') {
      const dKey = lvl.id.replace('daily-', '');
      saveDailyRecord(dKey, stars, moves);
    } else if (state.mode === 'endless') {
      const stats = loadStats();
      if (state.endlessStreak > (stats.endlessBest || 0)) {
        stats.endlessBest = state.endlessStreak;
        saveStats(stats);
      }
    } else if (state.mode === 'timeAttack') {
      state.timeAttackScore += 100 + Math.max(0, (par - moves) * 20);
      state.timeAttackTimeLeft += 15; // +15s bonus!
      showNeonToast('⚡ Time Extended: +15 SECONDS!');
    }

    // Trigger visual confetti / neon fireworks
    spawnNeonVictoryParticles();

    // Show Victory Modal
    setTimeout(() => {
      showVictoryModal(stars, moves, par);
    }, 450);
  }

  // --- Visual Feedback Animations ---
  function wiggleCell(r, c) {
    const el = document.getElementById(`cell-${r}-${c}`);
    if (!el) return;
    el.classList.add('animate-shake');
    setTimeout(() => el.classList.remove('animate-shake'), 400);
  }

  function flashAffectedCells(affected) {
    for (const coord of affected) {
      const el = document.getElementById(`cell-${coord.r}-${coord.c}`);
      if (!el) return;
      el.classList.add('neon-cell-pulse');
      setTimeout(() => el.classList.remove('neon-cell-pulse'), 300);
    }
  }

  function spawnNeonVictoryParticles() {
    const container = document.getElementById('neonParticleCanvas');
    if (!container) return;
    const canvas = container;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
    canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;

    const particles = [];
    const colors = ['#00f3ff', '#b026ff', '#ff007f', '#00ff88', '#ffffff'];

    for (let i = 0; i < 60; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 80,
        y: canvas.height / 2 + (Math.random() - 0.5) * 80,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12 - 4,
        size: Math.random() * 5 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1.0,
        decay: 0.015 + Math.random() * 0.015
      });
    }

    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles) {
        if (p.life > 0) {
          alive = true;
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.25; // gravity
          p.life -= p.decay;

          ctx.save();
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      if (alive) requestAnimationFrame(render);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    requestAnimationFrame(render);
  }

  function showNeonToast(msg) {
    const old = document.getElementById('neonToast');
    if (old) old.remove();

    const toast = document.createElement('div');
    toast.id = 'neonToast';
    toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-slate-900/95 border border-cyan-500/40 text-cyan-300 text-xs font-semibold shadow-lg shadow-cyan-500/20 backdrop-blur-md flex items-center gap-2 pointer-events-none transition-all duration-300 animate-bounce';
    toast.innerHTML = `<i class="fa-solid fa-bolt text-cyan-400"></i><span>${msg}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 2800);
  }

  // --- UI Rendering ---
  function renderGameScreen() {
    const container = document.getElementById('mainContainer');
    if (!container) return;

    // Reset parent padding and margin to fit strictly within single screen viewport
    container.style.paddingTop = '0.25rem';
    container.style.paddingBottom = '0';
    container.classList.remove('space-y-5');

    const lvl = state.currentLevel;
    if (!lvl) return;

    const tierBadges = {
      beginner: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      intermediate: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
      advanced: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
      expert: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    };

    const lvlNum = lvl.number || (state.mode === 'campaign' ? state.campaignIndex + 1 : '');
    const lvlHeading = lvlNum ? `Lvl ${lvlNum} • ${lvl.title}` : lvl.title;

    let guideTip = `Match tiles to Target pattern in ≤ ${lvl.parMoves} moves`;
    if (lvl.number === 1) {
      guideTip = 'Tap center tile to toggle it & adjacent neighbors!';
    } else if (lvl.desc) {
      guideTip = lvl.desc;
    }

    container.innerHTML = `
      <style>
        .neon-grid-wrap {
          background: radial-gradient(circle at 50% 12%, #0f172a 0%, #070a14 65%, #020408 100%);
          height: calc(100dvh - 122px);
          max-height: calc(100dvh - 122px);
          overflow: hidden;
          user-select: none;
          -webkit-user-select: none;
        }
        @media (max-height: 700px) {
          .neon-grid-wrap {
            height: calc(100dvh - 110px);
            max-height: calc(100dvh - 110px);
          }
        }
        @keyframes cellPulse {
          0% { transform: scale(0.95); opacity: 0.85; }
          50% { transform: scale(1.04); opacity: 1; }
          100% { transform: scale(1.0); opacity: 1; }
        }
        .neon-cell-pulse {
          animation: cellPulse 0.25s ease-out;
        }
        @keyframes shakeAnim {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shakeAnim 0.28s ease-in-out;
        }
      </style>

      <div class="neon-grid-wrap relative rounded-3xl p-2.5 sm:p-4 text-slate-100 flex flex-col justify-between overflow-hidden shadow-2xl border border-slate-800/80">
        
        <!-- Victory Particle Canvas -->
        <canvas id="neonParticleCanvas" class="absolute inset-0 pointer-events-none z-40"></canvas>

        <!-- Top Header Navigation Bar -->
        <div class="w-full flex items-center justify-between gap-2 shrink-0 mb-1 z-10">
          <div class="flex items-center gap-2 min-w-0">
            <button onclick="openGamesList()" class="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition active:scale-95 shadow-sm shrink-0">
              <i class="fa-solid fa-arrow-left text-xs"></i>
            </button>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <h2 class="text-sm sm:text-base font-black tracking-wide text-white truncate">${lvlHeading}</h2>
                <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${tierBadges[lvl.tier] || tierBadges.beginner} uppercase tracking-wider">
                  ${lvl.tier}
                </span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <button onclick="openNeonLevelsModal()" title="Level Selector" class="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-cyan-300 flex items-center justify-center transition active:scale-95">
              <i class="fa-solid fa-list-ol text-xs"></i>
            </button>
            <button onclick="openNeonSettingsModal()" title="Settings" class="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-cyan-300 flex items-center justify-center transition active:scale-95">
              <i class="fa-solid fa-gear text-xs"></i>
            </button>
            <button onclick="openNeonTutorialModal()" title="How to Play" class="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-cyan-300 flex items-center justify-center transition active:scale-95">
              <i class="fa-solid fa-circle-question text-xs"></i>
            </button>
          </div>
        </div>

        <!-- Mode Indicator / Time Attack Status Bar -->
        ${state.mode === 'timeAttack' ? `
          <div class="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-rose-950/40 border border-rose-500/30 mb-1 z-10 shrink-0">
            <div class="flex items-center gap-2">
              <i class="fa-solid fa-stopwatch text-rose-400 text-xs"></i>
              <span class="text-xs text-rose-300 font-bold uppercase">Time Attack</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-xs text-slate-400">Score: <strong class="text-white">${state.timeAttackScore}</strong></span>
              <span id="neonTimeAttackBar" class="font-mono font-black text-sm text-rose-400">${state.timeAttackTimeLeft}s</span>
            </div>
          </div>
        ` : ''}

        <!-- Top HUD Cards: Moves, Par, Timer, Target Mini Preview -->
        <div class="w-full grid grid-cols-4 gap-1.5 shrink-0 mb-1 z-10 max-w-sm mx-auto">
          <div class="rounded-xl bg-slate-900/90 border border-slate-800 py-1.5 px-1 flex flex-col items-center justify-center text-center shadow-xs">
            <span class="text-[8px] uppercase font-bold text-slate-400">Moves</span>
            <span id="neonMoveCount" class="text-sm sm:text-base font-black text-cyan-300 font-mono leading-tight">${state.movesTaken}</span>
          </div>

          <div class="rounded-xl bg-slate-900/90 border border-slate-800 py-1.5 px-1 flex flex-col items-center justify-center text-center shadow-xs">
            <span class="text-[8px] uppercase font-bold text-slate-400">Par</span>
            <span class="text-sm sm:text-base font-black text-purple-300 font-mono leading-tight">${lvl.parMoves}</span>
          </div>

          <div class="rounded-xl bg-slate-900/90 border border-slate-800 py-1.5 px-1 flex flex-col items-center justify-center text-center shadow-xs">
            <span class="text-[8px] uppercase font-bold text-slate-400">Time</span>
            <span id="neonTimer" class="text-sm sm:text-base font-black text-emerald-300 font-mono leading-tight">00:00</span>
          </div>

          <!-- Target Mini Preview with Expand / Diff Toggle -->
          <button onclick="toggleDiffOverlay()" title="Click to highlight differences" class="rounded-xl bg-slate-900/90 border ${state.diffHighlightEnabled ? 'border-amber-400/90 bg-amber-950/20 shadow-xs shadow-amber-400/20' : 'border-slate-800'} py-1 px-1 flex flex-col items-center justify-center hover:border-slate-700 transition cursor-pointer group shadow-xs">
            <div class="flex items-center justify-between w-full px-1 mb-0.5">
              <span class="text-[7px] uppercase font-bold text-slate-400">Target</span>
              <i class="fa-solid fa-eye text-[8px] ${state.diffHighlightEnabled ? 'text-amber-400' : 'text-slate-500'}"></i>
            </div>
            <div id="neonTargetMini" class="grid gap-0.5 pointer-events-none" style="grid-template-columns: repeat(${lvl.cols}, minmax(0, 1fr));">
              ${renderMiniTargetHtml(lvl.targetState)}
            </div>
          </button>
        </div>

        <!-- In-Game Mission Guidance Banner -->
        <div class="w-full max-w-sm mx-auto px-2.5 py-1 rounded-xl bg-slate-900/80 border border-slate-800 text-[10px] text-slate-300 flex items-center justify-center gap-1.5 text-center shrink-0 mb-1 shadow-xs">
          <i class="fa-solid fa-lightbulb text-amber-400 text-[10px] shrink-0"></i>
          <span class="truncate">${guideTip}</span>
        </div>

        <!-- Main Interactive Neon Game Grid (Dynamically Scaled to fit remaining height) -->
        <div class="flex-1 min-h-0 w-full flex items-center justify-center my-auto p-1 z-10 overflow-hidden">
          <div id="neonBoardContainer" class="h-full max-h-full aspect-square p-2.5 sm:p-3.5 rounded-2xl sm:rounded-3xl bg-slate-900/80 border border-slate-800/90 backdrop-blur-md shadow-xl flex items-center justify-center max-w-[min(100%,320px)]">
            <div id="neonGrid" class="w-full h-full grid gap-2 sm:gap-2.5" style="grid-template-columns: repeat(${lvl.cols}, minmax(0, 1fr)); grid-template-rows: repeat(${lvl.rows}, minmax(0, 1fr));">
              <!-- Dynamically populated by renderGridCells() -->
            </div>
          </div>
        </div>

        <!-- Tile Type Legend Strip -->
        <div class="shrink-0 w-full max-w-sm mx-auto flex items-center justify-center gap-3 py-1 text-[9px] text-slate-400 z-10 overflow-x-auto hide-scrollbar">
          <span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-cyan-400 shadow-xs shadow-cyan-400/50"></span> Pulse</span>
          <span class="inline-flex items-center gap-1"><i class="fa-solid fa-crosshairs text-pink-400 text-[9px]"></i> Laser</span>
          <span class="inline-flex items-center gap-1"><i class="fa-solid fa-arrows-spin text-purple-400 text-[9px]"></i> Rotor</span>
          <span class="inline-flex items-center gap-1"><i class="fa-solid fa-atom text-violet-400 text-[9px]"></i> Quantum</span>
          <span class="inline-flex items-center gap-1"><i class="fa-solid fa-lock text-amber-400 text-[9px]"></i> Locked</span>
        </div>

        <!-- Bottom Game Controls: Undo, Reset, Hint, Diff Toggle -->
        <div class="shrink-0 w-full max-w-sm mx-auto grid grid-cols-4 gap-1.5 mt-0.5 z-10">
          <button onclick="undoNeonMove()" ${state.history.length === 0 ? 'disabled' : ''} id="neonUndoBtn" class="py-2 px-1 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-cyan-300 disabled:opacity-40 disabled:pointer-events-none flex flex-col items-center justify-center gap-0.5 transition active:scale-95 shadow-sm">
            <i class="fa-solid fa-rotate-left text-xs text-cyan-400"></i>
            <span class="text-[9px] font-bold uppercase tracking-wider">Undo</span>
          </button>

          <button onclick="resetNeonLevel()" class="py-2 px-1 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-rose-300 flex flex-col items-center justify-center gap-0.5 transition active:scale-95 shadow-sm">
            <i class="fa-solid fa-arrow-rotate-right text-xs text-rose-400"></i>
            <span class="text-[9px] font-bold uppercase tracking-wider">Reset</span>
          </button>

          <button onclick="giveNeonHint()" class="py-2 px-1 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-400/50 text-slate-300 hover:text-amber-300 flex flex-col items-center justify-center gap-0.5 transition active:scale-95 shadow-sm">
            <i class="fa-solid fa-lightbulb text-xs text-amber-400"></i>
            <span class="text-[9px] font-bold uppercase tracking-wider">Hint</span>
          </button>

          <button onclick="toggleDiffOverlay()" class="py-2 px-1 rounded-xl bg-slate-900 border ${state.diffHighlightEnabled ? 'border-amber-400/70 text-amber-300' : 'border-slate-800 text-slate-400'} flex flex-col items-center justify-center gap-0.5 transition active:scale-95 shadow-sm">
            <i class="fa-solid fa-layer-group text-xs ${state.diffHighlightEnabled ? 'text-amber-400' : 'text-slate-500'}"></i>
            <span class="text-[9px] font-bold uppercase tracking-wider">Diff</span>
          </button>
        </div>

      </div>
    `;

    renderGridCells();
  }

  function renderMiniTargetHtml(targetMat) {
    let html = '';
    const rows = targetMat.length;
    const cols = targetMat[0]?.length || 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const val = targetMat[r][c];
        html += `<div class="w-2 h-2 rounded-[2px] ${val === 1 ? 'bg-cyan-400 shadow-xs' : 'bg-slate-800'}"></div>`;
      }
    }
    return html;
  }

  function renderGridCells() {
    const gridEl = document.getElementById('neonGrid');
    if (!gridEl) return;
    const lvl = state.currentLevel;
    if (!lvl) return;

    let html = '';
    for (let r = 0; r < lvl.rows; r++) {
      for (let c = 0; c < lvl.cols; c++) {
        const tile = lvl.tiles[r][c];
        const val = state.currentState[r][c];
        const targetVal = lvl.targetState[r][c];
        const isDiff = state.diffHighlightEnabled && val !== targetVal;
        const isHinted = state.hintHighlight && state.hintHighlight.r === r && state.hintHighlight.c === c;
        const isSelected = state.selectedCell && state.selectedCell.r === r && state.selectedCell.c === c;

        // Base cell styling: clean, modern, tactile tiles without fine lines
        let bgStyle = '';
        let borderStyle = '';
        let iconHtml = '';

        if (tile.type === 'locked') {
          // Locked barrier
          if (val === 1) {
            bgStyle = 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25';
            borderStyle = 'border-2 border-amber-300';
            iconHtml = `<i class="fa-solid fa-lock text-sm text-slate-950"></i>`;
          } else {
            bgStyle = 'bg-slate-900/90 text-amber-400/70 shadow-sm';
            borderStyle = 'border-2 border-amber-500/40';
            iconHtml = `<i class="fa-solid fa-lock text-sm text-amber-400/60"></i>`;
          }
        } else if (tile.type === 'laser') {
          // Laser beam
          if (val === 1) {
            bgStyle = 'bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow-lg shadow-pink-500/30';
            borderStyle = 'border border-pink-300/80';
            iconHtml = `<i class="fa-solid fa-crosshairs text-base text-white"></i>`;
          } else {
            bgStyle = 'bg-slate-800/80 hover:bg-slate-800 text-pink-400 shadow-sm';
            borderStyle = 'border border-pink-500/30';
            iconHtml = `<i class="fa-solid fa-crosshairs text-base text-pink-400/80"></i>`;
          }
        } else if (tile.type === 'rotor') {
          // Diagonal rotor
          if (val === 1) {
            bgStyle = 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/30';
            borderStyle = 'border border-purple-300/80';
            iconHtml = `<i class="fa-solid fa-arrows-spin text-base text-white"></i>`;
          } else {
            bgStyle = 'bg-slate-800/80 hover:bg-slate-800 text-purple-400 shadow-sm';
            borderStyle = 'border border-purple-500/30';
            iconHtml = `<i class="fa-solid fa-arrows-spin text-base text-purple-400/80"></i>`;
          }
        } else if (tile.type === 'quantum') {
          // Quantum entangled node
          if (val === 1) {
            bgStyle = 'bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-lg shadow-violet-500/30';
            borderStyle = 'border border-violet-300/80';
            iconHtml = `<i class="fa-solid fa-atom text-base text-white"></i>`;
          } else {
            bgStyle = 'bg-slate-800/80 hover:bg-slate-800 text-violet-400 shadow-sm';
            borderStyle = 'border border-violet-500/30';
            iconHtml = `<i class="fa-solid fa-atom text-base text-violet-400/80"></i>`;
          }
        } else {
          // Standard pulse node
          if (val === 1) {
            bgStyle = 'bg-gradient-to-br from-cyan-400 to-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/35';
            borderStyle = 'border border-cyan-300/90';
            iconHtml = `<div class="w-3.5 h-3.5 rounded-full bg-slate-950/20 flex items-center justify-center"><div class="w-2 h-2 rounded-full bg-white shadow-xs"></div></div>`;
          } else {
            bgStyle = 'bg-slate-800/80 hover:bg-slate-800 text-slate-500 shadow-sm';
            borderStyle = 'border border-slate-700/60';
            iconHtml = `<div class="w-2.5 h-2.5 rounded-full bg-slate-600/40"></div>`;
          }
        }

        // Difference highlight ring (Clean glowing outline, no confusing corner badge)
        const diffRing = isDiff ? 'ring-2 ring-amber-400 shadow-md shadow-amber-400/25 ring-offset-1 ring-offset-slate-900 animate-pulse' : '';

        // Keyboard focus ring
        const kbRing = isSelected ? 'ring-2 ring-cyan-300 ring-offset-2 ring-offset-slate-900' : '';

        // Hint highlight overlay
        const hintOverlay = isHinted ? `
          <div class="absolute inset-0 rounded-2xl border-2 border-amber-400 animate-ping pointer-events-none z-30"></div>
          <div class="absolute -bottom-2 px-1.5 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-[9px] uppercase tracking-wider z-30 shadow-md">
            Tap Here
          </div>
        ` : '';

        html += `
          <button id="cell-${r}-${c}" onclick="onNeonCellTap(${r}, ${c})" class="relative group rounded-2xl ${bgStyle} ${borderStyle} ${diffRing} ${kbRing} flex items-center justify-center transition-all duration-150 active:scale-95 cursor-pointer select-none" style="touch-action: manipulation;">
            ${iconHtml}
            ${hintOverlay}
          </button>
        `;
      }
    }

    gridEl.innerHTML = html;
  }

  function updateHUD() {
    const movesEl = document.getElementById('neonMoveCount');
    if (movesEl) movesEl.textContent = state.movesTaken;

    const undoBtn = document.getElementById('neonUndoBtn');
    if (undoBtn) undoBtn.disabled = state.history.length === 0;
  }

  // --- Modals & Overlays ---

  // 1. Victory Celebration Modal
  function showVictoryModal(stars, moves, par) {
    const old = document.getElementById('neonVictoryModal');
    if (old) old.remove();

    const lvl = state.currentLevel;
    const isPerfect = stars === 3;

    const starsHtml = [1, 2, 3].map(i => `
      <i class="fa-solid fa-star text-3xl sm:text-4xl ${i <= stars ? 'text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.8)]' : 'text-slate-700'}"></i>
    `).join('');

    const modal = document.createElement('div');
    modal.id = 'neonVictoryModal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn';
    modal.innerHTML = `
      <div class="relative w-full max-w-sm rounded-3xl bg-slate-900 border border-cyan-500/40 p-6 text-center shadow-2xl shadow-cyan-500/20 glow-cyan-box">
        
        <div class="w-16 h-16 mx-auto -mt-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-emerald-400 text-slate-950 flex items-center justify-center text-3xl shadow-lg shadow-cyan-500/40 border-2 border-white">
          <i class="fa-solid fa-trophy"></i>
        </div>

        <div class="mt-3">
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1.5 shadow-sm">
            <i class="fa-solid fa-circle-check"></i>
            <span>PUZZLE SOLVED!</span>
          </div>
          <h3 class="text-xl font-black text-white uppercase tracking-wider">Level Completed</h3>
          <p class="text-xs text-cyan-300 font-semibold mb-3">${lvl.title}</p>
        </div>

        <!-- Star Rating -->
        <div class="flex items-center justify-center gap-3 mb-5">
          ${starsHtml}
        </div>

        <!-- Metrics Box -->
        <div class="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-950/80 border border-slate-800 mb-5">
          <div>
            <span class="text-[9px] uppercase font-bold text-slate-500">Moves</span>
            <p class="text-base font-black text-cyan-300 font-mono">${moves} / ${par}</p>
          </div>
          <div>
            <span class="text-[9px] uppercase font-bold text-slate-500">Efficiency</span>
            <p class="text-base font-black ${isPerfect ? 'text-emerald-400' : 'text-purple-400'} font-mono">${isPerfect ? '100% (Par)' : `${Math.round((par / moves) * 100)}%`}</p>
          </div>
          <div>
            <span class="text-[9px] uppercase font-bold text-slate-500">Time</span>
            <p class="text-base font-black text-slate-300 font-mono">${state.elapsedSeconds}s</p>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="space-y-2">
          ${state.mode === 'campaign' && state.campaignIndex < CAMPAIGN_LEVEL_DATA.length - 1 ? `
            <button onclick="nextNeonCampaignLevel()" class="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/30 transition active:scale-98">
              <span>Next Level</span>
              <i class="fa-solid fa-arrow-right"></i>
            </button>
          ` : state.mode === 'endless' ? `
            <button onclick="nextNeonEndlessLevel()" class="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-purple-500/30 transition active:scale-98">
              <span>Next Stage (#${state.endlessStreak + 1})</span>
              <i class="fa-solid fa-forward-step"></i>
            </button>
          ` : `
            <button onclick="replayNeonLevel()" class="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-98">
              <i class="fa-solid fa-rotate-right"></i>
              <span>Replay Level</span>
            </button>
          `}

          <div class="grid grid-cols-2 gap-2">
            <button onclick="shareNeonScore()" class="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs flex items-center justify-center gap-2 border border-cyan-500/30 transition">
              <i class="fa-solid fa-share-nodes text-xs"></i>
              <span>Share</span>
            </button>
            <button onclick="openNeonLevelsModal()" class="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition">
              <i class="fa-solid fa-list text-xs"></i>
              <span>Levels</span>
            </button>
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(modal);
  }

  function showTimeAttackSummaryModal() {
    const old = document.getElementById('neonTimeAttackModal');
    if (old) old.remove();

    const stats = loadStats();
    const modal = document.createElement('div');
    modal.id = 'neonTimeAttackModal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn';
    modal.innerHTML = `
      <div class="relative w-full max-w-sm rounded-3xl bg-slate-900 border border-rose-500/40 p-6 text-center shadow-2xl shadow-rose-500/20">
        <div class="w-16 h-16 mx-auto -mt-12 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-400 text-slate-950 flex items-center justify-center text-3xl shadow-lg shadow-rose-500/40 border-2 border-white">
          <i class="fa-solid fa-hourglass-end"></i>
        </div>
        <h3 class="text-xl font-black text-rose-400 uppercase tracking-widest mt-4">Time Expired!</h3>
        <p class="text-xs text-slate-400 mb-4">Time Attack Session Completed</p>
        <div class="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-950/80 border border-slate-800 mb-5">
          <div>
            <span class="text-[9px] uppercase font-bold text-slate-500">Final Score</span>
            <p class="text-2xl font-black text-white font-mono">${state.timeAttackScore}</p>
          </div>
          <div>
            <span class="text-[9px] uppercase font-bold text-slate-500">All-Time Best</span>
            <p class="text-2xl font-black text-rose-400 font-mono">${stats.timeAttackBest || state.timeAttackScore}</p>
          </div>
        </div>
        <div class="space-y-2">
          <button onclick="window.switchNeonMode('timeAttack')" class="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition active:scale-98">
            <i class="fa-solid fa-rotate-right"></i>
            <span>Play Again</span>
          </button>
          <button onclick="openNeonLevelsModal()" class="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase transition">
            <span>Change Mode</span>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // 2. Level Selector Modal
  function openLevelsModal() {
    const old = document.getElementById('neonLevelsModal');
    if (old) old.remove();

    const progress = loadProgress();
    const tiers = ['beginner', 'intermediate', 'advanced', 'expert'];

    const modal = document.createElement('div');
    modal.id = 'neonLevelsModal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-fadeIn';
    modal.innerHTML = `
      <div class="relative w-full max-w-lg max-h-[90vh] rounded-3xl bg-slate-900 border border-cyan-500/30 p-5 flex flex-col shadow-2xl overflow-hidden">
        
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
              <i class="fa-solid fa-cubes-stacked text-sm"></i>
            </div>
            <div>
              <h3 class="text-base font-black text-cyan-300 uppercase tracking-wider">Mission Directory</h3>
              <p class="text-[11px] text-slate-400">52 Cybernetic Circuit Challenges</p>
            </div>
          </div>
          <button onclick="closeNeonLevelsModal()" class="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center">
            <i class="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        <!-- Game Mode Tabs -->
        <div class="grid grid-cols-4 gap-1.5 my-3 p-1 rounded-xl bg-slate-950 border border-slate-800 text-[10px] font-bold uppercase tracking-wider text-center">
          <button onclick="switchNeonMode('campaign')" class="py-1.5 rounded-lg ${state.mode === 'campaign' ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'} transition">Campaign</button>
          <button onclick="switchNeonMode('daily')" class="py-1.5 rounded-lg ${state.mode === 'daily' ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'} transition">Daily</button>
          <button onclick="switchNeonMode('endless')" class="py-1.5 rounded-lg ${state.mode === 'endless' ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'} transition">Endless</button>
          <button onclick="switchNeonMode('timeAttack')" class="py-1.5 rounded-lg ${state.mode === 'timeAttack' ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'} transition">Timed</button>
        </div>

        <!-- Levels List (Scrollable) -->
        <div class="flex-1 overflow-y-auto space-y-4 pr-1">
          ${tiers.map(tier => {
            const levels = CAMPAIGN_LEVEL_DATA.filter(l => l.tier === tier);
            return `
              <div>
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-black uppercase tracking-wider text-slate-400">${tier} Tier</span>
                  <span class="text-[10px] text-slate-500">${levels.length} Levels</span>
                </div>
                <div class="grid grid-cols-5 gap-2">
                  ${levels.map((lvl, idx) => {
                    const globalIdx = lvl.num - 1;
                    const p = progress[`campaign-${lvl.num}`];
                    const isUnlocked = globalIdx === 0 || progress[`campaign-${globalIdx}`]?.completed;
                    const stars = p?.stars || 0;

                    return `
                      <button onclick="${isUnlocked ? `selectNeonLevel(${globalIdx})` : ''}" ${!isUnlocked ? 'disabled' : ''} class="p-2 rounded-xl flex flex-col items-center justify-center border transition-all ${
                        isUnlocked 
                          ? p?.completed 
                            ? 'bg-slate-950/80 border-cyan-500/50 text-cyan-300 hover:border-cyan-400 active:scale-95' 
                            : 'bg-slate-900 border-slate-700 text-white hover:border-cyan-500/40 active:scale-95'
                          : 'bg-slate-950/40 border-slate-800/40 text-slate-600 opacity-50 cursor-not-allowed'
                      }">
                        <span class="text-xs font-black font-mono mb-1">${lvl.num}</span>
                        ${isUnlocked ? `
                          <div class="flex items-center gap-0.5 text-[8px] ${stars > 0 ? 'text-amber-400' : 'text-slate-600'}">
                            ${[1, 2, 3].map(s => `<i class="fa-solid fa-star ${s <= stars ? 'text-amber-400' : 'text-slate-700'}"></i>`).join('')}
                          </div>
                        ` : `
                          <i class="fa-solid fa-lock text-[10px] text-slate-700"></i>
                        `}
                      </button>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>

      </div>
    `;
    document.body.appendChild(modal);
  }

  // 3. Settings Modal
  function openSettingsModal() {
    const old = document.getElementById('neonSettingsModal');
    if (old) old.remove();

    const stats = loadStats();

    const modal = document.createElement('div');
    modal.id = 'neonSettingsModal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn';
    modal.innerHTML = `
      <div class="relative w-full max-w-sm rounded-3xl bg-slate-900 border border-cyan-500/30 p-5 shadow-2xl">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div class="flex items-center gap-2">
            <i class="fa-solid fa-sliders text-cyan-400"></i>
            <h3 class="text-base font-black text-cyan-300 uppercase">System Settings</h3>
          </div>
          <button onclick="closeNeonSettingsModal()" class="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center">
            <i class="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        <div class="space-y-3.5 mb-5 text-xs">
          <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <div>
              <p class="font-bold text-slate-200">Sound Synthesizer</p>
              <p class="text-[10px] text-slate-500">Procedural audio effects</p>
            </div>
            <input type="checkbox" id="neonSoundToggle" ${NeonAudio.isEnabled() ? 'checked' : ''} onchange="toggleNeonSound(this.checked)" class="w-4 h-4 accent-cyan-400 rounded">
          </div>

          <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <div>
              <p class="font-bold text-slate-200">Ambient Drone</p>
              <p class="text-[10px] text-slate-500">Subtle background cyber tone</p>
            </div>
            <input type="checkbox" id="neonAmbientToggle" onchange="toggleNeonAmbient(this.checked)" class="w-4 h-4 accent-cyan-400 rounded">
          </div>

          <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <div>
              <p class="font-bold text-slate-200">Difference Overlay</p>
              <p class="text-[10px] text-slate-500">Highlight target differences</p>
            </div>
            <input type="checkbox" id="neonDiffToggle" ${state.diffHighlightEnabled ? 'checked' : ''} onchange="toggleNeonDiff(this.checked)" class="w-4 h-4 accent-cyan-400 rounded">
          </div>
        </div>

        <!-- Career Telemetry -->
        <div class="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 mb-4">
          <p class="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-wider">Career Telemetry</p>
          <div class="grid grid-cols-2 gap-2 text-[11px]">
            <div>Total Solved: <strong class="text-cyan-300 font-mono">${stats.totalSolved}</strong></div>
            <div>Stars Earned: <strong class="text-amber-400 font-mono">${stats.totalStars}</strong></div>
            <div>Daily Streak: <strong class="text-emerald-400 font-mono">${stats.dailyStreak} d</strong></div>
            <div>Endless High: <strong class="text-purple-400 font-mono">${stats.endlessBest}</strong></div>
          </div>
        </div>

        <button onclick="closeNeonSettingsModal()" class="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs uppercase transition">
          Close Settings
        </button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // 4. Tutorial & Onboarding Modal
  function openTutorialModal() {
    const old = document.getElementById('neonTutorialModal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'neonTutorialModal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn';
    modal.innerHTML = `
      <div class="relative w-full max-w-md max-h-[90vh] rounded-3xl bg-slate-900 border border-cyan-500/30 p-5 flex flex-col shadow-2xl overflow-hidden text-xs">
        
        <div class="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
          <div class="flex items-center gap-2">
            <i class="fa-solid fa-book-skull text-cyan-400"></i>
            <h3 class="text-base font-black text-cyan-300 uppercase">Field Operational Manual</h3>
          </div>
          <button onclick="closeNeonTutorialModal()" class="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center">
            <i class="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto space-y-3.5 pr-1 text-slate-300 leading-relaxed">
          <div class="p-3 rounded-2xl bg-slate-950/80 border border-cyan-500/20">
            <h4 class="font-bold text-cyan-300 mb-1 flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full bg-cyan-400"></span> 1. Core Mission Objective
            </h4>
            <p class="text-[11px] text-slate-400">Transform your starting grid to match the <strong>Target Hologram</strong> shown in the top right. Match all nodes in the fewest moves possible.</p>
          </div>

          <div class="p-3 rounded-2xl bg-slate-950/80 border border-cyan-500/20">
            <h4 class="font-bold text-cyan-300 mb-1 flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full bg-cyan-400"></span> 2. Standard Pulse Node
            </h4>
            <p class="text-[11px] text-slate-400">Tapping a standard node inverts its state and pulses energy to its <strong>4 orthogonal neighbors</strong> (Up, Down, Left, Right).</p>
          </div>

          <div class="p-3 rounded-2xl bg-slate-950/80 border border-pink-500/20">
            <h4 class="font-bold text-pink-300 mb-1 flex items-center gap-1.5">
              <i class="fa-solid fa-crosshairs text-pink-400 text-xs"></i> 3. Laser Beam Node
            </h4>
            <p class="text-[11px] text-slate-400">Tapping a Laser Node fires energetic beams across its <strong>entire row and column</strong> in a single activation blast.</p>
          </div>

          <div class="p-3 rounded-2xl bg-slate-950/80 border border-purple-500/20">
            <h4 class="font-bold text-purple-300 mb-1 flex items-center gap-1.5">
              <i class="fa-solid fa-arrows-spin text-purple-400 text-xs"></i> 4. Rotor Diagonal Node
            </h4>
            <p class="text-[11px] text-slate-400">Tapping a Rotor Node projects flux diagonally into its <strong>4 corner neighbors</strong>.</p>
          </div>

          <div class="p-3 rounded-2xl bg-slate-950/80 border border-violet-500/20">
            <h4 class="font-bold text-violet-300 mb-1 flex items-center gap-1.5">
              <i class="fa-solid fa-atom text-violet-400 text-xs"></i> 5. Quantum Entangled Twins
            </h4>
            <p class="text-[11px] text-slate-400">Quantum nodes are telepathically entangled. Activating one instantly triggers its <strong>paired twin</strong> across the board.</p>
          </div>

          <div class="p-3 rounded-2xl bg-slate-950/80 border border-amber-500/20">
            <h4 class="font-bold text-amber-300 mb-1 flex items-center gap-1.5">
              <i class="fa-solid fa-lock text-amber-400 text-xs"></i> 6. Locked Core Barrier
            </h4>
            <p class="text-[11px] text-slate-400">Locked cores <strong>cannot be clicked directly</strong>! You must manipulate surrounding nodes to satisfy the core's required target state.</p>
          </div>
        </div>

        <button onclick="closeNeonTutorialModal()" class="w-full mt-3 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black text-xs uppercase tracking-wider transition">
          Acknowledge & Continue
        </button>

      </div>
    `;
    document.body.appendChild(modal);
  }

  // --- Keyboard Event Handler ---
  function handleKeyDown(e) {
    if (typeof gamesSubView !== 'undefined' && gamesSubView !== 'neon_grid') return;
    if (state.isComplete || !state.currentLevel) return;

    const { rows, cols } = state.currentLevel;
    let { r, c } = state.selectedCell || { r: 0, c: 0 };

    if (e.key === 'ArrowUp') {
      r = Math.max(0, r - 1);
      state.selectedCell = { r, c };
      e.preventDefault();
      renderGridCells();
    } else if (e.key === 'ArrowDown') {
      r = Math.min(rows - 1, r + 1);
      state.selectedCell = { r, c };
      e.preventDefault();
      renderGridCells();
    } else if (e.key === 'ArrowLeft') {
      c = Math.max(0, c - 1);
      state.selectedCell = { r, c };
      e.preventDefault();
      renderGridCells();
    } else if (e.key === 'ArrowRight') {
      c = Math.min(cols - 1, c + 1);
      state.selectedCell = { r, c };
      e.preventDefault();
      renderGridCells();
    } else if (e.key === 'Enter' || e.key === ' ') {
      onCellClicked(r, c);
      e.preventDefault();
    } else if (e.key.toLowerCase() === 'u' || (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey))) {
      undoMove();
      e.preventDefault();
    } else if (e.key.toLowerCase() === 'r') {
      resetLevel();
      e.preventDefault();
    } else if (e.key.toLowerCase() === 'h') {
      giveHint();
      e.preventDefault();
    } else if (e.key.toLowerCase() === 'd') {
      toggleDiffOverlay();
      e.preventDefault();
    }
  }

  window.addEventListener('keydown', handleKeyDown);

  // --- Global Public Handlers ---
  window.openNeonGridGame = function (mode = 'campaign', levelIndex = 0) {
    if (typeof gamesSubView !== 'undefined') {
      gamesSubView = 'neon_grid';
      try {
        localStorage.setItem('lifeTracker_gamesSubView', 'neon_grid');
      } catch (e) {}
    }

    loadSettings();
    state.mode = mode;
    state.campaignIndex = levelIndex;

    let targetLevel = null;
    if (mode === 'daily') {
      targetLevel = generateDailyLevel(getLocalDateKey());
    } else if (mode === 'endless') {
      state.endlessStreak = 1;
      targetLevel = generateEndlessLevel(1);
    } else if (mode === 'timeAttack') {
      state.timeAttackTimeLeft = 90;
      state.timeAttackScore = 0;
      targetLevel = buildLevel(CAMPAIGN_LEVEL_DATA[Math.floor(Math.random() * 15)]);
    } else if (mode === 'practice') {
      targetLevel = generatePracticeLevel();
    } else {
      // Campaign
      state.mode = 'campaign';
      targetLevel = buildLevel(CAMPAIGN_LEVEL_DATA[levelIndex]);
    }

    initLevel(targetLevel);
  };

  window.renderNeonGridGame = function () {
    if (!state.currentLevel) {
      window.openNeonGridGame('campaign', 0);
    } else {
      renderGameScreen();
    }
  };

  window.cleanupNeonGridGame = function () {
    stopTimer();
    NeonAudio.setAmbient(false);
    ['neonVictoryModal', 'neonTimeAttackModal', 'neonLevelsModal', 'neonSettingsModal', 'neonTutorialModal', 'neonToast'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    const container = document.getElementById('mainContainer');
    if (container) {
      container.style.paddingTop = '';
      container.style.paddingBottom = '';
      container.classList.add('space-y-5');
    }
  };

  window.onNeonCellTap = function (r, c) {
    onCellClicked(r, c);
  };

  window.undoNeonMove = function () {
    undoMove();
  };

  window.resetNeonLevel = function () {
    resetLevel();
  };

  window.giveNeonHint = function () {
    giveHint();
  };

  window.openNeonLevelsModal = function () {
    openLevelsModal();
  };

  window.closeNeonLevelsModal = function () {
    const modal = document.getElementById('neonLevelsModal');
    if (modal) modal.remove();
  };

  window.openNeonSettingsModal = function () {
    openSettingsModal();
  };

  window.closeNeonSettingsModal = function () {
    const modal = document.getElementById('neonSettingsModal');
    if (modal) modal.remove();
  };

  window.openNeonTutorialModal = function () {
    openTutorialModal();
  };

  window.closeNeonTutorialModal = function () {
    const modal = document.getElementById('neonTutorialModal');
    if (modal) modal.remove();
  };

  window.selectNeonLevel = function (idx) {
    window.closeNeonLevelsModal();
    const modal = document.getElementById('neonVictoryModal');
    if (modal) modal.remove();
    state.campaignIndex = idx;
    state.mode = 'campaign';
    initLevel(buildLevel(CAMPAIGN_LEVEL_DATA[idx]));
  };

  window.nextNeonCampaignLevel = function () {
    const modal = document.getElementById('neonVictoryModal');
    if (modal) modal.remove();
    if (state.campaignIndex < CAMPAIGN_LEVEL_DATA.length - 1) {
      state.campaignIndex++;
      initLevel(buildLevel(CAMPAIGN_LEVEL_DATA[state.campaignIndex]));
    } else {
      openLevelsModal();
    }
  };

  window.nextNeonEndlessLevel = function () {
    const modal = document.getElementById('neonVictoryModal');
    if (modal) modal.remove();
    state.endlessStreak++;
    initLevel(generateEndlessLevel(state.endlessStreak));
  };

  window.replayNeonLevel = function () {
    const modal = document.getElementById('neonVictoryModal');
    if (modal) modal.remove();
    if (state.currentLevel) {
      initLevel(state.currentLevel);
    }
  };

  window.switchNeonMode = function (mode) {
    window.closeNeonLevelsModal();
    window.openNeonGridGame(mode, 0);
  };

  window.toggleNeonSound = function (enabled) {
    NeonAudio.setEnabled(enabled);
    saveSettings();
  };

  window.toggleNeonAmbient = function (enabled) {
    NeonAudio.setAmbient(enabled);
  };

  window.toggleNeonDiff = function (enabled) {
    state.diffHighlightEnabled = enabled;
    saveSettings();
    renderGridCells();
  };

  window.shareNeonScore = async function () {
    const lvl = state.currentLevel;
    const shareText = `⚡ Neon Grid — Solved ${lvl.title} in ${state.movesTaken} moves (Par: ${lvl.parMoves})! Can you beat my circuit efficiency?`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Neon Grid — Logic Puzzle',
          text: shareText,
          url: window.location.href,
        });
      } catch (e) {}
    } else {
      navigator.clipboard?.writeText(shareText);
      showNeonToast('Result copied to clipboard!');
    }
  };

})();
