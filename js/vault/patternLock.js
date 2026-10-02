// --- Pattern lock (Android-style "connect the dots") ------------------------
// An ALTERNATE way to produce the master-password STRING that goes into
// vaultCreate()/vaultUnlock() - nothing in crypto.js or vaultService.js
// changes at all. A drawn pattern is canonicalized into a plain string (dot
// indices joined by "-", e.g. "0-5-10-15-11-6") and fed through the exact
// same PBKDF2 -> AES-256-GCM path a typed password would use. Like a typed
// password, the pattern itself is NEVER stored anywhere - it only ever
// exists transiently while the gesture is being drawn and for the instant
// it's handed to vaultCreate/vaultUnlock.
//
// IMPORTANT SECURITY TRADEOFF (surfaced to the user in vaultUI.js's create
// screen, not just buried here): a drawn pattern has dramatically less
// entropy than a good typed password. A 4x4 grid with a 6-dot minimum and
// no revisiting a dot has 16*15*14*13*12*11 = 5,765,760 possible patterns -
// large enough to resist casual guessing, but small enough that an attacker
// who steals the encrypted vault.enc blob (which also contains the salt/
// iteration count needed to check each guess) could enumerate EVERY
// possible pattern offline in a bounded amount of time, something that is
// NOT true of a long random passphrase. Use a typed password instead of a
// pattern for any vault whose stolen backup file would actually matter.
//
// Cross-device input: uses Pointer Events (pointerdown/move/up), which
// unify mouse (desktop) and touch (mobile/tablet) in one code path - no
// separate mouse-vs-touch handlers needed. `setPointerCapture` keeps every
// event routed to the grid element even as the pointer leaves individual
// dots, and `touch-action: none` stops the page from scrolling underneath
// a drag on touch devices.
//
// Canonicalization note: the resulting string is built ONLY from each dot's
// fixed `data-pl-idx` (its position in the logical grid), never from pixel
// coordinates - coordinates are used exclusively to draw the connecting
// lines and to hit-test which dot the pointer is currently over. Drawing
// the identical sequence of dots therefore always yields the identical
// string regardless of screen size or how the grid happens to be laid out.

const _vaultPatternInstances = new Map(); // containerId -> internal state

function vaultPatternLockHtml(id, opts) {
  const gridSize = (opts && opts.gridSize) || 4;
  const dots = [];
  for (let i = 0; i < gridSize * gridSize; i++) {
    // Labeled 1..N (not the 0-based data-pl-idx used internally for the
    // canonical string) purely so the user has something concrete to look
    // at/remember while drawing - e.g. "4-9-14-11" - same idea as the
    // numbered dots on an ATM PIN pad. The <span> is pointer-events:none so
    // it never interferes with elementFromPoint hit-testing in JS below.
    dots.push(`<button type="button" tabindex="-1" data-pl-idx="${i}" class="vault-pattern-dot w-full aspect-square rounded-full border-2 border-slate-300 bg-white transition-colors flex items-center justify-center"><span class="pointer-events-none text-xs font-bold text-slate-400 select-none">${i + 1}</span></button>`);
  }
  return `
    <div id="${id}" class="relative mx-auto" style="touch-action:none; max-width: 260px;">
      <svg id="${id}-svg" class="absolute inset-0 w-full h-full pointer-events-none" style="z-index:1;"></svg>
      <div id="${id}-grid" class="grid gap-3 relative" style="touch-action:none; grid-template-columns: repeat(${gridSize}, minmax(0, 1fr)); z-index:2;">
        ${dots.join('')}
      </div>
    </div>
  `;
}

// Call once right after the HTML above is inserted into the DOM (same
// "render then wire up" convention as _wcStartTicker() in world-clock.js).
// `onComplete(patternString)` fires only once the drawn sequence meets
// `minLength`; a shorter attempt auto-resets and calls `onTooShort()`
// instead so the caller can show a hint without the component needing to
// know anything about how that hint is displayed.
function vaultPatternLockInit(id, opts) {
  const minLength = (opts && opts.minLength) || 6;
  const onComplete = (opts && opts.onComplete) || (() => {});
  const onTooShort = (opts && opts.onTooShort) || (() => {});

  const container = document.getElementById(id);
  const grid = document.getElementById(id + '-grid');
  const svg = document.getElementById(id + '-svg');
  if (!container || !grid || !svg) return;

  const state = { sequence: [], dotCenters: [], drawing: false, containerRect: null, dotRadius: 0, lastRelPoint: null };
  _vaultPatternInstances.set(id, state);

  function computeDotCenters() {
    const containerRect = container.getBoundingClientRect();
    state.containerRect = containerRect;
    svg.setAttribute('viewBox', `0 0 ${containerRect.width} ${containerRect.height}`);
    const dotEls = Array.from(grid.querySelectorAll('[data-pl-idx]'));
    state.dotCenters = dotEls.map(dot => {
      const r = dot.getBoundingClientRect();
      return {
        x: r.left + r.width / 2 - containerRect.left,
        y: r.top + r.height / 2 - containerRect.top,
        w: r.width
      };
    });
    // Radius used for "did the drag pass near this dot" hit-testing below -
    // derived from actual rendered dot size so it scales with viewport/CSS
    // rather than being a hardcoded pixel guess.
    state.dotRadius = state.dotCenters.length ? state.dotCenters[0].w / 2 : 20;
  }

  function toRelPoint(clientX, clientY) {
    return { x: clientX - state.containerRect.left, y: clientY - state.containerRect.top };
  }

  // Distance from point P to the segment A-B, plus how far along A->B
  // (0..1) the closest approach falls - the latter lets us activate
  // several skipped dots in the correct left-to-right/up-down order when a
  // single fast move event jumps over more than one of them.
  function distToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx, cy = ay + t * dy;
    return { dist: Math.hypot(px - cx, py - cy), t };
  }

  function dotEl(idx) {
    return grid.querySelector(`[data-pl-idx="${idx}"]`);
  }

  function redrawLine() {
    const points = state.sequence.map(idx => {
      const c = state.dotCenters[idx];
      return `${c.x},${c.y}`;
    }).join(' ');
    svg.innerHTML = state.sequence.length > 1
      ? `<polyline points="${points}" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`
      : '';
  }

  function activateDot(idx) {
    if (state.sequence.includes(idx)) return; // no revisiting a dot, same rule Android enforces
    state.sequence.push(idx);
    const el = dotEl(idx);
    if (el) {
      el.classList.add('border-blue-500', 'bg-blue-500');
      el.classList.remove('border-slate-300', 'bg-white');
      const label = el.querySelector('span');
      if (label) { label.classList.add('text-white'); label.classList.remove('text-slate-400'); }
    }
    redrawLine();
  }

  function reset() {
    state.sequence = [];
    svg.innerHTML = '';
    grid.querySelectorAll('[data-pl-idx]').forEach(el => {
      el.classList.remove('border-blue-500', 'bg-blue-500');
      el.classList.add('border-slate-300', 'bg-white');
      const label = el.querySelector('span');
      if (label) { label.classList.remove('text-white'); label.classList.add('text-slate-400'); }
    });
  }

  function hitTestDot(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;
    const dot = el.closest ? el.closest('[data-pl-idx]') : null;
    if (!dot || !grid.contains(dot)) return null;
    return Number(dot.getAttribute('data-pl-idx'));
  }

  function onPointerDown(e) {
    e.preventDefault();
    reset();
    computeDotCenters();
    state.drawing = true;
    try { grid.setPointerCapture(e.pointerId); } catch (err) { /* older browsers - drag still works via hit-testing below */ }
    const idx = hitTestDot(e.clientX, e.clientY);
    if (idx !== null) activateDot(idx);
    state.lastRelPoint = toRelPoint(e.clientX, e.clientY);
  }

  // Hit-tests the WHOLE path traveled since the last move event, not just
  // the current pointer position. A fast drag can easily jump past a dot
  // between two pointermove samples (the browser doesn't fire one for
  // every pixel) - testing only the endpoint would silently skip that dot
  // from the sequence while the connecting line still gets drawn straight
  // through/near it, which looks exactly like "a number wasn't selected but
  // a line appeared" during a quick swipe. Checking distance-to-segment for
  // every not-yet-visited dot catches those in-between dots too, in the
  // correct order along the path.
  function onPointerMove(e) {
    if (!state.drawing) return;
    const cur = toRelPoint(e.clientX, e.clientY);
    const prev = state.lastRelPoint || cur;
    const candidates = [];
    state.dotCenters.forEach((c, idx) => {
      if (state.sequence.includes(idx)) return;
      const { dist, t } = distToSegment(c.x, c.y, prev.x, prev.y, cur.x, cur.y);
      if (dist <= state.dotRadius) candidates.push({ idx, t });
    });
    candidates.sort((a, b) => a.t - b.t).forEach(c => activateDot(c.idx));
    state.lastRelPoint = cur;
  }

  function finishDrawing() {
    if (!state.drawing) return;
    state.drawing = false;
    const sequence = state.sequence.slice();
    if (sequence.length >= minLength) {
      const patternString = sequence.join('-');
      reset();
      onComplete(patternString);
    } else {
      reset();
      onTooShort();
    }
  }

  function onPointerUp(e) {
    finishDrawing();
  }

  grid.addEventListener('pointerdown', onPointerDown);
  grid.addEventListener('pointermove', onPointerMove);
  grid.addEventListener('pointerup', onPointerUp);
  grid.addEventListener('pointercancel', onPointerUp);

  state._cleanup = () => {
    grid.removeEventListener('pointerdown', onPointerDown);
    grid.removeEventListener('pointermove', onPointerMove);
    grid.removeEventListener('pointerup', onPointerUp);
    grid.removeEventListener('pointercancel', onPointerUp);
  };
}

// Caller must invoke this whenever the pattern grid's HTML is about to be
// replaced/removed (e.g. re-rendering the form) - otherwise the old
// listeners would leak onto a detached element forever.
function vaultPatternLockDestroy(id) {
  const state = _vaultPatternInstances.get(id);
  if (state && state._cleanup) state._cleanup();
  _vaultPatternInstances.delete(id);
}
