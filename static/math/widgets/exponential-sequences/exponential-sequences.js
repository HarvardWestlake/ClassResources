import { ids, fmt } from "../shared/shared-utils.js";

let symbolicMode = true; // Start with symbolic A, r, C rendering
let interactionsWired = false;
let baseStartN = 0; // base selection for ratio highlighting

function computeTerms(A, r, C, rows) {
  const terms = [];
  for (let n = 0; n < rows; n += 1) {
    terms.push(A * Math.pow(r, n) + C);
  }
  return terms;
}

function computeRatios(terms) {
  const ratios = [];
  for (let i = 0; i < terms.length - 1; i += 1) {
    const denom = terms[i];
    const numer = terms[i + 1];
    if (denom === 0) {
      ratios.push(null);
    } else {
      ratios.push(numer / denom);
    }
  }
  return ratios;
}

function ratioExprSymbolic(i) {
  // ρ_i = t(i+1)/t(i) = (A r^{i+1} + C)/(A r^i + C)
  const top = i + 1 === 0 ? "A + C" : (i + 1 === 1 ? "Ar + C" : `Ar^${i + 1} + C`);
  const bottom = i === 0 ? "A + C" : (i === 1 ? "Ar + C" : `Ar^${i} + C`);
  return `(${top}) / (${bottom})`;
}

function renderTable(A, r, C, rows) {
  const table = ids("ratioTable");
  const terms = computeTerms(A, r, C, rows);
  const ratios = computeRatios(terms);

  const header = `
    <thead>
      <tr>
        <th>n</th>
        <th>t(n)</th>
        <th>ρ = t(n+1)/t(n)</th>
      </tr>
    </thead>
  `;

  const tExprSymbolic = (n) => {
    if (n === 0) return `A + C`;
    if (n === 1) return `Ar + C`;
    return `Ar^${n} + C`;
  };

  const bodyRows = [];
  for (let i = 0; i < rows; i += 1) {
    const n = i;
    const t = terms[i];
    const showRatio = i < rows - 1;
    const ratioValue = showRatio ? (symbolicMode ? ratioExprSymbolic(i) : (ratios[i] == null ? '—' : fmt(ratios[i]))) : '';
    const ratioClass = showRatio ? "r-cell" : "blank";
    bodyRows.push(`
      <tr class="t-row">
        <td class="t-cell" data-kind="t-n" data-n="${n}">${n}</td>
        <td class="t-cell" data-kind="t" data-n="${n}">${symbolicMode ? tExprSymbolic(n) : fmt(t)}</td>
        <td class="${ratioClass}" data-kind="r" data-idx="${i}">${ratioValue}</td>
      </tr>
    `);
  }

  table.innerHTML = `${header}<tbody>${bodyRows.join("")}</tbody>`;

  // Summary
  if (symbolicMode) {
    ids("sA").textContent = 'A';
    ids("sr").textContent = 'r';
    ids("sC").textContent = 'C';
  } else {
    ids("sA").textContent = A;
    ids("sr").textContent = r;
    ids("sC").textContent = C;
  }

  // Default recursion pane for t(1)
  renderRecursionForT(terms, ratios, 1);

  wireInteractions(rows);
  applyBaseHighlight(rows);
}

function renderRecursion(line1, line2) {
  const panel = ids('recursionPanel');
  panel.innerHTML = `<div class="step" style="grid-column: 1 / -1; width: 100%"><h4><span>Recursive Step</span></h4><div>${line1 || ''}</div><div>${line2 || ''}</div></div>`;
}

function renderRecursionForT(terms, ratios, n) {
  if (n <= 0 || n > terms.length - 1) {
    renderRecursion(`Pick a term t(n) with n ≥ 1.`, ``);
    return;
  }
  if (symbolicMode) {
    const line1 = `t(${n}) = r·t(${n - 1}) + (1−r)·C`;
    const line2 = `t(${n}) = (${n === 1 ? 'Ar + C' : `Ar^${n} + C`}), t(${n - 1}) = (${n - 1 === 0 ? 'A + C' : (n - 1 === 1 ? 'Ar + C' : `Ar^${n - 1} + C`)})`;
    renderRecursion(line1, line2);
  } else {
    const tn = terms[n];
    const tn1 = terms[n - 1];
    const rho = ratios[n - 1];
    const rhoStr = rho == null ? '—' : fmt(rho);
    const line1 = `t(${n}) = ${fmt(r)}·t(${n - 1}) + (1−${fmt(r)})·${fmt(C)}`;
    const line2 = `${fmt(tn)} = ${fmt(r)}·${fmt(tn1)} + (1−${fmt(r)})·${fmt(C)} (ρ≈${rhoStr})`;
    renderRecursion(line1, line2);
  }
}

function renderRecursionForR(rIdx, terms, ratios, A, r, C) {
  if (rIdx < 0 || rIdx >= ratios.length) {
    renderRecursion(`Pick a ratio ρ.`, ``);
    return;
  }
  const baseIdx = Math.max(0, Math.min(baseStartN, ratios.length - 1));
  if (symbolicMode) {
    const line1 = `ρ(${rIdx}) = t(${rIdx + 1}) / t(${rIdx})`;
    const line2 = `ρ(${rIdx}) = (${rIdx + 1 === 0 ? 'A + C' : (rIdx + 1 === 1 ? 'Ar + C' : `Ar^${rIdx + 1} + C`)}) / (${rIdx === 0 ? 'A + C' : (rIdx === 1 ? 'Ar + C' : `Ar^${rIdx} + C`)})`;
    renderRecursion(line1, line2);
  } else {
    const rho = ratios[rIdx];
    const line1 = `ρ(${rIdx}) = t(${rIdx + 1}) / t(${rIdx})`;
    const denom = terms[rIdx];
    const numer = terms[rIdx + 1];
    const line2 = `${rho == null ? '—' : fmt(rho)} = ${fmt(numer)} / ${fmt(denom)}`;
    renderRecursion(line1, line2);
  }
}

function clearHighlights() {
  document.querySelectorAll('.hl-t, .hl-r, .hl-selected').forEach(el => {
    el.classList.remove('hl-t', 'hl-r', 'hl-selected');
  });
}

function applyBaseHighlight(rows) {
  document.querySelectorAll('.hl-base').forEach(el => el.classList.remove('hl-base'));
  const nCell = document.querySelector(`td[data-kind="t-n"][data-n="${baseStartN}"]`);
  if (nCell) nCell.classList.add('hl-base');
  const baseIdx = Math.max(0, Math.min(baseStartN, rows - 2));
  const rCell = document.querySelector(`td[data-kind="r"][data-idx="${baseIdx}"]`);
  if (rCell) rCell.classList.add('hl-base');
}

function wireInteractions(rows) {
  if (interactionsWired) return;
  interactionsWired = true;

  document.addEventListener('click', (e) => {
    let target = e.target;
    if (target && target.nodeType !== 1 && target.parentElement) {
      target = target.parentElement;
    }
    const cell = target && target.closest ? target.closest('#ratioTable td') : null;
    if (!cell) return;
    let kind = cell.getAttribute('data-kind');
    if (!kind) return;
    clearHighlights();

    if (kind === 't-n') {
      const n = parseInt(cell.getAttribute('data-n'), 10);
      baseStartN = isNaN(n) ? 0 : n;
      const rowsNow = parseInt(ids('rowsRange').value, 10);
      if (baseStartN >= rowsNow - 1) baseStartN = Math.max(0, rowsNow - 2);
      applyBaseHighlight(rowsNow);
      return;
    }

    if (kind === 't') {
      const n = parseInt(cell.getAttribute('data-n'), 10);
      const tnCell = document.querySelector(`td[data-kind="t"][data-n="${n}"]`);
      if (tnCell) tnCell.classList.add('hl-selected');
      if (tnCell) tnCell.classList.add('hl-t');
      if (n > 0) {
        const prevCell = document.querySelector(`td[data-kind="t"][data-n="${n - 1}"]`);
        if (prevCell) prevCell.classList.add('hl-t');
        const rIdx = n - 1;
        const rCell = document.querySelector(`td[data-kind="r"][data-idx="${rIdx}"]`);
        if (rCell) rCell.classList.add('hl-r');
      }
      const A = parseInt(ids('ARange').value, 10);
      const r = parseInt(ids('rRange').value, 10);
      const C = parseInt(ids('CRange').value, 10);
      const rowsNow = parseInt(ids('rowsRange').value, 10);
      const termsNow = computeTerms(A, r, C, rowsNow);
      const ratiosNow = computeRatios(termsNow);
      renderRecursionForT(termsNow, ratiosNow, n);
    } else if (kind === 'r') {
      cell.classList.add('hl-selected');
      cell.classList.add('hl-r');
      const iIdx = parseInt(cell.getAttribute('data-idx'), 10);
      const rowsNow = parseInt(ids('rowsRange').value, 10);
      const baseIdx = Math.max(0, Math.min(baseStartN, rowsNow - 2));
      // Highlight the base ratio cell
      const baseR = document.querySelector(`td[data-kind="r"][data-idx="${baseIdx}"]`);
      if (baseR) baseR.classList.add('hl-r');
      // Also highlight the two t cells around the clicked ratio
      const leftT = document.querySelector(`td[data-kind="t"][data-n="${iIdx}"]`);
      const rightT = document.querySelector(`td[data-kind="t"][data-n="${iIdx + 1}"]`);
      if (leftT) leftT.classList.add('hl-t');
      if (rightT) rightT.classList.add('hl-t');

      const A = parseInt(ids('ARange').value, 10);
      const r = parseInt(ids('rRange').value, 10);
      const C = parseInt(ids('CRange').value, 10);
      const rowsNow2 = parseInt(ids('rowsRange').value, 10);
      const termsNow = computeTerms(A, r, C, rowsNow2);
      const ratiosNow = computeRatios(termsNow);
      renderRecursionForR(iIdx, termsNow, ratiosNow, A, r, C);
    }
  });
}

function init() {
  const ARange = ids("ARange");
  const rRange = ids("rRange");
  const CRange = ids("CRange");
  const rowsRange = ids("rowsRange");
  const btnToggleMode = ids('btnToggleMode');

  const AVal = ids("AVal");
  const rVal = ids("rVal");
  const CVal = ids("CVal");
  const rowsVal = ids("rowsVal");

  function parse() {
    return {
      A: parseInt(ARange.value, 10),
      r: parseInt(rRange.value, 10),
      C: parseInt(CRange.value, 10),
      rows: parseInt(rowsRange.value, 10),
    };
  }

  function update() {
    const { A, r, C, rows } = parse();
    AVal.textContent = A;
    rVal.textContent = r;
    CVal.textContent = C;
    rowsVal.textContent = rows;
    renderTable(A, r, C, rows);
  }

  [ARange, rRange, CRange, rowsRange].forEach((el) => {
    el.addEventListener("input", update);
    el.addEventListener("change", update);
  });

  const btnRandom = ids('btnRandom');
  if (btnRandom) {
    btnRandom.addEventListener('click', () => {
      // Random but reasonable
      let A = 0;
      while (A === 0) A = Math.trunc(Math.random() * 7) - 3; // -3..3 excluding 0
      let r = 0;
      while (r === 0) r = Math.trunc(Math.random() * 7) - 3; // -3..3 excluding 0
      const C = Math.trunc(Math.random() * 21) - 10; // -10..10
      const rows = Math.trunc(Math.random() * 7) + 6; // 6..12

      ARange.value = String(A);
      rRange.value = String(r);
      CRange.value = String(C);
      rowsRange.value = String(rows);
      symbolicMode = false; // switch to numeric mode on random practice
      update();
    });
  }

  if (btnToggleMode) {
    btnToggleMode.addEventListener('click', () => {
      symbolicMode = !symbolicMode;
      btnToggleMode.textContent = symbolicMode ? 'Show Numbers' : 'Show General Form';
      update();
    });
    btnToggleMode.textContent = symbolicMode ? 'Show Numbers' : 'Show General Form';
  }

  wireInteractions();
  update();
}

document.addEventListener("DOMContentLoaded", init);


