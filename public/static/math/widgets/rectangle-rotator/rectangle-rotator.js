import { ids } from '../shared/shared-utils.js';

// --- DOM ---
const svg = ids('gtSvg');
const gridG = svg.querySelector('#grid');
const rectOuter = ids('rectOuter');
const rectInner = ids('rectInner');
const labelA = ids('labelA');
const labelB = ids('labelB');
const labelC = ids('labelC');
const labelD = ids('labelD');
const currentOpEl = ids('currentOp');

const btnIdentity = ids('btnIdentity');
const btnRotate = ids('btnRotate');
const btnFlipV = ids('btnFlipV');
const btnFlipH = ids('btnFlipH');

const tableEl = ids('cayley');
const btnCheck = ids('btnCheck');
const btnClear = ids('btnClear');
const btnShow = ids('btnShow');
const checkMsg = ids('checkMsg');
let hasCheckedOnce = false;

// --- Grid ---
(function drawGrid(){
  const w = 600, h = 300, step = 20;
  for (let x = 0; x <= w; x += step) {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', x); l.setAttribute('y1', 0);
    l.setAttribute('x2', x); l.setAttribute('y2', h);
    l.setAttribute('class', 'grid-line');
    gridG.appendChild(l);
  }
  for (let y = 0; y <= h; y += step) {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', 0); l.setAttribute('y1', y);
    l.setAttribute('x2', 600); l.setAttribute('y2', y);
    l.setAttribute('class', 'grid-line');
    gridG.appendChild(l);
  }
})();

// --- Animated orientation using nested groups ---
let currentOp = 'e';
let isAnimating = false;
let pendingOps = [];
let currentSx = 1;
let currentSy = 1;

function getScaleForOp(op){
  if (op === 'e') return [1, 1];
  if (op === 'r') return [-1, -1];
  if (op === 'v') return [1, -1];
  if (op === 'h') return [-1, 1];
  return [1, 1];
}

function updateLabelsForOp() {
  labelA.textContent = 'A';
  labelB.textContent = 'B';
  labelC.textContent = 'C';
  labelD.textContent = 'D';
}

function setTransforms(angleDeg, sx, sy){
  rectOuter.style.transform = `rotate(${angleDeg}deg)`;
  rectInner.style.transform = `scale(${sx}, ${sy})`;
}

function setOrientation(op){
  currentOp = op;
  currentOpEl.textContent = op;
  const [sx, sy] = getScaleForOp(op);
  currentSx = sx; currentSy = sy;
  setTransforms(0, sx, sy);
  updateLabelsForOp();
}

function animateToState(targetOp, requestedOp) {
  if (isAnimating) return;
  isAnimating = true;

  const isRotationOp = requestedOp === 'r';
  const startSx = currentSx;
  const startSy = currentSy;

  let animEndSx = startSx, animEndSy = startSy;
  if (!isRotationOp) {
    if (requestedOp === 'v') { animEndSy = -startSy; }
    else if (requestedOp === 'h') { animEndSx = -startSx; }
  }

  const duration = 300;
  const t0 = performance.now();

  function step(t) {
    const p = Math.min(1, (t - t0) / duration);
    const eased = 0.5 - 0.5 * Math.cos(Math.PI * p);

    if (isRotationOp) {
      const angle = -180 * eased; // CCW visual rotation
      rectOuter.style.transform = `rotate(${angle}deg)`;
      rectInner.style.transform = `scale(${startSx}, ${startSy})`;
    } else {
      const sx = startSx + (animEndSx - startSx) * eased;
      const sy = startSy + (animEndSy - startSy) * eased;
      rectInner.style.transform = `scale(${sx}, ${sy})`;
      rectOuter.style.transform = `rotate(0deg)`;
    }

    if (p < 1) {
      requestAnimationFrame(step);
    } else {
      currentOp = targetOp;
      currentOpEl.textContent = targetOp;
      if (isRotationOp) {
        currentSx = -startSx;
        currentSy = -startSy;
      } else {
        currentSx = animEndSx;
        currentSy = animEndSy;
      }
      setTransforms(0, currentSx, currentSy);
      updateLabelsForOp();
      isAnimating = false;
      if (pendingOps.length > 0) {
        const nextOp = pendingOps.shift();
        const nextTarget = compose(currentOp, nextOp);
        animateToState(nextTarget, nextOp);
      }
    }
  }
  requestAnimationFrame(step);
}

function requestOp(op) {
  if (isAnimating) { pendingOps.push(op); return; }
  const target = compose(currentOp, op);
  animateToState(target, op);
}

btnIdentity.addEventListener('click', () => requestOp('e'));
btnRotate.addEventListener('click', () => requestOp('r'));
btnFlipV.addEventListener('click', () => requestOp('v'));
btnFlipH.addEventListener('click', () => requestOp('h'));

setOrientation('e');

// --- Cayley table for D2 ({e, r, v, h}) with gated Show Answer ---
const elems = ['e','r','v','h'];

const compose = (a, b) => {
  if (a === 'e') return b;
  if (b === 'e') return a;
  if (a === 'r' && b === 'r') return 'e';
  if (a === 'v' && b === 'v') return 'e';
  if (a === 'h' && b === 'h') return 'e';
  const S = new Set([a,b]);
  if (S.has('r') && S.has('v')) return 'h';
  if (S.has('r') && S.has('h')) return 'v';
  if (S.has('v') && S.has('h')) return 'r';
  return 'e';
};

function buildTable() {
  tableEl.innerHTML = '';
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  trh.appendChild(document.createElement('th'));
  elems.forEach(e => { const th = document.createElement('th'); th.textContent = e; trh.appendChild(th); });
  thead.appendChild(trh);

  const tbody = document.createElement('tbody');
  elems.forEach((rowOp) => {
    const tr = document.createElement('tr');
    const th = document.createElement('th'); th.textContent = rowOp; tr.appendChild(th);
    elems.forEach((colOp) => {
      const td = document.createElement('td');
      td.dataset.row = rowOp;
      td.dataset.col = colOp;
      td.textContent = '·';
      td.style.cursor = 'pointer';
      td.addEventListener('click', () => {
        const options = ['·','e','r','v','h'];
        const cur = td.textContent;
        const next = options[(options.indexOf(cur) + 1) % options.length] || 'e';
        td.textContent = next;
        td.classList.remove('ok','bad');
        // Dynamic gating of Show Answer
        const allFilledNow = Array.from(tableEl.querySelectorAll('td')).every(c => c.textContent !== '·');
        if (hasCheckedOnce && allFilledNow) btnShow.classList.remove('inactive');
        else btnShow.classList.add('inactive');
        checkMsg.textContent = '';
      });
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  tableEl.appendChild(thead);
  tableEl.appendChild(tbody);
}

function clearTable() {
  tableEl.querySelectorAll('td').forEach(td => { td.textContent = '·'; td.classList.remove('ok','bad'); });
  checkMsg.textContent = '';
  hasCheckedOnce = false;
  btnShow.classList.add('inactive');
}

function showAnswer() {
  const allFilled = Array.from(tableEl.querySelectorAll('td')).every(td => td.textContent !== '·');
  if (!hasCheckedOnce || !allFilled) {
    btnShow.classList.add('inactive');
    checkMsg.textContent = 'Please fill in all cells and click "Check Table" first.';
    return;
  }
  tableEl.querySelectorAll('td').forEach(td => {
    const ans = compose(td.dataset.row, td.dataset.col);
    td.textContent = ans;
    td.classList.remove('ok','bad');
  });
  checkMsg.textContent = 'Answer shown.';
}

function checkTable() {
  let correct = 0, total = 0;
  tableEl.querySelectorAll('td').forEach(td => {
    const ans = compose(td.dataset.row, td.dataset.col);
    const val = td.textContent;
    total++;
    if (val === ans) { td.classList.add('ok'); td.classList.remove('bad'); correct++; }
    else { td.classList.add('bad'); td.classList.remove('ok'); }
  });
  hasCheckedOnce = true;
  const allFilled = Array.from(tableEl.querySelectorAll('td')).every(td => td.textContent !== '·');
  if (allFilled) btnShow.classList.remove('inactive'); else btnShow.classList.add('inactive');
  if (correct === total) checkMsg.textContent = 'Perfect! This is the Cayley table for D2.';
  else checkMsg.textContent = `Correct ${correct}/${total}. Keep going!`;
}

buildTable();
btnShow.classList.add('inactive');
btnClear.addEventListener('click', clearTable);
btnShow.addEventListener('click', showAnswer);
btnCheck.addEventListener('click', checkTable);


