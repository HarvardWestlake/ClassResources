import { ids, fmt } from "../shared/shared-utils.js";

let symbolicMode = true; // Start with symbolic a, b, c rendering
let interactionsWired = false; // Ensure we wire click handlers only once
let baseStartN = 0; // Selected starting n for Δ summation (affects Δ click behavior)

function computeTerms(a, b, c, rows) {
  const terms = [];
  for (let n = 0; n < rows; n += 1) {
    terms.push(a * n * n + b * n + c);
  }
  return terms;
}

function computeFirstDiffs(terms) {
  const diffs = [];
  for (let i = 0; i < terms.length - 1; i += 1) {
    diffs.push(terms[i + 1] - terms[i]);
  }
  return diffs;
}

function computeSecondDiffs(firstDiffs) {
  const diffs2 = [];
  for (let i = 0; i < firstDiffs.length - 1; i += 1) {
    diffs2.push(firstDiffs[i + 1] - firstDiffs[i]);
  }
  return diffs2;
}

function renderTable(a, b, c, rows) {
  const table = ids("diffTable");
  const terms = computeTerms(a, b, c, rows);
  const d1 = computeFirstDiffs(terms);
  const d2 = computeSecondDiffs(d1);

  const header = `
    <thead>
      <tr>
        <th>n</th>
        <th>t(n)</th>
        <th>Δ</th>
        <th>Δ²</th>
      </tr>
    </thead>
  `;

  const withSign = (val) => `${val >= 0 ? "+" : "-"}${Math.abs(val)}`;
  const formatMonomial = (coef, sym) => {
    if (coef === 0) return "";
    const abs = Math.abs(coef);
    const sign = coef > 0 ? "+" : "−";
    if (sym === "1") return `${sign} ${abs}`;
    if (abs === 1) return `${sign} ${sym}`;
    return `${sign} ${abs}${sym}`;
  };
  const trimExpression = (expr) => expr.replace(/^\+\s*/, '').replace(/\s+/g, ' ').trim();
  const tExpr = (n) => trimExpression([
    formatMonomial(a * n * n === 0 ? (n*n!==0? a : 0) : a, n !== 0 ? (n === 1 ? "a" : `${n*n}a`) : "1"),
  ].filter(Boolean).join(" "));
  // Build t(n) explicitly: an² + bn + c
  const tExprExplicit = (n) => {
    const parts = [];
    // an^2
    if (a !== 0) {
      const k = n * n;
      if (k === 0) {
        // contributes 0
      } else if (k === 1) {
        parts.push(a === 1 ? "+ a" : a === -1 ? "− a" : `${a > 0 ? "+" : "−"} ${Math.abs(a)}a`);
      } else {
        parts.push(`${a > 0 ? "+" : "−"} ${Math.abs(a)}a${k}`);
      }
    }
    // bn
    if (b !== 0) {
      if (n === 0) {
        // 0
      } else if (n === 1) {
        parts.push(b === 1 ? "+ b" : b === -1 ? "− b" : `${b > 0 ? "+" : "−"} ${Math.abs(b)}b`);
      } else {
        parts.push(`${b > 0 ? "+" : "−"} ${Math.abs(b)}b${n}`);
      }
    }
    // c
    if (n === 0) {
      // t(0) = c
      parts.unshift("c");
    } else if (c !== 0) {
      parts.push(`${c > 0 ? "+" : "−"} ${Math.abs(c)}`);
    }
    const expr = parts.join(" ").trim();
    return expr.startsWith("+") ? expr.slice(2) : expr; // remove leading "+ "
  };
  const tExprSymbolic = (n) => {
    if (n === 0) return "c";
    const parts = [];
    // an^2
    if (n === 1) parts.push("a"); else parts.push(`${n*n}a`);
    // bn
    parts.push(n === 1 ? "b" : `${n}b`);
    // + c
    parts.push("c");
    return parts.join(" + ");
  };
  const d1ExprByIndex = (idx) => {
    const n = idx; // between t(n) and t(n+1)
    const coeff = 2 * n + 1;
    const aPart = coeff === 1 ? "a" : `${coeff}a`;
    return `${aPart} + b`;
  };
  const d2Expr = () => `2a`;
  const bodyRows = [];
  for (let i = 0; i < rows; i += 1) {
    const n = i; // start at 0
    const t = terms[i];

    // t-row: shows n and t(n); Δ² appears centered at this middle t-row (from i>=1)
    const showD2Here = i >= 1 && (i - 1) < d2.length;
    const d2ValHere = showD2Here ? (symbolicMode ? d2Expr() : withSign(d2[i - 1])) : "";
    const d2ClassHere = showD2Here ? "offset-d2" : "blank";

    bodyRows.push(`
      <tr class="t-row">
        <td class="t-cell" data-kind="t-n" data-n="${n}">${n}</td>
        <td class="t-cell" data-kind="t" data-n="${n}">${symbolicMode ? tExprSymbolic(n) : t}</td>
        <td class="blank"></td>
        <td class="${d2ClassHere} d2-cell" data-kind="d2" data-idx="${i - 1}">${d2ValHere}</td>
      </tr>
    `);

    // diff-row between this t-row and the next one: show Δ for interval [i -> i+1]
    if (i < rows - 1) {
      const d1ValBetween = symbolicMode ? d1ExprByIndex(i) : withSign(d1[i]);
      bodyRows.push(`
        <tr class="diff-row">
          <td class="blank"></td>
          <td class="blank"></td>
          <td class="offset-d1 d1-cell" data-kind="d1" data-idx="${i}">${d1ValBetween}</td>
          <td class="blank"></td>
        </tr>
      `);
    }
  }

  table.innerHTML = `${header}<tbody>${bodyRows.join("")}</tbody>`;

  // Summary
  if (symbolicMode) {
    ids("sa").textContent = 'a';
    ids("sb").textContent = 'b';
    ids("sc").textContent = 'c';
    ids("sdd").textContent = '2a';
  } else {
    ids("sa").textContent = a;
    ids("sb").textContent = b;
    ids("sc").textContent = c;
    ids("sdd").textContent = fmt(2 * a);
  }

  // Initialize recursion panel default (based on t(2))
  renderRecursionForT(terms, d1, d2, 2);

  // Wire interactions
  wireInteractions(rows);

  // Reapply base highlight after re-render
  applyBaseHighlight(rows);
}

function renderRecursion(line1, line2) {
  const panel = ids('recursionPanel');
  panel.innerHTML = `<div class="step" style="grid-column: 1 / -1; width: 100%"><h4><span>Recursive Step</span></h4><div>${line1 || ''}</div><div>${line2 || ''}</div></div>`;
}

function renderRecursionForT(terms, d1, d2, n) {
  if (n <= 0 || n > terms.length - 1) {
    renderRecursion(`Pick a term t(n) with n ≥ 1.`, ``);
    return;
  }
  if (symbolicMode) {
    const coeff = 2 * n - 1;
    const aPart = coeff === 1 ? 'a' : `${coeff}a`;
    const line1 = `t(${n}) = t(${n - 1}) + (${aPart} + b)`;
    const line2 = `t(${n}) = (${tExprSymbolic(n)}) and t(${n - 1}) = (${tExprSymbolic(n - 1)})`;
    renderRecursion(line1, line2);
  } else {
    const tn = terms[n];
    const tn1 = terms[n - 1];
    const deltaIdx = n - 1;
    const d = d1[deltaIdx];
    const sign = d >= 0 ? '+' : '−';
    const mag = Math.abs(d);
    const line1 = `t(${n}) = t(${n - 1}) ${sign} ${mag}`;
    const line2 = `${tn} = ${tn1} ${sign} ${mag}`;
    renderRecursion(line1, line2);
  }
}

function renderRecursionForD1(d1Idx, terms, d1, d2) {
  // For Δ at index i (between t(i) and t(i+1)):
  // Start from selected base Δ at index baseStartN, then add (i - base) Δ² terms
  if (d1Idx < 0 || d1Idx >= d1.length) {
    renderRecursion(`Pick a first difference Δ.`, ``);
    return;
  }
  const baseIdx = Math.max(0, Math.min(baseStartN, d1.length - 1));
  const count = d1Idx - baseIdx;
  const nRight = d1Idx + 1; // right index in zero-based (t(i+1))
  if (symbolicMode) {
    const coeff = 2 * baseIdx + 1;
    const aPart = coeff === 1 ? 'a' : `${coeff}a`;
    const baseDeltaSym = `${aPart} + b`;
    const countPart = count > 0 ? ` + (2a)(${count})` : count === 0 ? '' : ` − (2a)(${Math.abs(count)})`;
    const inside = `(${baseDeltaSym}${countPart})`;
    const line1 = `t(${nRight}) = t(${nRight - 1}) + ${inside}`;
    const line2 = `Δ(start at n=${baseIdx}) = (${baseDeltaSym})`;
    renderRecursion(line1, line2);
  } else {
    const tRight = terms[nRight];
    const tPrev = terms[nRight - 1];
    const deltaBase = d1[baseIdx];
    const d2const = d2.length > 0 ? d2[0] : 0;
    const baseStr = `${deltaBase < 0 ? '−' : ''}${Math.abs(deltaBase)}`;
    const prod = `(${Math.abs(d2const)})(${Math.abs(count)})`;
    const signedPart = count === 0 ? '' : (count > 0 ? (d2const >= 0 ? ` + ${prod}` : ` − ${prod}`) : (d2const >= 0 ? ` − ${prod}` : ` + ${prod}`));
    const inside = `${baseStr}${signedPart}`;
    const line1 = `t(${nRight}) = t(${nRight - 1}) + (${inside})`;
    const line2 = `${tRight} = ${tPrev} + (${inside})`;
    renderRecursion(line1, line2);
  }
}

function withSigned(v) { return `${v >= 0 ? '+' : '−'}${Math.abs(v)}`; }

function init() {
  const aRange = ids("aRange");
  const bRange = ids("bRange");
  const cRange = ids("cRange");
  const rowsRange = ids("rowsRange");
  const btnToggleMode = ids('btnToggleMode');

  const aVal = ids("aVal");
  const bVal = ids("bVal");
  const cVal = ids("cVal");
  const rowsVal = ids("rowsVal");

  function parse() {
    return {
      a: parseInt(aRange.value, 10),
      b: parseInt(bRange.value, 10),
      c: parseInt(cRange.value, 10),
      rows: parseInt(rowsRange.value, 10),
    };
  }

  function update() {
    const { a, b, c, rows } = parse();
    aVal.textContent = a;
    bVal.textContent = b;
    cVal.textContent = c;
    rowsVal.textContent = rows;
    renderTable(a, b, c, rows);
  }

  [aRange, bRange, cRange, rowsRange].forEach((el) => {
    el.addEventListener("input", update);
    el.addEventListener("change", update);
  });

  const btnRandom = ids('btnRandom');
  if (btnRandom) {
    btnRandom.addEventListener('click', () => {
      // Random but reasonable classroom-friendly ranges
      let a = 0;
      while (a === 0) a = Math.trunc(Math.random() * 7) - 3; // -3..3 excluding 0
      const b = Math.trunc(Math.random() * 21) - 10; // -10..10
      const c = Math.trunc(Math.random() * 21) - 10; // -10..10
      const rows = Math.trunc(Math.random() * 7) + 6; // 6..12

      aRange.value = String(a);
      bRange.value = String(b);
      cRange.value = String(c);
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
    // Ensure initial label matches initial mode
    btnToggleMode.textContent = symbolicMode ? 'Show Numbers' : 'Show General Form';
  }

  // Ensure interactions are wired before the first render so clicks work immediately
  wireInteractions();

  update();
}

document.addEventListener("DOMContentLoaded", init);

function clearHighlights() {
  document.querySelectorAll('.hl-t, .hl-d1, .hl-d2, .hl-selected').forEach(el => {
    el.classList.remove('hl-t', 'hl-d1', 'hl-d2', 'hl-selected');
  });
}

function wireInteractions(rows) {
  if (interactionsWired) return;
  interactionsWired = true;

  document.addEventListener('click', (e) => {
    let target = e.target;
    // Normalize non-element targets (e.g., Text nodes) to their parent element
    if (target && target.nodeType !== 1 && target.parentElement) {
      target = target.parentElement;
    }
    const cell = target && target.closest ? target.closest('#diffTable td') : null;
    if (!cell) return;
    let kind = cell.getAttribute('data-kind');
    if (!kind) return;
    clearHighlights();

    if (kind === 't-n') {
      // Selecting a new base start at this n
      const n = parseInt(cell.getAttribute('data-n'), 10);
      baseStartN = isNaN(n) ? 0 : n;
      // Clamp base so it always points to an existing Δ (if possible)
      const rowsNow = parseInt(ids('rowsRange').value, 10);
      if (baseStartN >= rowsNow - 1) baseStartN = Math.max(0, rowsNow - 2);
      applyBaseHighlight(rowsNow);
    } else if (kind === 't') {
      // Normalize selection to the t(n) value cell (not the index cell)
      const n = parseInt(cell.getAttribute('data-n'), 10);
      const tnCell = document.querySelector(`td[data-kind="t"][data-n="${n}"]`);
      if (tnCell) tnCell.classList.add('hl-selected');
      // Clicking t(n): highlight t(n) (self), t(n-1), and the Δ between them
      if (tnCell) tnCell.classList.add('hl-t');
      if (n > 0) {
        const prevCell = document.querySelector(`td[data-kind="t"][data-n="${n - 1}"]`);
        if (prevCell) prevCell.classList.add('hl-t');
        const dIdx = n - 1; // zero-based: Δ index between t(n-1) and t(n)
        const d1Cell = document.querySelector(`td[data-kind="d1"][data-idx="${dIdx}"]`);
        if (d1Cell) d1Cell.classList.add('hl-d1');
      }
      // Update recursion panel for this term
      // Recompute arrays from current sliders to make sure we have values
      const a = parseInt(ids('aRange').value, 10);
      const b = parseInt(ids('bRange').value, 10);
      const c = parseInt(ids('cRange').value, 10);
      const rows = parseInt(ids('rowsRange').value, 10);
      const termsNow = computeTerms(a, b, c, rows);
      const d1Now = computeFirstDiffs(termsNow);
      const d2Now = computeSecondDiffs(d1Now);
      renderRecursionForT(termsNow, d1Now, d2Now, n);
    } else if (kind === 'd1') {
      // Select the clicked Δ cell
      cell.classList.add('hl-selected');
      // Clicking Δ at index i (between t(i+1) and t(i+2)):
      // highlight the base Δ (after selected n) and the needed Δ²s to sum to this Δ
      const iIdx = parseInt(cell.getAttribute('data-idx'), 10);
      const rowsNow = parseInt(ids('rowsRange').value, 10);
      const baseIdx = Math.max(0, Math.min(baseStartN, rowsNow - 2));
      // Base Δ
      const baseD1 = document.querySelector(`td[data-kind="d1"][data-idx="${baseIdx}"]`);
      if (baseD1) baseD1.classList.add('hl-d1');
      // Required Δ²: indices baseIdx..iIdx-1 (forward only)
      if (iIdx >= baseIdx) {
        for (let k = baseIdx; k < iIdx; k += 1) {
          const d2Cell = document.querySelector(`td[data-kind="d2"][data-idx="${k}"]`);
          if (d2Cell) d2Cell.classList.add('hl-d2');
        }
      }
      // Also highlight the clicked Δ for clarity
      cell.classList.add('hl-d1');

      // Update recursion panel expressing Δ(i) via Δ(1) and Δ²'s
      const a = parseInt(ids('aRange').value, 10);
      const b = parseInt(ids('bRange').value, 10);
      const c = parseInt(ids('cRange').value, 10);
      const rows = parseInt(ids('rowsRange').value, 10);
      const termsNow = computeTerms(a, b, c, rows);
      const d1Now = computeFirstDiffs(termsNow);
      const d2Now = computeSecondDiffs(d1Now);
      renderRecursionForD1(iIdx, termsNow, d1Now, d2Now);
    } else if (kind === 'd2') {
      cell.classList.add('hl-selected');
      // Clicking Δ²: just highlight it and the adjacent Δs (optional enrichment)
      cell.classList.add('hl-d2');
    }
  });
}

function applyBaseHighlight(rows) {
  // Remove previous base highlights
  document.querySelectorAll('.hl-base').forEach(el => el.classList.remove('hl-base'));
  const nCell = document.querySelector(`td[data-kind="t-n"][data-n="${baseStartN}"]`);
  if (nCell) nCell.classList.add('hl-base');
  const baseIdx = Math.max(0, Math.min(baseStartN, rows - 2));
  const d1Cell = document.querySelector(`td[data-kind="d1"][data-idx="${baseIdx}"]`);
  if (d1Cell) d1Cell.classList.add('hl-base');
}



