// =========================
//  Quadratic Explorer JS
//  Vertex form:  a(x-h)² + k
// =========================

import { ids, fmt } from '../shared/shared-utils.js';
import { commonChartConfig, setupEventListeners } from '../shared/transformations.js';

// ----- Data helpers -----
const STEP = 0.1;
const xValues = Array.from(
  { length: Math.round(10 / STEP + 1) },
  (_, i) => -5 + i * STEP
); // -5 → 5

const parentY = xValues.map(x => x * x);
const calcY = (a, h, k) => xValues.map(x => a * Math.pow(x - h, 2) + k);

// ----- State (defaults) -----
const DEFAULTS = {
  aStretch: 1,    // vertical stretch
  hShift: 0,      // horizontal shift
  kShift: 0,      // vertical shift
  vFlip: false    // vertical flip
};

let aStretch = DEFAULTS.aStretch,
    hShift = DEFAULTS.hShift,
    kShift = DEFAULTS.kShift,
    vFlip = DEFAULTS.vFlip;

// ----- Chart setup -----
const ctx = document.getElementById("quadChart").getContext("2d");
const chart = new Chart(ctx, {
  type: "line",
  data: {
    labels: xValues,
    datasets: [
      {
        label: "Parent",
        data: parentY,
        borderColor: "#666",
        borderDash: [6, 6],
        borderWidth: 2,
        pointRadius: 0,
        fill: false
      },
      {
        label: "Transformed",
        data: calcY(1, 0, 0),
        borderColor: "#E60000",
        borderWidth: 2,
        pointRadius: 0,
        fill: false
      },
      {
        label: "y = 0",
        data: xValues.map(() => 0),
        borderColor: "#000",
        borderWidth: 2,
        pointRadius: 0,
        fill: false
      },
      {
        label: "x = 0",
        type: "line",
        data: [
          { x: 0, y: -10 },
          { x: 0, y: 10 }
        ],
        borderColor: "#000",
        borderWidth: 2,
        pointRadius: 0,
        fill: false
      },
      {
        label: "Axis of Symmetry",
        type: "line",
        data: [
          { x: 0, y: -10 },
          { x: 0, y: 10 }
        ],
        borderColor: "#F0B800",
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false
      },
      {
        label: "Vertex",
        type: "scatter",
        data: [{ x: 0, y: 0 }],
        borderColor: "#E60000",
        backgroundColor: "#E60000",
        pointRadius: 5
      }
    ]
  },
  options: {
    ...commonChartConfig,
    scales: {
      ...commonChartConfig.scales,
      y: {
        ...commonChartConfig.scales.y,
        min: -5,
        max: 5
      }
    }
  }
});

// ----- DOM refs -----
const aVal = ids("aVal"),
      hVal = ids("hVal"),
      kVal = ids("kVal");
const flipChk = ids("flipChk");
const vertexEqText = ids("vertexEqText"),
      standardEqText = ids("standardEqText"),
      parentEq = ids("parentEq");
const vertexX = ids("vertexX"),
      vertexY = ids("vertexY");
const axisEqText = ids("axisEqText");
const domainText = ids("domainText"),
      rangeText = ids("rangeText");

// ----- Helpers -----
function formatVertexEq(a, h, k) {
  const aStr = Math.abs(a) === 1 ? (a < 0 ? "-" : "") : fmt(a);
  const hPart = h === 0 ? "x" : h > 0 ? `(x - ${fmt(h)})` : `(x + ${fmt(-h)})`;
  const kStr = k === 0 ? "" : k > 0 ? ` + ${fmt(k)}` : ` - ${fmt(-k)}`;
  return `${aStr}${hPart}²${kStr}`;
}

function formatStandardEq(a, h, k) {
  const aStr = fmt(a);
  const b = -2 * a * h;
  const c = a * h * h + k;
  
  let eq = `${aStr}x²`;
  if (b !== 0) {
    eq += b < 0 ? ` - ${fmt(Math.abs(b))}x` : ` + ${fmt(b)}x`;
  }
  if (c !== 0) {
    eq += c < 0 ? ` - ${fmt(Math.abs(c))}` : ` + ${fmt(c)}`;
  }
  return eq;
}

// ----- Update routine -----
function update() {
  aStretch = parseFloat(ids("aRange").value);
  hShift = parseFloat(ids("hRange").value);
  kShift = parseFloat(ids("kRange").value);
  vFlip = flipChk.checked;

  const aSigned = vFlip ? -aStretch : aStretch;

  // readouts
  aVal.textContent = aSigned;
  hVal.textContent = hShift;
  kVal.textContent = kShift;

  // equations
  parentEq.innerHTML = "x²";
  vertexEqText.innerHTML = formatVertexEq(aSigned, hShift, kShift);
  standardEqText.innerHTML = formatStandardEq(aSigned, hShift, kShift);
  
  // vertex & axis
  vertexX.textContent = fmt(hShift);
  vertexY.textContent = fmt(kShift);
  axisEqText.textContent = fmt(hShift);

  // domain & range
  domainText.innerHTML = "( −∞ , ∞ )";
  rangeText.innerHTML = aSigned > 0 ? 
    `[ ${fmt(kShift)} , ∞ )` : 
    `( −∞ , ${fmt(kShift)} ]`;

  // datasets re‑compute
  chart.data.datasets[0].data = parentY;
  chart.data.datasets[1].data = calcY(aSigned, hShift, kShift);
  chart.data.datasets[2].data = xValues.map(() => 0);
  chart.data.datasets[3].data = [
    { x: 0, y: -10 },
    { x: 0, y: 10 }
  ];
  chart.data.datasets[4].data = [
    { x: hShift, y: -10 },
    { x: hShift, y: 10 }
  ];
  chart.data.datasets[5].data = [{ x: hShift, y: kShift }];

  chart.options.plugins.pointLabels.points = [
    { x: hShift, y: kShift, label: `(${fmt(hShift)}, ${fmt(kShift)})` }
  ];

  chart.update();
}

// Add event listeners
setupEventListeners(["aRange", "hRange", "kRange", "flipChk"], update, DEFAULTS);

// Initial update
update(); 