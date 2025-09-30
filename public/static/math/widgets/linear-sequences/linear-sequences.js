import { ids, fmt } from "../shared/shared-utils.js";

let symbolicMode = true; // start with a, b symbolic

function computeTerms(a, b, rows) {
  const terms = [];
  for (let n = 0; n < rows; n += 1) terms.push(a * n + b);
  return terms;
}
function computeFirstDiffs(terms) {
  const diffs = [];
  for (let i = 0; i < terms.length - 1; i += 1) diffs.push(terms[i + 1] - terms[i]);
  return diffs;
}
// No second differences needed for linear sequences

function renderTable(a, b, rows) {
  const table = ids('diffTable');
  const terms = computeTerms(a, b, rows);
  const d1 = computeFirstDiffs(terms);

  const header = `
    <thead>
      <tr>
        <th>n</th>
        <th>t(n)</th>
        <th>Δ</th>
      </tr>
    </thead>
  `;

  const bodyRows = [];
  for (let i = 0; i < rows; i += 1) {
    const n = i;
    const tVal = symbolicMode ? (n === 0 ? 'b' : `${n}a + b`) : terms[i];
    bodyRows.push(`
      <tr class="t-row">
        <td class="t-cell" data-kind="t-n" data-n="${n}">${n}</td>
        <td class="t-cell" data-kind="t" data-n="${n}">${tVal}</td>
        <td class="blank"></td>
      </tr>
    `);

    if (i < rows - 1) {
      const d1ValBetween = symbolicMode ? 'a' : withSign(d1[i]);
      bodyRows.push(`
        <tr class="diff-row">
          <td class="blank"></td>
          <td class="blank"></td>
          <td class="offset-d1 d1-cell" data-kind="d1" data-idx="${i}">${d1ValBetween}</td>
        </tr>
      `);
    }
  }

  table.innerHTML = `${header}<tbody>${bodyRows.join('')}</tbody>`;

  ids('sa').textContent = symbolicMode ? 'a' : a;
  ids('sb').textContent = symbolicMode ? 'b' : b;

  renderRecursionForT(terms, d1, 1);
  wireInteractions(rows);
}

function withSign(v) { return `${v >= 0 ? '+' : '−'}${Math.abs(v)}`; }

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
    const line1 = `t(${n}) = t(${n - 1}) + a`;
    const line2 = `t(${n}) = (${n}a + b), t(${n - 1}) = (${n - 1}a + b)`;
    renderRecursion(line1, line2);
  } else {
    const tn = terms[n];
    const tn1 = terms[n - 1];
    const d = d1[n - 1];
    const sign = d >= 0 ? '+' : '−';
    const mag = Math.abs(d);
    renderRecursion(`t(${n}) = t(${n - 1}) ${sign} ${mag}`, `${tn} = ${tn1} ${sign} ${mag}`);
  }
}

function renderRecursionForD1(iIdx, terms, d1) {
  if (iIdx < 0 || iIdx >= d1.length) {
    renderRecursion('Pick a first difference Δ.', '');
    return;
  }
  const nRight = iIdx + 1;
  if (symbolicMode) {
    renderRecursion(`t(${nRight}) = t(${nRight - 1}) + a`, `Δ = a, Δ² = 0`);
  } else {
    const tRight = terms[nRight];
    const tPrev = terms[nRight - 1];
    const base = d1[0];
    renderRecursion(`t(${nRight}) = t(${nRight - 1}) + ${Math.abs(base)}`, `${tRight} = ${tPrev} + ${Math.abs(base)}`);
  }
}

function clearHighlights() {
  document.querySelectorAll('.hl-t, .hl-d1, .hl-d2, .hl-selected').forEach(el => {
    el.classList.remove('hl-t', 'hl-d1', 'hl-d2', 'hl-selected');
  });
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
        const dIdx = n - 1;
        const d1Cell = document.querySelector(`td[data-kind="d1"][data-idx="${dIdx}"]`);
        if (d1Cell) d1Cell.classList.add('hl-d1');
      }

      // Update recursion
      const a = parseInt(ids('aRange').value, 10);
      const b = parseInt(ids('bRange').value, 10);
      const rows = parseInt(ids('rowsRange').value, 10);
      const termsNow = computeTerms(a, b, rows);
      const d1Now = computeFirstDiffs(termsNow);
      renderRecursionForT(termsNow, d1Now, n);
    } else if (kind === 'd1') {
      cell.classList.add('hl-selected');
      const iIdx = parseInt(cell.getAttribute('data-idx'), 10);
      const firstD1 = document.querySelector('td[data-kind="d1"][data-idx="0"][class*="d1-cell"]') || document.querySelector('td[data-kind="d1"][data-idx="0"]');
      if (firstD1) firstD1.classList.add('hl-d1');
      renderRecursionForD1(iIdx, computeTerms(parseInt(ids('aRange').value,10), parseInt(ids('bRange').value,10), parseInt(ids('rowsRange').value,10)), computeFirstDiffs(computeTerms(parseInt(ids('aRange').value,10), parseInt(ids('bRange').value,10), parseInt(ids('rowsRange').value,10))));
    }
  });
}

function init() {
  const aRange = ids('aRange');
  const bRange = ids('bRange');
  const rowsRange = ids('rowsRange');
  const btnToggleMode = ids('btnToggleMode');
  const aVal = ids('aVal');
  const bVal = ids('bVal');
  const rowsVal = ids('rowsVal');

  function parse() {
    return {
      a: parseInt(aRange.value, 10),
      b: parseInt(bRange.value, 10),
      rows: parseInt(rowsRange.value, 10)
    };
  }

  function update() {
    const { a, b, rows } = parse();
    aVal.textContent = a;
    bVal.textContent = b;
    rowsVal.textContent = rows;
    renderTable(a, b, rows);
  }

  [aRange, bRange, rowsRange].forEach(el => {
    el.addEventListener('input', update);
    el.addEventListener('change', update);
  });

  const btnRandom = ids('btnRandom');
  if (btnRandom) {
    btnRandom.addEventListener('click', () => {
      const a = Math.trunc(Math.random() * 21) - 10; // -10..10
      const b = Math.trunc(Math.random() * 41) - 20; // -20..20
      const rows = Math.trunc(Math.random() * 9) + 6; // 6..14
      aRange.value = String(a);
      bRange.value = String(b);
      rowsRange.value = String(rows);
      symbolicMode = false; // switch to numeric mode for practice
      update();
    });
  }

  if (btnToggleMode) {
    btnToggleMode.addEventListener('click', () => {
      symbolicMode = !symbolicMode;
      btnToggleMode.textContent = symbolicMode ? 'Show Numbers' : 'Show General Form';
      update();
    });
    // Initial label
    btnToggleMode.textContent = symbolicMode ? 'Show Numbers' : 'Show General Form';
  }

  update();
}

document.addEventListener('DOMContentLoaded', init);


