import { ids } from '../shared/shared-utils.js';

// --- DOM ---
const svg = ids('hexSvg');
const gridG = svg.querySelector('#grid');
const hexOuter = ids('hexOuter');
const hexInner = ids('hexInner');
const angleReadout = ids('angleReadout');

const btn60 = ids('btn60');
const btn120 = ids('btn120');
const btn180 = ids('btn180');
const btn240 = ids('btn240');
const btn300 = ids('btn300');
const btnReset = ids('btnReset');
const tableEl = ids('c6table');
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

// --- Rotation state ---
let currentAngle = 0; // CSS transform angle in degrees, CW positive
let isAnimating = false;
let pending = 0; // queued additional degrees

function updateReadout() {
  // Display CCW angle to emulate unit circle, even though CSS rotates CW for positive angles
  const ccw = ((-currentAngle % 360) + 360) % 360;
  angleReadout.textContent = `${ccw}°`;
}

function setRotation(angleDeg) {
  hexOuter.style.transform = `rotate(${angleDeg}deg)`;
}

// deltaDeg is intended CCW amount
function animateBy(deltaDeg) {
  if (deltaDeg === 0) return;
  if (isAnimating) { pending += deltaDeg; return; }
  isAnimating = true;

  const startAngle = currentAngle;
  // Apply negative because CSS positive rotation is clockwise; we want CCW visually
  const endAngle = startAngle - deltaDeg;
  const basePer60 = 300; // ms per 60° so speed is consistent
  const duration = Math.max(1, Math.round(basePer60 * (Math.abs(deltaDeg) / 60)));
  const t0 = performance.now();

  function step(t) {
    const p = Math.min(1, (t - t0) / duration);
    const eased = 0.5 - 0.5 * Math.cos(Math.PI * p);
    const a = startAngle + (endAngle - startAngle) * eased;
    setRotation(a);
    if (p < 1) {
      requestAnimationFrame(step);
    } else {
      currentAngle = endAngle;
      setRotation(currentAngle);
      updateReadout();
      isAnimating = false;
      if (pending !== 0) {
        const toGo = pending; pending = 0;
        animateBy(toGo);
      }
    }
  }
  requestAnimationFrame(step);
}

function rotateBy60(mult = 1) {
  animateBy(60 * Math.max(1, Math.floor(mult)));
}

function resetRotation() {
  // Rotate CCW to return display angle to 0°
  const displayCcw = ((-currentAngle % 360) + 360) % 360;
  const ccwNeeded = (360 - displayCcw) % 360; // shortest CCW to reach 0°
  if (ccwNeeded !== 0) animateBy(ccwNeeded);
}

// Controls: CCW-only increments
btn60.addEventListener('click', () => rotateBy60(1));
btn120.addEventListener('click', () => rotateBy60(2));
btn180.addEventListener('click', () => rotateBy60(3));
btn240.addEventListener('click', () => rotateBy60(4));
btn300.addEventListener('click', () => rotateBy60(5));
btnReset.addEventListener('click', resetRotation);

// Initialize
setRotation(0);
updateReadout();

// --- C6 rotation table ---
const angles = [0,60,120,180,240,300];
const labels = ['r₀','r₁','r₂','r₃','r₄','r₅'];

function comp(a, b) {
  // composition: apply row rotation then column rotation (CCW), modulo 360
  const sum = (a + b) % 360;
  return sum;
}

function buildTable() {
  tableEl.innerHTML = '';
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  trh.appendChild(document.createElement('th'));
  labels.forEach((lbl, i) => {
    const th = document.createElement('th');
    th.innerHTML = `${lbl}<br><small>${angles[i]}°</small>`;
    trh.appendChild(th);
  });
  thead.appendChild(trh);

  const tbody = document.createElement('tbody');
  labels.forEach((rowLbl, ri) => {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.innerHTML = `${rowLbl}<br><small>${angles[ri]}°</small>`;
    tr.appendChild(th);
    labels.forEach((colLbl, ci) => {
      const td = document.createElement('td');
      td.dataset.row = String(angles[ri]);
      td.dataset.col = String(angles[ci]);
      td.textContent = '·';
      td.style.cursor = 'pointer';
      td.addEventListener('click', () => {
        const options = ['·', '0°', '60°', '120°', '180°','240°','300°'];
        const cur = td.textContent;
        const next = options[(options.indexOf(cur) + 1) % options.length] || '0°';
        td.textContent = next;
        td.classList.remove('ok','bad');
        // Update show button state if user edits after checking
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
  // Guard: require at least one check and all cells filled
  const allFilled = Array.from(tableEl.querySelectorAll('td')).every(td => td.textContent !== '·');
  if (!hasCheckedOnce || !allFilled) {
    btnShow.classList.add('inactive');
    checkMsg.textContent = 'Please fill in all cells and click "Check Table" first.';
    return;
  }
  tableEl.querySelectorAll('td').forEach(td => {
    const ans = comp(parseInt(td.dataset.row,10), parseInt(td.dataset.col,10));
    td.textContent = `${ans}°`;
    td.classList.remove('ok','bad');
  });
  checkMsg.textContent = 'Answer shown.';
}

function checkTable() {
  let correct = 0, total = 0;
  tableEl.querySelectorAll('td').forEach(td => {
    const ans = comp(parseInt(td.dataset.row,10), parseInt(td.dataset.col,10));
    const val = td.textContent === '·' ? NaN : parseInt(td.textContent, 10);
    total++;
    if (!Number.isNaN(val) && val === ans) { td.classList.add('ok'); td.classList.remove('bad'); correct++; }
    else { td.classList.add('bad'); td.classList.remove('ok'); }
  });
  hasCheckedOnce = true;
  const allFilled = Array.from(tableEl.querySelectorAll('td')).every(td => td.textContent !== '·');
  if (allFilled) btnShow.classList.remove('inactive'); else btnShow.classList.add('inactive');
  if (correct === total) checkMsg.textContent = 'Perfect! This is the composition table for C6 rotations.';
  else checkMsg.textContent = `Correct ${correct}/${total}. Keep going!`;
}

buildTable();
btnShow.classList.add('inactive');
btnClear.addEventListener('click', clearTable);
btnShow.addEventListener('click', showAnswer);
btnCheck.addEventListener('click', checkTable);


