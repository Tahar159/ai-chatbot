/* ============================================================
   🐍 Snake — vanilla JS, no dependencies
   ============================================================ */

(() => {
  'use strict';

  // ---- DOM ----
  const $ = (id) => document.getElementById(id);
  const canvas = $('board');
  const ctx = canvas.getContext('2d');
  const scoreEl = $('score');
  const bestEl = $('best');
  const speedEl = $('speed');
  const overlay = $('overlay');
  const overlayTitle = $('overlayTitle');
  const overlayText = $('overlayText');
  const overlayBtn = $('overlayBtn');
  const hiList = $('hiScores');
  const toast = $('toast');
  const touchPad = $('touchPad');

  // Settings
  const difficultySel = $('difficulty');
  const boardSizeSel = $('boardSize');
  const themeSel = $('theme');
  const wallsSel = $('walls');
  const foodModeSel = $('foodMode');
  const showGridChk = $('showGrid');
  const muteChk = $('mute');

  // ---- Constants & state ----
  const STORAGE_BEST = 'snake_best';
  const STORAGE_HISCORES = 'snake_hiscores';
  const STORAGE_PREFS = 'snake_prefs';

  const DIR = {
    up:    { x:  0, y: -1 },
    down:  { x:  0, y:  1 },
    left:  { x: -1, y:  0 },
    right: { x:  1, y:  0 },
  };

  const SPEED_BY_DIFFICULTY = {
    easy:   { base: 140, min: 110, step: 1.5 },
    normal: { base: 100, min: 70,  step: 2.5 },
    hard:   { base: 75,  min: 50,  step: 3 },
    insane: { base: 55,  min: 35,  step: 4 },
  };

  const PREF_DEFAULTS = {
    difficulty: 'normal',
    boardSize: 20,
    theme: 'classic',
    walls: 'solid',
    foodMode: 'normal',
    showGrid: false,
    mute: false,
  };

  const state = {
    gridSize: 20,
    snake: [],          // array of {x, y} from head to tail
    dir: DIR.right,
    nextDir: DIR.right,
    foods: [],          // array of {x, y, hue, emoji}
    score: 0,
    speedLevel: 1,      // 1..N for HUD
    tickMs: 100,
    lastTick: 0,
    running: false,
    paused: false,
    gameOver: false,
    walls: 'solid',
    foodMode: 'normal',
    difficulty: 'normal',
    showGrid: false,
    mute: false,
    cellsTouchedThisRun: 0,
  };

  // ---------- Preferences ----------
  function loadPrefs() {
    try {
      const raw = localStorage.getItem(STORAGE_PREFS);
      if (raw) Object.assign(PREF_DEFAULTS, JSON.parse(raw));
    } catch {}
  }
  function savePrefs() {
    try {
      localStorage.setItem(STORAGE_PREFS, JSON.stringify({
        difficulty: state.difficulty,
        boardSize: state.gridSize,
        theme: themeSel.value,
        walls: state.walls,
        foodMode: state.foodMode,
        showGrid: state.showGrid,
        mute: state.mute,
      }));
    } catch {}
  }
  function applyPrefsToUI() {
    difficultySel.value = state.difficulty;
    boardSizeSel.value = String(state.gridSize);
    themeSel.value = document.documentElement.dataset.theme || 'classic';
    wallsSel.value = state.walls;
    foodModeSel.value = state.foodMode;
    showGridChk.checked = !!state.showGrid;
    muteChk.checked = !!state.mute;
  }

  // ---------- High scores ----------
  function loadHiScores() {
    try {
      const raw = localStorage.getItem(STORAGE_HISCORES);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }
  function saveHiScores(arr) {
    try { localStorage.setItem(STORAGE_HISCORES, JSON.stringify(arr.slice(0, 10))); } catch {}
  }
  function recordHiScore(score) {
    if (score <= 0) return;
    const arr = loadHiScores();
    arr.push({ score, at: Date.now() });
    arr.sort((a, b) => b.score - a.score);
    saveHiScores(arr);
    renderHiScores(score);
  }
  function renderHiScores(latestScore) {
    const arr = loadHiScores();
    if (arr.length === 0) {
      hiList.innerHTML = '<li class="empty">No scores yet — play your first game!</li>';
      return;
    }
    hiList.innerHTML = arr.slice(0, 10).map((e, i) => {
      const isYou = latestScore != null && e.score === latestScore && i === arr.findIndex(x => x.score === latestScore);
      return `<li class="${isYou ? 'you' : ''}"><span class="rank">#${i + 1}</span> <span class="score">${e.score}</span></li>`;
    }).join('');
  }

  function getBest() {
    try { return Number(localStorage.getItem(STORAGE_BEST)) || 0; } catch { return 0; }
  }
  function setBest(score) {
    try { localStorage.setItem(STORAGE_BEST, String(score)); } catch {}
  }
  function renderBest() { bestEl.textContent = getBest(); }

  // ---------- Game flow ----------
  function applySettings() {
    state.difficulty = difficultySel.value;
    state.gridSize = Number(boardSizeSel.value);
    state.walls = wallsSel.value;
    state.foodMode = foodModeSel.value;
    state.showGrid = showGridChk.checked;
    state.mute = muteChk.checked;
    document.documentElement.dataset.theme = themeSel.value;
    savePrefs();
  }

  function resetGame() {
    const mid = Math.floor(state.gridSize / 2);
    state.snake = [
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
      { x: mid - 3, y: mid },
    ];
    state.dir = DIR.right;
    state.nextDir = DIR.right;
    state.foods = [];
    state.score = 0;
    state.speedLevel = 1;
    state.tickMs = SPEED_BY_DIFFICULTY[state.difficulty].base;
    state.lastTick = 0;
    state.gameOver = false;
    state.paused = false;
    state.cellsTouchedThisRun = 0;
    spawnFood();
    if (state.foodMode === 'many') {
      if (state.foods.length < 2) spawnFood();
    }
    renderHUD();
    draw();
  }

  function startGame() {
    applySettings();
    resetGame();
    state.running = true;
    hideOverlay();
    requestAnimationFrame(loop);
  }

  function gameOver() {
    state.running = false;
    state.gameOver = true;
    sfx('die');
    const prevBest = getBest();
    if (state.score > prevBest) { setBest(state.score); renderBest(); }
    recordHiScore(state.score);
    showOverlay({
      title: '💀 Game over',
      text: `You scored ${state.score}. ${state.score === prevBest + 1 ? 'New best!' : ''}`,
      btn: 'Play again',
    });
  }

  function togglePause() {
    if (!state.running || state.gameOver) return;
    state.paused = !state.paused;
    if (state.paused) {
      showOverlay({ title: '⏸ Paused', text: 'Press Space to resume', btn: 'Resume' });
    } else {
      hideOverlay();
      state.lastTick = performance.now();
    }
  }

  function loop(t) {
    if (!state.running) return;
    if (!state.paused && !state.gameOver) {
      if (t - state.lastTick >= state.tickMs) {
        state.lastTick = t;
        tick();
      }
      draw();
    }
    requestAnimationFrame(loop);
  }

  function tick() {
    // Apply buffered direction (prevents 180° turns in a single tick)
    state.dir = state.nextDir;
    const head = state.snake[0];
    const nx = head.x + state.dir.x;
    const ny = head.y + state.dir.y;

    // Walls: solid → die; wrap → teleport
    let newHead = { x: nx, y: ny };
    if (state.walls === 'wrap') {
      newHead.x = (nx + state.gridSize) % state.gridSize;
      newHead.y = (ny + state.gridSize) % state.gridSize;
    } else {
      if (nx < 0 || ny < 0 || nx >= state.gridSize || ny >= state.gridSize) {
        return gameOver();
      }
    }

    // Self collision
    for (let i = 0; i < state.snake.length - 1; i++) { // -1: tail will move out of the way unless we eat
      if (state.snake[i].x === newHead.x && state.snake[i].y === newHead.y) {
        return gameOver();
      }
    }

    state.snake.unshift(newHead);

    // Eat food?
    const eatenIdx = state.foods.findIndex(f => f.x === newHead.x && f.y === newHead.y);
    if (eatenIdx >= 0) {
      state.foods.splice(eatenIdx, 1);
      state.score += 10;
      sfx('eat');
      // Speed up
      const cfg = SPEED_BY_DIFFICULTY[state.difficulty];
      state.tickMs = Math.max(cfg.min, state.tickMs - cfg.step);
      state.speedLevel = 1 + Math.round((cfg.base - state.tickMs) / cfg.step);
      // Spawn more food
      if (state.foodMode === 'many' && state.foods.length < 3) spawnFood();
      if (state.foodMode === 'normal') spawnFood();
      // Milestones
      if (state.score % 50 === 0) showToast(`🏅 ${state.score} points!`);
    } else {
      state.snake.pop();
    }

    // Refill safety: always keep at least 1 food
    if (state.foods.length === 0) spawnFood();

    renderHUD();
  }

  // ---------- Food ----------
  function spawnFood() {
    if (state.foods.length >= 5) return;
    const taken = new Set(state.snake.map(s => s.x + ',' + s.y));
    const free = [];
    for (let x = 0; x < state.gridSize; x++) {
      for (let y = 0; y < state.gridSize; y++) {
        if (!taken.has(x + ',' + y)) free.push({ x, y });
      }
    }
    if (free.length === 0) {
      // Board full — you win!
      state.running = false;
      showOverlay({ title: '🎉 You filled the board!', text: `Final score: ${state.score}`, btn: 'Play again' });
      return;
    }
    const cell = free[Math.floor(Math.random() * free.length)];
    const foodEmojis = ['🍎', '🍇', '🍓', '🍒', '🍊', '🍑', '🍐', '🥝'];
    state.foods.push({
      x: cell.x, y: cell.y,
      emoji: foodEmojis[Math.floor(Math.random() * foodEmojis.length)],
    });
  }

  // ---------- Drawing ----------
  function draw() {
    const cssSize = canvas.clientWidth || canvas.width;
    const cell = cssSize / state.gridSize;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid (subtle)
    if (state.showGrid) {
      ctx.fillStyle = cssVar('--grid', 'rgba(255,255,255,0.04)');
      for (let x = 1; x < state.gridSize; x++) {
        ctx.fillRect(Math.round(x * cell) - 1, 0, 1, cssSize);
      }
      for (let y = 1; y < state.gridSize; y++) {
        ctx.fillRect(0, Math.round(y * cell) - 1, cssSize, 1);
      }
    }

    // Foods
    for (const f of state.foods) {
      const cx = f.x * cell + cell / 2;
      const cy = f.y * cell + cell / 2;
      const r = cell * 0.42;
      // Glow
      ctx.shadowColor = cssVar('--food', '#ef4444');
      ctx.shadowBlur = cell * 0.5;
      ctx.fillStyle = cssVar('--food', '#ef4444');
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      // Emoji overlay
      ctx.font = `${Math.round(cell * 0.85)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(f.emoji, cx, cy);
    }

    // Snake
    const len = state.snake.length;
    for (let i = len - 1; i >= 0; i--) {
      const s = state.snake[i];
      const t = i / Math.max(1, len - 1); // 0 = head, 1 = tail
      const x = s.x * cell;
      const y = s.y * cell;
      const pad = Math.max(1, cell * 0.08);
      const r = Math.max(2, cell * 0.22);
      if (i === 0) {
        ctx.fillStyle = cssVar('--snake-head', '#22c55e');
      } else {
        // Gradient body
        ctx.fillStyle = cssVar('--snake', '#4ade80');
        ctx.globalAlpha = 1 - t * 0.35;
      }
      roundedRect(x + pad, y + pad, cell - pad * 2, cell - pad * 2, r);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Eyes on head
      if (i === 0) drawEyes(s, cell);
    }
  }

  function drawEyes(head, cell) {
    const pad = cell * 0.18;
    const eyeR = Math.max(1, cell * 0.08);
    let ex1, ey1, ex2, ey2;
    if (state.dir === DIR.right) {
      ex1 = head.x * cell + cell - pad; ey1 = head.y * cell + pad;
      ex2 = head.x * cell + cell - pad; ey2 = head.y * cell + cell - pad;
    } else if (state.dir === DIR.left) {
      ex1 = head.x * cell + pad;         ey1 = head.y * cell + pad;
      ex2 = head.x * cell + pad;         ey2 = head.y * cell + cell - pad;
    } else if (state.dir === DIR.up) {
      ex1 = head.x * cell + pad;         ey1 = head.y * cell + pad;
      ex2 = head.x * cell + cell - pad;  ey2 = head.y * cell + pad;
    } else {
      ex1 = head.x * cell + pad;         ey1 = head.y * cell + cell - pad;
      ex2 = head.x * cell + cell - pad;  ey2 = head.y * cell + cell - pad;
    }
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath(); ctx.arc(ex1, ey1, eyeR, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex2, ey2, eyeR, 0, Math.PI * 2); ctx.fill();
  }

  function roundedRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  // ---------- HUD ----------
  function renderHUD() {
    scoreEl.textContent = state.score;
    speedEl.textContent = state.speedLevel;
  }

  // ---------- Overlay ----------
  function showOverlay({ title, text, btn }) {
    overlayTitle.textContent = title;
    overlayText.innerHTML = text;
    overlayBtn.textContent = btn || 'Start';
    overlay.classList.remove('hidden');
  }
  function hideOverlay() { overlay.classList.add('hidden'); }

  // ---------- Input ----------
  function trySetDir(newDir) {
    // Prevent 180° reversal
    if (newDir.x === -state.dir.x && newDir.y === -state.dir.y) return;
    if (newDir.x === state.dir.x && newDir.y === state.dir.y) return;
    state.nextDir = newDir;
  }

  window.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === 'ArrowUp'    || k === 'w' || k === 'W') { trySetDir(DIR.up); e.preventDefault(); }
    else if (k === 'ArrowDown'  || k === 's' || k === 'S') { trySetDir(DIR.down); e.preventDefault(); }
    else if (k === 'ArrowLeft'  || k === 'a' || k === 'A') { trySetDir(DIR.left); e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { trySetDir(DIR.right); e.preventDefault(); }
    else if (k === ' ' || k === 'Spacebar') {
      e.preventDefault();
      if (!state.running || state.gameOver) startGame();
      else togglePause();
    }
    else if (k === 'r' || k === 'R') { startGame(); }
    else if (k === 'm' || k === 'M') { muteChk.checked = !muteChk.checked; state.mute = muteChk.checked; savePrefs(); showToast(state.mute ? '🔇 Muted' : '🔊 Sound on'); }
  });

  overlayBtn.addEventListener('click', () => {
    if (state.paused) { togglePause(); return; }
    startGame();
  });

  // Touch buttons
  touchPad.querySelectorAll('.tpad').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = btn.dataset.dir;
      if (d && DIR[d]) trySetDir(DIR[d]);
    });
  });

  // Swipe gestures on canvas
  let touchStart = null;
  canvas.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  canvas.addEventListener('touchend', (e) => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return; // tap, not swipe
    if (Math.abs(dx) > Math.abs(dy)) trySetDir(dx > 0 ? DIR.right : DIR.left);
    else trySetDir(dy > 0 ? DIR.down : DIR.up);
    touchStart = null;
  }, { passive: true });

  // Settings listeners
  difficultySel.addEventListener('change', () => { state.difficulty = difficultySel.value; savePrefs(); if (state.running) { state.tickMs = SPEED_BY_DIFFICULTY[state.difficulty].base; state.speedLevel = 1; renderHUD(); } });
  boardSizeSel.addEventListener('change', () => { state.gridSize = Number(boardSizeSel.value); resizeCanvas(); savePrefs(); if (state.running) startGame(); });
  themeSel.addEventListener('change', () => { document.documentElement.dataset.theme = themeSel.value; savePrefs(); draw(); });
  wallsSel.addEventListener('change', () => { state.walls = wallsSel.value; savePrefs(); });
  foodModeSel.addEventListener('change', () => { state.foodMode = foodModeSel.value; savePrefs(); if (state.running) { state.foods = []; spawnFood(); if (state.foodMode === 'many') spawnFood(); } });
  showGridChk.addEventListener('change', () => { state.showGrid = showGridChk.checked; savePrefs(); draw(); });
  muteChk.addEventListener('change', () => { state.mute = muteChk.checked; savePrefs(); });

  // ---------- Canvas resize (DPR + responsive) ----------
  function resizeCanvas() {
    const wrap = canvas.parentElement;
    const max = Math.min(wrap.clientWidth - 20, 560);
    const size = Math.max(280, Math.floor(max));
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }
  window.addEventListener('resize', resizeCanvas);

  // ---------- Sound (tiny WebAudio blips) ----------
  let audioCtx = null;
  function sfx(kind) {
    if (state.mute) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ctxA = audioCtx;
      const o = ctxA.createOscillator();
      const g = ctxA.createGain();
      o.connect(g); g.connect(ctxA.destination);
      const now = ctxA.currentTime;
      if (kind === 'eat') {
        o.frequency.setValueAtTime(660, now);
        o.frequency.exponentialRampToValueAtTime(990, now + 0.08);
        g.gain.setValueAtTime(0.08, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        o.start(now); o.stop(now + 0.13);
      } else if (kind === 'die') {
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(330, now);
        o.frequency.exponentialRampToValueAtTime(80, now + 0.4);
        g.gain.setValueAtTime(0.1, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        o.start(now); o.stop(now + 0.42);
      }
    } catch {}
  }

  // ---------- Toast ----------
  let toastTimer = null;
  function showToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => { toast.hidden = true; }, 250);
    }, 1600);
  }

  // ---------- Init ----------
  function init() {
    loadPrefs();
    Object.assign(PREF_DEFAULTS, {
      difficulty: state.difficulty,
      boardSize: state.gridSize,
      theme: 'classic',
      walls: state.walls,
      foodMode: state.foodMode,
      showGrid: state.showGrid,
      mute: state.mute,
    });
    // seed from defaults + persisted
    state.difficulty = PREF_DEFAULTS.difficulty;
    state.gridSize = PREF_DEFAULTS.boardSize;
    state.walls = PREF_DEFAULTS.walls;
    state.foodMode = PREF_DEFAULTS.foodMode;
    state.showGrid = PREF_DEFAULTS.showGrid;
    state.mute = PREF_DEFAULTS.mute;
    document.documentElement.dataset.theme = PREF_DEFAULTS.theme;
    applyPrefsToUI();
    renderBest();
    renderHiScores();
    resizeCanvas();
    resetGame();
    // Decide initial overlay text
    showOverlay({
      title: '🐍 Ready?',
      text: 'Arrow keys or <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> to move · <kbd>Space</kbd> to pause',
      btn: 'Start game',
    });

    // Show touch pad on coarse pointers
    if (matchMedia('(pointer: coarse)').matches) touchPad.classList.add('visible');
  }

  init();
})();
