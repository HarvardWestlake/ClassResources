import { ids } from '../shared/shared-utils.js';

// --- DOM Elements ---
const canvas = ids('nonogramCanvas');
const ctx = canvas.getContext('2d');
const sizeSelect = ids('sizeSelect');
const seedInput = ids('seedInput');
const timeDisplay = ids('timeDisplay');
const hintsDisplay = ids('hintsDisplay');
const hintButton = ids('hintButton');
const resetButton = ids('resetButton');
const warningEl = ids('nonogramWarning');
const winBannerEl = ids('nonogramWin');

// --- State ---
let gridSize = parseInt(sizeSelect.value);
let solution = []; // 2D boolean array
let player = [];   // 0 empty, 1 filled, -1 marked X
let rowClues = [];
let colClues = [];
let cellSize = 24; // will be set dynamically
let topClueRows = 0;
let leftClueCols = 0;
let timerId = null;
let startTimeMs = null;
let timerStarted = false;
let hintsUsed = 0;
let isPainting = false;
let paintingButton = null; // 0 = left, 2 = right
let suppressClickOnce = false;

// PRNG (Mulberry32)
function mulberry32(seed) {
  let t = seed >>> 0;
  return function() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ t >>> 15, 1 | t);
    r ^= r + Math.imul(r ^ r >>> 7, 61 | r);
    return ((r ^ r >>> 14) >>> 0) / 4294967296;
  };
}

function parseSeedFromUrl() {
  const params = new URLSearchParams(location.search);
  return params.get('seed');
}

function updateUrl(seed) {
  const params = new URLSearchParams(location.search);
  if (seed) params.set('seed', seed); else params.delete('seed');
  params.set('size', gridSize);
  const newUrl = `${location.pathname}?${params.toString()}`;
  history.replaceState(null, '', newUrl);
}

function generatePuzzle(size, seedStr) {
  let seed = seedStr ? Array.from(seedStr).reduce((a,c)=>a + c.charCodeAt(0), 0) : Math.floor(Math.random()*1e9);
  const rng = mulberry32(seed);
  // Simple generation: random filled cells with 35% density; ensure solvable clues
  solution = Array.from({ length: size }, () => Array.from({ length: size }, () => rng() < 0.35));
  computeClues();
  return String(seed);
}

function computeClues() {
  rowClues = solution.map(row => compressLine(row));
  colClues = [];
  for (let c = 0; c < gridSize; c++) {
    const col = [];
    for (let r = 0; r < gridSize; r++) col.push(solution[r][c]);
    colClues.push(compressLine(col));
  }
  topClueRows = Math.max(...colClues.map(a => a.length));
  leftClueCols = Math.max(...rowClues.map(a => a.length));
}

function compressLine(bits) {
  const res = [];
  let run = 0;
  for (let i = 0; i < bits.length; i++) {
    if (bits[i]) run++; else if (run) { res.push(run); run = 0; }
  }
  if (run) res.push(run);
  return res.length ? res : [0];
}

function initGame(size, seedStr) {
  gridSize = size;
  const seeded = generatePuzzle(gridSize, seedStr);
  player = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));
  hintsUsed = 0;
  if (hintsDisplay) hintsDisplay.textContent = hintsUsed;
  stopTimer();
  timerStarted = false;
  seedInput.value = seeded;
  updateUrl(seeded);
  hideWinBanner();
  layoutCanvas();
  render();
}

function startTimer() {
  if (timerId) clearInterval(timerId);
  startTimeMs = Date.now();
  timerId = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTimeMs) / 1000);
    const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const ss = String(elapsed % 60).padStart(2, '0');
    timeDisplay.textContent = `${mm}:${ss}`;
  }, 250);
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  timeDisplay.textContent = '00:00';
}

function layoutCanvas() {
  // Calculate cell size to fit width in CSS pixels
  const area = canvas.parentElement;
  const availableCssWidth = Math.max(300, Math.min(area.clientWidth, 600));
  // reserve space for clues (CSS px)
  const padding = 12;
  const maxLeft = leftClueCols * 16 + padding;
  const maxTop = topClueRows * 16 + padding;
  const cssCellSize = Math.floor(Math.min((availableCssWidth - maxLeft - padding) / gridSize, 32));
  cellSize = Math.max(14, cssCellSize); // store in CSS px

  const cssWidth = maxLeft + gridSize * cellSize + padding;
  const cssHeight = maxTop + gridSize * cellSize + padding;

  const dpr = window.devicePixelRatio || 1;
  // Set CSS display size
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  // Set backing store size scaled for DPR for crisp drawing
  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);
  // Scale context so we can draw in CSS pixels
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function render() {
  // Clear in device pixels safely
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  const originX = leftClueCols * 16 + 12;
  const originY = topClueRows * 16 + 12;

  // Draw clue backgrounds
  ctx.fillStyle = '#f1f3f5';
  ctx.fillRect(0, 0, parseInt(canvas.style.width, 10) || canvas.width, originY); // top clues area
  ctx.fillRect(0, 0, originX, parseInt(canvas.style.height, 10) || canvas.height); // left clues area

  // Grid lines
  ctx.strokeStyle = '#ccc';
  for (let r = 0; r <= gridSize; r++) {
    const y = originY + r * cellSize;
    ctx.beginPath(); ctx.moveTo(originX, y); ctx.lineTo(originX + gridSize * cellSize, y); ctx.stroke();
  }
  for (let c = 0; c <= gridSize; c++) {
    const x = originX + c * cellSize;
    ctx.beginPath(); ctx.moveTo(x, originY); ctx.lineTo(x, originY + gridSize * cellSize); ctx.stroke();
  }

  // Bold lines every 5
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 2;
  for (let r = 0; r <= gridSize; r += 5) {
    const y = originY + r * cellSize;
    ctx.beginPath(); ctx.moveTo(originX, y); ctx.lineTo(originX + gridSize * cellSize, y); ctx.stroke();
  }
  for (let c = 0; c <= gridSize; c += 5) {
    const x = originX + c * cellSize;
    ctx.beginPath(); ctx.moveTo(x, originY); ctx.lineTo(x, originY + gridSize * cellSize); ctx.stroke();
  }
  ctx.lineWidth = 1;

  // Fill cells
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const x = originX + c * cellSize;
      const y = originY + r * cellSize;
      if (player[r][c] === 1) {
        ctx.fillStyle = '#000';
        ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
      } else if (player[r][c] === -1) {
        ctx.strokeStyle = '#E60000';
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 4);
        ctx.lineTo(x + cellSize - 4, y + cellSize - 4);
        ctx.moveTo(x + cellSize - 4, y + 4);
        ctx.lineTo(x + 4, y + cellSize - 4);
        ctx.stroke();
      }
    }
  }

  // Draw row clues (right-aligned)
  ctx.fillStyle = '#000';
  ctx.font = '12px "Source Sans Pro"';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let r = 0; r < gridSize; r++) {
    const clues = rowClues[r];
    const y = originY + r * cellSize + cellSize / 2;
    for (let i = 0; i < clues.length; i++) {
      const textX = leftClueCols * 16 - (clues.length - 1 - i) * 16;
      ctx.fillText(String(clues[i]), textX, y);
    }
  }

  // Draw column clues (bottom-aligned)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  for (let c = 0; c < gridSize; c++) {
    const clues = colClues[c];
    const x = originX + c * cellSize + cellSize / 2;
    for (let i = 0; i < clues.length; i++) {
      const textY = topClueRows * 16 - (clues.length - 1 - i) * 16;
      ctx.fillText(String(clues[i]), x, textY);
    }
  }

  if (isSolved()) {
    showWinBanner('Solved! Great job!');
  } else {
    hideWinBanner();
  }
}

function showWinBanner(text) {
  if (!winBannerEl) return;
  winBannerEl.textContent = text || 'Solved! Great job!';
  winBannerEl.style.display = 'block';
}

function hideWinBanner() {
  if (!winBannerEl) return;
  winBannerEl.style.display = 'none';
}

function showWarning(msg) {
  warningEl.textContent = msg;
  warningEl.style.display = 'block';
  setTimeout(() => { warningEl.style.display = 'none'; }, 1500);
}

function canvasToCell(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left; // CSS px
  const y = clientY - rect.top;  // CSS px
  const originX = leftClueCols * 16 + 12;
  const originY = topClueRows * 16 + 12;
  const c = Math.floor((x - originX) / cellSize);
  const r = Math.floor((y - originY) / cellSize);
  if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) return null;
  return { r, c };
}

function maybeStartTimer() {
  if (!timerStarted) {
    timerStarted = true;
    startTimer();
  }
}

function handlePrimary(r, c) {
  maybeStartTimer();
  // Left click: cycle empty -> filled -> empty (do not toggle X)
  if (player[r][c] === 1) player[r][c] = 0; else player[r][c] = 1;
  render();
}

function handleSecondary(r, c) {
  maybeStartTimer();
  // Right click or with modifier: toggle X mark
  player[r][c] = (player[r][c] === -1) ? 0 : -1;
  render();
}

function isSolved() {
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const mustBeFilled = solution[r][c];
      if (mustBeFilled && player[r][c] !== 1) return false;
      if (!mustBeFilled && player[r][c] === 1) return false;
    }
  }
  return true;
}

function giveHint() {
  maybeStartTimer();
  // Find a mismatched cell and correct it
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const shouldBe = solution[r][c] ? 1 : 0;
      if (player[r][c] !== shouldBe) {
        player[r][c] = shouldBe;
        hintsUsed++;
        if (hintsDisplay) hintsDisplay.textContent = hintsUsed;
        render();
        return;
      }
    }
  }
  showWarning('No hints available!');
}

// --- Events ---
canvas.addEventListener('click', (e) => {
  if (suppressClickOnce) { suppressClickOnce = false; return; }
  const cell = canvasToCell(e.clientX, e.clientY);
  if (!cell) return;
  handlePrimary(cell.r, cell.c);
});

canvas.addEventListener('contextmenu', (e) => {
  // prevent browser menu to allow right-drag painting
  e.preventDefault();
});

canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0 && e.button !== 2) return;
  suppressClickOnce = true; // prevent subsequent click handler
  const start = canvasToCell(e.clientX, e.clientY);
  if (!start) return;
  maybeStartTimer();
  isPainting = true;
  paintingButton = e.button;

  // Determine painting mode based on button and starting cell
  const startVal = player[start.r][start.c]; // 0 empty, 1 filled, -1 X
  let paintingMode = 'fill';
  if (paintingButton === 0) {
    paintingMode = (startVal === 1) ? 'clearFill' : 'fill';
  } else if (paintingButton === 2) {
    paintingMode = (startVal === -1) ? 'clearX' : 'x';
  }

  const paintCell = (r, c) => {
    if (r == null || c == null) return false;
    const current = player[r][c];
    let didChange = false;
    if (paintingMode === 'fill') {
      if (current === 0) { player[r][c] = 1; didChange = true; }
    } else if (paintingMode === 'clearFill') {
      if (current === 1) { player[r][c] = 0; didChange = true; }
    } else if (paintingMode === 'x') {
      if (current === 0) { player[r][c] = -1; didChange = true; }
    } else if (paintingMode === 'clearX') {
      if (current === -1) { player[r][c] = 0; didChange = true; }
    }
    return didChange;
  };

  let changed = paintCell(start.r, start.c);
  render();

  const onMove = (ev) => {
    if (!isPainting) return;
    const cell = canvasToCell(ev.clientX, ev.clientY);
    if (!cell) return;
    const didChange = paintCell(cell.r, cell.c);
    if (didChange) { changed = true; render(); }
  };
  const onUp = () => {
    if (!isPainting) return;
    isPainting = false;
    paintingButton = null;
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
});

hintButton.addEventListener('click', giveHint);

resetButton.addEventListener('click', () => {
  const confirmed = confirm('Reset the puzzle?');
  if (!confirmed) return;
  initGame(gridSize, seedInput.value || undefined);
});

sizeSelect.addEventListener('change', () => {
  initGame(parseInt(sizeSelect.value), seedInput.value || undefined);
});

seedInput.addEventListener('change', () => {
  initGame(gridSize, seedInput.value || undefined);
});

window.addEventListener('resize', () => {
  layoutCanvas();
  render();
});

// --- Init ---
(function bootstrap(){
  const params = new URLSearchParams(location.search);
  const sizeParam = parseInt(params.get('size'));
  if (sizeParam && [5,10,15].includes(sizeParam)) {
    sizeSelect.value = String(sizeParam);
  }
  const seedFromUrl = parseSeedFromUrl();
  initGame(parseInt(sizeSelect.value), seedFromUrl || undefined);
})();
