// Main application with Three.js for 3D (with WASD controls) and Plotly for graphs
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Plotly from 'plotly.js-dist-min';

// Physics constants
const EPSILON_0 = 8.854e-12;
const K = 1 / (4 * Math.PI * EPSILON_0);

// Performance settings - auto-detected
let performanceMode = false;
let lastUpdateTime = 0;
const UPDATE_THROTTLE = 16; // ms (60 fps max)

// Auto-detect device performance
function detectPerformanceMode() {
  // Check for mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Check for low-end device indicators
  const cores = navigator.hardwareConcurrency || 2;
  const memory = navigator.deviceMemory || 4; // GB
  
  // Enable performance mode if:
  // - Mobile device, OR
  // - Fewer than 4 CPU cores, OR
  // - Less than 4GB RAM
  if (isMobile || cores < 4 || memory < 4) {
    performanceMode = true;
    console.log(`Performance mode AUTO-ENABLED: Mobile=${isMobile}, Cores=${cores}, RAM=${memory}GB`);
  } else {
    console.log(`Performance mode disabled: Cores=${cores}, RAM=${memory}GB`);
  }
}

// Throttle function for slider updates
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Unit conversions
const nanoCoulombToCoulomb = (nC) => nC * 1e-9;
const cmToM = (cm) => cm * 1e-2;

// Physics calculations - magnitude only (always positive for graphs)
const E_sphere_outside = (Q_C, r_m) => Math.abs(K * Q_C / (r_m * r_m));
const E_sphere_inside = () => 0;
const E_sphere_insulator = (Q_C, R_m, r_m) => Math.abs(K * Q_C * r_m / (R_m * R_m * R_m));
const E_cylinder_outside = (lambda_Cm, r_m) => Math.abs(lambda_Cm / (2 * Math.PI * EPSILON_0 * r_m));
const E_cylinder_inside = () => 0;
const E_cylinder_insulator = (lambda_Cm, a_m, r_m) => Math.abs(lambda_Cm * r_m / (2 * Math.PI * EPSILON_0 * a_m * a_m));
const E_plane_single = (sigma_Cm2) => Math.abs(sigma_Cm2 / (2 * EPSILON_0));
const E_plane_double = (sigma_Cm2) => Math.abs(sigma_Cm2 / EPSILON_0);

// Format numbers
function formatNumber(v) {
  if (!isFinite(v)) return '—';
  if (v === 0) return '0';
  if (Math.abs(v) >= 1000) return v.toExponential(2);
  if (Math.abs(v) >= 1) return v.toFixed(2);
  if (Math.abs(v) >= 0.001) return v.toFixed(4);
  return v.toExponential(2);
}

// Check which section is most centered in viewport
function getActiveSection() {
  const sphereSection = document.querySelector('.panel:nth-of-type(2)');
  const cylinderSection = document.querySelector('.panel:nth-of-type(3)');
  
  const getCenter = (el) => {
    const rect = el.getBoundingClientRect();
    const viewportCenter = window.innerHeight / 2;
    const elementCenter = rect.top + rect.height / 2;
    return Math.abs(viewportCenter - elementCenter);
  };
  
  const sphereDist = getCenter(sphereSection);
  const cylinderDist = getCenter(cylinderSection);
  
  return sphereDist < cylinderDist ? 'sphere' : 'cylinder';
}

// Three.js Scene Manager
class Scene3D {
  constructor(containerId, onReset) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.01, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.controls = null;
    this.objects = [];
    this.arrows = []; // E-field and dA vectors
    this.keys = {};
    this.resetCallback = onReset;
    this.defaultCameraPos = null;
    this.defaultTarget = null;
    this.isActive = false; // Track if this scene is currently being controlled
    
    this.init();
  }

  init() {
    // Renderer setup with perfect square aspect
    const rect = this.container.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    this.renderer.setSize(size, size);
    // Reduce pixel ratio in performance mode
    const maxPixelRatio = performanceMode ? 1 : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    this.renderer.setClearColor(0xf4f6f8, 1);
    this.container.appendChild(this.renderer.domElement);

    // Camera - better starting positions
    const isSphere = this.containerId.includes('sphere');
    const cameraDistance = isSphere ? 0.25 : 0.35;
    const camPos = isSphere 
      ? new THREE.Vector3(cameraDistance * 1.3, cameraDistance * 0.7, cameraDistance * 1.1)
      : new THREE.Vector3(0, cameraDistance * 1.2, cameraDistance * 0.4); // Side view for cylinder
    
    this.camera.position.copy(camPos);
    this.camera.lookAt(0, 0, 0);
    this.defaultCameraPos = camPos.clone();
    this.defaultTarget = new THREE.Vector3(0, 0, 0);

    // Lights (fewer in performance mode)
    const ambient = new THREE.AmbientLight(0xffffff, performanceMode ? 0.9 : 0.8);
    this.scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, performanceMode ? 0.5 : 0.6);
    directional.position.set(5, 5, 5);
    this.scene.add(directional);
    
    if (!performanceMode) {
      // Additional lights only in normal mode
      const directional2 = new THREE.DirectionalLight(0xffffff, 0.4);
      directional2.position.set(-5, -3, -5);
      this.scene.add(directional2);
      const fillLight = new THREE.DirectionalLight(0xffffff, 0.2);
      fillLight.position.set(0, -5, 0);
      this.scene.add(fillLight);
    }

    // Add 3D grid and axes (simplified in performance mode)
    const gridSize = 1;
    const gridDivisions = performanceMode ? 5 : 10;
    const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0xcccccc, 0xe0e0e0);
    gridHelper.position.y = -gridSize / 2;
    this.scene.add(gridHelper);
    
    const axesHelper = new THREE.AxesHelper(gridSize * 0.6);
    this.scene.add(axesHelper);

    // OrbitControls with reduced sensitivity
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = true;
    this.controls.panSpeed = 0.5;
    this.controls.enableZoom = true;
    this.controls.zoomSpeed = 0.6;
    this.controls.rotateSpeed = 0.4;
    this.controls.minDistance = 0.1;
    this.controls.maxDistance = 20;

    // Keyboard controls
    this.setupKeyboardControls();
    this.setupMouseTracking();
    this.setupTouchControls();
    this.setupMobileButtons();
    this.animate();
  }

  setupKeyboardControls() {
    window.addEventListener('keydown', (e) => {
      if (this.isActive) {
        this.keys[e.key.toLowerCase()] = true;
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });
  }

  setupMouseTracking() {
    // Track when mouse enters/leaves the canvas
    this.container.addEventListener('mouseenter', () => {
      this.isActive = true;
    });
    this.container.addEventListener('mouseleave', () => {
      this.isActive = false;
      // Clear all keys when leaving
      this.keys = {};
    });
    
    // Disable controls when not active
    this.renderer.domElement.addEventListener('mousedown', (e) => {
      this.isActive = true;
    });
  }

  setupTouchControls() {
    // Enable touch controls for mobile devices
    this.renderer.domElement.addEventListener('touchstart', () => {
      this.isActive = true;
    });
    
    // Touch gestures are handled by OrbitControls automatically
    this.controls.enableTouchRotate = true;
    this.controls.enableTouchPan = true;
    this.controls.enableTouchZoom = true;
  }

  setupMobileButtons() {
    // Find mobile control buttons for this viewer
    const mobileControls = this.container.parentElement.querySelector('.mobile-controls');
    if (!mobileControls) return;

    const buttons = mobileControls.querySelectorAll('.mobile-btn');
    buttons.forEach(btn => {
      const key = btn.getAttribute('data-key');
      
      // Handle touch start (button press)
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.isActive = true;
        this.keys[key] = true;
      });
      
      // Handle touch end (button release)
      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.keys[key] = false;
      });
      
      // Handle touch cancel (user drags off button)
      btn.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        this.keys[key] = false;
      });
      
      // Also support mouse for testing on desktop
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.isActive = true;
        this.keys[key] = true;
      });
      
      btn.addEventListener('mouseup', (e) => {
        e.preventDefault();
        this.keys[key] = false;
      });
      
      btn.addEventListener('mouseleave', (e) => {
        this.keys[key] = false;
      });
    });
  }

  updateCameraFromKeys() {
    // Only update if this scene is active
    if (!this.isActive) return;
    
    const speed = 0.04; // Further reduced sensitivity
    const direction = new THREE.Vector3();
    const right = new THREE.Vector3();

    this.camera.getWorldDirection(direction);
    right.crossVectors(this.camera.up, direction).normalize();

    // WASD movement (W = forward, S = backward, A = left, D = right)
    if (this.keys['w']) {
      this.camera.position.addScaledVector(direction, speed);
      this.controls.target.addScaledVector(direction, speed);
    }
    if (this.keys['s']) {
      this.camera.position.addScaledVector(direction, -speed);
      this.controls.target.addScaledVector(direction, -speed);
    }
    if (this.keys['a']) {
      this.camera.position.addScaledVector(right, speed);
      this.controls.target.addScaledVector(right, speed);
    }
    if (this.keys['d']) {
      this.camera.position.addScaledVector(right, -speed);
      this.controls.target.addScaledVector(right, -speed);
    }
    if (this.keys['q']) {
      this.camera.position.y += speed;
      this.controls.target.y += speed;
    }
    if (this.keys['e']) {
      this.camera.position.y -= speed;
      this.controls.target.y -= speed;
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    
    // Frame rate limiting in performance mode
    if (performanceMode) {
      const now = Date.now();
      const delta = now - (this.lastFrameTime || 0);
      if (delta < 33) return; // Limit to ~30 FPS in performance mode
      this.lastFrameTime = now;
    }
    
    this.updateCameraFromKeys();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  clear() {
    this.objects.forEach(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
      this.scene.remove(obj);
    });
    this.objects = [];
    
    this.arrows.forEach(arrow => this.scene.remove(arrow));
    this.arrows = [];
  }

  addObject(mesh) {
    this.scene.add(mesh);
    this.objects.push(mesh);
  }
  
  addArrow(arrow) {
    this.scene.add(arrow);
    this.arrows.push(arrow);
  }

  resetCamera() {
    if (this.defaultCameraPos) {
      this.camera.position.copy(this.defaultCameraPos);
    }
    if (this.defaultTarget) {
      this.controls.target.copy(this.defaultTarget);
    }
    this.controls.update();
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    // Ensure perfect square aspect ratio
    const size = Math.min(rect.width, rect.height);
    this.camera.aspect = 1; // Always 1:1 for perfect circles
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(size, size);
  }
}

// Create sphere
function createSphere(radius, color, opacity = 0.7) {
  // Reduce segments in performance mode: 32x24 instead of 64x48
  const widthSegments = performanceMode ? 32 : 64;
  const heightSegments = performanceMode ? 24 : 48;
  const geometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
  
  // Use simpler material in performance mode
  const MaterialType = performanceMode ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial;
  const materialOptions = {
    color,
    transparent: true,
    opacity,
    roughness: 0.3,
    metalness: 0.1,
    side: THREE.DoubleSide,
    depthWrite: opacity > 0.5 // Enable depth write only for more opaque objects
  };
  
  // Add clearcoat only in normal mode
  if (!performanceMode) {
    materialOptions.clearcoat = 0.3;
  }
  
  const material = new MaterialType(materialOptions);
  return new THREE.Mesh(geometry, material);
}

// Create cylinder
function createCylinder(radius, length, color, opacity = 0.7) {
  // Reduce segments in performance mode: 32 instead of 64
  const radialSegments = performanceMode ? 32 : 64;
  const geometry = new THREE.CylinderGeometry(radius, radius, length, radialSegments, 1);
  
  // Use simpler material in performance mode
  const MaterialType = performanceMode ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial;
  const materialOptions = {
    color,
    transparent: true,
    opacity,
    roughness: 0.3,
    metalness: 0.1,
    side: THREE.DoubleSide,
    depthWrite: opacity > 0.5 // Enable depth write only for more opaque objects
  };
  
  // Add clearcoat only in normal mode
  if (!performanceMode) {
    materialOptions.clearcoat = 0.3;
  }
  
  const material = new MaterialType(materialOptions);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.z = Math.PI / 2;
  return mesh;
}

// Create E-field vectors for sphere (originating from charge surface, magnitude scaled by charge)
function createSphereFieldVectors(chargeRadius, chargeMagnitude, numVectors = 12) {
  const vectors = [];
  // Reduce vector count in performance mode
  const actualNumVectors = performanceMode ? Math.max(6, Math.floor(numVectors / 2)) : numVectors;
  
  // Base length proportional to charge radius, scaled by charge magnitude
  const baseLength = chargeRadius * 0.4;
  const chargeFactor = Math.min(Math.abs(chargeMagnitude) / 5, 2);
  const arrowLength = baseLength * (0.5 + chargeFactor * 0.5);
  
  const isPositive = chargeMagnitude >= 0;
  const arrowColor = isPositive ? 0xff6b00 : 0x0ea5e9; // Orange for positive, cyan for negative
  
  for (let i = 0; i < actualNumVectors; i++) {
    const theta = (i / actualNumVectors) * Math.PI * 2;
    for (let j = 0; j < actualNumVectors / 2; j++) {
      const phi = (j / (actualNumVectors / 2)) * Math.PI;
      
      const surfacePoint = new THREE.Vector3(
        chargeRadius * Math.sin(phi) * Math.cos(theta),
        chargeRadius * Math.sin(phi) * Math.sin(theta),
        chargeRadius * Math.cos(phi)
      );
      const radialDir = surfacePoint.clone().normalize();
      
      let origin, direction;
      if (isPositive) {
        // Positive: tail on surface, points outward
        origin = surfacePoint;
        direction = radialDir;
      } else {
        // Negative: tip on surface, tail outside (points inward)
        origin = surfacePoint.clone().add(radialDir.clone().multiplyScalar(arrowLength));
        direction = radialDir.clone().multiplyScalar(-1);
      }
      
      const arrow = new THREE.ArrowHelper(direction, origin, arrowLength, arrowColor, arrowLength * 0.2, arrowLength * 0.15);
      vectors.push(arrow);
    }
  }
  return vectors;
}

// Create dA vectors for sphere
function createSphereDAvectors(radius, numVectors = 8) {
  const vectors = [];
  // Reduce vector count in performance mode
  const actualNumVectors = performanceMode ? Math.max(4, Math.floor(numVectors / 2)) : numVectors;
  const arrowLength = radius * 0.25;
  
  for (let i = 0; i < actualNumVectors; i++) {
    const theta = (i / actualNumVectors) * Math.PI * 2;
    for (let j = 0; j < actualNumVectors / 2; j++) {
      const phi = (j / (actualNumVectors / 2)) * Math.PI;
      const pos = new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );
      const normal = pos.clone().normalize();
      const arrow = new THREE.ArrowHelper(normal, pos, arrowLength, 0x10b981, arrowLength * 0.2, arrowLength * 0.15);
      vectors.push(arrow);
    }
  }
  return vectors;
}

// Create E-field vectors for cylinder (originating from charge surface, magnitude scaled by charge)
function createCylinderFieldVectors(chargeRadius, chargeDensity, length, numCircles = 6, numPerCircle = 10) {
  const vectors = [];
  // Reduce vector count in performance mode
  const actualNumCircles = performanceMode ? Math.max(3, Math.floor(numCircles / 2)) : numCircles;
  const actualNumPerCircle = performanceMode ? Math.max(6, Math.floor(numPerCircle / 2)) : numPerCircle;
  
  // Base length proportional to charge radius, scaled by charge density magnitude
  const baseLength = chargeRadius * 0.4;
  const chargeFactor = Math.min(Math.abs(chargeDensity) / 10, 2);
  const arrowLength = baseLength * (0.5 + chargeFactor * 0.5);
  
  const isPositive = chargeDensity >= 0;
  const arrowColor = isPositive ? 0xff6b00 : 0x0ea5e9; // Orange for positive, cyan for negative
  
  for (let i = 0; i < actualNumCircles; i++) {
    const x = -length / 2 + (i / (actualNumCircles - 1)) * length;
    for (let j = 0; j < actualNumPerCircle; j++) {
      const theta = (j / actualNumPerCircle) * Math.PI * 2;
      // Cylinder is rotated 90° around Z, so it lies along X-axis
      const y = chargeRadius * Math.cos(theta);
      const z = chargeRadius * Math.sin(theta);
      const surfacePoint = new THREE.Vector3(x, y, z);
      const radialDir = new THREE.Vector3(0, Math.cos(theta), Math.sin(theta)).normalize();
      
      let origin, direction;
      if (isPositive) {
        // Positive: tail on surface, points outward
        origin = surfacePoint;
        direction = radialDir;
      } else {
        // Negative: tip on surface, tail outside (points inward)
        origin = surfacePoint.clone().add(radialDir.clone().multiplyScalar(arrowLength));
        direction = radialDir.clone().multiplyScalar(-1);
      }
      
      const arrow = new THREE.ArrowHelper(direction, origin, arrowLength, arrowColor, arrowLength * 0.2, arrowLength * 0.15);
      vectors.push(arrow);
    }
  }
  return vectors;
}

// Create dA vectors for cylinder (positioned correctly on rotated cylinder)
function createCylinderDAvectors(radius, length, numCircles = 5, numPerCircle = 8) {
  const vectors = [];
  // Reduce vector count in performance mode
  const actualNumCircles = performanceMode ? Math.max(3, Math.floor(numCircles / 2)) : numCircles;
  const actualNumPerCircle = performanceMode ? Math.max(4, Math.floor(numPerCircle / 2)) : numPerCircle;
  const arrowLength = radius * 0.22;
  
  for (let i = 0; i < actualNumCircles; i++) {
    const x = -length / 2 + (i / (actualNumCircles - 1)) * length;
    for (let j = 0; j < actualNumPerCircle; j++) {
      const theta = (j / actualNumPerCircle) * Math.PI * 2;
      // Position on cylinder surface (rotated to lie along X-axis)
      const y = radius * Math.cos(theta);
      const z = radius * Math.sin(theta);
      const pos = new THREE.Vector3(x, y, z);
      // Normal points radially outward in YZ plane
      const normal = new THREE.Vector3(0, Math.cos(theta), Math.sin(theta)).normalize();
      const arrow = new THREE.ArrowHelper(normal, pos, arrowLength, 0x10b981, arrowLength * 0.2, arrowLength * 0.15);
      vectors.push(arrow);
    }
  }
  return vectors;
}

// Create infinite plane (in XY plane, normal along Z axis)
function createPlane(size, color, opacity = 0.7, zPos = 0) {
  const geometry = new THREE.PlaneGeometry(size, size, performanceMode ? 4 : 10, performanceMode ? 4 : 10);
  const MaterialType = performanceMode ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial;
  const materialOptions = {
    color,
    transparent: true,
    opacity,
    roughness: 0.3,
    metalness: 0.1,
    side: THREE.DoubleSide,
    depthWrite: opacity > 0.5
  };
  
  if (!performanceMode) {
    materialOptions.clearcoat = 0.3;
  }
  
  const material = new MaterialType(materialOptions);
  const mesh = new THREE.Mesh(geometry, material);
  // PlaneGeometry default is XY plane - perfect for plates perpendicular to Z
  // Position along Z axis for separation
  mesh.position.z = zPos;
  return mesh;
}

// Create E-field vectors for plane (perpendicular to plane surface)
// Plane is in XY plane, so E-field points along Z axis
// chargeDensity can be positive or negative to set direction
function createPlaneFieldVectors(planeSize, chargeDensity, zPos = 0, numVectors = 8) {
  const vectors = [];
  const actualNum = performanceMode ? Math.max(4, Math.floor(numVectors / 2)) : numVectors;
  
  const baseLength = planeSize * 0.2;
  const chargeFactor = Math.min(Math.abs(chargeDensity) / 5, 2);
  const arrowLength = baseLength * (0.5 + chargeFactor * 0.5);
  
  const isPositive = chargeDensity >= 0;
  const arrowColor = isPositive ? 0xff6b00 : 0x0ea5e9; // Orange for positive, cyan for negative
  
  const spacing = planeSize / (actualNum + 1);
  for (let i = 0; i < actualNum; i++) {
    for (let j = 0; j < actualNum; j++) {
      const x = -planeSize / 2 + spacing * (i + 1);
      const y = -planeSize / 2 + spacing * (j + 1);
      const surfacePoint = new THREE.Vector3(x, y, zPos);
      
      let origin, direction;
      if (isPositive) {
        // Positive: tail on plane, points away (+Z direction)
        origin = surfacePoint;
        direction = new THREE.Vector3(0, 0, 1);
      } else {
        // Negative: tip on plane, tail away, points inward (-Z direction)
        origin = surfacePoint.clone().add(new THREE.Vector3(0, 0, arrowLength));
        direction = new THREE.Vector3(0, 0, -1);
      }
      
      const arrow = new THREE.ArrowHelper(direction, origin, arrowLength, arrowColor, arrowLength * 0.2, arrowLength * 0.15);
      vectors.push(arrow);
    }
  }
  return vectors;
}

// Create Gaussian pillbox for plane (cylinder with axis along Z, caps in XY plane)
function createPillbox(radius, height, zPos = 0) {
  const geometry = new THREE.CylinderGeometry(radius, radius, height, performanceMode ? 16 : 32, 1);
  // Use same material style as sphere/cylinder Gaussian surfaces
  const MaterialType = performanceMode ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial;
  const materialOptions = {
    color: 0x00ffff,
    transparent: true,
    opacity: 0.35,
    roughness: 0.3,
    metalness: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false
  };
  
  if (!performanceMode) {
    materialOptions.clearcoat = 0.3;
  }
  
  const material = new MaterialType(materialOptions);
  const mesh = new THREE.Mesh(geometry, material);
  // Rotate 90° around X axis so cylinder axis points along Z instead of Y
  mesh.rotation.x = Math.PI / 2;
  mesh.position.z = zPos;
  return mesh;
}

// Create dA vectors for pillbox (on circular end caps perpendicular to Z)
// Pillbox axis is along Z, caps are in XY plane at z ± height/2
function createPillboxDAvectors(radius, height, zPos = 0, numVectors = 6) {
  const vectors = [];
  const actualNum = performanceMode ? Math.max(3, Math.floor(numVectors / 2)) : numVectors;
  const arrowLength = radius * 0.3;
  
  // Front cap dA vectors (at zPos + height/2, pointing along +Z)
  for (let i = 0; i < actualNum; i++) {
    const theta = (i / actualNum) * Math.PI * 2;
    const r = radius * 0.6;
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    const pos = new THREE.Vector3(x, y, zPos + height / 2);
    const normal = new THREE.Vector3(0, 0, 1); // Pointing forward (+Z)
    const arrow = new THREE.ArrowHelper(normal, pos, arrowLength, 0x10b981, arrowLength * 0.2, arrowLength * 0.15);
    vectors.push(arrow);
  }
  
  // Back cap dA vectors (at zPos - height/2, pointing along -Z)
  for (let i = 0; i < actualNum; i++) {
    const theta = (i / actualNum) * Math.PI * 2;
    const r = radius * 0.6;
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    const pos = new THREE.Vector3(x, y, zPos - height / 2);
    const normal = new THREE.Vector3(0, 0, -1); // Pointing backward (-Z)
    const arrow = new THREE.ArrowHelper(normal, pos, arrowLength, 0x10b981, arrowLength * 0.2, arrowLength * 0.15);
    vectors.push(arrow);
  }
  
  return vectors;
}

// Create dA vectors for pillbox - SINGLE SIDE only (for two-plate configuration)
// onlyPositiveSide: true = only +Z cap, false = only -Z cap
function createPillboxDAvectorsSingleSide(radius, height, zPos = 0, numVectors = 6, onlyPositiveSide = true) {
  const vectors = [];
  const actualNum = performanceMode ? Math.max(3, Math.floor(numVectors / 2)) : numVectors;
  const arrowLength = radius * 0.3;
  
  if (onlyPositiveSide) {
    // Only front cap (pointing away from plate in +Z direction)
    for (let i = 0; i < actualNum; i++) {
      const theta = (i / actualNum) * Math.PI * 2;
      const r = radius * 0.6;
      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta);
      const pos = new THREE.Vector3(x, y, zPos + height / 2);
      const normal = new THREE.Vector3(0, 0, 1);
      const arrow = new THREE.ArrowHelper(normal, pos, arrowLength, 0x10b981, arrowLength * 0.2, arrowLength * 0.15);
      vectors.push(arrow);
    }
  } else {
    // Only back cap (pointing away from plate in -Z direction)
    for (let i = 0; i < actualNum; i++) {
      const theta = (i / actualNum) * Math.PI * 2;
      const r = radius * 0.6;
      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta);
      const pos = new THREE.Vector3(x, y, zPos - height / 2);
      const normal = new THREE.Vector3(0, 0, -1);
      const arrow = new THREE.ArrowHelper(normal, pos, arrowLength, 0x10b981, arrowLength * 0.2, arrowLength * 0.15);
      vectors.push(arrow);
    }
  }
  
  return vectors;
}

// Create auto-rotating preview scene
function createPreviewScene() {
  const container = document.getElementById('previewCanvas');
  if (!container) return null;
  
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  
  const rect = container.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0xf4f6f8, 1);
  container.appendChild(renderer.domElement);
  
  camera.position.set(0.25, 0.15, 0.2);
  camera.lookAt(0, 0, 0);
  
  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambient);
  const directional = new THREE.DirectionalLight(0xffffff, 0.6);
  directional.position.set(5, 5, 5);
  scene.add(directional);
  
  // Create charged sphere
  const sphereGeo = new THREE.SphereGeometry(0.05, 32, 24);
  const sphereMat = new THREE.MeshPhysicalMaterial({
    color: 0xff6666,
    transparent: true,
    opacity: 0.75,
    roughness: 0.3,
    metalness: 0.1,
    clearcoat: 0.3
  });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  scene.add(sphere);
  
  // Create Gaussian surface
  const gaussianGeo = new THREE.SphereGeometry(0.08, 32, 24);
  const gaussianMat = new THREE.MeshPhysicalMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.35,
    roughness: 0.3,
    metalness: 0.1,
    clearcoat: 0.3
  });
  const gaussian = new THREE.Mesh(gaussianGeo, gaussianMat);
  scene.add(gaussian);
  
  // Add E-field vectors distributed around sphere
  for (let i = 0; i < 8; i++) {
    const theta = (i / 8) * Math.PI * 2;
    for (let j = 0; j < 3; j++) {
      const phi = (j / 3) * Math.PI;
      const origin = new THREE.Vector3(
        0.05 * Math.sin(phi) * Math.cos(theta),
        0.05 * Math.sin(phi) * Math.sin(theta),
        0.05 * Math.cos(phi)
      );
      const direction = origin.clone().normalize();
      const arrow = new THREE.ArrowHelper(direction, origin, 0.04, 0xff6b00, 0.008, 0.006);
      scene.add(arrow);
    }
  }
  
  // Auto-rotate animation
  let angle = 0;
  function animate() {
    requestAnimationFrame(animate);
    angle += 0.005;
    camera.position.x = 0.25 * Math.cos(angle);
    camera.position.z = 0.25 * Math.sin(angle);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }
  animate();
  
  return { scene, camera, renderer };
}

let sphereScene, cylinderScene, planeScene, previewScene;

// Initialize sphere chart with Plotly
function initSphereChart() {
  const layout = {
    title: 'Sphere: E(r) vs Distance',
    xaxis: {
      title: 'Distance r (m)',
      type: 'log',
      gridcolor: '#e5e7eb',
      tickformat: '.3f',
    },
    yaxis: {
      title: 'Electric Field E (N/C)',
      type: 'log',
      gridcolor: '#e5e7eb',
      tickformat: '.2f',
    },
    font: { family: 'Source Sans Pro', size: 12 },
    plot_bgcolor: '#ffffff',
    paper_bgcolor: '#f8f9fa',
    margin: { l: 60, r: 30, t: 40, b: 50 },
  };
  
  Plotly.newPlot('sphereChart', [], layout, {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d']
  });
}

// Initialize cylinder chart with Plotly
function initCylinderChart() {
  const layout = {
    title: 'Cylinder: E(r) vs Distance',
    xaxis: {
      title: 'Distance r (m)',
      type: 'log',
      gridcolor: '#e5e7eb',
      tickformat: '.3f',
    },
    yaxis: {
      title: 'Electric Field E (N/C)',
      type: 'log',
      gridcolor: '#e5e7eb',
      tickformat: '.2f',
    },
    font: { family: 'Source Sans Pro', size: 12 },
    plot_bgcolor: '#ffffff',
    paper_bgcolor: '#f8f9fa',
    margin: { l: 60, r: 30, t: 40, b: 50 },
  };
  
  Plotly.newPlot('cylinderChart', [], layout, {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d']
  });
}

// Initialize plane chart with Plotly
function initPlaneChart() {
  const layout = {
    title: 'Plane: E vs Distance',
    xaxis: {
      title: 'Distance z (m)',
      type: 'linear',
      gridcolor: '#e5e7eb',
      tickformat: '.3f',
    },
    yaxis: {
      title: 'Electric Field E (N/C)',
      type: 'linear',
      gridcolor: '#e5e7eb',
      tickformat: '.2f',
    },
    font: { family: 'Source Sans Pro', size: 12 },
    plot_bgcolor: '#ffffff',
    paper_bgcolor: '#f8f9fa',
    margin: { l: 60, r: 30, t: 40, b: 50 },
  };
  
  Plotly.newPlot('planeChart', [], layout, {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d']
  });
}

// Helper function to format numbers for display
function formatAxisNumber(value) {
  if (value === 0) return '0';
  if (value >= 1000) return value.toFixed(0);
  if (value >= 100) return value.toFixed(1);
  if (value >= 1) return value.toFixed(2);
  if (value >= 0.01) return value.toFixed(3);
  return value.toFixed(4);
}

// Update sphere visualization
function updateSphereViz() {
  const Q_nC = parseFloat(document.getElementById('sphereCharge').value);
  const R_cm = parseFloat(document.getElementById('sphereRadius').value);
  const r_cm = parseFloat(document.getElementById('sphereGaussian').value);
  const isConductor = document.getElementById('sphereConductor').checked;
  const showField = document.getElementById('sphereShowField').checked;
  const showDA = document.getElementById('sphereShowDA').checked;

  const Q_C = nanoCoulombToCoulomb(Q_nC);
  const R_m = cmToM(R_cm);
  const r_m = cmToM(r_cm);
  const isPositive = Q_nC >= 0;
  const solidColor = isPositive ? 0xff6666 : 0x668cff;
  const gaussianColor = r_m < R_m ? 0x22c55e : 0x00ffff;

  // Calculate field at Gaussian surface
  let fieldAtSurface;
  if (r_m < R_m) {
    fieldAtSurface = isConductor ? 0 : E_sphere_insulator(Q_C, R_m, r_m);
  } else {
    fieldAtSurface = E_sphere_outside(Q_C, r_m);
  }

  sphereScene.clear();
  
  // Make charged sphere more transparent when Gaussian surface is inside
  // and make Gaussian surface fully opaque for better visibility
  const isInside = r_m < R_m;
  const chargedSphereOpacity = isInside ? 0.15 : 0.75;
  const gaussianSphereOpacity = isInside ? 0.95 : 0.35;
  
  // Render Gaussian surface first so it's behind the charged sphere
  const gaussianSphere = createSphere(r_m, gaussianColor, gaussianSphereOpacity);
  sphereScene.addObject(gaussianSphere);
  
  const chargedSphere = createSphere(R_m, solidColor, chargedSphereOpacity);
  sphereScene.addObject(chargedSphere);
  
  // E-field vectors originating from charge surface
  if (showField && Q_nC !== 0) {
    const vectors = createSphereFieldVectors(R_m, Q_nC, 10);
    vectors.forEach(v => sphereScene.addArrow(v));
  }
  
  // dA vectors
  if (showDA) {
    const vectors = createSphereDAvectors(r_m, 8);
    vectors.forEach(v => sphereScene.addArrow(v));
  }
  
  // Update chart
  updateSphereChart(Q_nC, R_cm, r_cm, isConductor);
}

// Update cylinder visualization
function updateCylinderViz() {
  const lambda_nC = parseFloat(document.getElementById('cylinderLambda').value);
  const a_cm = parseFloat(document.getElementById('cylinderRadius').value);
  const r_cm = parseFloat(document.getElementById('cylinderGaussian').value);
  const L_m = parseFloat(document.getElementById('cylinderLength').value);
  const isConductor = document.getElementById('cylinderConductor').checked;
  const showField = document.getElementById('cylinderShowField').checked;
  const showDA = document.getElementById('cylinderShowDA').checked;

  const lambda_Cm = nanoCoulombToCoulomb(lambda_nC);
  const a_m = cmToM(a_cm);
  const r_m = cmToM(r_cm);
  const isPositive = lambda_nC >= 0;
  const solidColor = isPositive ? 0xff6666 : 0x668cff;
  const gaussianColor = r_m < a_m ? 0x22c55e : 0x00ffff;

  // Calculate field at Gaussian surface
  let fieldAtSurface;
  if (r_m < a_m) {
    fieldAtSurface = isConductor ? 0 : E_cylinder_insulator(lambda_Cm, a_m, r_m);
  } else {
    fieldAtSurface = E_cylinder_outside(lambda_Cm, r_m);
  }

  cylinderScene.clear();
  
  const rodLength = Math.max(L_m * 2.8, 3);
  // Make charged rod more transparent when Gaussian surface is inside
  // and make Gaussian surface fully opaque for better visibility
  const isInside = r_m < a_m;
  const chargedRodOpacity = isInside ? 0.15 : 0.75;
  const gaussianCylinderOpacity = isInside ? 0.95 : 0.35;
  
  // Render Gaussian surface first so it's behind the charged rod
  const gaussianCylinder = createCylinder(r_m, L_m, gaussianColor, gaussianCylinderOpacity);
  cylinderScene.addObject(gaussianCylinder);
  
  const chargedRod = createCylinder(a_m, rodLength, solidColor, chargedRodOpacity);
  cylinderScene.addObject(chargedRod);
  
  // E-field vectors originating from charge surface
  if (showField && lambda_nC !== 0) {
    const vectors = createCylinderFieldVectors(a_m, lambda_nC, L_m, 6, 10);
    vectors.forEach(v => cylinderScene.addArrow(v));
  }
  
  // dA vectors
  if (showDA) {
    const vectors = createCylinderDAvectors(r_m, L_m, 5, 8);
    vectors.forEach(v => cylinderScene.addArrow(v));
  }
  
  // Update chart
  updateCylinderChart(lambda_nC, a_cm, r_cm, L_m, isConductor);
}

// Update sphere chart with Plotly
function updateSphereChart(Q_nC, R_cm, r_cm, isConductor) {
  const Q_C = nanoCoulombToCoulomb(Q_nC);
  const R_m = cmToM(R_cm);
  const r_m = cmToM(r_cm);
  
  // Linear spacing for linear plot
  const rMin = 0.001;  // 1mm
  const rMax = 0.2;    // 20cm (covers the slider range)
  // Reduce data points in performance mode
  const points = performanceMode ? 200 : 400;
  const rVals = Array.from({ length: points }, (_, i) => rMin + (rMax - rMin) * i / (points - 1));

  const xData = [];
  const yData = [];
  
  rVals.forEach((r) => {
    let E;
    if (r < R_m) {
      E = isConductor ? 0 : E_sphere_insulator(Q_C, R_m, r);
    } else {
      E = E_sphere_outside(Q_C, r);
    }
    xData.push(r);
    yData.push(E);
  });

  // Calculate marker position
  let markerE = r_m < R_m 
    ? (isConductor ? 0 : E_sphere_insulator(Q_C, R_m, r_m))
    : E_sphere_outside(Q_C, r_m);

  // Find max E for setting y-axis range (magnitude is always positive)
  const maxE = Math.max(...yData);
  const yMax = maxE * 1.1;

  const traces = [
    {
      x: xData,
      y: yData,
      type: 'scatter',
      mode: 'lines',
      name: 'E(r)',
      line: { color: '#3b82f6', width: 2.5 },
      hovertemplate: 'r: %{x:.4f} m<br>E: %{y:.2f} N/C<extra></extra>'
    },
    {
      x: [r_m],
      y: [markerE],
      type: 'scatter',
      mode: 'markers',
      name: 'Gaussian Surface',
      marker: { color: '#f59e0b', size: 10, line: { color: '#fff', width: 2 } },
      hovertemplate: 'r: %{x:.4f} m<br>E: %{y:.2f} N/C<extra></extra>'
    }
  ];

  const config = {
    responsive: true,
    displayModeBar: !performanceMode,
    staticPlot: performanceMode
  };

  Plotly.react('sphereChart', traces, {
    title: null,
    xaxis: {
      title: { text: 'Distance r (m)', font: { size: 11 } },
      type: 'linear',
      range: [0, rMax],
      gridcolor: '#e5e7eb',
      tickformat: '.3f',
    },
    yaxis: {
      title: { text: 'Electric Field E (N/C)', font: { size: 11 } },
      type: 'linear',
      range: [0, yMax],
      gridcolor: '#e5e7eb',
      tickformat: '.1f',
    },
    font: { family: 'Source Sans Pro', size: 10 },
    plot_bgcolor: '#ffffff',
    paper_bgcolor: 'transparent',
    margin: { l: 70, r: 20, t: 10, b: 50 },
    autosize: true,
    showlegend: true,
    legend: { x: 0.65, y: 0.98, font: { size: 9 } },
  }, config);
}

// Update cylinder chart with Plotly
function updateCylinderChart(lambda_nC, a_cm, r_cm, L_m, isConductor) {
  const lambda_Cm = nanoCoulombToCoulomb(lambda_nC);
  const a_m = cmToM(a_cm);
  const r_m = cmToM(r_cm);
  
  // Linear spacing for linear plot
  const rMin = 0.001;  // 1mm
  const rMax = 0.3;    // 30cm (covers the slider range)
  // Reduce data points in performance mode
  const points = performanceMode ? 200 : 400;
  const rVals = Array.from({ length: points }, (_, i) => rMin + (rMax - rMin) * i / (points - 1));

  const xData = [];
  const yData = [];
  
  rVals.forEach((r) => {
    let E;
    if (r < a_m) {
      E = isConductor ? 0 : E_cylinder_insulator(lambda_Cm, a_m, r);
    } else {
      E = E_cylinder_outside(lambda_Cm, r);
    }
    xData.push(r);
    yData.push(E);
  });

  // Calculate marker position
  let markerE = r_m < a_m 
    ? (isConductor ? 0 : E_cylinder_insulator(lambda_Cm, a_m, r_m))
    : E_cylinder_outside(lambda_Cm, r_m);

  // Find max E for setting y-axis range
  const maxE = Math.max(...yData);
  const yMax = maxE * 1.1; // Add 10% padding

  const traces = [
    {
      x: xData,
      y: yData,
      type: 'scatter',
      mode: 'lines',
      name: 'E(r)',
      line: { color: '#06b6d4', width: 2.5 },
      hovertemplate: 'r: %{x:.4f} m<br>E: %{y:.2f} N/C<extra></extra>'
    },
    {
      x: [r_m],
      y: [markerE],
      type: 'scatter',
      mode: 'markers',
      name: 'Gaussian Surface',
      marker: { color: '#f59e0b', size: 10, line: { color: '#fff', width: 2 } },
      hovertemplate: 'r: %{x:.4f} m<br>E: %{y:.2f} N/C<extra></extra>'
    }
  ];

  const config = {
    responsive: true,
    displayModeBar: !performanceMode, // Hide mode bar in performance mode
    staticPlot: performanceMode // Disable interactivity in performance mode
  };

  Plotly.react('cylinderChart', traces, {
    title: null,
    xaxis: {
      title: { text: 'Distance r (m)', font: { size: 11 } },
      type: 'linear',
      range: [0, rMax],
      gridcolor: '#e5e7eb',
      tickformat: '.3f',
    },
    yaxis: {
      title: { text: 'Electric Field |E| (N/C)', font: { size: 11 } },
      type: 'linear',
      range: [0, yMax],
      gridcolor: '#e5e7eb',
      tickformat: '.1f',
    },
    font: { family: 'Source Sans Pro', size: 10 },
    plot_bgcolor: '#ffffff',
    paper_bgcolor: 'transparent',
    margin: { l: 70, r: 20, t: 10, b: 50 },
    height: 350,
    autosize: false,
    showlegend: true,
    legend: { x: 0.65, y: 0.98, font: { size: 9 } },
  }, config);
}

// Update sphere readouts
function updateSphereReadouts() {
  const Q_nC = parseFloat(document.getElementById('sphereCharge').value);
  const R_cm = parseFloat(document.getElementById('sphereRadius').value);
  const r_cm = parseFloat(document.getElementById('sphereGaussian').value);
  const isConductor = document.getElementById('sphereConductor').checked;
  
  document.getElementById('sphereChargeVal').textContent = Q_nC.toFixed(1);
  document.getElementById('sphereRadiusVal').textContent = R_cm.toFixed(1);
  document.getElementById('sphereGaussianVal').textContent = r_cm.toFixed(1);

  const Q_C = nanoCoulombToCoulomb(Q_nC);
  const R_m = cmToM(R_cm);
  const r_m = cmToM(r_cm);
  
  let sphereE;
  if (r_m < R_m) {
    sphereE = isConductor ? E_sphere_inside() : E_sphere_insulator(Q_C, R_m, r_m);
  } else {
    sphereE = E_sphere_outside(Q_C, r_m);
  }
  document.getElementById('sphereEVal').textContent = `${formatNumber(sphereE)} N/C`;
}

// Update cylinder readouts
function updateCylinderReadouts() {
  const lambda_nC = parseFloat(document.getElementById('cylinderLambda').value);
  const a_cm = parseFloat(document.getElementById('cylinderRadius').value);
  const r_cm = parseFloat(document.getElementById('cylinderGaussian').value);
  const L_m = parseFloat(document.getElementById('cylinderLength').value);
  const isConductor = document.getElementById('cylinderConductor').checked;

  document.getElementById('cylinderLambdaVal').textContent = lambda_nC.toFixed(1);
  document.getElementById('cylinderRadiusVal').textContent = a_cm.toFixed(1);
  document.getElementById('cylinderGaussianVal').textContent = r_cm.toFixed(1);
  document.getElementById('cylinderLengthVal').textContent = L_m.toFixed(1);

  const lambda_Cm = nanoCoulombToCoulomb(lambda_nC);
  const a_m = cmToM(a_cm);
  const r_m = cmToM(r_cm);
  
  let cylinderE;
  if (r_m < a_m) {
    cylinderE = isConductor ? E_cylinder_inside() : E_cylinder_insulator(lambda_Cm, a_m, r_m);
  } else {
    cylinderE = E_cylinder_outside(lambda_Cm, r_m);
  }
  document.getElementById('cylinderEVal').textContent = `${formatNumber(cylinderE)} N/C`;
}

// Update plane visualization
function updatePlaneViz() {
  const sigma_nC = parseFloat(document.getElementById('planeSigma').value);
  const d_cm = parseFloat(document.getElementById('planeSeparation').value);
  const twoPlanes = document.getElementById('planeTwoPlanes').checked;
  const showField = document.getElementById('planeShowField').checked;
  const showDA = document.getElementById('planeShowDA').checked;

  // Toggle separation slider visibility
  const separationGroup = document.getElementById('planeSeparationGroup');
  if (separationGroup) {
    separationGroup.style.display = twoPlanes ? 'block' : 'none';
  }

  const sigma_Cm2 = nanoCoulombToCoulomb(sigma_nC);
  const d_m = cmToM(d_cm);
  const isPositive = sigma_nC >= 0;
  const planeColor = isPositive ? 0xff6666 : 0x668cff;
  const planeSize = 0.5;
  const pillboxRadius = planeSize * 0.15;
  const pillboxHeight = planeSize * 0.12;

  planeScene.clear();
  
  if (twoPlanes) {
    // Two parallel planes separated along Z axis
    // Positive plate at +d/2, negative plate at -d/2
    const plane1 = createPlane(planeSize, planeColor, 0.7, d_m / 2);
    planeScene.addObject(plane1);
    
    const plane2 = createPlane(planeSize, isPositive ? 0x668cff : 0xff6666, 0.7, -d_m / 2);
    planeScene.addObject(plane2);
    
    // Pillbox positioned so positive plate slices through its center
    const pillboxZ = d_m / 2;
    const pillbox = createPillbox(pillboxRadius, pillboxHeight, pillboxZ);
    planeScene.addObject(pillbox);
    
    // Show field vectors BETWEEN the plates (field points from + to -)
    if (showField && sigma_nC !== 0) {
      // Create vectors at multiple Z positions between the plates
      const numLayers = 3;
      for (let layer = 0; layer < numLayers; layer++) {
        const layerZ = -d_m / 3 + (layer * d_m / 3);
        // For two opposite charges: E points from + to - (toward negative plate)
        // If + at +z and - at -z, field points in -Z direction
        const effectiveSigma = isPositive ? -Math.abs(sigma_nC) : Math.abs(sigma_nC);
        const layerVectors = createPlaneFieldVectors(planeSize * 0.4, effectiveSigma, layerZ, 3);
        layerVectors.forEach(v => planeScene.addArrow(v));
      }
    }
    
    // Show dA vectors ONLY on the outward-facing cap (the one in the field region)
    if (showDA) {
      // The outward cap is the one pointing toward the negative plate (in -Z direction)
      const vectors = createPillboxDAvectorsSingleSide(pillboxRadius, pillboxHeight, pillboxZ, 6, false);
      vectors.forEach(v => planeScene.addArrow(v));
    }
  } else {
    // Single plane at z=0
    const plane = createPlane(planeSize, planeColor, 0.75, 0);
    planeScene.addObject(plane);
    
    // Pillbox centered on plane at z=0 (always encloses the plane)
    const pillbox = createPillbox(pillboxRadius, pillboxHeight, 0);
    planeScene.addObject(pillbox);
    
    // Show E-field vectors emanating FROM the plane surface (both sides)
    if (showField && sigma_nC !== 0) {
      // Both sides of the plane - same vectors with same sign
      const vectorsPos = createPlaneFieldVectors(planeSize * 0.6, sigma_nC, 0.001, 5);
      const vectorsNeg = createPlaneFieldVectors(planeSize * 0.6, sigma_nC, -0.001, 5);
      vectorsPos.forEach(v => planeScene.addArrow(v));
      vectorsNeg.forEach(v => planeScene.addArrow(v));
    }
    
    // Show dA vectors on pillbox caps (centered on plane, so caps are at ±height/2 from z=0)
    if (showDA) {
      const vectors = createPillboxDAvectors(pillboxRadius, pillboxHeight, 0, 6);
      vectors.forEach(v => planeScene.addArrow(v));
    }
  }
  
  // Update chart
  updatePlaneChart(sigma_nC, d_cm, twoPlanes);
}

// Update plane readouts
function updatePlaneReadouts() {
  const sigma_nC = parseFloat(document.getElementById('planeSigma').value);
  const d_cm = parseFloat(document.getElementById('planeSeparation').value);
  const twoPlanes = document.getElementById('planeTwoPlanes').checked;

  document.getElementById('planeSigmaVal').textContent = sigma_nC.toFixed(1);
  document.getElementById('planeSeparationVal').textContent = d_cm.toFixed(1);
  
  const sigma_Cm2 = nanoCoulombToCoulomb(sigma_nC);
  const d_m = cmToM(d_cm);
  const pillboxHeight_m = 0.5 * 0.12; // From planeSize calculation
  
  let planeE;
  
  if (twoPlanes) {
    // Pillbox positioned with positive plate slicing through center
    const pillboxZ_m = d_m / 2;
    document.getElementById('planeDistanceVal').textContent = `${(pillboxZ_m * 100).toFixed(1)} (+plate slices)`;
    // Field between plates
    planeE = E_plane_double(sigma_Cm2);
  } else {
    // Single plane - pillbox with plane slicing through center
    document.getElementById('planeDistanceVal').textContent = '0.0 (plane slices)';
    planeE = E_plane_single(sigma_Cm2);
  }
  
  document.getElementById('planeEVal').textContent = `${formatNumber(planeE)} N/C`;
}

// Update plane chart
function updatePlaneChart(sigma_nC, d_cm, twoPlanes) {
  const sigma_Cm2 = nanoCoulombToCoulomb(sigma_nC);
  const d_m = cmToM(d_cm);
  // Marker at actual pillbox center position
  const z_m = twoPlanes ? (d_m / 2) : 0; // Two planes: at positive plate; Single: centered at origin
  
  const zMin = twoPlanes ? -d_m * 1.5 : -0.15;
  const zMax = twoPlanes ? d_m * 1.5 : 0.15;
  const points = performanceMode ? 200 : 400;
  const zVals = Array.from({ length: points }, (_, i) => zMin + (zMax - zMin) * i / (points - 1));

  const xData = [];
  const yData = [];
  
  zVals.forEach((z) => {
    let E;
    if (twoPlanes) {
      if (Math.abs(z) <= d_m / 2) {
        E = E_plane_double(sigma_Cm2);
      } else {
        E = 0;
      }
    } else {
      E = E_plane_single(sigma_Cm2);
    }
    xData.push(z);
    yData.push(E);
  });

  let markerE;
  if (twoPlanes) {
    markerE = Math.abs(z_m) <= d_m / 2 ? E_plane_double(sigma_Cm2) : 0;
  } else {
    markerE = E_plane_single(sigma_Cm2);
  }

  const maxE = Math.max(...yData);
  const yMaxVal = maxE > 0 ? maxE * 1.2 : 10;

  const traces = [
    {
      x: xData,
      y: yData,
      type: 'scatter',
      mode: 'lines',
      name: 'E(z)',
      line: { color: '#10b981', width: 2.5, shape: twoPlanes ? 'hv' : 'linear' },
      hovertemplate: 'z: %{x:.4f} m<br>E: %{y:.2f} N/C<extra></extra>'
    },
    {
      x: [z_m],
      y: [markerE],
      type: 'scatter',
      mode: 'markers',
      name: 'Observation Point',
      marker: { color: '#f59e0b', size: 10, line: { color: '#fff', width: 2 } },
      hovertemplate: 'z: %{x:.4f} m<br>E: %{y:.2f} N/C<extra></extra>'
    }
  ];

  const config = {
    responsive: true,
    displayModeBar: !performanceMode,
    staticPlot: performanceMode
  };

  // Add plate boundary lines for two-plane mode
  const shapes = twoPlanes ? [
    {
      type: 'line',
      x0: -d_m / 2,
      x1: -d_m / 2,
      y0: 0,
      y1: yMaxVal,
      line: { color: '#666', width: 1, dash: 'dash' }
    },
    {
      type: 'line',
      x0: d_m / 2,
      x1: d_m / 2,
      y0: 0,
      y1: yMaxVal,
      line: { color: '#666', width: 1, dash: 'dash' }
    }
  ] : [];

  Plotly.react('planeChart', traces, {
    title: null,
    xaxis: {
      title: { text: 'Distance z (m)', font: { size: 11 } },
      type: 'linear',
      range: [zMin, zMax],
      gridcolor: '#e5e7eb',
      tickformat: '.3f',
      zeroline: true,
      zerolinecolor: '#999',
      zerolinewidth: 1,
    },
    yaxis: {
      title: { text: 'Electric Field |E| (N/C)', font: { size: 11 } },
      type: 'linear',
      range: [0, yMaxVal],
      gridcolor: '#e5e7eb',
      tickformat: '.1f',
    },
    shapes: shapes,
    font: { family: 'Source Sans Pro', size: 10 },
    plot_bgcolor: '#ffffff',
    paper_bgcolor: 'transparent',
    margin: { l: 70, r: 20, t: 10, b: 50 },
    height: 350,
    autosize: false,
    showlegend: true,
    legend: { x: 0.60, y: 0.98, font: { size: 9 } },
  }, config);
}

// Initialize
function init() {
  // Show welcome modal on first visit
  const hasVisited = sessionStorage.getItem('gaussianSurfacesVisited');
  if (!hasVisited) {
    const modal = document.getElementById('welcomeModal');
    modal.style.display = 'flex';
    
    // Render math in modal
    setTimeout(() => {
      if (window.renderMathInElement) {
        renderMathInElement(modal, {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '\\(', right: '\\)', display: false}
          ],
          throwOnError: false
        });
      }
    }, 100);
    
    sessionStorage.setItem('gaussianSurfacesVisited', 'true');
  }
  
  // Auto-detect performance mode before creating scenes
  detectPerformanceMode();
  
  // Create preview scene
  previewScene = createPreviewScene();
  
  sphereScene = new Scene3D('sphereCanvas');
  cylinderScene = new Scene3D('cylinderCanvas');
  planeScene = new Scene3D('planeCanvas');

  initSphereChart();
  initCylinderChart();
  initPlaneChart();
  
  // Render LaTeX math with KaTeX after everything loads
  setTimeout(() => {
    if (window.renderMathInElement) {
      try {
        window.renderMathInElement(document.body, {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '\\(', right: '\\)', display: false}
          ],
          throwOnError: false
        });
        console.log('KaTeX rendering complete');
      } catch (e) {
        console.error('KaTeX rendering error:', e);
      }
    } else {
      console.warn('KaTeX renderMathInElement not available');
    }
  }, 500); // Increased delay to ensure scripts load

  // Throttled update functions for better performance
  const throttledSphereUpdate = throttle(() => {
    updateSphereReadouts();
    updateSphereViz();
  }, UPDATE_THROTTLE);

  const throttledCylinderUpdate = throttle(() => {
    updateCylinderReadouts();
    updateCylinderViz();
  }, UPDATE_THROTTLE);

  // Sphere controls - only update sphere
  document.querySelectorAll('.sphere-control').forEach((input) => {
    input.addEventListener('input', throttledSphereUpdate);
  });

  // Cylinder controls - only update cylinder
  document.querySelectorAll('.cylinder-control').forEach((input) => {
    input.addEventListener('input', throttledCylinderUpdate);
  });

  const throttledPlaneUpdate = throttle(() => {
    updatePlaneReadouts();
    updatePlaneViz();
  }, UPDATE_THROTTLE);

  // Plane controls - only update plane
  document.querySelectorAll('.plane-control').forEach((input) => {
    input.addEventListener('input', throttledPlaneUpdate);
  });

  // Reset buttons
  document.getElementById('resetSphereView')?.addEventListener('click', () => {
    sphereScene.resetCamera();
  });
  
  document.getElementById('resetCylinderView')?.addEventListener('click', () => {
    cylinderScene.resetCamera();
  });
  
  document.getElementById('resetPlaneView')?.addEventListener('click', () => {
    planeScene.resetCamera();
  });

  // Window resize
  window.addEventListener('resize', () => {
    sphereScene.resize();
    cylinderScene.resize();
    planeScene.resize();
  });

  // Initial render
  updateSphereReadouts();
  updateSphereViz();
  updateCylinderReadouts();
  updateCylinderViz();
  updatePlaneReadouts();
  updatePlaneViz();
}

// Start when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
