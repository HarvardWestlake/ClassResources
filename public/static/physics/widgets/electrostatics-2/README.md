# Electrostatics 2 — Equipotentials & Electron Flow

Interactive widget for visualizing electric fields, electric potentials, and electron flow from point charges.

## Overview

This widget allows students to:
- Place positive and negative point charges on a canvas
- Visualize electric potential as a hot-to-cool color gradient (heatmap)
- See electric field vectors (arrows showing field direction)
- Simulate electron flow along field lines
- Measure distances and forces between charges
- Understand the relationship between E (electric field) and V (electric potential)

## Physics Concepts

### Electric Field (E)
- **Definition:** Force per unit charge (N/C or V/m)
- **Formula:** `E = k·q/r²` where k = 8.99×10⁹ N·m²/C²
- **Vector field:** Points away from positive charges, toward negative charges
- **Superposition:** Total field is vector sum of individual charge contributions

### Electric Potential (V)
- **Definition:** Work per unit charge (voltage, measured in Volts)
- **Formula:** `V = k·q/r`
- **Scalar field:** Positive charges create high potential, negative charges create low potential
- **Relationship to E:** Electric field points from high to low potential (E = -∇V)

### Electron Flow
- Electrons are negatively charged (q = -1.6×10⁻¹⁹ C)
- They move **opposite** to the electric field direction
- Field lines show where a positive charge would go; electrons go the opposite way

## Features

### ✅ Fully Functional On Mobile & Desktop

#### Mobile Support (Added Nov 2024)
- **Touch gestures:** Tap and drag to move charges
- **Two-finger touch:** Duplicate charge (equivalent to Shift+drag on desktop)
- **Touch targets:** 40px diameter hit detection for accessibility
- **No scroll conflicts:** Touch events prevent page scrolling during interactions
- **Visual feedback:** Orange highlight ring shows selected charge
- **Probe updates:** Electric field and potential readout updates on touch

#### Desktop Support
- **Mouse interactions:** Click and drag to move charges
- **Shift+drag:** Duplicate charge
- **Keyboard shortcuts:** (Future enhancement)

### Interactive Controls

#### Charge Placement
- **Add +1 µC:** Places positive charge near center
- **Add −1 µC:** Places negative charge near center
- **Edit magnitude:** Select charge, then change µC value in input field
- **Drag to move:** Click (or tap) and drag charges to reposition
- **Duplicate:** Shift+drag (desktop) or two-finger touch (mobile)
- **Delete:** Clear All button removes all charges

#### Display Options
- **Show Heatmap:** Toggle potential visualization (hot = high V, cool = low V)
- **Show Field Vectors:** Toggle electric field arrows
- **Auto Color Scale:** Automatically chooses good ±V range (90th percentile of |V|)
- **Manual Display Range:** Set custom ±V range when auto-scale is off
- **Simulate Flow:** Start/stop electron flow simulation with field lines
- **Measure Mode:** Click two charges to see distance, force, and midpoint values

#### Presets
- **Dipole:** Quick setup with +q and −q charges

### Probe (Cursor Readout)
- **Electric Field |E|:** Force per unit charge at cursor position (N/C)
- **Electric Potential V:** Energy per unit charge at cursor position (V)
- Updates continuously as cursor/finger moves over canvas

### Cloud Save/Load
- **Save:** Stores current scene and settings (Firebase if configured, localStorage fallback)
- **Load:** Retrieves saved scene and settings
- **Auto-save:** Automatically saves as you work (when Firebase configured)

### Guided Tour
- **Tutorial button:** Step-by-step walkthrough of all features
- Explains each control and physics concept
- Can be reopened at any time

## Technical Implementation

### Architecture

**Single-file HTML widget** (1090 lines):
- Self-contained: HTML + CSS + JavaScript in one file
- No external dependencies except Firebase SDK (optional)
- Canvas-based rendering for performance

### Key Components

#### Physics Engine (Lines 195-257)
```javascript
// Coulomb's constant
const k = 8.9875517923e9; // N m^2 / C^2

// Convert pixels to meters (1 px = 1 cm)
const meterPerPixel = 0.01;

// Softening parameter to avoid singularities
const soften = 0.01; // m

// Calculate E and V at any point
function E_and_V_at(x, y) {
  // Returns {Ex, Ey, V} using superposition
}
```

#### Heatmap Rendering (Lines 344-387)
- Fixed resolution: 480px wide for consistent quality
- Color gradient: deep blue → cyan → green → yellow → orange → red
- Gamma correction (γ=0.75) for better visual contrast
- Auto-scale uses 90th percentile of |V| for robust clipping
- 2V per band quantization for discrete color levels

#### Electron Simulation (Lines 427-469)
- Target: 280 particles on screen
- Spawn rate: 180 particles/second (constant)
- Movement: Velocity proportional to log(1 + |E|), capped at 1.2 px/frame
- Direction: Opposite to E field (negative charge behavior)
- Lifespan: 400-1200 frames per particle

#### Touch Event Handling (Lines 547-626)
```javascript
// Unified coordinate extraction for mouse + touch
function getCanvasCoords(e, canvas) {
  // Handles e.touches[0] and e.clientX/Y
}

// Event listeners for both input types
canvas.addEventListener('mousedown', handlePointerDown);
canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
```

### Performance Optimizations

1. **Heatmap Caching**
   - Only recomputes when charges change (`heatDirty` flag)
   - Offscreen canvas for image generation
   - Scales to full canvas size on render

2. **Field Vector Sampling**
   - Fixed 50px grid spacing
   - Adaptive arrow length based on field magnitude
   - Only draws visible vectors

3. **Electron Pool Management**
   - Constant spawn rate (not exponential)
   - Removes off-screen particles
   - Uses splice for efficient array management

4. **requestAnimationFrame Loop**
   - Single render loop for all animations
   - Delta time calculation for frame-rate independence

### State Management

**Global State Variables** (Lines 227-242):
```javascript
const charges = []; // {id, x, y, qMicroC, locked}
let selectedId = null;
let draggingId = null;
let heatCache = null;
let heatDirty = true;
let simRunning = false;
let electrons = [];
let measureActive = false;
```

**LocalStorage Persistence:**
- `e2_displayRangeV` — Manual display range value
- `e2_showHeat` — Heatmap visibility
- `e2_showVectors` — Field vectors visibility
- `e2_autoScale` — Auto-scale toggle state
- `e2_last_preset` — Last saved scene (fallback when Firebase unavailable)

**Firebase Cloud Sync** (Optional):
- `users/{uid}/electro_sessions/manual` — Manual save/load
- `users/{uid}/electro_sessions/auto` — Auto-save
- `users/{uid}/display_prefs/electro2` — Per-user display preferences
- `app_config/electro_defaults` — Shared default settings

## Known Issues & Limitations

### Fixed Issues (Nov 2024)
✅ Display range input now accepts manual values higher than current field amplitude
✅ Full mobile touch support added
✅ Touch target sizes meet accessibility standards (40px diameter)
✅ Visual selection feedback for mobile users
✅ iOS double-tap zoom prevention

### Current Limitations

1. **Architecture**
   - Monolithic 1090-line file (no module separation)
   - Global mutable state (testing difficult)
   - Render loop modifies DOM state (lines 369-371)

2. **Input Validation**
   - No bounds checking on charge magnitude
   - Accepts extreme values that may break physics calculations
   - No user feedback for invalid inputs

3. **Performance**
   - Heatmap recomputation on every input change (needs debouncing)
   - Autosave can fire excessively during rapid interactions

4. **UX**
   - No undo/redo functionality
   - No keyboard shortcuts
   - Measure mode has no visual cursor indicator

5. **Firebase Errors in Console**
   - When opened via `file://` protocol (local testing), Firebase throws errors
   - These are **expected and harmless** — localStorage fallback works perfectly
   - To eliminate errors: Deploy to web server or use local dev server

## Development Guidelines

### File Structure
```
electrostatics-2/
├── electrostatics-2.html    # Main widget (this file)
└── README.md                 # This documentation
```

### Testing Locally

**Option 1: Python HTTP Server**
```bash
cd public/static/physics/widgets/electrostatics-2/
python -m http.server 8000
# Visit: http://localhost:8000/electrostatics-2.html
```

**Option 2: Node.js HTTP Server**
```bash
npx http-server -p 8000
```

**Option 3: VS Code Live Server**
- Install "Live Server" extension
- Right-click `electrostatics-2.html` → "Open with Live Server"

**Option 4: Open Directly (Limited)**
- Double-click HTML file
- ⚠️ Firebase features won't work (`file://` protocol)
- ✅ All physics and UI features work fine
- ✅ LocalStorage fallback handles saves

### Making Changes

1. **Test on Multiple Devices**
   - Desktop Chrome, Firefox, Safari
   - Mobile Safari (iOS)
   - Chrome Android
   - Tablet devices

2. **Verify Core Features**
   - [ ] Charge placement and dragging
   - [ ] Display range manual input (values > current field)
   - [ ] Mobile touch gestures (drag, two-finger duplicate)
   - [ ] Probe readout updates
   - [ ] Heatmap rendering
   - [ ] Electron simulation
   - [ ] Measure mode
   - [ ] Save/load (localStorage fallback)

3. **Check Console for Errors**
   - Firebase errors are expected for `file://` protocol
   - No JavaScript errors should appear
   - Check mobile device console via browser dev tools

4. **Performance Testing**
   - Add 20+ charges and verify smooth rendering
   - Start simulation with many charges
   - Drag charges rapidly and check for lag

### Code Style

**Current Style:**
- Mix of single-line and multi-line functions
- Minimal comments (physics formulas self-documented)
- ES6+ features (arrow functions, const/let, destructuring)

**Recommendations for Future Work:**
- Run through Prettier for consistent formatting
- Add JSDoc comments for complex functions
- Extract magic numbers into named constants
- Split into modules: physics-engine.js, canvas-renderer.js, ui-controls.js

### Firebase Configuration

**Required Files:**
- `../../../../../../firebase-config.js` (relative path from widget)
- Exports `window.FIREBASE_CONFIG` object

**Firebase Structure:**
```javascript
window.FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  // ... other config
};
```

**Firestore Rules** (recommended):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /app_config/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## Educational Use

### Learning Objectives

Students will:
1. **Understand electric field as a vector field**
   - Direction shows force on positive charge
   - Magnitude decreases with distance (1/r²)
   - Superposition principle for multiple charges

2. **Understand electric potential as a scalar field**
   - High potential near positive charges
   - Low potential near negative charges
   - Magnitude decreases with distance (1/r)

3. **Relate E and V**
   - E points from high to low potential
   - Stronger field = steeper potential gradient
   - Mathematical relationship: E = -∇V

4. **Understand electron behavior**
   - Electrons move opposite to field direction
   - Accelerate in regions of strong field
   - Follow curved paths in non-uniform fields

### Suggested Activities

1. **Electric Dipole Exploration**
   - Use dipole preset
   - Observe field lines between charges
   - Identify regions where V = 0
   - Trace electron paths

2. **Field vs Potential Comparison**
   - Place single positive charge
   - Enable field vectors and heatmap
   - Compare 1/r² (field) vs 1/r (potential) behavior
   - Use probe to measure both at various distances

3. **Superposition Principle**
   - Place 3+ charges in a pattern
   - Predict field direction at a point
   - Use probe to verify prediction
   - Observe how contributions add vectorially

4. **Equipotential Lines**
   - Enable heatmap with auto-scale off
   - Observe color bands (equipotential regions)
   - Note: perpendicular to field lines
   - Simulate electrons and verify they cross equipotentials

5. **Quantitative Measurements**
   - Use measure mode on two charges
   - Verify F ∝ 1/r² (force law)
   - Check midpoint V and |E| values
   - Calculate expected vs observed values

## Troubleshooting

### "Display range input not working"
✅ **Fixed** — Should work now. If not, check:
- Auto-scale is turned OFF
- You're entering valid numbers
- Hard refresh page (Ctrl+Shift+R)

### "Not working on mobile"
✅ **Fixed** — Should work now. If not:
- Try Safari (iOS) or Chrome (Android)
- Ensure you're tapping charges directly
- Check console for JavaScript errors
- Try landscape orientation

### "Firebase errors in console"
✅ **Expected** when opening via `file://` protocol
- Not a bug — security restriction
- All features work via localStorage fallback
- To fix: Deploy to web server or use local dev server

### "Heatmap looks blocky"
✅ **Intentional** — Quantized color bands
- Represents discrete potential levels
- 2V per band for clarity
- Adjust display range to see more detail

### "Electrons disappear quickly"
- Increase `ELECTRON_TARGET_COUNT` (line 236)
- Increase lifespan range (line 443)
- Check if they're moving off-screen

### "Simulation is laggy"
- Reduce number of charges (< 20)
- Disable field vectors (computationally expensive)
- Lower `HEATMAP_RES_PX` (line 262) for faster recomputation

## Credits & License

**Original Author:** Unknown (codebase provided for review)  
**Mobile Support & Bug Fixes:** Added November 2024  
**Physics:** Based on Coulomb's law and superposition principle  
**Visual Design:** Clean, modern UI with professional styling  

**License:** Check project root LICENSE file

## Future Enhancements

### High Priority
- [ ] Add input validation with user feedback
- [ ] Implement proper debouncing on autosave and input handlers
- [ ] Fix render loop state mutation issue
- [ ] Add keyboard shortcuts (Delete, Ctrl+Z, Space, Escape)

### Medium Priority
- [ ] Split into modular architecture
- [ ] Implement proper state management pattern
- [ ] Add undo/redo functionality
- [ ] Rate limiting for Firestore operations

### Low Priority
- [ ] Add more presets (quadrupole, electric field lines, etc.)
- [ ] Export simulation as video/GIF
- [ ] 3D visualization mode
- [ ] Custom charge shapes (not just points)
- [ ] Multiple electron colors/types

## Contact & Support

For issues, questions, or contributions:
1. Check this README first
2. Review console errors (see Troubleshooting)
3. Test on web server (not `file://` protocol)
4. Contact course instructor or repository maintainer

---

**Last Updated:** November 17, 2024  
**Version:** 1.1 (Mobile support + bug fixes)  
**Status:** Production ready

