/* Intermolecular Forces (IMFs): Interactive Particle Simulation + Molecule Close-ups
   - Scenarios: Honey (H-bond network with sugars + water), DMSO (dipole–dipole), Hexane (London dispersion)
   - Canvas-based 2D particle sim with LJ + directional terms
   - High-fidelity SVG molecule renderer lives in molecules.js
*/

import { renderMolecule, molecules } from "./molecules.js";

// ---------------- Utilities ----------------
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

// Gaussian(0,1) via Box–Muller
function randNorm() {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// 2D vector helpers
function vAdd(a, b) {
  return [a[0] + b[0], a[1] + b[1]];
}
function vSub(a, b) {
  return [a[0] - b[0], a[1] - b[1]];
}
function vMul(a, k) {
  return [a[0] * k, a[1] * k];
}
function vLen(a) {
  return Math.hypot(a[0], a[1]);
}
function vNorm(a) {
  const L = vLen(a);
  return L > 1e-12 ? [a[0] / L, a[1] / L] : [0, 0];
}

// ---------------- Simulation Core ----------------
class NeighborGrid {
  constructor(width, height, cellSize) {
    this.width = width;
    this.height = height;
    this.cellSize = Math.max(8, cellSize);
    this.cols = Math.max(1, Math.floor(width / this.cellSize));
    this.rows = Math.max(1, Math.floor(height / this.cellSize));
    this.cells = new Array(this.cols * this.rows);
  }
  clear() {
    for (let i = 0; i < this.cells.length; i++) this.cells[i] = undefined;
  }
  cellIndex(x, y) {
    // Clamp to valid grid bounds (no wrapping)
    const cx = Math.max(
      0,
      Math.min(this.cols - 1, Math.floor(x / this.cellSize))
    );
    const cy = Math.max(
      0,
      Math.min(this.rows - 1, Math.floor(y / this.cellSize))
    );
    return cy * this.cols + cx;
  }
  insert(particle) {
    const idx = this.cellIndex(particle.pos[0], particle.pos[1]);
    if (!this.cells[idx]) this.cells[idx] = [];
    this.cells[idx].push(particle);
  }
  forNeighbors(x, y, radius, fn) {
    const r = radius;
    const minCx = Math.floor((x - r) / this.cellSize);
    const maxCx = Math.floor((x + r) / this.cellSize);
    const minCy = Math.floor((y - r) / this.cellSize);
    const maxCy = Math.floor((y + r) / this.cellSize);
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) continue;
        const ix = cx;
        const iy = cy;
        const idx = iy * this.cols + ix;
        const cell = this.cells[idx];
        if (!cell) continue;
        for (let j = 0; j < cell.length; j++) fn(cell[j]);
      }
    }
  }
}

function makeParticle(x, y, kind) {
  return {
    kind, // "honey", "dmso", "hexane"
    pos: [x, y],
    vel: [randRange(-20, 20), randRange(-20, 20)],
    angle: Math.random() * Math.PI * 2,
    angVel: randRange(-2, 2),
    mass: 1,
    radius: 4.5, // 1.5x bigger than previous (was 3)
    state: "liquid",
    gasUntil: 0,
    localNeighbors: 0,
    thermalEnergy: 0, // 0-1, accumulates when heated
    lastStateChange: 0, // timestamp of last state change
  };
}

function scenarioDefaults(kind) {
  if (kind === "honey") {
    return {
      label: "Honey (H-bond)",
      epsilon: 0.7,
      sigma: 10,
      viscosity: 10, // Increased from 5 to make it much harder to evaporate
      hbStrength: 2.5, // Increased from 1.8 to make hydrogen bonds stronger
      dipole: 0.0,
      N: 300, // Increased from 200 to 300
      color: "#5ac8fa",
    };
  }
  if (kind === "dmso") {
    return {
      label: "DMSO (dipole–dipole)",
      epsilon: 0.6,
      sigma: 10,
      viscosity: 1.2,
      hbStrength: 0.0,
      dipole: 1.6,
      N: 300, // Increased from 200 to 300
      color: "#ffd60a",
    };
  }
  // hexane
  return {
    label: "Hexane (dispersion)",
    epsilon: 0.05, // Extremely weak - minimal London dispersion forces
    sigma: 10,
    viscosity: 0.05, // Extremely low viscosity - particles barely stick together
    hbStrength: 0.0,
    dipole: 0.0,
    N: 300, // Increased from 200 to 300
    color: "#8ab6ff",
  };
}

class IMFSim {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = canvas.clientWidth || 450; // Halved from 900 to 450
    this.height = canvas.clientHeight || 420;
    this.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    this.setSize();
    this.running = false;
    this.params = { ...scenarioDefaults("honey"), kT: 1.0 };
    this.particles = [];
    this.grid = new NeighborGrid(this.width, this.height, 12); // Grid cell size optimized for particles (radius 4.5)
    this.lastMs = 0;
    this.frameId = 0;
    this.gravityOn = true;
    this.contourOn = false;
    this.shadeContour = true;
    this.moleculesVisible = true;
    this.lastThermoMs = 0;
    this.heatingOn = false;
    this.heatIntensity = 3.0; // Heat intensity multiplier (0-3)
    this.heatAccel = 80; // px/s^2 along velocity direction when heating
    // Gas and escape tracking
    this.gasCount = 0; // Current gas particle count
    this.escapedCount = 0; // Total escaped particles for current scenario
    this.escapedParticles = []; // Store escaped particles to display after 30s
    this.gasHistory = []; // {t, gasCount, escapedCount, scenario}
    this.currentScenario = null; // Track current scenario for history
    this.gasStart = performance.now(); // Start time for current scenario
    this.trialEnded = false; // Track if current trial has ended at 30s
    this.spawnParticles();
    this.onVisibility = () => {
      if (document.hidden) this.stop();
    };
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  setSize() {
    const cssW = this.canvas.clientWidth || 450; // Halved from 900
    const cssH = this.canvas.clientHeight || 420;
    this.width = cssW;
    this.height = cssH;
    this.canvas.width = Math.floor(cssW * this.dpr);
    this.canvas.height = Math.floor(cssH * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  spawnParticles() {
    this.particles.length = 0;
    for (let i = 0; i < this.params.N; i++) {
      this.particles.push(
        makeParticle(
          Math.random() * this.width,
          Math.random() * this.height,
          "mol"
        )
      );
    }
  }

  adjustParticleCount(targetN) {
    const n = Math.max(1, Math.min(200, Math.floor(targetN))); // Limit to 200
    this.params.N = n;
    // Remove extras
    while (this.particles.length > n) this.particles.pop();
    // Add new ones
    while (this.particles.length < n) {
      const p = makeParticle(
        Math.random() * this.width,
        Math.random() * this.height,
        "mol"
      );
      // Slightly lower initial speeds for stability when adding
      p.vel[0] *= 0.5;
      p.vel[1] *= 0.5;
      this.particles.push(p);
    }
  }

  changeScenario(kind) {
    const def = scenarioDefaults(kind);
    this.params = { ...def, kT: this.params.kT };
    // Cap particle count at 200
    if (this.params.N > 200) this.params.N = 200;
    const previousScenario = this.currentScenario;
    this.currentScenario = kind; // Track scenario for history
    // If switching scenarios while heating, start a new trial at t=0 for the new scenario
    if (this.heatingOn && previousScenario !== kind) {
      this.gasStart = performance.now();
      this.escapedCount = 0;
      this.escapedParticles = []; // Clear escaped particles for new trial
      this.trialEnded = false;
    }
    this.spawnParticles();
  }

  // Periodic wrap
  wrap(p) {
    // disabled; using wall collisions instead
  }

  // Lennard–Jones force (soft-capped)
  ljForce(rVec) {
    const r = vLen(rVec) + 1e-9;
    const { sigma, epsilon } = this.params;
    // Use material-specific epsilon directly (from scenarioDefaults)
    // This ensures hexane gets very weak LDF (epsilon=0.05) while honey/DMSO get proper values
    const sr = sigma / r;
    const sr2 = sr * sr;
    const sr6 = sr2 * sr2 * sr2;
    const sr12 = sr6 * sr6;
    // F = 24*epsilon*(2*(sigma/r)^12 - (sigma/r)^6) * (1/r) * rhat
    let mag = 24 * epsilon * (2 * sr12 - sr6) * (1 / r);
    // Cutoff & smoothing - shorter range for weak LDFs (hexane)
    // For hexane (epsilon < 0.1), use shorter range to prevent excessive clustering
    const baseRCut = 2.5 * sigma;
    const rCut = epsilon < 0.1 ? 2.0 * sigma : baseRCut; // Shorter range for hexane
    if (r > rCut) mag = 0;
    // Soft clip
    mag = clamp(mag, -60, 60);
    return vMul(vNorm(rVec), -mag);
  }

  // Directional hydrogen-bond-like attraction: favor alignment (proxy)
  hbForce(rVec) {
    const r = vLen(rVec) + 1e-9;
    const E = this.params.hbStrength;
    if (E <= 0) return [0, 0];
    // Increase range for H-bonds - they should have longer reach than LJ
    // Use 2.8 * sigma for H-bonds (longer than LJ's 2.5 * sigma)
    const rCut = 2.8 * this.params.sigma;
    if (r > rCut) return [0, 0];
    const align = 1; // simple scalar; could read particle angles for more fidelity
    // Use gentler falloff: (1 - r/rCut)^0.7 instead of linear
    const falloff = Math.pow(Math.max(0, 1 - r / rCut), 0.7);
    // Force magnitude should be positive for attraction (pulling particles together)
    const f = E * align * falloff;
    return vMul(vNorm(rVec), f);
  }

  // Dipole–dipole proxy: short-range directional term (anti-parallel alignment)
  dipoleForce(rVec) {
    const r = vLen(rVec) + 1e-9;
    const D = this.params.dipole;
    if (D <= 0) return [0, 0];
    const rCut = 2.2 * this.params.sigma;
    if (r > rCut) return [0, 0];
    // Force magnitude should be positive for attraction (pulling particles together)
    const f = D * (1 / (r * r)) * Math.max(0.1, 1 - r / rCut);
    return vMul(vNorm(rVec), f);
  }

  computeForces(dt) {
    // Neighbor build
    this.grid.clear();
    for (let i = 0; i < this.particles.length; i++)
      this.grid.insert(this.particles[i]);
    const rMax = 28;
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].acc = [0, 0];
      this.particles[i].localNeighbors = 0;
    }
    for (let i = 0; i < this.particles.length; i++) {
      const a = this.particles[i];
      const ax = a.pos[0];
      const ay = a.pos[1];
      const densityCut = 2.4 * this.params.sigma;
      this.grid.forNeighbors(ax, ay, rMax, (b) => {
        if (a === b) return;
        let dx = b.pos[0] - ax;
        let dy = b.pos[1] - ay;
        const distSq = dx * dx + dy * dy; // Squared distance for comparison
        const densityCutSq = (2.4 * this.params.sigma) ** 2; // Squared for comparison
        if (distSq < densityCutSq) a.localNeighbors++;

        // Only compute actual distance when needed for force calculations
        const rVec = [dx, dy];

        // Strengthen liquid-liquid interactions, weaken gas interactions
        const bothLiquid = a.state === "liquid" && b.state === "liquid";
        const gasScale = a.state === "gas" || b.state === "gas" ? 0.2 : 1.0;
        const liquidCohesionBoost = bothLiquid ? 1.3 : 1.0; // 30% stronger for liquid-liquid

        // Early exit: skip force calculations if all coefficients are zero
        const cohLJ = (this.params.cohLJ || 1) * liquidCohesionBoost;
        const cohHB = (this.params.cohHB || 1) * liquidCohesionBoost;
        const cohDP = this.params.cohDP || 1;

        if (cohLJ === 0 && cohHB === 0 && cohDP === 0) return; // Skip this neighbor

        const fLJ = vMul(this.ljForce(rVec), cohLJ);
        const fHB = cohHB !== 0 ? vMul(this.hbForce(rVec), cohHB) : [0, 0];
        const fDP = cohDP !== 0 ? vMul(this.dipoleForce(rVec), cohDP) : [0, 0];
        const f = vAdd(
          vAdd(vMul(fLJ, gasScale), vMul(fHB, gasScale)),
          vMul(fDP, gasScale)
        );
        a.acc = vAdd(a.acc, f);
      });
    }
    // Drag + thermostat
    const gamma = 0.3; // fixed moderate drag for stability
    const kT = Math.max(0, this.params.kT || 0);
    const kickSigma = Math.sqrt(2 * gamma * kT);
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.acc[0] += -gamma * p.vel[0] + randNorm() * kickSigma;
      p.acc[1] += -gamma * p.vel[1] + randNorm() * kickSigma;
    }
    // Gentle velocity rescale toward target KE every ~0.5s
    // Skip dense liquid particles to preserve blob structure
    const nowT = performance.now();
    if (!this.lastThermoMs) this.lastThermoMs = nowT;
    if (nowT - this.lastThermoMs > 500) {
      let keSum = 0;
      let count = 0;
      const rhoMin = 3; // Same threshold as state transitions

      // Only consider non-dense particles for thermostat
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        // Skip particles in dense liquid blob (they maintain their own dynamics)
        if (p.localNeighbors < rhoMin || p.state === "gas") {
          keSum +=
            0.5 * (p.mass || 1) * (p.vel[0] * p.vel[0] + p.vel[1] * p.vel[1]);
          count++;
        }
      }

      if (count > 0) {
        const keAvg = keSum / count;
        const keTarget = 40 * (kT + 0.05);
        const s = Math.max(
          0.9,
          Math.min(
            1.1,
            Math.sqrt(Math.max(1e-6, keTarget / Math.max(1e-6, keAvg)))
          )
        );
        if (Math.abs(s - 1) > 0.02) {
          // Only rescale non-dense particles
          for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            if (p.localNeighbors < rhoMin || p.state === "gas") {
              p.vel[0] *= s;
              p.vel[1] *= s;
            }
          }
        }
      }
      this.lastThermoMs = nowT;
    }
  }

  step(dt) {
    let substeps = 1;
    if (this.gravityOn) {
      let maxSpeedSq = 0;
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        const spSq = p.vel[0] * p.vel[0] + p.vel[1] * p.vel[1];
        if (spSq > maxSpeedSq) maxSpeedSq = spSq;
      }
      const maxSpeed = Math.sqrt(maxSpeedSq);
      const minR = 0.5 * (this.particles[0]?.radius || 4.5);
      const safeDisp = Math.max(2, minR); // pixels
      substeps = Math.min(
        12,
        Math.max(2, Math.ceil((maxSpeed * dt) / safeDisp))
      );
    }
    const dtStep = dt / substeps;
    for (let s = 0; s < substeps; s++) {
      // Forces
      this.computeForces(dtStep);
      // Gravity
      if (this.gravityOn) {
        const g = 900;
        for (let i = 0; i < this.particles.length; i++)
          this.particles[i].acc[1] += g;
      }
      // Heating (bottom 5% of container with gradient - stovetop simulation)
      if (this.heatingOn) {
        const aH = this.heatAccel;
        const heatingZoneHeight = this.height * 0.05; // bottom 5% of container
        const heatingZoneTop = this.height - heatingZoneHeight;
        const minHeatIntensity = 0.2; // 20% heat at the 5% mark (top of heating zone)
        // Hexane accumulates thermal energy faster (lower viscosity = faster heating)
        const baseThermalGainRate = 0.03; // Base rate per second
        const isHexane = (this.params.viscosity || 0) < 0.1; // Hexane has very low viscosity
        const thermalGainRate =
          (isHexane ? baseThermalGainRate * 3.0 : baseThermalGainRate) *
          this.heatIntensity; // Scale by heat intensity
        const thermalDissipationRate = 0.015; // Rate per second for dissipation

        // Create non-uniform heating pattern along X-axis (hotspots like real stovetop)
        // Use multiple hotspots with varying intensities
        const hotspotCount = 3; // Number of hotspots
        const hotspotSpacing = this.width / (hotspotCount + 1);

        for (let i = 0; i < this.particles.length; i++) {
          const p = this.particles[i];
          // Ensure thermalEnergy is initialized
          if (p.thermalEnergy === undefined) p.thermalEnergy = 0;

          const r = p.radius || 4.5;
          const particleBottom = p.pos[1] + r; // bottom edge of particle
          const particleX = p.pos[0]; // X position for hotspot calculation

          // Only heat particles in the bottom 5% of container
          if (particleBottom >= heatingZoneTop) {
            // Calculate normalized position in heating zone (0 = very bottom, 1 = 5% mark)
            const distFromBottom = this.height - particleBottom;
            const normalizedDist = Math.max(
              0,
              Math.min(1, distFromBottom / heatingZoneHeight)
            );

            // Vertical gradient: 100% heat at bottom, minHeatIntensity at 5% mark
            const verticalIntensity =
              1.0 - normalizedDist * (1.0 - minHeatIntensity);

            // Calculate horizontal hotspot intensity (non-uniform along X-axis)
            // Use smooth falloff to reduce visual artifacts
            let horizontalIntensity = 0.3; // Base intensity (minimum)
            let totalHotspotContribution = 0;
            let weightedStrength = 0;

            // Check distance to each hotspot and accumulate contributions smoothly
            for (let h = 0; h < hotspotCount; h++) {
              const hotspotX = hotspotSpacing * (h + 1);
              const distToHotspot = Math.abs(particleX - hotspotX);
              const hotspotRadius = this.width * 0.15; // Hotspot influence radius

              // Smooth exponential falloff (squared for smoother transition)
              const normalizedDist = distToHotspot / hotspotRadius;
              const hotspotIntensity = Math.max(
                0,
                Math.pow(1.0 - Math.min(1.0, normalizedDist), 2)
              );

              if (hotspotIntensity > 0) {
                const hotspotStrengths = [1.0, 0.85, 0.7];
                const hotspotStrength = hotspotStrengths[h] || 1.0;
                totalHotspotContribution += hotspotIntensity;
                weightedStrength += hotspotIntensity * hotspotStrength;
              }
            }

            // Blend hotspot contributions smoothly
            const avgHotspotStrength =
              totalHotspotContribution > 0
                ? weightedStrength / totalHotspotContribution
                : 0.7; // Default if no hotspots

            // Combine horizontal and vertical intensity with smooth blending
            horizontalIntensity =
              0.3 + totalHotspotContribution * 0.7 * avgHotspotStrength;
            const heatIntensity = verticalIntensity * horizontalIntensity;

            // Accumulate thermal energy based on heat intensity
            // Scale by dtStep to make it frame-rate independent (rate per second)
            const thermalGain = thermalGainRate * heatIntensity * dtStep;
            p.thermalEnergy = Math.min(
              1.0,
              (p.thermalEnergy || 0) + thermalGain
            );

            // Add upward acceleration for heated particles (buoyancy effect)
            // Heated particles naturally want to rise - use acceleration to overcome gravity
            // Thermal energy provides upward force that opposes gravity
            // At thermalEnergy = 0.4, upwardAccel = -1600, which overcomes gravity (900)
            const upwardAccel = p.thermalEnergy * -2000; // Negative Y = upward, strong enough to overcome gravity
            p.acc[1] += upwardAccel;

            // Also add some direct upward velocity boost for immediate effect
            if (p.thermalEnergy > 0.2) {
              const upwardVelocityBoost = p.thermalEnergy * -40; // Additional upward boost
              p.vel[1] += upwardVelocityBoost * dtStep;
            }

            // Add vibration: particles with high thermal energy vibrate more
            // This helps them break free from cohesive forces
            // Increased strength for visibility - vibration scales with thermal energy
            const vibrationStrength = p.thermalEnergy * 120; // Increased from 30 for visibility
            const vibrationX = (Math.random() - 0.5) * vibrationStrength;
            const vibrationY = (Math.random() - 0.5) * vibrationStrength;
            p.acc[0] += vibrationX;
            p.acc[1] += vibrationY;

            // Apply heating scaled by intensity
            const scaledAccel = aH * heatIntensity;
            const vx = p.vel[0],
              vy = p.vel[1];
            const sp = Math.hypot(vx, vy);
            if (sp > 1e-3) {
              p.acc[0] += (vx / sp) * scaledAccel;
              p.acc[1] += (vy / sp) * scaledAccel;
            } else {
              const ang = Math.random() * Math.PI * 2;
              p.acc[0] += Math.cos(ang) * scaledAccel;
              p.acc[1] += Math.sin(ang) * scaledAccel;
            }
          } else {
            // Dissipate thermal energy when not in heating zone
            // Scale by dtStep to make it frame-rate independent
            p.thermalEnergy = Math.max(
              0,
              (p.thermalEnergy || 0) - thermalDissipationRate * dtStep
            );
            // Particles with thermal energy still vibrate (they carry heat with them)
            if (p.thermalEnergy > 0.1) {
              // Add upward acceleration for particles carrying thermal energy
              const upwardAccel = p.thermalEnergy * -1800; // Slightly less than in heating zone
              p.acc[1] += upwardAccel;

              // Also add upward velocity boost for immediate effect
              if (p.thermalEnergy > 0.2) {
                const upwardVelocityBoost = p.thermalEnergy * -35;
                p.vel[1] += upwardVelocityBoost * dtStep;
              }

              const vibrationStrength = p.thermalEnergy * 80; // Increased from 20 for visibility
              const vibrationX = (Math.random() - 0.5) * vibrationStrength;
              const vibrationY = (Math.random() - 0.5) * vibrationStrength;
              p.acc[0] += vibrationX;
              p.acc[1] += vibrationY;
            }
          }
        }
      } else {
        // When heating is off, gradually dissipate thermal energy
        // Skip if no particles have thermal energy
        const thermalDissipationRate = 0.02; // Rate per second (matches heating dissipation)
        for (let i = 0; i < this.particles.length; i++) {
          const p = this.particles[i];
          const thermalEnergy = p.thermalEnergy || 0;
          // Early exit: skip particles with no thermal energy
          if (thermalEnergy <= 0) continue;
          p.thermalEnergy = Math.max(
            0,
            thermalEnergy - thermalDissipationRate * dtStep
          );
        }
      }
      // Buoyancy (reduced for more realistic behavior)
      if (this.gravityOn) {
        for (let i = 0; i < this.particles.length; i++) {
          const p = this.particles[i];
          if (p.state === "gas") p.acc[1] -= 300; // Reduced from 600
        }
        // Add floor attraction for liquid particles to resist evaporation
        // Stronger attraction for higher viscosity materials
        const v = this.params.viscosity || 0;
        const floorAttractionStrength = v > 5 ? 200 : v > 1 ? 100 : 20; // Honey: 200, DMSO: 100, Hexane: 20
        const floorY = this.height;
        for (let i = 0; i < this.particles.length; i++) {
          const p = this.particles[i];
          if (p.state === "liquid") {
            const distFromFloor = floorY - (p.pos[1] + (p.radius || 4.5));
            if (distFromFloor > 0 && distFromFloor < 50) {
              // Attraction decreases with distance, strongest near floor
              const attractionFactor = 1.0 - (distFromFloor / 50);
              p.acc[1] += floorAttractionStrength * attractionFactor;
            }
          }
        }
      }
      // Integrate (iterate backwards to safely remove particles)
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.vel[0] += (p.acc[0] / p.mass) * dtStep;
        p.vel[1] += (p.acc[1] / p.mass) * dtStep;
        p.pos[0] += p.vel[0] * dtStep;
        p.pos[1] += p.vel[1] * dtStep;

        // Add direct velocity vibration for heated particles (more visible)
        // This creates the jittery vibration effect
        const thermalEnergy = p.thermalEnergy || 0;
        if (thermalEnergy > 0.1) {
          // Frame-independent vibration - scales with thermal energy
          const vibVelStrength = thermalEnergy * 8; // Velocity units per frame
          p.vel[0] += (Math.random() - 0.5) * vibVelStrength;
          p.vel[1] += (Math.random() - 0.5) * vibVelStrength;
        }

        this.handleWalls(p);
      }
      // Collisions iterations (reduced to 1 with aggressive resolution and grid reuse)
      // Build grid once and reuse across iterations (if multiple iterations needed)
      let particleIndexMap = null;
      for (let it = 0; it < 1; it++) {
        particleIndexMap = this.resolveCollisions(it > 0, particleIndexMap);
        // Re-clamp particles to walls after collision resolution
        // (collision resolution can push particles outside bounds)
        // Iterate backwards to safely remove particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
          this.handleWalls(this.particles[i]);
        }
      }
      // State update - boiling behavior with thermal energy and hysteresis
      const epsBase = 0.15 + 0.25 * (this.params.viscosity || 0);
      const c1 = 120,
        c2 = 10;
      const rhoMin = 3;
      const nowS = performance.now();
      const minStateDuration = 300; // Minimum time in state before transitioning (ms)

      // Higher energy threshold for escaping dense liquid (boiling)
      // Viscosity makes it harder to evaporate - scale threshold with viscosity
      // Stronger intermolecular forces (via cohesion coefficients) naturally reduce evaporation
      // Map viscosity to escape multiplier: honey (10) -> 4.0, DMSO (1.2) -> 2.2, hexane (0.05) -> 1.5
      const v = this.params.viscosity || 0;
      // Better separation: DMSO should be significantly harder to evaporate than hexane
      const escapeMultiplier = v > 5 
        ? 1.5 + (v - 5) * 0.5  // Honey: 4.0
        : v > 1 
          ? 1.5 + (v - 0.05) * 0.5  // DMSO: 1.5 + 1.15*0.5 = 2.075 (increased from 1.62)
          : 1.5 + v * 0.1;  // Hexane: 1.505
      // Map viscosity to thermal threshold [0,1]: honey (10) -> 0.85, DMSO (1.2) -> 0.6, hexane (0.05) -> 0.26
      // Piecewise: low v uses linear, high v uses slower scaling
      const thermalBoilingThreshold = v <= 2 
        ? Math.min(0.95, 0.25 + v * 0.29)  // DMSO: 0.25 + 1.2*0.29 = 0.598, Hexane: 0.25 + 0.05*0.29 = 0.2645
        : Math.min(0.95, 0.5 + (v - 2) * 0.04375); // Honey: 0.5 + 8*0.04375 = 0.85

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        const v2 = p.vel[0] * p.vel[0] + p.vel[1] * p.vel[1];
        const vGas2 = c1 * (this.params.kT || 0) + c2 * epsBase;
        const thermalEnergy = p.thermalEnergy || 0;
        const timeSinceStateChange = nowS - (p.lastStateChange || 0);

        if (p.state === "liquid") {
          // Require minimum time in liquid state before transitioning
          // But allow very hot particles to transition faster
          const hotParticle = thermalEnergy > 0.7;
          const effectiveMinDuration = hotParticle
            ? minStateDuration * 0.5
            : minStateDuration;
          if (timeSinceStateChange < effectiveMinDuration) continue;

          // Boiling: Need both high thermal energy AND high kinetic energy
          // Surface particles can evaporate more easily
          if (p.localNeighbors < rhoMin) {
            // Surface/edge particles: material-dependent evaporation threshold
            // Honey needs highest threshold, DMSO needs moderate-high, hexane needs lowest
            // Better separation between DMSO and hexane
            const surfaceMultiplier = v > 5 
              ? 1.8  // Honey: 1.8
              : v > 1 
                ? 1.5  // DMSO: 1.5 (increased from 1.2)
                : 0.7;  // Hexane: 0.7 (reduced from 0.8 for faster evaporation)
            const surfaceThreshold = vGas2 * surfaceMultiplier;
            // Surface thermal threshold: DMSO needs significantly more thermal energy than hexane
            const surfaceThermalThreshold = v > 5 
              ? 0.4 + (v - 2) * 0.05  // Honey: 0.8
              : v > 1 
                ? 0.2 + v * 0.3  // DMSO: 0.2 + 1.2*0.3 = 0.56 (increased from 0.39)
                : 0.12 + v * 0.15;  // Hexane: 0.12 + 0.05*0.15 = 0.1275 (reduced from 0.16)
            if (v2 > surfaceThreshold && thermalEnergy > surfaceThermalThreshold) {
              p.state = "gas";
              p.gasUntil = nowS + 1500;
              p.lastStateChange = nowS;
              // Give upward boost to help escape - hexane gets stronger boost for faster evaporation
              const isHexane = (this.params.viscosity || 0) < 0.1;
              const upwardBoost = isHexane ? -60 : -30; // Hexane: -60, others: -30
              if (p.vel[1] < 50) {
                p.vel[1] += upwardBoost;
              }
            }
          } else {
            // Dense liquid particles: need thermal energy + high kinetic energy to boil
            // Make kinetic energy threshold scale with thermal energy - hotter particles boil easier
            const baseEscapeThreshold = vGas2 * escapeMultiplier;
            // When thermal energy is high, reduce kinetic energy requirement
            const thermalBonus = thermalEnergy * 0.5; // Increased from 0.4 - up to 50% reduction
            const escapeThreshold = baseEscapeThreshold * (1.0 - thermalBonus);

            // Very hot particles can boil with lower kinetic energy
            const veryHotBonus = thermalEnergy > 0.7 ? 0.2 : 0; // Extra 20% reduction for very hot
            const finalThreshold = escapeThreshold * (1.0 - veryHotBonus);

            // Boiling requires accumulated thermal energy from heating
            if (
              v2 > finalThreshold &&
              thermalEnergy > thermalBoilingThreshold
            ) {
              p.state = "gas";
              p.gasUntil = nowS + 2000;
              p.lastStateChange = nowS;
              // Give upward boost to help escape the liquid blob - hexane gets stronger boost
              const isHexane = (this.params.viscosity || 0) < 0.1;
              const upwardBoost = isHexane ? -80 : -40; // Hexane: -80, others: -40
              if (p.vel[1] < 50) {
                p.vel[1] += upwardBoost;
              }
            }
          }
        } else {
          // Gas particles: condense when they cool down
          // Require minimum time in gas state before transitioning back
          if (timeSinceStateChange < minStateDuration) continue;

          const isRising = p.vel[1] < -10; // Moving upward significantly
          const isNearTop = p.pos[1] < this.height * 0.2; // Top 20% of container

          // Condensation thresholds (hysteresis - harder to condense than evaporate)
          const condenseThreshold = isRising ? 0.3 * vGas2 : 0.5 * vGas2;
          const thermalCondenseThreshold = 0.2; // Cool down before condensing

          // Condense if: low energy, low thermal energy, high density (not rising), or reached top
          if (
            (v2 < condenseThreshold &&
              thermalEnergy < thermalCondenseThreshold &&
              !isRising) ||
            (isNearTop &&
              thermalEnergy < thermalCondenseThreshold &&
              v2 < 0.8 * vGas2) ||
            (p.localNeighbors >= rhoMin &&
              !isRising &&
              thermalEnergy < thermalCondenseThreshold)
          ) {
            p.state = "liquid";
            p.lastStateChange = nowS;
            // Reset thermal energy when condensing (unless still in heating zone)
            if (p.pos[1] + p.radius < this.height * 0.9) {
              p.thermalEnergy = Math.max(0, thermalEnergy * 0.5); // Reduce but don't fully reset
            }
          }
        }
      }
      // Update gas count after state transitions
      this.gasCount = 0;
      for (let i = 0; i < this.particles.length; i++) {
        if (this.particles[i].state === "gas") {
          this.gasCount++;
        }
      }
    }
  }

  handleWalls(p) {
    const w = this.width;
    const h = this.height;
    const r = p.radius || 4.5;
    const e = 0.2; // restitution
    const fx = 0.98; // floor friction
    if (p.pos[0] < r) {
      p.pos[0] = r;
      p.vel[0] = -p.vel[0] * e;
    }
    if (p.pos[0] > w - r) {
      p.pos[0] = w - r;
      p.vel[0] = -p.vel[0] * e;
    }
    // Remove particles that hit the top of the container
    if (p.pos[1] < r) {
      const index = this.particles.indexOf(p);
      if (index !== -1) {
        // Store escaped particle info before removing
        this.escapedParticles.push({
          pos: [p.pos[0], p.pos[1]],
          radius: p.radius || 4.5,
          state: p.state,
          thermalEnergy: p.thermalEnergy || 0,
          scenario: this.currentScenario,
        });
        this.particles.splice(index, 1);
        this.escapedCount++; // Increment escaped count
      }
      return; // Particle removed, don't process further
    }
    if (p.pos[1] > h - r) {
      p.pos[1] = h - r;
      p.vel[1] = -p.vel[1] * e;
      p.vel[0] *= fx;
    }
  }

  resolveCollisions(reuseGrid = false, particleIndexMap = null) {
    const rMax = 18; // Optimized for particles (radius 4.5) - ~4x radius for collision detection
    // Only rebuild grid if not reusing
    if (!reuseGrid) {
      this.grid.clear();
      // Cache particle indices for O(1) lookup
      particleIndexMap = new Map();
      for (let i = 0; i < this.particles.length; i++) {
        this.grid.insert(this.particles[i]);
        particleIndexMap.set(this.particles[i], i);
      }
    }
    const e = 0.2; // restitution
    const mu = 0.3; // friction coefficient
    const processed = new Set(); // Track processed pairs to avoid double-counting
    for (let i = 0; i < this.particles.length; i++) {
      const a = this.particles[i];
      const ax = a.pos[0];
      const ay = a.pos[1];
      this.grid.forNeighbors(ax, ay, rMax, (b) => {
        if (a === b) return;
        // O(1) lookup instead of O(n) search
        const j = particleIndexMap.get(b);
        if (j === undefined || j < 0) return; // Safety check
        // Avoid processing same pair twice (always use smaller index first)
        const pairKey = i < j ? `${i},${j}` : `${j},${i}`;
        if (processed.has(pairKey)) return;
        processed.add(pairKey);
        let dx = b.pos[0] - ax;
        let dy = b.pos[1] - ay;
        const distSq = dx * dx + dy * dy; // Squared distance for comparison
        const minDist = (a.radius || 4.5) + (b.radius || 4.5);
        const minDistSq = minDist * minDist;
        if (distSq < minDistSq) {
          const dist = Math.sqrt(distSq) || 1e-9;
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;
          // Aggressive resolution: add small overshoot (1.05x) to ensure separation
          const resolvedOverlap = overlap * 1.05;
          // position correction (split, but fully resolve per iteration)
          const invMa = 1 / (a.mass || 1);
          const invMb = 1 / (b.mass || 1);
          const invSum = invMa + invMb;
          let moveA = resolvedOverlap * (invMa / Math.max(1e-9, invSum));
          let moveB = resolvedOverlap * (invMb / Math.max(1e-9, invSum));
          // Shock propagation against floor: favor moving the non-grounded body
          const rA = a.radius || 4.5;
          const rB = b.radius || 4.5;
          const groundedA = a.pos[1] >= this.height - rA - 0.6;
          const groundedB = b.pos[1] >= this.height - rB - 0.6;
          // If pushing B further into floor (ny>0), don't move B; move A fully
          if (!groundedA && groundedB && ny > 0) {
            moveA = resolvedOverlap;
            moveB = 0;
          }
          // If pushing A into floor (ny<0), don't move A; move B fully
          if (groundedA && !groundedB && ny < 0) {
            moveB = resolvedOverlap;
            moveA = 0;
          }
          a.pos[0] -= nx * moveA;
          a.pos[1] -= ny * moveA;
          b.pos[0] += nx * moveB;
          b.pos[1] += ny * moveB;
          // Safety check: ensure minimum separation is maintained (handle floating point errors)
          const dx2 = b.pos[0] - a.pos[0];
          const dy2 = b.pos[1] - a.pos[1];
          const dist2Sq = dx2 * dx2 + dy2 * dy2;
          const minDistSqCheck = minDistSq * 0.99 * 0.99; // Squared for comparison
          if (dist2Sq < minDistSqCheck) {
            // Still overlapping, apply additional correction
            const dist2 = Math.sqrt(dist2Sq) || 1e-9;
            const overlap2 = minDist - dist2;
            const nx2 = dx2 / dist2;
            const ny2 = dy2 / dist2;
            a.pos[0] -= nx2 * overlap2 * 0.5;
            a.pos[1] -= ny2 * overlap2 * 0.5;
            b.pos[0] += nx2 * overlap2 * 0.5;
            b.pos[1] += ny2 * overlap2 * 0.5;
          }
          // velocity impulse along normal
          const rvx = b.vel[0] - a.vel[0];
          const rvy = b.vel[1] - a.vel[1];
          const vn = rvx * nx + rvy * ny;
          if (vn < 0) {
            const j = (-(1 + e) * vn) / (1 / (a.mass || 1) + 1 / (b.mass || 1));
            const jx = j * nx;
            const jy = j * ny;
            a.vel[0] -= jx / (a.mass || 1);
            a.vel[1] -= jy / (a.mass || 1);
            b.vel[0] += jx / (b.mass || 1);
            b.vel[1] += jy / (b.mass || 1);
            // friction impulse along tangent
            const rvx2 = b.vel[0] - a.vel[0];
            const rvy2 = b.vel[1] - a.vel[1];
            // tangent = rv - (rv·n) n
            let tx = rvx2 - (rvx2 * nx + rvy2 * ny) * nx;
            let ty = rvy2 - (rvx2 * nx + rvy2 * ny) * ny;
            const tlSq = tx * tx + ty * ty; // Squared tangent length
            if (tlSq > 1e-12) {
              // Compare squared value
              const tl = Math.sqrt(tlSq);
              tx /= tl;
              ty /= tl;
              const jt = -mu * Math.abs(j);
              const jtx = jt * tx;
              const jty = jt * ty;
              a.vel[0] -= jtx / (a.mass || 1);
              a.vel[1] -= jty / (a.mass || 1);
              b.vel[0] += jtx / (b.mass || 1);
              b.vel[1] += jty / (b.mass || 1);
            }
            // Thermal conduction: transfer kinetic energy between particles
            // After collision, transfer a fraction of energy difference to simulate heat flow
            const ma = a.mass || 1;
            const mb = b.mass || 1;
            const keA = 0.5 * ma * (a.vel[0] * a.vel[0] + a.vel[1] * a.vel[1]);
            const keB = 0.5 * mb * (b.vel[0] * b.vel[0] + b.vel[1] * b.vel[1]);
            const keTotal = keA + keB;

            // Transfer coefficient: fraction of energy difference transferred per collision
            const transferCoeff = 0.15;
            const keDiff = keA - keB;
            const dE = transferCoeff * keDiff;

            // Only transfer if there's a meaningful energy difference and total KE is positive
            if (Math.abs(dE) > 0.1 && keTotal > 0.5) {
              const newKeA = Math.max(0.5, keA - dE);
              const newKeB = Math.max(0.5, keB + dE);

              // Calculate velocity magnitudes using squared values
              const vMagASq = a.vel[0] * a.vel[0] + a.vel[1] * a.vel[1];
              const vMagBSq = b.vel[0] * b.vel[0] + b.vel[1] * b.vel[1];

              if (vMagASq > 1e-12 && vMagBSq > 1e-12) {
                // Scale velocities to achieve target kinetic energies
                // This preserves direction while transferring energy
                const vMagA = Math.sqrt(vMagASq);
                const vMagB = Math.sqrt(vMagBSq);
                const scaleA = Math.sqrt((2 * newKeA) / (ma * vMagASq));
                const scaleB = Math.sqrt((2 * newKeB) / (mb * vMagBSq));

                // Apply scaling (small adjustments preserve momentum approximately)
                a.vel[0] *= scaleA;
                a.vel[1] *= scaleA;
                b.vel[0] *= scaleB;
                b.vel[1] *= scaleB;
              }
            }
          }
        }
      });
    }
    return particleIndexMap;
  }

  draw() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    ctx.clearRect(0, 0, w, h);
    // Background
    // Prefer canvas-computed background (works inside Shadow DOM), fallback to var or dark
    const bgFromCanvas = getComputedStyle(this.canvas).backgroundColor;
    ctx.fillStyle =
      (bgFromCanvas && bgFromCanvas !== "rgba(0, 0, 0, 0)" && bgFromCanvas) ||
      getComputedStyle(document.body).getPropertyValue("--panel") ||
      "#0c121d";
    ctx.fillRect(0, 0, w, h);

    // Bottom heat source visual indicator (stovetop - bottom 10% with hotspots)
    if (this.heatingOn) {
      const gradientHeight = this.height * 0.1; // bottom 10% of container
      const hotspotCount = 3;
      const hotspotSpacing = w / (hotspotCount + 1);
      const hotspotStrengths = [1.0, 0.85, 0.7];

      // Draw hotspot pattern
      for (let hotspotIdx = 0; hotspotIdx < hotspotCount; hotspotIdx++) {
        const hotspotX = hotspotSpacing * (hotspotIdx + 1);
        const hotspotRadius = w * 0.15;
        const hotspotStrength = hotspotStrengths[hotspotIdx];

        // Create radial gradient for each hotspot
        const hotspotGradient = ctx.createRadialGradient(
          hotspotX,
          h,
          0, // center
          hotspotX,
          h,
          hotspotRadius // outer radius
        );

        // Base intensity scaled by hotspot strength
        const maxIntensity = 0.5 * hotspotStrength;
        hotspotGradient.addColorStop(0, `rgba(255, 100, 0, ${maxIntensity})`);
        hotspotGradient.addColorStop(
          0.5,
          `rgba(255, 100, 0, ${maxIntensity * 0.6})`
        );
        hotspotGradient.addColorStop(1, "rgba(255, 100, 0, 0)");

        // Draw vertical gradient overlay for each hotspot
        const verticalGradient = ctx.createLinearGradient(
          0,
          h - gradientHeight,
          0,
          h
        );
        verticalGradient.addColorStop(0, "rgba(255, 100, 0, 0)");
        verticalGradient.addColorStop(
          0.5,
          `rgba(255, 100, 0, ${maxIntensity * 0.3})`
        );
        verticalGradient.addColorStop(1, `rgba(255, 100, 0, ${maxIntensity})`);

        // Draw hotspot area
        ctx.fillStyle = hotspotGradient;
        ctx.beginPath();
        ctx.arc(hotspotX, h, hotspotRadius, 0, Math.PI * 2);
        ctx.fill();

        // Draw vertical gradient overlay
        ctx.fillStyle = verticalGradient;
        ctx.fillRect(
          hotspotX - hotspotRadius,
          h - gradientHeight,
          hotspotRadius * 2,
          gradientHeight
        );
      }

      // Add subtle base heating across entire bottom
      const baseGradient = ctx.createLinearGradient(
        0,
        h - gradientHeight,
        0,
        h
      );
      baseGradient.addColorStop(0, "rgba(255, 100, 0, 0)");
      baseGradient.addColorStop(0.7, "rgba(255, 100, 0, 0.1)");
      baseGradient.addColorStop(1, "rgba(255, 100, 0, 0.2)");
      ctx.fillStyle = baseGradient;
      ctx.fillRect(0, h - gradientHeight, w, gradientHeight);
    }

    // Particles (solid spheres) with temperature-based coloring
    const base = this.params.color || "#5ac8fa";
    // Warm colors for gas particles and heated particles (red/orange)
    const warmColor = "#ff6b35";
    // Cool colors for liquid particles (use base color)
    const coolColor = base;

    // Helper function to interpolate between two hex colors
    function lerpColor(color1, color2, t) {
      const c1 = parseInt(color1.slice(1), 16);
      const c2 = parseInt(color2.slice(1), 16);
      const r1 = (c1 >> 16) & 255;
      const g1 = (c1 >> 8) & 255;
      const b1 = c1 & 255;
      const r2 = (c2 >> 16) & 255;
      const g2 = (c2 >> 8) & 255;
      const b2 = c2 & 255;
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      return `rgb(${r}, ${g}, ${b})`;
    }

    // Draw particles - after 30s, only show escaped particles
    if (this.moleculesVisible) {
      ctx.strokeStyle = "rgba(0,0,0,0.2)";
      ctx.lineWidth = 1;

      const particlesToDraw = this.trialEnded
        ? this.escapedParticles.filter(
            (ep) => ep.scenario === this.currentScenario
          )
        : this.particles;

      for (let i = 0; i < particlesToDraw.length; i++) {
        const p = particlesToDraw[i];
        const r = p.radius || 4.5;
        const thermalEnergy = p.thermalEnergy || 0;
        const pos = p.pos; // Both regular and escaped particles have pos array

        // Color based on particle state and thermal energy
        if (p.state === "gas") {
          ctx.fillStyle = warmColor;
        } else {
          // Interpolate between cool and warm based on thermal energy
          // Liquid particles become orange as they heat up
          const colorT = Math.min(1.0, thermalEnergy * 1.5); // Scale thermal energy for color
          ctx.fillStyle = lerpColor(coolColor, warmColor, colorT);
        }

        ctx.beginPath();
        ctx.arc(pos[0], pos[1], r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Show splash text and restart button after trial ends
      if (this.trialEnded) {
        const totalParticles = this.params.N || 200;
        const escapePercentage = (
          (this.escapedCount / totalParticles) *
          100
        ).toFixed(1);

        // Semi-transparent overlay
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = "#111827";
        ctx.font = "bold 20px system-ui, -apple-system, Segoe UI, Roboto";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const splashText1 = "Trial Complete (30s)";
        const splashText2 = `${this.escapedCount} of ${totalParticles} particles escaped`;
        const splashText3 = `${escapePercentage}% became gaseous`;
        const splashText4 = "Simulation stopped";

        ctx.fillText(splashText1, w / 2, h / 2 - 60);
        ctx.font = "16px system-ui, -apple-system, Segoe UI, Roboto";
        ctx.fillText(splashText2, w / 2, h / 2 - 30);
        ctx.fillText(splashText3, w / 2, h / 2 - 10);
        ctx.font = "14px system-ui, -apple-system, Segoe UI, Roboto";
        ctx.fillStyle = "#6b7280";
        ctx.fillText(splashText4, w / 2, h / 2 + 15);

        // Draw restart button
        const btnX = w / 2 - 60;
        const btnY = h / 2 + 40;
        const btnW = 120;
        const btnH = 35;

        ctx.fillStyle = "#dc2626";
        ctx.fillRect(btnX, btnY, btnW, btnH);
        ctx.strokeStyle = "#b91c1c";
        ctx.lineWidth = 2;
        ctx.strokeRect(btnX, btnY, btnW, btnH);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 14px system-ui, -apple-system, Segoe UI, Roboto";
        ctx.fillText("Go to Next Trial", w / 2, btnY + btnH / 2 + 4);

        // Store button bounds for click detection
        this.restartButtonBounds = { x: btnX, y: btnY, w: btnW, h: btnH };

        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      } else {
        this.restartButtonBounds = null;
      }
    }

    // Optional liquid contour overlay
    if (this.contourOn) {
      this.drawContourOverlay(ctx, base);
    }

    // Overlay (choose legible text color against current background)
    try {
      const m = (bgFromCanvas || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      let textColor = "#0e1116";
      if (m) {
        const r = Math.min(255, Math.max(0, parseInt(m[1], 10)));
        const g = Math.min(255, Math.max(0, parseInt(m[2], 10)));
        const b = Math.min(255, Math.max(0, parseInt(m[3], 10)));
        const sr = r / 255;
        const sg = g / 255;
        const sb = b / 255;
        const lin = (c) =>
          c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        const L = 0.2126 * lin(sr) + 0.7152 * lin(sg) + 0.0722 * lin(sb);
        textColor = L > 0.6 ? "#0e1116" : "#e9eef5";
      }
      ctx.fillStyle = textColor;
    } catch (_) {
      ctx.fillStyle = "#0e1116";
    }
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillText(this.params.label, 10, 18);
    // Right-side overlay: KE only
    try {
      let keSum = 0;
      const n = Math.max(1, this.particles.length);
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        keSum +=
          0.5 * (p.mass || 1) * (p.vel[0] * p.vel[0] + p.vel[1] * p.vel[1]);
      }
      const keAvg = keSum / n;
      const label = `KE ${keAvg.toFixed(1)}`;
      const tw = ctx.measureText(label).width;
      ctx.fillText(label, w - 10 - tw, 18);
    } catch (_) {}
  }

  drawContourOverlay(ctx, baseColor) {
    const cellSize = 12; // Smaller cells for better resolution
    const w = this.width;
    const h = this.height;
    const nx = Math.max(2, Math.ceil(w / cellSize));
    const ny = Math.max(2, Math.ceil(h / cellSize));
    const grid = new Float32Array(nx * ny);

    // Build density grid with larger sigma to ensure all particles are engulfed
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const r = p.radius || 4.5;
      const sigma = r * 2.2; // Increased from 1.6 to ensure particles are fully covered
      const sigma2 = sigma * sigma;
      const minX = Math.max(0, Math.floor((p.pos[0] - 4 * sigma) / cellSize));
      const maxX = Math.min(
        nx - 1,
        Math.floor((p.pos[0] + 4 * sigma) / cellSize)
      );
      const minY = Math.max(0, Math.floor((p.pos[1] - 4 * sigma) / cellSize));
      const maxY = Math.min(
        ny - 1,
        Math.floor((p.pos[1] + 4 * sigma) / cellSize)
      );
      for (let gy = minY; gy <= maxY; gy++) {
        const cy = (gy + 0.5) * cellSize; // Use cell center
        for (let gx = minX; gx <= maxX; gx++) {
          const cx = (gx + 0.5) * cellSize; // Use cell center
          const dx = cx - p.pos[0];
          const dy = cy - p.pos[1];
          const d2 = dx * dx + dy * dy;
          const val = Math.exp(-d2 / (2 * sigma2));
          grid[gy * nx + gx] += val;
        }
      }
    }

    // Threshold: lower threshold to ensure all particles are included
    let maxVal = 0;
    for (let k = 0; k < grid.length; k++)
      if (grid[k] > maxVal) maxVal = grid[k];
    if (maxVal <= 0.0001) return;
    const threshold = maxVal * 0.15; // Lowered from 0.35 to include more area

    // Marching squares - collect closed loops
    const segments = [];
    function interp(ax, ay, av, bx, by, bv) {
      const t = (threshold - av) / (bv - av || 1e-6);
      return [ax + (bx - ax) * t, ay + (by - ay) * t];
    }
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const x = i * cellSize;
        const y = j * cellSize;
        const v0 = grid[j * nx + i];
        const v1 = grid[j * nx + i + 1];
        const v2 = grid[(j + 1) * nx + i + 1];
        const v3 = grid[(j + 1) * nx + i];
        let idx = 0;
        if (v0 > threshold) idx |= 1;
        if (v1 > threshold) idx |= 2;
        if (v2 > threshold) idx |= 4;
        if (v3 > threshold) idx |= 8;
        if (idx === 0 || idx === 15) continue;
        const e = [];
        switch (idx) {
          case 1:
          case 14:
            e.push(interp(x, y, v0, x + cellSize, y, v1));
            e.push(interp(x, y, v0, x, y + cellSize, v3));
            break;
          case 2:
          case 13:
            e.push(interp(x + cellSize, y, v1, x + cellSize, y + cellSize, v2));
            e.push(interp(x, y, v0, x + cellSize, y, v1));
            break;
          case 3:
          case 12:
            e.push(interp(x + cellSize, y, v1, x + cellSize, y + cellSize, v2));
            e.push(interp(x, y, v0, x, y + cellSize, v3));
            break;
          case 4:
          case 11:
            e.push(interp(x + cellSize, y, v1, x + cellSize, y + cellSize, v2));
            e.push(interp(x, y + cellSize, v3, x + cellSize, y + cellSize, v2));
            break;
          case 5:
            e.push(interp(x, y, v0, x, y + cellSize, v3));
            e.push(interp(x + cellSize, y, v1, x + cellSize, y + cellSize, v2));
            break;
          case 6:
          case 9:
            e.push(interp(x, y, v0, x + cellSize, y, v1));
            e.push(interp(x, y + cellSize, v3, x + cellSize, y + cellSize, v2));
            break;
          case 7:
          case 8:
            e.push(interp(x, y + cellSize, v3, x + cellSize, y + cellSize, v2));
            e.push(interp(x, y, v0, x, y + cellSize, v3));
            break;
          case 10:
            e.push(interp(x, y, v0, x + cellSize, y, v1));
            e.push(interp(x, y + cellSize, v3, x + cellSize, y + cellSize, v2));
            break;
        }
        if (e.length === 2) segments.push(e);
      }
    }

    // Connect segments into closed paths
    const paths = [];
    const used = new Array(segments.length).fill(false);
    const tolerance = cellSize * 0.5; // More lenient connection tolerance

    function key(pt) {
      return (
        Math.floor(pt[0] / tolerance) + "," + Math.floor(pt[1] / tolerance)
      );
    }

    function findNearestPoint(pt, otherPt, threshold) {
      const dx = pt[0] - otherPt[0];
      const dy = pt[1] - otherPt[1];
      return dx * dx + dy * dy < threshold * threshold;
    }

    const endpointMap = new Map();
    for (let si = 0; si < segments.length; si++) {
      const [a, b] = segments[si];
      const ka = key(a),
        kb = key(b);
      (endpointMap.get(ka) || endpointMap.set(ka, []).get(ka)).push(si);
      (endpointMap.get(kb) || endpointMap.set(kb, []).get(kb)).push(si);
    }

    for (let i = 0; i < segments.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      let [a, b] = segments[i];
      const path = [a, b];
      let start = a;
      let end = b;

      // Grow forward from end
      while (true) {
        const k = key(end);
        const list = endpointMap.get(k) || [];
        let found = false;
        for (const si of list) {
          if (used[si]) continue;
          const [p, q] = segments[si];
          if (findNearestPoint(end, q, tolerance)) {
            path.push(p);
            end = p;
            used[si] = true;
            found = true;
            break;
          } else if (findNearestPoint(end, p, tolerance)) {
            path.push(q);
            end = q;
            used[si] = true;
            found = true;
            break;
          }
        }
        if (!found) break;
      }

      // Grow backward from start
      while (true) {
        const k = key(start);
        const list = endpointMap.get(k) || [];
        let found = false;
        for (const si of list) {
          if (used[si]) continue;
          const [p, q] = segments[si];
          if (findNearestPoint(start, p, tolerance)) {
            path.unshift(q);
            start = q;
            used[si] = true;
            found = true;
            break;
          } else if (findNearestPoint(start, q, tolerance)) {
            path.unshift(p);
            start = p;
            used[si] = true;
            found = true;
            break;
          }
        }
        if (!found) break;
      }

      // Only add paths that are closed or have enough points
      if (path.length >= 3) {
        // Check if path is closed (start and end are close)
        const isClosed = findNearestPoint(start, end, tolerance);
        if (isClosed) {
          path.push(path[0]); // Ensure it's explicitly closed
        }
        paths.push(path);
      }
    }

    // Detect open contours closed by walls and apply appropriate shading
    const bottomThreshold = h - cellSize * 5; // More generous threshold for ground proximity
    const leftThreshold = cellSize * 5; // More generous threshold for left wall proximity
    const rightThreshold = w - cellSize * 5; // More generous threshold for right wall proximity
    const containerBottom = h; // Bottom of container
    const containerLeft = 0; // Left wall
    const containerRight = w; // Right wall

    // Classify paths: closed vs open, and check if near walls (prefer walls even if closed)
    const pathInfo = paths.map((path) => {
      if (path.length < 3)
        return {
          path,
          isClosed: false,
          nearGround: false,
          nearLeftWall: false,
          nearRightWall: false,
        };

      const firstPt = path[0];
      const lastPt = path[path.length - 1];
      const isClosed = findNearestPoint(firstPt, lastPt, tolerance);

      // Check individual points for wall proximity (more accurate than bounds)
      let nearGround = false;
      let nearLeftWall = false;
      let nearRightWall = false;

      for (let i = 0; i < path.length; i++) {
        const pt = path[i];
        if (pt[1] >= bottomThreshold) nearGround = true;
        if (pt[0] <= leftThreshold) nearLeftWall = true;
        if (pt[0] >= rightThreshold) nearRightWall = true;
      }

      // Find boundary points for ground
      let leftmostX = null;
      let rightmostX = null;
      let leftmostPt = null;
      let rightmostPt = null;
      let leftmostIdx = -1;
      let rightmostIdx = -1;
      if (nearGround) {
        for (let i = 0; i < path.length; i++) {
          const pt = path[i];
          if (pt[1] >= bottomThreshold) {
            if (leftmostX === null || pt[0] < leftmostX) {
              leftmostX = pt[0];
              leftmostPt = pt;
              leftmostIdx = i;
            }
            if (rightmostX === null || pt[0] > rightmostX) {
              rightmostX = pt[0];
              rightmostPt = pt;
              rightmostIdx = i;
            }
          }
        }
      }

      // Find boundary points for left wall
      let topmostY = null;
      let bottommostY = null;
      let topmostPt = null;
      let bottommostPt = null;
      let topmostIdx = -1;
      let bottommostIdx = -1;
      if (nearLeftWall) {
        for (let i = 0; i < path.length; i++) {
          const pt = path[i];
          if (pt[0] <= leftThreshold) {
            if (topmostY === null || pt[1] < topmostY) {
              topmostY = pt[1];
              topmostPt = pt;
              topmostIdx = i;
            }
            if (bottommostY === null || pt[1] > bottommostY) {
              bottommostY = pt[1];
              bottommostPt = pt;
              bottommostIdx = i;
            }
          }
        }
      }

      // Find boundary points for right wall
      let rightTopmostY = null;
      let rightBottommostY = null;
      let rightTopmostPt = null;
      let rightBottommostPt = null;
      let rightTopmostIdx = -1;
      let rightBottommostIdx = -1;
      if (nearRightWall) {
        for (let i = 0; i < path.length; i++) {
          const pt = path[i];
          if (pt[0] >= rightThreshold) {
            if (rightTopmostY === null || pt[1] < rightTopmostY) {
              rightTopmostY = pt[1];
              rightTopmostPt = pt;
              rightTopmostIdx = i;
            }
            if (rightBottommostY === null || pt[1] > rightBottommostY) {
              rightBottommostY = pt[1];
              rightBottommostPt = pt;
              rightBottommostIdx = i;
            }
          }
        }
      }

      return {
        path,
        isClosed,
        nearGround,
        nearLeftWall,
        nearRightWall,
        leftmostX,
        rightmostX,
        leftmostPt,
        rightmostPt,
        leftmostIdx,
        rightmostIdx,
        topmostY,
        bottommostY,
        topmostPt,
        bottommostPt,
        topmostIdx,
        bottommostIdx,
        rightTopmostY,
        rightBottommostY,
        rightTopmostPt,
        rightBottommostPt,
        rightTopmostIdx,
        rightBottommostIdx,
      };
    });

    // Draw with wall-closed shading for open contours
    ctx.save();
    ctx.strokeStyle = baseColor;
    ctx.lineWidth = 2;
    const fillColor = baseColor + "66";

    for (const info of pathInfo) {
      const {
        path,
        isClosed,
        nearGround,
        nearLeftWall,
        nearRightWall,
        leftmostX,
        rightmostX,
        leftmostPt,
        rightmostPt,
        leftmostIdx,
        rightmostIdx,
        topmostY,
        bottommostY,
        topmostPt,
        bottommostPt,
        topmostIdx,
        bottommostIdx,
        rightTopmostY,
        rightBottommostY,
        rightTopmostPt,
        rightBottommostPt,
        rightTopmostIdx,
        rightBottommostIdx,
      } = info;
      if (path.length < 3) continue;

      ctx.beginPath();
      ctx.moveTo(path[0][0], path[0][1]);
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i][0], path[i][1]);
      }

      // Prefer wall closing over upward closing - use walls if any are detected
      if (nearGround || nearLeftWall || nearRightWall) {
        const firstPt = path[0];
        const lastPt = path[path.length - 1];

        // Build closing path based on which walls are touched
        // Handle combinations: bottom, left, right, left+bottom, right+bottom, left+right+bottom

        if (nearGround && nearLeftWall && nearRightWall) {
          // All three walls: bottom + left + right
          // Connect from last point down to ground, then along ground,
          // then up left wall, then horizontally to right wall top, then down right wall, then back to first
          if (leftmostIdx < rightmostIdx) {
            ctx.lineTo(rightmostX, containerBottom);
            ctx.lineTo(leftmostX, containerBottom);
          } else {
            ctx.lineTo(leftmostX, containerBottom);
            ctx.lineTo(rightmostX, containerBottom);
          }
          // Connect up left wall
          if (bottommostPt && topmostPt) {
            ctx.lineTo(containerLeft, bottommostY);
            ctx.lineTo(containerLeft, topmostY);
          }
          // Connect horizontally to right wall top
          // Use the higher of the two top Y values to ensure proper connection
          const leftTopY = topmostY !== null ? topmostY : bottommostY;
          const rightTopY =
            rightTopmostY !== null ? rightTopmostY : rightBottommostY;
          const connectingTopY = Math.min(leftTopY, rightTopY);
          ctx.lineTo(containerRight, connectingTopY);
          // Connect down right wall (from top to bottom)
          if (
            rightTopmostPt &&
            rightBottommostPt &&
            rightTopmostY !== null &&
            rightBottommostY !== null
          ) {
            // Already at top, so go down
            ctx.lineTo(containerRight, rightBottommostY);
          }
          // Connect back to first point
          ctx.lineTo(firstPt[0], firstPt[1]);
        } else if (nearGround && nearLeftWall) {
          // Bottom + left wall
          if (leftmostIdx < rightmostIdx) {
            ctx.lineTo(rightmostX, containerBottom);
            ctx.lineTo(leftmostX, containerBottom);
          } else {
            ctx.lineTo(leftmostX, containerBottom);
            ctx.lineTo(rightmostX, containerBottom);
          }
          // Connect up left wall
          if (bottommostPt && topmostPt) {
            ctx.lineTo(containerLeft, bottommostY);
            ctx.lineTo(containerLeft, topmostY);
          }
          ctx.lineTo(firstPt[0], firstPt[1]);
        } else if (nearGround && nearRightWall) {
          // Bottom + right wall
          if (leftmostIdx < rightmostIdx) {
            ctx.lineTo(rightmostX, containerBottom);
            ctx.lineTo(leftmostX, containerBottom);
          } else {
            ctx.lineTo(leftmostX, containerBottom);
            ctx.lineTo(rightmostX, containerBottom);
          }
          // Connect up right wall
          if (rightBottommostPt && rightTopmostPt) {
            ctx.lineTo(containerRight, rightBottommostY);
            ctx.lineTo(containerRight, rightTopmostY);
          }
          ctx.lineTo(firstPt[0], firstPt[1]);
        } else if (nearGround) {
          // Bottom only
          if (leftmostIdx < rightmostIdx) {
            ctx.lineTo(rightmostX, containerBottom);
            ctx.lineTo(leftmostX, containerBottom);
          } else {
            ctx.lineTo(leftmostX, containerBottom);
            ctx.lineTo(rightmostX, containerBottom);
          }
          ctx.lineTo(firstPt[0], firstPt[1]);
        } else if (nearLeftWall) {
          // Left wall only
          if (bottommostPt && topmostPt) {
            if (topmostIdx < bottommostIdx) {
              ctx.lineTo(containerLeft, bottommostY);
              ctx.lineTo(containerLeft, topmostY);
            } else {
              ctx.lineTo(containerLeft, topmostY);
              ctx.lineTo(containerLeft, bottommostY);
            }
          }
          ctx.lineTo(firstPt[0], firstPt[1]);
        } else if (nearRightWall) {
          // Right wall only
          if (rightTopmostPt && rightBottommostPt) {
            if (rightTopmostIdx < rightBottommostIdx) {
              ctx.lineTo(containerRight, rightBottommostY);
              ctx.lineTo(containerRight, rightTopmostY);
            } else {
              ctx.lineTo(containerRight, rightTopmostY);
              ctx.lineTo(containerRight, rightBottommostY);
            }
          }
          ctx.lineTo(firstPt[0], firstPt[1]);
        }

        ctx.closePath();
      } else {
        // Explicitly close the path before filling (for closed contours)
        ctx.closePath();
      }

      if (this.shadeContour) {
        try {
          ctx.fillStyle = fillColor;
          ctx.fill(); // Fill inside the path (walls act as closing edges for open contours)
        } catch (_) {}
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  loop = (now) => {
    if (!this.running) return;

    // Check if trial should end at 30s
    if (this.heatingOn && !this.trialEnded) {
      const t = (performance.now() - this.gasStart) / 1000;
      if (t >= 30) {
        this.trialEnded = true;
        this.stop(); // Stop simulation at 30s
      }
    }

    const dt = clamp((now - this.lastMs) / 1000, 0, 0.033);
    this.lastMs = now;

    // Only step simulation if trial hasn't ended
    if (!this.trialEnded) {
      this.step(dt);
    }

    this.draw();
    // Record gas/escape data for graph (only when heating is on and trial hasn't ended)
    try {
      if (this.gasCtx && this.gasCanvas && this.currentScenario) {
        if (this.heatingOn && !this.trialEnded) {
          const t = (performance.now() - this.gasStart) / 1000;
          // Only record up to 30s
          if (t <= 30) {
            this.gasHistory.push({
              t,
              gasCount: this.gasCount,
              escapedCount: this.escapedCount,
              scenario: this.currentScenario,
            });
            // Keep reasonable history (last 10000 points)
            if (this.gasHistory.length > 10000) this.gasHistory.shift();
          }
        }
        // Always draw graph to show historical data
        this.drawGasGraph();
      }
    } catch (_) {}
    this.frameId = requestAnimationFrame(this.loop);
  };

  start() {
    if (this.running) return;
    this.running = true;
    this.lastMs = performance.now();
    this.frameId = requestAnimationFrame(this.loop);
  }
  stop() {
    this.running = false;
    if (this.frameId) cancelAnimationFrame(this.frameId);
    this.frameId = 0;
  }

  getParticleDebugData(particle) {
    if (!particle) return null;

    const v2 =
      particle.vel[0] * particle.vel[0] + particle.vel[1] * particle.vel[1];
    const ke = 0.5 * (particle.mass || 1) * v2;
    const speed = Math.sqrt(v2); // Use sqrt instead of Math.hypot
    const thermalEnergy = particle.thermalEnergy || 0;

    // Calculate forces from nearby particles
    let totalLJForce = 0;
    let totalHBForce = 0;
    let totalDipoleForce = 0;
    let nearestNeighborDistSq = Infinity;
    let nearestNeighbor = null;
    const rMax = 28;
    const ax = particle.pos[0];
    const ay = particle.pos[1];

    this.grid.forNeighbors(ax, ay, rMax, (b) => {
      if (particle === b) return;
      const dx = b.pos[0] - ax;
      const dy = b.pos[1] - ay;
      const rVec = [dx, dy];
      const distSq = dx * dx + dy * dy; // Squared distance

      if (distSq < nearestNeighborDistSq) {
        nearestNeighborDistSq = distSq;
        nearestNeighbor = b;
      }

      const fLJ = this.ljForce(rVec);
      const fHB = this.hbForce(rVec);
      const fDP = this.dipoleForce(rVec);

      // Use squared magnitudes for comparison, sqrt only when needed
      totalLJForce += Math.sqrt(fLJ[0] * fLJ[0] + fLJ[1] * fLJ[1]);
      totalHBForce += Math.sqrt(fHB[0] * fHB[0] + fHB[1] * fHB[1]);
      totalDipoleForce += Math.sqrt(fDP[0] * fDP[0] + fDP[1] * fDP[1]);
    });

    const nearestNeighborDist = Math.sqrt(nearestNeighborDistSq);

    // Check if in heating zone
    const r = particle.radius || 4.5;
    const particleBottom = particle.pos[1] + r;
    const heatingZoneHeight = this.height * 0.05;
    const heatingZoneTop = this.height - heatingZoneHeight;
    const inHeatingZone = particleBottom >= heatingZoneTop;

    // Calculate distance from bottom
    const distFromBottom = this.height - particleBottom;

    // Cache particle index to avoid O(n) lookup
    const particleIndex = this.particles.indexOf(particle);

    return {
      index: particleIndex,
      position: {
        x: particle.pos[0].toFixed(2),
        y: particle.pos[1].toFixed(2),
      },
      velocity: {
        x: particle.vel[0].toFixed(2),
        y: particle.vel[1].toFixed(2),
        speed: speed.toFixed(2),
      },
      kineticEnergy: ke.toFixed(2),
      thermalEnergy: thermalEnergy.toFixed(3),
      state: particle.state,
      mass: particle.mass || 1,
      radius: r,
      localNeighbors: particle.localNeighbors || 0,
      forces: {
        lj: totalLJForce.toFixed(2),
        hb: totalHBForce.toFixed(2),
        dipole: totalDipoleForce.toFixed(2),
        total: (totalLJForce + totalHBForce + totalDipoleForce).toFixed(2),
      },
      nearestNeighbor: {
        distance: nearestNeighborDist.toFixed(2),
        state: nearestNeighbor?.state || "none",
      },
      heating: {
        inZone: inHeatingZone,
        distFromBottom: distFromBottom.toFixed(2),
        heatingZoneTop: heatingZoneTop.toFixed(2),
      },
      gasUntil: particle.gasUntil
        ? (particle.gasUntil - performance.now()).toFixed(0)
        : "N/A",
      lastStateChange: particle.lastStateChange
        ? (performance.now() - particle.lastStateChange).toFixed(0)
        : "N/A",
    };
  }

  destroy() {
    this.stop();
    document.removeEventListener("visibilitychange", this.onVisibility);
  }
}

// Extend IMFSim with Gas/Escape graph
IMFSim.prototype.setGasCanvas = function (canvas) {
  this.gasCanvas = canvas;
  this.gasCtx = canvas.getContext("2d");
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const cssW = canvas.clientWidth || 450;
  const cssH = canvas.clientHeight || 420;
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  this.gasDPR = dpr;

  this.drawGasGraph = () => {
    const ctx = this.gasCtx;
    if (!ctx) return;
    const w = this.gasCanvas.width;
    const h = this.gasCanvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Group history by scenario - only track escaped particles
    const scenarios = ["honey", "dmso", "hexane"];
    const scenarioData = {};
    scenarios.forEach((sc) => {
      scenarioData[sc] = {
        escaped: [],
      };
    });

    for (let i = 0; i < this.gasHistory.length; i++) {
      const point = this.gasHistory[i];
      if (scenarioData[point.scenario]) {
        scenarioData[point.scenario].escaped.push({
          t: point.t,
          value: point.escapedCount,
        });
      }
    }

    // Compute ranges - only use escaped count
    let tMax = 0;
    let maxEscaped = 0;

    scenarios.forEach((sc) => {
      const data = scenarioData[sc];
      data.escaped.forEach((p) => {
        if (p.t > tMax) tMax = p.t;
        if (p.value > maxEscaped) maxEscaped = p.value;
      });
    });

    // Add current values
    if (this.currentScenario) {
      const t = (performance.now() - this.gasStart) / 1000;
      if (t > tMax) tMax = t;
      if (this.escapedCount > maxEscaped) maxEscaped = this.escapedCount;
    }

    if (!isFinite(tMax) || tMax <= 0) tMax = 1;
    if (!isFinite(maxEscaped) || maxEscaped === 0) maxEscaped = 1;

    // Show all data (no panning window)
    const tMin = 0;
    const visibleTimeRange = tMax - tMin;

    // Padding
    const pL = 50,
      pR = 50,
      pT = 30,
      pB = 50;
    const plotW = Math.max(10, w - pL - pR);
    const plotH = Math.max(10, h - pT - pB);
    const xOf = pL,
      yOf = pT;

    // Background
    const bgFromCanvas = getComputedStyle(this.gasCanvas).backgroundColor;
    ctx.fillStyle =
      (bgFromCanvas && bgFromCanvas !== "rgba(0, 0, 0, 0)" && bgFromCanvas) ||
      getComputedStyle(document.body).getPropertyValue("--panel") ||
      "#ffffff";
    ctx.fillRect(0, 0, w, h);

    // Axes
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xOf, yOf + plotH);
    ctx.lineTo(xOf + plotW, yOf + plotH);
    ctx.moveTo(xOf, yOf);
    ctx.lineTo(xOf, yOf + plotH);
    ctx.stroke();

    // Labels
    ctx.fillStyle = "#6b7280";
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillText("time (s)", xOf + plotW - 60, yOf + plotH + 18);
    ctx.save();
    ctx.translate(12, yOf + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Count", 0, 0);
    ctx.restore();

    // Title
    ctx.fillStyle = "#111827";
    ctx.font = "14px system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillText("Escaped Particles (Gaseousness)", xOf + 10, yOf - 10);

    // X-axis ticks
    ctx.fillStyle = "#9ca3af";
    for (let i = 0; i <= 4; i++) {
      const t = tMin + (i / 4) * visibleTimeRange;
      const x = xOf + ((t - tMin) / visibleTimeRange) * plotW;
      ctx.beginPath();
      ctx.moveTo(x, yOf + plotH);
      ctx.lineTo(x, yOf + plotH + 4);
      ctx.strokeStyle = "#e5e7eb";
      ctx.stroke();
      const label = t.toFixed(0);
      const lw = ctx.measureText(label).width;
      ctx.fillText(label, x - lw / 2, yOf + plotH + 16);
    }

    // Y-axis ticks (escaped count only)
    const maxY = maxEscaped > 0 ? maxEscaped : 1;
    for (let i = 0; i <= 4; i++) {
      const v = (i / 4) * maxY;
      const y = yOf + plotH - (v / maxY) * plotH;
      ctx.beginPath();
      ctx.moveTo(xOf - 4, y);
      ctx.lineTo(xOf, y);
      ctx.strokeStyle = "#e5e7eb";
      ctx.stroke();
      const label = Math.round(v).toString();
      const lw = ctx.measureText(label).width;
      ctx.fillText(label, xOf - 6 - lw, y + 4);
    }

    // Scenario colors - only escaped particles
    const scenarioColors = {
      honey: "#3a9bc8",
      dmso: "#ccaa08",
      hexane: "#6a8acc",
    };

    // Draw escaped count lines (solid) - show all scenarios overlaid
    scenarios.forEach((sc) => {
      const data = scenarioData[sc].escaped;
      // Draw all scenarios that have data, not just the current one
      if (data.length === 0 && (this.currentScenario !== sc || !this.heatingOn))
        return;

      ctx.strokeStyle = scenarioColors[sc];
      ctx.lineWidth = 2;
      // Use solid lines for escaped particles
      ctx.beginPath();
      let firstPoint = true;
      for (let i = 0; i < data.length; i++) {
        const p = data[i];
        if (p.t >= tMin) {
          const x = xOf + ((p.t - tMin) / visibleTimeRange) * plotW;
          const y = yOf + plotH - (p.value / maxY) * plotH;
          if (firstPoint) {
            ctx.moveTo(x, y);
            firstPoint = false;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      // Add current point if this is the active scenario and heating is on
      if (this.currentScenario === sc && this.heatingOn) {
        const t = (performance.now() - this.gasStart) / 1000;
        if (t >= tMin) {
          const x = xOf + ((t - tMin) / visibleTimeRange) * plotW;
          const y = yOf + plotH - (this.escapedCount / maxY) * plotH;
          if (firstPoint) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      if (!firstPoint) ctx.stroke();
    });

    // Legend - only show escaped particles
    ctx.font = "11px system-ui, -apple-system, Segoe UI, Roboto";
    let legendY = yOf + 20;
    scenarios.forEach((sc) => {
      const label = sc.charAt(0).toUpperCase() + sc.slice(1);
      // Escaped line (solid)
      ctx.strokeStyle = scenarioColors[sc];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(xOf + plotW - 100, legendY);
      ctx.lineTo(xOf + plotW - 80, legendY);
      ctx.stroke();
      ctx.fillStyle = "#111827";
      ctx.fillText(`${label} Escaped`, xOf + plotW - 75, legendY + 4);

      legendY += 18;
    });
  };
};

// ---------------- Light DOM UI (Style-guide aligned) ----------------

function getCSSVar(name, fallback) {
  const cs = getComputedStyle(document.body);
  const v = cs.getPropertyValue(name);
  return v && v.trim().length ? v.trim() : fallback;
}

function scenarioColor(kind) {
  if (kind === "honey") return getCSSVar("--accent", "#5ac8fa");
  if (kind === "dmso") return getCSSVar("--yellow", "#ffd60a");
  return getCSSVar("--green", "#34c759"); // hexane
}

function applyIMFCoeffsFor(sim, kind) {
  const v = Math.max(0, Number(sim.params.viscosity || 0));
  if (kind === "honey") {
    // Hydrogen bonds: strongest IMF
    sim.params.hbStrength = 3.0 * v; // Increased to make H-bonds clearly strongest
    sim.params.dipole = 0.0;
    sim.params.cohLJ = 1.5 + 0.8 * v; // Moderate LJ contribution
    sim.params.cohHB = 3.0 + 1.5 * v; // Significantly increased to make H-bonds dominant (was 2.0 + 1.2*v)
    sim.params.cohDP = 1.0;
  } else if (kind === "dmso") {
    // Dipole-dipole: moderate strength, stronger than LDFs but weaker than H-bonds
    sim.params.hbStrength = 0.0;
    sim.params.dipole = 1.5 * v;
    sim.params.cohLJ = 0.8 + 0.5 * v; // Moderate LJ contribution
    sim.params.cohHB = 1.0;
    sim.params.cohDP = 1.2 + 0.8 * v; // Moderate dipole-dipole strength
  } else {
    // Hexane - extremely weak attractions (only very weak London dispersion)
    // LDFs should be weakest: reduce cohLJ significantly
    sim.params.hbStrength = 0.0;
    sim.params.dipole = 0.0;
    sim.params.cohLJ = 0.01 + 0.02 * v; // Much weaker: was 0.05 + 0.1*v, now ~0.01-0.02 range
    sim.params.cohHB = 0.0; // No hydrogen bonding
    sim.params.cohDP = 0.0; // No dipole-dipole
  }
}

export function mountIMFs(root) {
  // Build Shadow DOM host to isolate Harvard‑Westlake stylesheet
  const host = document.createElement("div");
  host.id = "imfs-host";
  root.innerHTML = "";
  root.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });

  // Load HW stylesheet inside shadow
  const IMFSCSS_HREF = "https://learnhw.web.app/assets/index-DGT0gdx8.css";
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = IMFSCSS_HREF;
  shadow.appendChild(link);

  // IMFs local shim styles for sizing and rounding
  const shim = document.createElement("style");
  shim.textContent = `
    .imfs-shell { padding: 12px 0; max-width: 100%; width: 100%; }
    .container.container--wide { max-width: 100%; width: 100%; padding-left: 4px; padding-right: 4px; }
    .imfs-wrap { display: grid; grid-template-columns: 200px 1fr; gap: 16px; }
    @media (max-width: 1100px) { .imfs-wrap { grid-template-columns: 1fr; } }
    .imfs-sim-container { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; width: 100%; }
    @media (max-width: 1400px) { .imfs-sim-container { grid-template-columns: 1fr; } }
    .imfs-sim { width: 100% !important; max-width: 100% !important; height: 420px; display: block; border-radius: 12px; background: #ffffff; overflow: hidden; box-sizing: border-box; }
    .imfs-gas { width: 100% !important; max-width: 100% !important; height: 420px; background: #ffffff; border: 1px solid #d1d5db; border-radius: 12px; display: block; box-sizing: border-box; }
    .imfs-3d { width: 100%; height: 280px; min-height: 200px; border-radius: 12px; background: #ffffff; overflow: hidden; position: relative; }
    /* removed thermostat box */
    /* Ensure molecule strokes and labels are visible on light background */
    #imfs-mol line { stroke: #0e1116; stroke-width: 3px; }
    #imfs-mol text { fill: #0e1116; }
    /* Scenario buttons with yellow hover + glow */
    .scenario { background: #ffffff; color: #111827; border: 1px solid #d1d5db; }
    .scenario:hover { border-color: #ffd60a; background: #fff7cc; box-shadow: 0 0 0 2px #ffd60a inset, 0 0 12px rgba(255,214,10,0.55); }
    .scenario.is-active { border-color: #ffd60a; background: #fff7cc; box-shadow: 0 0 0 2px #ffd60a inset, 0 0 16px rgba(255,214,10,0.66); }
    /* Molecule/3D panels glow with scenario accent */
    .imfs-shell[data-kind] .imfs-mol { box-shadow: 0 0 0 2px var(--imfs-accent, #ffd60a) inset, 0 0 16px color-mix(in srgb, var(--imfs-accent, #ffd60a) 55%, transparent); }
    .imfs-shell[data-kind] .imfs-3d { box-shadow: none; }
    .imfs-shell[data-kind] .imfs-3d canvas { pointer-events: none; }
    /* High-contrast overrides inside Shadow DOM (HW red CTAs) */
    .imfs-shell .panel { background: #ffffff; color: #0e1116; border: 1px solid #d1d5db; }
    .imfs-shell .muted { color: #4b5563; }
    .imfs-shell .label { color: #111827; font-weight: 600; }
    .imfs-shell .btn { background: #dc2626; color: #ffffff; border: 1px solid #dc2626; }
    .imfs-shell .btn:hover { background: #b91c1c; border-color: #b91c1c; }
    .imfs-shell .btn.btn--outline { background: transparent; color: #b91c1c; border: 1px solid #dc2626; }
    .imfs-shell .btn.btn--outline:hover { background: #fee2e2; }
    .imfs-shell .btn.btn--ghost { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
    .imfs-shell .btn:focus-visible { outline: 3px solid #ef4444; outline-offset: 2px; }
    .imfs-shell .range { accent-color: #dc2626; }
    .stack-sm { display: grid; gap: 8px; }
    .row { display: grid; gap: 8px; }
    .row.controls { display: flex; flex-wrap: wrap; gap: 8px; }
    .row.controls[style*="justify-content"] { justify-content: center !important; }
    /* Debug panel styles */
    .debug-panel { 
      position: fixed; 
      top: 20px; 
      right: 20px; 
      width: 320px; 
      max-height: 80vh; 
      overflow-y: auto; 
      background: #ffffff; 
      border: 2px solid #dc2626; 
      border-radius: 8px; 
      padding: 12px; 
      font-family: 'IBM Plex Mono', monospace; 
      font-size: 11px; 
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      display: none;
    }
    .debug-panel.active { display: block; }
    .debug-panel h4 { 
      margin: 0 0 8px 0; 
      color: #dc2626; 
      font-size: 13px; 
      font-weight: 600; 
      cursor: move;
      user-select: none;
      padding: 4px;
      margin: -4px -4px 8px -4px;
      border-radius: 4px;
    }
    .debug-panel h4:hover {
      background: #fef2f2;
    }
    .debug-panel .debug-section { margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; }
    .debug-panel .debug-section:last-child { border-bottom: none; }
    .debug-panel .debug-row { display: flex; justify-content: space-between; margin: 4px 0; }
    .debug-panel .debug-label { color: #6b7280; font-weight: 600; }
    .debug-panel .debug-value { color: #111827; }
    .debug-panel .debug-note { color: #9ca3af; font-size: 10px; margin-top: 4px; font-style: italic; }
  `;
  shadow.appendChild(shim);

  // Build HW-styled markup while preserving element IDs for logic
  const shell = document.createElement("div");
  shell.className = "container container--wide imfs-shell";
  shell.innerHTML = `
    <section class="panel">
      <h2 class="h5 eyebrow">IMFs: Intermolecular Forces Playground</h2>
      <p class="muted">Explore hydrogen bonding, dipole–dipole, and dispersion using a particle-level sandbox with molecule close-ups for context.</p>
    </section>
    <section class="panel">
      <div class="imfs-wrap">
        <div class="panel">
          <h3 class="h5" style="margin-top:0;">Controls</h3>
          <div class="field" style="margin-bottom:12px;">
            <label class="label">Material</label>
            <select id="s-material" class="select" style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:4px; background:#ffffff; color:#111827; font-size:14px;">
              <option value="honey">Honey (H-bond)</option>
              <option value="dmso">DMSO (dipole)</option>
              <option value="hexane">Hexane (dispersion)</option>
            </select>
          </div>
          <div class="row controls" style="margin-bottom:8px;">
            <button id="t-gravity" class="btn btn--outline">Gravity</button>
            <button id="t-contour" class="btn btn--outline">Contour</button>
            <button id="t-shade" class="btn btn--outline">Shade Contour</button>
            <button id="t-molecules" class="btn btn--outline">Molecules</button>
            <button id="t-heat" class="btn btn--outline">Heat</button>
          </div>
          <div class="stack-sm">
            <div class="field"><label class="label">Particles (N)</label><input id="s-n" class="range" type="range" min="40" max="300" step="10" value="300"><span class="muted" id="v-n"></span></div>
            <div class="field"><label class="label">Heat Intensity</label><input id="s-heat" class="range" type="range" min="0" max="3" step="0.1" value="3.0"><span class="muted" id="v-heat"></span></div>
          </div>
          <div class="row controls" style="margin-top:8px;">
            <button id="b-play" class="btn">Play</button>
            <button id="b-pause" class="btn btn--outline">Pause</button>
            <button id="b-reset" class="btn btn--ghost">Reset</button>
          </div>
          <div class="muted" style="margin-top:10px;" id="explain"></div>
        </div>
        <div class="stack-sm">
          <div class="imfs-sim-container">
            <canvas id="imfs-sim" class="imfs-sim" width="450" height="420" aria-label="Intermolecular forces simulation" role="img"></canvas>
            <canvas id="imfs-gas" class="imfs-gas" width="450" height="420" aria-label="Gas and escaped particles chart" role="img"></canvas>
          </div>
          <div id="imfs-3d" class="imfs-3d" aria-label="3D molecule" role="img"></div>
        </div>
      </div>
    </section>
    <div id="debug-panel" class="debug-panel">
      <h4>🔍 Particle Debug Info</h4>
      <div id="debug-content"></div>
    </div>
  `;
  shadow.appendChild(shell);

  const refs = {
    sim: shadow.querySelector("#imfs-sim"),
    gas: shadow.querySelector("#imfs-gas"),
    mol: shadow.querySelector("#imfs-mol"),
    mol3d: shadow.querySelector("#imfs-3d"),
    sMaterial: shadow.querySelector("#s-material"),
    sN: shadow.querySelector("#s-n"),
    sHeat: shadow.querySelector("#s-heat"),
    vN: shadow.querySelector("#v-n"),
    vHeat: shadow.querySelector("#v-heat"),
    explain: shadow.querySelector("#explain"),
    tGravity: shadow.querySelector("#t-gravity"),
    tContour: shadow.querySelector("#t-contour"),
    tShade: shadow.querySelector("#t-shade"),
    tMolecules: shadow.querySelector("#t-molecules"),
    tHeat: shadow.querySelector("#t-heat"),
    debugPanel: shadow.querySelector("#debug-panel"),
    debugContent: shadow.querySelector("#debug-content"),
    // no thermostat box; KE is graphed below
  };

  const sim = new IMFSim(refs.sim);
  // 3Dmol viewer setup
  let viewer = null;
  let themeObserver = null;
  async function ensureViewer() {
    if (viewer || !refs.mol3d) return viewer;
    if (!window.$3Dmol) return null;
    const bg = getComputedStyle(refs.mol3d).backgroundColor || "#ffffff";
    viewer = $3Dmol.createViewer(refs.mol3d, { backgroundColor: bg.trim() });
    // Disable zoom interactions after viewer is created
    if (refs.mol3d) {
      // Prevent wheel zoom
      const preventZoom = (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      };
      refs.mol3d.addEventListener("wheel", preventZoom, { passive: false });
      refs.mol3d.addEventListener("touchstart", preventZoom, { passive: false });
      refs.mol3d.addEventListener("touchmove", preventZoom, { passive: false });
      // Disable mouse interactions that could cause zoom/rotation
      refs.mol3d.addEventListener("mousedown", preventZoom, { passive: false });
      // Find canvas inside viewer and disable pointer events
      setTimeout(() => {
        const canvas = refs.mol3d.querySelector("canvas");
        if (canvas) {
          canvas.style.pointerEvents = "none";
        }
      }, 100);
    }
    themeObserver = new MutationObserver(() => {
      const newBg = getComputedStyle(refs.mol3d).backgroundColor || "#ffffff";
      try {
        viewer.setBackgroundColor(newBg.trim());
        viewer.render();
      } catch (_) {}
    });
    themeObserver.observe(refs.mol3d, { attributes: true });
    return viewer;
  }
  async function fetchSDFByCID(cid) {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`;
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) throw new Error(String(res.status));
      const text = await res.text();
      if (!text || text.length < 10) throw new Error("Empty SDF");
      return text;
    } catch (_) {
      return null;
    }
  }
  const SDF_FALLBACK = {
    679: `
  DMSO
  3Dmol

  8  7  0  0  0  0            999 V2000
    0.0000   0.0000   0.0000 S   0  0  0  0  0  0
    1.4300   0.0000   0.0000 O   0  0  0  0  0  0
   -0.5400   1.2000   0.8000 C   0  0  0  0  0  0
   -0.5400  -1.2000  -0.8000 C   0  0  0  0  0  0
   -1.5400   1.9000   0.4000 H   0  0  0  0  0  0
    0.1600   1.8000   1.6000 H   0  0  0  0  0  0
   -0.0400   1.4000  -0.1000 H   0  0  0  0  0  0
   -1.5400  -1.9000  -0.4000 H   0  0  0  0  0  0
  1  2  2  0  0  0  0
  1  3  1  0  0  0  0
  1  4  1  0  0  0  0
  3  5  1  0  0  0  0
  3  6  1  0  0  0  0
  3  7  1  0  0  0  0
  4  8  1  0  0  0  0
M  END
`,
    8058: `
  HEXANE
  3Dmol

  20 19  0  0  0  0            999 V2000
   -2.0000   0.0000   0.0000 C   0  0  0  0  0  0
   -1.0000   0.8000   0.8000 C   0  0  0  0  0  0
    0.0000   0.0000   0.0000 C   0  0  0  0  0  0
    1.0000   0.8000   0.8000 C   0  0  0  0  0  0
    2.0000   0.0000   0.0000 C   0  0  0  0  0  0
    3.0000   0.8000   0.8000 C   0  0  0  0  0  0
   -2.6000  -0.9000   0.4000 H   0  0  0  0  0  0
   -2.6000   0.9000  -0.4000 H   0  0  0  0  0  0
   -1.4000   1.7000   0.2000 H   0  0  0  0  0  0
   -1.4000   0.3000   1.7000 H   0  0  0  0  0  0
    0.4000   0.9000  -0.8000 H   0  0  0  0  0  0
   -0.4000  -0.9000  -0.8000 H   0  0  0  0  0  0
    0.6000   1.7000   1.6000 H   0  0  0  0  0  0
    1.4000   0.3000   1.7000 H   0  0  0  0  0  0
    2.4000   0.9000  -0.8000 H   0  0  0  0  0  0
    1.6000  -0.9000  -0.8000 H   0  0  0  0  0  0
    3.6000   1.7000   0.2000 H   0  0  0  0  0  0
    3.6000   0.3000   1.7000 H   0  0  0  0  0  0
    3.4000   0.0000   0.0000 H   0  0  0  0  0  0
    2.6000  -0.9000  -0.8000 H   0  0  0  0  0  0
  1  2  1  0  0  0  0
  2  3  1  0  0  0  0
  3  4  1  0  0  0  0
  4  5  1  0  0  0  0
  5  6  1  0  0  0  0
  1  7  1  0  0  0  0
  1  8  1  0  0  0  0
  2  9  1  0  0  0  0
  2 10  1  0  0  0  0
  3 11  1  0  0  0  0
  3 12  1  0  0  0  0
  4 13  1  0  0  0  0
  4 14  1  0  0  0  0
  5 15  1  0  0  0  0
  5 16  1  0  0  0  0
  6 17  1  0  0  0  0
  6 18  1  0  0  0  0
  6 19  1  0  0  0  0
M  END
`,
  };
  async function load3DByCID(cid) {
    const v = await ensureViewer();
    if (!v) return;
    try {
      v.clear();
    } catch (_) {}
    let sdf = await fetchSDFByCID(cid);
    if (!sdf && SDF_FALLBACK[cid]) sdf = SDF_FALLBACK[cid];
    if (sdf) {
      v.addModel(sdf, "sdf");
      v.setStyle(
        {},
        { stick: { colorscheme: "Jmol" }, sphere: { scale: 0.25 } }
      );
      v.zoomTo();
      v.render();
      // Ensure zoom is disabled after loading
      if (refs.mol3d) {
        const canvas = refs.mol3d.querySelector("canvas");
        if (canvas) {
          canvas.style.pointerEvents = "none";
        }
      }
    }
  }
  function choosePreviewCID(kind) {
    if (kind === "dmso") return 679;
    if (kind === "hexane") return 8058;
    const ids = [5793, 5984, 962];
    const key = "imfs_honey3d_idx";
    let idx = 0;
    try {
      idx = (parseInt(localStorage.getItem(key) || "0", 10) || 0) + 1;
    } catch (_) {}
    idx = idx % ids.length;
    try {
      localStorage.setItem(key, String(idx));
    } catch (_) {}
    return ids[idx];
  }

  function updateReadouts() {
    refs.vN.textContent = String(sim.params.N);
    refs.vHeat.textContent = String(sim.heatIntensity.toFixed(1));
    // KE readout is updated via animation loop
  }

  let currentKind = "honey";
  // Removed 3D mode

  function setScenario(kind) {
    sim.changeScenario(kind);
    const accent = scenarioColor(kind);
    sim.params.color = accent;
    applyIMFCoeffsFor(sim, kind);
    // Update shell dataset and CSS var for accent glow
    try {
      const rootShell = shadow.querySelector(".imfs-shell");
      if (rootShell) {
        rootShell.dataset.kind = kind;
        rootShell.style.setProperty("--imfs-accent", accent);
      }
    } catch (_) {}
    // Update dropdown selection
    try {
      if (refs.sMaterial) {
        refs.sMaterial.value = kind;
      }
    } catch (_) {}
    if (kind === "honey") {
      if (refs.mol)
        renderMolecule(refs.mol, molecules.honeyDuo(), {
          scale: 1.0,
          stroke: accent,
          labelColor: accent,
        });
      refs.explain.innerHTML = `Multiple –OH groups on sugars act as donors/acceptors, forming a transient hydrogen-bond network with water. This network raises cohesion and viscosity.`;
      // No 3D viewer
    } else if (kind === "dmso") {
      if (refs.mol)
        renderMolecule(refs.mol, molecules.dmso(), {
          scale: 1.0,
          stroke: accent,
          labelColor: accent,
        });
      refs.explain.innerHTML = `Dimethyl sulfoxide has a strong S=O dipole (δ− on O, δ+ on S). Molecules align anti-parallel, producing significant dipole–dipole attraction.`;
      // No 3D viewer
    } else {
      if (refs.mol)
        renderMolecule(refs.mol, molecules.hexane(), {
          scale: 1.0,
          stroke: accent,
          labelColor: accent,
        });
      refs.explain.innerHTML = `Hexane is nonpolar; only London dispersion occurs. Attractions are weakest, giving low cohesion and viscosity.`;
      // No 3D viewer
    }
    updateReadouts();
    currentKind = kind;
    // Update ball-and-stick 3D preview (3Dmol)
    try {
      const cid = choosePreviewCID(kind);
      load3DByCID(cid);
    } catch (_) {}
  }

  // Events
  refs.sMaterial.addEventListener("change", (e) => {
    setScenario(e.target.value);
  });
  refs.sN.addEventListener("input", (e) => {
    sim.params.N = Math.round(Number(e.target.value));
    sim.adjustParticleCount(sim.params.N);
    updateReadouts();
  });
  refs.sHeat.addEventListener("input", (e) => {
    sim.heatIntensity = Number(e.target.value);
    updateReadouts();
  });
  shadow.querySelector("#b-play").addEventListener("click", () => sim.start());
  shadow.querySelector("#b-pause").addEventListener("click", () => sim.stop());
  shadow.querySelector("#b-reset").addEventListener("click", () => {
    sim.spawnParticles();
    sim.draw();
  });

  // New toggles: Gravity, Contour, Shade Contour
  if (refs.tGravity)
    refs.tGravity.addEventListener("click", () => {
      sim.gravityOn = !sim.gravityOn;
      refs.tGravity.classList.toggle("is-active", sim.gravityOn);
    });
  if (refs.tContour)
    refs.tContour.addEventListener("click", () => {
      sim.contourOn = !sim.contourOn;
      refs.tContour.classList.toggle("is-active", sim.contourOn);
    });
  if (refs.tShade)
    refs.tShade.addEventListener("click", () => {
      sim.shadeContour = !sim.shadeContour;
      refs.tShade.classList.toggle("is-active", sim.shadeContour);
    });
  if (refs.tMolecules)
    refs.tMolecules.addEventListener("click", () => {
      sim.moleculesVisible = !sim.moleculesVisible;
      refs.tMolecules.classList.toggle("is-active", sim.moleculesVisible);
    });
  if (refs.tHeat)
    refs.tHeat.addEventListener("click", () => {
      const wasHeating = sim.heatingOn;
      sim.heatingOn = !sim.heatingOn;
      refs.tHeat.classList.toggle("is-active", sim.heatingOn);
      // When turning heat on, reset timer and escaped count for new trial
      if (!wasHeating && sim.heatingOn) {
        sim.gasStart = performance.now();
        sim.escapedCount = 0;
        sim.escapedParticles = [];
        sim.trialEnded = false;
        // Restart simulation if it was stopped
        if (!sim.running) {
          sim.start();
        }
      }
    });

  // Debug panel functionality
  let selectedParticle = null;
  let debugUpdateInterval = null;
  
  // Make debug panel draggable
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let panelStartX = 0;
  let panelStartY = 0;
  
  if (refs.debugPanel) {
    const debugHeader = refs.debugPanel.querySelector("h4");
    if (debugHeader) {
      debugHeader.addEventListener("mousedown", (e) => {
        if (!refs.debugPanel.classList.contains("active")) return;
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        const rect = refs.debugPanel.getBoundingClientRect();
        panelStartX = rect.left;
        panelStartY = rect.top;
        e.preventDefault();
      });
    }
    
    document.addEventListener("mousemove", (e) => {
      if (!isDragging || !refs.debugPanel.classList.contains("active")) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      const newX = panelStartX + dx;
      const newY = panelStartY + dy;
      // Keep panel within viewport bounds
      const maxX = window.innerWidth - refs.debugPanel.offsetWidth;
      const maxY = window.innerHeight - refs.debugPanel.offsetHeight;
      refs.debugPanel.style.left = `${Math.max(0, Math.min(newX, maxX))}px`;
      refs.debugPanel.style.top = `${Math.max(0, Math.min(newY, maxY))}px`;
      refs.debugPanel.style.right = "auto";
    });
    
    document.addEventListener("mouseup", () => {
      isDragging = false;
    });
  }

  function updateDebugPanel() {
    if (!refs.debugPanel || !refs.debugContent) return;

    if (!selectedParticle) {
      refs.debugPanel.classList.remove("active");
      if (debugUpdateInterval) {
        clearInterval(debugUpdateInterval);
        debugUpdateInterval = null;
      }
      return;
    }

    // Rebuild grid for force calculations
    sim.grid.clear();
    for (let i = 0; i < sim.particles.length; i++) {
      sim.grid.insert(sim.particles[i]);
    }

    const data = sim.getParticleDebugData(selectedParticle);
    if (!data) return;

    refs.debugPanel.classList.add("active");

    refs.debugContent.innerHTML = `
      <div class="debug-section">
        <div class="debug-row"><span class="debug-label">Index:</span><span class="debug-value">${
          data.index
        }</span></div>
        <div class="debug-row"><span class="debug-label">State:</span><span class="debug-value">${
          data.state
        }</span></div>
        <div class="debug-row"><span class="debug-label">Mass:</span><span class="debug-value">${
          data.mass
        }</span></div>
        <div class="debug-row"><span class="debug-label">Radius:</span><span class="debug-value">${
          data.radius
        }</span></div>
      </div>
      
      <div class="debug-section">
        <h4>Position</h4>
        <div class="debug-row"><span class="debug-label">X:</span><span class="debug-value">${
          data.position.x
        }</span></div>
        <div class="debug-row"><span class="debug-label">Y:</span><span class="debug-value">${
          data.position.y
        }</span></div>
        <div class="debug-row"><span class="debug-label">Dist from bottom:</span><span class="debug-value">${
          data.heating.distFromBottom
        }</span></div>
      </div>
      
      <div class="debug-section">
        <h4>Velocity</h4>
        <div class="debug-row"><span class="debug-label">Vx:</span><span class="debug-value">${
          data.velocity.x
        }</span></div>
        <div class="debug-row"><span class="debug-label">Vy:</span><span class="debug-value">${
          data.velocity.y
        }</span></div>
        <div class="debug-row"><span class="debug-label">Speed:</span><span class="debug-value">${
          data.velocity.speed
        }</span></div>
      </div>
      
      <div class="debug-section">
        <h4>Energy</h4>
        <div class="debug-row"><span class="debug-label">Kinetic Energy:</span><span class="debug-value">${
          data.kineticEnergy
        }</span></div>
        <div class="debug-row"><span class="debug-label">Thermal Energy:</span><span class="debug-value">${
          data.thermalEnergy
        }</span></div>
      </div>
      
      <div class="debug-section">
        <h4>Forces (Total Magnitude)</h4>
        <div class="debug-row"><span class="debug-label">LJ Force:</span><span class="debug-value">${
          data.forces.lj
        }</span></div>
        <div class="debug-row"><span class="debug-label">HB Force:</span><span class="debug-value">${
          data.forces.hb
        }</span></div>
        <div class="debug-row"><span class="debug-label">Dipole Force:</span><span class="debug-value">${
          data.forces.dipole
        }</span></div>
        <div class="debug-row"><span class="debug-label">Total Force:</span><span class="debug-value">${
          data.forces.total
        }</span></div>
      </div>
      
      <div class="debug-section">
        <h4>Neighbors</h4>
        <div class="debug-row"><span class="debug-label">Local Neighbors:</span><span class="debug-value">${
          data.localNeighbors
        }</span></div>
        <div class="debug-row"><span class="debug-label">Nearest Dist:</span><span class="debug-value">${
          data.nearestNeighbor.distance
        }</span></div>
        <div class="debug-row"><span class="debug-label">Nearest State:</span><span class="debug-value">${
          data.nearestNeighbor.state
        }</span></div>
      </div>
      
      <div class="debug-section">
        <h4>Heating</h4>
        <div class="debug-row"><span class="debug-label">In Heating Zone:</span><span class="debug-value">${
          data.heating.inZone ? "Yes" : "No"
        }</span></div>
        <div class="debug-row"><span class="debug-label">Zone Top:</span><span class="debug-value">${
          data.heating.heatingZoneTop
        }</span></div>
      </div>
      
      <div class="debug-section">
        <h4>State Timing</h4>
        <div class="debug-row"><span class="debug-label">Gas Until (ms):</span><span class="debug-value">${
          data.gasUntil
        }</span></div>
        <div class="debug-row"><span class="debug-label">Last State Change (ms):</span><span class="debug-value">${
          data.lastStateChange
        }</span></div>
      </div>
      
      <div class="debug-note">Click another particle to inspect it</div>
    `;
  }

  // Click detection on canvas
  refs.sim.addEventListener("click", (e) => {
    const rect = refs.sim.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if "Go to Next Trial" button was clicked
    if (sim.trialEnded && sim.restartButtonBounds) {
      const btn = sim.restartButtonBounds;
      if (
        x >= btn.x &&
        x <= btn.x + btn.w &&
        y >= btn.y &&
        y <= btn.y + btn.h
      ) {
        // Cycle to next material and start trial with heat automatically on
        const materials = ["honey", "dmso", "hexane"];
        const currentIndex = materials.indexOf(sim.currentScenario || "honey");
        const nextIndex = (currentIndex + 1) % materials.length;
        const nextMaterial = materials[nextIndex];

        // Switch to next material
        setScenario(nextMaterial);

        // Start trial with heat automatically on
        sim.trialEnded = false;
        sim.escapedCount = 0;
        sim.escapedParticles = [];
        sim.gasStart = performance.now();
        sim.heatingOn = true; // Automatically turn heat on
        sim.spawnParticles();
        sim.start();
        sim.draw();
        // Update heat button UI state
        if (refs.tHeat) refs.tHeat.classList.add("is-active");
        return;
      }
    }

    // Find closest particle
    let closestParticle = null;
    let closestDist = Infinity;

    for (let i = 0; i < sim.particles.length; i++) {
      const p = sim.particles[i];
      const dx = p.pos[0] - x;
      const dy = p.pos[1] - y;
      const dist = Math.hypot(dx, dy);
      const r = p.radius || 4.5;

      if (dist < r + 5 && dist < closestDist) {
        // 5px click tolerance
        closestDist = dist;
        closestParticle = p;
      }
    }

    // Clear existing interval
    if (debugUpdateInterval) {
      clearInterval(debugUpdateInterval);
      debugUpdateInterval = null;
    }

    selectedParticle = closestParticle;
    updateDebugPanel();

    // Update debug panel continuously when particle is selected
    if (selectedParticle && sim.running) {
      debugUpdateInterval = setInterval(() => {
        if (selectedParticle && sim.particles.includes(selectedParticle)) {
          updateDebugPanel();
        } else {
          clearInterval(debugUpdateInterval);
          debugUpdateInterval = null;
          selectedParticle = null;
          updateDebugPanel();
        }
      }, 100); // Update every 100ms
    }
  });

  // (Removed 2D/3D toggle handlers)

  // Init
  setScenario("honey");
  sim.currentScenario = "honey"; // Ensure initial scenario is set
  sim.params.color = scenarioColor("honey");
  sim.draw();
  sim.start();
  // Set gravity button to active state (gravity is on by default)
  if (refs.tGravity && sim.gravityOn) {
    refs.tGravity.classList.add("is-active");
  }
  // Attach gas graph canvas to sim
  try {
    const gasCanvas = shadow.querySelector("#imfs-gas");
    if (gasCanvas && typeof sim.setGasCanvas === "function") {
      sim.setGasCanvas(gasCanvas);
    }
  } catch (_) {}
  // Ensure simulation canvas size is correct after layout
  try {
    // Force a resize to ensure canvas matches its container
    setTimeout(() => {
      sim.setSize();
      sim.draw();
    }, 100);
  } catch (_) {}
  // Initialize 3D viewer with current scenario
  try {
    const cid = choosePreviewCID("honey");
    load3DByCID(cid);
  } catch (_) {}

  return () => {
    sim.destroy();
    try {
      if (themeObserver) themeObserver.disconnect();
    } catch (_) {}
    try {
      if (viewer) {
        viewer.clear();
        viewer = null;
      }
    } catch (_) {}
    try {
      const h = root.querySelector("#imfs-host");
      if (h && h.parentNode) h.parentNode.removeChild(h);
    } catch (_) {}
  };
}
