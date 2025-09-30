import { ids, fmt } from "../shared/shared-utils.js";

let symbolicMode = true;

function computeTerms(a, b, c, d, rows) {
  const terms = [];
  for (let n = 0; n < rows; n += 1) terms.push(a * n * n * n + b * n * n + c * n + d);
  return terms;
}
function firstDiff(terms) { const out = []; for (let i = 0; i < terms.length - 1; i += 1) out.push(terms[i + 1] - terms[i]); return out; }
function secondDiff(d1) { const out = []; for (let i = 0; i < d1.length - 1; i += 1) out.push(d1[i + 1] - d1[i]); return out; }
function thirdDiff(d2) { const out = []; for (let i = 0; i < d2.length - 1; i += 1) out.push(d2[i + 1] - d2[i]); return out; }

function withSign(v) { return `${v >= 0 ? '+' : '−'}${Math.abs(v)}`; }

function tExprSymbolic(n) {
  if (n === 0) return 'd';
  const parts = [];
  // an^3
  parts.push(n === 1 ? 'a' : `${n**3}a`);
  // bn^2
  parts.push(n === 1 ? 'b' : `${n**2}b`);
  // cn
  parts.push(n === 1 ? 'c' : `${n}c`);
  // + d
  parts.push('d');
  return parts.join(' + ');
}
function d1ExprSymbolic(idx) {
  const n = idx; // between t(n) and t(n+1)
  // Δ = (3n^2+3n+1)a + (2n+1)b + c
  const aCoeff = 3*n*n + 3*n + 1;
  const bCoeff = 2*n + 1;
  const aPart = aCoeff === 1 ? 'a' : `${aCoeff}a`;
  const bPart = bCoeff === 1 ? 'b' : `${bCoeff}b`;
  return `${aPart} + ${bPart} + c`;
}
function d2ExprSymbolic(idx) {
  const n = idx; // between Δ(n) and Δ(n+1)
  // Δ² = (6n+6)a + 2b
  const aCoeff = 6*n + 6;
  const aPart = aCoeff === 1 ? 'a' : `${aCoeff}a`;
  return `${aPart} + 2b`;
}
function d3ExprSymbolic() { return '6a'; }

function renderTable(a, b, c, d, rows) {
  const table = ids('diffTable');
  const terms = computeTerms(a, b, c, d, rows);
  const d1 = firstDiff(terms);
  const d2 = secondDiff(d1);
  const d3 = thirdDiff(d2);

  const header = `
    <thead>
      <tr>
        <th>n</th>
        <th>t(n)</th>
        <th>Δ</th>
        <th>Δ²</th>
        <th>Δ³</th>
      </tr>
    </thead>
  `;

  const bodyRows = [];
  for (let i = 0; i < rows; i += 1) {
    const n = i;
    const tVal = symbolicMode ? tExprSymbolic(n) : terms[i];
    const showD2Here = i >= 1 && (i - 1) < d2.length;
    const d2ValHere = showD2Here ? (symbolicMode ? d2ExprSymbolic(i - 1) : withSign(d2[i - 1])) : '';

    bodyRows.push(`
      <tr class="t-row">
        <td class="t-cell" data-kind="t-n" data-n="${n}">${n}</td>
        <td class="t-cell" data-kind="t" data-n="${n}">${tVal}</td>
        <td class="blank"></td>
        <td class="${showD2Here ? 'offset-d2 d2-cell' : 'blank'}" data-kind="d2" data-idx="${i - 1}">${d2ValHere}</td>
        <td class="blank" data-kind="d3" data-idx="${i - 2}"></td>
      </tr>
    `);

    if (i < rows - 1) {
      const d1ValBetween = symbolicMode ? d1ExprSymbolic(i) : withSign(d1[i]);
      const showD3Between = i >= 1 && (i - 1) < d3.length;
      const d3ValBetween = showD3Between ? (symbolicMode ? d3ExprSymbolic() : withSign(d3[i - 1])) : '';
      bodyRows.push(`
        <tr class="diff-row">
          <td class="blank"></td>
          <td class="blank"></td>
          <td class="offset-d1 d1-cell" data-kind="d1" data-idx="${i}">${d1ValBetween}</td>
          <td class="blank"></td>
          <td class="${showD3Between ? 'offset-d3 d3-cell' : 'blank'}" data-kind="d3" data-idx="${i - 1}">${d3ValBetween}</td>
        </tr>
      `);
    }
  }

  table.innerHTML = `${header}<tbody>${bodyRows.join('')}</tbody>`;

  // Info
  // Default recursion for t(1)
  renderRecursionForT(terms, d1, 1);
  wireInteractions(rows);
}

function renderRecursion(line1, line2) {
  const panel = ids('recursionPanel');
  panel.innerHTML = `
    <div class="info" style="width: 100%">
      <h3>Recursive Form</h3>
      <div>${line1 || ''}</div>
      <div>${line2 || ''}</div>
    </div>
  `;
}

function renderRecursionForT(terms, d1, n) {
  if (n <= 0 || n >= terms.length) {
    renderRecursion('Pick a term t(n) with n ≥ 1.', '');
    return;
  }
  if (symbolicMode) {
    // Δ at index n-1 in symbolic
    const aCoeff = 3*(n-1)*(n-1) + 3*(n-1) + 1;
    const bCoeff = 2*(n-1) + 1;
    const aPart = aCoeff === 1 ? 'a' : `${aCoeff}a`;
    const bPart = bCoeff === 1 ? 'b' : `${bCoeff}b`;
    const d1Text = `${aPart} + ${bPart} + c`;
    renderRecursion(`t(${n}) = t(${n - 1}) + (${d1Text})`, `t(${n}) = (${tExprSymbolic(n)}), t(${n - 1}) = (${tExprSymbolic(n - 1)})`);
  } else {
    const tn = terms[n];
    const tn1 = terms[n - 1];
    const delta = terms[n] - terms[n - 1];
    const sign = delta >= 0 ? '+' : '−';
    const mag = Math.abs(delta);
    renderRecursion(`t(${n}) = t(${n - 1}) ${sign} ${mag}`, `${tn} = ${tn1} ${sign} ${mag}`);
  }
}

function renderRecursionForD1(iIdx, terms) {
  if (iIdx < 0 || iIdx >= terms.length - 1) {
    renderRecursion('Pick a first difference Δ.', '');
    return;
  }
  if (symbolicMode) {
    // Δ(i) = Δ(0) + sum of first i second differences = (a+b+c) + i·(6a+2b) + triangular(i-1)·(6a)
    const i = iIdx;
    const line1 = `Δ(${i}) = Δ(0) + i·Δ² + (i−1)i/2 · Δ³`;
    const line2 = `= (a + b + c) + i·(6a + 2b) + (i−1)i/2 · (6a)`;
    renderRecursion(line1, line2);
  } else {
    const base = terms[1] - terms[0];
    // For practice, keep numeric form simple
    renderRecursion(`Δ = ${withSign(base)}`, ``);
  }
}

function clearHighlights() {
  document.querySelectorAll('.hl-t, .hl-d1, .hl-d2, .hl-d3, .hl-selected').forEach(el => {
    el.classList.remove('hl-t', 'hl-d1', 'hl-d2', 'hl-d3', 'hl-selected');
  });
  // Restore symbolic labels if applicable
  if (symbolicMode) {
    const fd2 = document.querySelector('td[data-kind="d2"][data-idx="0"]');
    if (fd2) fd2.textContent = '6a + 2b';
    const fd3 = document.querySelector('td[data-kind="d3"][data-idx="0"]');
    if (fd3) fd3.textContent = '6a';
  } else {
    // Restore numeric labels from current parameters
    const a = parseInt(ids('aRange').value, 10);
    const b = parseInt(ids('bRange').value, 10);
    const c = parseInt(ids('cRange').value, 10);
    const d = parseInt(ids('dRange').value, 10);
    const rows = parseInt(ids('rowsRange').value, 10);
    const termsNow = computeTerms(a, b, c, d, rows);
    const d1Now = firstDiff(termsNow);
    const d2Now = secondDiff(d1Now);
    const d3Now = thirdDiff(d2Now);
    const fd2 = document.querySelector('td[data-kind="d2"][data-idx="0"]');
    if (fd2 && d2Now.length > 0) fd2.textContent = withSign(d2Now[0]);
    const fd3 = document.querySelector('td[data-kind="d3"][data-idx="0"]');
    if (fd3 && d3Now.length > 0) fd3.textContent = withSign(d3Now[0]);
  }
}

function wireInteractions(rows) {
  const tbody = document.querySelector('#diffTable tbody');
  if (!tbody) return;
  tbody.addEventListener('click', (e) => {
    const cell = e.target.closest('td');
    if (!cell) return;
    const kind = cell.getAttribute('data-kind');
    if (!kind) return;
    clearHighlights();

    if (kind === 't') {
      cell.classList.add('hl-selected');
      const n = parseInt(cell.getAttribute('data-n'), 10);
      const tnCell = document.querySelector(`td[data-kind="t"][data-n="${n}"]`);
      if (tnCell) tnCell.classList.add('hl-t');
      if (n > 0) {
        const prevCell = document.querySelector(`td[data-kind="t"][data-n="${n - 1}"]`);
        if (prevCell) prevCell.classList.add('hl-t');
        const d1Cell = document.querySelector(`td[data-kind="d1"][data-idx="${n - 1}"]`);
        if (d1Cell) d1Cell.classList.add('hl-d1');
      }
      const a = parseInt(ids('aRange').value, 10);
      const b = parseInt(ids('bRange').value, 10);
      const c = parseInt(ids('cRange').value, 10);
      const d = parseInt(ids('dRange').value, 10);
      const rows = parseInt(ids('rowsRange').value, 10);
      const termsNow = computeTerms(a, b, c, d, rows);
      renderRecursionForT(termsNow, firstDiff(termsNow), n);
    } else if (kind === 'd1') {
      cell.classList.add('hl-selected');
      const iIdx = parseInt(cell.getAttribute('data-idx'), 10);
      // Highlight the very first Δ and the very first Δ²
      const firstD1 = document.querySelector('td[data-kind="d1"][data-idx="0"]');
      if (firstD1) firstD1.classList.add('hl-d1');
      const firstD2 = document.querySelector('td[data-kind="d2"][data-idx="0"]');
      if (firstD2) firstD2.classList.add('hl-d2');
      // Highlight only the first Δ³
      const firstD3 = document.querySelector('td[data-kind="d3"][data-idx="0"]');
      if (firstD3) firstD3.classList.add('hl-d3');
      // Update labels to show multiples using n
      if (symbolicMode) {
        if (firstD2) firstD2.textContent = '(6a + 2b) * n';
        if (firstD3) firstD3.textContent = '6a ((n)(n-1)/2)';
      } else {
        const a = parseInt(ids('aRange').value, 10);
        const b = parseInt(ids('bRange').value, 10);
        const c = parseInt(ids('cRange').value, 10);
        const d = parseInt(ids('dRange').value, 10);
        const rows = parseInt(ids('rowsRange').value, 10);
        const termsNow = computeTerms(a, b, c, d, rows);
        const d1Now = firstDiff(termsNow);
        const d2Now = secondDiff(d1Now);
        const d3Now = thirdDiff(d2Now);
        if (firstD2 && d2Now.length > 0) {
          const k2 = d2Now[0];
          const sign2 = k2 >= 0 ? '+ ' : '− ';
          firstD2.textContent = `${sign2}${Math.abs(k2)}(${iIdx})`;
        }
        if (firstD3 && d3Now.length > 0) {
          const k3 = d3Now[0];
          const sign3 = k3 >= 0 ? '+ ' : '− ';
          firstD3.textContent = `${sign3}${Math.abs(k3)}((${iIdx})(${iIdx - 1})/2)`;
        }
      }
      const a = parseInt(ids('aRange').value, 10);
      const b = parseInt(ids('bRange').value, 10);
      const c = parseInt(ids('cRange').value, 10);
      const d = parseInt(ids('dRange').value, 10);
      const rows = parseInt(ids('rowsRange').value, 10);
      const termsNow = computeTerms(a, b, c, d, rows);
      renderRecursionForD1(iIdx, termsNow);
    } else if (kind === 'd2') {
      cell.classList.add('hl-selected');
      cell.classList.add('hl-d2');
    } else if (kind === 'd3') {
      cell.classList.add('hl-selected');
      cell.classList.add('hl-d3');
    }
  });
}

function init() {
  const aRange = ids('aRange');
  const bRange = ids('bRange');
  const cRange = ids('cRange');
  const dRange = ids('dRange');
  const rowsRange = ids('rowsRange');
  const btnToggleMode = ids('btnToggleMode');
  const aVal = ids('aVal');
  const bVal = ids('bVal');
  const cVal = ids('cVal');
  const dVal = ids('dVal');
  const rowsVal = ids('rowsVal');

  function parse() {
    return {
      a: parseInt(aRange.value, 10),
      b: parseInt(bRange.value, 10),
      c: parseInt(cRange.value, 10),
      d: parseInt(dRange.value, 10),
      rows: parseInt(rowsRange.value, 10)
    };
  }

  function update() {
    const { a, b, c, d, rows } = parse();
    aVal.textContent = a; bVal.textContent = b; cVal.textContent = c; dVal.textContent = d; rowsVal.textContent = rows;
    renderTable(a, b, c, d, rows);
  }

  [aRange, bRange, cRange, dRange, rowsRange].forEach(el => {
    el.addEventListener('input', update);
    el.addEventListener('change', update);
  });

  const btnRandom = ids('btnRandom');
  if (btnRandom) {
    btnRandom.addEventListener('click', () => {
      let a = 0; while (a === 0) a = Math.trunc(Math.random() * 5) - 2; // -2..2 \ {0}
      const b = Math.trunc(Math.random() * 11) - 5;
      const c = Math.trunc(Math.random() * 21) - 10;
      const d = Math.trunc(Math.random() * 41) - 20;
      const rows = Math.trunc(Math.random() * 7) + 8; // 8..14
      aRange.value = String(a); bRange.value = String(b); cRange.value = String(c); dRange.value = String(d); rowsRange.value = String(rows);
      symbolicMode = false;
      update();
    });
  }

  if (btnToggleMode) {
    btnToggleMode.addEventListener('click', () => {
      // Toggle symbolic/numeric without changing parameters
      symbolicMode = !symbolicMode;
      btnToggleMode.textContent = symbolicMode ? 'Show Numbers' : 'Show General Form';
      update();
    });
  }

  update();
}

document.addEventListener('DOMContentLoaded', init);


