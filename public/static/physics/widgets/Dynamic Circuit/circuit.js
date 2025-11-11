(function () {
  "use strict";

  // DOM
  const elV = document.getElementById("voltage");
  const elVVal = document.getElementById("voltageVal");
  const elR1 = document.getElementById("r1");
  const elR2 = document.getElementById("r2");
  const elMode = Array.from(document.querySelectorAll('input[name="mode"]'));
  const elAddMode = Array.from(document.querySelectorAll('input[name="addmode"]'));
  const svg = document.getElementById("circuit");
  const elNewR = document.getElementById("newR");
  const elAdd = document.getElementById("addRes");
  const elNewType = document.getElementById("newType");
  const elAddResistor = document.getElementById("addResistor");
  const elAddBulb = document.getElementById("addBulb");
  const elRemove = document.getElementById("removeSel");

  const elTotalR = document.getElementById("totalR");
  const elTotalI = document.getElementById("totalI");
  const elTotalP = document.getElementById("totalP");
  const elR1VI = document.getElementById("r1VI");
  const elR1P = document.getElementById("r1P");
  const elR2VI = document.getElementById("r2VI");
  const elR2P = document.getElementById("r2P");

  // Geometry
  const W = 900, H = 460;
  const margin = 110; // more white space around the circuit
  const leftX = margin, rightX = W - margin;
  const topY = margin, bottomY = H - margin;
  const centerX = (leftX + rightX) / 2;
  const centerY = (topY + bottomY) / 2;

  // Selection state (multi-select)
  const selectedIds = new Set(); // values: 'r1', 'r2'

  // Dynamic resistor list
  const resistors = [];
  let nextId = 1;
  // Toast helper
  let toastTimer = null;
  function showToast(message) {
    let t = document.getElementById("toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast";
      Object.assign(t.style, {
        position: "fixed",
        bottom: "20px",
        right: "20px",
        background: "#111",
        color: "#fff",
        padding: "10px 12px",
        borderRadius: "8px",
        boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
        zIndex: 9999,
        fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        fontSize: "14px",
        opacity: "0.95"
      });
      document.body.appendChild(t);
    }
    t.textContent = message;
    t.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.style.display = "none"; }, 2200);
  }
  // Simple HTML context menu overlay
  let ctxMenu = null;
  let ohmModal = null;
  let ohmInput = null;
  let ohmSaveBtn = null;
  let ohmCancelBtn = null;
  let pendingAdjustId = null;
  function ensureContextMenu() {
    if (ctxMenu) return ctxMenu;
    ctxMenu = document.createElement("div");
    ctxMenu.id = "ctxMenu";
    Object.assign(ctxMenu.style, {
      position: "absolute",
      display: "none",
      background: "#fff",
      border: "1px solid #c9d2e3",
      borderRadius: "8px",
      boxShadow: "0 6px 18px rgba(16,24,40,0.18)",
      padding: "6px",
      zIndex: "9999",
      fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      fontSize: "14px",
      color: "#111",
      minWidth: "160px"
    });
    const btn = (text) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = text;
      Object.assign(b.style, {
        width: "100%",
        textAlign: "left",
        background: "transparent",
        border: "0",
        padding: "8px 10px",
        cursor: "pointer",
        borderRadius: "6px"
      });
      b.onmouseenter = () => b.style.background = "#f2f4f7";
      b.onmouseleave = () => b.style.background = "transparent";
      return b;
    };
    const bAdjust = btn("Adjust ohmage");
    const bRemove = btn("Remove");
    ctxMenu.appendChild(bAdjust);
    ctxMenu.appendChild(bRemove);
    document.body.appendChild(ctxMenu);
    // handlers set at show-time
    return ctxMenu;
  }
  function ensureOhmModal() {
    if (ohmModal) return ohmModal;
    // Overlay
    ohmModal = document.createElement("div");
    ohmModal.id = "ohmModal";
    // Card
    const card = document.createElement("div");
    card.className = "ohm-card";
    const title = document.createElement("div");
    title.className = "ohm-title";
    title.textContent = "Adjust Resistance";
    const body = document.createElement("div");
    body.className = "ohm-body";
    const label = document.createElement("label");
    label.className = "label";
    label.htmlFor = "ohmInput";
    label.textContent = "Resistance (Ω)";
    ohmInput = document.createElement("input");
    ohmInput.id = "ohmInput";
    ohmInput.type = "number";
    ohmInput.min = "0.01";
    ohmInput.step = "0.01";
    ohmInput.className = "input";
    const actions = document.createElement("div");
    actions.className = "ohm-actions";
    ohmCancelBtn = document.createElement("button");
    ohmCancelBtn.type = "button";
    ohmCancelBtn.className = "btn btn--outline";
    ohmCancelBtn.textContent = "Cancel";
    ohmSaveBtn = document.createElement("button");
    ohmSaveBtn.type = "button";
    ohmSaveBtn.className = "btn";
    ohmSaveBtn.textContent = "Save";
    actions.appendChild(ohmCancelBtn);
    actions.appendChild(ohmSaveBtn);
    body.appendChild(label);
    body.appendChild(ohmInput);
    card.appendChild(title);
    card.appendChild(body);
    card.appendChild(actions);
    ohmModal.appendChild(card);
    document.body.appendChild(ohmModal);
    // Events
    ohmCancelBtn.addEventListener("click", () => closeOhmModal());
    ohmSaveBtn.addEventListener("click", () => {
      const comp = pendingAdjustId ? findComponentRef(pendingAdjustId) : null;
      if (!comp) return closeOhmModal();
      const val = Math.max(0.01, parseFloat(ohmInput.value || "0"));
      if (isFinite(val)) {
        comp.R = val;
        if (resistors[0]?.id === comp.id) if (elR1) elR1.value = String(val);
        if (resistors[1]?.id === comp.id) if (elR2) elR2.value = String(val);
        update();
      }
      closeOhmModal();
    });
    ohmModal.addEventListener("click", (e) => {
      if (e.target === ohmModal) closeOhmModal();
    });
    document.addEventListener("keydown", (e) => {
      if (ohmModal && ohmModal.classList.contains("is-open")) {
        if (e.key === "Escape") { e.preventDefault(); closeOhmModal(); }
        if (e.key === "Enter") { e.preventDefault(); ohmSaveBtn.click(); }
      }
    });
    return ohmModal;
  }
  function openOhmModal(resistorId, currentR) {
    ensureOhmModal();
    pendingAdjustId = resistorId;
    ohmInput.value = String(currentR ?? 10);
    ohmModal.classList.add("is-open");
    setTimeout(() => { try { ohmInput.focus(); ohmInput.select(); } catch (_) {} }, 0);
  }
  function closeOhmModal() {
    if (!ohmModal) return;
    ohmModal.classList.remove("is-open");
    pendingAdjustId = null;
  }
  function showContextMenu(clientX, clientY, resistorId) {
    const m = ensureContextMenu();
    m.dataset.resistorId = resistorId;
    m.style.left = `${clientX + window.scrollX + 6}px`;
    m.style.top = `${clientY + window.scrollY + 6}px`;
    m.style.display = "block";
    // wire buttons
    const [bAdjust, bRemove] = m.querySelectorAll("button");
    bAdjust.onclick = (e) => {
      e.stopPropagation();
      const comp = findComponentRef(resistorId);
      if (!comp) { hideContextMenu(); return; }
      hideContextMenu();
      openOhmModal(resistorId, comp.R);
    };
    bRemove.onclick = (e) => {
      e.stopPropagation();
      removeById(resistorId);
      hideContextMenu();
      update();
    };
  }
  function hideContextMenu() {
    if (ctxMenu) ctxMenu.style.display = "none";
  }
  document.addEventListener("click", () => hideContextMenu());
  window.addEventListener("resize", () => hideContextMenu());

  // Helpers
  function findComponentRef(id) {
    for (const it of resistors) {
      if (it && it.kind === "comp" && it.id === id) return it;
      if (it && it.kind === "parallel" && Array.isArray(it.children)) {
        for (const ch of it.children) {
          if (ch.kind === "comp" && ch.id === id) return ch;
          if (ch.kind === "series" && Array.isArray(ch.children)) {
            const hit = ch.children.find(cc => cc.id === id);
            if (hit) return hit;
          }
        }
      }
    }
    return null;
  }
  function findSelectionInfo(selId) {
    for (let i = 0; i < resistors.length; i++) {
      const it = resistors[i];
      if (it.kind === "comp" && it.id === selId) {
        return { level: "top", idx: i };
      }
      if (it.kind === "parallel") {
        for (let j = 0; j < it.children.length; j++) {
          const ch = it.children[j];
          if (ch.kind === "comp" && ch.id === selId) {
            return { level: "parallel", idx: i, childIndex: j, child: ch };
          }
          if (ch.kind === "series") {
            const si = ch.children.findIndex(cc => cc.id === selId);
            if (si !== -1) {
              return { level: "parallel-series", idx: i, childIndex: j, seriesIndex: si, child: ch };
            }
          }
        }
      }
    }
    return null;
  }
  function clampPos(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function fmt(n, digits = 3) {
    if (!isFinite(n)) return "—";
    const v = Math.abs(n) < 1e-6 ? 0 : n;
    return Number(v.toFixed(digits)).toString();
  }
  function fmtR(r) { return `${fmt(r, 3)} Ω`; }
  function fmtI(i) { return `${fmt(i, 3)} A`; }
  function fmtV(v) { return `${fmt(v, 3)} V`; }
  function fmtP(p) { return `${fmt(p, 3)} W`; }

  // Physics for N resistors
  function computeSeriesN(V, list) {
    // Support components and parallel groups at the top level
    if (list.length === 0) {
      return { Rtot: Infinity, Itot: 0, Ptot: 0, per: {} };
    }
    const per = {};
    function eqRNode(node) {
      if (node && node.kind === "parallel" && Array.isArray(node.children) && node.children.length > 0) {
        let sumG = 0;
        for (const ch of node.children) {
          const Rc = eqRNode(ch);
          if (Rc > 0) sumG += 1 / Rc;
        }
        return sumG > 0 ? 1 / sumG : Infinity;
      }
      if (node && node.kind === "series" && Array.isArray(node.children) && node.children.length > 0) {
        return node.children.reduce((acc, ch) => acc + eqRNode(ch), 0);
      }
      // default: component
      return Math.max(0.01, node.R || 0); // guard
    }
    const itemReq = list.map(eqRNode);
    const Rtot = itemReq.reduce((a, b) => a + b, 0);
    const Itot = Rtot > 0 && isFinite(Rtot) ? V / Rtot : 0;
    function fillSeries(Vdrop, node) {
      if (node && node.kind === "parallel" && Array.isArray(node.children) && node.children.length > 0) {
        for (const ch of node.children) {
          const Rc = eqRNode(ch);
          const I = Rc > 0 && isFinite(Rc) ? Vdrop / Rc : 0;
          fillSeries(Vdrop, ch);
        }
        return;
      }
      if (node && node.kind === "series" && Array.isArray(node.children) && node.children.length > 0) {
        const Rseries = node.children.reduce((acc, ch) => acc + eqRNode(ch), 0);
        const Ibranch = Rseries > 0 && isFinite(Rseries) ? Vdrop / Rseries : 0;
        for (const ch of node.children) {
          const Rc = eqRNode(ch);
          const Vc = Ibranch * Rc;
          fillSeries(Vc, ch);
        }
        return;
      }
      // component
      const R = Math.max(0.01, node.R || 0);
      const I = Vdrop / R;
      per[node.id] = { V: Vdrop, I, P: Vdrop * I };
    }
    // Distribute along top-level series
    for (let i = 0; i < list.length; i++) {
      const Vdrop = Itot * itemReq[i];
      fillSeries(Vdrop, list[i]);
    }
    return { Rtot, Itot, Ptot: V * Itot, per };
  }

  // Localized parallel group renderers on top/bottom and left/right edges
  function drawLocalParallelGroupTop(cx, yMain, children, pMax, res) {
    const halfSpan = Math.max(RES_RENDER_LEN, 120) / 2;
    const xL = cx - halfSpan, xR = cx + halfSpan;
    // mask the main wire segment to avoid bypass look
    const mask = line(xL, yMain, xR, yMain);
    mask.setAttribute("stroke", "#fff");
    mask.setAttribute("stroke-width", "6");
    mask.setAttribute("pointer-events", "none");
    svg.appendChild(mask);
    // Lanes above/below
    const n = children.length;
    const nAbove = Math.floor(n / 2);
    const nBelow = n - nAbove;
    const laneGap = 22;
    const aboveYs = Array.from({ length: nAbove }, (_, i) => yMain - laneGap * (i + 1));
    const belowYs = Array.from({ length: nBelow }, (_, i) => yMain + laneGap * (i + 1));
    // bus bars
    if (aboveYs.length) { svg.appendChild(line(xL, yMain, xL, aboveYs[aboveYs.length - 1])); svg.appendChild(line(xR, yMain, xR, aboveYs[aboveYs.length - 1])); }
    if (belowYs.length) { svg.appendChild(line(xL, yMain, xL, belowYs[belowYs.length - 1])); svg.appendChild(line(xR, yMain, xR, belowYs[belowYs.length - 1])); }
    // render children
    let idx = 0;
    const lanes = [];
    for (let i = 0; i < nAbove && idx < n; i++, idx++) lanes.push({ comp: children[idx], y: aboveYs[i], pos: "above" });
    for (let i = 0; i < nBelow && idx < n; i++, idx++) lanes.push({ comp: children[idx], y: belowYs[i], pos: "below" });
    const length = xR - xL;
    lanes.forEach(l => {
      const c = l.comp;
      if (c.kind === "series" && Array.isArray(c.children)) {
        const m = c.children.length;
        const spacing = (xR - xL) / (m + 1);
        c.children.forEach((cc, k) => {
          const cx = xL + spacing * (k + 1);
          const sel = selectedIds.has(cc.id);
          const pow = Math.max(0, (res.per[cc.id]?.P || 0));
          const g = componentHorizontal(cc.type || "resistor", cx, l.y, RES_RENDER_LEN, pow, sel);
          g.dataset.resistorId = cc.id;
          g.addEventListener("click", (e) => { e.stopPropagation(); if (sel) selectedIds.delete(cc.id); else selectedIds.add(cc.id); update(); });
          g.addEventListener("contextmenu", (e) => { e.preventDefault(); showContextMenu(e.clientX, e.clientY, cc.id); });
          svg.appendChild(g);
          if (sel) {
            svg.appendChild(popupBox(cx, l.y, [
              `R = ${fmtR(cc.R)}`,
              `V = ${fmtV(res.per[cc.id]?.V || 0)}`,
              `I = ${fmtI(res.per[cc.id]?.I || 0)}`,
              `P = ${fmtP(res.per[cc.id]?.P || 0)}`
            ], l.pos === "above" ? "above" : "below", () => { selectedIds.delete(cc.id); update(); }, cc.id));
          }
        });
      } else {
        const sel = selectedIds.has(c.id);
        const pow = Math.max(0, (res.per[c.id]?.P || 0));
        const g = componentHorizontal(c.type || "resistor", (xL + xR) / 2, l.y, length, pow, sel);
        g.dataset.resistorId = c.id;
        g.addEventListener("click", (e) => { e.stopPropagation(); if (sel) selectedIds.delete(c.id); else selectedIds.add(c.id); update(); });
        g.addEventListener("contextmenu", (e) => { e.preventDefault(); showContextMenu(e.clientX, e.clientY, c.id); });
        svg.appendChild(g);
        if (sel) {
          svg.appendChild(popupBox((xL + xR) / 2, l.y, [
            `R = ${fmtR(c.R)}`,
            `V = ${fmtV(res.per[c.id]?.V || 0)}`,
            `I = ${fmtI(res.per[c.id]?.I || 0)}`,
            `P = ${fmtP(res.per[c.id]?.P || 0)}`
          ], l.pos === "above" ? "above" : "below", () => { selectedIds.delete(c.id); update(); }, c.id));
        }
      }
    });
  }

  function drawLocalParallelGroupLeft(xMain, cy, children, pMax, res) {
    const halfSpan = Math.max(RES_RENDER_LEN, 120) / 2;
    const yT = cy - halfSpan, yB = cy + halfSpan;
    // mask the main wire segment to avoid bypass look
    const mask = line(xMain, yT, xMain, yB);
    mask.setAttribute("stroke", "#fff");
    mask.setAttribute("stroke-width", "6");
    mask.setAttribute("pointer-events", "none");
    svg.appendChild(mask);
    // Lanes left/right
    const n = children.length;
    const nLeft = Math.floor(n / 2);
    const nRight = n - nLeft;
    const laneGap = 22;
    const leftXs = Array.from({ length: nLeft }, (_, i) => xMain - laneGap * (i + 1));
    const rightXs = Array.from({ length: nRight }, (_, i) => xMain + laneGap * (i + 1));
    // bus bars
    if (leftXs.length) { svg.appendChild(line(xMain, yT, leftXs[leftXs.length - 1], yT)); svg.appendChild(line(xMain, yB, leftXs[leftXs.length - 1], yB)); }
    if (rightXs.length) { svg.appendChild(line(xMain, yT, rightXs[rightXs.length - 1], yT)); svg.appendChild(line(xMain, yB, rightXs[rightXs.length - 1], yB)); }
    // render children
    let idx = 0;
    const lanes = [];
    for (let i = 0; i < nLeft && idx < n; i++, idx++) lanes.push({ comp: children[idx], x: leftXs[i], pos: "left" });
    for (let i = 0; i < nRight && idx < n; i++, idx++) lanes.push({ comp: children[idx], x: rightXs[i], pos: "right" });
    const length = yB - yT;
    lanes.forEach(l => {
      const c = l.comp;
      if (c.kind === "series" && Array.isArray(c.children)) {
        const m = c.children.length;
        const spacing = (yB - yT) / (m + 1);
        c.children.forEach((cc, k) => {
          const cy = yT + spacing * (k + 1);
          const sel = selectedIds.has(cc.id);
          const pow = Math.max(0, (res.per[cc.id]?.P || 0));
          const g = componentVertical(cc.type || "resistor", l.x, cy, RES_RENDER_LEN, pow, sel);
          g.dataset.resistorId = cc.id;
          g.addEventListener("click", (e) => { e.stopPropagation(); if (sel) selectedIds.delete(cc.id); else selectedIds.add(cc.id); update(); });
          g.addEventListener("contextmenu", (e) => { e.preventDefault(); showContextMenu(e.clientX, e.clientY, cc.id); });
          svg.appendChild(g);
          if (sel) {
            svg.appendChild(popupBox(l.x, cy, [
              `R = ${fmtR(cc.R)}`,
              `V = ${fmtV(res.per[cc.id]?.V || 0)}`,
              `I = ${fmtI(res.per[cc.id]?.I || 0)}`,
              `P = ${fmtP(res.per[cc.id]?.P || 0)}`
            ], l.pos === "left" ? "left" : "right", () => { selectedIds.delete(cc.id); update(); }, cc.id));
          }
        });
      } else {
        const sel = selectedIds.has(c.id);
        const pow = Math.max(0, (res.per[c.id]?.P || 0));
        const g = componentVertical(c.type || "resistor", l.x, (yT + yB) / 2, length, pow, sel);
        g.dataset.resistorId = c.id;
        g.addEventListener("click", (e) => { e.stopPropagation(); if (sel) selectedIds.delete(c.id); else selectedIds.add(c.id); update(); });
        g.addEventListener("contextmenu", (e) => { e.preventDefault(); showContextMenu(e.clientX, e.clientY, c.id); });
        svg.appendChild(g);
        if (sel) {
          svg.appendChild(popupBox(l.x, (yT + yB) / 2, [
            `R = ${fmtR(c.R)}`,
            `V = ${fmtV(res.per[c.id]?.V || 0)}`,
            `I = ${fmtI(res.per[c.id]?.I || 0)}`,
            `P = ${fmtP(res.per[c.id]?.P || 0)}`
          ], l.pos === "left" ? "left" : "right", () => { selectedIds.delete(c.id); update(); }, c.id));
        }
      }
    });
  }
  function computeParallelN(V, list) {
    if (list.length === 0) {
      return { Rtot: Infinity, Itot: 0, Ptot: 0, per: {} };
    }
    const G = list.reduce((s, r) => s + 1 / r.R, 0);
    const Rtot = 1 / G;
    const per = {};
    let Itot = 0;
    for (const r of list) {
      const Ir = V / r.R;
      const Pr = V * Ir;
      per[r.id] = { V, I: Ir, P: Pr };
      Itot += Ir;
    }
    return { Rtot, Itot, Ptot: V * Itot, per };
  }

  // SVG helpers
  function clear(svg) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
  }
  function line(x1, y1, x2, y2, cls = "wire") {
    const e = document.createElementNS("http://www.w3.org/2000/svg", "line");
    e.setAttribute("x1", x1); e.setAttribute("y1", y1);
    e.setAttribute("x2", x2); e.setAttribute("y2", y2);
    e.setAttribute("stroke", "#333"); e.setAttribute("stroke-width", "4");
    e.setAttribute("stroke-linecap", "round");
    if (cls) e.setAttribute("class", cls);
    return e;
  }
  function dot(x, y) {
    // Dots disabled for cleaner appearance
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    return g;
  }
  const RES_BODY = 60; // constant symbol length for zig-zag body
  const RES_AMP = 8;
  const RES_SEGS = 6;
  const BULB_D = 24;
  const RES_LEAD = 12; // desired minimum lead length on each side
  const RES_RENDER_LEN = RES_BODY + 2 * RES_LEAD; // standard total symbol span

  function drawZigZagHorizontal(cx, cy, length, selected = false) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const left = cx - length / 2, right = cx + length / 2;
    const bodyLen = Math.min(RES_BODY, Math.max(16, length - 16));
    const lead = (length - bodyLen) / 2;
    const x1 = left + lead, x2 = right - lead;

    const lead1 = line(left, cy, x1, cy);
    const lead2 = line(x2, cy, right, cy);
    // leads keep default style; only body highlights
    g.appendChild(lead1); g.appendChild(lead2);

    const path = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    const step = bodyLen / RES_SEGS;
    const points = [];
    for (let i = 0; i <= RES_SEGS; i++) {
      const x = x1 + i * step;
      const y = cy + (i % 2 === 0 ? -RES_AMP : RES_AMP);
      points.push(`${x},${y}`);
    }
    path.setAttribute("points", points.join(" "));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", selected ? "#0d6efd" : "#111");
    path.setAttribute("stroke-width", selected ? "3.5" : "2.5");
    g.appendChild(path);
    // Larger, invisible hit area for easy selection
    const hit = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    hit.setAttribute("x", left - 8);
    hit.setAttribute("y", cy - 22);
    hit.setAttribute("width", length + 16);
    hit.setAttribute("height", 44);
    hit.setAttribute("fill", "#000");
    hit.setAttribute("opacity", "0");
    hit.setAttribute("pointer-events", "all");
    g.appendChild(hit);
    g.style.cursor = "pointer";
    // Attach dataset for hit forwarding convenience (optional)
    g.dataset.hit = "1";
    return g;
  }

  function drawZigZagVertical(cx, cy, length, selected = false) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const top = cy - length / 2, bottom = cy + length / 2;
    const bodyLen = Math.min(RES_BODY, Math.max(16, length - 16));
    const lead = (length - bodyLen) / 2;
    const y1 = top + lead, y2 = bottom - lead;

    const lead1 = line(cx, top, cx, y1);
    const lead2 = line(cx, y2, cx, bottom);
    // leads keep default style; only body highlights
    g.appendChild(lead1); g.appendChild(lead2);

    const path = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    const step = bodyLen / RES_SEGS;
    const points = [];
    for (let i = 0; i <= RES_SEGS; i++) {
      const y = y1 + i * step;
      const x = cx + (i % 2 === 0 ? -RES_AMP : RES_AMP);
      points.push(`${x},${y}`);
    }
    path.setAttribute("points", points.join(" "));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", selected ? "#0d6efd" : "#111");
    path.setAttribute("stroke-width", selected ? "3.5" : "2.5");
    g.appendChild(path);
    // Larger, invisible hit area for easy selection
    const hit = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    hit.setAttribute("x", cx - 22);
    hit.setAttribute("y", top - 8);
    hit.setAttribute("width", 44);
    hit.setAttribute("height", length + 16);
    hit.setAttribute("fill", "#000");
    hit.setAttribute("opacity", "0");
    hit.setAttribute("pointer-events", "all");
    g.appendChild(hit);
    g.style.cursor = "pointer";
    g.dataset.hit = "1";
    return g;
  }

  function drawBulbHorizontal(cx, cy, length, powerFrac, selected = false) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const left = cx - length / 2, right = cx + length / 2;
    const lead = Math.max(8, (length - BULB_D) / 2);
    const x1 = left + lead, x2 = right - lead;
    const lead1 = line(left, cy, x1, cy);
    const lead2 = line(x2, cy, right, cy);
    // leads keep default style; only body highlights
    g.appendChild(lead1); g.appendChild(lead2);
    // Brightness mapping (power in watts):
    //  - 0–0.05W: hold at lightest shade (intensity 0)
    //  - 0.05–4.5W: linear ramp to brightest shade (intensity 1 at 4.5W)
    //  - ≥4.5W: clamp to brightest
    let intensity = 0;
    if (powerFrac >= 4.5) intensity = 1;
    else if (powerFrac > 0.05) intensity = (powerFrac - 0.05) / 4.45;
    intensity = clampPos(intensity, 0, 1);
    // Glow halo (subtle outer light) scales with intensity
    const halo = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    halo.setAttribute("cx", cx); halo.setAttribute("cy", cy);
    halo.setAttribute("r", (BULB_D / 2) + 10 + 16 * intensity);
    halo.setAttribute("fill", `rgba(255, 200, 0, ${0.06 + 0.22 * intensity})`);
    halo.setAttribute("stroke", "none");
    g.appendChild(halo);
    // Bulb body
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", cx); c.setAttribute("cy", cy); c.setAttribute("r", BULB_D / 2);
    // Color ramp: light yellow (#FFF5B4) at 0W to bright orange (#FF8C00) at ≥1W
    const r0 = 255, g0 = 245, b0 = 180;
    const r1 = 255, g1 = 140, b1 = 0;
    const cr = Math.round(r0 + (r1 - r0) * intensity);
    const cg = Math.round(g0 + (g1 - g0) * intensity);
    const cb = Math.round(b0 + (b1 - b0) * intensity);
    c.setAttribute("fill", `rgb(${cr}, ${cg}, ${cb})`);
    c.setAttribute("stroke", selected ? "#0d6efd" : "#111");
    c.setAttribute("stroke-width", selected ? "3" : "2");
    g.appendChild(c);
    // Larger, invisible hit area for easy selection
    const hit = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    hit.setAttribute("x", left - 8);
    hit.setAttribute("y", cy - (BULB_D / 2) - 16);
    hit.setAttribute("width", length + 16);
    hit.setAttribute("height", BULB_D + 32);
    hit.setAttribute("fill", "#000");
    hit.setAttribute("opacity", "0");
    hit.setAttribute("pointer-events", "all");
    g.appendChild(hit);
    g.style.cursor = "pointer";
    g.dataset.hit = "1";
    return g;
  }

  function drawBulbVertical(cx, cy, length, powerFrac, selected = false) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const top = cy - length / 2, bottom = cy + length / 2;
    const lead = Math.max(8, (length - BULB_D) / 2);
    const y1 = top + lead, y2 = bottom - lead;
    const lead1 = line(cx, top, cx, y1);
    const lead2 = line(cx, y2, cx, bottom);
    g.appendChild(lead1); g.appendChild(lead2);
    // Brightness mapping (power in watts):
    //  - 0–0.05W: hold at lightest shade (intensity 0)
    //  - 0.05–4.5W: linear ramp to brightest shade (intensity 1 at 4.5W)
    //  - ≥4.5W: clamp to brightest
    let intensity = 0;
    if (powerFrac >= 4.5) intensity = 1;
    else if (powerFrac > 0.05) intensity = (powerFrac - 0.05) / 4.45;
    intensity = clampPos(intensity, 0, 1);
    // Glow halo scales with intensity
    const halo = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    halo.setAttribute("cx", cx); halo.setAttribute("cy", cy);
    halo.setAttribute("r", (BULB_D / 2) + 10 + 16 * intensity);
    halo.setAttribute("fill", `rgba(255, 200, 0, ${0.06 + 0.22 * intensity})`);
    halo.setAttribute("stroke", "none");
    g.appendChild(halo);
    // Bulb body
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", cx); c.setAttribute("cy", cy); c.setAttribute("r", BULB_D / 2);
    // Color ramp: light yellow (#FFF5B4) at 0W to bright orange (#FF8C00) at ≥1W
    const r0 = 255, g0 = 245, b0 = 180;
    const r1 = 255, g1 = 140, b1 = 0;
    const cr = Math.round(r0 + (r1 - r0) * intensity);
    const cg = Math.round(g0 + (g1 - g0) * intensity);
    const cb = Math.round(b0 + (b1 - b0) * intensity);
    c.setAttribute("fill", `rgb(${cr}, ${cg}, ${cb})`);
    c.setAttribute("stroke", selected ? "#0d6efd" : "#111");
    c.setAttribute("stroke-width", selected ? "3" : "2");
    g.appendChild(c);
    // Larger, invisible hit area for easy selection
    const hit = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    hit.setAttribute("x", cx - (BULB_D / 2) - 16);
    hit.setAttribute("y", top - 8);
    hit.setAttribute("width", BULB_D + 32);
    hit.setAttribute("height", length + 16);
    hit.setAttribute("fill", "#000");
    hit.setAttribute("opacity", "0");
    hit.setAttribute("pointer-events", "all");
    g.appendChild(hit);
    g.style.cursor = "pointer";
    g.dataset.hit = "1";
    return g;
  }

  function componentHorizontal(kind, cx, cy, length, powerFrac, selected) {
    if (kind === "bulb") return drawBulbHorizontal(cx, cy, length, powerFrac, selected);
    return drawZigZagHorizontal(cx, cy, length, selected);
  }
  function componentVertical(kind, cx, cy, length, powerFrac, selected) {
    if (kind === "bulb") return drawBulbVertical(cx, cy, length, powerFrac, selected);
    return drawZigZagVertical(cx, cy, length, selected);
  }
  function label(text, x, y, anchor = "middle") {
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", x); t.setAttribute("y", y);
    t.setAttribute("text-anchor", anchor);
    t.setAttribute("font-size", "14");
    t.setAttribute("font-family", "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif");
    t.setAttribute("fill", "#222");
    t.textContent = text;
    return t;
  }

  // Small SVG popup showing lines of text near a resistor
  function popupBox(x, y, lines, position = "above", onToggle = null, resistorId = null) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    // Allow clicks on popup to toggle selection off
    g.style.cursor = onToggle ? "pointer" : "default";
    const maxChars = Math.max(0, ...lines.map(s => s.length));
    const width = Math.max(100, Math.min(220, maxChars * 7 + 16));
    const height = lines.length * 16 + 12;
    let px = x, py = y;
    if (position === "above") { px = x - width / 2; py = y - height - 8; }
    else if (position === "below") { px = x - width / 2; py = y + 8; }
    else if (position === "left") { px = x - width - 8; py = y - height / 2; }
    else if (position === "right") { px = x + 8; py = y - height / 2; }

    // Clamp within SVG viewport
    px = Math.max(8, Math.min(px, W - width - 8));
    py = Math.max(8, Math.min(py, H - height - 8));

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", px); rect.setAttribute("y", py);
    rect.setAttribute("width", width); rect.setAttribute("height", height);
    rect.setAttribute("rx", "6"); rect.setAttribute("ry", "6");
    rect.setAttribute("fill", "#ffffff");
    rect.setAttribute("stroke", "#0d6efd");
    rect.setAttribute("stroke-width", "1.5");
    g.appendChild(rect);

    lines.forEach((text, i) => {
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", px + 8); t.setAttribute("y", py + 18 + i * 16);
      t.setAttribute("text-anchor", "start");
      t.setAttribute("font-size", "14");
      t.setAttribute("font-family", "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif");
      t.setAttribute("fill", "#111");
      t.textContent = text;
      g.appendChild(t);
    });
    if (onToggle) {
      g.addEventListener("click", (e) => {
        e.stopPropagation();
        onToggle();
      });
    }
    if (resistorId) {
      g.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        showContextMenu(e.clientX, e.clientY, resistorId);
      });
    }
    return g;
  }

  function drawRectangleLoop(opts = {}) {
    const topGap = opts.topGap || null; // [x1, x2] to skip drawing top segment
    // Top
    if (topGap && Array.isArray(topGap) && topGap.length === 2) {
      const [gx1, gx2] = topGap;
      if (gx1 > leftX) svg.appendChild(line(leftX, topY, gx1, topY));
      if (gx2 < rightX) svg.appendChild(line(gx2, topY, rightX, topY));
    } else {
      svg.appendChild(line(leftX, topY, rightX, topY)); // full top
    }
    // Right, Bottom
    svg.appendChild(line(rightX, topY, rightX, bottomY));
    svg.appendChild(line(rightX, bottomY, leftX, bottomY));
    // Battery symbol centered on left wire: two perpendicular lines centered on the rail,
    // and the left rail has a small gap between the two terminals.
    const plateLong = 46;
    const plateShort = 26;
    const plateGap = 26; // vertical distance between plates
    const yPlus = centerY - plateGap / 2;
    const yMinus = centerY + plateGap / 2;
    // Left rail segments with gap between terminals
    svg.appendChild(line(leftX, topY, leftX, yPlus));
    svg.appendChild(line(leftX, yMinus, leftX, bottomY));
    // Plates (centered on the wire)
    const plateP = line(leftX - plateLong / 2, yPlus, leftX + plateLong / 2, yPlus);
    const plateN = line(leftX - plateShort / 2, yMinus, leftX + plateShort / 2, yMinus);
    svg.appendChild(plateP);
    svg.appendChild(plateN);
    // Labels near the right ends of plates
    const tPlus = document.createElementNS("http://www.w3.org/2000/svg", "text");
    tPlus.setAttribute("x", leftX + plateLong / 2 + 8); tPlus.setAttribute("y", yPlus + 5);
    tPlus.setAttribute("text-anchor", "start");
    tPlus.setAttribute("font-size", "18");
    tPlus.setAttribute("font-family", "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif");
    tPlus.setAttribute("fill", "#d00");
    tPlus.textContent = "+";
    svg.appendChild(tPlus);
    const tMinus = document.createElementNS("http://www.w3.org/2000/svg", "text");
    tMinus.setAttribute("x", leftX + plateShort / 2 + 8); tMinus.setAttribute("y", yMinus + 5);
    tMinus.setAttribute("text-anchor", "start");
    tMinus.setAttribute("font-size", "18");
    tMinus.setAttribute("font-family", "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif");
    tMinus.setAttribute("fill", "#111");
    tMinus.textContent = "-";
    svg.appendChild(tMinus);
  }

  function render(mode, V, list, res) {
    clear(svg);

    // Normalize power for brightness across all components in 'per'
    let pMax = 1e-9;
    for (const k in res.per) {
      if (Object.prototype.hasOwnProperty.call(res.per, k)) {
        pMax = Math.max(pMax, Math.max(0, res.per[k].P));
      }
    }

    if (mode === "series") {
      drawRectangleLoop();
      // Series: distribute evenly around all four edges, colinear with the local edge
      const n = list.length;
      const width = rightX - leftX;
      const height = bottomY - topY;
      const perimeter = 2 * (width + height);
      const arcGap = perimeter / (n + 1);
      const cornerPad = 18; // keep clear of corners so wires stay visually connected

      function positionAlongPerimeter(s) {
        // s: distance from left-top corner along top→right→bottom→left
        let d = s % perimeter;
        if (d < width) {
          // top edge (left→right)
          return { x: leftX + d, y: topY, edge: "top" };
        }
        d -= width;
        if (d < height) {
          // right edge (top→bottom)
          return { x: rightX, y: topY + d, edge: "right" };
        }
        d -= height;
        if (d < width) {
          // bottom edge (right→left)
          return { x: rightX - d, y: bottomY, edge: "bottom" };
        }
        d -= width;
        // left edge (bottom→top)
        return { x: leftX, y: bottomY - d, edge: "left" };
      }

      list.forEach((item, i) => {
        const s = arcGap * (i + 1);
        const pos = positionAlongPerimeter(s);
        // Nudge away from corners to avoid too-short bodies
        let px = pos.x, py = pos.y;
        const guard = 28;
        if (pos.edge === "top" || pos.edge === "bottom") {
          if (px - leftX < guard) px = leftX + guard;
          else if (rightX - px < guard) px = rightX - guard;
        } else {
          if (py - topY < guard) py = topY + guard;
          else if (bottomY - py < guard) py = bottomY - guard;
        }

        // Use a standard symbol span everywhere
        const rLen = RES_RENDER_LEN;

        if (pos.edge === "top" || pos.edge === "bottom") {
          const y = py;
          // Keep away from corners: clamp center so the full symbol fits with margin
          const half = rLen / 2;
          px = clampPos(px, leftX + cornerPad + half, rightX - cornerPad - half);
          const x1 = px - half;
          const x2 = px + half;
          if (item && item.kind === "parallel" && Array.isArray(item.children)) {
            // Localized parallel group on top/bottom edge
            drawLocalParallelGroupTop(px, y, item.children, pMax, res);
          } else {
            const r = item;
            const sel = selectedIds.has(r.id);
            const f = Math.max(0, (res.per[r.id]?.P || 0));
            svg.appendChild(dot(x1, y));
            svg.appendChild(dot(x2, y));
            const g = componentHorizontal(r.type || "resistor", px, y, rLen, f, sel);
            g.dataset.resistorId = r.id;
            g.addEventListener("click", (e) => {
              e.stopPropagation();
              if (selectedIds.has(r.id)) selectedIds.delete(r.id); else selectedIds.add(r.id);
              update();
            });
            g.addEventListener("contextmenu", (e) => {
              e.preventDefault();
              showContextMenu(e.clientX, e.clientY, r.id);
            });
            svg.appendChild(g);
            if (sel) {
              const popupPos = pos.edge === "top" ? "below" : "above";
              svg.appendChild(popupBox(px, y, [
                `R = ${fmtR(r.R)}`,
                `V = ${fmtV(res.per[r.id].V)}`,
                `I = ${fmtI(res.per[r.id].I)}`,
                `P = ${fmtP(res.per[r.id].P)}`
              ], popupPos, () => { selectedIds.delete(r.id); update(); }, r.id));
            }
          }
        } else {
          const x = px;
          // Keep away from corners: clamp center so the full symbol fits with margin
          let half = rLen / 2;
          py = clampPos(py, topY + cornerPad + half, bottomY - cornerPad - half);
          // Avoid overlapping the left-rail battery: reserve a vertical band
          const plateGap = 26;
          const reserveMargin = 18;
          const clearTop = centerY - plateGap / 2 - reserveMargin;
          const clearBottom = centerY + plateGap / 2 + reserveMargin;
          if (x === leftX) {
            let y1 = py - half;
            let y2 = py + half;
            if (!(y2 < clearTop || y1 > clearBottom)) {
            // Nudge above or below the reserved band
              if (py <= centerY) py = clearTop - half - 2;
              else py = clearBottom + half + 2;
              // Clamp within bounds after nudge
              py = clampPos(py, topY + cornerPad + half, bottomY - cornerPad - half);
            }
          }
          const y1 = py - half;
          const y2 = py + half;
          if (item && item.kind === "parallel" && Array.isArray(item.children)) {
            drawLocalParallelGroupLeft(x, py, item.children, pMax, res);
          } else {
            const r = item;
            const sel = selectedIds.has(r.id);
            const f = Math.max(0, (res.per[r.id]?.P || 0));
            svg.appendChild(dot(x, y1));
            svg.appendChild(dot(x, y2));
            const g = componentVertical(r.type || "resistor", x, py, rLen, f, sel);
            g.dataset.resistorId = r.id;
            g.addEventListener("click", (e) => {
              e.stopPropagation();
              if (selectedIds.has(r.id)) selectedIds.delete(r.id); else selectedIds.add(r.id);
              update();
            });
            g.addEventListener("contextmenu", (e) => {
              e.preventDefault();
              showContextMenu(e.clientX, e.clientY, r.id);
            });
            svg.appendChild(g);
            if (sel) {
              const popupPos = pos.edge === "right" ? "right" : "left";
              svg.appendChild(popupBox(x, py, [
                `R = ${fmtR(r.R)}`,
                `V = ${fmtV(res.per[r.id].V)}`,
                `I = ${fmtI(res.per[r.id].I)}`,
                `P = ${fmtP(res.per[r.id].P)}`
              ], popupPos, () => { selectedIds.delete(r.id); update(); }, r.id));
            }
          }
        }
      });
    } else {
      // Parallel (legacy global view) - not used; kept for reference
      const n = list.length;
      if (n === 0) {
        // With no branches, render intact rectangle (no fork gap)
        drawRectangleLoop();
        return;
      }
      const busInset = Math.min(320, (rightX - leftX) * 0.42); // bring buses further inward to shorten branches
      const xL = leftX + busInset;
      const xR = rightX - busInset;
      const yMain = topY;
      // Break the top wire between fork and rejoin to avoid bypass
      drawRectangleLoop({ topGap: [xL, xR] });

      // Fork/rejoin markers on the main wire
      svg.appendChild(dot(xL, yMain));
      svg.appendChild(dot(xR, yMain));

      // Determine lanes above and below
      const nAbove = Math.floor(n / 2);
      const nBelow = n - nAbove;
      const laneGap = 24; // even shorter vertical runs
      const aboveYs = Array.from({ length: nAbove }, (_, i) => yMain - laneGap * (i + 1));
      const belowYs = Array.from({ length: nBelow }, (_, i) => yMain + laneGap * (i + 1));

      const yTopMost = aboveYs.length ? aboveYs[aboveYs.length - 1] : yMain;
      const yBottomMost = belowYs.length ? belowYs[belowYs.length - 1] : yMain;

      // Draw compact bus bars up and down from the main wire to the extreme lanes
      if (yTopMost !== yMain) {
        svg.appendChild(line(xL, yMain, xL, yTopMost));
        svg.appendChild(line(xR, yMain, xR, yTopMost));
      }
      if (yBottomMost !== yMain) {
        svg.appendChild(line(xL, yMain, xL, yBottomMost));
        svg.appendChild(line(xR, yMain, xR, yBottomMost));
      }

      // Assign resistors to lanes: fill above first, then below
      let idx = 0;
      const lanes = [];
      for (let i = 0; i < nAbove && idx < n; i++, idx++) lanes.push({ id: list[idx].id, y: aboveYs[i], pos: "above" });
      for (let i = 0; i < nBelow && idx < n; i++, idx++) lanes.push({ id: list[idx].id, y: belowYs[i], pos: "below" });

      // Render each branch as a horizontal resistor between bus bars
      const length = xR - xL;
      lanes.forEach(l => {
        const rId = l.id;
        const comp = list.find(x => x.id === rId);
        const sel = selectedIds.has(rId);
        const f = Math.max(0, res.per[rId].P);
        const g = componentHorizontal(comp?.type || "resistor", (xL + xR) / 2, l.y, length, f, sel);
        g.dataset.resistorId = rId;
        g.addEventListener("click", (e) => {
          e.stopPropagation();
          if (selectedIds.has(rId)) selectedIds.delete(rId); else selectedIds.add(rId);
          update();
        });
        g.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          showContextMenu(e.clientX, e.clientY, rId);
        });
        svg.appendChild(g);

        if (sel) {
          svg.appendChild(popupBox((xL + xR) / 2, l.y, [
            `R = ${fmtR(comp?.R ?? 0)}`,
            `V = ${fmtV(res.per[rId].V)}`,
            `I = ${fmtI(res.per[rId].I)}`,
            `P = ${fmtP(res.per[rId].P)}`
          ], l.pos === "above" ? "above" : "below", () => { selectedIds.delete(rId); update(); }, rId));
        }
      });
    }
  }

  function update() {
    const V = parseFloat(elV.value);
    const mode = elMode.find(r => r.checked)?.value || "series";

    elVVal.textContent = fmt(V, 1);

    let res;
    if (mode === "series") res = computeSeriesN(V, resistors);
    else res = computeParallelN(V, resistors);

    elTotalR.textContent = fmtR(res.Rtot);
    elTotalI.textContent = fmtI(res.Itot);
    elTotalP.textContent = fmtP(res.Ptot);

    // Side cards may not exist; guard updates
    if (elR1VI) elR1VI.textContent = "";
    if (elR2VI) elR2VI.textContent = "";
    const first = resistors[0];
    const second = resistors[1];
    if (elR1P) elR1P.textContent = first ? `P=${fmtP(res.per[first.id].P)}` : "";
    if (elR2P) elR2P.textContent = second ? `P=${fmtP(res.per[second.id].P)}` : "";

    render(mode, V, resistors, res);
    // Toggle remove button availability
    if (elRemove) {
      elRemove.disabled = selectedIds.size === 0;
    }
  }

  [elV, elR1, elR2, ...elMode].forEach(input => {
    input.addEventListener("input", update);
    input.addEventListener("change", update);
  });

  // Explicitly bind R1/R2 inputs to only update their respective components
  if (elR1) {
    const syncR1 = () => {
      if (resistors.length >= 1) {
        const v = Math.max(0.01, parseFloat(elR1.value || "0"));
        resistors[0].R = isFinite(v) ? v : resistors[0].R;
        update();
      }
    };
    elR1.addEventListener("input", syncR1);
    elR1.addEventListener("change", syncR1);
  }
  if (elR2) {
    const syncR2 = () => {
      if (resistors.length >= 2) {
        const v = Math.max(0.01, parseFloat(elR2.value || "0"));
        resistors[1].R = isFinite(v) ? v : resistors[1].R;
        update();
      }
    };
    elR2.addEventListener("input", syncR2);
    elR2.addEventListener("change", syncR2);
  }

  function handleAdd(type) {
    const R = Math.max(0.01, parseFloat(elNewR.value || "0"));
    const addMode = (elAddMode.find(r => r.checked)?.value) || "series";
    const sel = Array.from(selectedIds);
    if (sel.length > 1) {
      showToast("Select 0 or 1 component to add.");
      return;
    }
    if (addMode === "parallel" && sel.length === 0) {
      showToast("Select a resistor to add a parallel branch.");
      return;
    }
    const id = `r${nextId++}`;
    const comp = { kind: "comp", id, R, type };
    if (addMode === "series") {
      if (sel.length === 1) {
        const info = findSelectionInfo(sel[0]);
        if (info && info.level === "parallel") {
          const parent = resistors[info.idx];
          const old = parent.children[info.childIndex];
          parent.children[info.childIndex] = { kind: "series", children: [old, comp] };
        } else if (info && info.level === "parallel-series") {
          const parent = resistors[info.idx];
          const ser = parent.children[info.childIndex];
          ser.children.splice(info.seriesIndex + 1, 0, comp);
        } else if (info && info.level === "top") {
          resistors.splice(info.idx + 1, 0, comp);
        } else {
          resistors.push(comp);
        }
      } else {
        resistors.push(comp);
      }
      update();
      return;
    }
    if (sel.length === 1) {
      const selId = sel[0];
      const idx = resistors.findIndex(x => x.id === selId || (x.kind === "parallel" && x.children?.some(c => c.id === selId)));
      if (idx === -1) { showToast("Couldn't locate the selected component."); return; }
      const target = resistors[idx];
      if (target && target.kind === "parallel") {
        target.children.push(comp);
      } else {
        const old = target;
        const oldComp = old.kind === "comp" ? old : { kind: "comp", id: old.id, R: old.R, type: old.type };
        resistors.splice(idx, 1, { kind: "parallel", children: [oldComp, comp] });
      }
      update();
    }
  }
  if (elAddResistor) {
    elAddResistor.addEventListener("click", () => handleAdd("resistor"));
  }
  if (elAddBulb) {
    elAddBulb.addEventListener("click", () => handleAdd("bulb"));
  }
  if (elRemove) {
    elRemove.addEventListener("click", () => {
      if (selectedIds.size === 0) return;
      const ids = Array.from(selectedIds);
      ids.forEach(removeById);
      selectedIds.clear();
      update();
    });
  }

  function removeById(id) {
    const idx = resistors.findIndex(r => r.id === id);
    if (idx >= 0) {
      resistors.splice(idx, 1);
      selectedIds.delete(id);
      return;
    }
    // search inside parallel groups
    for (let i = 0; i < resistors.length; i++) {
      const it = resistors[i];
      if (it.kind === "parallel") {
        for (let j = 0; j < it.children.length; j++) {
          const ch = it.children[j];
          if (ch.kind === "comp" && ch.id === id) {
            it.children.splice(j, 1);
            selectedIds.delete(id);
            if (it.children.length === 1) {
              // collapse to single component
              resistors.splice(i, 1, it.children[0]);
            }
            return;
          }
          if (ch.kind === "series") {
            const si = ch.children.findIndex(cc => cc.id === id);
            if (si !== -1) {
              ch.children.splice(si, 1);
              selectedIds.delete(id);
              if (ch.children.length === 1) {
                it.children[j] = ch.children[0];
              }
              if (it.children.length === 1) {
                resistors.splice(i, 1, it.children[0]);
              }
              return;
            }
          }
        }
      }
    }
  }

  update();
})();

/**
 * Circuit Simulator - Core Logic and Physics Calculations
 * Handles circuit model, component management, and electrical calculations
 */

class Component {
    constructor(id, type, resistance, position = null) {
        this.id = id;
        this.type = type; // 'resistor', 'bulb-10', 'bulb-15', 'bulb-20'
        this.resistance = resistance; // in Ohms
        this.current = 0; // in Amperes
        this.voltage = 0; // in Volts
        this.power = 0; // in Watts
        this.position = position; // {seriesIndex, parallelIndex}
    }

    isBulb() {
        return this.type.startsWith('bulb');
    }

    getDisplayName() {
        if (this.type === 'resistor') {
            return `Resistor (${this.resistance}Ω)`;
        } else if (this.type.startsWith('bulb')) {
            return `Light Bulb (${this.resistance}Ω)`;
        }
        return 'Component';
    }
}

class CircuitSimulator {
    constructor() {
        this.voltage = 12; // Default 12V
        this.components = [];
        this.nextId = 1;
        
        // Circuit topology: array of series positions, each can have parallel components
        // Structure: [ [comp1], [comp2, comp3], [comp4] ]
        // Represents: comp1 --- (comp2 || comp3) --- comp4
        this.topology = [];
        
        // Overall circuit values
        this.totalResistance = 0;
        this.totalCurrent = 0;
        this.totalPower = 0;
        
        // Initialize with default circuit (12V, 10Ω resistor)
        this.initializeDefaultCircuit();
    }

    initializeDefaultCircuit() {
        const defaultResistor = new Component(
            this.nextId++,
            'resistor',
            10,
            { seriesIndex: 0, parallelIndex: 0 }
        );
        this.components.push(defaultResistor);
        this.topology = [[defaultResistor]];
        this.calculateCircuit();
    }

    setVoltage(voltage) {
        this.voltage = parseFloat(voltage);
        this.calculateCircuit();
    }

    addComponent(type, resistance, placementMode = 'series', targetPosition = null) {
        const component = new Component(this.nextId++, type, resistance);
        this.components.push(component);

        if (placementMode === 'series') {
            // Insert as a new series position after target (if provided), else at end
            let insertIndex = this.topology.length;
            if (targetPosition && typeof targetPosition.seriesIndex === 'number') {
                insertIndex = Math.min(targetPosition.seriesIndex + 1, this.topology.length);
            }
            this.topology.splice(insertIndex, 0, [component]);
            component.position = { seriesIndex: insertIndex, parallelIndex: 0 };
            // Reindex positions after insertion
            this.updatePositions();
        } else {
            // Add in parallel to a target series position if provided, else to the last
            if (this.topology.length === 0) {
                // No components yet, add as first series position
                component.position = { seriesIndex: 0, parallelIndex: 0 };
                this.topology.push([component]);
            } else {
                const seriesIndex = (targetPosition && typeof targetPosition.seriesIndex === 'number')
                    ? Math.max(0, Math.min(targetPosition.seriesIndex, this.topology.length - 1))
                    : this.topology.length - 1;
                // Insert after the target parallelIndex if provided, else at end
                const afterIndex = (targetPosition && typeof targetPosition.parallelIndex === 'number')
                    ? Math.max(0, Math.min(targetPosition.parallelIndex + 1, this.topology[seriesIndex].length))
                    : this.topology[seriesIndex].length;
                this.topology[seriesIndex].splice(afterIndex, 0, component);
                component.position = { seriesIndex, parallelIndex: afterIndex };
                // Reindex positions after insertion
                this.updatePositions();
            }
        }

        this.calculateCircuit();
        return component;
    }
    
    addComponentToSelected(type, resistance, placementMode, selectedComponentIds) {
        if (selectedComponentIds.length === 0) {
            // Fallback to old behavior
            return this.addComponent(type, resistance, placementMode);
        }
        
        const newComponent = new Component(this.nextId++, type, resistance);
        this.components.push(newComponent);
        
        // Get the first selected component to determine position
        const selectedComponent = this.getComponentById(selectedComponentIds[0]);
        if (!selectedComponent) {
            // Fallback
            this.topology.push([newComponent]);
            newComponent.position = { seriesIndex: this.topology.length - 1, parallelIndex: 0 };
            this.calculateCircuit();
            return newComponent;
        }
        
        const { seriesIndex, parallelIndex } = selectedComponent.position;
        
        if (placementMode === 'series') {
            // Insert new series position after the selected component
            const newSeriesIndex = seriesIndex + 1;
            this.topology.splice(newSeriesIndex, 0, [newComponent]);
            newComponent.position = { seriesIndex: newSeriesIndex, parallelIndex: 0 };
            
            // Update positions of all components after the insertion
            this.updatePositions();
        } else {
            // Add in parallel to the selected component(s) directly adjacent to selection
            // Insert right after the selected component within the same series position
            const insertIndex = parallelIndex + 1;
            this.topology[seriesIndex].splice(insertIndex, 0, newComponent);
            newComponent.position = { seriesIndex, parallelIndex: insertIndex };
            // Update positions for all components in that series group
            this.updatePositions();
        }
        
        this.calculateCircuit();
        return newComponent;
    }

    removeComponent(componentId) {
        const component = this.components.find(c => c.id === componentId);
        if (!component) return false;

        const { seriesIndex, parallelIndex } = component.position;
        
        // Remove from topology
        this.topology[seriesIndex].splice(parallelIndex, 1);
        
        // If series position is now empty, remove it
        if (this.topology[seriesIndex].length === 0) {
            this.topology.splice(seriesIndex, 1);
        }
        
        // Remove from components array
        const index = this.components.findIndex(c => c.id === componentId);
        this.components.splice(index, 1);
        
        // Update positions for all remaining components
        this.updatePositions();
        
        // Recalculate if there are still components
        if (this.components.length > 0) {
            this.calculateCircuit();
        } else {
            this.resetCircuitValues();
        }
        
        return true;
    }

    moveComponent(componentId, newSeriesIndex, newParallelIndex) {
        const component = this.components.find(c => c.id === componentId);
        if (!component) return false;

        const { seriesIndex, parallelIndex } = component.position;
        
        // Remove from old position
        this.topology[seriesIndex].splice(parallelIndex, 1);
        if (this.topology[seriesIndex].length === 0) {
            this.topology.splice(seriesIndex, 1);
        }
        
        // Adjust indices if necessary
        if (newSeriesIndex > seriesIndex) {
            newSeriesIndex--;
        }
        
        // Ensure series position exists
        while (this.topology.length <= newSeriesIndex) {
            this.topology.push([]);
        }
        
        // Add to new position
        if (newParallelIndex >= this.topology[newSeriesIndex].length) {
            this.topology[newSeriesIndex].push(component);
        } else {
            this.topology[newSeriesIndex].splice(newParallelIndex, 0, component);
        }
        
        // Update all positions
        this.updatePositions();
        this.calculateCircuit();
        
        return true;
    }

    updatePositions() {
        this.topology.forEach((seriesGroup, seriesIndex) => {
            seriesGroup.forEach((component, parallelIndex) => {
                component.position = { seriesIndex, parallelIndex };
            });
        });
    }

    calculateCircuit() {
        if (this.components.length === 0) {
            this.resetCircuitValues();
            return;
        }

        // Step 1: Calculate equivalent resistance for each series position
        const seriesResistances = [];
        this.topology.forEach(parallelGroup => {
            if (parallelGroup.length === 1) {
                // Single component, use its resistance
                seriesResistances.push(parallelGroup[0].resistance);
            } else {
                // Multiple components in parallel: 1/R_eq = 1/R1 + 1/R2 + ...
                const reciprocalSum = parallelGroup.reduce(
                    (sum, comp) => sum + (1 / comp.resistance),
                    0
                );
                seriesResistances.push(1 / reciprocalSum);
            }
        });

        // Step 2: Calculate total resistance (sum of series resistances)
        this.totalResistance = seriesResistances.reduce((sum, r) => sum + r, 0);

        // Step 3: Calculate total current using Ohm's Law: I = V / R
        this.totalCurrent = this.voltage / this.totalResistance;

        // Step 4: Calculate total power: P = V * I
        this.totalPower = this.voltage * this.totalCurrent;

        // Step 5: Calculate voltage and current for each component
        this.topology.forEach((parallelGroup, seriesIndex) => {
            // Voltage drop across this series position
            const seriesVoltage = this.totalCurrent * seriesResistances[seriesIndex];
            
            parallelGroup.forEach(component => {
                // In parallel, voltage is the same across all components
                component.voltage = seriesVoltage;
                
                // Current through each component: I = V / R
                component.current = component.voltage / component.resistance;
                
                // Power dissipated: P = I^2 * R (or V * I)
                component.power = component.current * component.current * component.resistance;
            });
        });
    }

    resetCircuitValues() {
        this.totalResistance = 0;
        this.totalCurrent = 0;
        this.totalPower = 0;
        this.components.forEach(comp => {
            comp.current = 0;
            comp.voltage = 0;
            comp.power = 0;
        });
    }

    reset() {
        this.components = [];
        this.topology = [];
        this.nextId = 1;
        this.voltage = 12;
        this.initializeDefaultCircuit();
    }

    getComponentById(id) {
        return this.components.find(c => c.id === id);
    }

    getAllComponents() {
        return this.components;
    }

    getTopology() {
        return this.topology;
    }

    getStats() {
        return {
            voltage: this.voltage,
            totalCurrent: this.totalCurrent,
            totalResistance: this.totalResistance,
            totalPower: this.totalPower
        };
    }

    getComponentStats(componentId) {
        const component = this.getComponentById(componentId);
        if (!component) return null;

        return {
            id: component.id,
            name: component.getDisplayName(),
            type: component.type,
            resistance: component.resistance,
            voltage: component.voltage,
            current: component.current,
            power: component.power,
            position: component.position
        };
    }

    // Helper method to get maximum power among all bulbs (for brightness normalization)
    getMaxBulbPower() {
        const bulbs = this.components.filter(c => c.isBulb());
        if (bulbs.length === 0) return 0;
        return Math.max(...bulbs.map(b => b.power));
    }
}

// Global circuit instance
let circuit = new CircuitSimulator();

