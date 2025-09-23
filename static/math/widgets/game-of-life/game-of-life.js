// Conway's Game of Life - JavaScript Logic
import { ids } from '../shared/shared-utils.js';

// --- DOM Elements ---
const canvas = ids('gameOfLifeCanvas');
const ctx = canvas.getContext('2d');

const startPauseButton = ids('startPauseButton');
const nextStepButton = ids('nextStepButton');
const resetClearButton = ids('resetClearButton');
const gridSizeSlider = ids('gridSizeSlider');
const gridSizeDisplay = ids('gridSizeDisplay');
const speedSlider = ids('speedSlider');
const speedDisplay = ids('speedDisplay');
const patternSelect = ids('patternSelect');
const generationDisplay = ids('generationDisplay');

// --- Game Configuration & State ---
let gridSize = parseInt(gridSizeSlider.value);
let cellSize; // Calculated dynamically
let grid = []; // 2D array for cell states (0 = dead, 1 = live)
let isRunning = false;
let generationCount = 0;
let simulationSpeed = parseInt(speedSlider.value);
let intervalId = null;

const LIVE_CELL_COLOR = '#000000'; // Black for live cells
const GRID_LINE_COLOR = '#cccccc';

// --- Core Logic ---
function createGrid(size) {
    return Array.from({ length: size }, () => Array(size).fill(0));
}

function calculateCellSize() {
    const chartArea = canvas.parentElement;
    if (!chartArea) return;

    // Get the actual display dimensions of the canvas element based on CSS
    const computedCanvasStyle = getComputedStyle(canvas);
    const cssCanvasWidth = parseInt(computedCanvasStyle.width, 10);
    const cssCanvasHeight = parseInt(computedCanvasStyle.height, 10);

    if (cssCanvasWidth > 0 && cssCanvasHeight > 0) {
        canvas.width = cssCanvasWidth;   // Set drawing surface width
        canvas.height = cssCanvasHeight; // Set drawing surface height
        cellSize = Math.min(canvas.width / gridSize, canvas.height / gridSize);
    } else {
        // Fallback or error if canvas has no dimensions
        cellSize = 10; // Default to a small cell size if canvas dimensions are zero
        canvas.width = gridSize * cellSize;
        canvas.height = gridSize * cellSize;
    }
}

function initGame() {
    gridSize = parseInt(gridSizeSlider.value);
    grid = createGrid(gridSize);
    calculateCellSize(); // Use reverted function
    generationCount = 0;
    if (isRunning) {
        pauseSimulation();
    }
    loadPattern(patternSelect.value); // Will also call renderGrid
    updateDisplays();
}

function renderGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = GRID_LINE_COLOR;
    // Draw grid lines up to the actual displayed canvas size, not potentially larger logical size
    const renderWidth = gridSize * cellSize;
    const renderHeight = gridSize * cellSize;

    for (let i = 0; i <= gridSize; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellSize, 0);
        ctx.lineTo(i * cellSize, renderHeight);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(renderWidth, i * cellSize);
        ctx.stroke();
    }
    ctx.fillStyle = LIVE_CELL_COLOR;
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            if (grid[r][c] === 1) {
                // Ensure drawing is within canvas bounds if cellsize * gridsize > canvas W/H
                // This shouldn't happen with the reverted cellSize logic if canvas W/H is set correctly.
                ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
            }
        }
    }
}

function countLiveNeighbors(row, col) {
    let count = 0;
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            if (i === 0 && j === 0) continue;
            const r = row + i;
            const c = col + j;
            if (r >= 0 && r < gridSize && c >= 0 && c < gridSize && grid[r][c] === 1) {
                count++;
            }
        }
    }
    return count;
}

function calculateNextGeneration() {
    const nextGrid = createGrid(gridSize);
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            const liveNeighbors = countLiveNeighbors(r, c);
            const cellState = grid[r][c];
            if (cellState === 1 && (liveNeighbors < 2 || liveNeighbors > 3)) {
                nextGrid[r][c] = 0; // Die
            } else if (cellState === 0 && liveNeighbors === 3) {
                nextGrid[r][c] = 1; // Reproduce
            } else {
                nextGrid[r][c] = cellState; // Stays same
            }
        }
    }
    grid = nextGrid;
    generationCount++;
}

function runStep() {
    calculateNextGeneration();
    renderGrid();
    updateDisplays();
}

function startSimulation() {
    if (!isRunning) {
        isRunning = true;
        startPauseButton.textContent = 'Pause';
        intervalId = setInterval(runStep, simulationSpeed);
    }
}

function pauseSimulation() {
    if (isRunning) {
        isRunning = false;
        startPauseButton.textContent = 'Start';
        clearInterval(intervalId);
        intervalId = null;
    }
}

function updateDisplays() {
    gridSizeDisplay.textContent = gridSize;
    speedDisplay.textContent = simulationSpeed;
    generationDisplay.textContent = generationCount;
}

// --- Pattern Loading --- 
// (Simplified: patterns are placed assuming grid is large enough)
// Coordinates are [row, col] from top-left
const PATTERNS = {
    clear: [],
    glider: [[0,1], [1,2], [2,0], [2,1], [2,2]],
    blinker: [[1,0], [1,1], [1,2]],
    toad: [[1,1], [1,2], [1,3], [2,0], [2,1], [2,2]],
    beacon: [[0,0],[0,1],[1,0],[1,1], [2,2],[2,3],[3,2],[3,3]],
    lwss: [[0,1],[0,4],[1,0],[2,0],[2,4],[3,0],[3,1],[3,2],[3,3]],
    // Add more complex patterns carefully, they need space
    gosperglidergun: [
        [0,24],[1,22],[1,24],[2,12],[2,13],[2,20],[2,21],[2,34],[2,35],
        [3,11],[3,15],[3,20],[3,21],[3,34],[3,35],[4,0],[4,1],[4,10],[4,16],[4,20],[4,21],
        [5,0],[5,1],[5,10],[5,14],[5,16],[5,17],[5,22],[5,24],[6,10],[6,16],[6,24],[7,11],[7,15],[8,12],[8,13]
    ],
    rpentomino: [[0,1],[0,2],[1,0],[1,1],[2,1]],
    diehard: [[0,6],[1,0],[1,1],[2,1],[2,5],[2,6],[2,7]],
    acorn: [[0,1],[1,3],[2,0],[2,1],[2,4],[2,5],[2,6]],
};

function placePattern(pattern, rOffset = 0, cOffset = 0) {
    pattern.forEach(([r, c]) => {
        const finalR = r + rOffset;
        const finalC = c + cOffset;
        if (finalR >= 0 && finalR < gridSize && finalC >= 0 && finalC < gridSize) {
            grid[finalR][finalC] = 1;
        }
    });
}

function loadPattern(patternName) {
    grid = createGrid(gridSize); // Clear grid first
    const pattern = PATTERNS[patternName];
    if (pattern) {
        // Try to center larger patterns, place smaller ones near top-left
        let rOffset = 2, cOffset = 2;
        if (patternName === 'gosperglidergun' || patternName === 'pulsar') { // Crude centering for known large patterns
            // Calculate pattern bounds (approximate)
            let maxR = 0, maxC = 0;
            pattern.forEach(([r,c]) => { maxR = Math.max(maxR, r); maxC = Math.max(maxC, c); });
            rOffset = Math.floor((gridSize - maxR) / 2);
            cOffset = Math.floor((gridSize - maxC) / 2);
        }
        placePattern(pattern, rOffset, cOffset);
    }
    generationCount = 0; // Reset generation when new pattern loads
    updateDisplays();
    renderGrid();
}

// --- Event Listeners ---
startPauseButton.addEventListener('click', () => {
    if (isRunning) pauseSimulation();
    else startSimulation();
});

nextStepButton.addEventListener('click', () => {
    if (!isRunning) runStep();
});

resetClearButton.addEventListener('click', () => {
    initGame(); // Re-initializes with current slider values, effectively clearing and resetting
});

gridSizeSlider.addEventListener('input', (e) => {
    gridSize = parseInt(e.target.value);
    initGame();
    updateDisplays();
});

speedSlider.addEventListener('input', (e) => {
    simulationSpeed = parseInt(e.target.value);
    if (isRunning) { // If running, clear and restart interval with new speed
        pauseSimulation();
        startSimulation();
    }
    updateDisplays();
});

patternSelect.addEventListener('change', (e) => {
    if (isRunning) pauseSimulation();
    loadPattern(e.target.value);
});

canvas.addEventListener('click', (event) => {
    if (isRunning) return; 
    const rect = canvas.getBoundingClientRect(); 
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    // cellSize should be defined globally and correctly by calculateCellSize
    if (!cellSize || cellSize <= 0) return; // Prevent division by zero if cellSize isn't set
    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);
    if (row >= 0 && row < gridSize && col >= 0 && col < gridSize) {
        grid[row][col] = 1 - grid[row][col]; 
        renderGrid();
    }
});

function handleResize() {
    calculateCellSize(); // Recalculate cell size based on new canvas display size
    renderGrid();
}
window.addEventListener('resize', handleResize);

// --- Initial Game Setup ---
document.addEventListener('DOMContentLoaded', () => {
    // Set canvas CSS display height to match shared style for canvas elements
    // This ensures calculateCellSize() can read the correct height from CSS
    // Shared styles already define canvas height: 300px desktop, 250px mobile.
    // We just need to ensure our JS reads this when setting drawing surface.
    // The `canvas.style.height` part was to force it, but relying on CSS is better.
    // `calculateCellSize` will now read the computed style.
    initGame(); 
}); 