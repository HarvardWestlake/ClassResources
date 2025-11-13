'use strict';
import {
  vec, add, sub, mul, len, norm, fromAngle,
  Sphere, DEFAULT_ELECTRON_COUNT, targetElectronCountForRadius
} from './core.js';
import { step as physicsStep } from './physics.js';

// Canvas setup with HiDPI support
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
function resizeCanvas() {
  const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const width = Math.floor(window.innerWidth);
  const height = Math.floor(window.innerHeight);
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// UI controls
// Mode radios
const modeDrag = document.getElementById('modeDrag');
const modePaintPos = document.getElementById('modePaintPos');
const modePaintNeg = document.getElementById('modePaintNeg');
const modeDelete = document.getElementById('modeDelete');
// Mode labels for visual active state
const lblModeDrag = document.getElementById('lblModeDrag');
const lblModePaintPos = document.getElementById('lblModePaintPos');
const lblModePaintNeg = document.getElementById('lblModePaintNeg');
const lblModeDelete = document.getElementById('lblModeDelete');
// Add buttons
const btnAddConductor = document.getElementById('btnAddConductor');
const btnAddInsulator = document.getElementById('btnAddInsulator');
const btnClearAll = document.getElementById('btnClearAll');
let mode = 'drag'; // 'drag' | 'paintPos' | 'paintNeg'
function updateMode() {
  mode = (modeDelete && modeDelete.checked) ? 'delete'
    : (modePaintPos.checked ? 'paintPos'
    : (modePaintNeg.checked ? 'paintNeg' : 'drag'));
  renderModeUI();
}
function renderModeUI() {
  if (lblModeDrag) lblModeDrag.classList.toggle('active', mode === 'drag');
  if (lblModePaintPos) lblModePaintPos.classList.toggle('active', mode === 'paintPos');
  if (lblModePaintNeg) lblModePaintNeg.classList.toggle('active', mode === 'paintNeg');
  if (lblModeDelete) lblModeDelete.classList.toggle('active', mode === 'delete');
}
modeDrag.addEventListener('change', updateMode);
modePaintPos.addEventListener('change', updateMode);
modePaintNeg.addEventListener('change', updateMode);
if (modeDelete) modeDelete.addEventListener('change', updateMode);
if (btnClearAll) {
  btnClearAll.addEventListener('click', () => {
    clearAllSpheres();
  });
}
// Initialize mode UI
renderModeUI();
// Intro modal elements and logic
const introModal = document.getElementById('introModal');
const introStep1 = document.getElementById('introStep1');
const introStep2 = document.getElementById('introStep2');
const introBack = document.getElementById('introBack');
const introNext = document.getElementById('introNext');
const introFinish = document.getElementById('introFinish');
let introStepIndex = 0; // 0 or 1
let simulationPaused = false;
function renderIntroStep() {
  if (!introModal) return;
  if (introStep1) introStep1.hidden = (introStepIndex !== 0);
  if (introStep2) introStep2.hidden = (introStepIndex !== 1);
  if (introBack) introBack.hidden = (introStepIndex === 0);
  if (introNext) introNext.hidden = (introStepIndex !== 0);
  if (introFinish) introFinish.hidden = (introStepIndex !== 1);
}
function showIntro() {
  if (!introModal) return;
  introModal.style.display = ''; // visible
  // Pause simulation while intro is shown
  simulationPaused = true;
  introStepIndex = 0;
  renderIntroStep();
  // Focus the first button for a11y
  if (introNext) introNext.focus();
}
function hideIntro() {
  if (!introModal) return;
  introModal.style.display = 'none';
  // Resume simulation
  simulationPaused = false;
}
if (introBack) {
  introBack.addEventListener('click', (e) => {
    e.stopPropagation();
    introStepIndex = Math.max(0, introStepIndex - 1);
    renderIntroStep();
    if (introStepIndex === 0 && introNext) introNext.focus();
  });
}
if (introNext) {
  introNext.addEventListener('click', (e) => {
    e.stopPropagation();
    introStepIndex = Math.min(1, introStepIndex + 1);
    renderIntroStep();
    if (introStepIndex === 1 && introFinish) introFinish.focus();
    if (introStepIndex === 1) drawIntroGraphic();
  });
}
if (introFinish) {
  introFinish.addEventListener('click', (e) => {
    e.stopPropagation();
    hideIntro();
  });
}
// Keyboard shortcuts: Enter/Space to advance, Escape to close
window.addEventListener('keydown', (e) => {
  if (!introModal || introModal.style.display === 'none') return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (introStepIndex === 0 && introNext) {
      introNext.click();
    } else if (introStepIndex === 1 && introFinish) {
      introFinish.click();
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    hideIntro();
  } else if (e.key === 'ArrowLeft' && introBack && !introBack.hidden) {
    e.preventDefault();
    introBack.click();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    if (introStepIndex === 0 && introNext) {
      introNext.click();
    }
  }
});

// Intro modal sample rendering using Sphere.draw for visual parity
function drawIntroGraphic() {
  const introCanvas = document.getElementById('introCanvas');
  if (!introCanvas) return;
  const iCtx = introCanvas.getContext('2d');
  if (!iCtx) return;
  // HiDPI setup
  const cssW = introCanvas.clientWidth || 220;
  const cssH = introCanvas.clientHeight || 220;
  const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  if (introCanvas.width !== Math.floor(cssW * ratio) || introCanvas.height !== Math.floor(cssH * ratio)) {
    introCanvas.width = Math.floor(cssW * ratio);
    introCanvas.height = Math.floor(cssH * ratio);
  }
  iCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  // Clear
  iCtx.clearRect(0, 0, cssW, cssH);
  // Soft background like the main view
  const g = iCtx.createRadialGradient(cssW * 0.5, cssH * 0.5, Math.min(cssW, cssH) * 0.1, cssW * 0.5, cssH * 0.5, Math.max(cssW, cssH) * 0.8);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#f8fafc');
  iCtx.fillStyle = g;
  iCtx.fillRect(0, 0, cssW, cssH);
  // Build a conductor with polarized electrons using the same rendering as simulation
  const cx = cssW * 0.5;
  const cy = cssH * 0.5;
  const r = Math.min(cssW, cssH) * 0.36;
  const n = targetElectronCountForRadius(r);
  const s = new Sphere(cx, cy, r, n, 16, 'conductor'); // slight positive offset for red contrast
  // Create a non-uniform electron distribution: cluster around angle 0, sparse elsewhere
  const electrons = new Array(n);
  const clusterCount = Math.floor(n * 0.7);
  for (let i = 0; i < clusterCount; i++) {
    // Cluster near angle 0 with some spread
    const spread = 0.7;
    const u = (Math.random() - 0.5) * 2; // -1..1
    electrons[i] = u * spread;
  }
  for (let i = clusterCount; i < n; i++) {
    // Distribute remaining around opposite side with wider spread
    const base = Math.PI;
    const spread = 1.0;
    const u = (Math.random() - 0.5) * 2;
    let th = base + u * spread;
    // wrap to [-PI, PI]
    if (th > Math.PI) th -= Math.PI * 2;
    if (th < -Math.PI) th += Math.PI * 2;
    electrons[i] = th;
  }
  s.angles = electrons;
  // Keep protons uniform as in the simulation (already set by constructor)
  // Draw with the same algorithm (conic gradient when available)
  s.draw(iCtx, false);
}
// Add-mode ephemeral state
let pendingAdd = null; // 'conductor' | 'insulator' | null
let addDraft = null; // { type, id, center: {x,y}, radius }
const MIN_RADIUS_PX = 24;
btnAddConductor.addEventListener('click', () => { pendingAdd = 'conductor'; canvas.classList.add('adding'); });
btnAddInsulator.addEventListener('click', () => { pendingAdd = 'insulator'; canvas.classList.add('adding'); });
// On-canvas steppers (dynamic per-conductor)
const stepperContainer = document.getElementById('steppers');
const stepper0 = document.getElementById('stepper0'); // legacy (hide)
const stepper1 = document.getElementById('stepper1'); // legacy (hide)
if (stepper0) stepper0.style.display = 'none';
if (stepper1) stepper1.style.display = 'none';
const dynamicSteppers = new Map(); // index -> { el, valEl }
function removeAllSteppers() {
  for (const rec of dynamicSteppers.values()) {
    if (rec && rec.el && rec.el.parentNode) {
      rec.el.parentNode.removeChild(rec.el);
    }
  }
  dynamicSteppers.clear();
}
function clearAllSpheres() {
  world.spheres = [];
  world.contactPaused = false;
  world.prevTouchingPairs.clear();
  removeAllSteppers();
  updateStepperValues();
  positionSteppers();
}
function deleteSphereByIndex(index) {
  if (index < 0 || index >= world.spheres.length) return;
  world.spheres.splice(index, 1);
  removeAllSteppers();
  updateStepperValues();
  positionSteppers();
}

// Basic vector helpers imported from core.js

// View transform (world -> screen) computed per frame to keep simulation invariant on resize
let viewScale = 1;
let viewOffsetX = 0;
let viewOffsetY = 0;
const VIEW_PAD = 16;
function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
// Keep surface density ~constant: helper imported from core.js
function computeView() {
  // Freeze camera: fixed scale and zero offsets (no auto-zoom/pan)
  viewScale = 1;
  viewOffsetX = 0;
  viewOffsetY = 0;
}
function worldToScreen(x, y) {
  return { x: viewOffsetX + x * viewScale, y: viewOffsetY + y * viewScale };
}

// Color helpers come from core.js (used inside Sphere.draw)

// Physical constants and Sphere are imported from core.js

// Sphere is imported from core.js

// World setup
const world = {
  spheres: [],
  contactPaused: false,
  prevTouchingPairs: new Set() // keys like "i|j"
};
function initWorld() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  // Start empty; user creates spheres via Add buttons
  world.spheres = [];
  updateStepperValues();
  positionSteppers();
}
initWorld();

// (Removed electron count slider)

// Pointer interactions (drag spheres)
let dragging = null; // { sphere, id }
let painting = null; // { id, lastMs }
const PAINT_INTERVAL_MS = 60;
function paintDeltaSign() { return mode === 'paintPos' ? +1 : (mode === 'paintNeg' ? -1 : 0); }
function applyPaintAtPoint(p, delta) {
  if (!delta) return;
  const s = pickSphere(p);
  if (!s) return;
  const idx = world.spheres.indexOf(s);
  if (idx < 0) return;
  if (s.kind === 'insulator') {
    let rel = sub(p, s.center);
    const L = len(rel);
    if (L > s.radius - 1) rel = mul(norm(rel), s.radius - 1);
    if (delta > 0) s.staticPosRel.push(rel); else s.staticNegRel.push(rel);
    // Reinitialize to keep rendering/fields consistent (does not move painted charges)
    s.setElectronCount(0);
    updateStepperValues();
  } else {
    if (s.grounded) return; // ignore painting when grounded
    reinitSphereWithOffset(idx, (s.chargeOffsetElectrons | 0) + delta);
  }
}
function getEventPos(e) {
  const rect = canvas.getBoundingClientRect();
  const cssX = (e.clientX - rect.left);
  const cssY = (e.clientY - rect.top);
  // invert view transform (ignore device ratio; events are in CSS px)
  const wx = (cssX - viewOffsetX) / Math.max(1e-9, viewScale);
  const wy = (cssY - viewOffsetY) / Math.max(1e-9, viewScale);
  return vec(wx, wy);
}
function pickSphere(p) {
  for (let i = world.spheres.length - 1; i >= 0; i--) {
    const s = world.spheres[i];
    if (len(sub(p, s.center)) <= s.radius) return s;
  }
  return null;
}
function maxRadiusForCenter(c) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  return Math.max(0, Math.min(c.x, w - c.x, c.y, h - c.y));
}
function clampSphereToScreen(s) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const r = s.radius;
  s.center.x = clamp(s.center.x, r, w - r);
  s.center.y = clamp(s.center.y, r, h - r);
}
function clampCenterForRadius(c, r) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  return { x: clamp(c.x, r, w - r), y: clamp(c.y, r, h - r) };
}
canvas.addEventListener('pointerdown', (e) => {
  const p = getEventPos(e);
  if (pendingAdd) {
    // begin creation
    const c0 = clampCenterForRadius(p, MIN_RADIUS_PX);
    addDraft = { type: pendingAdd, id: e.pointerId, center: c0, radius: MIN_RADIUS_PX };
    canvas.setPointerCapture(e.pointerId);
  } else if (mode === 'delete') {
    const s = pickSphere(p);
    if (s) {
      const idx = world.spheres.indexOf(s);
      deleteSphereByIndex(idx);
    }
  } else if (mode === 'drag') {
    const s = pickSphere(p);
    if (s) {
      dragging = { sphere: s, id: e.pointerId };
      s.dragOffset = sub(s.center, p);
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add('dragging');
    }
  } else {
    // painting
    painting = { id: e.pointerId, lastMs: 0 };
    canvas.setPointerCapture(e.pointerId);
    applyPaintAtPoint(p, paintDeltaSign());
  }
});
canvas.addEventListener('pointermove', (e) => {
  const p = getEventPos(e);
  if (addDraft && addDraft.id === e.pointerId) {
    const raw = len(sub(p, addDraft.center));
    const desired = Math.max(MIN_RADIUS_PX, raw);
    // Do NOT move the center during sizing; clamp radius to fit current center
    const rMax = maxRadiusForCenter(addDraft.center);
    const r = Math.min(desired, rMax);
    addDraft.radius = isFinite(r) ? Math.max(MIN_RADIUS_PX, r) : MIN_RADIUS_PX;
    return;
  }
  if (dragging && dragging.id === e.pointerId) {
    dragging.sphere.center = add(p, dragging.sphere.dragOffset);
    clampSphereToScreen(dragging.sphere);
    return;
  }
  if (painting && painting.id === e.pointerId) {
    const now = performance.now();
    if (now - painting.lastMs >= PAINT_INTERVAL_MS) {
      painting.lastMs = now;
      applyPaintAtPoint(p, paintDeltaSign());
    }
  }
});
function endDrag(e) {
  if (addDraft && (!e || addDraft.id === e.pointerId)) {
    // finalize creation
    const d = addDraft;
    const kind = d.type;
    // Keep the center where it was during sizing; clamp only radius
    const c = d.center;
    const desired = Math.max(MIN_RADIUS_PX, d.radius);
    const rMax = maxRadiusForCenter(c);
    const r = Math.min(desired, rMax);
    if (kind === 'conductor') {
      const n = targetElectronCountForRadius(r);
      const s = new Sphere(c.x, c.y, r, n, 0, 'conductor');
      s.grounded = false;
      clampSphereToScreen(s);
      world.spheres.push(s);
    } else {
      const s = new Sphere(c.x, c.y, r, 0, 0, 'insulator');
      s.grounded = false;
      clampSphereToScreen(s);
      world.spheres.push(s);
    }
    pendingAdd = null;
    addDraft = null;
    canvas.classList.remove('adding');
    updateStepperValues();
    positionSteppers();
    if (e) canvas.releasePointerCapture(e.pointerId);
  }
  if (dragging && (!e || dragging.id === e.pointerId)) {
    canvas.releasePointerCapture(dragging.id);
    dragging = null;
    canvas.classList.remove('dragging');
  }
  if (painting && (!e || painting.id === e.pointerId)) {
    canvas.releasePointerCapture(painting.id);
    painting = null;
  }
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);


// Rendering
function draw() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  // Background vignette (screen space)
  const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const g = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.1, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#f8fafc');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Compute view to fit world into screen without altering simulation state
  computeView();
  // Apply view transform for world rendering
  ctx.setTransform(ratio * viewScale, 0, 0, ratio * viewScale, ratio * viewOffsetX, ratio * viewOffsetY);

  // (Removed center-connecting line)

  // Determine if ALL spheres are neutral ⇒ suppress dipole coloration (render ring white)
  let allNeutral = world.spheres.length > 0;
  for (const s of world.spheres) {
    if (s.kind === 'conductor') {
      if ((s.chargeOffsetElectrons | 0) !== 0) { allNeutral = false; break; }
    } else {
      const nPos = (s.staticPosRel && s.staticPosRel.length) ? s.staticPosRel.length : 0;
      const nNeg = (s.staticNegRel && s.staticNegRel.length) ? s.staticNegRel.length : 0;
      if ((nPos - nNeg) !== 0) { allNeutral = false; break; }
    }
  }
  for (const s of world.spheres) s.draw(ctx, allNeutral);
  // Creation preview
  if (addDraft) {
    const c = addDraft.center;
    const r = Math.max(MIN_RADIUS_PX, addDraft.radius);
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = addDraft.type === 'conductor' ? 'rgba(220,240,255,0.85)' : 'rgba(255,220,140,0.85)';
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  positionSteppers();
  updateStepperValues();
}

// Animation loop
let last = performance.now();
function frame(now) {
  const dtMs = Math.min(32, now - last);
  last = now;
  if (!simulationPaused) physicsStep(world, dtMs / 1000);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Show intro after initial setup
showIntro();

// Re-center spheres on resize to keep them visible
window.addEventListener('resize', () => {
  // Do not alter simulation state on resize; only UI overlays need repositioning
  positionSteppers();
});

// Prevent context menu during dragging
window.addEventListener('contextmenu', (e) => {
  if (dragging) e.preventDefault();
});

// Stepper logic
function clampOffset(offset) {
  const n = DEFAULT_ELECTRON_COUNT;
  if (offset < -n) return -n;
  if (offset > n) return n;
  return offset | 0;
}
function reinitSphereWithOffset(index, newOffset) {
  const s = world.spheres[index];
  const clamped = clampOffset(newOffset);
  s.chargeOffsetElectrons = clamped;
  s.angles = [];
  s.phase = Math.random() * Math.PI * 2;
  s.latticePhase = Math.random() * Math.PI * 2;
  s.setElectronCount(targetElectronCountForRadius(s.radius));
  updateStepperValues();
}
function ensureStepperFor(index) {
  if (dynamicSteppers.has(index)) return dynamicSteppers.get(index);
  const s = world.spheres[index];
  if (!s || s.kind !== 'conductor') return null;
  const el = document.createElement('div');
  el.className = 'stepper';
  const valEl = document.createElement('div');
  valEl.className = 'val';
  valEl.textContent = `Q: ${String((s.chargeOffsetElectrons | 0))} e`;
  const btnGnd = document.createElement('button');
  btnGnd.className = 'btn gnd';
  btnGnd.textContent = 'Ground';
  el.appendChild(valEl);
  el.appendChild(btnGnd);
  el.style.position = 'absolute';
  el.style.pointerEvents = 'auto';
  stepperContainer.appendChild(el);
  btnGnd.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const sph = world.spheres[index];
    sph.grounded = !sph.grounded;
  });
  const rec = { el, valEl, btnGnd };
  dynamicSteppers.set(index, rec);
  return rec;
}
function updateStepperValues() {
  // Ensure steppers exist for all conductors; update their values
  for (let i = 0; i < world.spheres.length; i++) {
    const s = world.spheres[i];
    const rec = dynamicSteppers.get(i);
    if (s && s.kind === 'conductor') {
      const step = ensureStepperFor(i);
      if (step) {
        const offset = (s.chargeOffsetElectrons | 0);
        const sign = offset > 0 ? '+' : '';
        step.valEl.textContent = `Q: ${sign}${offset} e`;
        step.el.style.display = '';
        const grounded = !!s.grounded;
        step.btnGnd.classList.toggle('active', grounded);
      }
    } else if (rec) {
      rec.el.style.display = 'none';
    }
  }
}
function positionSteppers() {
  for (let i = 0; i < world.spheres.length; i++) {
    const s = world.spheres[i];
    const rec = dynamicSteppers.get(i);
    if (!rec || !s || s.kind !== 'conductor') continue;
    const stepper = rec.el;
    const rect = stepper.getBoundingClientRect();
    const w = rect.width || 80, h = rect.height || 28;
    const scr = worldToScreen(s.center.x, s.center.y);
    let x = scr.x - w / 2;
    let y = scr.y - s.radius * viewScale - h - 8; // above sphere in screen space
    if (y < 8) y = scr.y + s.radius * viewScale + 8; // place below if too high
    if (x < 8) x = 8; else if (x + w > window.innerWidth - 8) x = window.innerWidth - 8 - w;
    stepper.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
}


