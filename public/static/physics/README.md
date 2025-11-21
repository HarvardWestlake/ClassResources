# Physics Interactive Widgets

Collection of interactive physics visualization tools for educational purposes.

## Available Widgets

### Electromagnetism

#### [Electrostatics 2 — Equipotentials & Electron Flow](./widgets/electrostatics-2/)
Interactive visualization of electric fields, electric potentials, and electron flow from point charges.

**Features:**
- Place and drag positive/negative charges
- Hot-to-cool potential heatmap visualization
- Electric field vector display
- Electron flow simulation along field lines
- Real-time field and potential probe
- Distance and force measurements between charges
- **Full mobile support** with touch gestures
- Guided tutorial walkthrough
- Cloud save/load with localStorage fallback

**Physics Concepts:**
- Electric field: E = k·q/r² (force per unit charge)
- Electric potential: V = k·q/r (energy per unit charge)
- Superposition principle
- Vector vs scalar fields
- Electron behavior in electric fields

**Best For:**
- AP Physics C: Electricity & Magnetism
- University introductory E&M courses
- Self-study of electrostatics
- Visual learners exploring abstract field concepts

**Status:** ✅ Production ready (Mobile support added Nov 2024)

---

## Coming Soon

### Kinematics Visualizer
Explore 1D and 2D motion with position, velocity, and acceleration graphs. Interactive parameter controls for kinematic equations.

### Optics Ray Tracer
Trace light rays through lenses and mirrors. Visualize refraction, reflection, and image formation.

### Wave Interference
Simulate constructive and destructive interference of waves. Explore double-slit experiment and diffraction patterns.

### Simple Harmonic Motion
Visualize springs, pendulums, and oscillating systems. See energy transformations and phase relationships.

---

## Widget Standards

### Technical Requirements

All widgets in this collection follow these standards:

1. **Self-Contained**
   - Single HTML file (or HTML + minimal JS/CSS files)
   - No external framework dependencies (vanilla JS preferred)
   - Firebase SDK optional for cloud features

2. **Responsive Design**
   - Works on desktop (1920×1080 and down)
   - Works on tablet (landscape and portrait)
   - Works on mobile (iOS Safari, Chrome Android)
   - Minimum touch target size: 44×44 px (Apple/Google guidelines)

3. **Accessibility**
   - Touch gestures for mobile interactions
   - Keyboard shortcuts for power users
   - Clear labels and tooltips
   - High contrast color schemes
   - ARIA labels where appropriate

4. **User Experience**
   - Guided tutorial/tour for first-time users
   - Intuitive controls without documentation
   - Visual feedback for all interactions
   - Save/load functionality (localStorage minimum)
   - Undo/redo for destructive actions (when applicable)

5. **Performance**
   - 60 FPS target for animations
   - < 3 second load time
   - Efficient canvas rendering
   - Debounced expensive operations
   - Works smoothly with 20+ interactive elements

### Code Quality Standards

1. **Documentation**
   - Comprehensive README.md in widget folder
   - Inline comments for complex physics/math
   - JSDoc for public functions (future enhancement)
   - Clear variable names (no single letters except loop indices)

2. **Testing**
   - Manual testing checklist in README
   - Cross-browser verification (Chrome, Firefox, Safari)
   - Mobile device testing (iOS, Android)
   - Edge case handling (extreme values, 0, infinity)

3. **Maintenance**
   - Follow existing code style in the project
   - No console errors (except expected Firebase warnings for file://)
   - Graceful error handling with user-friendly messages
   - localStorage fallback when cloud unavailable

---

## Development Workflow

### Adding a New Widget

1. **Create Widget Folder**
   ```
   public/static/physics/widgets/your-widget-name/
   ├── your-widget-name.html    # Main widget file
   ├── your-widget-name.js      # (Optional) Separate JavaScript
   ├── your-widget-name.css     # (Optional) Separate styles
   └── README.md                # Documentation
   ```

2. **Widget Structure**
   - Follow the pattern in `electrostatics-2/`
   - Self-contained HTML file preferred
   - Include guided tour/tutorial
   - Add save/load functionality

3. **Documentation**
   - Create comprehensive README.md
   - Include physics concepts covered
   - List learning objectives
   - Provide suggested classroom activities
   - Document all interactive controls
   - Add troubleshooting section

4. **Update Physics Index**
   - Add widget card to `index.html`
   - Include description and key concepts
   - Link to widget folder

5. **Testing Checklist**
   - [ ] Works on desktop (Chrome, Firefox, Safari)
   - [ ] Works on mobile (iOS Safari, Chrome Android)
   - [ ] Touch gestures functional
   - [ ] No console errors (except expected Firebase)
   - [ ] Save/load works (localStorage minimum)
   - [ ] Tutorial/tour is complete and helpful
   - [ ] README.md is comprehensive

### Local Development

**Option 1: Python HTTP Server**
```bash
cd public/static/physics/
python -m http.server 8000
# Visit: http://localhost:8000/
```

**Option 2: Node.js HTTP Server**
```bash
npx http-server -p 8000
```

**Option 3: VS Code Live Server**
- Install "Live Server" extension
- Right-click any HTML file → "Open with Live Server"

**Option 4: Firebase Hosting**
```bash
# From project root
firebase serve
# Visit: http://localhost:5000/static/physics/
```

### File Organization

```
public/static/physics/
├── index.html                    # Main physics landing page
├── README.md                     # This file
└── widgets/
    ├── electrostatics-2/
    │   ├── electrostatics-2.html
    │   └── README.md
    ├── kinematics-visualizer/    # (Future)
    └── optics-ray-tracer/        # (Future)
```

---

## Educational Philosophy

### Learning Through Interaction

These widgets are designed to:
1. **Visualize abstract concepts** — Make invisible fields and forces visible
2. **Enable exploration** — Students discover relationships through experimentation
3. **Provide immediate feedback** — See results of changes instantly
4. **Support multiple learning styles** — Visual, kinesthetic, and analytical learners
5. **Encourage hypothesis testing** — "What if I do this?" mentality

### Pedagogical Principles

1. **Constructivism**
   - Students build understanding through hands-on experimentation
   - Discovery-based learning over passive observation

2. **Scaffolding**
   - Guided tours introduce features step-by-step
   - Presets provide starting points
   - Complexity increases gradually

3. **Authentic Assessment**
   - Open-ended exploration tasks
   - Prediction-then-observation activities
   - Quantitative measurement challenges

4. **Universal Design for Learning (UDL)**
   - Multiple representations (visual, numerical, textual)
   - Multiple means of interaction (mouse, touch, keyboard)
   - Multiple levels of challenge (presets to custom scenarios)

---

## Classroom Integration

### Suggested Uses

1. **Direct Instruction**
   - Teacher demonstrates concepts using widget
   - Projects on screen for whole-class discussion
   - Live manipulation during lecture

2. **Guided Lab Activities**
   - Students follow structured exploration guide
   - Worksheet with prediction-observation-explanation
   - Data collection and analysis

3. **Independent Practice**
   - Homework assignment with widget
   - Self-paced learning module
   - Review and reinforcement

4. **Assessment**
   - Open-ended exploration tasks
   - "Explain this observation" challenges
   - Quantitative problem-solving

### Technical Requirements for Classroom

**Minimum:**
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection (for loading widget)
- Mouse/trackpad or touchscreen

**Recommended:**
- 1920×1080 display (or larger) for projection
- Tablets/iPads for individual student use
- Stylus for precise interaction on touch devices

**Optional:**
- Firebase configuration for cloud save/load
- Individual student accounts for tracking progress

---

## Contributing

### Reporting Issues

1. Check widget's README.md first
2. Verify issue on web server (not `file://` protocol)
3. Test on multiple browsers/devices
4. Include steps to reproduce
5. Attach screenshots if visual issue

### Submitting Widgets

1. Follow widget standards (see above)
2. Create comprehensive README.md
3. Test thoroughly (see testing checklist)
4. Submit pull request with:
   - Widget files in proper folder structure
   - Updated physics/index.html
   - Description of physics concepts covered

### Code Style

- Follow existing patterns in the codebase
- Use meaningful variable names
- Comment complex physics calculations
- Keep functions focused and small (< 50 lines)
- Prefer readability over cleverness

---

## Resources

### Physics References
- [Khan Academy Physics](https://www.khanacademy.org/science/physics)
- [The Physics Classroom](https://www.physicsclassroom.com/)
- [HyperPhysics](http://hyperphysics.phy-astr.gsu.edu/)

### Web Development
- [MDN Web Docs](https://developer.mozilla.org/)
- [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [Touch Events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events)

### Educational Tech
- [Universal Design for Learning](https://udlguidelines.cast.org/)
- [WCAG Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

## License

See project root LICENSE file.

---

## Contact

For questions, contributions, or support:
- Check individual widget README.md files
- Review this documentation
- Contact course instructor or repository maintainer

---

**Last Updated:** November 17, 2024  
**Widgets:** 1 (Electrostatics 2)  
**Status:** Active development

