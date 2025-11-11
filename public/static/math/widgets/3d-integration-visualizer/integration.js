// Multivariable Integration Visualizer core

(function() {
    const $ = (id) => document.getElementById(id);

    // UI elements
    const canvasHost = $('canvas3d');
    const methodSelect = $('methodSelect');
    const presetSelect = $('presetSelect');
    const equationInput = $('equationInput');
    const renderBtn = $('renderBtn');
    const resetCameraBtn = $('resetCameraBtn');
    const showSurface = $('showSurface');
    const showColumns = $('showColumns');
    const showRegion = $('showRegion');
    const showWedge = $('showWedge');
    const jacobianText = $('jacobianText');
    const integralEstimate = $('integralEstimate');
    const equationError = document.getElementById('equationError');

    // Bounds
    const xMin = $('xMin'), xMax = $('xMax'), yMin = $('yMin'), yMax = $('yMax');
    const rMin = $('rMin'), rMax = $('rMax'), thetaMin = $('thetaMin'), thetaMax = $('thetaMax');
    const rcMin = $('rcMin'), rcMax = $('rcMax'), thetacMin = $('thetacMin'), thetacMax = $('thetacMax'), zMin = $('zMin'), zMax = $('zMax');
    const rhoMin = $('rhoMin'), rhoMax = $('rhoMax'), phiMin = $('phiMin'), phiMax = $('phiMax'), thetasMin = $('thetasMin'), thetasMax = $('thetasMax');
    const nx = $('nx'), ny = $('ny'), nz = $('nz');

    // Three.js core
    let renderer, scene, camera, controls;
    let surfaceGroup, columnsGroup, regionGroup, wedgeGroup, axesHelper, gridHelper, gridHelperNeg;
    // Auto-rotation around Z axis for demonstration
    let autoRotateZ = true;
    let autoRotateSpeed = 0.5; // radians per second
    let _lastFrameTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());

    function getHostSize() {
        const rect = canvasHost.getBoundingClientRect();
        let w = Math.max(1, Math.floor(rect.width || canvasHost.clientWidth || 1));
        let h = Math.max(1, Math.floor(rect.height || canvasHost.clientHeight || 1));
        if (w < 50 || h < 50) {
            // Fallback if layout hasn't sized yet
            w = Math.max(300, window.innerWidth - 380);
            h = Math.max(300, window.innerHeight - 24);
        }
        return { w, h };
    }

    function setupThree() {
        const { w, h } = getHostSize();
        const ratio = w / h;
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        if (THREE && THREE.sRGBEncoding) {
            renderer.outputEncoding = THREE.sRGBEncoding;
        } else if (THREE && THREE.OutputColorSpace) {
            renderer.outputColorSpace = THREE.SRGBColorSpace;
        }
        renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio || 1, 1), 2));
        renderer.setSize(w, h);
        canvasHost.innerHTML = '';
        canvasHost.appendChild(renderer.domElement);
        // Basic click probe: visual dot + console logs to prove events are firing
        (function attachClickProbe() {
            const el = renderer.domElement;
            // Help pointer events on touch devices and avoid context menu blocking right-drag
            el.style.touchAction = 'none';
            el.addEventListener('contextmenu', (e) => e.preventDefault());
            function showClickDot(evt, color = '#ff3b7f', radius = 6) {
                const rect = el.getBoundingClientRect();
                const x = evt.clientX - rect.left;
                const y = evt.clientY - rect.top;
                const dot = document.createElement('div');
                dot.style.position = 'absolute';
                dot.style.left = (x - radius) + 'px';
                dot.style.top = (y - radius) + 'px';
                const size = (radius * 2) + 'px';
                dot.style.width = size;
                dot.style.height = size;
                dot.style.borderRadius = '50%';
                dot.style.background = color;
                dot.style.boxShadow = '0 0 0 2px rgba(0,0,0,.12)';
                dot.style.pointerEvents = 'none';
                dot.style.opacity = '1';
                dot.style.transform = 'scale(1)';
                dot.style.transition = 'transform 0.45s ease-out, opacity 0.6s ease-out';
                canvasHost.appendChild(dot);
                requestAnimationFrame(() => {
                    dot.style.transform = 'scale(2)';
                    dot.style.opacity = '0';
                });
                setTimeout(() => { dot.remove(); }, 650);
            }
            let isDragging = false;
            let startX = 0, startY = 0, lastX = 0, lastY = 0;
            let moveRAF = 0;
            let pendingMoveEvt = null;
            let autoRotateResumeTimer = 0;
            function pauseAutoRotate(ms = 1500) {
                autoRotateZ = false;
                if (autoRotateResumeTimer) clearTimeout(autoRotateResumeTimer);
                autoRotateResumeTimer = setTimeout(() => { autoRotateZ = true; }, ms);
            }
            // Zoom utility: uses OrbitControls dolly if present, else move camera along view vector
            function zoomBy(factor, anchorEvent) {
                pauseAutoRotate(1200);
                const s = Math.max(0.0001, Math.min(1000, factor));
                if (controls && typeof controls.dollyIn === 'function' && typeof controls.dollyOut === 'function') {
                    if (s < 1) controls.dollyIn(s); else controls.dollyOut(s);
                    controls.update && controls.update();
                } else {
                    const tgt = (controls && controls.target) ? controls.target : new THREE.Vector3(0, 0, 0);
                    const dir = new THREE.Vector3();
                    camera.getWorldDirection(dir);
                    const dist = camera.position.distanceTo(tgt);
                    const step = Math.max(0.05, dist * Math.abs(s - 1));
                    camera.position.addScaledVector(dir, s < 1 ? -step : step);
                    camera.updateProjectionMatrix();
                }
                if (anchorEvent) showClickDot(anchorEvent, '#b81f53', 3);
            }
            // Mouse wheel / trackpad zoom
            el.addEventListener('wheel', (evt) => {
                const speed = (controls && controls.zoomSpeed) ? controls.zoomSpeed : 1;
                const intensity = 0.0015 * speed;
                const s = Math.pow(1 + intensity, Math.abs(evt.deltaY));
                const factor = (evt.deltaY < 0) ? (1 / s) : s;
                zoomBy(factor, evt);
                evt.preventDefault();
                evt.stopImmediatePropagation();
            }, { passive: false });
            el.addEventListener('pointerdown', (evt) => {
                console.log('canvas pointerdown (drag start)', { button: evt.button, x: evt.clientX, y: evt.clientY });
                isDragging = true;
                startX = lastX = evt.clientX;
                startY = lastY = evt.clientY;
                try { el.setPointerCapture(evt.pointerId); } catch(e) {}
                // blue marker for drag start
                showClickDot(evt, '#2d6cdf', 5);
                pauseAutoRotate(2500);
            });
            el.addEventListener('pointermove', (evt) => {
                if (!isDragging) return;
                pendingMoveEvt = evt;
                if (moveRAF) return;
                moveRAF = requestAnimationFrame(() => {
                    const e = pendingMoveEvt;
                    moveRAF = 0;
                    pendingMoveEvt = null;
                    const dx = e.clientX - lastX;
                    const dy = e.clientY - lastY;
                    lastX = e.clientX;
                    lastY = e.clientY;
                    // Modifier-drag zoom (Shift or Alt)
                    if (e.shiftKey || e.altKey) {
                        const intensity = 0.006 * (e.shiftKey ? 1 : 0.5);
                        const s = Math.exp(Math.abs(dy) * intensity);
                        const factor = (dy < 0) ? (1 / s) : s; // drag up => zoom in
                        zoomBy(factor, e);
                        return;
                    }
                    console.log('canvas drag move', { dx, dy, x: e.clientX, y: e.clientY });
                    // light blue trail dot during rotate/pan drag
                    showClickDot(e, '#4cc3ff', 4);
                    // Drive camera orbit if available; otherwise rotate the content as fallback
                    try {
                        const elementHeight = Math.max(1, el.clientHeight || el.height || 1);
                        const angleFactor = (2 * Math.PI) / elementHeight; // ~full rotation per viewport height
                        if (controls && typeof controls.rotateLeft === 'function' && typeof controls.rotateUp === 'function') {
                            controls.rotateLeft(dx * angleFactor);
                            controls.rotateUp(dy * angleFactor);
                            controls.update();
                        } else {
                            const rotSpeed = 0.01;
                            if (surfaceGroup) { surfaceGroup.rotation.y += dx * rotSpeed; surfaceGroup.rotation.x += dy * rotSpeed; }
                            if (columnsGroup) { columnsGroup.rotation.y += dx * rotSpeed; columnsGroup.rotation.x += dy * rotSpeed; }
                            if (regionGroup) { regionGroup.rotation.y += dx * rotSpeed; regionGroup.rotation.x += dy * rotSpeed; }
                            if (wedgeGroup) { wedgeGroup.rotation.y += dx * rotSpeed; wedgeGroup.rotation.x += dy * rotSpeed; }
                        }
                    } catch (err) {
                        // no-op
                    }
                });
            });
            function endDrag(evt, label = 'pointerup') {
                if (!isDragging) return;
                isDragging = false;
                try { el.releasePointerCapture(evt.pointerId); } catch(e) {}
                const totalDx = evt.clientX - startX;
                const totalDy = evt.clientY - startY;
                console.log(`canvas ${label} (drag end)`, { x: evt.clientX, y: evt.clientY, totalDx, totalDy });
                // green marker for drag end
                showClickDot(evt, '#2ecc71', 6);
                pauseAutoRotate(1500);
            }
            el.addEventListener('pointerup', (evt) => endDrag(evt, 'pointerup'));
            el.addEventListener('pointercancel', (evt) => endDrag(evt, 'pointercancel'));
            el.addEventListener('click', (evt) => {
                console.log('canvas click', { x: evt.clientX, y: evt.clientY });
            });
        })();

        scene = new THREE.Scene();
        scene.background = null;

        camera = new THREE.PerspectiveCamera(55, ratio, 0.1, 1000);
        camera.position.set(8, 8, 8);
        scene.add(camera);

        if (THREE.OrbitControls) {
            controls = new THREE.OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.08;
            controls.enableZoom = true;
            controls.zoomSpeed = 1.0;
            controls.enablePan = true;
            controls.panSpeed = 0.8;
            controls.screenSpacePanning = true; // keep panning parallel to ground
            controls.minDistance = 0.25;       // allow zooming into the plane
            controls.maxDistance = 200;
            controls.target.set(0, 0, 0);
            controls.update();
        } else {
            controls = { update: () => {}, target: new THREE.Vector3(0, 0, 0) };
        }
        camera.lookAt(controls.target);

        const amb = new THREE.AmbientLight(0xffffff, 0.95);
        scene.add(amb);
        const dir = new THREE.DirectionalLight(0xffffff, 0.8);
        dir.position.set(5, 10, 7);
        scene.add(dir);

        axesHelper = new THREE.AxesHelper(4);
        scene.add(axesHelper);
        gridHelper = new THREE.GridHelper(16, 32, 0xbbc2ca, 0xd7dde3);
        gridHelper.material.transparent = true;
        gridHelper.material.opacity = 0.55;
        scene.add(gridHelper);
        // subtle duplicate just below the plane to make the negative side visually present
        gridHelperNeg = new THREE.GridHelper(16, 32, 0xdedede, 0xeeeeee);
        gridHelperNeg.material.transparent = true;
        gridHelperNeg.material.opacity = 0.3;
        gridHelperNeg.position.y = -0.0006;
        scene.add(gridHelperNeg);

        surfaceGroup = new THREE.Group();
        columnsGroup = new THREE.Group();
        regionGroup = new THREE.Group();
        wedgeGroup = new THREE.Group();
        scene.add(surfaceGroup, columnsGroup, regionGroup, wedgeGroup);

        window.addEventListener('resize', onResize);
        onResize();
        animate();
    }

    function onResize() {
        if (!renderer || !camera) return;
        const { w, h } = getHostSize();
        renderer.setSize(w, h);
        camera.aspect = Math.max(1e-6, w / h);
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
    }

    function animate() {
        requestAnimationFrame(animate);
        // time step for smooth and framerate-independent rotation
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        const dt = Math.max(0, (now - _lastFrameTime) / 1000);
        _lastFrameTime = now;
        if (autoRotateZ) {
            const dAng = autoRotateSpeed * dt;
            if (surfaceGroup) surfaceGroup.rotation.z += dAng;
            if (columnsGroup) columnsGroup.rotation.z += dAng;
            if (regionGroup) regionGroup.rotation.z += dAng;
            if (wedgeGroup) wedgeGroup.rotation.z += dAng;
        }
        controls && controls.update();
        renderer && renderer.render(scene, camera);
    }

    // Utilities
    function clearGroup(group) {
        const toRemove = group.children.slice();
        for (const obj of toRemove) {
            group.remove(obj);
            if (obj.geometry && obj.geometry.dispose) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose && m.dispose());
                else obj.material.dispose && obj.material.dispose();
            }
        }
    }

    function fitCameraToContent() {
        const box = new THREE.Box3();
        const groups = [surfaceGroup, columnsGroup, regionGroup, wedgeGroup];
        let hasAny = false;
        for (const g of groups) {
            if (g.children.length) {
                box.expandByObject(g);
                hasAny = true;
            }
        }
        if (!hasAny) return;
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        const maxDim = Math.max(size.x, size.y, size.z);
        const fitDist = maxDim * 1.6 / Math.tan((camera.fov * Math.PI / 180) / 2);
        const dir = new THREE.Vector3(1, 0.8, 1).normalize();
        camera.position.copy(center.clone().add(dir.multiplyScalar(fitDist)));
        controls.target.copy(center);
        controls.update();
    }

    function deg2rad(d) { return d * Math.PI / 180; }

    function evalFunction(expr, x, y) {
        // Safe evaluate using math.js compiled expression
        try {
            const scope = { x, y, r: Math.hypot(x, y), theta: Math.atan2(y, x) };
            return expr.evaluate(scope);
        } catch (e) {
            return NaN;
        }
    }

    function tryCompileEquation() {
        const raw = equationInput.value || '0';
        try {
            const parsed = math.parse(raw);
            const compiled = parsed.compile();
            equationInput.classList.remove('input-error');
            if (equationError) { equationError.style.display = 'none'; equationError.textContent = ''; }
            // quick test eval
            const t = compiled.evaluate({ x: 0, y: 0 });
            if (!isFinite(t)) throw new Error('Result not finite');
            return compiled;
        } catch (err) {
            equationInput.classList.add('input-error');
            if (equationError) { equationError.style.display = 'block'; equationError.textContent = 'Invalid equation. Try expressions in x and y (e.g., sin(x)*cos(y)).'; }
            // fallback to zero function
            return math.parse('0').compile();
        }
    }

    function buildSurfaceFromFunction(expr, x0, x1, y0, y1, nxSamples, nySamples, color = 0x4cc3ff, opacity = 0.25) {
        const geom = new THREE.BufferGeometry();
        const vertices = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        const dx = (x1 - x0) / nxSamples;
        const dy = (y1 - y0) / nySamples;
        const grid = [];
        for (let i = 0; i <= nxSamples; i++) {
            grid[i] = [];
            for (let j = 0; j <= nySamples; j++) {
                const x = x0 + i * dx;
                const y = y0 + j * dy;
                const z = evalFunction(expr, x, y);
                grid[i][j] = { x, y, z: isFinite(z) ? z : 0 };
            }
        }

        for (let i = 0; i <= nxSamples; i++) {
            for (let j = 0; j <= nySamples; j++) {
                const p = grid[i][j];
                vertices.push(p.x, p.z, p.y); // using z-up -> map (x,z,y)
                uvs.push(i / nxSamples, j / nySamples);
            }
        }

        function pushQuad(a, b, c, d) {
            indices.push(a, b, d, b, c, d);
        }

        for (let i = 0; i < nxSamples; i++) {
            for (let j = 0; j < nySamples; j++) {
                const a = i * (nySamples + 1) + j;
                const b = (i + 1) * (nySamples + 1) + j;
                const c = (i + 1) * (nySamples + 1) + (j + 1);
                const d = i * (nySamples + 1) + (j + 1);
                pushQuad(a, b, c, d);
            }
        }

        geom.setIndex(indices);
        geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geom.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geom, mat);
        // Add a crisp edge outline to make the surface visible on dark backgrounds
        const edges = new THREE.EdgesGeometry(geom);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x7fd3ff, linewidth: 1 }));
        const g = new THREE.Group();
        g.add(mesh);
        g.add(line);
        return g;
    }

    function addRegionRectangle(x0, x1, y0, y1) {
        const geom = new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0));
        const mat = new THREE.MeshBasicMaterial({ color: 0x8bd450, transparent: true, opacity: 0.18, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set((x0 + x1) / 2, 0.001, (y0 + y1) / 2);
        regionGroup.add(mesh);

        const edges = new THREE.EdgesGeometry(geom);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x8bd450 }));
        line.rotation.x = -Math.PI / 2;
        line.position.copy(mesh.position);
        regionGroup.add(line);
    }

    function addColumnsCartesian(expr, x0, x1, y0, y1, nxp, nyp) {
        const dx = (x1 - x0) / nxp;
        const dy = (y1 - y0) / nyp;
        const material = new THREE.MeshStandardMaterial({ color: 0xff7a59, transparent: true, opacity: 0.6 });
        let estimate = 0;
        for (let i = 0; i < nxp; i++) {
            for (let j = 0; j < nyp; j++) {
                const xc = x0 + (i + 0.5) * dx;
                const yc = y0 + (j + 0.5) * dy;
                const height = evalFunction(expr, xc, yc);
                if (!isFinite(height)) continue;
                const geom = new THREE.BoxGeometry(dx * 0.95, Math.abs(height), dy * 0.95);
                const col = new THREE.Mesh(geom, material);
                col.position.set(xc, Math.sign(height) * Math.abs(height) / 2, yc);
                columnsGroup.add(col);
                estimate += height * dx * dy;
            }
        }
        return estimate;
    }

    // Polar double integral visualization (sectors with Jacobian r)
    function addRegionPolar(r0, r1, t0, t1) {
        const shape = new THREE.Shape();
        const steps = 48;
        for (let k = 0; k <= steps; k++) {
            const t = t0 + (t1 - t0) * (k / steps);
            const x = r1 * Math.cos(t), y = r1 * Math.sin(t);
            if (k === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
        }
        for (let k = steps; k >= 0; k--) {
            const t = t0 + (t1 - t0) * (k / steps);
            const x = r0 * Math.cos(t), y = r0 * Math.sin(t);
            shape.lineTo(x, y);
        }
        const geom = new THREE.ShapeGeometry(shape);
        const mat = new THREE.MeshBasicMaterial({ color: 0x8bd450, transparent: true, opacity: 0.18, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.rotation.x = -Math.PI / 2;
        regionGroup.add(mesh);
        const edges = new THREE.EdgesGeometry(geom);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x8bd450 }));
        line.rotation.x = -Math.PI / 2;
        regionGroup.add(line);
    }

    function addColumnsPolar(expr, r0, r1, t0, t1, nr, nt) {
        const dr = (r1 - r0) / nr;
        const dt = (t1 - t0) / nt;
        let estimate = 0;
        const mat = new THREE.MeshStandardMaterial({ color: 0xff7a59, transparent: true, opacity: 0.6 });
        for (let i = 0; i < nr; i++) {
            for (let j = 0; j < nt; j++) {
                const rc = r0 + (i + 0.5) * dr;
                const tc = t0 + (j + 0.5) * dt;
                const x = rc * Math.cos(tc);
                const y = rc * Math.sin(tc);
                const h = evalFunction(expr, x, y);
                if (!isFinite(h)) continue;
                // approximate sector area: r dr dtheta
                const area = rc * dr * dt;
                const boxR = dr * 0.9;
                const arc = rc * dt * 0.9;
                const geom = new THREE.BoxGeometry(boxR, Math.abs(h), arc);
                const col = new THREE.Mesh(geom, mat);
                const cx = x, cy = y;
                col.position.set(cx, Math.sign(h) * Math.abs(h) / 2, cy);
                // rotate in xz-plane to align long axis tangentially
                col.rotation.y = tc;
                columnsGroup.add(col);
                estimate += h * area;
            }
        }
        return estimate;
    }

    // Triple integrals presets (volumes) and dV wedges
    function addVolumePreset(preset) {
        const group = new THREE.Group();
        let mesh;
        if (preset === 'sphere') {
            const geom = new THREE.SphereGeometry(2, 48, 32);
            const mat = new THREE.MeshStandardMaterial({ color: 0x4cc3ff, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
            mesh = new THREE.Mesh(geom, mat);
        } else if (preset === 'cone') {
            const geom = new THREE.ConeGeometry(1.5, 3, 48);
            const mat = new THREE.MeshStandardMaterial({ color: 0x4cc3ff, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
            mesh = new THREE.Mesh(geom, mat);
            mesh.position.y = 1.5 / 2;
        } else if (preset === 'cylinder') {
            const geom = new THREE.CylinderGeometry(1.5, 1.5, 3, 48);
            const mat = new THREE.MeshStandardMaterial({ color: 0x4cc3ff, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
            mesh = new THREE.Mesh(geom, mat);
        } else if (preset === 'paraboloid') {
            const expr = math.parse('0.5*(x^2 + y^2)').compile();
            const surf = buildSurfaceFromFunction(expr, -2.5, 2.5, -2.5, 2.5, 64, 64, 0x4cc3ff, 0.22);
            mesh = surf;
        }
        if (mesh) group.add(mesh);
        surfaceGroup.add(group);
    }

    function addDVWedgeCylindrical(r0, r1, t0, t1, z0, z1) {
        // Show a representative small rectangular box for dV = r dr dθ dz at some center
        const rc = (r0 + r1) / 2;
        const tc = (t0 + t1) / 2;
        const zc = (z0 + z1) / 2;
        const dr = Math.max((r1 - r0) / 12, 0.05);
        const dt = Math.max((t1 - t0) / 12, deg2rad(3));
        const dz = Math.max((z1 - z0) / 12, 0.05);

        const geom = new THREE.BoxGeometry(dr, dz, rc * dt);
        const mat = new THREE.MeshStandardMaterial({ color: 0xff3b7f, transparent: true, opacity: 0.6 });
        const box = new THREE.Mesh(geom, mat);
        const x = rc * Math.cos(tc);
        const y = rc * Math.sin(tc);
        box.position.set(x, zc, y);
        // rotate around y (up) to align wedge in xz-plane
        box.rotation.y = tc;
        wedgeGroup.add(box);
    }

    function addDVWedgeSpherical(rho0, rho1, phi0, phi1, theta0, theta1) {
        // Show small curvilinear box ~ rho^2 sin phi d rho d phi d theta
        const rhoc = (rho0 + rho1) / 2;
        const phic = (phi0 + phi1) / 2;
        const thetac = (theta0 + theta1) / 2;
        const dr = Math.max((rho1 - rho0) / 14, 0.05);
        const dphi = Math.max((phi1 - phi0) / 14, deg2rad(3));
        const dtheta = Math.max((theta1 - theta0) / 14, deg2rad(3));
        const radial = dr;
        const tangential1 = rhoc * dphi;
        const tangential2 = rhoc * Math.sin(phic) * dtheta;
        const geom = new THREE.BoxGeometry(radial, tangential1, tangential2);
        const mat = new THREE.MeshStandardMaterial({ color: 0xff3b7f, transparent: true, opacity: 0.6 });
        const x = rhoc * Math.sin(phic) * Math.cos(thetac);
        const y = rhoc * Math.sin(phic) * Math.sin(thetac);
        const z = rhoc * Math.cos(phic);
        const box = new THREE.Mesh(geom, mat);
        box.position.set(x, z, y);
        wedgeGroup.add(box);
    }

    // Triple integral bricks/voxels for numeric estimate and visualization
    function addVoxelsCylindrical(r0, r1, t0, t1, z0, z1, nr, nt, nz) {
        const dr = (r1 - r0) / nr;
        const dt = (t1 - t0) / nt;
        const dz = (z1 - z0) / nz;
        const mat = new THREE.MeshStandardMaterial({ color: 0xff7a59, transparent: true, opacity: 0.45 });
        let volume = 0;
        const maxCells = 2500; // guard performance
        const totalCells = nr * nt * nz;
        const stride = totalCells > maxCells ? Math.ceil(totalCells / maxCells) : 1;
        let idx = 0;
        for (let i = 0; i < nr; i++) {
            const rc = r0 + (i + 0.5) * dr;
            const boxR = dr * 0.98;
            const tangential = Math.max(rc * dt * 0.98, 0.001);
            for (let j = 0; j < nt; j++) {
                const tc = t0 + (j + 0.5) * dt;
                const x = rc * Math.cos(tc);
                const z = rc * Math.sin(tc);
                for (let k = 0; k < nz; k++, idx++) {
                    if (stride > 1 && (idx % stride) !== 0) continue;
                    const yc = z0 + (k + 0.5) * dz; // world y
                    const geom = new THREE.BoxGeometry(boxR, dz * 0.98, tangential);
                    const box = new THREE.Mesh(geom, mat);
                    box.position.set(x, yc, z);
                    box.rotation.y = tc;
                    columnsGroup.add(box);
                }
                // Sum full contribution (not downsampled)
                for (let k = 0; k < nz; k++) {
                    volume += rc * dr * dt * dz;
                }
            }
        }
        return volume;
    }

    function addVoxelsSpherical(rh0, rh1, ph0, ph1, th0, th1, nr, nphi, nth) {
        const dr = (rh1 - rh0) / nr;
        const dphi = (ph1 - ph0) / nphi;
        const dtheta = (th1 - th0) / nth;
        const mat = new THREE.MeshStandardMaterial({ color: 0xff7a59, transparent: true, opacity: 0.45 });
        let volume = 0;
        const maxCells = 3000;
        const totalCells = nr * nphi * nth;
        const stride = totalCells > maxCells ? Math.ceil(totalCells / maxCells) : 1;
        let idx = 0;
        for (let i = 0; i < nr; i++) {
            const rhoc = rh0 + (i + 0.5) * dr;
            const radial = Math.max(dr * 0.98, 0.001);
            for (let j = 0; j < nphi; j++) {
                const phic = ph0 + (j + 0.5) * dphi;
                const tangential1 = Math.max(rhoc * dphi * 0.98, 0.001);
                for (let k = 0; k < nth; k++, idx++) {
                    if (stride > 1 && (idx % stride) !== 0) continue;
                    const thetac = th0 + (k + 0.5) * dtheta;
                    const tangential2 = Math.max(rhoc * Math.sin(phic) * dtheta * 0.98, 0.001);
                    const x = rhoc * Math.sin(phic) * Math.cos(thetac);
                    const y = rhoc * Math.cos(phic); // world y
                    const z = rhoc * Math.sin(phic) * Math.sin(thetac);
                    const geom = new THREE.BoxGeometry(radial, tangential1, tangential2);
                    const box = new THREE.Mesh(geom, mat);
                    box.position.set(x, y, z);
                    // approximate orientation: yaw by theta
                    box.rotation.y = thetac;
                    columnsGroup.add(box);
                }
                for (let k = 0; k < nth; k++) {
                    volume += (rhoc * rhoc) * Math.sin(phic) * dr * dphi * dtheta;
                }
            }
        }
        return volume;
    }

    // Renderers per method
    function renderDoubleCartesian() {
        const x0 = parseFloat(xMin.value), x1 = parseFloat(xMax.value);
        const y0 = parseFloat(yMin.value), y1 = parseFloat(yMax.value);
        const nxp = Math.max(2, parseInt(nx.value));
        const nyp = Math.max(2, parseInt(ny.value));
        jacobianText.textContent = 'dA = dx dy';
        clearGroup(surfaceGroup); clearGroup(columnsGroup); clearGroup(regionGroup); clearGroup(wedgeGroup);
        const compiled = tryCompileEquation();
        if (showSurface.checked) {
            const surf = buildSurfaceFromFunction(compiled, x0, x1, y0, y1, 64, 64);
            surfaceGroup.add(surf);
        }
        if (showRegion.checked) addRegionRectangle(x0, x1, y0, y1);
        let estimate = 0;
        if (showColumns.checked) {
            estimate = addColumnsCartesian(compiled, x0, x1, y0, y1, nxp, nyp);
        }
        if (showWedge.checked) {
            // representative dA rectangle
            const dx = (x1 - x0) / nxp, dy = (y1 - y0) / nyp;
            const geom = new THREE.BoxGeometry(dx, 0.02, dy);
            const mat = new THREE.MeshStandardMaterial({ color: 0xff3b7f, transparent: true, opacity: 0.8 });
            const box = new THREE.Mesh(geom, mat);
            box.position.set(x0 + dx / 2, 0.01, y0 + dy / 2);
            box.rotation.x = Math.PI / 2;
            wedgeGroup.add(box);
        }
        integralEstimate.textContent = `Approx ∬ f dA ≈ ${estimate.toFixed(3)}`;
        fitCameraToContent();
    }

    function renderDoublePolar() {
        const r0 = parseFloat(rMin.value), r1 = parseFloat(rMax.value);
        const t0 = deg2rad(parseFloat(thetaMin.value)), t1 = deg2rad(parseFloat(thetaMax.value));
        const nr = Math.max(2, parseInt(nx.value));
        const nt = Math.max(2, parseInt(ny.value));
        jacobianText.textContent = 'In polar: dA = r dr dθ';
        clearGroup(surfaceGroup); clearGroup(columnsGroup); clearGroup(regionGroup); clearGroup(wedgeGroup);
        const expr = tryCompileEquation();
        if (showRegion.checked) addRegionPolar(r0, r1, t0, t1);
        if (showSurface.checked) {
            // sample surface over the bounding rectangle in xy
            const x0 = -r1, x1 = r1, y0 = -r1, y1 = r1;
            const surf = buildSurfaceFromFunction(expr, x0, x1, y0, y1, 64, 64);
            surfaceGroup.add(surf);
        }
        let estimate = 0;
        if (showColumns.checked) {
            estimate = addColumnsPolar(expr, r0, r1, t0, t1, nr, nt);
        }
        if (showWedge.checked) {
            const rc = (r0 + r1) / 2; const dt = (t1 - t0) / nt; const dr = (r1 - r0) / nr;
            const geom = new THREE.BoxGeometry(dr, 0.02, rc * dt);
            const mat = new THREE.MeshStandardMaterial({ color: 0xff3b7f, transparent: true, opacity: 0.8 });
            const box = new THREE.Mesh(geom, mat);
            const tc = t0 + dt / 2;
            box.position.set(rc * Math.cos(tc), 0.01, rc * Math.sin(tc));
            box.rotation.y = tc;
            wedgeGroup.add(box);
        }
        integralEstimate.textContent = `Approx ∬ f dA ≈ ${estimate.toFixed(3)}`;
        fitCameraToContent();
    }

    function renderTripleCylindrical() {
        const r0 = parseFloat(rcMin.value), r1 = parseFloat(rcMax.value);
        const t0 = deg2rad(parseFloat(thetacMin.value)), t1 = deg2rad(parseFloat(thetacMax.value));
        const z0 = parseFloat(zMin.value), z1 = parseFloat(zMax.value);
        jacobianText.textContent = 'In cylindrical: dV = r dr dθ dz';
        clearGroup(surfaceGroup); clearGroup(columnsGroup); clearGroup(regionGroup); clearGroup(wedgeGroup);
        const preset = presetSelect.value;
        if (showSurface.checked && preset !== 'none') addVolumePreset(preset);
        if (showRegion.checked) addRegionPolar(r0, r1, t0, t1);
        let estimate = 0;
        if (showColumns.checked) {
            const nr = Math.max(2, parseInt(nx.value));
            const nt = Math.max(2, parseInt(ny.value));
            const nzp = Math.max(1, parseInt(nz.value));
            estimate = addVoxelsCylindrical(r0, r1, t0, t1, z0, z1, nr, nt, nzp);
        }
        if (showWedge.checked) addDVWedgeCylindrical(r0, r1, t0, t1, z0, z1);
        integralEstimate.textContent = estimate > 0 ? `Approx ∭ dV ≈ ${estimate.toFixed(3)}` : 'Volume visualization';
        fitCameraToContent();
    }

    function renderTripleSpherical() {
        const rh0 = parseFloat(rhoMin.value), rh1 = parseFloat(rhoMax.value);
        const ph0 = deg2rad(parseFloat(phiMin.value)), ph1 = deg2rad(parseFloat(phiMax.value));
        const th0 = deg2rad(parseFloat(thetasMin.value)), th1 = deg2rad(parseFloat(thetasMax.value));
        jacobianText.textContent = 'In spherical: dV = ρ² sinφ dρ dφ dθ';
        clearGroup(surfaceGroup); clearGroup(columnsGroup); clearGroup(regionGroup); clearGroup(wedgeGroup);
        const preset = presetSelect.value;
        if (showSurface.checked && preset !== 'none') addVolumePreset(preset);
        if (showRegion.checked) {
            // approximate spherical sector by showing its projection ring
            addRegionPolar(0, rh1 * Math.sin((ph0 + ph1) / 2), th0, th1);
        }
        let estimate = 0;
        if (showColumns.checked) {
            const nr = Math.max(2, parseInt(nx.value));
            const nphi = Math.max(2, parseInt(ny.value));
            const nth = Math.max(2, parseInt(nz.value));
            estimate = addVoxelsSpherical(rh0, rh1, ph0, ph1, th0, th1, nr, nphi, nth);
        }
        if (showWedge.checked) addDVWedgeSpherical(rh0, rh1, ph0, ph1, th0, th1);
        integralEstimate.textContent = estimate > 0 ? `Approx ∭ dV ≈ ${estimate.toFixed(3)}` : 'Volume visualization';
        fitCameraToContent();
    }

    function updatePanelsVisibility() {
        const method = methodSelect.value;
        $('boundsCartesian').hidden = method !== 'double_cartesian';
        $('equationPanel').hidden = method.startsWith('triple_');
        $('boundsPolar').hidden = method !== 'double_polar';
        $('boundsCylindrical').hidden = method !== 'triple_cylindrical';
        $('boundsSpherical').hidden = method !== 'triple_spherical';
    }

    function applyPresetBounds() {
        const preset = presetSelect.value;
        if (preset === 'cone') {
            xMin.value = -2; xMax.value = 2; yMin.value = -2; yMax.value = 2;
            rMin.value = 0; rMax.value = 2; thetaMin.value = 0; thetaMax.value = 360;
            rcMin.value = 0; rcMax.value = 2; thetacMin.value = 0; thetacMax.value = 360; zMin.value = 0; zMax.value = 3;
            rhoMin.value = 0; rhoMax.value = 3; phiMin.value = 0; phiMax.value = 90; thetasMin.value = 0; thetasMax.value = 360;
            equationInput.value = 'sqrt(x^2 + y^2)';
        } else if (preset === 'sphere') {
            xMin.value = -2.5; xMax.value = 2.5; yMin.value = -2.5; yMax.value = 2.5;
            rMin.value = 0; rMax.value = 2.5; thetaMin.value = 0; thetaMax.value = 360;
            rcMin.value = 0; rcMax.value = 2.5; thetacMin.value = 0; thetacMax.value = 360; zMin.value = -2.5; zMax.value = 2.5;
            rhoMin.value = 0; rhoMax.value = 2.5; phiMin.value = 0; phiMax.value = 180; thetasMin.value = 0; thetasMax.value = 360;
            equationInput.value = 'sqrt(max(0, 2.5^2 - x^2 - y^2))';
        } else if (preset === 'cylinder') {
            xMin.value = -2; xMax.value = 2; yMin.value = -2; yMax.value = 2;
            rMin.value = 0; rMax.value = 2; thetaMin.value = 0; thetaMax.value = 360;
            rcMin.value = 0; rcMax.value = 2; thetacMin.value = 0; thetacMax.value = 360; zMin.value = -2; zMax.value = 2;
            rhoMin.value = 0; rhoMax.value = 3; phiMin.value = 0; phiMax.value = 180; thetasMin.value = 0; thetasMax.value = 360;
            equationInput.value = 'sqrt(max(0, 2^2 - x^2 - y^2))';
        } else if (preset === 'paraboloid') {
            xMin.value = -3; xMax.value = 3; yMin.value = -3; yMax.value = 3;
            rMin.value = 0; rMax.value = 3; thetaMin.value = 0; thetaMax.value = 360;
            rcMin.value = 0; rcMax.value = 3; thetacMin.value = 0; thetacMax.value = 360; zMin.value = 0; zMax.value = 5;
            rhoMin.value = 0; rhoMax.value = 5; phiMin.value = 0; phiMax.value = 120; thetasMin.value = 0; thetasMax.value = 360;
            equationInput.value = '0.5*(x^2 + y^2)';
        }
    }

    function render() {
        const method = methodSelect.value;
        if (method === 'double_cartesian') return renderDoubleCartesian();
        if (method === 'double_polar') return renderDoublePolar();
        if (method === 'triple_cylindrical') return renderTripleCylindrical();
        if (method === 'triple_spherical') return renderTripleSpherical();
    }

    function init() {
        setupThree();
        updatePanelsVisibility();
        applyPresetBounds();
        render();

        // Events
        methodSelect.addEventListener('change', () => { updatePanelsVisibility(); render(); });
        presetSelect.addEventListener('change', () => { applyPresetBounds(); render(); });
        [equationInput, xMin, xMax, yMin, yMax, rMin, rMax, thetaMin, thetaMax, nx, ny, nz,
         rcMin, rcMax, thetacMin, thetacMax, zMin, zMax, rhoMin, rhoMax, phiMin, phiMax, thetasMin, thetasMax]
            .forEach(el => el.addEventListener('change', render));
        [showSurface, showColumns, showRegion, showWedge].forEach(el => el.addEventListener('change', render));
        renderBtn.addEventListener('click', render);
        resetCameraBtn.addEventListener('click', () => {
            camera.position.set(8, 8, 8);
            controls.target.set(0, 0, 0);
            controls.update();
        });
    }

    // Kickoff when DOM ready
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();


