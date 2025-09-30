// Tower of Hanoi - JavaScript Logic

import { ids, fmt } from '../shared/shared-utils.js'; // Changed import

// --- DOM Elements ---
const numDisksSlider = ids('numDisksSlider');
const increaseDisksButton = ids('increaseDisksButton');
const decreaseDisksButton = ids('decreaseDisksButton');
const numDisksDisplay = ids('numDisksDisplay');
const movesTakenDisplay = ids('movesTakenDisplay');
const resetButton = ids('resetButton');
const undoButton = ids('undoButton'); // New button
const undoCountDisplay = ids('undoCountDisplay'); // New display
const hanoiSvg = ids('hanoiSvg');
const hanoiWarning = ids('hanoiWarning'); // Get the warning element
const hanoiWin = ids('hanoiWin');

// --- Game Constants & Configuration ---
const NUM_TOWERS = 3;
const TOWER_COLORS = ['#666', '#666', '#666']; // Can be different if desired
const DISK_HEIGHT = 20;
const MIN_DISK_WIDTH = 40;
const DISK_WIDTH_STEP = 20; // How much wider each subsequent disk is
const SVG_WIDTH = 600; // Must match viewBox for calculations
const SVG_HEIGHT = 300; // Must match viewBox for calculations
const TOWER_BASE_Y = SVG_HEIGHT - 30;
const TOWER_WIDTH = 10;
const TOWER_SPACING = SVG_WIDTH / (NUM_TOWERS + 1);
const CLICK_TARGET_WIDTH_PADDING = 30; // Extra width on each side of the peg for clickability
const GOAL_TOWER_COLOR = '#28a745'; // Green for goal, for example

// --- Game State ---
let numDisks = 1;
let towers = []; // Array of arrays, e.g., [[3,2,1], [], []] (disk sizes)
let moveCount = 0;
let selectedDisk = null; // { size: number, originalTowerIndex: number }
let isGameWon = false;
let showGhostStack = true; // New state variable
let moveHistory = []; // For undo
let undoCount = 0;    // For undo counter

// --- Disk Colors (match CSS) ---
const DISK_COLORS = [
  '#E60000', '#F0B800', '#00B800', '#007bff',
  '#6f42c1', '#fd7e14', '#20c997', '#e83e8c'
];

// --- Game Logic ---
function calculateOptimalMoves(n) {
  return Math.pow(2, n) - 1;
}

function initGame(n) {
  // Clamp to [1, 8]
  const clamped = Math.min(8, Math.max(1, parseInt(n)));
  numDisks = Number.isFinite(clamped) ? clamped : 1;
  // Ensure the slider reflects the current state
  if (numDisksSlider && numDisksSlider.value !== String(numDisks)) {
    numDisksSlider.value = String(numDisks);
  }
  towers = Array.from({ length: NUM_TOWERS }, () => []);
  for (let i = numDisks; i >= 1; i--) {
    towers[0].push(i); // Push disk size (1 is smallest)
  }
  moveCount = 0;
  selectedDisk = null;
  isGameWon = false;
  showGhostStack = true; // Reset ghost stack visibility on new game/reset
  moveHistory = []; // Clear history
  undoCount = 0;    // Reset undo count

  numDisksDisplay.textContent = numDisks;
  movesTakenDisplay.textContent = moveCount;
  undoCountDisplay.textContent = undoCount; // Update display
  undoButton.disabled = true; // Disable undo at start
  updateStepButtonsState();
  
  // Ensure win message is hidden on (re)initialization
  if (hanoiWin) {
    hanoiWin.style.display = 'none';
    hanoiWin.textContent = '';
  }
  
  renderGame();
}

function renderGame() {
  hanoiSvg.innerHTML = ''; // Clear previous SVG content

  // --- Draw Single Continuous Base --- 
  const baseWidth = SVG_WIDTH - TOWER_SPACING / 2; // Make it wide enough
  const baseX = TOWER_SPACING / 4;
  const continuousBase = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  continuousBase.setAttribute('x', baseX);
  continuousBase.setAttribute('y', TOWER_BASE_Y);
  continuousBase.setAttribute('width', baseWidth);
  continuousBase.setAttribute('height', 15); // Slightly thicker base
  continuousBase.setAttribute('class', 'hanoi-tower'); // Use same class for color
  continuousBase.setAttribute('rx', 3);
  continuousBase.setAttribute('ry', 3);
  continuousBase.setAttribute('id', 'hanoiGameBase');
  hanoiSvg.appendChild(continuousBase);

  // Draw Towers (Pegs) and Click Targets
  for (let i = 0; i < NUM_TOWERS; i++) {
    const towerX = TOWER_SPACING * (i + 1);
    const pegHeight = DISK_HEIGHT * (numDisks + 1);
    const pegTopY = TOWER_BASE_Y - pegHeight;

    // --- Invisible Click Target (Revised Geometry) ---
    // Starts one disk height above the visible peg, extends down to the top of the continuous base.
    const clickTargetVisualY = pegTopY - DISK_HEIGHT; // Where visually it might seem to start for a drop
    const clickTargetActualY = Math.max(0, pegTopY - DISK_HEIGHT); // Ensure it doesn't go above SVG 0
    const clickTargetHeight = TOWER_BASE_Y - clickTargetActualY;

    const clickTarget = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    clickTarget.setAttribute('x', towerX - TOWER_WIDTH / 2 - CLICK_TARGET_WIDTH_PADDING);
    clickTarget.setAttribute('y', clickTargetActualY);
    clickTarget.setAttribute('width', TOWER_WIDTH + 2 * CLICK_TARGET_WIDTH_PADDING);
    clickTarget.setAttribute('height', clickTargetHeight > 0 ? clickTargetHeight : DISK_HEIGHT); // Ensure positive height
    clickTarget.setAttribute('fill', 'transparent'); 
    clickTarget.setAttribute('data-tower-index', i);
    clickTarget.style.cursor = 'pointer'; 
    hanoiSvg.appendChild(clickTarget); 

    // --- Visible Peg --- 
    const peg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    peg.setAttribute('x', towerX - TOWER_WIDTH / 2);
    peg.setAttribute('y', pegTopY); 
    peg.setAttribute('width', TOWER_WIDTH);
    peg.setAttribute('height', pegHeight); 
    peg.setAttribute('class', 'hanoi-tower');
    if (i === NUM_TOWERS - 1) { 
      peg.setAttribute('fill', GOAL_TOWER_COLOR);
    } else {
      peg.setAttribute('fill', TOWER_COLORS[i]);
    }
    peg.style.pointerEvents = 'none'; 
    hanoiSvg.appendChild(peg);
  }

  const diskElements = []; // To help find the SVG element for the selected disk

  towers.forEach((tower, towerIndex) => {
    tower.forEach((diskSize, diskIndexInTower) => {
      const diskWidth = MIN_DISK_WIDTH + (diskSize - 1) * DISK_WIDTH_STEP;
      const diskX = TOWER_SPACING * (towerIndex + 1) - diskWidth / 2;
      const diskY = TOWER_BASE_Y - (diskIndexInTower + 1) * DISK_HEIGHT;

      const diskRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      diskRect.setAttribute('x', diskX);
      diskRect.setAttribute('y', diskY);
      diskRect.setAttribute('width', diskWidth);
      diskRect.setAttribute('height', DISK_HEIGHT - 2); // -2 for a slight gap
      diskRect.setAttribute('rx', 5); // Rounded corners
      diskRect.setAttribute('ry', 5);
      diskRect.setAttribute('class', `hanoi-disk disk-color-${diskSize - 1}`);
      diskRect.setAttribute('data-disk-size', diskSize);
      diskRect.setAttribute('data-tower-index', towerIndex);
      diskRect.setAttribute('data-disk-id', `disk-${towerIndex}-${diskIndexInTower}`);
      diskElements.push({ id: `disk-${towerIndex}-${diskIndexInTower}`, element: diskRect, size: diskSize, originalTowerIndex: towerIndex });

      if (selectedDisk && selectedDisk.size === diskSize && selectedDisk.originalTowerIndex === towerIndex && towers[towerIndex].length > 0 && towers[towerIndex][towers[towerIndex].length -1] === diskSize) {
        diskRect.classList.add('selected');
        // Optional: Lift selected disk visually
        // diskRect.setAttribute('y', parseFloat(diskRect.getAttribute('y')) - DISK_HEIGHT / 2);
      }
      hanoiSvg.appendChild(diskRect);
    });
  });
  
  // If a disk is selected, make sure it's rendered last to be on top visually
  if (selectedDisk) {
    const selectedElementData = diskElements.find(d => 
        d.size === selectedDisk.size && 
        d.originalTowerIndex === selectedDisk.originalTowerIndex &&
        towers[selectedDisk.originalTowerIndex].length > 0 && 
        towers[selectedDisk.originalTowerIndex][towers[selectedDisk.originalTowerIndex].length -1] === selectedDisk.size
    );
    if (selectedElementData && selectedElementData.element.parentElement) {
        selectedElementData.element.parentElement.appendChild(selectedElementData.element);
        // Apply selected class again if not already applied by above loop
        if(!selectedElementData.element.classList.contains('selected')){
            selectedElementData.element.classList.add('selected');
        }
    }
  }
  
  // --- Draw Ghost Stack (if applicable) ---
  if (showGhostStack) {
    const goalTowerIndex = NUM_TOWERS - 1;
    for (let diskSize = numDisks; diskSize >= 1; diskSize--) {
      const diskIndexInTower = numDisks - diskSize;
      const diskWidth = MIN_DISK_WIDTH + (diskSize - 1) * DISK_WIDTH_STEP;
      const diskX = TOWER_SPACING * (goalTowerIndex + 1) - diskWidth / 2;
      const diskY = TOWER_BASE_Y - (diskIndexInTower + 1) * DISK_HEIGHT;

      const ghostDiskRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      ghostDiskRect.setAttribute('x', diskX);
      ghostDiskRect.setAttribute('y', diskY);
      ghostDiskRect.setAttribute('width', diskWidth);
      ghostDiskRect.setAttribute('height', DISK_HEIGHT - 2);
      ghostDiskRect.setAttribute('rx', 5);
      ghostDiskRect.setAttribute('ry', 5);
      ghostDiskRect.setAttribute('class', `hanoi-disk disk-color-${diskSize - 1}`); // Use actual colors but make transparent
      ghostDiskRect.style.opacity = '0.3'; // Make it transparent
      ghostDiskRect.style.pointerEvents = 'none'; // Non-interactive
      hanoiSvg.appendChild(ghostDiskRect);
    }
  }
  
  if (isGameWon) {
    const optimalMoves = calculateOptimalMoves(numDisks);
    let message = '';
    if (numDisks <= 4) {
      // Up to 4 disks: do not reveal optimal unless they matched it; starting at 5, reveal even if not matched
      if (moveCount === optimalMoves) {
        message = `You won in ${moveCount} moves, the optimal amount of moves!`;
      } else {
        message = `You won in ${moveCount} moves! Can you beat this score?`;
      }
    } else {
      if (moveCount === optimalMoves) {
        message = `Congratulations! You won in ${moveCount} moves—the optimal number of moves!`;
      } else {
        message = `You won in ${moveCount} moves! Optimal: ${optimalMoves}`;
      }
    }
    if (hanoiWin) {
      hanoiWin.textContent = message;
      hanoiWin.style.display = 'block';
    }
  } else {
    // Hide win message whenever the game is not in a won state
    if (hanoiWin) {
      hanoiWin.style.display = 'none';
      hanoiWin.textContent = '';
    }
  }
}

let warningTimeout = null;
function showWarning(message) {
    hanoiWarning.textContent = message;
    hanoiWarning.style.display = 'block';
    clearTimeout(warningTimeout);
    warningTimeout = setTimeout(() => {
        hanoiWarning.style.display = 'none';
    }, 2000);
}

function handleTowerClick(towerIndex) {
  if (isGameWon) return;

  if (selectedDisk === null) { // Try to pick up a disk
    if (towers[towerIndex].length > 0) {
      const diskToSelect = towers[towerIndex][towers[towerIndex].length - 1];
      selectedDisk = { size: diskToSelect, originalTowerIndex: towerIndex };
      // No actual pop from towers array here, just mark as selected for rendering
      // The actual pop happens on a successful drop
      renderGame(); // Re-render to show selection
    }
  } else { // Try to place the selected disk
    const topDiskOnTargetTower = towers[towerIndex].length > 0 ? towers[towerIndex][towers[towerIndex].length - 1] : null;
    
    if (towerIndex !== selectedDisk.originalTowerIndex && (topDiskOnTargetTower === null || selectedDisk.size < topDiskOnTargetTower)) {
      // Valid move to a DIFFERENT tower:
      // 1. Store current state for undo
      moveHistory.push({
        towersState: JSON.parse(JSON.stringify(towers)), // Deep copy
        moveCountBefore: moveCount,
        isGameWonBefore: isGameWon, // Store previous win state
        showGhostStackBefore: showGhostStack // Store ghost stack state
      });
      undoButton.disabled = false; // Enable undo button

      // 2. Remove from original tower
      const poppedDisk = towers[selectedDisk.originalTowerIndex].pop();
      // 3. Add to new tower
      towers[towerIndex].push(poppedDisk);
      
      moveCount++;
      if (moveCount === 1 && showGhostStack) { 
        showGhostStack = false;
      }
      movesTakenDisplay.textContent = moveCount;
      selectedDisk = null;
      checkWinCondition(); // This might set isGameWon
      renderGame();
    } else if (towerIndex === selectedDisk.originalTowerIndex) {
        // Clicked the same tower to deselect
        selectedDisk = null; 
        renderGame(); 
    } else {
      // Invalid move (larger on smaller on a different tower)
      showWarning("Invalid Move: Cannot place larger disk on smaller one.");
      // Find the SVG element for the selected disk to shake it
      const diskElements = Array.from(hanoiSvg.querySelectorAll('.hanoi-disk'));
      const diskToShake = diskElements.find(el => 
          parseInt(el.dataset.diskSize) === selectedDisk.size && 
          el.classList.contains('selected') // Ensure it's the visually selected one
      );
      if (diskToShake) {
        diskToShake.classList.add('invalid-move-shake');
        diskToShake.addEventListener('animationend', () => {
          diskToShake.classList.remove('invalid-move-shake');
        }, { once: true });
      }
    }
  }
}

function checkWinCondition() {
  // Win if all disks are on any single tower (not the starting one only check)
  const won = towers.some((tower, idx) => tower.length === numDisks && idx !== 0);
  if (won) {
    isGameWon = true;
    console.log("You won!");
    // Render game will show win message
  }
}

function undoMove() {
  if (moveHistory.length > 0) {
    const lastMove = moveHistory.pop();
    towers = lastMove.towersState;
    moveCount = lastMove.moveCountBefore;
    isGameWon = lastMove.isGameWonBefore; // Restore previous win state
    showGhostStack = lastMove.showGhostStackBefore; // Restore ghost stack state
    
    selectedDisk = null; // Always deselect any held disk on undo
    undoCount++;

    movesTakenDisplay.textContent = moveCount;
    undoCountDisplay.textContent = undoCount;
    undoButton.disabled = moveHistory.length === 0;
    
    renderGame();
  }
}

// --- Event Listeners ---
numDisksSlider.addEventListener('input', (event) => {
  const newNumDisks = parseInt(event.target.value);
  initGame(newNumDisks);
  updateStepButtonsState();
});

resetButton.addEventListener('click', () => {
  if (confirm("Are you sure you want to reset the game?")) {
    const sliderVal = parseInt(numDisksSlider.value);
    initGame(Number.isFinite(sliderVal) ? sliderVal : numDisks); // Use slider value if valid
    if (hanoiWin) { hanoiWin.style.display = 'none'; hanoiWin.textContent = ''; }
  }
});

undoButton.addEventListener('click', undoMove); // Add listener for new button

// Handle +/- step buttons
function clampDisks(val) {
  const min = parseInt(numDisksSlider.min);
  const max = parseInt(numDisksSlider.max);
  return Math.min(max, Math.max(min, val));
}

function updateStepButtonsState() {
  if (!increaseDisksButton || !decreaseDisksButton) return;
  const min = parseInt(numDisksSlider.min);
  const max = parseInt(numDisksSlider.max);
  const current = parseInt(numDisksSlider.value);
  decreaseDisksButton.disabled = current <= min;
  increaseDisksButton.disabled = current >= max;
}

if (increaseDisksButton) {
  increaseDisksButton.addEventListener('click', () => {
    const next = clampDisks(parseInt(numDisksSlider.value) + 1);
    if (String(next) !== numDisksSlider.value) {
      numDisksSlider.value = String(next);
      initGame(next);
      updateStepButtonsState();
    }
  });
}

if (decreaseDisksButton) {
  decreaseDisksButton.addEventListener('click', () => {
    const next = clampDisks(parseInt(numDisksSlider.value) - 1);
    if (String(next) !== numDisksSlider.value) {
      numDisksSlider.value = String(next);
      initGame(next);
      updateStepButtonsState();
    }
  });
}

hanoiSvg.addEventListener('click', (event) => {
  let interactiveTarget = null;
  let currentElement = event.target;

  // Traverse up to find if a tower (via data-tower-index on disk or click-target for peg area) was clicked
  while(currentElement && currentElement !== hanoiSvg) {
      if (currentElement.dataset.towerIndex !== undefined) {
          interactiveTarget = currentElement; // This could be a disk or a tower click-target rect
          break;
      }
      currentElement = currentElement.parentElement;
  }

  if (interactiveTarget) {
    // A disk or tower click target was found and it has a tower index
    handleTowerClick(parseInt(interactiveTarget.dataset.towerIndex));
  } else if (selectedDisk !== null) {
    // No tower/disk target was clicked. This means click was on SVG background or another non-interactive SVG part.
    // We explicitly allow deselecting by clicking background or the main base.
    const baseElement = ids('hanoiGameBase'); // Get base by its new ID

    if (event.target === hanoiSvg || (baseElement && event.target === baseElement)) {
      selectedDisk = null;
      renderGame(); // Redraw to remove 'selected' class and visual cue.
    }
    // If it was another non-interactive SVG element (e.g. a peg itself if pointer-events were not none), do nothing.
  }
});

// --- Initial Game Setup ---
initGame(parseInt(numDisksSlider.value)); 