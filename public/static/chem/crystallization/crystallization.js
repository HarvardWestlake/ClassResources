(() => {
  // --------------------- Utilities ---------------------
  const TAU = Math.PI * 2;
  const DEG = (d) => d * Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a=1, b=0) => Math.random() * (a - b) + b;
  const hypot2 = (dx, dy) => dx*dx + dy*dy;
  const wrapPi = (t) => {
    while (t > Math.PI) t -= TAU;
    while (t < -Math.PI) t += TAU;
    return t;
  };

  // Device-pixel-aware canvas
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  function resizeCanvas() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // ----------------- Simulation parameters --------------
  const SETTINGS = {
    N: 160,               // number of molecules
    a: 18,                // base lattice spacing in px
    rectAspect: 1.6,      // a2/a1 ratio for rectangular lattice (e2 length)
    particleRadius: 2.6,  // draw radius
    capture: 6.2,         // capture radius for binding in px
    friction: 0.996,      // velocity damping per frame
    rotFriction: 0.998,   // angular damping per frame
    wallBounce: 0.9,      // coefficient of restitution for wall bounces
    tolAngle: DEG(12),    // orientation error tolerance for cluster-cluster fuse
    maxSitesPerCluster: 320, // to keep candidate search bounded
  };

  // Temperature mapping (0..100)
  const tempSlider = document.getElementById('temp');
  const phaseLabel = document.getElementById('phaseLabel');
  const bindLabel = document.getElementById('bindLabel');
  const speedLabel = document.getElementById('speedLabel');

  function getControls() {
    const T = +tempSlider.value;
    const lattice = (T < 33) ? 'hex' : (T < 66 ? 'rect' : 'square');
    const drift = 0.10 + (T / 100) * 0.90;  // ~0.1 .. 1.0
    const pBind = 0.75 - (T / 100) * 0.45;  // ~0.75 .. 0.30
    const pBindCC = clamp(pBind - 0.08, 0.05, 0.95);
    return { T, lattice, drift, pBindPC: pBind, pBindCC };
  }

  function updateHUD() {
    const { lattice, drift, pBindPC } = getControls();
    const label = (lattice === 'hex') ? 'Hexagonal' : (lattice === 'square' ? 'Square' : 'Rectangular');
    phaseLabel.innerHTML = `Phase: <strong>${label}</strong>`;
    bindLabel.textContent = `p(bind) ≈ ${pBindPC.toFixed(2)}`;
    speedLabel.textContent = `drift ≈ ${drift.toFixed(2)}`;
  }
  tempSlider.addEventListener('input', updateHUD);
  updateHUD();

  // --------------------- Lattice math -------------------
  // Square/rect: neighbors (±1,0),(0,±1)
  const NBR_SQ = [[1,0],[-1,0],[0,1],[0,-1]];
  // Hex/triangular: neighbors (±1,0),(0,±1),(±1,∓1)
  const NBR_HX = [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]];

  function basisVectors(type, a1, theta, a2=a1) {
    const ct = Math.cos(theta), st = Math.sin(theta);
    if (type === 'square' || type === 'rect') {
      // e1 along theta (length a1), e2 90° CCW (length a2)
      return [
        { x:  a1 * ct,       y:  a1 * st       },
        { x: -a2 * st,       y:  a2 * ct       },
      ];
    } else {
      // hex/triangular lattice: e1 at theta, e2 at theta+60°
      const ex = a1 * 0.5, ey = a1 * Math.sqrt(3)/2;
      return [
        { x:  a1 * ct,                  y:  a1 * st                  }, // e1
        { x:  ex * ct - ey * st,        y:  ex * st + ey * ct        }, // e2 (theta+60°)
      ];
    }
  }

  // Discrete symmetry rotations on index lattice
  function rotSq(i, j, k) {
    switch (((k % 4) + 4) % 4) {
      case 0: return [ i,  j];
      case 1: return [-j,  i];
      case 2: return [-i, -j];
      case 3: return [ j, -i];
    }
  }
  function rotRect(i, j, k) {
    switch (((k % 2) + 2) % 2) {
      case 0: return [ i,  j];
      case 1: return [-i, -j];
    }
  }
  // Hex axial coordinates rotation by steps of 60° around origin.
  function axialToCube(q, r) { const x = q, z = r, y = -x - z; return [x,y,z]; }
  function cubeToAxial(x, y, z) { return [x, z]; }
  function rotHx(i, j, k) {
    let [x,y,z] = axialToCube(i, j);
    k = ((k % 6) + 6) % 6;
    for (let s = 0; s < k; s++) {
      const nx = -z, ny = -x, nz = -y;
      x = nx; y = ny; z = nz;
    }
    const [q,r] = cubeToAxial(x,y,z);
    return [q, r];
  }

  function symmetryStep(type, thetaA, thetaB) {
    const period = (type === 'square') ? (Math.PI/2)
                  : (type === 'hex') ? (Math.PI/3)
                  : Math.PI; // rectangular
    const delta = wrapPi(thetaA - thetaB);
    const k = Math.round(delta / period);
    const err = Math.abs(delta - k * period);
    return { k, err };
  }

  // --------------------- Entities -----------------------
  let particles = []; // free particles
  let clusters  = []; // rigid crystals
  let frameCount = 0;
  const statsEl = document.getElementById('stats');

  class Particle {
    constructor(x, y, vx=0, vy=0) {
      this.x = x; this.y = y;
      this.vx = vx; this.vy = vy;
      this.r  = SETTINGS.particleRadius;
    }
    step(bounds, drift) {
      this.vx += (Math.random() - 0.5) * drift;
      this.vy += (Math.random() - 0.5) * drift;
      this.vx *= SETTINGS.friction;
      this.vy *= SETTINGS.friction;
      this.x  += this.vx;
      this.y  += this.vy;
      if (this.x < this.r) { this.x = this.r; this.vx = -this.vx * SETTINGS.wallBounce; }
      if (this.x > bounds.w - this.r) { this.x = bounds.w - this.r; this.vx = -this.vx * SETTINGS.wallBounce; }
      if (this.y < this.r) { this.y = this.r; this.vy = -this.vy * SETTINGS.wallBounce; }
      if (this.y > bounds.h - this.r) { this.y = bounds.h - this.r; this.vy = -this.vy * SETTINGS.wallBounce; }
    }
    draw(ctx) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, TAU);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--free');
      ctx.fill();
    }
  }

  class Cluster {
    constructor(type, a, cx, cy, theta=0) {
      this.type = type;   // 'square' | 'hex' | 'rect'
      this.a = a;
      this.a2 = (type === 'rect') ? a * SETTINGS.rectAspect : a;
      this.cx = cx; this.cy = cy;
      this.theta = theta;
      this.vx = (Math.random()-0.5) * 0.2;
      this.vy = (Math.random()-0.5) * 0.2;
      this.w  = (Math.random()-0.5) * 0.002; // angular velocity
      this.nodes = Object.create(null); // key -> {i,j}
      this._candCache = { frame: -1, list: [] };
      this.boundR = a * 1.1;
    }
    mass() { return Object.keys(this.nodes).length || 1; }

    key(i,j) { return i + ',' + j; }
    has(i,j) { return this.nodes[this.key(i,j)] !== undefined; }
    add(i,j) {
      const k = this.key(i,j);
      if (!this.nodes[k]) {
        this.nodes[k] = { i, j };
      }
    }
    forEachNode(fn) {
      for (const k in this.nodes) fn(this.nodes[k]);
    }

    e1e2() { return basisVectors(this.type, this.a, this.theta, this.a2); }
    worldOf(i, j) {
      const [e1, e2] = this.e1e2();
      return { x: this.cx + i * e1.x + j * e2.x, y: this.cy + i * e1.y + j * e2.y };
    }

    candidates(maxCount = SETTINGS.maxSitesPerCluster) {
      if (this._candCache.frame === frameCount) return this._candCache.list;
      const list = [];
      const seen = new Set();
      const nbrs = (this.type === 'hex') ? NBR_HX : NBR_SQ; // square and rect share neighbors
      const addSite = (i, j) => {
        const k = this.key(i,j);
        if (seen.has(k) || this.has(i,j)) return;
        seen.add(k);
        const p = this.worldOf(i,j);
        list.push({ i, j, x: p.x, y: p.y });
      };
      this.forEachNode(({i,j}) => {
        for (const [di,dj] of nbrs) {
          if (!this.has(i+di, j+dj)) addSite(i+di, j+dj);
          if (list.length >= maxCount) break;
        }
      });
      this._candCache.frame = frameCount;
      this._candCache.list = list;
      return list;
    }

    recomputeBounds() {
      let r2 = this.a * this.a;
      const [e1, e2] = this.e1e2();
      this.forEachNode(({i,j}) => {
        const dx = i*e1.x + j*e2.x;
        const dy = i*e1.y + j*e2.y;
        const d2 = dx*dx + dy*dy;
        if (d2 > r2) r2 = d2;
      });
      this.boundR = Math.sqrt(r2) + Math.max(this.a, this.a2) * 0.8;
    }

    step(bounds, drift) {
      this.vx += (Math.random() - 0.5) * (drift * 0.25);
      this.vy += (Math.random() - 0.5) * (drift * 0.25);
      this.w  += (Math.random() - 0.5) * 0.0005;
      this.vx *= SETTINGS.friction;
      this.vy *= SETTINGS.friction;
      this.w  *= SETTINGS.rotFriction;
      this.cx += this.vx;
      this.cy += this.vy;
      this.theta = wrapPi(this.theta + this.w);
      const R = this.boundR;
      if (this.cx < R)      { this.cx = R;      this.vx = -this.vx * SETTINGS.wallBounce; }
      if (this.cx > bounds.w - R) { this.cx = bounds.w - R; this.vx = -this.vx * SETTINGS.wallBounce; }
      if (this.cy < R)      { this.cy = R;      this.vy = -this.vy * SETTINGS.wallBounce; }
      if (this.cy > bounds.h - R) { this.cy = bounds.h - R; this.vy = -this.vy * SETTINGS.wallBounce; }
      this._candCache.frame = -1;
    }

    draw(ctx) {
      const color = (this.type === 'square')
        ? getComputedStyle(document.documentElement).getPropertyValue('--blue')
        : (this.type === 'hex')
        ? getComputedStyle(document.documentElement).getPropertyValue('--amber')
        : getComputedStyle(document.documentElement).getPropertyValue('--violet');
      ctx.fillStyle = color;
      const r = SETTINGS.particleRadius + 0.2;
      this.forEachNode(({i,j}) => {
        const p = this.worldOf(i,j);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, TAU);
        ctx.fill();
      });
      ctx.save();
      ctx.translate(this.cx, this.cy);
      ctx.rotate(this.theta);
      ctx.beginPath();
      ctx.arc(0, 0, this.boundR, 0, TAU);
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  // ----------------- Spatial hashing (particles) -----------------
  const grid = {
    cell: 20,
    map: new Map(),
    key(x,y) { return ((x|0)<<16) ^ (y|0); },
    clear() { this.map.clear(); },
    insert(p) {
      const i = Math.floor(p.x / this.cell);
      const j = Math.floor(p.y / this.cell);
      const k = this.key(i,j);
      if (!this.map.has(k)) this.map.set(k, []);
      this.map.get(k).push(p);
    },
    neighbors(p) {
      if (!p) return [];
      const i = Math.floor(p.x / this.cell);
      const j = Math.floor(p.y / this.cell);
      const out = [];
      for (let di=-1; di<=1; di++) for (let dj=-1; dj<=1; dj++) {
        const k = this.key(i+di, j+dj);
        const arr = this.map.get(k);
        if (arr) for (const q of arr) out.push(q);
      }
      return out;
    }
  };

  // ----------------- Binding logic -----------------
  const COLOR = {
    square: getComputedStyle(document.documentElement).getPropertyValue('--blue'),
    hex:    getComputedStyle(document.documentElement).getPropertyValue('--amber'),
    rect:   getComputedStyle(document.documentElement).getPropertyValue('--violet'),
  };

  function tryParticleToCluster(p, cluster, pBind) {
    const dxC = p.x - cluster.cx, dyC = p.y - cluster.cy;
    const far = Math.hypot(dxC, dyC) > (cluster.boundR + Math.max(cluster.a, cluster.a2)*1.5);
    if (far) return false;
    const sites = cluster.candidates();
    const cap2 = SETTINGS.capture * SETTINGS.capture;
    for (let s of sites) {
      const d2 = hypot2(p.x - s.x, p.y - s.y);
      if (d2 <= cap2) {
        if (Math.random() < pBind) {
          cluster.add(s.i, s.j);
          const mA = cluster.mass(), mB = 1;
          cluster.vx = (cluster.vx * mA + p.vx * mB) / (mA + mB);
          cluster.vy = (cluster.vy * mA + p.vy * mB) / (mA + mB);
          cluster.recomputeBounds();
          return true;
        }
      }
    }
    return false;
  }

  function tryParticleToParticle(p, q, phase, pBind) {
    const cap2 = SETTINGS.capture * SETTINGS.capture;
    if (p === q) return false;
    const d2 = hypot2(p.x - q.x, p.y - q.y);
    if (d2 > cap2) return false;
    if (Math.random() >= pBind * 0.5) return false;
    let angle = Math.atan2(q.y - p.y, q.x - p.x);
    const period = (phase === 'square') ? (Math.PI/2) : (phase === 'hex') ? (Math.PI/3) : Math.PI;
    angle = Math.round(angle / period) * period;
    const cl = new Cluster(phase, SETTINGS.a, p.x, p.y, angle);
    cl.add(0, 0);
    cl.add(1, 0);
    cl.recomputeBounds();
    clusters.push(cl);
    return true;
  }

  function tryClusterMerge(A, B, pBind, tolAngle) {
    if (A.type !== B.type) return false;
    const dx = B.cx - A.cx, dy = B.cy - A.cy;
    const dist = Math.hypot(dx, dy);
    if (dist > (A.boundR + B.boundR + Math.max(A.a, A.a2)*1.5)) return false;
    const { k, err } = symmetryStep(A.type, A.theta, B.theta);
    if (err > tolAngle) return false;
    const sitesA = A.candidates();
    const sitesB = B.candidates();
    const cap2   = SETTINGS.capture * SETTINGS.capture;
    const rotFn = (A.type === 'square') ? rotSq : (A.type === 'hex') ? rotHx : rotRect;
    for (let sa of sitesA) {
      for (let sb of sitesB) {
        const d2 = hypot2(sa.x - sb.x, sa.y - sb.y);
        if (d2 > cap2) continue;
        const [bi, bj] = rotFn(sb.i, sb.j, k);
        const di = sa.i - bi;
        const dj = sa.j - bj;
        let conflict = false;
        for (const key in B.nodes) {
          const {i, j} = B.nodes[key];
          const [ti, tj] = rotFn(i, j, k);
          const ai = ti + di, aj = tj + dj;
          if (A.has(ai, aj)) { conflict = true; break; }
        }
        if (conflict) continue;
        if (Math.random() >= pBind) continue;
        for (const key in B.nodes) {
          const {i, j} = B.nodes[key];
          const [ti, tj] = rotFn(i, j, k);
          A.add(ti + di, tj + dj);
        }
        const mA = A.mass(), mB = B.mass();
        A.vx = (A.vx * mA + B.vx * mB) / (mA + mB);
        A.vy = (A.vy * mA + B.vy * mB) / (mA + mB);
        A.w  = (A.w  * mA + B.w  * mB) / (mA + mB);
        A.recomputeBounds();
        const idx = clusters.indexOf(B);
        if (idx >= 0) clusters.splice(idx, 1);
        return true;
      }
    }
    return false;
  }

  // ----------------- Initialization -----------------
  function resetSimulation() {
    particles.length = 0;
    clusters.length = 0;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    for (let i = 0; i < SETTINGS.N; i++) {
      const x = rand(W*0.1, W*0.9);
      const y = rand(H*0.15, H*0.85);
      const vx = rand(-0.5, 0.5);
      const vy = rand(-0.5, 0.5);
      particles.push(new Particle(x, y, vx, vy));
    }
    const { lattice } = getControls();
    const seed = new Cluster(lattice, SETTINGS.a, W*0.5, H*0.5, rand(0, TAU));
    seed.add(0,0);
    seed.recomputeBounds();
    clusters.push(seed);
  }

  // UI buttons
  document.getElementById('resetBtn').addEventListener('click', resetSimulation);
  document.getElementById('joltBtn').addEventListener('click', () => {
    const { drift } = getControls();
    for (const p of particles) {
      p.vx += (Math.random()-0.5) * (drift*2.2);
      p.vy += (Math.random()-0.5) * (drift*2.2);
    }
    for (const c of clusters) {
      c.vx += (Math.random()-0.5) * (drift*1.5);
      c.vy += (Math.random()-0.5) * (drift*1.5);
      c.w  += (Math.random()-0.5) * 0.01;
    }
  });
  let paused = false;
  document.getElementById('pauseBtn').addEventListener('click', (e) => {
    paused = !paused;
    e.target.textContent = paused ? 'Resume' : 'Pause';
  });

  resetSimulation();

  // ----------------- Main loop -----------------
  function step() {
    frameCount++;
    const bounds = { w: canvas.clientWidth, h: canvas.clientHeight };
    const { lattice: phase, drift, pBindPC, pBindCC } = getControls();
    for (const p of particles) p.step(bounds, drift);
    for (const c of clusters) c.step(bounds, drift);
    grid.clear();
    for (const p of particles) grid.insert(p);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      for (let c of clusters) {
        if (c.type !== phase) continue;
        if (tryParticleToCluster(p, c, pBindPC)) {
          particles.splice(i, 1);
          break;
        }
      }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      if (i >= particles.length) continue;
      const p = particles[i];
      if (!p) continue;
      const near = grid.neighbors(p);
      for (const q of near) {
        if (q === p) continue;
        if (tryParticleToParticle(p, q, phase, pBindPC)) {
          const qi = particles.indexOf(q);
          if (qi === -1) {
            // q already removed; just remove p at i
            particles.splice(i, 1);
          } else {
            const i1 = Math.max(i, qi), i2 = Math.min(i, qi);
            particles.splice(i1, 1);
            particles.splice(i2, 1);
          }
          break;
        }
      }
    }
    for (let a = 0; a < clusters.length; a++) {
      for (let b = a + 1; b < clusters.length; b++) {
        const A = clusters[a], B = clusters[b];
        if (A.type !== phase || B.type !== phase) continue;
        if (tryClusterMerge(A, B, pBindCC, SETTINGS.tolAngle)) {
          a = -1; break;
        }
      }
    }
    const freeCount = particles.length;
    const phaseClusters = clusters.filter(c => c.type === phase).length;
    const totalNodes = clusters.reduce((s,c)=>s+c.mass(),0);
    const done = (freeCount === 0 && clusters.length === 1);
    statsEl.innerHTML =
      `particles: <b>${freeCount}</b> &nbsp;` +
      `clusters: <b>${clusters.length}</b> (<span style="color:${COLOR[phase]}">${phase}</span>: ${phaseClusters}) &nbsp;` +
      `nodes: <b>${totalNodes}</b>`;
    ctx.clearRect(0,0,canvas.clientWidth, canvas.clientHeight);
    const aspect = (phase === 'rect') ? SETTINGS.rectAspect : 1;
    drawLatticeBackdrop(ctx, phase, SETTINGS.a, aspect, 0.05);
    for (const p of particles) p.draw(ctx);
    for (const c of clusters) c.draw(ctx);
    const goal = document.getElementById('goalPill');
    goal.style.borderColor = done ? 'var(--ok)' : '#2a355f';
    goal.style.color = done ? 'var(--ok)' : 'var(--fg)';
    goal.textContent = done ? 'Complete: single crystal' : 'Goal: single crystal across canvas';
    if (!paused) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);

  // ----------------- Visual helpers -----------------
  function drawLatticeBackdrop(ctx, type, a, aspect=1, alpha=0.05) {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    if (type === 'square' || type === 'rect') {
      const ay = (type === 'rect') ? a * aspect : a;
      for (let x=0; x<=W; x+=a) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y=0; y<=H; y+=ay) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    } else {
      const h = Math.sqrt(3) * a / 2;
      for (let y=-h; y<=H+h; y+=h) {
        ctx.moveTo(0, y);
        let x = 0, step = a;
        while (x <= W + a) {
          ctx.lineTo(x, y);
          x += step;
        }
      }
      for (let y=-H; y<=H; y+=h) {
        ctx.moveTo(0, y);
        ctx.lineTo(W, y+W*Math.tan(Math.PI/6));
      }
    }
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
})();


