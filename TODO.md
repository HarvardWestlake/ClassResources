## Heatmap Tracking TODOs

This file tracks the implementation of client-only heatmap tracking that logs user interactions to Firestore, segmented by **module type** and **widget (widgetId)**.

We will work in **small, testable checkpoints**, doing roughly **two concrete tasks at a time**, then pausing so changes can be verified.

---

### Phase 0 – Planning and Setup

1. **Create project-wide TODO plan (this file) with checkpoints.**
   - Define phases, tasks, and expected outputs.
   - Call out when and how to test at each checkpoint.

2. **Confirm Firebase/Firestore setup strategy for the frontend.**
   - Use the Firebase Web SDK directly in the React app (no Cloud Functions).
   - Plan to store config via Vite env variables (`VITE_FIREBASE_*`).

**Checkpoint 0:**  
- `TODO.md` exists with a clear plan.  
- No app behavior has changed yet.

---

### Phase 1 – Firebase SDK and Initialization

3. **Add Firebase Web SDK dependency to the React app.**
   - Install `firebase` in `/app` via npm.
   - Ensure `package.json` and `package-lock.json` are updated.

4. **Create a typed Firebase initialization module.**
   - Add `src/firebase.ts` that:
     - Reads config from `import.meta.env.VITE_FIREBASE_*`.
     - Initializes `initializeApp` and exports `db` (Firestore instance).
     - Exports types for reuse if needed.

**Checkpoint 1 (Testable):**  
- `npm run build` (or `npm run dev`) succeeds.  
- `firebase.ts` compiles and can be imported without runtime errors (with dummy or real env vars).  
- No heatmap logic is live yet.

---

### Phase 2 – Event Types and Utilities

5. **Define TypeScript types for heatmap events.**
   - `ModuleType`, `DeviceType`, `HeatmapEventType`.
   - `HeatmapEvent` base with `sessionId`, `moduleType`, `widgetId`, `path`, timestamps.

6. **Implement coordinate and scroll normalization utilities.**
   - Compute `xNorm`, `yNorm` from click events.
   - Compute `scrollNorm` and document height.
   - Helpers to derive `deviceType` from viewport width.

**Checkpoint 2 (Testable):**  
- Types and utilities compile (no TS errors).  
- Simple unit-style usage (e.g., a dummy call in a small test file or console.log in dev) shows expected outputs.

---

### Phase 3 – Core Tracker Module

7. **Session management utility.**
   - Generate a random `sessionId` (e.g., `crypto.randomUUID()` fallback).
   - Persist to `localStorage` and reuse across visits.

8. **Event buffer and Firestore flush logic.**
   - In-memory `pendingEvents` array.
   - `enqueueEvent(event: HeatmapEvent)` API.
   - Timer-based flush (e.g., every 60–300s) plus `visibilitychange`/`beforeunload` handlers.
   - Use Firestore batch writes (`writeBatch`) for efficiency.

**Checkpoint 3 (Testable):**  
- Manually call `enqueueEvent` from a dev-only hook or console and confirm:  
  - Events appear in Firestore with expected shape.  
  - Buffer clears and flushes according to interval.

---

### Phase 4 – React App Integration (Page-Level)

9. **Integrate tracker with React router for page-view events.**
   - Add a hook (e.g., `usePageViewTracking`) that:
     - Watches location changes via `react-router-dom`.
     - Enqueues `page-view` events with `moduleType` and `path`.

10. **Global click + scroll listeners for the app shell.**
    - Attach listeners once (e.g., in a `TrackerProvider` or a top-level `useEffect` in `App.tsx` or `main.tsx`).
    - Capture click positions and scroll data.
    - Derive `moduleType` based on route or per-page mapping.

**Checkpoint 4 (Testable):**  
- Navigating within the React app creates `page-view` events in Firestore.  
- Clicking and scrolling on pages generates `click` and `scroll` events with a valid `moduleType` (e.g., `history`, `app`).

---

### Phase 5 – Module + Widget-Level Tracking

11. **Module segmentation mapping.**
    - Implement a small helper that maps paths to `ModuleType` (e.g., `"/history"` → `"history"`).
    - Ensure every React page sets a `moduleType`.

12. **Widget-level tracking in React.**
    - Decide on pattern:
      - (A) Use `data-widget-id` attributes on widget root elements and detect them in the global click handler, or
      - (B) Provide a hook like `useInteractionTracking({ moduleType, widgetId })` to scope events.
    - Implement at least one example widget (e.g., `WorldGlobe` or a history widget) with a `widgetId` so events can be filtered by widget.

**Checkpoint 5 (Testable):**  
- At least one React widget has a stable `widgetId`.  
- Firestore queries filtered by `moduleType` + `widgetId` show clicks only from that widget area.

---

### Phase 6 – Static Widget Integration (Optional / Phase 2)

13. **Shared tracker initialization for static HTML widgets under `public/`.**
    - Build a small `heatmap-tracker.js` bundle that:
      - Initializes Firebase (reusing config).
      - Exposes `initHeatmapTracking({ moduleType, widgetId })`.

14. **Wire one example static widget.**
    - Add `data-module-type` on `<body>` and `data-widget-id` on the widget root.
    - Call `initHeatmapTracking({ moduleType: 'math', widgetId: 'cubic-sequences' })`.

**Checkpoint 6 (Testable):**  
- Interacting with the chosen static widget logs events under the correct `moduleType` + `widgetId`.  
- React app tracking remains unaffected.

---

### Phase 7 – Documentation and Query Examples

15. **Document usage for future development.**
    - Briefly describe how to:
      - Tag new pages with `moduleType`.
      - Tag new widgets with `widgetId`.
      - Use the tracker hook(s) or utilities.

16. **Add Firestore query examples for analysis.**
    - Example queries by `moduleType`, `widgetId`, date range.
    - Notes on indexing and cost considerations.

**Checkpoint 7 (Testable):**  
- Documentation exists and is internally consistent with the implementation.  
- You can run at least one example query (via Firestore console or code) to inspect module/widget-level interactions.


