// Multivariable Integration Visualizer core

(function() {
    const $ = (id) => document.getElementById(id);
    const THREE = window.THREE;

    // UI elements - captured in init() after DOM is ready
    let canvasHost, methodSelect, presetSelect, equationInput, renderBtn, resetCameraBtn;
    let showSurface, showColumns, showRegion, showWedge;
    let jacobianText, integralEstimate, compareBtn, compareResult, equationError;
    let xMin, xMax, yMin, yMax;
    let rMin, rMax, thetaMin, thetaMax;
    let rcMin, rcMax, thetacMin, thetacMax, zMin, zMax;
    let rhoMin, rhoMax, phiMin, phiMax, thetasMin, thetasMax;
    let nx, ny, nz;

    // Three.js core
    let renderer, scene, camera, controls;
    let surfaceGroup, columnsGroup, regionGroup, wedgeGroup, axesHelper, gridHelper, gridHelperNeg;
    let lastEstimate = 0;

    function captureElements() {
        // Capture all DOM elements AFTER DOM is ready
        canvasHost = $('canvas3d');
        methodSelect = $('methodSelect');
        presetSelect = $('presetSelect');
        equationInput = $('equationInput');
        renderBtn = $('renderBtn');
        resetCameraBtn = $('resetCameraBtn');
        showSurface = $('showSurface');
        showColumns = $('showColumns');
        showRegion = $('showRegion');
        showWedge = $('showWedge');
        jacobianText = $('jacobianText');
        integralEstimate = $('integralEstimate');
        compareBtn = $('compareBtn');
        compareResult = $('compareResult');
        equationError = $('equationError');
        xMin = $('xMin'); xMax = $('xMax'); yMin = $('yMin'); yMax = $('yMax');
        rMin = $('rMin'); rMax = $('rMax'); thetaMin = $('thetaMin'); thetaMax = $('thetaMax');
        rcMin = $('rcMin'); rcMax = $('rcMax'); thetacMin = $('thetacMin'); thetacMax = $('thetacMax'); zMin = $('zMin'); zMax = $('zMax');
        rhoMin = $('rhoMin'); rhoMax = $('rhoMax'); phiMin = $('phiMin'); phiMax = $('phiMax'); thetasMin = $('thetasMin'); thetasMax = $('thetasMax');
        nx = $('nx'); ny = $('ny'); nz = $('nz');
        
        console.log('Elements captured. canvasHost:', canvasHost);
    }

    function getHostSize() {
        if (!canvasHost) {
            console.error('canvasHost is null! Using fallback dimensions.');
            return { w: 800, h: 600 };
        }
        const rect = canvasHost.getBoundingClientRect();
        let w = Math.max(1, Math.floor(rect.width || canvasHost.clientWidth || 1));
        let h = Math.max(1, Math.floor(rect.height || canvasHost.clientHeight || 1));
        // Fallback when container is collapsed or dimensions invalid
        if (!isFinite(w) || !isFinite(h) || w < 50 || h < 50) {
            // Fallback if layout hasn't sized yet
            w = Math.max(300, window.innerWidth - 380);
            h = Math.max(300, window.innerHeight - 24);
        }
        if (typeof console !== 'undefined') {
            try { console.log('Canvas host size:', { w, h, rect }); } catch(e) {}
        }
        return { w, h };
    }

    function setupThree() {
        try {
            if (!THREE || !THREE.WebGLRenderer) {
                console.error('THREE.js not ready in setupThree()');
                return;
            }
            const { w, h } = getHostSize();
            const ratio = w / h;
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            // Robust color management across three versions
            if ('outputColorSpace' in renderer) {
                renderer.outputColorSpace = THREE.SRGBColorSpace;
            } else if ('outputEncoding' in renderer) {
                renderer.outputEncoding = THREE.sRGBEncoding;
            }
            renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio || 1, 1), 2));
            renderer.setSize(w, h);
            try {
                console.log('Renderer size set to:', w, h);
                console.log('Canvas element size (px):', renderer.domElement.width, renderer.domElement.height);
            } catch (e) {}
            canvasHost.innerHTML = '';
            canvasHost.appendChild(renderer.domElement);
            // Ensure pointer/touch gestures are routed to the canvas (mobile/tablet)
            renderer.domElement.style.touchAction = 'none';

            // Switch to Z-up to match z = f(x, y)
            THREE.Object3D.DEFAULT_UP.set(0, 0, 1);
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0xe9edf5);

        camera = new THREE.PerspectiveCamera(55, ratio, 0.1, 1000);
        camera.up.set(0, 0, 1);
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
            controls.enableRotate = true;
            controls.rotateSpeed = 0.9;
            controls.minPolarAngle = 0;            // allow full orbit
            controls.maxPolarAngle = Math.PI;      // allow below plane
            // Friendly defaults for mouse/touch
            controls.mouseButtons = {
                LEFT: THREE.MOUSE.ROTATE,
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: THREE.MOUSE.PAN
            };
            controls.touches = {
                ONE: THREE.TOUCH.ROTATE,
                TWO: THREE.TOUCH.DOLLY_PAN
            };
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
            // Darker grid colors for better contrast on light background
            gridHelper = new THREE.GridHelper(16, 32, 0x9aa1a7, 0xb6bdc4);
            if (gridHelper.material) {
                const m = Array.isArray(gridHelper.material) ? gridHelper.material[0] : gridHelper.material;
                m.transparent = true;
                m.opacity = 0.55;
            }
            gridHelper.rotation.x = Math.PI / 2; // place on XY at z=0 in Z-up world
            scene.add(gridHelper);
            // subtle duplicate just below plane for negative z
            gridHelperNeg = new THREE.GridHelper(16, 32, 0xc8cdd2, 0xd6dade);
            if (gridHelperNeg.material) {
                const m2 = Array.isArray(gridHelperNeg.material) ? gridHelperNeg.material[0] : gridHelperNeg.material;
                m2.transparent = true;
                m2.opacity = 0.3;
            }
            gridHelperNeg.rotation.x = Math.PI / 2;
            gridHelperNeg.position.z = -0.0006;
            scene.add(gridHelperNeg);

            // Always-visible tiny origin marker to avoid totally blank scene
            const originMarker = new THREE.AxesHelper(0.5);
            originMarker.position.set(0, 0, 0);
            scene.add(originMarker);

        surfaceGroup = new THREE.Group();
        columnsGroup = new THREE.Group();
        regionGroup = new THREE.Group();
        wedgeGroup = new THREE.Group();
        scene.add(surfaceGroup, columnsGroup, regionGroup, wedgeGroup);

            window.addEventListener('resize', onResize);
            onResize();
            installPinchZoomPolyfill();
            renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
            animate();
        } catch (err) {
            console.error('setupThree() failed:', err);
        }
    }

    function onResize() {
        if (!renderer || !camera || !scene) return;
        const { w, h } = getHostSize();
        renderer.setSize(w, h);
        camera.aspect = Math.max(1e-6, w / h);
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
    }

    function animate() {
        requestAnimationFrame(animate);
        if (controls) controls.update();
        if (renderer && scene && camera) renderer.render(scene, camera);
    }

    // Utilities
    function clearGroup(group) {
        if (!group || !group.children) return;
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
        if (!camera || !controls) {
            console.warn('fitCameraToContent called before camera/controls initialized');
            return;
        }
        const box = new THREE.Box3();
        const groups = [surfaceGroup, columnsGroup, regionGroup, wedgeGroup];
        let hasAny = false;
        for (const g of groups) {
            if (g && g.children && g.children.length) {
                box.expandByObject(g);
                hasAny = true;
            }
        }
        // If nothing is present, or box is invalid, fit to a sane default around origin
        if (!hasAny || !isFinite(box.min.x) || !isFinite(box.max.x)) {
            const d = 4;
            box.set(new THREE.Vector3(-d, -d, -d), new THREE.Vector3(d, d, d));
        }
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        const maxDim = Math.max(size.x, size.y, size.z, 1e-3);
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
        // Check if math.js is available
        if (typeof math === 'undefined' || !math.parse) {
            console.error('math.js not loaded');
            equationInput.classList.add('input-error');
            if (equationError) { equationError.style.display = 'block'; equationError.textContent = 'Math library not loaded. Please refresh the page.'; }
            // Return a dummy compiled expression that returns 0
            return { evaluate: () => 0 };
        }
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
                // Z-up world: direct mapping
                vertices.push(p.x, p.y, p.z);
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

        const mat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: Math.max(opacity, 0.45), side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geom, mat);
        // Add a crisp edge outline to make the surface visible on dark backgrounds
        const edges = new THREE.EdgesGeometry(geom);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x1f6feb }));
        const g = new THREE.Group();
        g.add(mesh);
        g.add(line);
        return g;
    }

    function addRegionRectangle(x0, x1, y0, y1) {
        if (!regionGroup) return;
        const geom = new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0));
        const mat = new THREE.MeshBasicMaterial({ color: 0x8bd450, transparent: true, opacity: 0.18, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0.001);
        regionGroup.add(mesh);

        const edges = new THREE.EdgesGeometry(geom);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x8bd450 }));
        line.position.copy(mesh.position);
        regionGroup.add(line);
    }

    function addColumnsCartesian(expr, x0, x1, y0, y1, nxp, nyp) {
        if (!columnsGroup) return 0;
        const dx = (x1 - x0) / nxp;
        const dy = (y1 - y0) / nyp;
        let estimate = 0;
        const total = nxp * nyp;
        const stride = total > 3000 ? Math.ceil(total / 3000) : 1;
        const count = Math.ceil(total / stride);
        const geom = new THREE.BoxGeometry(1, 1, 1);
        const mat = new THREE.MeshStandardMaterial({ color: 0xff7a59, transparent: true, opacity: 0.6 });
        const inst = new THREE.InstancedMesh(geom, mat, count);
        let idx = 0;
        const pos = new THREE.Vector3();
        const scale = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const mat4 = new THREE.Matrix4();
        let linear = 0;
        for (let i = 0; i < nxp; i++) {
            for (let j = 0; j < nyp; j++, linear++) {
                const xc = x0 + (i + 0.5) * dx;
                const yc = y0 + (j + 0.5) * dy;
                const h = evalFunction(expr, xc, yc);
                if (!isFinite(h)) continue;
                estimate += h * dx * dy;
                if (linear % stride !== 0) continue;
                pos.set(xc, yc, Math.sign(h) * Math.abs(h) / 2);
                scale.set(dx * 0.95, dy * 0.95, Math.max(1e-6, Math.abs(h)));
                quat.identity();
                mat4.compose(pos, quat, scale);
                inst.setMatrixAt(idx++, mat4);
            }
        }
        inst.instanceMatrix.needsUpdate = true;
        columnsGroup.add(inst);
        return estimate;
    }

    // Polar double integral visualization (sectors with Jacobian r)
    function addRegionPolar(r0, r1, t0, t1) {
        if (!regionGroup) return;
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
        shape.closePath();
        const geom = new THREE.ShapeGeometry(shape);
        const mat = new THREE.MeshBasicMaterial({ color: 0x8bd450, transparent: true, opacity: 0.18, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geom, mat);
        regionGroup.add(mesh);
        const edges = new THREE.EdgesGeometry(geom);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x8bd450 }));
        regionGroup.add(line);
    }

    function addColumnsPolar(expr, r0, r1, t0, t1, nr, nt) {
        if (!columnsGroup) return 0;
        const dr = (r1 - r0) / nr;
        const dt = (t1 - t0) / nt;
        let estimate = 0;
        const total = nr * nt;
        const stride = total > 3000 ? Math.ceil(total / 3000) : 1;
        const count = Math.ceil(total / stride);
        const geom = new THREE.BoxGeometry(1, 1, 1);
        const mat = new THREE.MeshStandardMaterial({ color: 0xff7a59, transparent: true, opacity: 0.6 });
        const inst = new THREE.InstancedMesh(geom, mat, count);
        const pos = new THREE.Vector3();
        const scale = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const mat4 = new THREE.Matrix4();
        let idx = 0;
        let linear = 0;
        for (let i = 0; i < nr; i++) {
            for (let j = 0; j < nt; j++, linear++) {
                const rc = r0 + (i + 0.5) * dr;
                const tc = t0 + (j + 0.5) * dt;
                const x = rc * Math.cos(tc);
                const y = rc * Math.sin(tc);
                const h = evalFunction(expr, x, y);
                if (!isFinite(h)) continue;
                const area = rc * dr * dt;
                estimate += h * area;
                if (linear % stride !== 0) continue;
                pos.set(x, y, Math.sign(h) * Math.abs(h) / 2);
                scale.set(dr * 0.9, rc * dt * 0.9, Math.max(1e-6, Math.abs(h)));
                quat.setFromAxisAngle(new THREE.Vector3(0, 0, 1), tc);
                mat4.compose(pos, quat, scale);
                inst.setMatrixAt(idx++, mat4);
            }
        }
        inst.instanceMatrix.needsUpdate = true;
        columnsGroup.add(inst);
        return estimate;
    }

    // (old addVolumePreset removed; replaced below with Z-up version)

    function addDVWedgeCylindrical(r0, r1, t0, t1, z0, z1) {
        if (!wedgeGroup) return;
        // Show a representative small rectangular box for dV = r dr dθ dz at some center
        const rc = (r0 + r1) / 2;
        const tc = (t0 + t1) / 2;
        const zc = (z0 + z1) / 2;
        const dr = Math.max((r1 - r0) / 12, 0.05);
        const dt = Math.max((t1 - t0) / 12, deg2rad(3));
        const dz = Math.max((z1 - z0) / 12, 0.05);

        const geom = new THREE.BoxGeometry(dr, rc * dt, dz);
        const mat = new THREE.MeshStandardMaterial({ color: 0xff3b7f, transparent: true, opacity: 0.6 });
        const box = new THREE.Mesh(geom, mat);
        const x = rc * Math.cos(tc);
        const y = rc * Math.sin(tc);
        box.position.set(x, y, zc);
        // rotate around z (up) to align wedge tangentially
        box.rotation.z = tc;
        wedgeGroup.add(box);
    }

    function addDVWedgeSpherical(rho0, rho1, phi0, phi1, theta0, theta1) {
        if (!wedgeGroup) return;
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
        box.position.set(x, y, z);
        // orient with spherical local basis
        const eR = new THREE.Vector3(Math.sin(phic) * Math.cos(thetac), Math.sin(phic) * Math.sin(thetac), Math.cos(phic));
        const ePhi = new THREE.Vector3(Math.cos(phic) * Math.cos(thetac), Math.cos(phic) * Math.sin(thetac), -Math.sin(phic));
        const eTheta = new THREE.Vector3(-Math.sin(thetac), Math.cos(thetac), 0);
        const basis = new THREE.Matrix4().makeBasis(eR, ePhi, eTheta);
        box.quaternion.setFromRotationMatrix(basis);
        wedgeGroup.add(box);
    }

    // Bounds-deduced dimensions for stock volumes (keeps meshes and clipping consistent)
    function getCurrentPresetDims() {
        const preset = presetSelect.value;
        if (preset === 'sphere') {
            const R = parseFloat(rhoMax?.value) || parseFloat(rcMax?.value) || parseFloat(rMax?.value) || 2.5;
            return { type: 'sphere', R };
        }
        if (preset === 'cylinder') {
            const R = parseFloat(rcMax?.value) || parseFloat(rMax?.value) || 2;
            const H = Math.abs((parseFloat(zMax?.value) || 2) - (parseFloat(zMin?.value) || -2)) || 4;
            return { type: 'cylinder', R, H };
        }
        if (preset === 'cone') {
            const R = parseFloat(rcMax?.value) || 1.5;
            const H = Math.abs((parseFloat(zMax?.value) || 3) - (parseFloat(zMin?.value) || 0)) || 3;
            return { type: 'cone', R, H };
        }
        if (preset === 'paraboloid') {
            const H = Math.abs((parseFloat(zMax?.value) || 3) - Math.max(0, parseFloat(zMin?.value) || 0)) || 3;
            return { type: 'paraboloid', H };
        }
        return { type: 'none' };
    }

    function createInsideTesterForPreset() {
        const dims = getCurrentPresetDims();
        if (dims.type === 'sphere') {
            const R2 = dims.R * dims.R;
            return (x, y, z) => (x*x + y*y + z*z) <= R2 + 1e-6;
        }
        if (dims.type === 'cylinder') {
            const R2 = dims.R * dims.R; const half = dims.H / 2;
            return (x, y, z) => (x*x + y*y) <= R2 + 1e-6 && z >= -half - 1e-6 && z <= half + 1e-6;
        }
        if (dims.type === 'cone') {
            const half = dims.H / 2; const R = dims.R;
            return (x, y, z) => {
                if (z < -half - 1e-6 || z > half + 1e-6) return false;
                const r = Math.hypot(x, y);
                const allowed = R * (half - z) / dims.H; // 0 at top, R at base
                return r <= allowed + 1e-6;
            };
        }
        if (dims.type === 'paraboloid') {
            const H = dims.H; const half = H / 2;
            // Paraboloid cup: 0 <= y' <= H with r^2 <= 2 y'
            return (x, y, z) => {
                const zp = z + half; if (zp < -1e-6 || zp > H + 1e-6) return false; // between -half..H
                return (x*x + y*y) <= 2 * Math.max(0, zp) + 1e-6;
            };
        }
        return () => true;
    }

    // Triple integral bricks/voxels for numeric estimate and visualization
    function addVoxelsCylindrical(r0, r1, t0, t1, z0, z1, nr, nt, nz) {
        const dr = (r1 - r0) / nr;
        const dt = (t1 - t0) / nt;
        const dz = (z1 - z0) / nz;
        const mat = new THREE.MeshStandardMaterial({ color: 0xff7a59, transparent: true, opacity: 0.45 });
        let volume = 0;
        const maxCells = 3500; // guard performance
        const totalCells = nr * nt * nz;
        const stride = totalCells > maxCells ? Math.ceil(totalCells / maxCells) : 1;
        const count = Math.ceil(totalCells / stride);
        const inside = createInsideTesterForPreset();
        const geom = new THREE.BoxGeometry(1, 1, 1);
        const inst = new THREE.InstancedMesh(geom, mat, count);
        const pos = new THREE.Vector3();
        const scale = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const mat4 = new THREE.Matrix4();
        let write = 0;
        let idx = 0;
        for (let i = 0; i < nr; i++) {
            const rc = r0 + (i + 0.5) * dr;
            const boxR = dr * 0.98;
            const tangential = Math.max(rc * dt * 0.98, 0.001);
            for (let j = 0; j < nt; j++) {
                const tc = t0 + (j + 0.5) * dt;
                const x = rc * Math.cos(tc);
                const y = rc * Math.sin(tc);
                for (let k = 0; k < nz; k++, idx++) {
                    if (stride > 1 && (idx % stride) !== 0) continue;
                    const zc = z0 + (k + 0.5) * dz;
                    if (!inside(x, y, zc)) continue;
                    pos.set(x, y, zc);
                    scale.set(boxR, tangential, dz * 0.98);
                    quat.setFromAxisAngle(new THREE.Vector3(0, 0, 1), tc);
                    mat4.compose(pos, quat, scale);
                    inst.setMatrixAt(write++, mat4);
                }
                // Sum full contribution (not downsampled)
                for (let k = 0; k < nz; k++) {
                    const zc = z0 + (k + 0.5) * dz;
                    if (inside(x, y, zc)) volume += rc * dr * dt * dz;
                }
            }
        }
        inst.instanceMatrix.needsUpdate = true;
        columnsGroup.add(inst);
        return volume;
    }

    function addVoxelsSpherical(rh0, rh1, ph0, ph1, th0, th1, nr, nphi, nth) {
        const dr = (rh1 - rh0) / nr;
        const dphi = (ph1 - ph0) / nphi;
        const dtheta = (th1 - th0) / nth;
        const mat = new THREE.MeshStandardMaterial({ color: 0xff7a59, transparent: true, opacity: 0.45 });
        let volume = 0;
        const maxCells = 3500;
        const totalCells = nr * nphi * nth;
        const stride = totalCells > maxCells ? Math.ceil(totalCells / maxCells) : 1;
        const count = Math.ceil(totalCells / stride);
        const inside = createInsideTesterForPreset();
        const geom = new THREE.BoxGeometry(1, 1, 1);
        const inst = new THREE.InstancedMesh(geom, mat, count);
        const pos = new THREE.Vector3();
        const scale = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const mat4 = new THREE.Matrix4();
        let write = 0;
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
                    const y = rhoc * Math.sin(phic) * Math.sin(thetac);
                    const z = rhoc * Math.cos(phic);
                    if (!inside(x, y, z)) continue;
                    pos.set(x, y, z);
                    scale.set(radial, tangential1, tangential2);
                    const eR = new THREE.Vector3(Math.sin(phic) * Math.cos(thetac), Math.sin(phic) * Math.sin(thetac), Math.cos(phic));
                    const ePhi = new THREE.Vector3(Math.cos(phic) * Math.cos(thetac), Math.cos(phic) * Math.sin(thetac), -Math.sin(phic));
                    const eTheta = new THREE.Vector3(-Math.sin(thetac), Math.cos(thetac), 0);
                    const basis = new THREE.Matrix4().makeBasis(eR, ePhi, eTheta);
                    quat.setFromRotationMatrix(basis);
                    mat4.compose(pos, quat, scale);
                    inst.setMatrixAt(write++, mat4);
                }
                for (let k = 0; k < nth; k++) {
                    const thetac = th0 + (k + 0.5) * dtheta;
                    const x = rhoc * Math.sin(phic) * Math.cos(thetac);
                    const y = rhoc * Math.sin(phic) * Math.sin(thetac);
                    const z = rhoc * Math.cos(phic);
                    if (inside(x, y, z)) volume += (rhoc * rhoc) * Math.sin(phic) * dr * dphi * dtheta;
                }
            }
        }
        inst.instanceMatrix.needsUpdate = true;
        columnsGroup.add(inst);
        return volume;
    }

    // Closed solid meshes for presets (dimensions from bounds)
    function addVolumePreset(preset) {
        const dims = getCurrentPresetDims();
        const group = new THREE.Group();
        let mesh;
        if (dims.type === 'sphere') {
            const geom = new THREE.SphereGeometry(dims.R, 64, 48);
            const mat = new THREE.MeshStandardMaterial({ color: 0x4cc3ff, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
            mesh = new THREE.Mesh(geom, mat);
        } else if (dims.type === 'cylinder') {
            const geom = new THREE.CylinderGeometry(dims.R, dims.R, dims.H, 64, 1, false);
            const mat = new THREE.MeshStandardMaterial({ color: 0x4cc3ff, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
            mesh = new THREE.Mesh(geom, mat);
            // orient along Z
            mesh.rotation.x = Math.PI / 2;
        } else if (dims.type === 'cone') {
            const geom = new THREE.ConeGeometry(dims.R, dims.H, 64, 1, false);
            const mat = new THREE.MeshStandardMaterial({ color: 0x4cc3ff, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
            mesh = new THREE.Mesh(geom, mat);
            mesh.rotation.x = Math.PI / 2; // orient along Z
        } else if (dims.type === 'paraboloid') {
            const H = dims.H; const half = H / 2; const steps = 200;
            const pts = [];
            for (let i = 0; i <= steps; i++) {
                const y = (i / steps) * H;          // 0..H
                const r = Math.sqrt(Math.max(0, 2 * y));
                pts.push(new THREE.Vector2(r, y - half));
            }
            const geom = new THREE.LatheGeometry(pts, 128, 0, Math.PI * 2);
            const mat = new THREE.MeshStandardMaterial({ color: 0x4cc3ff, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
            const body = new THREE.Mesh(geom, mat);
            body.rotation.x = Math.PI / 2; // orient along Z
            group.add(body);
            // Add a flat cap at top (y = +half) to close the volume
            const rTop = Math.sqrt(2 * H);
            const capGeom = new THREE.CircleGeometry(rTop, 96);
            const capMat = new THREE.MeshStandardMaterial({ color: 0x4cc3ff, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
            const cap = new THREE.Mesh(capGeom, capMat);
            cap.rotation.z = 0;
            cap.position.set(0, 0, half);
            group.add(cap);
        }
        if (mesh) group.add(mesh);
        if (group.children.length) surfaceGroup.add(group);
    }

    // Trackpad/pinch support for Safari/iOS (maps gesture events to camera dolly)
    function installPinchZoomPolyfill() {
        const el = renderer?.domElement; if (!el) return;
        let lastScale = 1;
        const dolly = (factor) => {
            const offset = new THREE.Vector3();
            offset.copy(camera.position).sub(controls.target);
            offset.multiplyScalar(factor);
            camera.position.copy(controls.target.clone().add(offset));
            controls.update();
        };
        const onStart = (e) => { e.preventDefault(); lastScale = e.scale || 1; };
        const onChange = (e) => {
            e.preventDefault();
            const scale = e.scale || 1; const delta = scale - lastScale;
            if (Math.abs(delta) > 0.003) dolly(delta > 0 ? 0.92 : 1.08);
            lastScale = scale;
        };
        el.addEventListener('gesturestart', onStart, { passive: false });
        el.addEventListener('gesturechange', onChange, { passive: false });
    }

    // Renderers per method
    function renderDoubleCartesian() {
        if (!xMin || !xMax || !yMin || !yMax || !nx || !ny) {
            console.error('Input elements not available in renderDoubleCartesian');
            return;
        }
        const x0 = parseFloat(xMin.value), x1 = parseFloat(xMax.value);
        const y0 = parseFloat(yMin.value), y1 = parseFloat(yMax.value);
        const nxp = Math.max(2, parseInt(nx.value) || 12);
        const nyp = Math.max(2, parseInt(ny.value) || 12);
        
        // Validate parsed values
        if (!isFinite(x0) || !isFinite(x1) || !isFinite(y0) || !isFinite(y1)) {
            console.error('Invalid bounds in renderDoubleCartesian');
            return;
        }
        
        if (jacobianText) jacobianText.textContent = 'dA = dx dy';
        clearGroup(surfaceGroup); clearGroup(columnsGroup); clearGroup(regionGroup); clearGroup(wedgeGroup);
        const compiled = tryCompileEquation();
        if (showSurface && showSurface.checked && surfaceGroup) {
            const surf = buildSurfaceFromFunction(compiled, x0, x1, y0, y1, 64, 64);
            if (surf) surfaceGroup.add(surf);
        }
        if (showRegion && showRegion.checked) addRegionRectangle(x0, x1, y0, y1);
        let estimate = 0;
        if (showColumns && showColumns.checked) {
            estimate = addColumnsCartesian(compiled, x0, x1, y0, y1, nxp, nyp);
        }
        if (showWedge && showWedge.checked && wedgeGroup) {
            // representative dA rectangle on XY plane (Z-up)
            const dx = (x1 - x0) / nxp, dy = (y1 - y0) / nyp;
            const geom = new THREE.BoxGeometry(dx, dy, 0.02);
            const mat = new THREE.MeshStandardMaterial({ color: 0xff3b7f, transparent: true, opacity: 0.8 });
            const box = new THREE.Mesh(geom, mat);
            box.position.set(x0 + dx / 2, y0 + dy / 2, 0.01);
            wedgeGroup.add(box);
        }
        lastEstimate = estimate;
        if (integralEstimate) integralEstimate.textContent = `Approx ∬ f dA ≈ ${estimate.toFixed(3)}`;
        fitCameraToContent();
    }

    function renderDoublePolar() {
        if (!rMin || !rMax || !thetaMin || !thetaMax || !nx || !ny) {
            console.error('Input elements not available in renderDoublePolar');
            return;
        }
        const r0 = parseFloat(rMin.value), r1 = parseFloat(rMax.value);
        const t0 = deg2rad(parseFloat(thetaMin.value)), t1 = deg2rad(parseFloat(thetaMax.value));
        const nr = Math.max(2, parseInt(nx.value) || 12);
        const nt = Math.max(2, parseInt(ny.value) || 12);
        if (jacobianText) jacobianText.textContent = 'In polar: dA = r dr dθ';
        clearGroup(surfaceGroup); clearGroup(columnsGroup); clearGroup(regionGroup); clearGroup(wedgeGroup);
        const expr = tryCompileEquation();
        // Guard degenerate bounds; if invalid, render a default surface around origin
        const degenerateBounds = !(isFinite(r0) && isFinite(r1) && (r1 > r0 + 1e-6));
        if (degenerateBounds) {
            console.warn('Polar bounds degenerate; using default surface in [-3,3]^2');
            if (showSurface && showSurface.checked && surfaceGroup) {
                const x0 = -3, x1 = 3, y0 = -3, y1 = 3;
                const surf = buildSurfaceFromFunction(expr, x0, x1, y0, y1, 64, 64);
                if (surf) surfaceGroup.add(surf);
            }
            fitCameraToContent();
            return;
        }
        if (showRegion && showRegion.checked) addRegionPolar(r0, r1, t0, t1);
        if (showSurface && showSurface.checked && surfaceGroup) {
            // sample surface over the bounding rectangle in xy
            const x0 = -r1, x1 = r1, y0 = -r1, y1 = r1;
            const surf = buildSurfaceFromFunction(expr, x0, x1, y0, y1, 64, 64);
            if (surf) surfaceGroup.add(surf);
        }
        let estimate = 0;
        if (showColumns && showColumns.checked) {
            estimate = addColumnsPolar(expr, r0, r1, t0, t1, nr, nt);
        }
        if (showWedge && showWedge.checked && wedgeGroup) {
            const rc = (r0 + r1) / 2; const dt = (t1 - t0) / nt; const dr = (r1 - r0) / nr;
            const geom = new THREE.BoxGeometry(dr, Math.max(0.001, rc * dt), 0.02);
            const mat = new THREE.MeshStandardMaterial({ color: 0xff3b7f, transparent: true, opacity: 0.8 });
            const box = new THREE.Mesh(geom, mat);
            const tc = t0 + dt / 2;
            box.position.set(rc * Math.cos(tc), rc * Math.sin(tc), 0.01);
            box.rotation.z = tc;
            wedgeGroup.add(box);
        }
        lastEstimate = estimate;
        if (integralEstimate) integralEstimate.textContent = `Approx ∬ f dA ≈ ${estimate.toFixed(3)}`;
        fitCameraToContent();
    }

    function renderTripleCylindrical() {
        if (!rcMin || !rcMax || !thetacMin || !thetacMax || !zMin || !zMax || !nx || !ny || !nz) {
            console.error('Input elements not available in renderTripleCylindrical');
            return;
        }
        const r0 = parseFloat(rcMin.value), r1 = parseFloat(rcMax.value);
        const t0 = deg2rad(parseFloat(thetacMin.value)), t1 = deg2rad(parseFloat(thetacMax.value));
        const z0 = parseFloat(zMin.value), z1 = parseFloat(zMax.value);
        
        if (!isFinite(r0) || !isFinite(r1) || !isFinite(t0) || !isFinite(t1) || !isFinite(z0) || !isFinite(z1)) {
            console.error('Invalid bounds in renderTripleCylindrical');
            return;
        }
        
        if (jacobianText) jacobianText.textContent = 'In cylindrical: dV = r dr dθ dz';
        clearGroup(surfaceGroup); clearGroup(columnsGroup); clearGroup(regionGroup); clearGroup(wedgeGroup);
        const preset = presetSelect ? presetSelect.value : 'none';
        if (showSurface && showSurface.checked && preset !== 'none') addVolumePreset(preset);
        if (showRegion && showRegion.checked) addRegionPolar(r0, r1, t0, t1);
        let estimate = 0;
        if (showColumns && showColumns.checked) {
            const nr = Math.max(2, parseInt(nx.value) || 12);
            const nt = Math.max(2, parseInt(ny.value) || 12);
            const nzp = Math.max(1, parseInt(nz.value) || 8);
            estimate = addVoxelsCylindrical(r0, r1, t0, t1, z0, z1, nr, nt, nzp);
        }
        if (showWedge && showWedge.checked) addDVWedgeCylindrical(r0, r1, t0, t1, z0, z1);
        lastEstimate = estimate;
        if (integralEstimate) integralEstimate.textContent = estimate > 0 ? `Approx ∭ dV ≈ ${estimate.toFixed(3)}` : 'Volume visualization';
        fitCameraToContent();
    }

    function renderTripleSpherical() {
        if (!rhoMin || !rhoMax || !phiMin || !phiMax || !thetasMin || !thetasMax || !nx || !ny || !nz) {
            console.error('Input elements not available in renderTripleSpherical');
            return;
        }
        const rh0 = parseFloat(rhoMin.value), rh1 = parseFloat(rhoMax.value);
        const ph0 = deg2rad(parseFloat(phiMin.value)), ph1 = deg2rad(parseFloat(phiMax.value));
        const th0 = deg2rad(parseFloat(thetasMin.value)), th1 = deg2rad(parseFloat(thetasMax.value));
        
        if (!isFinite(rh0) || !isFinite(rh1) || !isFinite(ph0) || !isFinite(ph1) || !isFinite(th0) || !isFinite(th1)) {
            console.error('Invalid bounds in renderTripleSpherical');
            return;
        }
        
        if (jacobianText) jacobianText.textContent = 'In spherical: dV = ρ² sinφ dρ dφ dθ';
        clearGroup(surfaceGroup); clearGroup(columnsGroup); clearGroup(regionGroup); clearGroup(wedgeGroup);
        const preset = presetSelect ? presetSelect.value : 'none';
        if (showSurface && showSurface.checked && preset !== 'none') addVolumePreset(preset);
        if (showRegion && showRegion.checked) {
            // approximate spherical sector by showing its projection ring
            addRegionPolar(0, rh1 * Math.sin((ph0 + ph1) / 2), th0, th1);
        }
        let estimate = 0;
        if (showColumns && showColumns.checked) {
            const nr = Math.max(2, parseInt(nx.value) || 12);
            const nphi = Math.max(2, parseInt(ny.value) || 12);
            const nth = Math.max(2, parseInt(nz.value) || 8);
            estimate = addVoxelsSpherical(rh0, rh1, ph0, ph1, th0, th1, nr, nphi, nth);
        }
        if (showWedge && showWedge.checked) addDVWedgeSpherical(rh0, rh1, ph0, ph1, th0, th1);
        lastEstimate = estimate;
        if (integralEstimate) integralEstimate.textContent = estimate > 0 ? `Approx ∭ dV ≈ ${estimate.toFixed(3)}` : 'Volume visualization';
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
            rcMin.value = 0; rcMax.value = 2; thetacMin.value = 0; thetacMax.value = 360; zMin.value = -1.5; zMax.value = 1.5;
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
            rcMin.value = 0; rcMax.value = 3; thetacMin.value = 0; thetacMax.value = 360; zMin.value = -2.5; zMax.value = 2.5;
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

    function ensureSomethingVisible() {
        if (!surfaceGroup || !columnsGroup || !regionGroup || !wedgeGroup) {
            console.error('Groups not initialized in ensureSomethingVisible');
            return;
        }
        const totalChildren = surfaceGroup.children.length + columnsGroup.children.length + regionGroup.children.length + wedgeGroup.children.length;
        if (totalChildren === 0) {
            // Add a simple fallback plane so the user sees something
            const plane = new THREE.Mesh(
                new THREE.PlaneGeometry(6, 6),
                new THREE.MeshBasicMaterial({ color: 0x99c1ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
            );
            // PlaneGeometry is already in XY plane in Z-up world, no rotation needed
            surfaceGroup.add(plane);
            console.warn('No visible content produced by render(); added fallback plane.');
        }
        console.log('Group sizes → surface:', surfaceGroup.children.length, 'columns:', columnsGroup.children.length, 'region:', regionGroup.children.length, 'wedge:', wedgeGroup.children.length);
        fitCameraToContent();
    }

    function init() {
        captureElements();  // Capture DOM elements first
        
        // Verify THREE.js is loaded
        if (!THREE || !THREE.WebGLRenderer) {
            console.error('THREE.js not available in init()');
            if (canvasHost) {
                canvasHost.innerHTML = '<div style="padding:20px;color:#c8102e;font-family:sans-serif;">Error: THREE.js library failed to load. Please refresh the page.</div>';
            }
            return;
        }
        
        // Verify math.js is loaded
        if (typeof math === 'undefined' || !math.parse) {
            console.error('math.js not available in init()');
            if (canvasHost) {
                canvasHost.innerHTML = '<div style="padding:20px;color:#c8102e;font-family:sans-serif;">Error: Math.js library failed to load. Please refresh the page.</div>';
            }
            return;
        }
        
        setupThree();
        
        // Verify setupThree succeeded
        if (!renderer || !scene || !camera) {
            console.error('setupThree() failed to initialize properly');
            if (canvasHost) {
                canvasHost.innerHTML = '<div style="padding:20px;color:#c8102e;font-family:sans-serif;">Error: WebGL initialization failed. Your browser may not support WebGL.</div>';
            }
            return;
        }
        
        updatePanelsVisibility();
        applyPresetBounds();
        render();
        ensureSomethingVisible();

        // Events
        methodSelect.addEventListener('change', () => { updatePanelsVisibility(); render(); ensureSomethingVisible(); });
        presetSelect.addEventListener('change', () => { applyPresetBounds(); render(); ensureSomethingVisible(); });
        [equationInput, xMin, xMax, yMin, yMax, rMin, rMax, thetaMin, thetaMax, nx, ny, nz,
         rcMin, rcMax, thetacMin, thetacMax, zMin, zMax, rhoMin, rhoMax, phiMin, phiMax, thetasMin, thetasMax]
            .forEach(el => el.addEventListener('change', () => { render(); ensureSomethingVisible(); }));
        [showSurface, showColumns, showRegion, showWedge].forEach(el => el.addEventListener('change', () => { render(); ensureSomethingVisible(); }));
        renderBtn.addEventListener('click', () => { render(); ensureSomethingVisible(); });
        resetCameraBtn.addEventListener('click', () => {
            fitCameraToContent();
        });
        if (compareBtn) {
            compareBtn.addEventListener('click', () => {
                const method = methodSelect.value;
                const dims = getCurrentPresetDims();
                const exact = analyticVolumeForPreset(dims);
                const anglesFull = (
                    parseFloat((phiMin?.value||0)) === 0 && parseFloat((phiMax?.value||180)) === 180 &&
                    parseFloat((thetasMin?.value||0)) === 0 && parseFloat((thetasMax?.value||360)) === 360
                );
                if (!exact || !(method === 'triple_cylindrical' || (method === 'triple_spherical' && anglesFull))) {
                    if (compareResult) compareResult.textContent = 'Select a stock solid in a triple mode (full angles for spherical).';
                    return;
                }
                const rel = Math.abs(lastEstimate - exact) / exact;
                if (compareResult) compareResult.textContent = `Exact ≈ ${exact.toFixed(3)}; error ${(rel*100).toFixed(2)}%`;
            });
        }
    }

    // Kickoff when DOM ready (THREE is guaranteed loaded by the ESM bridge)
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
    function analyticVolumeForPreset(dims) {
        if (!dims || dims.type === 'none') return null;
        if (dims.type === 'sphere') return (4/3) * Math.PI * Math.pow(dims.R, 3);
        if (dims.type === 'cylinder') return Math.PI * dims.R * dims.R * dims.H;
        if (dims.type === 'cone') return (1/3) * Math.PI * dims.R * dims.R * dims.H;
        return null;
    }

})();


