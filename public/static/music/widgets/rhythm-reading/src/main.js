import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import './styles.css';

(function () {
    // Constants and helpers
    const TICKS_PER_QUARTER = 12; // support triplets and standard subdivisions
    const STORAGE_KEY = 'rhythm_practice_settings_v1';

    const difficultyConfig = {
        easy: {
            restChance: 0.08,
            toleranceMs: 180,
            firstBeatBonusMs: 90,
            tripletChance: 0,
            syncopationChance: 0.05,
            avoidRepeatMax: 4,
            minNotesPerBeat: 1
        },
        medium: {
            restChance: 0.12,
            toleranceMs: 120,
            firstBeatBonusMs: 60,
            tripletChance: 0.25,
            syncopationChance: 0.12,
            avoidRepeatMax: 2,
            minNotesPerBeat: 1
        },
        hard: {
            restChance: 0.06,
            toleranceMs: 70,
            firstBeatBonusMs: 45,
            tripletChance: 0.45,
            syncopationChance: 0.2,
            avoidRepeatMax: 2,
            minNotesPerBeat: 0
        }
    };

    function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function parseTimeSig(ts) { const [n, d] = ts.split('/').map(Number); return { n, d }; }
    function saveSettings(obj) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); } catch { } }
    function loadSettings() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; } }

    // DOM
    const el = {
        bpm: document.getElementById('bpm'),
        measures: document.getElementById('measures'),
        timeSig: document.getElementById('timeSig'),
        difficulty: document.getElementById('difficulty'),
        metronome: document.getElementById('metronome'),
        beatMarker: document.getElementById('beatMarker'),
        guideClicks: document.getElementById('guideClicks'),
        btnGenerate: document.getElementById('generate'),
        btnPlay: document.getElementById('play'),
        btnStop: document.getElementById('stop'),
        btnReset: document.getElementById('reset'),
        sheet: document.getElementById('sheet'),
        canvasWrap: document.querySelector('.canvas-wrap'),
        startOverlay: document.getElementById('startOverlay'),
        startHint: document.getElementById('startHint'),
        countInOverlay: document.getElementById('countInOverlay'),
        countInNumber: document.getElementById('countInNumber'),
        summaryOverlay: document.getElementById('summaryOverlay'),
        summaryRetry: document.getElementById('summaryRetry'),
        summaryContinue: document.getElementById('summaryContinue'),
        timingChart: document.getElementById('timingChart'),
        statAcc: document.getElementById('stat-acc'),
        statHits: document.getElementById('stat-hits'),
        statMiss: document.getElementById('stat-miss'),
        statCombo: document.getElementById('stat-combo'),
        progressFill: document.getElementById('progressFill'),
        feedback: document.getElementById('timingFeedback')
    };

    // Tutorials UI elements
    el.openTutorials = document.getElementById('openTutorials');
    el.tutorialsOverlay = document.getElementById('tutorialsOverlay');
    el.tutorialList = document.getElementById('tutorialList');
    el.tutorialsBack = document.getElementById('tutorialsBack');

    function isVisible(node) {
        if (!node) return false;
        const d = window.getComputedStyle(node).display;
        return d !== 'none';
    }

    // Canvas setup - optimize for performance
    const ctx = el.sheet.getContext('2d', {
        alpha: true, // Keep transparency for proper rendering
        desynchronized: true // Better performance on low-end devices
    });
    // Optimize canvas rendering - use medium quality for better smoothness
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium'; // Better quality for smoother rendering
    // Admin palette for high-contrast staff/notes
    const getCssVar = (name, fallback) => {
        const v = getComputedStyle(document.documentElement).getPropertyValue(name);
        return (v && v.trim()) || fallback;
    };
    const palette = {
        note: getCssVar('--hw-black', '#231f20'),
        staff: getCssVar('--hw-gray-600', '#6b7280'),
        bar: getCssVar('--hw-gray-800', '#374151'),
        text: '#000',
        muted: getCssVar('--hw-gray-700', '#4b5563'),
        playhead: getCssVar('--hw-red', '#c8102e'),
        axis: getCssVar('--hw-gray-500', '#9ca3af'),
        grid: getCssVar('--hw-gray-300', '#e5e7eb')
    };
    function colorForState(state) {
        if (state === 'good') return 'rgba(34,197,94,1)';
        if (state === 'miss') return 'rgba(239,68,68,1)';
        if (state === 'bad') return 'rgba(245,158,11,1)';
        return palette.note;
    }
    let canvasWidth = 0, canvasHeight = 0, dpr = 1;
    // Cache canvas wrap element
    let canvasWrapCache = null;

    // Performance: Cap DPR at 2 for better performance on high-DPI devices
    const getDPR = () => Math.min(2, Math.max(1, Math.floor(window.devicePixelRatio || 1)));

    function getMeasuresPerRow() {
        // Determine number of measures per row responsively (1..4)
        const leftPad = 64, rightPad = 12;
        const usable = Math.max(100, canvasWidth - leftPad - rightPad);
        // Adaptive minMeasurePx based on screen size
        const isMobile = window.innerWidth < 768;
        const minMeasurePx = isMobile ? 180 : 240;
        const mpr = Math.floor(usable / minMeasurePx);
        return Math.max(1, Math.min(4, mpr));
    }
    function sizeCanvasWrap() {
        if (!canvasWrapCache) {
            canvasWrapCache = document.querySelector('.canvas-wrap');
        }
        const wrap = canvasWrapCache;
        if (!wrap) return;
        const rect = wrap.getBoundingClientRect();
        const bottomPad = 20;
        // Better viewport handling for all aspect ratios
        const viewportHeight = window.innerHeight;
        const isPortrait = viewportHeight > window.innerWidth;
        const h = isPortrait
            ? Math.max(240, Math.floor(viewportHeight - rect.top - bottomPad))
            : Math.max(300, Math.floor(viewportHeight - rect.top - bottomPad));
        wrap.style.height = `${h}px`;
    }

    // Throttle resize handler for performance (but keep it responsive)
    let resizeTimeout = null;
    const RESIZE_THROTTLE_MS = 100; // Reduced from 150 for better responsiveness

    function resizeCanvas() {
        // Clear pending resize
        if (resizeTimeout) {
            clearTimeout(resizeTimeout);
            resizeTimeout = null;
        }

        sizeCanvasWrap();
        const rect = el.sheet.getBoundingClientRect();
        // Responsive min width based on screen size
        const isMobile = window.innerWidth < 768;
        canvasWidth = Math.max(isMobile ? 320 : 600, Math.floor(rect.width));
        // Dynamic height based on rows (max 4 measures per row)
        const lineSpacing = 16;
        const topPad = 28;
        const bottomPad = 36;
        let computedHeight = 280;
        if (pattern) {
            const staffHeight = lineSpacing * 4;
            const measuresPerRow = getMeasuresPerRow();
            const measureTicks = pattern.ticksPerBeat * pattern.timeSig.beatsPerMeasure;
            const totalMeasures = Math.ceil(pattern.totalTicks / measureTicks);
            const numRows = Math.max(1, Math.ceil(totalMeasures / measuresPerRow));
            const rowStride = staffHeight + 60;
            computedHeight = topPad + numRows * rowStride + bottomPad;
        }
        canvasHeight = computedHeight;
        dpr = getDPR();
        el.sheet.width = canvasWidth * dpr;
        el.sheet.height = canvasHeight * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        // Force next draw to recenter auto-scroll after layout changes
        autoScrollRow = -1;
        drawSheet();
    }

    // Debounced resize wrapper
    function debouncedResize() {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(resizeCanvas, RESIZE_THROTTLE_MS);
    }
    window.addEventListener('resize', debouncedResize, { passive: true });

    // Audio engine - optimized for performance
    let audioCtx = null;
    async function ensureAudio() {
        if (!audioCtx) {
            // Use sample rate appropriate for device (lower = better performance)
            const sampleRate = 44100; // Standard, good balance
            audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate });
        }
        if (audioCtx.state !== 'running') {
            try { await audioCtx.resume(); } catch { }
        }
    }
    let scheduledMetronome = [];
    let scheduledGuides = [];
    function clickAt(time, isAccent) {
        if (!el.metronome.checked) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(isAccent ? 1000 : 800, time);
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(0.25, time + 0.001);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(time);
        osc.stop(time + 0.12);
        scheduledMetronome.push({ osc, gain, stopAt: time + 0.12 });
    }

    function guideClickAt(time) {
        if (!el.guideClicks || !el.guideClicks.checked) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1200, time);
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(0.22, time + 0.001);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(time);
        osc.stop(time + 0.12);
        scheduledGuides.push({ osc, gain, stopAt: time + 0.12 });
    }

    function playTapClick() {
        if (!audioCtx) return;
        const t = audioCtx.currentTime + 0.001;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(3000, t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.18, t + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.08);
    }

    function stopAllScheduledMetronome(nowTime) {
        const now = nowTime ?? (audioCtx ? audioCtx.currentTime : 0);
        for (const ev of scheduledMetronome) {
            try {
                ev.osc.stop(now + 0.001);
                ev.gain.disconnect();
            } catch { }
        }
        scheduledMetronome = [];
    }

    function stopAllScheduledGuides(nowTime) {
        const now = nowTime ?? (audioCtx ? audioCtx.currentTime : 0);
        for (const ev of scheduledGuides) {
            try {
                ev.osc.stop(now + 0.001);
                ev.gain.disconnect();
            } catch { }
        }
        scheduledGuides = [];
    }

    // State
    let pattern = null; // { measures, timeSig, totalTicks, items: [{startTick, durTicks, isRest, state, hitDeltaMs}], ticksPerBeat }
    let schedule = null; // { startTime, events: [seconds], endTime, countInBeats }
    let isPlaying = false;
    let rafId = 0;
    let nextEventIdx = 0;
    let stats = { hits: 0, misses: 0, combo: 0 };
    let maxCombo = 0;
    let accSamples = []; // {t: secondsFromStart, acc: 0..1}
    let timingPlot = null; // uPlot instance for summary
    let timingResizeHandler = null;
    // Live timing plot (real-time) state
    let livePlot = null;
    let livePlotResizeHandler = null;
    let liveX = [];
    let liveY = [];
    let liveIndexByItem = new Map(); // pattern.items index -> live series index
    let autoScrollRow = -1;
    let lastHitAtSec = -Infinity;
    const HIT_COOLDOWN_SEC = 0.12;
    // tap markers removed

    // Tutorial mode
    let tutorialMode = false;
    let currentTutorialId = null;

    // Pattern generation
    function generatePattern() {
        // reset repetition tracking
        generatePattern._prevDur = null;
        generatePattern._repeatCount = 0;
        const bpm = clamp(Number(el.bpm.value || 100), 30, 240);
        const allowedMeasures = [1, 4, 16, 32];
        let mInput = Number(el.measures.value || 4);
        const measures = allowedMeasures.includes(mInput) ? mInput : 4;
        const { n: beatsPerMeasure, d: beatNote } = parseTimeSig(el.timeSig.value);
        const diff = difficultyConfig[el.difficulty.value] || difficultyConfig.easy;

        const ticksPerBeat = Math.round((4 / beatNote) * TICKS_PER_QUARTER);
        const measureTicks = beatsPerMeasure * ticksPerBeat;
        const items = [];
        const ts = { beatsPerMeasure, beatNote };
        const beamGroupTicks = (beatNote === 8 && (beatsPerMeasure % 3 === 0))
            ? ticksPerBeat * 3
            : ticksPerBeat;

        // Define duration palette based on difficulty
        // Durations defined relative to a quarter note grid to avoid rounding artifacts
        const Q = TICKS_PER_QUARTER;
        const DUR = {
            whole: Q * 4,            // 48
            half: Q * 2,             // 24
            quarter: Q,              // 12
            eighth: Math.round(Q / 2),        // 6
            tripletEighth: Math.round(Q / 3), // 4 (simple meters only)
            dottedQuarter: Math.round(Q * 1.5),  // 18
            dottedEighth: Math.round(Q * 0.75)   // 9
        };

        const isSimpleMeter = (beatNote === 2 || beatNote === 4);

        for (let m = 0; m < measures; m++) {
            // reset repetition tracking at each measure boundary to allow 4 quarters cleanly
            generatePattern._prevDur = null;
            generatePattern._repeatCount = 0;
            let t = 0;
            let notesInBeat = 0;
            while (t < measureTicks) {
                const posInMeasure = m * measureTicks + t;
                const inBeat = t % ticksPerBeat;
                if (inBeat === 0) notesInBeat = 0;

                if (diff.tripletChance > 0 && isSimpleMeter && inBeat === 0 && (measureTicks - t) >= ticksPerBeat && Math.random() < diff.tripletChance) {
                    // Insert an eighth-note triplet group for this beat, sometimes with missing notes
                    const tripletRestProb = Math.max(0.2, diff.restChance);
                    const restFlags = [0, 1, 2].map(() => Math.random() < tripletRestProb);
                    if (restFlags.every(v => v)) {
                        // Ensure at least one note present
                        const keepIdx = Math.floor(Math.random() * 3);
                        restFlags[keepIdx] = false;
                    }
                    let localNotes = 0;
                    for (let i = 0; i < 3; i++) {
                        const isRest = !!restFlags[i];
                        items.push({ startTick: m * measureTicks + t, durTicks: DUR.tripletEighth, isRest, state: 'pending', hitDeltaMs: null, isTriplet: true, isDotted: false });
                        t += DUR.tripletEighth;
                        if (!isRest) localNotes++;
                    }
                    // Triplet spans the whole beat
                    notesInBeat = localNotes;
                    continue;
                }

                // Build allowed durations for this difficulty
                let allowed = [];
                if (el.difficulty.value === 'easy') {
                    allowed = [DUR.whole, DUR.half, DUR.quarter, DUR.eighth];
                } else if (el.difficulty.value === 'medium') {
                    allowed = [DUR.half, DUR.quarter, DUR.eighth];
                } else {
                    // hard: allow dotted values as well
                    allowed = [DUR.quarter, DUR.eighth, DUR.dottedQuarter, DUR.dottedEighth, DUR.half];
                }

                // Filter to fit remaining measure
                allowed = allowed.filter(dur => t + dur <= measureTicks);
                // Avoid crossing beam-group for short values only
                allowed = allowed.filter(dur => (dur >= ticksPerBeat) || (((t % beamGroupTicks) + dur) <= beamGroupTicks));

                if (allowed.length === 0) {
                    const remaining = measureTicks - t;
                    // Fill remainder as a rest to avoid creating sub-eighth notes
                    items.push({ startTick: m * measureTicks + t, durTicks: remaining, isRest: true, state: 'pending', hitDeltaMs: null, isTriplet: false, isDotted: false });
                    t += remaining;
                    continue;
                }

                // Optional syncopation on beat: rest then note inside the beat
                const remainingBeat = ticksPerBeat - inBeat;
                if (inBeat === 0 && diff.syncopationChance > 0 && Math.random() < diff.syncopationChance && allowed.includes(DUR.eighth) && remainingBeat >= DUR.eighth * 2) {
                    // Off-beat: rest eighth, then note eighth
                    items.push({ startTick: m * measureTicks + t, durTicks: DUR.eighth, isRest: true, state: 'pending', hitDeltaMs: null, isTriplet: false, isDotted: false });
                    t += DUR.eighth;
                    items.push({ startTick: m * measureTicks + t, durTicks: DUR.eighth, isRest: false, state: 'pending', hitDeltaMs: null, isTriplet: false, isDotted: false });
                    t += DUR.eighth;
                    notesInBeat += 1;
                    continue;
                }

                // Weighted pick to keep 16ths occasional on medium, common on hard
                function pickDuration() {
                    const pool = [];
                    for (const d of allowed) {
                        let w = 1;
                        if (d === DUR.quarter) w = (el.difficulty.value === 'easy') ? 5 : 3;
                        else if (d === DUR.eighth) w = 3;
                        else if (d === DUR.dottedQuarter || d === DUR.dottedEighth) w = (el.difficulty.value === 'hard') ? 2 : 1;
                        else if (d === DUR.half) w = 2;
                        // prevent zero weight
                        if (w > 0) for (let i = 0; i < w; i++) pool.push(d);
                    }
                    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : allowed[0];
                }

                let dur = pickDuration();

                // Bias towards quarters on easy
                if (el.difficulty.value === 'easy' && dur !== DUR.quarter && Math.random() < 0.85 && allowed.includes(DUR.quarter)) {
                    dur = DUR.quarter;
                }

                // Reduce repetition: avoid too many identical durations back-to-back
                if (!generatePattern._prevDur) generatePattern._prevDur = null;
                if (generatePattern._repeatCount == null) generatePattern._repeatCount = 0;
                if (generatePattern._prevDur === dur) {
                    generatePattern._repeatCount += 1;
                    if (generatePattern._repeatCount >= (diff.avoidRepeatMax || 3)) {
                        const others = allowed.filter(d => d !== dur);
                        if (others.length) dur = others[Math.floor(Math.random() * others.length)];
                        generatePattern._repeatCount = 0;
                    }
                } else {
                    generatePattern._repeatCount = 0;
                }
                generatePattern._prevDur = dur;

                // Enforce at least one note per beat on easier difficulties
                let isRest = Math.random() < diff.restChance;
                if (diff.minNotesPerBeat > 0 && isRest && (inBeat + dur === ticksPerBeat) && notesInBeat === 0) {
                    // This would end the beat with zero notes → force a note
                    isRest = false;
                }
                const isDotted = (dur === DUR.dottedQuarter) || (dur === DUR.dottedEighth);
                items.push({ startTick: m * measureTicks + t, durTicks: dur, isRest, state: 'pending', hitDeltaMs: null, isTriplet: false, isDotted });
                t += dur;
                if (!isRest) notesInBeat += 1;
            }
        }

        pattern = { measures, timeSig: { beatsPerMeasure, beatNote }, totalTicks: measures * measureTicks, items, ticksPerBeat };
        nextEventIdx = items.findIndex(i => !i.isRest);
        if (nextEventIdx < 0) nextEventIdx = 0;
        stats = { hits: 0, misses: 0, combo: 0 };
        // Reset cached total targets for new pattern
        cachedTotalTargets = items.filter(i => !i.isRest).length;
        updateStats();
        buildSchedule();
        // Ensure canvas resizes to new multi-row height before drawing
        resizeCanvas();
    }

    // Build schedule from pattern and settings
    function buildSchedule() {
        if (!pattern) return;
        const bpm = clamp(Number(el.bpm.value || 100), 30, 240);
        const secondsPerQuarter = 60 / bpm;
        const secondsPerTick = secondsPerQuarter / TICKS_PER_QUARTER;

        const countInBeats = pattern.timeSig.beatsPerMeasure;
        const events = pattern.items.map(it => it.startTick * secondsPerTick);
        const durationSeconds = pattern.totalTicks * secondsPerTick;
        schedule = { startTimeAudio: 0, startTimeVisual: 0, events, endTimeAudio: 0, endTimeVisual: 0, countInBeats, secondsPerTick, secondsPerQuarter };
    }

    // Playback
    async function startPlayback() {
        if (!pattern) generatePattern();
        await ensureAudio();
        buildSchedule();
        const nowAudio = audioCtx.currentTime;
        const nowVisual = performance.now() / 1000;
        const { beatsPerMeasure } = pattern.timeSig;
        const secondsPerBeat = schedule.secondsPerQuarter * (4 / pattern.timeSig.beatNote);
        const baseTimeAudio = nowAudio + 0.15;
        const baseTimeVisual = nowVisual + 0.15;
        const countInBeats = beatsPerMeasure;
        schedule.startTimeAudio = baseTimeAudio + countInBeats * secondsPerBeat;
        schedule.endTimeAudio = schedule.startTimeAudio + (pattern.totalTicks * schedule.secondsPerTick);
        schedule.startTimeVisual = baseTimeVisual + countInBeats * secondsPerBeat;
        schedule.endTimeVisual = schedule.startTimeVisual + (pattern.totalTicks * schedule.secondsPerTick);

        // Reset states
        pattern.items.forEach(i => { i.state = 'pending'; i.hitDeltaMs = null; });
        stats = { hits: 0, misses: 0, combo: 0 };
        maxCombo = 0;
        accSamples = [];
        autoScrollRow = -1;
        nextEventIdx = pattern.items.findIndex(i => !i.isRest);
        if (nextEventIdx < 0) nextEventIdx = 0;
        updateStats();
        el.progressFill.style.width = '0%';
        if (el.startOverlay) el.startOverlay.style.display = 'none';
        if (el.canvasWrap) el.canvasWrap.style.overflowY = 'auto';

        // Initialize live timing plot series (non-rest notes only) when NOT in tutorial mode
        if (!tutorialMode) {
            liveIndexByItem = new Map();
            const noteItems = [];
            for (let i = 0, k = 0; i < pattern.items.length; i++) {
                const it = pattern.items[i];
                if (it.isRest) continue;
                liveIndexByItem.set(i, k++);
                noteItems.push(it);
            }
            liveX = noteItems.map((_, i) => i + 1);
            liveY = new Array(liveX.length).fill(null);
            initLivePlot(liveX.length);
        }

        // Clear any prior scheduled clicks before scheduling new ones
        stopAllScheduledMetronome(nowAudio);
        stopAllScheduledGuides(nowAudio);

        // Count-in clicks + visual (skip main overlay in tutorial mode)
        let t = baseTimeAudio;
        if (!tutorialMode && el.countInOverlay) {
            el.countInOverlay.style.display = 'flex';
            // Anchor count-in near the first measure on the sheet
            if (el.countInNumber) {
                el.countInOverlay.style.alignItems = 'flex-start';
                el.countInOverlay.style.justifyContent = 'flex-start';
                const leftPad = 64; // match drawSheet
                const topPad = 40;  // match drawSheet
                el.countInNumber.style.position = 'absolute';
                el.countInNumber.style.left = `${leftPad}px`;
                el.countInNumber.style.top = `${topPad}px`;
            }
        }
        for (let b = 0; b < beatsPerMeasure; b++) {
            clickAt(t, b === 0);
            if (!tutorialMode && el.countInNumber) {
                // Update number shortly before the click
                const displayAt = t - 0.01;
                setTimeout(() => {
                    el.countInNumber.textContent = String(beatsPerMeasure - b);
                }, Math.max(0, (displayAt - audioCtx.currentTime) * 1000));
            }
            t += secondsPerBeat;
        }
        // Hide number at start
        setTimeout(() => {
            if (!tutorialMode && el.countInOverlay) el.countInOverlay.style.display = 'none';
            if (!tutorialMode && el.countInNumber) el.countInNumber.textContent = '';
        }, Math.max(0, (schedule.startTimeAudio - audioCtx.currentTime) * 1000));

        // Measure + beats over entire piece (metronome sound gated inside clickAt)
        let totalBeats = Math.round(pattern.totalTicks / pattern.ticksPerBeat);
        t = schedule.startTimeAudio;
        for (let b = 0; b <= totalBeats + 1; b++) {
            clickAt(t, (b % beatsPerMeasure) === 0);
            t += secondsPerBeat;
            if (t > schedule.endTimeAudio + 0.5) break;
        }

        // Guide clicks at each note event (non-rest)
        for (const it of pattern.items) {
            if (it.isRest) continue;
            const et = schedule.startTimeAudio + it.startTick * schedule.secondsPerTick;
            guideClickAt(et);
        }

        isPlaying = true;
        loop();
    }

    function stopPlayback() {
        isPlaying = false;
        if (rafId) cancelAnimationFrame(rafId);
        if (audioCtx) stopAllScheduledMetronome(audioCtx.currentTime);
        if (audioCtx) stopAllScheduledGuides(audioCtx.currentTime);
        if (audioCtx && audioCtx.state === 'running') {
            // Keep context for next play to avoid iOS relock; do not close
        }

        if (el.startOverlay) el.startOverlay.style.display = tutorialMode ? 'none' : 'flex';
        if (el.canvasWrap) { el.canvasWrap.scrollTop = 0; el.canvasWrap.style.overflowY = 'hidden'; }
        // Ensure no scheduled sounds remain
        if (audioCtx) stopAllScheduledMetronome(audioCtx.currentTime);
        if (audioCtx) stopAllScheduledGuides(audioCtx.currentTime);
        // Stop tutorial playhead if active
        try { if (typeof stopTutorialBeat === 'function') stopTutorialBeat(); } catch { }
        drawSheet();

        // Destroy live plot overlay if present
        try { if (livePlot) livePlot.destroy(); } catch { }
        livePlot = null;
        if (livePlotResizeHandler) {
            window.removeEventListener('resize', livePlotResizeHandler);
            livePlotResizeHandler = null;
        }
        const liveWrap = document.getElementById('liveTimingWrap');
        if (liveWrap && liveWrap.parentElement) liveWrap.parentElement.removeChild(liveWrap);
    }

    function loop() {
        if (!isPlaying) return;
        const audioRunning = audioCtx && audioCtx.state === 'running';
        const now = audioRunning ? audioCtx.currentTime : (performance.now() / 1000);
        const startSec = audioRunning ? schedule.startTimeAudio : schedule.startTimeVisual;
        const endSec = audioRunning ? schedule.endTimeAudio : schedule.endTimeVisual;
        const t = now - startSec;
        const progress = clamp(t / (endSec - startSec), 0, 1);

        // Update progress bar (smooth updates)
        if (el.progressFill) {
            el.progressFill.style.width = `${(progress * 100).toFixed(1)}%`;
        }

        // Sample accuracy approx 20Hz (cumulative: hits / (hits + misses))
        if (!accSamples._last || now - accSamples._last >= 0.05) {
            accSamples._last = now;
            const attempts = stats.hits + stats.misses;
            const acc = attempts > 0 ? (stats.hits / attempts) : 0;
            accSamples.push({ t: Math.max(0, now - startSec), acc });
        }

        // Auto-miss overdue events
        autoMiss(now);

        // Draw every frame for smooth animation - requestAnimationFrame handles timing
        drawSheet(now);

        if (now >= endSec + 0.05) {
            isPlaying = false;
            if (audioCtx) stopAllScheduledMetronome(audioCtx.currentTime);
            // Remove live plot before showing summary
            try { if (livePlot) livePlot.destroy(); } catch { }
            livePlot = null;
            if (livePlotResizeHandler) { window.removeEventListener('resize', livePlotResizeHandler); livePlotResizeHandler = null; }
            const liveWrap = document.getElementById('liveTimingWrap');
            if (liveWrap && liveWrap.parentElement) liveWrap.parentElement.removeChild(liveWrap);
            drawSheet();
            if (!tutorialMode) {
                showSummary();
            } else {
                // Reset tutorial UI when playback completes
                try { if (typeof stopTutorialBeat === 'function') stopTutorialBeat(); } catch { }
            }
            return;
        }
        rafId = requestAnimationFrame(loop);
    }

    function autoMiss(now) {
        if (tutorialMode) return;
        const diff = difficultyConfig[el.difficulty.value] || difficultyConfig.easy;
        const tol = diff.toleranceMs / 1000;
        while (nextEventIdx < pattern.items.length) {
            const it = pattern.items[nextEventIdx];
            if (it.isRest) { nextEventIdx++; continue; }
            const audioRunning = audioCtx && audioCtx.state === 'running';
            const startSec = audioRunning ? schedule.startTimeAudio : schedule.startTimeVisual;
            const eventTime = startSec + it.startTick * schedule.secondsPerTick;
            if (now > eventTime + tol) {
                // Missed
                it.state = 'miss';
                it.hitDeltaMs = null;
                stats.misses += 1;
                stats.combo = 0;
                updateStats();
                nextEventIdx++;
                // Live chart update for miss (leave null to show gap)
                // Find item index we just advanced from
                liveSetDeltaForItemIndex(nextEventIdx - 1, null);
                continue;
            }
            break;
        }
    }

    // Input handling
    function onHitInput(evt) {
        if (tutorialMode) return;
        if (!pattern || !schedule) return;
        ensureAudio();
        // Immediate tactile feedback on any tap
        playTapClick();
        const audioRunning = audioCtx && audioCtx.state === 'running';
        const now = audioRunning ? audioCtx.currentTime : (performance.now() / 1000);
        if (now - lastHitAtSec < HIT_COOLDOWN_SEC) return;
        const diff = difficultyConfig[el.difficulty.value] || difficultyConfig.easy;
        const baseTolMs = diff.toleranceMs;
        const firstBonusMs = diff.firstBeatBonusMs || 0;
        const maxWindowFactor = 2.5;
        const measureTicks = pattern.ticksPerBeat * pattern.timeSig.beatsPerMeasure;
        const startSec = audioRunning ? schedule.startTimeAudio : schedule.startTimeVisual;
        const nowTick = Math.max(0, (now - startSec) / schedule.secondsPerTick);
        const nowMeasure = Math.floor(nowTick / measureTicks);

        // Find next pending note
        let idx = nextEventIdx;
        while (idx < pattern.items.length && pattern.items[idx].isRest) idx++;
        if (idx >= pattern.items.length) return;
        const it = pattern.items[idx];
        const eventMeasure = Math.floor(it.startTick / measureTicks);
        const eventTime = startSec + it.startTick * schedule.secondsPerTick;
        // Anti-skip: do not allow advancing beyond the current measure,
        // except allow slightly-early hits for the FIRST note of the next measure
        if (eventMeasure > nowMeasure) {
            const isFirstInMeasure = (it.startTick % measureTicks) === 0;
            if (isFirstInMeasure) {
                const earlyAllowanceSec = (baseTolMs + firstBonusMs + 100) / 1000; // extra leniency for first beat
                if (now >= eventTime - earlyAllowanceSec) {
                    // proceed to grading below
                } else {
                    // Too early for next measure → mark and penalize
                    // Ignore too-early beyond next measure
                    return;
                }
            } else {
                // Too early within current measure → ignore
                return;
            }
        }
        // proceed with grading
        const delta = now - eventTime; // + late, - early
        const isFirstInMeasure = (it.startTick % measureTicks) === 0;
        const tolSec = (baseTolMs + (isFirstInMeasure ? firstBonusMs : 0)) / 1000;
        const badWindowSec = ((baseTolMs * maxWindowFactor) + (isFirstInMeasure ? firstBonusMs : 0)) / 1000;

        let feedbackText = '';
        if (Math.abs(delta) <= tolSec) {
            // Good
            it.state = 'good';
            it.hitDeltaMs = Math.round(delta * 1000);
            stats.hits += 1;
            stats.combo += 1;
            if (stats.combo > maxCombo) maxCombo = stats.combo;
            feedbackText = `On time (${Math.abs(it.hitDeltaMs)}ms)`;
            if (el.feedback) el.feedback.innerHTML = `<span class="good">${feedbackText}</span>`;
            nextEventIdx = idx + 1;
            lastHitAtSec = now;
            // Live chart update
            liveSetDeltaForItemIndex(idx, it.hitDeltaMs);
        } else if (Math.abs(delta) <= badWindowSec) {
            // Early/Late (bad) but still consume to progress
            it.state = 'bad';
            it.hitDeltaMs = Math.round(delta * 1000);
            stats.misses += 1;
            stats.combo = 0;
            const dir = delta < 0 ? 'Early' : 'Late';
            feedbackText = `${dir} by ${Math.abs(it.hitDeltaMs)}ms`;
            if (el.feedback) el.feedback.innerHTML = `<span class="warn">${feedbackText}</span>`;
            nextEventIdx = idx + 1;
            lastHitAtSec = now;
            // Live chart update
            liveSetDeltaForItemIndex(idx, it.hitDeltaMs);
        } else {
            // Far-off tap → ignore, do not consume
            return;
        }
        updateStats();
        drawSheet(now);
    }

    // Notation helpers
    const NOTEHEAD_RX = 7.5;
    const NOTEHEAD_RY = 5.5;
    const STEM_LEN = 36;
    const BEAM_THICK = 4;
    const BEAM_GAP = 3;

    function getBeamCount(durTicks, ticksPerBeat) {
        if (durTicks >= ticksPerBeat) return 0; // quarter-or-beat length or longer
        // Render all sub-beat notes with a single beam to avoid double flags
        return 1;
    }

    function drawNotehead(x, y, color, filled) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-20 * Math.PI / 180);
        ctx.beginPath();
        ctx.ellipse(0, 0, NOTEHEAD_RX, NOTEHEAD_RY, 0, 0, Math.PI * 2);
        if (filled) {
            ctx.fillStyle = color;
            ctx.fill();
        } else {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawDot(x, y, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x + NOTEHEAD_RX + 6, y - 2, 2.2, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawStemUp(x, y, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + NOTEHEAD_RX - 1, y - 1);
        ctx.lineTo(x + NOTEHEAD_RX - 1, y - STEM_LEN);
        ctx.stroke();
        return { stemX: x + NOTEHEAD_RX - 1, stemTopY: y - STEM_LEN };
    }

    function drawBeamQuad(x1, y1, x2, y2, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x2, y2 + BEAM_THICK);
        ctx.lineTo(x1, y1 + BEAM_THICK);
        ctx.closePath();
        ctx.fill();
    }

    function drawFlagUp(stemX, stemTopY, beamIndex, color) {
        // Curved flag approximating standard engraving
        const y0 = stemTopY + (beamIndex - 1) * (BEAM_THICK + BEAM_GAP);
        const height = 10;
        const width = 12;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(stemX, y0);
        ctx.bezierCurveTo(
            stemX + width * 0.4, y0 + 2,
            stemX + width, y0 + 1,
            stemX + width, y0 + height * 0.6
        );
        ctx.bezierCurveTo(
            stemX + width * 0.9, y0 + height,
            stemX + width * 0.35, y0 + height * 0.9,
            stemX, y0 + height
        );
        ctx.closePath();
        ctx.fill();
    }

    function drawQuarterRest(x, y, color) {
        // Stylized quarter rest: diagonal zig with small curl
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 2, y - 12);
        ctx.lineTo(x - 4, y - 6);
        ctx.lineTo(x + 2, y);
        ctx.lineTo(x - 4, y + 6);
        ctx.stroke();
    }

    function drawEighthRest(x, y, color) {
        // More accurate eighth rest approximation
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y - 12);
        ctx.quadraticCurveTo(x + 8, y - 10, x + 2, y - 5);
        ctx.moveTo(x + 2, y - 5);
        ctx.quadraticCurveTo(x - 2, y + 2, x - 2, y + 8);
        ctx.stroke();
    }

    function drawSixteenthRest(x, y, color) {
        drawEighthRest(x, y, color);
        ctx.beginPath();
        ctx.moveTo(x + 1, y - 7);
        ctx.quadraticCurveTo(x + 6, y - 5, x + 1, y - 2);
        ctx.stroke();
    }

    function drawHalfRest(x, staffY, lineSpacing, color) {
        // Half rest sits on the middle line
        const midLineY = staffY + lineSpacing * 2;
        ctx.fillStyle = color;
        ctx.fillRect(x - 6, midLineY - 4, 12, 4);
    }

    function drawWholeRest(x, staffY, lineSpacing, color) {
        // Whole rest hangs from the line below the middle (4th from top)
        const lineBelowMid = staffY + lineSpacing * 3;
        ctx.fillStyle = color;
        ctx.fillRect(x - 6, lineBelowMid, 12, 4);
    }

    // Drawing
    function drawSheet(now) {
        if (!pattern) { clearCanvas(); drawEmpty(); return; }
        clearCanvas();

        const leftPad = 64;
        const rightPad = 12;
        const topPad = 40;
        const bottomPad = 36;
        const lineSpacing = 16;
        const measureTicks = pattern.ticksPerBeat * pattern.timeSig.beatsPerMeasure;
        const measuresPerRow = getMeasuresPerRow();
        const totalMeasures = Math.ceil(pattern.totalTicks / measureTicks);
        const numRows = Math.max(1, Math.ceil(totalMeasures / measuresPerRow));
        const usableWidth = canvasWidth - leftPad - rightPad;
        const ticksPerRow = measuresPerRow * measureTicks;
        const pxPerTickRow = usableWidth / ticksPerRow;
        const staffHeight = lineSpacing * 4;
        const rowStride = staffHeight + 60;

        // Precompute row meta
        const rows = [];
        for (let r = 0; r < numRows; r++) {
            const rowStartMeasure = r * measuresPerRow;
            const rowMeasures = Math.min(measuresPerRow, totalMeasures - rowStartMeasure);
            const rowStartTick = rowStartMeasure * measureTicks;
            const staffY = topPad + r * rowStride;
            const midLineY = staffY + lineSpacing * 2;
            const rowBarXs = [];
            for (let m = 0; m <= rowMeasures; m++) {
                rowBarXs.push(leftPad + m * measureTicks * pxPerTickRow);
            }
            rows.push({ r, staffY, midLineY, rowStartTick, rowMeasures, rowBarXs });
        }

        function adjustAwayFromBar(x, barXs) {
            let nearest = null;
            let minD = Infinity;
            for (const bx of barXs) {
                const d = Math.abs(x - bx);
                if (d < minD) { minD = d; nearest = bx; }
            }
            const minDist = NOTEHEAD_RX + 3;
            if (nearest != null && Math.abs(x - nearest) < minDist) {
                const smallOffset = 4; // nudge notehead slightly right of barline for visibility
                return nearest + smallOffset;
            }
            return x;
        }

        // Staff lines per row
        ctx.strokeStyle = palette.staff;
        ctx.lineWidth = 1;
        for (const row of rows) {
            for (let i = 0; i < 5; i++) {
                const y = row.staffY + i * lineSpacing;
                ctx.beginPath();
                ctx.moveTo(leftPad, y);
                ctx.lineTo(canvasWidth - rightPad, y);
                ctx.stroke();
            }
        }

        // Time signature only on first row
        if (rows[0]) {
            const row0 = rows[0];
            ctx.fillStyle = palette.text;
            ctx.font = 'bold 24px "Source Sans Pro", -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, Liberation Sans, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(String(pattern.timeSig.beatsPerMeasure), leftPad - 10, row0.staffY + lineSpacing * 1.5);
            ctx.fillText(String(pattern.timeSig.beatNote), leftPad - 10, row0.staffY + lineSpacing * 3.5);
            ctx.textAlign = 'left';
        }

        // Measure bars per row
        for (const row of rows) {
            for (let m = 0; m <= row.rowMeasures; m++) {
                const x = leftPad + m * measureTicks * pxPerTickRow;
                ctx.beginPath();
                ctx.moveTo(x, row.staffY - 14);
                ctx.lineTo(x, row.staffY + lineSpacing * 4 + 16);
                ctx.strokeStyle = palette.bar;
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        }

        // Build note layout with rows
        const layouts = [];
        for (let i = 0; i < pattern.items.length; i++) {
            const it = pattern.items[i];
            const rowIdx = Math.floor(it.startTick / ticksPerRow);
            const row = rows[Math.min(rowIdx, rows.length - 1)];
            const ticksIntoRow = it.startTick - row.rowStartTick;
            let x = leftPad + ticksIntoRow * pxPerTickRow;
            x = adjustAwayFromBar(x, row.rowBarXs);
            const beamCount = getBeamCount(it.durTicks, pattern.ticksPerBeat);
            layouts.push({ i, x, y: row.midLineY, it, beamCount, stemX: null, stemTopY: null, connectedLeft: {}, connectedRight: {}, row });
        }

        // Notes/rests (noteheads first)
        for (const l of layouts) {
            const it = l.it;
            const color = it.state === 'good' ? 'rgba(34,197,94,1)'
                : it.state === 'miss' ? 'rgba(239,68,68,1)'
                    : it.state === 'bad' ? 'rgba(245,158,11,1)'
                        : palette.note;
            if (it.isRest) {
                const tpb = pattern.ticksPerBeat;
                if (it.durTicks >= tpb * 4) {
                    drawWholeRest(l.x, l.row.staffY, lineSpacing, color);
                    if (it.isDotted) drawDot(l.x, l.row.midLineY, color);
                } else if (it.durTicks >= tpb * 2) {
                    drawHalfRest(l.x, l.row.staffY, lineSpacing, color);
                    if (it.isDotted) drawDot(l.x, l.row.midLineY, color);
                } else if (it.durTicks >= tpb) {
                    drawQuarterRest(l.x, l.row.midLineY, color);
                    if (it.isDotted) drawDot(l.x, l.row.midLineY, color);
                } else if (it.durTicks >= Math.round(tpb / 2)) {
                    drawEighthRest(l.x, l.row.midLineY, color);
                    if (it.isDotted) drawDot(l.x, l.row.midLineY, color);
                } else {
                    // Triplet or smaller → show as eighth rest
                    drawEighthRest(l.x, l.row.midLineY, color);
                    if (it.isDotted) drawDot(l.x, l.row.midLineY, color);
                }
            } else {
                const filled = it.durTicks < (pattern.ticksPerBeat * 2); // half and whole unfilled
                drawNotehead(l.x, l.y, color, filled);
                if (it.isDotted) drawDot(l.x, l.y, color);
            }
        }

        // Stems
        for (const l of layouts) {
            if (l.it.isRest) continue;
            const isWhole = l.it.durTicks >= (pattern.ticksPerBeat * 4);
            if (isWhole) continue; // whole notes have no stems
            const color = l.it.state === 'good' ? 'rgba(34,197,94,1)'
                : l.it.state === 'miss' ? 'rgba(239,68,68,1)'
                    : l.it.state === 'bad' ? 'rgba(245,158,11,1)'
                        : palette.note;
            const stem = drawStemUp(l.x, l.y, color);
            l.stemX = stem.stemX;
            l.stemTopY = stem.stemTopY;
        }

        // Beam connectivity within groups
        const ts = pattern.timeSig;
        const beamGroupTicks = (ts.beatNote === 8 && (ts.beatsPerMeasure % 3 === 0))
            ? pattern.ticksPerBeat * 3
            : pattern.ticksPerBeat;
        function sameBeamGroup(a, b) {
            // Same local beam group and same row
            return a.row === b.row && (Math.floor(a.it.startTick / beamGroupTicks) === Math.floor(b.it.startTick / beamGroupTicks));
        }
        for (let i = 0; i < layouts.length - 1; i++) {
            const A = layouts[i], B = layouts[i + 1];
            if (A.it.isRest || B.it.isRest) continue;
            if (!sameBeamGroup(A, B)) continue;
            const minBeams = Math.min(A.beamCount, B.beamCount);
            for (let b = 1; b <= minBeams; b++) {
                A.connectedRight[b] = true;
                B.connectedLeft[b] = true;
            }
        }

        // Draw beams with state-aware color (prefer error > good > default)
        for (let i = 0; i < layouts.length - 1; i++) {
            const A = layouts[i], B = layouts[i + 1];
            if (A.it.isRest || B.it.isRest) continue;
            if (!sameBeamGroup(A, B)) continue;
            const minBeams = Math.min(A.beamCount, B.beamCount);
            if (minBeams <= 0) continue;
            const combinedState = (A.it.state === 'miss' || B.it.state === 'miss') ? 'miss'
                : (A.it.state === 'bad' || B.it.state === 'bad') ? 'bad'
                    : (A.it.state === 'good' || B.it.state === 'good') ? 'good' : 'default';
            const color = colorForState(combinedState);
            for (let b = 1; b <= minBeams; b++) {
                const yA = A.stemTopY + (b - 1) * (BEAM_THICK + BEAM_GAP);
                const yB = B.stemTopY + (b - 1) * (BEAM_THICK + BEAM_GAP);
                drawBeamQuad(A.stemX, yA, B.stemX, yB, color);
            }
        }

        // Flags where no beam
        for (const L of layouts) {
            if (L.it.isRest) continue;
            const color = L.it.state === 'good' ? 'rgba(34,197,94,1)'
                : L.it.state === 'miss' ? 'rgba(239,68,68,1)'
                    : L.it.state === 'bad' ? 'rgba(245,158,11,1)'
                        : palette.note;
            for (let b = 1; b <= L.beamCount; b++) {
                const hasConn = L.connectedLeft[b] || L.connectedRight[b];
                if (!hasConn) drawFlagUp(L.stemX, L.stemTopY, b, color);
            }
        }

        // Triplet count markers (monospace '3' above group)
        for (let i = 0; i < layouts.length;) {
            const L = layouts[i];
            if (!L.it.isTriplet) { i++; continue; }
            const group = [L];
            let j = i + 1;
            while (j < layouts.length && layouts[j].it.isTriplet && Math.floor(layouts[j].it.startTick / pattern.ticksPerBeat) === Math.floor(L.it.startTick / pattern.ticksPerBeat)) {
                group.push(layouts[j]);
                j++;
                if (group.length === 3) break;
            }
            if (group.length === 3) {
                const x1 = group[0].x;
                const x3 = group[2].x;
                const fallbackY = (group[0].row ? group[0].row.staffY : (topPad)) - 12;
                const yTop = Math.min(group[0].stemTopY || fallbackY, group[1].stemTopY || fallbackY, group[2].stemTopY || fallbackY) - 6;
                ctx.fillStyle = palette.text;
                ctx.font = '600 12px "Source Sans Pro", -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial';
                ctx.textAlign = 'center';
                ctx.fillText('3', (x1 + x3) / 2, yTop);
                i = j;
            } else {
                i++;
            }
        }

        // (Removed secondary debug note render)

        // Playhead mapped to current row
        const showBeat = !el.beatMarker || el.beatMarker.checked;
        if (isPlaying && now != null) {
            const audioRunning = audioCtx && audioCtx.state === 'running';
            const startSec = audioRunning ? schedule.startTimeAudio : schedule.startTimeVisual;
            const t = now - startSec;
            const progressTicks = clamp(t / schedule.secondsPerTick, 0, pattern.totalTicks);
            const rowIdx = Math.floor(progressTicks / ticksPerRow);
            const row = rows[Math.min(Math.max(0, rowIdx), rows.length - 1)];
            const ticksIntoRow = progressTicks - row.rowStartTick;
            const x = leftPad + ticksIntoRow * pxPerTickRow;

            if (showBeat) {
                ctx.strokeStyle = palette.playhead;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x, row.staffY - 12);
                ctx.lineTo(x, row.staffY + lineSpacing * 4 + 16);
                ctx.stroke();
            }

            // Auto-scroll sheet to keep current row centered in view
            if (autoScrollRow !== row.r) {
                const wrap = el.canvasWrap || document.querySelector('.canvas-wrap');
                if (wrap) {
                    const viewH = Math.max(0, wrap.clientHeight || 0);
                    const rowCenter = row.staffY + (rowStride / 2);
                    const targetTop = clamp(Math.floor(rowCenter - viewH / 2), 0, Math.max(0, canvasHeight - viewH));
                    wrap.scrollTo({ top: targetTop, behavior: 'smooth' });
                    autoScrollRow = row.r;
                }
            }
        }

        // Bottom labels (monospace)
        ctx.fillStyle = palette.muted;
        ctx.font = '12px "Source Sans Pro", -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial';
        ctx.fillText(`${pattern.timeSig.beatsPerMeasure}/${pattern.timeSig.beatNote}`, leftPad, canvasHeight - 10);
        const acc = calcAccuracy();
        ctx.textAlign = 'right';
        ctx.fillText(`${acc.toFixed(0)}%`, canvasWidth - rightPad, canvasHeight - 10);
        ctx.textAlign = 'left';

        // Ephemeral click marks (red X where invalid tap occurred)
        // tap markers are DOM-based now
    }

    function clearCanvas() {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    }

    function drawEmpty() {
        ctx.fillStyle = palette.muted;
        ctx.font = '14px "Source Sans Pro", -apple-system, Segoe UI, Roboto, sans-serif';
        ctx.fillText('Press Start to begin a new session', 20, 40);
    }

    // Stats - cache total targets for performance
    let cachedTotalTargets = 0;

    function calcAccuracy() {
        if (!pattern) return 0;
        // Cache total targets to avoid recalculating
        if (cachedTotalTargets === 0) {
            cachedTotalTargets = pattern.items.filter(i => !i.isRest).length;
        }
        const acc = cachedTotalTargets > 0 ? (stats.hits / cachedTotalTargets) * 100 : 0;
        return acc;
    }

    function updateStats() {
        const acc = calcAccuracy();
        if (el.statAcc) el.statAcc.textContent = `${acc.toFixed(0)}%`;
        if (el.statHits) el.statHits.textContent = `${stats.hits}`;
        if (el.statMiss) el.statMiss.textContent = `${stats.misses}`;
        if (el.statCombo) el.statCombo.textContent = `${stats.combo}`;
    }

    // Summary
    function showSummary() {
        // Hide sidebar (optional per request)
        const container = document.querySelector('.container');
        if (container) container.classList.add('no-sidebar');

        // Populate metrics
        const acc = calcAccuracy();
        const sumAcc = document.getElementById('sum-acc');
        const sumHits = document.getElementById('sum-hits');
        const sumMiss = document.getElementById('sum-miss');
        const sumCombo = document.getElementById('sum-combo');
        if (sumAcc) sumAcc.textContent = `${acc.toFixed(0)}%`;
        if (sumHits) sumHits.textContent = String(stats.hits);
        if (sumMiss) sumMiss.textContent = String(stats.misses);
        if (sumCombo) sumCombo.textContent = String(maxCombo);

        // Ensure live chart hidden during summary
        try { if (livePlot) livePlot.destroy(); } catch { }
        livePlot = null;
        if (livePlotResizeHandler) { window.removeEventListener('resize', livePlotResizeHandler); livePlotResizeHandler = null; }
        const liveWrap = document.getElementById('liveTimingWrap');
        if (liveWrap && liveWrap.parentElement) liveWrap.parentElement.removeChild(liveWrap);

        // Show overlay before measuring for chart sizing
        if (el.summaryOverlay) el.summaryOverlay.style.display = 'flex';
        if (el.canvasWrap) { el.canvasWrap.scrollTop = 0; el.canvasWrap.style.overflowY = 'hidden'; }
        document.body.style.overflow = 'hidden';

        // Build timing offsets and render with uPlot
        if (el.timingChart && uPlot) {
            const noteOffsets = pattern.items
                .filter(it => !it.isRest)
                .map((it, idx) => ({ idx: idx + 1, ms: (typeof it.hitDeltaMs === 'number') ? it.hitDeltaMs : null }));

            const xVals = noteOffsets.map(o => o.idx);
            const yValsRaw = noteOffsets.map(o => (o.ms == null ? null : o.ms));
            // Smooth with a light moving average, keeping nulls as gaps
            function smooth(arr, radius) {
                const out = new Array(arr.length).fill(null);
                for (let i = 0; i < arr.length; i++) {
                    if (arr[i] == null) { out[i] = null; continue; }
                    let sum = 0, count = 0;
                    for (let k = -radius; k <= radius; k++) {
                        const j = i + k;
                        if (j >= 0 && j < arr.length && arr[j] != null) { sum += arr[j]; count++; }
                    }
                    out[i] = count ? (sum / count) : arr[i];
                }
                return out;
            }
            const yVals = smooth(yValsRaw, 2);

            const absVals = yVals.filter(v => v != null).map(v => Math.abs(v));
            const base = absVals.length ? Math.max(...absVals) : 60;
            const maxAbs = Math.min(300, Math.max(100, Math.ceil(base * 1.1)));
            const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#60a5fa';

            const container = el.timingChart;
            const rect = container.getBoundingClientRect();
            const width = Math.max(320, Math.floor(rect.width || window.innerWidth * 0.9));
            const height = Math.max(160, Math.min(260, Math.floor(width > 520 ? 200 : 160)));

            const makePlot = () => new uPlot({
                width,
                height,
                title: '',
                scales: {
                    x: { time: false },
                    y: {
                        range: () => [-maxAbs, maxAbs]
                    }
                },
                axes: [
                    {
                        grid: { show: true },
                        stroke: palette.axis,
                        ticks: { show: false },
                        values: () => []
                    },
                    {
                        grid: { show: true },
                        stroke: palette.axis,
                        values: (u, vals) => vals.map(v => (v === 0 ? '0 ms' : `${v > 0 ? '+' : ''}${Math.round(v)} ms`))
                    }
                ],
                cursor: { drag: { x: false, y: false } },
                legend: { show: false },
                hooks: {
                    draw: [u => {
                        const ctx = u.ctx;
                        const { top, left, width: bw, height: bh } = u.bbox;
                        // Zero baseline
                        const y0 = Math.round(u.valToPos(0, 'y', true)) + 0.5;
                        ctx.save();
                        ctx.strokeStyle = palette.axis;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(left, y0);
                        ctx.lineTo(left + bw, y0);
                        ctx.stroke();
                        // Vertical grid line for each note
                        ctx.strokeStyle = palette.grid;
                        ctx.lineWidth = 1;
                        for (let i = 0; i < xVals.length; i++) {
                            const px = Math.round(u.valToPos(xVals[i], 'x', true)) + 0.5;
                            ctx.beginPath();
                            ctx.moveTo(px, top);
                            ctx.lineTo(px, top + bh);
                            ctx.stroke();
                        }
                        ctx.restore();
                    }]
                },
                series: [
                    {},
                    {
                        stroke: accent,
                        width: 2,
                        spanGaps: true,
                        points: { show: false },
                        fill: 'rgba(200,16,46,0.08)'
                    }
                ]
            }, [xVals, yVals], container);

            // Destroy previous plot and resize handler if present
            if (timingPlot) { try { timingPlot.destroy(); } catch { } timingPlot = null; }
            if (timingResizeHandler) { window.removeEventListener('resize', timingResizeHandler); timingResizeHandler = null; }

            timingPlot = makePlot();

            // Responsive resize while overlay is visible - throttled for performance
            let timingResizeTimeout = null;
            timingResizeHandler = () => {
                if (!el.summaryOverlay || el.summaryOverlay.style.display === 'none' || !timingPlot) return;
                if (timingResizeTimeout) clearTimeout(timingResizeTimeout);
                timingResizeTimeout = setTimeout(() => {
                    const r = container.getBoundingClientRect();
                    const w = Math.max(320, Math.floor(r.width));
                    timingPlot.setSize({ width: w, height });
                }, 150);
            };
            window.addEventListener('resize', timingResizeHandler, { passive: true });
        }
    }

    // Live timing chart (real-time) -------------------------------------------------
    function getOrCreateLiveChartContainer() {
        let wrap = document.getElementById('liveTimingWrap');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.id = 'liveTimingWrap';
            // Fixed, non-interactive overlay at the bottom of the viewport
            wrap.style.position = 'fixed';
            wrap.style.left = '0';
            wrap.style.right = '0';
            wrap.style.bottom = '0';
            wrap.style.zIndex = '50';
            wrap.style.pointerEvents = 'none';
            wrap.style.background = 'transparent';
            wrap.style.padding = '6px 8px';
            const chart = document.createElement('div');
            chart.id = 'liveTimingChart';
            chart.style.width = '100%';
            chart.style.height = '140px';
            chart.style.pointerEvents = 'none';
            wrap.appendChild(chart);
            document.body.appendChild(wrap);
        }
        return wrap.querySelector('#liveTimingChart');
    }

    function initLivePlot(noteCount) {
        const container = getOrCreateLiveChartContainer();
        if (!container || !uPlot) return;

        const rect = container.getBoundingClientRect();
        const width = Math.max(320, Math.floor(rect.width || window.innerWidth * 0.9));
        const height = 140;
        // Default y-range ±200ms; adjust later if needed
        let maxAbs = 200;
        const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#60a5fa';

        try { if (livePlot) livePlot.destroy(); } catch { }
        livePlot = new uPlot({
            width,
            height,
            title: '',
            scales: {
                x: { time: false },
                y: { range: () => [-maxAbs, maxAbs] }
            },
            axes: [
                { grid: { show: true }, stroke: palette.axis, ticks: { show: false }, values: () => [] },
                { grid: { show: true }, stroke: palette.axis, values: (u, vals) => vals.map(v => (v === 0 ? '0 ms' : `${v > 0 ? '+' : ''}${Math.round(v)} ms`)) }
            ],
            cursor: { drag: { x: false, y: false } },
            legend: { show: false },
            hooks: {
                draw: [u => {
                    const ctx = u.ctx;
                    const { top, left, width: bw } = u.bbox;
                    const y0 = Math.round(u.valToPos(0, 'y', true)) + 0.5;
                    ctx.save();
                    ctx.strokeStyle = palette.axis;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(left, y0);
                    ctx.lineTo(left + bw, y0);
                    ctx.stroke();
                    ctx.restore();
                }]
            },
            series: [{}, { stroke: accent, width: 2, spanGaps: true, points: { show: false }, fill: 'rgba(200,16,46,0.08)' }]
        }, [liveX, liveY], container);

        // Resize handler
        if (livePlotResizeHandler) window.removeEventListener('resize', livePlotResizeHandler);
        livePlotResizeHandler = () => {
            if (!livePlot) return;
            const r = container.getBoundingClientRect();
            const w = Math.max(320, Math.floor(r.width));
            livePlot.setSize({ width: w, height });
        };
        window.addEventListener('resize', livePlotResizeHandler, { passive: true });
    }

    function liveSetDeltaForItemIndex(itemIdx, deltaMs) {
        const liveIdx = liveIndexByItem.get(itemIdx);
        if (liveIdx == null) return;
        liveY[liveIdx] = deltaMs;
        if (livePlot) livePlot.setData([liveX, liveY]);
    }

    // Persistence
    function getSettings() {
        return {
            bpm: Number(el.bpm.value),
            measures: Number(el.measures.value),
            timeSig: el.timeSig.value,
            difficulty: el.difficulty.value,
            metronome: el.metronome.checked,
            beatMarker: el.beatMarker ? el.beatMarker.checked : true,
            guideClicks: el.guideClicks ? el.guideClicks.checked : true
        };
    }
    function applySettings(data) {
        if (!data) return;
        if (data.bpm) el.bpm.value = clamp(Number(data.bpm), 30, 240);
        if (data.measures) {
            const allowedMeasures = [1, 4, 16, 32];
            const mv = Number(data.measures);
            el.measures.value = String(allowedMeasures.includes(mv) ? mv : 4);
        }
        if (data.timeSig) el.timeSig.value = data.timeSig;
        if (data.difficulty) el.difficulty.value = data.difficulty;
        if (typeof data.metronome === 'boolean') el.metronome.checked = data.metronome;
        if (typeof data.beatMarker === 'boolean' && el.beatMarker) el.beatMarker.checked = data.beatMarker;
        if (typeof data.guideClicks === 'boolean' && el.guideClicks) el.guideClicks.checked = data.guideClicks;
        // Sync custom UI controls if present
        const bpmValNode = document.getElementById('bpmVal');
        if (bpmValNode) bpmValNode.textContent = String(el.bpm.value);
        if (window._syncPills) window._syncPills();
    }

    // Events
    el.btnStop.addEventListener('click', () => { stopPlayback(); });
    el.btnReset.addEventListener('click', () => {
        if (!pattern) return;
        pattern.items.forEach(i => { if (!i.isRest) { i.state = 'pending'; i.hitDeltaMs = null; } });
        stats = { hits: 0, misses: 0, combo: 0 };
        nextEventIdx = pattern.items.findIndex(i => !i.isRest);
        if (nextEventIdx < 0) nextEventIdx = 0;
        el.feedback.textContent = '';
        updateStats();
        drawSheet();
    });

    // Start overlay interactions
    function attemptStartFromOverlay(target) {
        if (!el.startOverlay) return;
        const inControls = target && target.closest && target.closest('.start-bar');
        if (!inControls && !tutorialMode) { generatePattern(); resizeCanvas(); startPlayback(); }
    }
    if (el.startHint) {
        el.startHint.addEventListener('click', (e) => { attemptStartFromOverlay(e.target); });
    }
    if (el.startOverlay) {
        el.startOverlay.addEventListener('click', (e) => { attemptStartFromOverlay(e.target); });
        el.startOverlay.addEventListener('touchstart', (e) => { attemptStartFromOverlay(e.target); }, { passive: true });
    }

    // Build pill selectors and BPM slider UI
    (function initStartUI() {
        const bpmValNode = document.getElementById('bpmVal');
        if (bpmValNode) {
            bpmValNode.textContent = String(el.bpm.value);
            el.bpm.addEventListener('input', () => { bpmValNode.textContent = String(el.bpm.value); });
        }

        function makePills(container, values, getLabel, current, onSelect) {
            if (!container) return [];
            container.innerHTML = '';
            const pills = values.map(v => {
                const s = document.createElement('span');
                s.className = 'pill' + (String(v) === String(current) ? ' active' : '');
                s.textContent = getLabel(v);
                s.tabIndex = 0;
                s.addEventListener('click', () => onSelect(v, s));
                s.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(v, s); } });
                container.appendChild(s);
                return s;
            });
            return pills;
        }

        function syncActive(buttons, current, mapVal = (x) => x) {
            buttons.forEach(btn => {
                const val = btn.textContent;
                const isActive = String(mapVal(val)) === String(current);
                btn.classList.toggle('active', isActive);
            });
        }

        // Measures limited set
        const measuresGroup = document.getElementById('measuresGroup');
        let measureButtons = [];
        if (measuresGroup) {
            const measureVals = [1, 4, 16, 32];
            measureButtons = makePills(measuresGroup, measureVals, v => String(v), el.measures.value, (v, btn) => {
                el.measures.value = String(v);
                measureButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                saveSettings(getSettings());
            });
        }

        // Time signature from hidden select
        const timeSigGroup = document.getElementById('timeSigGroup');
        let timeSigButtons = [];
        if (timeSigGroup && el.timeSig) {
            const tsVals = Array.from(el.timeSig.options).map(o => o.value);
            timeSigButtons = makePills(timeSigGroup, tsVals, v => v, el.timeSig.value, (v, btn) => {
                el.timeSig.value = v;
                timeSigButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                saveSettings(getSettings());
            });
        }

        // Difficulty from hidden select
        const difficultyGroup = document.getElementById('difficultyGroup');
        let difficultyButtons = [];
        if (difficultyGroup && el.difficulty) {
            const diffVals = Array.from(el.difficulty.options).map(o => o.value);
            function label(v) { return v.charAt(0).toUpperCase() + v.slice(1); }
            difficultyButtons = makePills(difficultyGroup, diffVals, label, el.difficulty.value, (v, btn) => {
                el.difficulty.value = v;
                difficultyButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                saveSettings(getSettings());
            });
        }

        // Expose a sync for applySettings
        window._syncPills = function () {
            if (measureButtons.length) {
                measureButtons.forEach((b) => b.classList.toggle('active', b.textContent === String(el.measures.value)));
            }
            if (timeSigButtons.length) {
                timeSigButtons.forEach((b) => b.classList.toggle('active', b.textContent === el.timeSig.value));
            }
            if (difficultyButtons.length) {
                difficultyButtons.forEach((b) => b.classList.toggle('active', b.textContent.toLowerCase() === el.difficulty.value));
            }
            const bv = document.getElementById('bpmVal');
            if (bv) bv.textContent = String(el.bpm.value);
        };
    })();

    // Summary actions
    // Retry: run same pattern again immediately
    el.summaryRetry.addEventListener('click', async () => {
        // Cleanup chart & listeners before leaving summary
        if (timingResizeHandler) { window.removeEventListener('resize', timingResizeHandler); timingResizeHandler = null; }
        if (timingPlot) { try { timingPlot.destroy(); } catch { } timingPlot = null; }
        if (el.summaryOverlay) el.summaryOverlay.style.display = 'none';
        document.body.style.overflow = '';
        if (el.canvasWrap) el.canvasWrap.style.overflowY = 'auto';
        // Ensure overlays hidden
        if (el.startOverlay) el.startOverlay.style.display = 'none';
        // Do not regenerate; reuse current pattern
        await startPlayback();
    });

    // Continue: go back to Start/options panel
    el.summaryContinue.addEventListener('click', () => {
        // Cleanup chart & listeners before leaving summary
        if (timingResizeHandler) { window.removeEventListener('resize', timingResizeHandler); timingResizeHandler = null; }
        if (timingPlot) { try { timingPlot.destroy(); } catch { } timingPlot = null; }
        if (el.summaryOverlay) el.summaryOverlay.style.display = 'none';
        if (el.startOverlay) el.startOverlay.style.display = 'flex';
        document.body.style.overflow = '';
        if (el.canvasWrap) { el.canvasWrap.scrollTop = 0; el.canvasWrap.style.overflowY = 'hidden'; }
    });

    // Auto-save on setting changes
    ['bpm', 'measures', 'timeSig', 'difficulty', 'metronome', 'beatMarker', 'guideClicks'].forEach(id => {
        const node = el[id];
        node.addEventListener('change', () => saveSettings(getSettings()));
        if (node.type === 'number' || node.type === 'range' || node.tagName === 'SELECT') {
            node.addEventListener('input', () => saveSettings(getSettings()));
        }
    });

    // Input: space / tap
    let preventRepeat = false;
    document.addEventListener('keydown', (e) => {
        const k = e.key || e.code;
        if (k === ' ' || k === 'Space' || k === 'Spacebar') {
            e.preventDefault();
            if (!preventRepeat) {
                // If summary visible, ignore space
                if (isVisible(el.summaryOverlay)) {
                    preventRepeat = true;
                    return;
                }
                if (!isPlaying) {
                    if (!tutorialMode) {
                        generatePattern();
                        startPlayback();
                    }
                } else {
                    if (!tutorialMode) onHitInput();
                }
                preventRepeat = true;
            }
        }
    });
    document.addEventListener('keyup', (e) => {
        const k = e.key || e.code;
        if (k === ' ' || k === 'Space' || k === 'Spacebar') {
            preventRepeat = false;
        }
    });
    el.sheet.addEventListener('mousedown', (e) => {
        if (isVisible(el.summaryOverlay)) return;
        onHitInput(e);
    });
    el.sheet.addEventListener('touchstart', (e) => {
        if (isVisible(el.summaryOverlay)) return;
        onHitInput(e);
    }, { passive: true });

    // Tutorials: definitions and UI
    const tutorials = [
        {
            group: 'Swing & Bebop (4/4)',
            items: [
                { id: 'swingRide', label: 'Swing ride pattern', desc: '“ding‑ding‑da‑ding” ride feel', timeSig: '4/4', tokens: ['q', 'e', 'trip', 'q'], bpm: 180 },
                { id: 'charleston', label: 'Charleston rhythm', desc: 'Classic comping figure', timeSig: '4/4', tokens: ['q', 'r:e', 'e', 'q'], bpm: 160 },
                { id: 'bebopComp', label: 'Bebop comping', desc: 'Syncopated hits', timeSig: '4/4', tokens: ['e', 'r:e', 'e', 'q', 'e'], bpm: 184 },
                { id: 'walkingBass', label: 'Walking bass (quarters)', desc: 'Steady on all beats', timeSig: '4/4', tokens: ['q', 'q', 'q', 'q'], bpm: 140 }
            ]
        },
        {
            group: 'Afro‑Cuban Jazz',
            items: [
                { id: 'sonClave32', label: 'Son clave (3‑2)', desc: 'Clave foundation (3‑2)', timeSig: '4/4', measures: 2, tokens: ['e', 'r:e', 'r:e', 'e', 'r:e', 'r:e', 'e', 'r:e', 'r:e', 'r:e', 'e', 'r:e', 'r:e', 'e', 'r:e', 'r:e'], bpm: 120 },
                { id: 'rumbaClave23', label: 'Rumba clave (2‑3)', desc: 'Laid‑back clave (2‑3)', timeSig: '4/4', measures: 2, tokens: ['r:e', 'r:e', 'e', 'r:e', 'r:e', 'e', 'r:e', 'r:e', 'e', 'r:e', 'r:e', 'e', 'r:e', 'e', 'r:e', 'r:e'], bpm: 120 },
                { id: 'cascara', label: 'Cáscara pattern', desc: 'Timbales/shells motion', timeSig: '4/4', tokens: ['e', 'r:e', 'e', 'q', 'e', 'r:e', 'e', 'q'], bpm: 132 }
            ]
        },
        {
            group: 'Bossa Nova',
            items: [
                { id: 'bossaDrums', label: 'Bossa (drums)', desc: 'Cross‑stick, soft groove', timeSig: '4/4', tokens: ['q', 'e', 'r:e', 'e', 'e', 'q'], bpm: 132 },
                { id: 'bossaBass', label: 'Bossa bass', desc: 'Alternating root/fifth', timeSig: '4/4', tokens: ['q', 'r:e', 'e', 'q', 'r:e', 'e'], bpm: 120 },
                { id: 'bossaGuitar', label: 'Bossa guitar', desc: 'Bass‑chord‑chord pattern', timeSig: '4/4', tokens: ['q', 'e', 'e', 'q', 'e'], bpm: 120 }
            ]
        },
        {
            group: 'Hard Bop & Post‑Bop',
            items: [
                { id: 'hardBopShuffle', label: 'Hard bop shuffle', desc: 'Heavy triplet shuffle', timeSig: '4/4', tokens: ['trip', 'trip', 'trip', 'trip'], bpm: 160 },
                { id: 'stopTime', label: 'Stop‑time hits', desc: 'Punchy ensemble hits', timeSig: '4/4', tokens: ['q', 'rq', 'q', 'q'], bpm: 160 },
                { id: 'straight8Funk', label: 'Straight‑eighth funk', desc: 'Even eighths drive', timeSig: '4/4', tokens: ['e', 'e', 'e', 'e', 'e', 'e', 'e', 'e'], bpm: 110 },
                { id: 'brokenTime', label: 'Broken‑time drumming', desc: 'Floating time feel', timeSig: '4/4', tokens: ['q', 'r:e', 'e', 'rq', 'e', 'q'], bpm: 170 }
            ]
        },
        {
            group: 'Afro‑Caribbean Extensions',
            items: [
                { id: 'afro68', label: '6/8 Afro (modal jazz)', desc: 'Dotted 6/8 undercurrent', timeSig: '6/8', tokens: ['dq', 'e', 'q', 'e', 'dq'], bpm: 96 },
                { id: 'mozambique', label: 'Mozambique', desc: 'Cuban pattern over 4/4', timeSig: '4/4', tokens: ['e', 'r:e', 'e', 'q', 'r:e', 'e', 'q'], bpm: 120 },
                { id: 'guaguanco', label: 'Guaguancó', desc: 'Conversational syncopation', timeSig: '4/4', tokens: ['e', 'r:e', 'e', 'r:e', 'e', 'r:e', 'q'], bpm: 120 },
                { id: 'calypso', label: 'Calypso feel', desc: 'Bright Caribbean jazz', timeSig: '4/4', tokens: ['q', 'e', 'r:e', 'q', 'e', 'r:e'], bpm: 132 }
            ]
        },
        {
            group: 'Brazilian & Latin‑Jazz',
            items: [
                { id: 'samba24', label: 'Samba (2/4, approx)', desc: 'Fast forward motion', timeSig: '2/4', tokens: ['e', 'r:e', 'e', 'e'], bpm: 180 },
                { id: 'partidoAlto', label: 'Partido alto (approx)', desc: 'Syncopated samba variant', timeSig: '4/4', tokens: ['e', 'r:e', 'e', 'e', 'r:e', 'e'], bpm: 140 },
                { id: 'baion', label: 'Baión', desc: 'Slow hypnotic groove', timeSig: '4/4', tokens: ['q', 'e', 'r:e', 'q', 'e', 'r:e'], bpm: 110 }
            ]
        },
        {
            group: 'Modern Fusion & Odd',
            items: [
                { id: 'swing54', label: '5/4 swing (Take Five)', desc: '3+2 ride phrasing', timeSig: '5/4', tokens: ['q', 'q', 'q', 'q', 'q'], bpm: 160 },
                { id: 'groove78', label: '7/8 groove', desc: '2+2+3 phrasing', timeSig: '7/8', tokens: ['q', 'e', 'q', 'e', 'e'], bpm: 128 },
                { id: 'funkSync', label: 'Funk‑jazz syncopation', desc: 'Dense, punchy hits', timeSig: '4/4', tokens: ['e', 'r:e', 'e', 'e', 'e', 'r:e', 'e', 'e'], bpm: 100 }
            ]
        }
    ];

    function buildFixedPatternFromTokens(timeSigStr, tokens, measuresIn = 1) {
        const { n: beatsPerMeasure, d: beatNote } = parseTimeSig(timeSigStr);
        const Q = TICKS_PER_QUARTER;
        const ticksPerBeat = Math.round((4 / beatNote) * Q);
        const DUR = {
            whole: Q * 4,
            half: Q * 2,
            quarter: Q,
            eighth: Math.round(Q / 2),
            tripletEighth: Math.round(Q / 3),
            dottedQuarter: Math.round(Q * 1.5),
            dottedEighth: Math.round(Q * 0.75)
        };
        const measureTicks = beatsPerMeasure * ticksPerBeat;
        const measures = Math.max(1, Math.floor(measuresIn) || 1);
        const items = [];
        let t = 0;
        function pushItem(durTicks, isRest, extras) {
            items.push({ startTick: t, durTicks, isRest: !!isRest, state: 'pending', hitDeltaMs: null, isTriplet: !!(extras && extras.isTriplet), isDotted: !!(extras && extras.isDotted) });
            t += durTicks;
        }
        const totalTicks = measureTicks * measures;
        let i = 0;
        while (t < totalTicks && i < tokens.length) {
            const tok = tokens[i++];
            if (tok === 'q') pushItem(DUR.quarter, false, { isDotted: false });
            else if (tok === 'e') pushItem(DUR.eighth, false, { isDotted: false });
            else if (tok === 'dq') pushItem(DUR.dottedQuarter, false, { isDotted: true });
            else if (tok === 'de') pushItem(DUR.dottedEighth, false, { isDotted: true });
            else if (tok === 'r:q' || tok === 'rq') pushItem(DUR.quarter, true, { isDotted: false });
            else if (tok === 'r:e' || tok === 're') {
                // Compress consecutive eighth rests into quarter rests when possible, without crossing barlines
                let count = 1;
                while (i < tokens.length && (tokens[i] === 'r:e' || tokens[i] === 're')) { count++; i++; }
                while (count > 0) {
                    const ticksLeftInMeasure = measureTicks - (t % measureTicks);
                    const maxEighthsThisMeasure = Math.floor(ticksLeftInMeasure / DUR.eighth);
                    const useHere = Math.min(count, maxEighthsThisMeasure);
                    // Convert pairs of eighths to quarters, remainder as single eighth if needed
                    const quarters = Math.floor(useHere / 2);
                    const leftoverEighth = useHere % 2;
                    for (let qn = 0; qn < quarters; qn++) pushItem(DUR.quarter, true, { isDotted: false });
                    if (leftoverEighth > 0) pushItem(DUR.eighth, true, { isDotted: false });
                    count -= useHere;
                    if (useHere === 0) break; // safety
                }
            }
            else if (tok.startsWith('trip')) {
                // triplet for one beat; optional pattern like 'trip:101'
                let mask = '111';
                const parts = tok.split(':');
                if (parts[1] && /^[01]{3}$/.test(parts[1])) mask = parts[1];
                for (let i = 0; i < 3; i++) {
                    const isRest = (mask[i] === '0');
                    items.push({ startTick: t, durTicks: DUR.tripletEighth, isRest, state: 'pending', hitDeltaMs: null, isTriplet: true, isDotted: false });
                    t += DUR.tripletEighth;
                }
            }
        }
        return { measures, timeSig: { beatsPerMeasure, beatNote }, totalTicks, items, ticksPerBeat };
    }

    // Tutorial card rendering/state
    const tutorialCards = new Map(); // id -> { pattern, canvas, beatBar, dims, btn }
    let playingTutorialId = null;
    let tutorialBeatRaf = 0;

    function drawTutorialPreview(canvas, pat) {
        if (!canvas || !pat) return { leftPad: 0, rightPad: 0, usableWidth: 0, measureTicks: 1 };
        const pctx = canvas.getContext('2d');
        const dprLocal = Math.max(1, Math.floor(window.devicePixelRatio || 1));
        // Measure using wrapper for reliable CSS width
        const wrap = canvas.parentElement;
        const rectW = (wrap && wrap.getBoundingClientRect) ? wrap.getBoundingClientRect() : canvas.getBoundingClientRect();
        const cssW = Math.max(320, Math.floor((rectW && rectW.width) ? rectW.width : 340));
        // Symmetric padding so spacing is even on all sides
        const leftPad = 56, rightPad = 56, topPad = 48, bottomPad = 48, lineSpacing = 16;

        const staffHeight = lineSpacing * 4;
        const previewH = topPad + staffHeight + 48 + bottomPad;
        // Freeze CSS size to exact measured width to avoid fractional scaling/blur.
        const needResize = (canvas._cssW !== cssW) || (canvas._cssH !== previewH);
        if (needResize) {
            canvas.style.width = `${cssW}px`;
            canvas.style.height = `${previewH}px`;
            canvas.width = Math.floor(cssW * dprLocal);
            canvas.height = Math.floor(previewH * dprLocal);
            canvas._cssW = cssW; canvas._cssH = previewH;
        }
        pctx.setTransform(dprLocal, 0, 0, dprLocal, 0, 0);
        pctx.clearRect(0, 0, canvas.width, canvas.height);

        const usableWidth = cssW - leftPad - rightPad;
        const measureTicks = pat.ticksPerBeat * pat.timeSig.beatsPerMeasure;
        const totalMeasures = Math.max(1, pat.measures || 1);
        const totalTicks = measureTicks * totalMeasures;
        const pxPerTick = usableWidth / totalTicks;
        const staffY = topPad;
        const midLineY = staffY + lineSpacing * 2;
        const rowBarXs = [leftPad];
        for (let m = 1; m < totalMeasures; m++) {
            const x = leftPad + Math.round((measureTicks * m) * pxPerTick);
            rowBarXs.push(x);
        }
        rowBarXs.push(cssW - rightPad);
        function adjustAwayFromBar(x, barXs) {
            let nearest = null; let minD = Infinity;
            for (const bx of barXs) { const d = Math.abs(x - bx); if (d < minD) { minD = d; nearest = bx; } }
            const minDist = 7.5 + 3; // NOTEHEAD_RX + 3
            if (nearest != null && Math.abs(x - nearest) < minDist) { const smallOffset = 4; return nearest + smallOffset; }
            return x;
        }

        // Staff lines
        pctx.strokeStyle = palette.staff;
        pctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            const y = staffY + i * lineSpacing;
            pctx.beginPath();
            pctx.moveTo(leftPad, y);
            pctx.lineTo(cssW - rightPad, y);
            pctx.stroke();
        }
        // Time signature
        pctx.fillStyle = palette.text;
        pctx.font = 'bold 18px "Source Sans Pro", -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial';
        pctx.textAlign = 'right';
        pctx.fillText(String(pat.timeSig.beatsPerMeasure), leftPad - 8, staffY + lineSpacing * 1.4);
        pctx.fillText(String(pat.timeSig.beatNote), leftPad - 8, staffY + lineSpacing * 3.4);
        pctx.textAlign = 'left';
        // Measure barlines (left, internal, right)
        pctx.strokeStyle = palette.bar;
        pctx.lineWidth = 1.5;
        for (const bx of rowBarXs) {
            pctx.beginPath();
            pctx.moveTo(bx, staffY - 14);
            pctx.lineTo(bx, staffY + lineSpacing * 4 + 16);
            pctx.stroke();
        }

        // Local helpers for notes/rests (compact)
        const NOTE_RX = 7.5, NOTE_RY = 5.5, STEM_LEN = 36;
        function drawNote(x, y, filled, color) {
            pctx.save();
            pctx.translate(x, y);
            pctx.rotate(-20 * Math.PI / 180);
            pctx.beginPath();
            pctx.ellipse(0, 0, NOTE_RX, NOTE_RY, 0, 0, Math.PI * 2);
            if (filled) { pctx.fillStyle = color; pctx.fill(); } else { pctx.strokeStyle = color; pctx.lineWidth = 1.6; pctx.stroke(); }
            pctx.restore();
        }
        function drawDot(x, y, color) {
            pctx.fillStyle = color;
            pctx.beginPath();
            pctx.arc(x + NOTE_RX + 6, y - 2, 2.2, 0, Math.PI * 2);
            pctx.fill();
        }
        function stemUp(x, y, color) {
            pctx.strokeStyle = color; pctx.lineWidth = 2;
            pctx.beginPath();
            pctx.moveTo(x + NOTE_RX - 1, y - 1);
            pctx.lineTo(x + NOTE_RX - 1, y - STEM_LEN);
            pctx.stroke();
            return { stemX: x + NOTE_RX - 1, stemTopY: y - STEM_LEN, stemBotY: y - 1 };
        }
        // match main engine: stems up
        function quarterRest(x, y, color) {
            pctx.strokeStyle = color; pctx.lineWidth = 1.6;
            pctx.beginPath();
            pctx.moveTo(x - 4, y - 10); pctx.lineTo(x + 2, y - 18); pctx.lineTo(x - 2, y - 26); pctx.lineTo(x + 4, y - 34);
            pctx.stroke();
        }
        function eighthRest(x, y, color) {
            // Match main drawEighthRest
            pctx.strokeStyle = color; pctx.lineWidth = 2;
            pctx.beginPath();
            pctx.moveTo(x, y - 12);
            pctx.quadraticCurveTo(x + 8, y - 10, x + 2, y - 5);
            pctx.moveTo(x + 2, y - 5);
            pctx.quadraticCurveTo(x - 2, y + 2, x - 2, y + 8);
            pctx.stroke();
        }
        function halfRest(staffY, color) {
            const mid = staffY + lineSpacing * 2;
            pctx.fillStyle = color; pctx.fillRect(leftPad + 6, mid - 4, 12, 4);
        }
        function wholeRest(staffY, color) {
            const l = staffY + lineSpacing * 3;
            pctx.fillStyle = color; pctx.fillRect(leftPad + 6, l, 12, 4);
        }
        // Match main beam geometry
        const P_BEAM_THICK = 4;
        const P_BEAM_GAP = 3;
        function beamQuad(x1, y1, x2, y2, color) {
            pctx.fillStyle = color;
            pctx.beginPath();
            pctx.moveTo(x1, y1);
            pctx.lineTo(x2, y2);
            pctx.lineTo(x2, y2 + P_BEAM_THICK);
            pctx.lineTo(x1, y1 + P_BEAM_THICK);
            pctx.closePath();
            pctx.fill();
        }
        function pDrawFlagUp(stemX, stemTopY, beamIndex, color) {
            const y0 = stemTopY + (beamIndex - 1) * (P_BEAM_THICK + P_BEAM_GAP);
            const height = 10;
            const width = 12;
            pctx.fillStyle = color;
            pctx.beginPath();
            pctx.moveTo(stemX, y0);
            pctx.bezierCurveTo(
                stemX + width * 0.4, y0 + 2,
                stemX + width, y0 + 1,
                stemX + width, y0 + height * 0.6
            );
            pctx.bezierCurveTo(
                stemX + width * 0.9, y0 + height,
                stemX + width * 0.35, y0 + height * 0.9,
                stemX, y0 + height
            );
            pctx.closePath();
            pctx.fill();
        }

        // Layout + draw noteheads (state-aware coloring like main)
        const layouts = [];
        for (const it of pat.items) {
            let x = leftPad + it.startTick * pxPerTick;
            x = adjustAwayFromBar(x, rowBarXs);
            const color = colorForState(it.state || '');
            if (it.isRest) {
                const tpb = pat.ticksPerBeat;
                if (it.durTicks >= tpb * 4) wholeRest(staffY, color);
                else if (it.durTicks >= tpb * 2) halfRest(staffY, color);
                else if (it.durTicks >= tpb) quarterRest(x, midLineY, color);
                else eighthRest(x, midLineY, color);
                if (it.isDotted) drawDot(x, midLineY, color);
            } else {
                const filled = it.durTicks < (pat.ticksPerBeat * 2);
                drawNote(x, midLineY, filled, color);
                layouts.push({ it, x, y: midLineY, filled, color, stemX: null, stemTopY: null, stemBotY: null });
                if (it.isDotted) drawDot(x, midLineY, color);
            }
        }

        // Stems: match main engine (always up)
        for (const L of layouts) {
            if (L.it.durTicks >= (pat.ticksPerBeat * 4)) continue; // whole note => no stem
            const stem = stemUp(L.x, L.y, L.color);
            L.stemX = stem.stemX; L.stemTopY = stem.stemTopY; L.stemBotY = stem.stemBotY;
        }

        // Simple beaming (eighths and smaller) within beat groups
        const tpb = pat.ticksPerBeat;
        const beamGroupTicks = (pat.timeSig.beatNote === 8 && (pat.timeSig.beatsPerMeasure % 3 === 0)) ? tpb * 3 : tpb;
        function beamCount(durTicks) { return (typeof getBeamCount === 'function') ? getBeamCount(durTicks, tpb) : (durTicks < tpb ? 1 : 0); }
        // Sort by start
        const playable = layouts.sort((a, b) => a.it.startTick - b.it.startTick);
        for (let i = 0; i < playable.length - 1; i++) {
            const A = playable[i], B = playable[i + 1];
            const sameGroup = Math.floor(A.it.startTick / beamGroupTicks) === Math.floor(B.it.startTick / beamGroupTicks);
            const minBeams = Math.min(beamCount(A.it.durTicks), beamCount(B.it.durTicks));
            if (sameGroup && minBeams > 0) {
                // Stems up: connect at top like main engine
                beamQuad(A.stemX, A.stemTopY, B.stemX, B.stemTopY, palette.note);
            }
        }
        // Flags for ungrouped eighths
        for (let i = 0; i < playable.length; i++) {
            const L = playable[i];
            const prev = playable[i - 1];
            const next = playable[i + 1];
            const hasNeighbor = (prev && Math.floor(prev.it.startTick / beamGroupTicks) === Math.floor(L.it.startTick / beamGroupTicks) && prev.it.durTicks < tpb)
                || (next && Math.floor(next.it.startTick / beamGroupTicks) === Math.floor(L.it.startTick / beamGroupTicks) && next.it.durTicks < tpb);
            if (L.it.durTicks < tpb && !hasNeighbor) {
                pDrawFlagUp(L.stemX, L.stemTopY, 1, L.color);
            }
        }
        // Triplet markers like main
        for (let i = 0; i < playable.length;) {
            const L = playable[i];
            if (!L.it.isTriplet) { i++; continue; }
            const group = [L];
            let j = i + 1;
            while (j < playable.length && playable[j].it.isTriplet && Math.floor(playable[j].it.startTick / tpb) === Math.floor(L.it.startTick / tpb)) {
                group.push(playable[j]);
                j++;
                if (group.length === 3) break;
            }
            if (group.length === 3) {
                const x1 = group[0].x; const x3 = group[2].x;
                const yTop = Math.min(group[0].stemTopY, group[1].stemTopY, group[2].stemTopY) - 6;
                pctx.fillStyle = palette.text;
                pctx.font = '600 12px "Source Sans Pro", -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial';
                pctx.textAlign = 'center';
                pctx.fillText('3', (x1 + x3) / 2, yTop);
                i = j;
            } else { i++; }
        }

        const pxPerTickOut = pxPerTick; // exact mapping used for note placement
        return {
            leftPad,
            rightPad,
            usableWidth,
            measureTicks,
            totalMeasures,
            totalTicks,
            pxPerTick: pxPerTickOut,
            cssW,
            previewH,
            dpr: dprLocal,
            staffY,
            midLineY,
            lineSpacing
        };
    }

    function stopTutorialBeat() {
        if (tutorialBeatRaf) cancelAnimationFrame(tutorialBeatRaf);
        tutorialBeatRaf = 0;
        if (playingTutorialId) {
            const card = tutorialCards.get(playingTutorialId);
            if (card && card.beatBar) { card.beatBar.style.opacity = '0'; card.beatBar.style.display = 'none'; }
            if (card && card.countIn) { card.countIn.textContent = ''; card.countIn.style.display = 'none'; }
            if (card && card.greenCtx && card.greenCanvas) { card.greenCtx.clearRect(0, 0, card.greenCanvas.width, card.greenCanvas.height); }
            if (card) card._drawnIdx = new Set();
            if (card && card.btn) { card.btn.disabled = false; card.btn.textContent = 'Play'; }
        }
        playingTutorialId = null;
    }

    function startTutorialBeat(id) {
        stopTutorialBeat();
        const card = tutorialCards.get(id);
        if (!card) return;
        playingTutorialId = id;
        const { measureTicks, leftPad, usableWidth, pxPerTick } = card.dims;
        const useVisual = !(audioCtx && audioCtx.state === 'running');
        const getNow = () => (audioCtx && audioCtx.state === 'running') ? audioCtx.currentTime : (performance.now() / 1000);
        const getStart = () => useVisual ? schedule.startTimeVisual : schedule.startTimeAudio;
        const secondsPerTick = schedule ? schedule.secondsPerTick : (60 / 120 / TICKS_PER_QUARTER);
        // Card count-in numbers
        if (card.countIn && schedule && pattern) {
            const beatsPerMeasure = pattern.timeSig.beatsPerMeasure;
            const secondsPerBeat = schedule.secondsPerQuarter * (4 / pattern.timeSig.beatNote);
            let t = (audioCtx && audioCtx.state === 'running' ? audioCtx.currentTime : performance.now() / 1000) + 0.15;
            card.countIn.style.display = 'flex';
            for (let b = 0; b < beatsPerMeasure; b++) {
                const displayAt = t - 0.01;
                setTimeout(() => {
                    const still = tutorialCards.get(id) === card && currentTutorialId === id;
                    if (!still) return;
                    card.countIn.textContent = String(beatsPerMeasure - b);
                }, Math.max(0, (displayAt - (audioCtx ? audioCtx.currentTime : (performance.now() / 1000))) * 1000));
                t += secondsPerBeat;
            }
            // Hide number at start of playback
            setTimeout(() => {
                const still = tutorialCards.get(id) === card && currentTutorialId === id;
                if (!still) return;
                card.countIn.textContent = '';
                card.countIn.style.display = 'none';
            }, Math.max(0, (schedule.startTimeAudio - (audioCtx ? audioCtx.currentTime : (performance.now() / 1000))) * 1000));
        }
        // Hide moving playhead bar per request
        if (card.beatBar) { card.beatBar.style.display = 'none'; }

        function raf() {
            if (!isPlaying || currentTutorialId !== id || !schedule) { stopTutorialBeat(); return; }
            const now = getNow();
            const t = now - getStart();
            const ticks = clamp(t / secondsPerTick, 0, measureTicks);
            // Playhead removed
            // Draw green overlay only (no base redraws/resizes)
            if (card.pattern && Array.isArray(card.pattern.items) && card.greenCtx) {
                const gc = card.greenCtx;
                const drawn = card._drawnIdx || (card._drawnIdx = new Set());
                const startBase = getStart();
                const NOTE_RX = 7.5, NOTE_RY = 5.5;
                const STEM_LEN = 36;
                const P_BEAM_THICK = 4, P_BEAM_GAP = 3;
                const tpb = card.pattern.ticksPerBeat;
                const ts = card.pattern.timeSig;
                const beamGroupTicks = (ts.beatNote === 8 && (ts.beatsPerMeasure % 3 === 0)) ? tpb * 3 : tpb;
                function beamCount(dur) { return (typeof getBeamCount === 'function') ? getBeamCount(dur, tpb) : (dur < tpb ? 1 : 0); }
                function adjustAwayFromBar(x) {
                    const left = card.dims.leftPad, right = (card.dims.cssW - card.dims.rightPad);
                    const minDist = NOTE_RX + 3;
                    const dLeft = Math.abs(x - left), dRight = Math.abs(x - right);
                    if (dLeft < minDist) return left + 4;
                    if (dRight < minDist) return right + 4;
                    return x;
                }
                function stemUp(x, y, color) {
                    gc.strokeStyle = color; gc.lineWidth = 2;
                    gc.beginPath();
                    gc.moveTo(x + NOTE_RX - 1, y - 1);
                    gc.lineTo(x + NOTE_RX - 1, y - STEM_LEN);
                    gc.stroke();
                    return { stemX: x + NOTE_RX - 1, stemTopY: y - STEM_LEN };
                }
                function beamQuad(x1, y1, x2, y2, color) {
                    gc.fillStyle = color;
                    gc.beginPath();
                    gc.moveTo(x1, y1);
                    gc.lineTo(x2, y2);
                    gc.lineTo(x2, y2 + P_BEAM_THICK);
                    gc.lineTo(x1, y1 + P_BEAM_THICK);
                    gc.closePath();
                    gc.fill();
                }
                // First pass: draw noteheads + stems for notes now due
                const layouts = [];
                for (let idx = 0; idx < card.pattern.items.length; idx++) {
                    const it = card.pattern.items[idx];
                    if (it.isRest || drawn.has(idx)) continue;
                    const et = startBase + (it.startTick * secondsPerTick);
                    if (now >= et) {
                        const x0 = card.dims.leftPad + it.startTick * card.dims.pxPerTick;
                        const x = adjustAwayFromBar(x0);
                        const y = card.dims.midLineY;
                        gc.save();
                        gc.translate(x, y);
                        gc.rotate(-20 * Math.PI / 180);
                        gc.beginPath();
                        gc.ellipse(0, 0, NOTE_RX, NOTE_RY, 0, 0, Math.PI * 2);
                        gc.fillStyle = 'rgba(34,197,94,1)';
                        gc.fill();
                        gc.restore();
                        const stem = stemUp(x, y, 'rgba(34,197,94,1)');
                        layouts.push({ idx, it, x, y, stemX: stem.stemX, stemTopY: stem.stemTopY });
                        drawn.add(idx);
                    }
                }
                // Second pass: green beams where neighbors in same group are already green
                layouts.sort((a, b) => a.it.startTick - b.it.startTick);
                for (let i = 0; i < layouts.length - 1; i++) {
                    const A = layouts[i], B = layouts[i + 1];
                    const sameGroup = Math.floor(A.it.startTick / beamGroupTicks) === Math.floor(B.it.startTick / beamGroupTicks);
                    const minBeams = Math.min(beamCount(A.it.durTicks), beamCount(B.it.durTicks));
                    if (!sameGroup || minBeams <= 0) continue;
                    for (let b = 1; b <= minBeams; b++) {
                        const yA = A.stemTopY + (b - 1) * (P_BEAM_THICK + P_BEAM_GAP);
                        const yB = B.stemTopY + (b - 1) * (P_BEAM_THICK + P_BEAM_GAP);
                        beamQuad(A.stemX, yA, B.stemX, yB, 'rgba(34,197,94,1)');
                    }
                }
                // Triplet marker green when all three in group are due
                for (let i = 0; i < layouts.length;) {
                    const L = layouts[i];
                    if (!L.it.isTriplet) { i++; continue; }
                    const group = [L];
                    let j = i + 1;
                    while (j < layouts.length && layouts[j].it.isTriplet && Math.floor(layouts[j].it.startTick / tpb) === Math.floor(L.it.startTick / tpb)) {
                        group.push(layouts[j]);
                        j++;
                        if (group.length === 3) break;
                    }
                    if (group.length === 3) {
                        const x1 = group[0].x, x3 = group[2].x;
                        const yTop = Math.min(group[0].stemTopY, group[1].stemTopY, group[2].stemTopY) - 6;
                        gc.fillStyle = 'rgba(34,197,94,1)';
                        gc.font = '600 12px "Source Sans Pro", -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial';
                        gc.textAlign = 'center';
                        gc.fillText('3', (x1 + x3) / 2, yTop);
                        i = j;
                    } else { i++; }
                }
            }
            tutorialBeatRaf = requestAnimationFrame(raf);
        }
        tutorialBeatRaf = requestAnimationFrame(raf);
    }

    function renderTutorialList() {
        if (!el.tutorialList) return;
        tutorialCards.clear();
        el.tutorialList.innerHTML = '';
        el.tutorialList.classList.add('tutorial-grid');
        tutorials.forEach(section => {
            const hdr = document.createElement('div');
            hdr.className = 'subtitle';
            hdr.textContent = section.group;
            hdr.style.gridColumn = '1 / -1';
            el.tutorialList.appendChild(hdr);
            section.items.forEach(item => {
                const card = document.createElement('div');
                card.className = 'tutorial-card';
                if (item.measures && item.measures > 1) card.classList.add('span2');
                const title = document.createElement('div');
                title.className = 'title';
                title.textContent = item.label;
                const sub = document.createElement('div');
                sub.className = 'subtitle';
                sub.textContent = `${item.desc} • ${item.timeSig}${item.measures && item.measures > 1 ? ` • ${item.measures} bars` : ''}`;
                const wrap = document.createElement('div');
                wrap.className = 'tutorial-preview-wrap';
                const canvas = document.createElement('canvas');
                canvas.className = 'tutorial-preview';
                const overlay = document.createElement('div');
                overlay.className = 'tutorial-beat-overlay';
                const beat = document.createElement('div');
                beat.className = 'tutorial-beat-bar';
                const countin = document.createElement('div');
                countin.className = 'tutorial-countin';
                const green = document.createElement('canvas');
                green.className = 'tutorial-green';
                overlay.appendChild(beat);
                overlay.appendChild(countin);
                overlay.appendChild(green);
                wrap.appendChild(canvas);
                wrap.appendChild(overlay);
                const btn = document.createElement('button');
                btn.textContent = 'Play';
                const pat = buildFixedPatternFromTokens(item.timeSig, item.tokens, item.measures || 1);
                const dims = drawTutorialPreview(canvas, pat);
                // Size green overlay to match base
                const gctx = green.getContext('2d');
                green.style.width = `${dims.cssW}px`;
                green.style.height = `${dims.previewH}px`;
                green.width = Math.floor(dims.cssW * dims.dpr);
                green.height = Math.floor(dims.previewH * dims.dpr);
                gctx.setTransform(dims.dpr, 0, 0, dims.dpr, 0, 0);
                tutorialCards.set(item.id, { pattern: pat, canvas, beatBar: beat, countIn: countin, greenCanvas: green, greenCtx: gctx, dims, btn, _drawnIdx: new Set() });
                btn.addEventListener('click', async () => {
                    // Always start from top; not pausable. Disable this button while playing.
                    if (isPlaying) stopPlayback();
                    tutorialMode = true;
                    currentTutorialId = item.id;
                    pattern = pat;
                    if (el.bpm && item.bpm) { el.bpm.value = String(clamp(item.bpm, 30, 240)); const bv = document.getElementById('bpmVal'); if (bv) bv.textContent = String(el.bpm.value); }
                    await ensureAudio();
                    await startPlayback();
                    // Update all buttons to default, then mark this one as Playing
                    Array.from(el.tutorialList.querySelectorAll('button')).forEach(b => { b.textContent = 'Play'; b.disabled = false; });
                    btn.textContent = 'Playing…';
                    btn.disabled = true;
                    startTutorialBeat(item.id);
                });
                card.appendChild(title);
                card.appendChild(sub);
                card.appendChild(wrap);
                card.appendChild(btn);
                el.tutorialList.appendChild(card);
            });
        });
    }

    if (el.openTutorials) {
        el.openTutorials.addEventListener('click', () => {
            tutorialMode = true;
            if (el.tutorialsOverlay) el.tutorialsOverlay.style.display = 'flex';
            if (el.startOverlay) el.startOverlay.style.display = 'none';
            if (el.tutorialsOverlay) { el.tutorialsOverlay.scrollTop = 0; }
            document.body.style.overflow = '';
            renderTutorialList();
            // Match overlay card width to practice content width
            const card = el.tutorialsOverlay && el.tutorialsOverlay.querySelector('.summary-card');
            const practice = document.querySelector('.main-content .card') || el.canvasWrap || document.querySelector('.start-bar');
            if (card && practice) {
                const w = Math.max(320, Math.floor(practice.getBoundingClientRect().width));
                card.style.maxWidth = `${w}px`;
                card.style.width = '100%';
                card.style.margin = '0 auto';
            }
            // After layout settles, redraw previews to final measured widths to remove initial empty space
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    tutorialCards.forEach((c) => {
                        if (!c || !c.canvas || !c.pattern) return;
                        const dims = drawTutorialPreview(c.canvas, c.pattern);
                        c.dims = dims;
                        if (c.greenCanvas && c.greenCtx) {
                            c.greenCanvas.style.width = `${dims.cssW}px`;
                            c.greenCanvas.style.height = `${dims.previewH}px`;
                            c.greenCanvas.width = Math.floor(dims.cssW * dims.dpr);
                            c.greenCanvas.height = Math.floor(dims.previewH * dims.dpr);
                            c.greenCtx.setTransform(dims.dpr, 0, 0, dims.dpr, 0, 0);
                            c.greenCtx.clearRect(0, 0, c.greenCanvas.width, c.greenCanvas.height);
                            c._drawnIdx = new Set();
                        }
                    });
                });
            });
            resizeCanvas();
        });
    }
    // Keep tutorials card width in sync on resize - throttled for performance
    let tutorialsResizeTimeout = null;
    window.addEventListener('resize', () => {
        if (!el.tutorialsOverlay || getComputedStyle(el.tutorialsOverlay).display === 'none') return;
        if (tutorialsResizeTimeout) clearTimeout(tutorialsResizeTimeout);
        tutorialsResizeTimeout = setTimeout(() => {
            const card = el.tutorialsOverlay.querySelector('.summary-card');
            const practice = document.querySelector('.main-content .card') || el.canvasWrap || document.querySelector('.start-bar');
            if (card && practice) {
                const w = Math.max(320, Math.floor(practice.getBoundingClientRect().width));
                card.style.maxWidth = `${w}px`;
            }
        }, 150);
    }, { passive: true });
    if (el.tutorialsBack) {
        el.tutorialsBack.addEventListener('click', () => {
            stopPlayback();
            tutorialMode = false;
            currentTutorialId = null;
            if (el.tutorialsOverlay) el.tutorialsOverlay.style.display = 'none';
            if (el.startOverlay) el.startOverlay.style.display = 'flex';
            resizeCanvas();
        });
    }

    // Redraw tutorial previews on resize when overlay is visible - throttled for performance
    let tutorialPreviewResizeTimeout = null;
    window.addEventListener('resize', () => {
        if (!isVisible(el.tutorialsOverlay)) return;
        if (tutorialPreviewResizeTimeout) clearTimeout(tutorialPreviewResizeTimeout);
        tutorialPreviewResizeTimeout = setTimeout(() => {
            tutorialCards.forEach((card, id) => {
                const dims = drawTutorialPreview(card.canvas, card.pattern);
                card.dims = dims;
                // Resync green overlay canvas to base size
                if (card.greenCanvas && card.greenCtx) {
                    card.greenCanvas.style.width = `${dims.cssW}px`;
                    card.greenCanvas.style.height = `${dims.previewH}px`;
                    card.greenCanvas.width = Math.floor(dims.cssW * dims.dpr);
                    card.greenCanvas.height = Math.floor(dims.previewH * dims.dpr);
                    card.greenCtx.setTransform(dims.dpr, 0, 0, dims.dpr, 0, 0);
                    card.greenCtx.clearRect(0, 0, card.greenCanvas.width, card.greenCanvas.height);
                    card._drawnIdx = new Set();
                }
            });
        }, 200);
    }, { passive: true });

    // Init
    applySettings(loadSettings());
    sizeCanvasWrap();
    resizeCanvas();
    generatePattern();
    // Show start overlay initially
    el.startOverlay.style.display = 'flex';
    if (el.canvasWrap) { el.canvasWrap.scrollTop = 0; el.canvasWrap.style.overflowY = 'hidden'; }
})();
