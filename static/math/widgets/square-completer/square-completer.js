// =========================
//  Square Completer JS
//  Geometric visualization of completing the square
// =========================

import { ids, fmt } from '../shared/shared-utils.js';
import { setupEventListeners } from '../shared/transformations.js';

// ----- State (defaults) -----
const DEFAULTS = {
  a: 1,    // coefficient of x² (fixed)
  b: 6,    // coefficient of x
  c: -5    // constant term
};

let a = DEFAULTS.a,
    b = DEFAULTS.b,
    c = DEFAULTS.c;

// ----- Canvas setup -----
const canvas = document.getElementById("geometricCanvas");
const ctx = canvas.getContext("2d");

function initializeCanvasAndDraw() {
    const container = canvas.parentElement;
    if (container) {
        canvas.width = container.clientWidth; 
        const computedStyle = getComputedStyle(canvas);
        canvas.height = parseInt(computedStyle.height, 10);

        if (canvas.width > 0 && canvas.height > 0) {
            update(); 
        } else {
            // If dimensions are not ready, try again shortly. This is a simple fallback.
            setTimeout(initializeCanvasAndDraw, 50); 
            return; // Don't proceed with potentially bad dimensions for first draw
        }
    }
     if (ids("totalStepsDisplay")) {
        ids("totalStepsDisplay").textContent = STEPS.length;
    }
}

function resizeCanvas() {
  const container = canvas.parentElement;
  if (container) {
    const newWidth = container.clientWidth;
    const newHeight = parseInt(getComputedStyle(canvas).height, 10);

    if (newWidth > 0 && newHeight > 0) {
      if (canvas.width !== newWidth || canvas.height !== newHeight) {
        canvas.width = newWidth;
        canvas.height = newHeight;
        update(); 
      }
    }
  }
}

// ----- Step management -----
const STEPS = [
  {
    description: "Start with the quadratic equation.",
    expression: (a, b, c) => `x² + ${fmt(b)}x + ${fmt(c)} = 0`,
    draw: (ctx, a, b, c) => drawInitialForm(ctx, a, b, c)
  },
  {
    description: "Move the constant term to the right side.",
    expression: (a, b, c) => `x² + ${fmt(b)}x = ${fmt(-c)}`,
    draw: (ctx, a, b, c) => drawMoveConstant(ctx, a, b, c)
  },
  {
    description: "Split bx into two rectangles of size bx/2.",
    expression: (a, b, c) => `x² + ${fmt(b/2)}x + ${fmt(b/2)}x = ${fmt(-c)}`,
    draw: (ctx, a, b, c) => drawSplitRectangles(ctx, a, b, c)
  },
  {
    description: "Add (b/2)² to both sides to complete the square.",
    expression: (a, b, c) => `x² + ${fmt(b)}x + ${fmt((b/2)*(b/2))} = ${fmt(-c)} + ${fmt((b/2)*(b/2))}`,
    draw: (ctx, a, b, c) => drawCompletingSquare(ctx, a, b, c)
  },
  {
    description: "The completed square has side length x + b/2.",
    expression: (a, b, c) => `(x + ${fmt(b/2)})² = ${fmt(-c + (b/2)*(b/2))}`,
    draw: (ctx, a, b, c) => drawCompletedSquare(ctx, a, b, c)
  }
];

let currentStep = 0;

// ----- Drawing functions -----
function drawInitialForm(ctx, a, b, c) {
  const width = canvas.width;
  const height = canvas.height;
  const scale = Math.min(width, height) / 10;
  const centerY = height / 2;
  const MARGIN  = 15;
  const SPACING = scale * 1.2;

  const squareSize = scale;
  const rectWidth  = scale * Math.abs(b);
  const constSize  = scale * Math.sqrt(Math.abs(c));

  const groupWidth = squareSize + SPACING + rectWidth + SPACING + constSize;
  const currentX   = (width - groupWidth) / 2;
  const squareTop  = centerY - squareSize / 2;

  ctx.font = "bold 16px 'Source Sans Pro'";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  // red square
  ctx.fillStyle = "#E60000";
  ctx.fillRect(currentX, squareTop, squareSize, squareSize);
  ctx.fillStyle = "#fff";
  ctx.fillText("x²", currentX + squareSize / 2, squareTop + squareSize / 2);

  // plus after red
  ctx.fillStyle = "#000";
  ctx.fillText("+", currentX + squareSize + SPACING / 2, centerY);

  // yellow rectangle
  const yellowLeft = currentX + squareSize + SPACING;
  ctx.fillStyle = "#F0B800";
  ctx.fillRect(yellowLeft, squareTop, rectWidth, scale);
  ctx.fillStyle = "#000";
  ctx.fillText(`${fmt(b)}x`, yellowLeft + rectWidth / 2, squareTop + scale / 2);

  // plus after yellow
  ctx.fillText("+", yellowLeft + rectWidth + SPACING / 2, centerY);

  // green square
  const greenLeft = yellowLeft + rectWidth + SPACING;
  ctx.fillStyle = "#00B800";
  ctx.fillRect(greenLeft, squareTop, constSize, constSize);
  ctx.fillStyle = "#000";
  ctx.fillText(`${fmt(c)}`, greenLeft + constSize / 2, squareTop + constSize / 2);
}

function drawMoveConstant(ctx, a, b, c) {
  const width = canvas.width;
  const height = canvas.height;
  const scale = Math.min(width, height) / 10;
  const centerY = height / 2;
  const MARGIN  = 15;
  const SPACING = scale * 1.2;

  const squareSize = scale;
  const rectWidth  = scale * Math.abs(b);
  const constSize  = scale * Math.sqrt(Math.abs(c));

  const leftBlockWidth = squareSize + rectWidth;
  const groupWidth = leftBlockWidth + SPACING + constSize;
  const currentX   = (width - groupWidth) / 2;
  const squareTop  = centerY - squareSize / 2;
  const effectiveCenterY = squareTop + squareSize / 2;

  ctx.font = "bold 16px 'Source Sans Pro'";
  ctx.textBaseline = "middle";

  // ----- red x² square -----
  ctx.fillStyle = "#E60000";
  ctx.fillRect(currentX, squareTop, squareSize, squareSize);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.fillText("x²", currentX + squareSize / 2, effectiveCenterY);
  
  ctx.fillStyle = "#000";
  // Left side label for red square
  ctx.textAlign = "right"; 
  ctx.textBaseline = "middle";
  ctx.fillText("x", currentX - MARGIN, effectiveCenterY); 
  // Top side label for red square
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("x", currentX + squareSize / 2, squareTop - MARGIN); 
  
  // ----- yellow bx rectangle -----
  const yellowLeft = currentX + squareSize;
  ctx.fillStyle = "#F0B800";
  ctx.fillRect(yellowLeft, squareTop, rectWidth, scale);
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle"; // For area label
  ctx.fillText(`${fmt(b)}x`, yellowLeft + rectWidth / 2, effectiveCenterY); 
  // Top side label for yellow rectangle
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(`${fmt(b)}`,  yellowLeft + rectWidth / 2, squareTop - MARGIN); 

  // Reset baseline for other text like equals sign if necessary
  ctx.textBaseline = "middle"; 

  // ----- equal sign -----
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.fillText("=", yellowLeft + rectWidth + SPACING / 2, effectiveCenterY);

  // ----- green constant square -----
  const greenLeft = yellowLeft + rectWidth + SPACING;
  ctx.fillStyle = "#00B800";
  ctx.fillRect(greenLeft, squareTop, constSize, constSize);
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle"; // For area label
  ctx.fillText(`${fmt(-c)}`, greenLeft + constSize / 2, squareTop + constSize/2 );
}

function drawSplitRectangles(ctx, a, b, c) {
  const width = canvas.width;
  const height = canvas.height;
  const scale = Math.min(width, height) / 10;
  const MARGIN  = 15;
  const SPACING = scale * 1.2;

  const squareSize = scale;
  const splitRectWidth  = scale * Math.abs(b / 2);
  const constSize  = scale * Math.sqrt(Math.abs(c));

  const groupHeight = squareSize + splitRectWidth;
  const startY    = (height - groupHeight) / 2;
  const squareTop = startY;
  const topRowCenterY = startY + squareSize / 2;

  const leftBlockWidth = squareSize + splitRectWidth;
  const groupWidth = leftBlockWidth + SPACING + constSize;
  const currentX   = (width - groupWidth) / 2;

  ctx.font = "bold 16px 'Source Sans Pro'";
  ctx.textBaseline = "middle";

  // red square
  ctx.fillStyle = "#E60000";
  ctx.fillRect(currentX, squareTop, squareSize, squareSize);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.fillText("x²", currentX + squareSize / 2, topRowCenterY);
  ctx.fillStyle = "#000";
  ctx.textAlign = "right";
  ctx.fillText("x", currentX - MARGIN, topRowCenterY);
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("x", currentX + squareSize / 2, squareTop - MARGIN);
  ctx.textBaseline = "middle";

  // right yellow rectangle
  const rightRectLeft = currentX + squareSize;
  ctx.fillStyle = "#F0B800";
  ctx.fillRect(rightRectLeft, squareTop, splitRectWidth, scale);
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle"; // for area label
  ctx.fillText(`${fmt(b/2)}x`, rightRectLeft + splitRectWidth/2, topRowCenterY);
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom"; // for top side label
  ctx.fillText(`${fmt(b/2)}`,  rightRectLeft + splitRectWidth/2, squareTop - MARGIN);
  ctx.textBaseline = "middle"; // Reset

  // bottom yellow rectangle
  ctx.fillStyle = "#F0B800";
  ctx.fillRect(currentX, squareTop + squareSize, squareSize, splitRectWidth);
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle"; // for area label
  ctx.fillText(`${fmt(b/2)}x`, currentX + squareSize/2, squareTop + squareSize + splitRectWidth/2); 
  ctx.textAlign = "right"; 
  ctx.textBaseline = "middle"; // for left side label
  ctx.fillText(`${fmt(b/2)}`,  currentX - MARGIN, squareTop + squareSize + splitRectWidth/2); 
  ctx.textAlign = "center"; 
  ctx.textBaseline = "middle"; // Reset

  // equal sign
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.fillText("=", rightRectLeft + splitRectWidth + SPACING / 2, topRowCenterY);

  // green square
  const greenLeft = rightRectLeft + splitRectWidth + SPACING;
  ctx.fillStyle = "#00B800";
  ctx.fillRect(greenLeft, squareTop, constSize, constSize);
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle"; // for area label
  ctx.fillText(`${fmt(-c)}`, greenLeft + constSize / 2, squareTop + constSize/2); 
}

function drawCompletingSquare(ctx, a, b, c) {
  const width = canvas.width;
  const height = canvas.height;
  const scale = Math.min(width, height) / 10;
  const MARGIN  = 15;
  const SPACING = scale * 1.2;

  const squareSize = scale;
  const splitRectWidth  = scale * Math.abs(b / 2);
  const completingSquareSide = splitRectWidth; // Side length of the small completing square
  const rightConstSize = scale * Math.sqrt(Math.abs(-c + (b/2)*(b/2)));
  
  const groupHeight = squareSize + completingSquareSide; 
  const startY    = (height - groupHeight) / 2;  
  const squareTop = startY;
  const topRowCenterY = startY + squareSize / 2; 

  const leftBlockWidth = squareSize + splitRectWidth; 
  const groupWidth = leftBlockWidth + SPACING + rightConstSize;
  const currentX   = (width - groupWidth) / 2;
  
  ctx.font = "bold 16px 'Source Sans Pro'";
  // Default text alignment for this function
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // red square
  ctx.fillStyle = "#E60000";
  ctx.fillRect(currentX, squareTop, squareSize, squareSize);
  ctx.fillStyle = "#fff";
  ctx.fillText("x²", currentX + squareSize/2, topRowCenterY);
  ctx.fillStyle = "#000";
  ctx.textAlign = "right";
  ctx.fillText("x", currentX - MARGIN, topRowCenterY);
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("x", currentX + squareSize/2, squareTop - MARGIN);
  ctx.textBaseline = "middle"; // Reset

  // right yellow rectangle
  const rightRectLeft = currentX + squareSize;
  ctx.fillStyle = "#F0B800";
  ctx.fillRect(rightRectLeft, squareTop, splitRectWidth, scale);
  ctx.fillStyle = "#000";
  ctx.fillText(`${fmt(b/2)}x`, rightRectLeft + splitRectWidth/2, topRowCenterY); // Area label, centered
  ctx.textBaseline = "bottom";
  ctx.fillText(`${fmt(b/2)}`,  rightRectLeft + splitRectWidth/2, squareTop - MARGIN); // Top side label
  ctx.textBaseline = "middle"; // Reset

  // bottom yellow rectangle
  ctx.fillStyle = "#F0B800";
  ctx.fillRect(currentX, squareTop + squareSize, squareSize, splitRectWidth);
  ctx.fillStyle = "#000";
  ctx.fillText(`${fmt(b/2)}x`, currentX + squareSize/2, squareTop + squareSize + splitRectWidth/2); // Area label, centered
  ctx.textAlign = "right";
  ctx.fillText(`${fmt(b/2)}`, currentX - MARGIN, squareTop + squareSize + splitRectWidth/2); // Left side label
  ctx.textAlign = "center"; // Reset

  // completing small square (semi-transparent yellow)
  const completingSquareTop = squareTop + squareSize;
  const completingSquareLeft = rightRectLeft;
  ctx.fillStyle = "rgba(240,184,0,0.3)"; 
  ctx.fillRect(completingSquareLeft, completingSquareTop, completingSquareSide, completingSquareSide);
  ctx.fillStyle = "#000"; 
  ctx.fillText(`${fmt((b/2)*(b/2))}`, completingSquareLeft + completingSquareSide / 2, completingSquareTop + completingSquareSide / 2); // Area label, centered

  // equal sign
  ctx.fillStyle = "#000";
  ctx.fillText("=", rightRectLeft + splitRectWidth + SPACING / 2, topRowCenterY);

  // green square (constant term on right)
  const greenLeft = rightRectLeft + splitRectWidth + SPACING;
  ctx.fillStyle = "#00B800";
  ctx.fillRect(greenLeft, squareTop, rightConstSize, rightConstSize); 
  ctx.fillStyle = "#000";
  ctx.fillText(`${fmt(-c + (b/2)*(b/2))}`, greenLeft + rightConstSize / 2, squareTop + rightConstSize/2); // Area label, centered
}

function drawCompletedSquare(ctx, a, b, c) {
  const width = canvas.width;
  const height = canvas.height;
  const scale = Math.min(width, height) / 10;
  const centerY = height / 2;
  const MARGIN  = 15;
  const SPACING = scale * 1.2;

  const completedSquareSide = scale * (1 + Math.abs(b/2));
  const rightConstSize  = scale * Math.sqrt(Math.abs(-c + (b/2)*(b/2)));

  const groupWidth = completedSquareSide + SPACING + rightConstSize;
  const currentX   = (width - groupWidth) / 2;
  const squareTop  = centerY - completedSquareSide / 2;
  const effectiveCenterY = squareTop + completedSquareSide / 2;

  ctx.font = "bold 16px 'Source Sans Pro'";
  ctx.textBaseline = "middle";

  // red completed square
  ctx.fillStyle = "#E60000";
  ctx.fillRect(currentX, squareTop, completedSquareSide, completedSquareSide);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.fillText(`(x + ${fmt(b/2)})²`, currentX + completedSquareSide / 2, effectiveCenterY);
  ctx.fillStyle = "#000";
  ctx.textAlign = "right";
  ctx.fillText(`x + ${fmt(b/2)}`, currentX - MARGIN, effectiveCenterY);
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(`x + ${fmt(b/2)}`, currentX + completedSquareSide / 2, squareTop - MARGIN);
  ctx.textBaseline = "middle";

  // equal sign
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.fillText("=", currentX + completedSquareSide + SPACING / 2, effectiveCenterY);

  // green square (constant term on right)
  const greenLeft = currentX + completedSquareSide + SPACING;
  ctx.fillStyle = "#00B800";
  ctx.fillRect(greenLeft, squareTop, rightConstSize, rightConstSize);
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.fillText(`${fmt(-c + (b/2)*(b/2))}`, greenLeft + rightConstSize / 2, squareTop + rightConstSize/2);
}

// Helper to label 'x' below a rectangle
function labelXBelow(ctx, xCenter, yBottom, margin) {
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#000";
  ctx.fillText("x", xCenter, yBottom + margin / 2);
}

// ----- Update routine -----
function update() {
  b = parseFloat(ids("bRange").value);
  c = parseFloat(ids("cRange").value);

  ids("bVal").textContent = fmt(b);
  ids("cVal").textContent = fmt(c);

  const currentStepObj = STEPS[currentStep];
  ids("currentStepDisplay").textContent = currentStep + 1;
  ids("totalStepsDisplay").textContent = STEPS.length;
  ids("stepDescription").textContent = currentStepObj.description;

  // Accumulate equations
  let accumulatedExpressions = "";
  for (let i = 0; i <= currentStep; i++) {
    const step = STEPS[i];
    // Wrap each equation in a paragraph for distinct lines and styling if needed
    accumulatedExpressions += `<p class="equation-line">${step.expression(a, b, c)}</p>`;
  }
  ids("currentExpression").innerHTML = accumulatedExpressions; // Use innerHTML for <p> tags

  ids("prevStep").disabled = currentStep === 0;
  ids("nextStep").disabled = currentStep === STEPS.length - 1;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  currentStepObj.draw(ctx, a, b, c);
}

// ----- Event listeners -----
setupEventListeners(["bRange", "cRange"], update, DEFAULTS);

ids("prevStep").addEventListener("click", () => {
  if (currentStep > 0) {
    currentStep--;
    update();
  }
});

ids("nextStep").addEventListener("click", () => {
  if (currentStep < STEPS.length - 1) {
    currentStep++;
    update();
  }
});

// Set initial slider values (this is fine here)
ids("bRange").value = DEFAULTS.b;
ids("cRange").value = DEFAULTS.c;

// Initial setup
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeCanvasAndDraw);
} else {
  initializeCanvasAndDraw();
}
window.addEventListener('resize', resizeCanvas); 