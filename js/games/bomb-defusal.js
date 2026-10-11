// ==============================================================================
// Bomb Defusal - Retro Arcade Game Engine (Enhanced Visuals & UX Edition)
// ==============================================================================
// Complete, polished 2D arcade bomb-defusal game for Life Tracker PWA.
// Features:
// - Cyberpunk / Retro Arcade theme with high-fidelity canvas rendering
// - HTML5 Canvas 60fps delta-time loop with High-DPI auto-scaling
// - Rich HTML/Tailwind HUD and frosted glass modal overlays (Start, Pause, Game Over)
// - Ergonomic mobile touch pads, keyboard controls, and smooth direct canvas dragging
// - Web Audio API synthesized retro arcade sound effects (100% offline)
// - Dynamic difficulty progression with 4 distinct bomb varieties
// - Particle systems: defusal sparks, fuse embers, ground explosions, thruster flames
// - Screen shake, combo multipliers, floating point popups, and High Score persistence
// - Clean unmount lifecycle management
// ==============================================================================

(function () {
  'use strict';

  // --- Virtual Coordinate System ---
  const V_WIDTH = 420;
  const V_HEIGHT = 560;
  const GROUND_Y = 495;
  const PLAYER_Y = 445;
  const PLAYER_WIDTH = 58;
  const PLAYER_HEIGHT = 48;
  const PLAYER_SPEED = 420; // virtual pixels per sec
  const STORAGE_HIGH_SCORE = 'bomb_defusal_high_score';
  const STORAGE_SOUND_PREF = 'bomb_defusal_sound_enabled';

  // Game States
  const STATE = {
    START: 'start',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAMEOVER: 'gameover'
  };

  // --- Web Audio Synthesizer (Retro Arcade Sound System) ---
  const Sound = (() => {
    let ctx = null;
    let enabled = localStorage.getItem(STORAGE_SOUND_PREF) !== 'false';

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
        localStorage.setItem(STORAGE_SOUND_PREF, enabled ? 'true' : 'false');
        return enabled;
      },
      playDefuse(combo = 1) {
        if (!enabled) return;
        try {
          const c = getCtx();
          if (!c) return;
          const now = c.currentTime;

          // Harmonic chime scaling with combo streak
          const baseFreq = 480 + Math.min((combo - 1) * 80, 640);
          const freqs = [baseFreq, baseFreq * 1.25, baseFreq * 1.5];

          freqs.forEach((freq, idx) => {
            const osc = c.createOscillator();
            const gain = c.createGain();
            const t = now + idx * 0.035;

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t);
            osc.frequency.exponentialRampToValueAtTime(freq * 1.3, t + 0.1);

            gain.gain.setValueAtTime(0.16, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

            osc.connect(gain);
            gain.connect(c.destination);
            osc.start(t);
            osc.stop(t + 0.12);
          });
        } catch (_) {}
      },
      playExplosion() {
        if (!enabled) return;
        try {
          const c = getCtx();
          if (!c) return;
          const now = c.currentTime;

          // Low-frequency impact punch
          const osc = c.createOscillator();
          const gain = c.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(160, now);
          osc.frequency.exponentialRampToValueAtTime(30, now + 0.4);

          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

          osc.connect(gain);
          gain.connect(c.destination);
          osc.start(now);
          osc.stop(now + 0.42);
        } catch (_) {}
      },
      playPowerup() {
        if (!enabled) return;
        try {
          const c = getCtx();
          if (!c) return;
          const notes = [587.33, 739.99, 880, 1174.66]; // D5, F#5, A5, D6
          notes.forEach((freq, idx) => {
            const osc = c.createOscillator();
            const gain = c.createGain();
            const t = c.currentTime + idx * 0.055;
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(0.18, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            osc.connect(gain);
            gain.connect(c.destination);
            osc.start(t);
            osc.stop(t + 0.12);
          });
        } catch (_) {}
      },
      playLevelUp() {
        if (!enabled) return;
        try {
          const c = getCtx();
          if (!c) return;
          const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
          notes.forEach((freq, idx) => {
            const osc = c.createOscillator();
            const gain = c.createGain();
            const t = c.currentTime + idx * 0.06;
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(0.22, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
            osc.connect(gain);
            gain.connect(c.destination);
            osc.start(t);
            osc.stop(t + 0.16);
          });
        } catch (_) {}
      },
      playGameOver() {
        if (!enabled) return;
        try {
          const c = getCtx();
          if (!c) return;
          const notes = [329.63, 293.66, 261.63, 196.00]; // E4, D4, C4, G3
          notes.forEach((freq, idx) => {
            const osc = c.createOscillator();
            const gain = c.createGain();
            const t = c.currentTime + idx * 0.14;
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(0.2, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
            osc.connect(gain);
            gain.connect(c.destination);
            osc.start(t);
            osc.stop(t + 0.22);
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
          osc.frequency.setValueAtTime(650, now);
          gain.gain.setValueAtTime(0.09, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
          osc.connect(gain);
          gain.connect(c.destination);
          osc.start(now);
          osc.stop(now + 0.04);
        } catch (_) {}
      }
    };
  })();

  // --- Game Engine Variables ---
  let canvas = null;
  let ctx = null;
  let animFrameId = null;
  let lastTimestamp = 0;
  let currentState = STATE.START;
  let isMounted = false;

  // Player State
  const player = {
    x: V_WIDTH / 2 - PLAYER_WIDTH / 2,
    y: PLAYER_Y,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    vx: 0,
    targetX: null,
    facing: 1, // 1: right, -1: left
    tilt: 0,
    animTimer: 0,
    defuseGlow: 0 // countdown timer for catch celebration glow
  };

  // Input states
  const input = {
    left: false,
    right: false,
    pointerActive: false,
    touchX: null
  };

  // Gameplay State
  let score = 0;
  let lives = 3;
  let level = 1;
  let highScore = 0;
  let defusedCount = 0;
  let combo = 0;
  let maxCombo = 0;
  let lastDefuseTime = 0;
  let levelUpBannerTimer = 0;

  // Spawning & Difficulty
  let spawnTimer = 0;
  let bombs = [];
  let particles = [];
  let floatingTexts = [];
  let stars = [];
  let screenShakeTimer = 0;
  let screenShakeIntensity = 0;

  // Starfield Generator
  function initStars() {
    stars = [];
    for (let i = 0; i < 50; i++) {
      stars.push({
        x: Math.random() * V_WIDTH,
        y: Math.random() * (GROUND_Y - 30),
        size: Math.random() * 2.2 + 0.6,
        speed: Math.random() * 2 + 1,
        phase: Math.random() * Math.PI * 2,
        isSpike: Math.random() > 0.75
      });
    }
  }

  // Difficulty Curves
  function getDifficultyConfig() {
    const currentLvl = Math.max(1, Math.floor(score / 950) + 1);
    const baseSpeed = 145 + (currentLvl - 1) * 28;
    const speed = Math.min(baseSpeed, 360);
    const spawnInterval = Math.max(0.65, 1.8 - (currentLvl - 1) * 0.16);
    const maxConcurrent = Math.min(6, 2 + Math.floor(currentLvl / 2));
    return { currentLvl, speed, spawnInterval, maxConcurrent };
  }

  // --- Reset & Initializers ---
  function resetGame() {
    score = 0;
    lives = 3;
    level = 1;
    combo = 0;
    maxCombo = 0;
    defusedCount = 0;
    bombs = [];
    particles = [];
    floatingTexts = [];
    spawnTimer = 0.4;
    screenShakeTimer = 0;
    levelUpBannerTimer = 0;
    player.x = V_WIDTH / 2 - PLAYER_WIDTH / 2;
    player.vx = 0;
    player.tilt = 0;
    player.targetX = null;
    player.defuseGlow = 0;
    input.left = false;
    input.right = false;
    input.pointerActive = false;
    input.touchX = null;
    highScore = parseInt(localStorage.getItem(STORAGE_HIGH_SCORE) || '0', 10);
    updateHtmlHud();
  }

  function spawnBomb() {
    const { speed, currentLvl } = getDifficultyConfig();
    const radius = 18;
    const minX = radius + 18;
    const maxX = V_WIDTH - radius - 18;
    const x = minX + Math.random() * (maxX - minX);

    const rand = Math.random();
    let type = 'standard';
    let bombSpeed = speed * (0.92 + Math.random() * 0.22);
    let pts = 100 * currentLvl;
    let color = '#1e293b';

    if (rand < 0.08) {
      // Golden EMP / Shield Orb
      type = 'golden';
      bombSpeed = speed * 1.05;
      pts = 350 * currentLvl;
      color = '#f59e0b';
    } else if (rand < 0.28 && currentLvl >= 2) {
      // Fast Rocket Missile
      type = 'fast';
      bombSpeed = speed * 1.45;
      pts = 200 * currentLvl;
      color = '#ef4444';
    } else if (rand < 0.44 && currentLvl >= 3) {
      // Heavy Timed TNT
      type = 'heavy';
      bombSpeed = speed * 0.85;
      pts = 250 * currentLvl;
      color = '#475569';
    }

    bombs.push({
      x,
      y: -radius - 12,
      vy: bombSpeed,
      vx: (Math.random() - 0.5) * 14,
      radius,
      type,
      points: pts,
      color,
      rotation: Math.random() * Math.PI,
      rotSpeed: (Math.random() - 0.5) * 2,
      fuseSparkTimer: 0,
      timerCount: 3
    });
  }

  // --- Particle Systems ---
  function addDefusalSparks(x, y, isGolden = false) {
    const count = isGolden ? 28 : 16;
    const colors = isGolden
      ? ['#fbbf24', '#f59e0b', '#fef08a', '#38bdf8', '#ffffff']
      : ['#38bdf8', '#818cf8', '#c084fc', '#fbbf24', '#ffffff'];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 200;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        size: Math.random() * 3.8 + 1.6,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 0.45 + Math.random() * 0.4,
        maxLife: 0.85,
        gravity: 140,
        isStar: Math.random() > 0.4
      });
    }
  }

  function addExplosion(x, y) {
    const count = 32;
    const colors = ['#f97316', '#ef4444', '#facc15', '#fb923c', '#475569', '#1e293b'];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 240;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 65,
        size: Math.random() * 6.5 + 2.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 0.5 + Math.random() * 0.45,
        maxLife: 0.95,
        gravity: 170,
        isStar: false
      });
    }
  }

  function addFloatingText(text, x, y, color = '#38bdf8', size = 16) {
    floatingTexts.push({
      text,
      x,
      y,
      color,
      size,
      life: 0.85,
      maxLife: 0.85
    });
  }

  function triggerScreenShake(duration = 0.28, intensity = 6.5) {
    screenShakeTimer = duration;
    screenShakeIntensity = intensity;
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(35);
      } catch (_) {}
    }
  }

  // --- Main Update Logic ---
  function update(dt) {
    if (screenShakeTimer > 0) screenShakeTimer -= dt;
    if (levelUpBannerTimer > 0) levelUpBannerTimer -= dt;

    updateEffects(dt);

    if (currentState !== STATE.PLAYING) return;

    // 1. Player Movement & Easing
    let moveDir = 0;
    if (input.left) moveDir -= 1;
    if (input.right) moveDir += 1;

    // Smooth Touch Drag Easing
    if (input.pointerActive && input.touchX !== null) {
      const playerCenter = player.x + player.width / 2;
      const diff = input.touchX - playerCenter;
      if (Math.abs(diff) > 4) {
        moveDir = Math.sign(diff);
        // Direct speed dampening for close touch targets
        const lerpFactor = Math.min(Math.abs(diff) / 30, 1);
        player.vx = moveDir * PLAYER_SPEED * lerpFactor;
      } else {
        player.vx = 0;
      }
    } else if (moveDir !== 0) {
      player.vx = moveDir * PLAYER_SPEED;
    } else {
      player.vx = 0;
    }

    if (moveDir !== 0) {
      player.facing = moveDir;
      player.animTimer += dt * 14;
      // Tilt animation
      player.tilt = Math.min(Math.max(player.tilt + moveDir * dt * 4, -0.2), 0.2);
    } else {
      player.animTimer = 0;
      player.tilt *= 0.82; // restore upright
    }

    player.x += player.vx * dt;

    // Boundary constraints
    const minX = 12;
    const maxX = V_WIDTH - 12 - player.width;
    if (player.x < minX) player.x = minX;
    if (player.x > maxX) player.x = maxX;

    if (player.defuseGlow > 0) player.defuseGlow -= dt;

    // 2. Difficulty & Progression
    const diff = getDifficultyConfig();
    if (diff.currentLvl > level) {
      level = diff.currentLvl;
      levelUpBannerTimer = 1.8;
      Sound.playLevelUp();
      addFloatingText(`★ LEVEL ${level} ★`, V_WIDTH / 2, 200, '#facc15', 22);
    }

    spawnTimer -= dt;
    if (spawnTimer <= 0 && bombs.length < diff.maxConcurrent) {
      spawnBomb();
      spawnTimer = diff.spawnInterval;
    }

    // 3. Falling Bombs & Collision Detection
    const catcherTop = player.y - 6;
    const catcherBottom = player.y + 24;
    const catcherLeft = player.x - 6;
    const catcherRight = player.x + player.width + 6;

    const remainingBombs = [];
    const now = Date.now();

    for (let i = 0; i < bombs.length; i++) {
      const b = bombs[i];
      b.y += b.vy * dt;
      b.x += b.vx * dt;
      b.rotation += b.rotSpeed * dt;

      // Wall bouncing
      if (b.x < b.radius + 10) {
        b.x = b.radius + 10;
        b.vx = Math.abs(b.vx);
      } else if (b.x > V_WIDTH - b.radius - 10) {
        b.x = V_WIDTH - b.radius - 10;
        b.vx = -Math.abs(b.vx);
      }

      b.fuseSparkTimer += dt;

      // Heavy bomb countdown tick
      if (b.type === 'heavy') {
        const remainingDist = GROUND_Y - b.y;
        b.timerCount = Math.max(1, Math.ceil((remainingDist / b.vy)));
      }

      // Collision Check: Catcher vs Falling Bomb
      const bBottom = b.y + b.radius;
      const bTop = b.y - b.radius;
      const bLeft = b.x - b.radius;
      const bRight = b.x + b.radius;

      const collidesWithCatcher =
        bBottom >= catcherTop &&
        bTop <= catcherBottom &&
        bRight >= catcherLeft &&
        bLeft <= catcherRight;

      if (collidesWithCatcher) {
        // DEFUSED!
        defusedCount++;
        player.defuseGlow = 0.28;

        // Combo calculation: defused within 2.8s
        if (now - lastDefuseTime < 2800) {
          combo = Math.min(combo + 1, 8);
        } else {
          combo = 1;
        }
        if (combo > maxCombo) maxCombo = combo;
        lastDefuseTime = now;

        const multiplier = 1 + (combo - 1) * 0.25;
        const awardedPoints = Math.round(b.points * multiplier);
        score += awardedPoints;

        if (score > highScore) {
          highScore = score;
          localStorage.setItem(STORAGE_HIGH_SCORE, highScore.toString());
        }

        if (b.type === 'golden') {
          Sound.playPowerup();
          addDefusalSparks(b.x, b.y, true);
          if (lives < 3) {
            lives++;
            addFloatingText('+1 LIFE! ❤️', b.x, b.y - 24, '#ec4899', 18);
          } else {
            addFloatingText(`GOLDEN BONUS +${awardedPoints}!`, b.x, b.y - 24, '#fbbf24', 18);
          }
        } else {
          Sound.playDefuse(combo);
          addDefusalSparks(b.x, b.y, false);
          const comboLabel = combo > 1 ? ` (x${combo} COMBO!)` : '';
          addFloatingText(`+${awardedPoints}${comboLabel}`, b.x, b.y - 14, '#38bdf8', 16);
        }

        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try {
            navigator.vibrate(18);
          } catch (_) {}
        }

        updateHtmlHud();
        continue;
      }

      // Ground Hit Check: Bomb hits the floor
      if (b.y + b.radius >= GROUND_Y) {
        // EXPLOSION!
        triggerScreenShake(0.3, 7.5);
        Sound.playExplosion();
        addExplosion(b.x, GROUND_Y);
        combo = 0;
        lives--;

        addFloatingText('-1 LIFE! 💥', b.x, GROUND_Y - 28, '#ef4444', 18);
        updateHtmlHud();

        if (lives <= 0) {
          triggerGameOver();
          return;
        }
        continue;
      }

      remainingBombs.push(b);
    }

    bombs = remainingBombs;
  }

  function updateEffects(dt) {
    // Particles
    const remP = [];
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.life -= dt;
      if (p.life > 0) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.gravity * dt;
        remP.push(p);
      }
    }
    particles = remP;

    // Floating text popups
    const remT = [];
    for (let i = 0; i < floatingTexts.length; i++) {
      const t = floatingTexts[i];
      t.life -= dt;
      if (t.life > 0) {
        t.y -= 38 * dt;
        remT.push(t);
      }
    }
    floatingTexts = remT;
  }

  function triggerGameOver() {
    currentState = STATE.GAMEOVER;
    Sound.playGameOver();
    if (score > highScore) {
      highScore = score;
      localStorage.setItem(STORAGE_HIGH_SCORE, highScore.toString());
    }
    updateHtmlHud();
    showModalOverlay(STATE.GAMEOVER);
  }

  // --- Rendering Pipeline ---
  function render() {
    if (!ctx || !canvas) return;

    ctx.save();

    // High-DPI Scaling to virtual dimensions
    const scaleX = canvas.width / V_WIDTH;
    const scaleY = canvas.height / V_HEIGHT;
    ctx.scale(scaleX, scaleY);

    // Screen Shake
    if (screenShakeTimer > 0) {
      const shakeAmt = screenShakeIntensity * (screenShakeTimer / 0.3);
      const shakeX = (Math.random() - 0.5) * shakeAmt * 2;
      const shakeY = (Math.random() - 0.5) * shakeAmt * 2;
      ctx.translate(shakeX, shakeY);
    }

    // 1. Cosmic Night Gradient & Starfield
    drawBackground();

    // 2. City Skyline & Cyber Ground Platform
    drawGroundAndSkyline();

    // 3. Falling Bombs & Thrusters
    drawBombs();

    // 4. Defusal Hero Character
    drawPlayer();

    // 5. Particles & Spark Systems
    drawParticles();

    // 6. Floating Score & Combo Popups
    drawFloatingTexts();

    ctx.restore();
  }

  // --- Canvas Graphics Renderers ---
  function drawBackground() {
    // Rich deep twilight gradient
    const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    grad.addColorStop(0, '#060918');
    grad.addColorStop(0.5, '#0c132c');
    grad.addColorStop(1, '#151d3b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

    // Parallax twinkling stars with 4-point spikes
    const time = Date.now() * 0.002;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const alpha = 0.25 + 0.65 * Math.abs(Math.sin(time * s.speed + s.phase));
      ctx.fillStyle = `rgba(224, 242, 254, ${alpha})`;

      if (s.isSpike) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 0.7, 0, Math.PI * 2);
        ctx.fill();
        // Subtle glow spike
        ctx.strokeStyle = `rgba(186, 230, 253, ${alpha * 0.5})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(s.x - 3, s.y);
        ctx.lineTo(s.x + 3, s.y);
        ctx.moveTo(s.x, s.y - 3);
        ctx.lineTo(s.x, s.y + 3);
        ctx.stroke();
      } else {
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }
    }

    // Glowing Neon Crescent Moon
    ctx.save();
    ctx.shadowColor = 'rgba(253, 224, 71, 0.45)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(352, 65, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#080d21';
    ctx.beginPath();
    ctx.arc(358, 61, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawGroundAndSkyline() {
    // City Skyline Silhouettes
    ctx.fillStyle = '#0b1126';
    const buildings = [
      { x: 12, w: 34, h: 75 },
      { x: 50, w: 26, h: 105 },
      { x: 80, w: 42, h: 60 },
      { x: 126, w: 32, h: 95 },
      { x: 162, w: 46, h: 120 },
      { x: 212, w: 30, h: 80 },
      { x: 246, w: 40, h: 100 },
      { x: 290, w: 44, h: 65 },
      { x: 338, w: 34, h: 110 },
      { x: 376, w: 38, h: 70 }
    ];

    buildings.forEach(b => {
      ctx.fillRect(b.x, GROUND_Y - b.h, b.w, b.h);
      // Illuminated Windows
      ctx.fillStyle = 'rgba(254, 240, 138, 0.28)';
      for (let wy = GROUND_Y - b.h + 10; wy < GROUND_Y - 14; wy += 15) {
        for (let wx = b.x + 6; wx < b.x + b.w - 6; wx += 10) {
          if ((wx * 3 + wy * 7) % 5 !== 0) {
            ctx.fillRect(wx, wy, 4, 6);
          }
        }
      }
      ctx.fillStyle = '#0b1126';
    });

    // Cyber Ground Base
    ctx.fillStyle = '#090d1a';
    ctx.fillRect(0, GROUND_Y, V_WIDTH, V_HEIGHT - GROUND_Y);

    // Glowing Laser Barrier Line
    const pulse = 0.75 + 0.25 * Math.sin(Date.now() * 0.007);
    ctx.shadowColor = 'rgba(239, 68, 68, 0.9)';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = `rgba(239, 68, 68, ${pulse})`;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(V_WIDTH, GROUND_Y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Hazard Stripes on Lower Platform
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, GROUND_Y + 4, V_WIDTH, 14);
    ctx.clip();
    ctx.fillStyle = '#eab308';
    for (let x = -20; x < V_WIDTH + 40; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y + 18);
      ctx.lineTo(x + 12, GROUND_Y + 4);
      ctx.lineTo(x + 18, GROUND_Y + 4);
      ctx.lineTo(x + 6, GROUND_Y + 18);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPlayer() {
    ctx.save();
    ctx.translate(player.x + PLAYER_WIDTH / 2, player.y + PLAYER_HEIGHT / 2);
    ctx.rotate(player.tilt);
    ctx.translate(-PLAYER_WIDTH / 2, -PLAYER_HEIGHT / 2);

    const isMoving = player.vx !== 0;
    const walkOffset = isMoving ? Math.sin(player.animTimer) * 3 : 0;
    const facing = player.facing;
    const defusing = player.defuseGlow > 0;

    // 1. Plasma Energy Defusal Basket (Top)
    ctx.save();
    const basketGlow = defusing ? '#38bdf8' : '#0284c7';
    ctx.shadowColor = defusing ? 'rgba(56, 189, 248, 0.95)' : 'rgba(2, 132, 199, 0.5)';
    ctx.shadowBlur = defusing ? 16 : 8;

    // Curved Metallic Catcher Rim
    ctx.fillStyle = defusing ? '#bae6fd' : '#475569';
    ctx.beginPath();
    ctx.ellipse(PLAYER_WIDTH / 2, 4, 25, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = basketGlow;
    ctx.stroke();

    // Glowing Plasma Arc Beam
    ctx.strokeStyle = defusing ? '#ffffff' : '#38bdf8';
    ctx.lineWidth = defusing ? 3.5 : 2;
    ctx.beginPath();
    ctx.arc(PLAYER_WIDTH / 2, 0, 27, Math.PI * 0.95, Math.PI * 2.05);
    ctx.stroke();
    ctx.restore();

    // 2. Chibi Hazmat Hero Body
    ctx.fillStyle = '#f59e0b'; // Hazard Gold
    ctx.beginPath();
    ctx.roundRect(11, 14, PLAYER_WIDTH - 22, 26, 8);
    ctx.fill();

    // Protective Vest Chevrons
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(18, 20, PLAYER_WIDTH - 36, 12, 3);
    ctx.fill();

    // 3. Cyber Helmet & Visor
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(PLAYER_WIDTH / 2, 10, 12, 0, Math.PI * 2);
    ctx.fill();

    // Glowing Cyan Visor
    const visorX = facing > 0 ? PLAYER_WIDTH / 2 + 1 : PLAYER_WIDTH / 2 - 9;
    ctx.fillStyle = '#06b6d4';
    ctx.shadowColor = 'rgba(6, 182, 212, 0.8)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.roundRect(visorX - 3, 6, 11, 7, 3);
    ctx.fill();
    ctx.shadowBlur = 0;

    // White reflective glint
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(visorX - 1, 7, 3, 2);

    // 4. Tread Boots (Animated walk)
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(11, 38 + walkOffset, 13, 9, 3);
    ctx.roundRect(PLAYER_WIDTH - 24, 38 - walkOffset, 13, 9, 3);
    ctx.fill();

    ctx.restore();
  }

  function drawBombs() {
    const time = Date.now() * 0.012;

    for (let i = 0; i < bombs.length; i++) {
      const b = bombs[i];
      ctx.save();
      ctx.translate(b.x, b.y);

      if (b.type === 'fast') {
        // Fast Rocket Missile
        ctx.rotate(Math.PI); // Pointing downward

        // Thruster flame trail
        const flameLen = 15 + Math.sin(time * 3) * 6;
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.moveTo(-6, -14);
        ctx.lineTo(6, -14);
        ctx.lineTo(0, -14 - flameLen);
        ctx.fill();

        // Sleek Rocket Body
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(0, 19);
        ctx.lineTo(13, -11);
        ctx.lineTo(-13, -11);
        ctx.closePath();
        ctx.fill();

        // Yellow warning stripe
        ctx.fillStyle = '#facc15';
        ctx.fillRect(-9, -4, 18, 5);

        // Chrome nosecone
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 13, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (b.type === 'golden') {
        // Golden Star / EMP Orb
        ctx.rotate(b.rotation);
        const pulse = 1 + Math.sin(time) * 0.12;
        ctx.scale(pulse, pulse);

        // Radiant golden aura
        const radGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, b.radius + 6);
        radGrad.addColorStop(0, '#fef08a');
        radGrad.addColorStop(0.5, '#f59e0b');
        radGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(0, 0, b.radius + 6, 0, Math.PI * 2);
        ctx.fill();

        // Core star symbol
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', 0, 1);
      } else {
        // Standard Iron Bomb & Heavy TNT
        ctx.rotate(b.rotation * 0.25);

        // 3D Spherical Radial Gradient
        const radGrad = ctx.createRadialGradient(
          -b.radius * 0.35, -b.radius * 0.35, 2,
          0, 0, b.radius
        );
        if (b.type === 'heavy') {
          radGrad.addColorStop(0, '#94a3b8');
          radGrad.addColorStop(0.4, '#475569');
          radGrad.addColorStop(1, '#1e293b');
        } else {
          radGrad.addColorStop(0, '#64748b');
          radGrad.addColorStop(0.35, '#334155');
          radGrad.addColorStop(1, '#0f172a');
        }
        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
        ctx.fill();

        // Brass fuse cap
        ctx.fillStyle = '#d97706';
        ctx.fillRect(-4, -b.radius - 4, 8, 5);

        // Curving fuse rope
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, -b.radius - 3);
        ctx.quadraticCurveTo(8, -b.radius - 12, 6, -b.radius - 18);
        ctx.stroke();

        // Burning Fuse Sparks
        const sparkX = 6 + Math.sin(time * 2) * 3;
        const sparkY = -b.radius - 18 + Math.cos(time * 2) * 3;

        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(sparkX, sparkY, 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(sparkX, sparkY, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Digital countdown for Heavy TNT
        if (b.type === 'heavy') {
          ctx.fillStyle = '#ef4444';
          ctx.font = '900 11px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`0${b.timerCount || 1}`, 0, 1);
        }
      }

      ctx.restore();
    }
  }

  function drawParticles() {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;

      if (p.isStar) {
        ctx.translate(p.x, p.y);
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawFloatingTexts() {
    for (let i = 0; i < floatingTexts.length; i++) {
      const t = floatingTexts[i];
      const alpha = Math.max(0, t.life / t.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = t.color;
      ctx.font = `900 ${t.size}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 6;
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }
  }

  // --- Animation Loop ---
  function gameLoop(timestamp) {
    if (!isMounted) return;

    if (!lastTimestamp) lastTimestamp = timestamp;
    const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.08);
    lastTimestamp = timestamp;

    update(dt);
    render();

    animFrameId = requestAnimationFrame(gameLoop);
  }

  // --- Modal Overlay Manager ---
  function showModalOverlay(state) {
    const startOverlay = document.getElementById('bombStartOverlay');
    const pauseOverlay = document.getElementById('bombPauseOverlay');
    const gameOverOverlay = document.getElementById('bombGameOverOverlay');

    if (startOverlay) startOverlay.classList.toggle('hidden', state !== STATE.START);
    if (pauseOverlay) pauseOverlay.classList.toggle('hidden', state !== STATE.PAUSED);
    if (gameOverOverlay) {
      gameOverOverlay.classList.toggle('hidden', state !== STATE.GAMEOVER);
      if (state === STATE.GAMEOVER) {
        // Populate game-over stats
        const finalScoreEl = document.getElementById('bombFinalScore');
        const bestScoreEl = document.getElementById('bombBestScore');
        const defusedEl = document.getElementById('bombDefusedCount');
        const levelEl = document.getElementById('bombFinalLevel');
        const recordBadge = document.getElementById('bombNewRecordBadge');

        if (finalScoreEl) finalScoreEl.innerText = score.toLocaleString();
        if (bestScoreEl) bestScoreEl.innerText = highScore.toLocaleString();
        if (defusedEl) defusedEl.innerText = defusedCount;
        if (levelEl) levelEl.innerText = level;

        if (recordBadge) {
          recordBadge.classList.toggle('hidden', !(score >= highScore && score > 0));
        }
      }
    }
  }

  // --- HTML HUD Updates ---
  function updateHtmlHud() {
    const scoreEl = document.getElementById('bombHudScore');
    const levelEl = document.getElementById('bombHudLevel');
    const bestEl = document.getElementById('bombHudBest');
    const comboEl = document.getElementById('bombHudCombo');
    const heartsEl = document.getElementById('bombHudHearts');
    const soundBtn = document.getElementById('bombSoundToggleBtn');
    const pauseBtn = document.getElementById('bombPauseToggleBtn');

    if (scoreEl) scoreEl.innerText = score.toString().padStart(5, '0');
    if (levelEl) levelEl.innerText = `Lvl ${level}`;
    if (bestEl) bestEl.innerText = highScore.toLocaleString();

    // Combo Pill
    if (comboEl) {
      if (combo > 1 && currentState === STATE.PLAYING) {
        comboEl.classList.remove('hidden');
        comboEl.innerHTML = `<i class="fa-solid fa-fire text-amber-400 animate-bounce"></i> ${combo}x COMBO`;
      } else {
        comboEl.classList.add('hidden');
      }
    }

    // Hearts (Lives)
    if (heartsEl) {
      let heartsHtml = '';
      for (let i = 0; i < 3; i++) {
        if (i < lives) {
          heartsHtml += '<i class="fa-solid fa-heart text-rose-500 drop-shadow-sm text-sm"></i>';
        } else {
          heartsHtml += '<i class="fa-regular fa-heart text-slate-500 text-sm opacity-60"></i>';
        }
      }
      heartsEl.innerHTML = heartsHtml;
    }

    // Sound Button
    if (soundBtn) {
      soundBtn.innerHTML = Sound.isEnabled()
        ? '<i class="fa-solid fa-volume-high text-amber-500"></i>'
        : '<i class="fa-solid fa-volume-xmark text-slate-400"></i>';
    }

    // Pause Button
    if (pauseBtn) {
      pauseBtn.innerHTML = currentState === STATE.PAUSED
        ? '<i class="fa-solid fa-play text-emerald-500"></i>'
        : '<i class="fa-solid fa-pause text-slate-300"></i>';
    }
  }

  // --- User Action Handlers ---
  function startGame() {
    Sound.playClick();
    resetGame();
    currentState = STATE.PLAYING;
    showModalOverlay(STATE.PLAYING);
    updateHtmlHud();
    lastTimestamp = performance.now();
  }

  function togglePause() {
    Sound.playClick();
    if (currentState === STATE.PLAYING) {
      currentState = STATE.PAUSED;
      showModalOverlay(STATE.PAUSED);
    } else if (currentState === STATE.PAUSED) {
      currentState = STATE.PLAYING;
      showModalOverlay(STATE.PLAYING);
      lastTimestamp = performance.now();
    }
    updateHtmlHud();
  }

  function restartGame() {
    Sound.playClick();
    resetGame();
    currentState = STATE.PLAYING;
    showModalOverlay(STATE.PLAYING);
    updateHtmlHud();
    lastTimestamp = performance.now();
  }

  function toggleSound() {
    Sound.toggle();
    Sound.playClick();
    updateHtmlHud();
  }

  // --- Canvas Coordinate Translation ---
  function getVirtualXFromCanvasEvent(evt) {
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = evt.clientX || (evt.touches && evt.touches[0] ? evt.touches[0].clientX : null);
    if (clientX === null) return null;
    const relX = clientX - rect.left;
    const scale = V_WIDTH / rect.width;
    return relX * scale;
  }

  // --- Global Keyboard & Blur Listeners ---
  function onKeyDown(e) {
    if (!isMounted) return;

    if (e.code === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      input.left = true;
      e.preventDefault();
    } else if (e.code === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      input.right = true;
      e.preventDefault();
    } else if (e.code === 'Space') {
      e.preventDefault();
      if (currentState === STATE.START) {
        startGame();
      } else if (currentState === STATE.GAMEOVER) {
        restartGame();
      } else {
        togglePause();
      }
    } else if (e.code === 'Escape') {
      e.preventDefault();
      if (currentState === STATE.PLAYING || currentState === STATE.PAUSED) {
        togglePause();
      }
    }
  }

  function onKeyUp(e) {
    if (!isMounted) return;

    if (e.code === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      input.left = false;
    } else if (e.code === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      input.right = false;
    }
  }

  function onWindowBlur() {
    if (currentState === STATE.PLAYING) {
      currentState = STATE.PAUSED;
      showModalOverlay(STATE.PAUSED);
      updateHtmlHud();
    }
  }

  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
  }

  // --- Cleanup Function ---
  function cleanupBombDefusalGame() {
    isMounted = false;
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onWindowBlur);
    window.removeEventListener('resize', resizeCanvas);
    canvas = null;
    ctx = null;
  }

  // --- Main HTML Renderer ---
  function renderBombDefusalGame(container) {
    if (!container) container = document.getElementById('mainContainer');
    if (!container) return;

    cleanupBombDefusalGame();
    isMounted = true;
    currentState = STATE.START;
    highScore = parseInt(localStorage.getItem(STORAGE_HIGH_SCORE) || '0', 10);
    initStars();

    container.innerHTML = `
      <div class="max-w-md mx-auto flex flex-col items-center select-none pb-4">
        <!-- Top Navigation Bar -->
        <div class="w-full flex items-center justify-between mb-2.5 px-1">
          <button onclick="openGamesList()" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200/90 text-slate-700 text-xs font-bold shadow-xs hover:bg-slate-50 active:scale-95 transition">
            <i class="fa-solid fa-arrow-left text-[11px] text-slate-400"></i>
            <span>All Games</span>
          </button>

          <!-- Quick Controls (Audio & Pause) -->
          <div class="flex items-center gap-1.5">
            <div class="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-200 text-[11px] font-black text-amber-700 flex items-center gap-1.5 shadow-xs">
              <i class="fa-solid fa-trophy text-amber-500 text-[10px]"></i>
              <span id="bombHudBest">${highScore.toLocaleString()}</span>
            </div>

            <button id="bombSoundToggleBtn" onclick="BombDefusalAPI.toggleSound()" class="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xs shadow-xs hover:bg-slate-50 active:scale-95 transition" title="Toggle Sound">
              ${Sound.isEnabled() ? '<i class="fa-solid fa-volume-high text-amber-500"></i>' : '<i class="fa-solid fa-volume-xmark text-slate-400"></i>'}
            </button>

            <button id="bombPauseToggleBtn" onclick="BombDefusalAPI.togglePause()" class="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xs shadow-xs hover:bg-slate-50 active:scale-95 transition" title="Pause Game">
              <i class="fa-solid fa-pause text-slate-400"></i>
            </button>
          </div>
        </div>

        <!-- Arcade Screen Enclosure -->
        <div class="w-full relative rounded-3xl overflow-hidden border-2 border-slate-800 bg-slate-950 shadow-2xl shadow-indigo-950/40 flex justify-center">

          <!-- Interactive Heads-Up Display (Overlayed at Top of Cabinet) -->
          <div class="absolute top-0 inset-x-0 z-20 px-3.5 py-2.5 bg-gradient-to-b from-slate-950/90 via-slate-950/70 to-transparent flex items-center justify-between text-white pointer-events-none">
            <!-- Score & Level -->
            <div class="flex items-center gap-2">
              <div class="space-y-0.5">
                <span class="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block leading-none">Score</span>
                <span id="bombHudScore" class="font-mono font-black text-base text-cyan-400 drop-shadow-sm leading-none">00000</span>
              </div>
              <span id="bombHudLevel" class="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                Lvl 1
              </span>
            </div>

            <!-- Combo Indicator & Lives -->
            <div class="flex items-center gap-2.5">
              <span id="bombHudCombo" class="hidden text-[10px] font-black px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-xs animate-pulse">
                🔥 2x COMBO
              </span>

              <div id="bombHudHearts" class="flex items-center gap-1">
                <i class="fa-solid fa-heart text-rose-500 drop-shadow-sm text-sm"></i>
                <i class="fa-solid fa-heart text-rose-500 drop-shadow-sm text-sm"></i>
                <i class="fa-solid fa-heart text-rose-500 drop-shadow-sm text-sm"></i>
              </div>
            </div>
          </div>

          <!-- Canvas Layer -->
          <canvas id="bombDefusalCanvas" class="w-full max-w-[420px] aspect-[420/560] block touch-none" style="touch-action: none; -webkit-touch-callout: none;"></canvas>

          <!-- 1. Start Screen Modal Overlay -->
          <div id="bombStartOverlay" class="absolute inset-0 z-30 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-5 text-center text-white">
            <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-500 via-orange-500 to-amber-400 flex items-center justify-center text-3xl shadow-xl shadow-rose-500/40 transform rotate-2 mb-3">
              💣
            </div>

            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400/40 text-[10px] font-extrabold text-rose-300 tracking-wide uppercase mb-1">
              <span>Retro Arcade Classic</span>
            </div>

            <h2 class="text-2xl font-black tracking-tight text-white mb-1">Bomb Defusal</h2>
            <p class="text-xs text-slate-300 max-w-xs mb-4 leading-relaxed">
              Catch falling bombs with your energy shield before they hit the ground!
            </p>

            <!-- Guide Cards -->
            <div class="w-full max-w-xs space-y-2 mb-5 text-left">
              <div class="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                  <i class="fa-solid fa-shield-halved text-sm"></i>
                </div>
                <div class="text-[11px] text-slate-300">
                  <span class="font-bold text-white block">Intercept Bombs</span>
                  Move underneath bombs to defuse them in mid-air.
                </div>
              </div>

              <div class="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                  <i class="fa-solid fa-triangle-exclamation text-sm"></i>
                </div>
                <div class="text-[11px] text-slate-300">
                  <span class="font-bold text-white block">3 Lives Only</span>
                  Bombs reaching the bottom explode and cost 1 life.
                </div>
              </div>

              <div class="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <i class="fa-solid fa-bolt text-sm"></i>
                </div>
                <div class="text-[11px] text-slate-300">
                  <span class="font-bold text-white block">Combos & Stars</span>
                  Quick catches chain multipliers; golden stars restore lives!
                </div>
              </div>
            </div>

            <!-- Start Action Button -->
            <button onclick="BombDefusalAPI.startGame()" class="w-full max-w-xs py-3.5 px-6 rounded-2xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white font-black text-sm shadow-lg shadow-rose-500/30 flex items-center justify-center gap-2 active:scale-95 transition transform">
              <i class="fa-solid fa-play text-xs"></i>
              <span>START MISSION</span>
            </button>
          </div>

          <!-- 2. Pause Modal Overlay -->
          <div id="bombPauseOverlay" class="absolute inset-0 z-30 bg-slate-950/85 backdrop-blur-md hidden flex flex-col items-center justify-center p-6 text-center text-white">
            <div class="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-400 flex items-center justify-center text-2xl mb-3">
              <i class="fa-solid fa-pause"></i>
            </div>
            <h3 class="text-xl font-black text-white mb-1">Game Paused</h3>
            <p class="text-xs text-slate-400 mb-6">Take a breath, agent! The city needs you.</p>

            <div class="w-full max-w-xs space-y-2.5">
              <button onclick="BombDefusalAPI.togglePause()" class="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-xs shadow-md shadow-cyan-500/25 active:scale-95 transition flex items-center justify-center gap-2">
                <i class="fa-solid fa-play text-xs"></i>
                <span>Resume Game</span>
              </button>
              <button onclick="BombDefusalAPI.restartGame()" class="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-slate-200 font-bold text-xs active:scale-95 transition flex items-center justify-center gap-2">
                <i class="fa-solid fa-rotate-right text-xs"></i>
                <span>Restart Mission</span>
              </button>
              <button onclick="openGamesList()" class="w-full py-2.5 rounded-xl bg-transparent hover:bg-white/5 text-slate-400 hover:text-white font-bold text-xs transition">
                Exit to Games
              </button>
            </div>
          </div>

          <!-- 3. Game Over Modal Overlay -->
          <div id="bombGameOverOverlay" class="absolute inset-0 z-30 bg-slate-950/90 backdrop-blur-md hidden flex flex-col items-center justify-center p-5 text-center text-white">
            <div class="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-500 flex items-center justify-center text-3xl mb-2 animate-bounce">
              💥
            </div>

            <!-- New High Score celebration badge -->
            <div id="bombNewRecordBadge" class="hidden mb-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/60 text-amber-300 font-black text-xs shadow-xs animate-pulse">
              <i class="fa-solid fa-trophy"></i>
              <span>NEW HIGH SCORE!</span>
            </div>

            <h2 class="text-2xl font-black text-rose-400 mb-1">Mission Failed</h2>
            <p class="text-xs text-slate-400 mb-4">All defensive lives were lost!</p>

            <!-- Results Card -->
            <div class="w-full max-w-xs rounded-2xl bg-white/5 border border-white/10 p-4 mb-5 space-y-3">
              <div class="text-center pb-2 border-b border-white/10">
                <span class="text-[10px] uppercase font-bold text-slate-400 block">Final Score</span>
                <span id="bombFinalScore" class="font-mono font-black text-3xl text-cyan-400">0</span>
              </div>

              <div class="grid grid-cols-3 gap-2 text-center text-xs">
                <div class="p-2 rounded-xl bg-white/5">
                  <span class="text-[9px] text-slate-400 block font-semibold">Defused</span>
                  <span id="bombDefusedCount" class="font-bold text-white">0</span>
                </div>
                <div class="p-2 rounded-xl bg-white/5">
                  <span class="text-[9px] text-slate-400 block font-semibold">Level</span>
                  <span id="bombFinalLevel" class="font-bold text-indigo-300">1</span>
                </div>
                <div class="p-2 rounded-xl bg-white/5">
                  <span class="text-[9px] text-slate-400 block font-semibold">Best</span>
                  <span id="bombBestScore" class="font-bold text-amber-400">0</span>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="w-full max-w-xs space-y-2">
              <button onclick="BombDefusalAPI.restartGame()" class="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white font-black text-xs shadow-lg shadow-rose-500/30 flex items-center justify-center gap-2 active:scale-95 transition transform">
                <i class="fa-solid fa-rotate-right text-xs"></i>
                <span>PLAY AGAIN</span>
              </button>
              <button onclick="openGamesList()" class="w-full py-2.5 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white font-bold text-xs transition">
                Return to Games List
              </button>
            </div>
          </div>
        </div>

        <!-- Tactile Mobile Gamepad & Directional Thumb Pads -->
        <div class="w-full max-w-[420px] mt-3 px-1 flex items-center justify-between gap-3">
          <!-- Left Move Pad -->
          <button id="btnMoveLeft" class="flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 active:from-slate-900 active:to-slate-950 text-white font-black text-base shadow-md shadow-slate-900/40 border border-slate-700/60 border-b-4 border-b-slate-950 flex items-center justify-center gap-2.5 transition transform active:translate-y-0.5 active:border-b-2" style="touch-action: none;">
            <i class="fa-solid fa-caret-left text-2xl text-cyan-400"></i>
            <span class="text-xs uppercase tracking-wider font-extrabold text-slate-200">Left</span>
          </button>

          <!-- Middle Action Button (Play / Pause / Action) -->
          <button id="btnMiddleAction" onclick="BombDefusalAPI.handleCenterAction()" class="w-13 h-13 py-3 px-3.5 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 active:from-rose-600 active:to-amber-600 text-white font-black text-base shadow-md shadow-rose-500/30 border border-rose-400/40 border-b-4 border-b-rose-800 flex items-center justify-center shrink-0 transition transform active:translate-y-0.5 active:border-b-2" title="Action">
            <i class="fa-solid fa-shield-halved text-base"></i>
          </button>

          <!-- Right Move Pad -->
          <button id="btnMoveRight" class="flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 active:from-slate-900 active:to-slate-950 text-white font-black text-base shadow-md shadow-slate-900/40 border border-slate-700/60 border-b-4 border-b-slate-950 flex items-center justify-center gap-2.5 transition transform active:translate-y-0.5 active:border-b-2" style="touch-action: none;">
            <span class="text-xs uppercase tracking-wider font-extrabold text-slate-200">Right</span>
            <i class="fa-solid fa-caret-right text-2xl text-cyan-400"></i>
          </button>
        </div>

        <!-- Desktop Controls / Intuitive Touch Instruction -->
        <div class="mt-2 text-center text-[10px] text-slate-400">
          <span class="hidden sm:inline">Desktop: <b>[A] / [◄]</b> Move Left &bull; <b>[D] / [►]</b> Move Right &bull; <b>[Space]</b> Play/Pause</span>
          <span class="sm:hidden">Touch: Hold <b>Left / Right</b> buttons or drag directly across the screen</span>
        </div>
      </div>
    `;

    // Hook Canvas
    canvas = document.getElementById('bombDefusalCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);

    // Direct Canvas Touch & Drag
    canvas.addEventListener('pointerdown', e => {
      if (currentState === STATE.PLAYING) {
        input.pointerActive = true;
        input.touchX = getVirtualXFromCanvasEvent(e);
      }
    });

    canvas.addEventListener('pointermove', e => {
      if (input.pointerActive && currentState === STATE.PLAYING) {
        input.touchX = getVirtualXFromCanvasEvent(e);
      }
    });

    const stopCanvasPointer = () => {
      input.pointerActive = false;
      input.touchX = null;
    };
    canvas.addEventListener('pointerup', stopCanvasPointer);
    canvas.addEventListener('pointercancel', stopCanvasPointer);
    canvas.addEventListener('pointerleave', stopCanvasPointer);

    // Mobile Thumb Pad Listeners with Pointer Events for smooth holding
    const btnLeft = document.getElementById('btnMoveLeft');
    const btnRight = document.getElementById('btnMoveRight');

    function attachPad(button, dir) {
      if (!button) return;
      const start = (e) => {
        e.preventDefault();
        if (dir === 'left') input.left = true;
        if (dir === 'right') input.right = true;
      };
      const end = (e) => {
        e.preventDefault();
        if (dir === 'left') input.left = false;
        if (dir === 'right') input.right = false;
      };

      button.addEventListener('pointerdown', start);
      button.addEventListener('pointerup', end);
      button.addEventListener('pointercancel', end);
      button.addEventListener('pointerleave', end);
    }

    attachPad(btnLeft, 'left');
    attachPad(btnRight, 'right');

    // Show Start Overlay initially
    showModalOverlay(STATE.START);
    updateHtmlHud();

    // Start Animation Loop
    lastTimestamp = performance.now();
    animFrameId = requestAnimationFrame(gameLoop);
  }

  // --- Public Interface ---
  function openBombDefusalGame() {
    if (typeof _slidingPuzzleCleanupGame === 'function') {
      _slidingPuzzleCleanupGame();
    }
    gamesSubView = 'bomb_defusal';
    renderGamesPage(document.getElementById('mainContainer'));
  }

  function handleCenterAction() {
    if (currentState === STATE.START) {
      startGame();
    } else if (currentState === STATE.GAMEOVER) {
      restartGame();
    } else {
      togglePause();
    }
  }

  // Expose to window
  window.openBombDefusalGame = openBombDefusalGame;
  window.renderBombDefusalGame = renderBombDefusalGame;
  window.cleanupBombDefusalGame = cleanupBombDefusalGame;
  window.BombDefusalAPI = {
    startGame,
    togglePause,
    restartGame,
    toggleSound,
    handleCenterAction
  };
})();
