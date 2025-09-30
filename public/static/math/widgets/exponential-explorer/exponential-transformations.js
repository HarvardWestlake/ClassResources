// =========================
//  Exponential Explorer JS
//  Horizontal form:  b^{ p·x − h }
// =========================

// ----- Data helpers -----
const STEP = 0.1;
let xValues = Array.from(
  { length: Math.round(10 / STEP + 1) },
  (_, i) => -5 + i * STEP
); // −5 → 5
const parentY = (b) => xValues.map((x) => Math.pow(b, x));
const calcY = (a, b, h, k, pSigned) =>
  xValues.map((x) => a * Math.pow(b, pSigned * x - h) + k);

// ----- State (defaults) -----
const DEFAULTS = {
  aStretch: 1,    // vertical stretch
  pStretch: 1,    // horizontal stretch
  bBase: 2,       // base
  hShift: 0,      // horizontal shift
  kShift: 0,      // vertical shift
  vFlip: false,   // vertical flip
  hFlip: false    // horizontal flip
};

let aStretch = DEFAULTS.aStretch,
    pStretch = DEFAULTS.pStretch,
    bBase = DEFAULTS.bBase,
    hShift = DEFAULTS.hShift,
    kShift = DEFAULTS.kShift,
    vFlip = DEFAULTS.vFlip,
    hFlip = DEFAULTS.hFlip;

// ----- Point‑label plugin -----
const pointLabelPlugin = {
  id: "pointLabels",
  afterDraw(chart) {
    const {
      ctx,
      chartArea: { left, right, top, bottom },
      scales: { x, y }
    } = chart;
    const pts = chart.options.plugins.pointLabels.points || [];
    ctx.save();
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "black";
    const placed = [];
    pts.forEach((p) => {
      const text = p.label;
      const w = ctx.measureText(text).width;
      const hTxt = 12;
      let px = x.getPixelForValue(p.x);
      let py = y.getPixelForValue(p.y);
      let dx = 8,
        dy = -8;
      if (px + dx + w > right) dx = -w - 8;
      if (px + dx < left) dx = 8;
      if (py + dy < top) dy = 12;
      if (py + dy + hTxt > bottom) dy = -12;
      let box = { x: px + dx, y: py + dy, w, h: hTxt };
      placed.forEach((bx) => {
        while (
          !(
            box.x + box.w < bx.x ||
            bx.x + bx.w < box.x ||
            box.y + box.h < bx.y ||
            bx.y + bx.h < box.y
          )
        ) {
          box.y += 14;
          if (box.y + box.h > bottom) {
            box.y = py - 14;
            break;
          }
        }
      });
      placed.push(box);
      ctx.fillText(text, box.x, box.y);
    });
    ctx.restore();
  }
};
Chart.register(pointLabelPlugin);

// ----- Chart setup -----
const ctx = document.getElementById("expChart").getContext("2d");
const chart = new Chart(ctx, {
  type: "line",
  data: {
    labels: xValues,
    datasets: [
      {
        label: "Parent",
        data: parentY(bBase),
        borderColor: "#666",
        borderDash: [6, 6],
        borderWidth: 2,
        pointRadius: 0,
        fill: false
      },
      {
        label: "Transformed",
        data: calcY(1, bBase, 0, 0, 1),
        borderColor: "#E60000",
        borderWidth: 2,
        pointRadius: 0,
        fill: false
      },
      {
        label: "Asymptote",
        data: xValues.map(() => kShift),
        borderColor: "#F0B800",
        borderDash: [5, 5],
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
        label: "P(0,1)",
        type: "scatter",
        data: [{ x: 0, y: 1 }],
        borderColor: "#666",
        backgroundColor: "#666",
        pointRadius: 5
      },
      {
        label: "P'",
        type: "scatter",
        data: [{ x: 0, y: 1 }],
        borderColor: "#E60000",
        backgroundColor: "#E60000",
        pointRadius: 5
      }
    ]
  },
  options: {
    animation: false,
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: { legend: { display: false }, pointLabels: { points: [] } },
    scales: {
      x: {
        type: 'linear',
        min: -5,
        max: 5,
        ticks: {
          stepSize: 1
        },
        title: { display: true, text: "x" },
        border: { color: "black", width: 2 },
        grid: { color: "rgba(0,0,0,0.1)" }
      },
      y: {
        min: -10,
        max: 10,
        ticks: {
          stepSize: 1
        },
        title: { display: true, text: "y" },
        border: { color: "black", width: 2 },
        grid: { color: "rgba(0,0,0,0.1)" }
      }
    }
  }
});

// ----- DOM refs -----
const ids = (id) => document.getElementById(id);
const aVal = ids("aVal"),
  pVal = ids("sVal"),
  bVal = ids("bVal"),
  hVal = ids("hVal"),
  kVal = ids("kVal");
const flipChk = ids("flipChk"),
  flipHChk = ids("flipHChk");
const eqText = ids("eqText"),
  parentEq = ids("parentEq"),
  asymptoteText = ids("asymptoteText");
const domainText = ids("domainText"),
  rangeText = ids("rangeText");

domainText.innerHTML = "( −∞ , ∞ )";

// ----- Helpers -----
const fmt = (n) =>
  Math.abs(n) >= 1000 ? n.toFixed(0) : parseFloat(n.toFixed(2));
function formatEq(a, b, h, k, pSigned) {
  const aStr = Math.abs(a) === 1 ? (a < 0 ? "-" : "") : fmt(a);
  const pStr = pSigned === 1 ? "" : pSigned === -1 ? "-" : fmt(pSigned);
  const hPart = h === 0 ? "" : h > 0 ? ` - ${fmt(h)}` : ` + ${fmt(-h)}`;
  const exp = `${fmt(b)}<sup>${pStr}x${hPart}</sup>`;
  const kStr = k === 0 ? "" : k > 0 ? ` + ${fmt(k)}` : ` - ${fmt(-k)}`;
  return (aStr ? `${aStr}(${exp})` : exp) + kStr;
}

// ----- Update routine -----
function update() {
  aStretch = parseFloat(ids("aRange").value);
  pStretch = parseFloat(ids("sRange").value);
  bBase = parseFloat(ids("bRange").value);
  hShift = parseFloat(ids("hRange").value);
  kShift = parseFloat(ids("kRange").value);
  vFlip = flipChk.checked;
  hFlip = flipHChk.checked;

  const aSigned = vFlip ? -aStretch : aStretch;
  const pSigned = hFlip ? -pStretch : pStretch;

  // readouts
  aVal.textContent = aSigned;
  pVal.textContent = pStretch;
  bVal.textContent = bBase;
  hVal.textContent = hShift;
  kVal.textContent = kShift;

  // equation & range/asymptote
  parentEq.innerHTML = `${bBase}<sup>x</sup>`;
  eqText.innerHTML = formatEq(aSigned, bBase, hShift, kShift, pSigned);
  asymptoteText.textContent = kShift;
  rangeText.innerHTML =
    aSigned === 0
      ? `{ ${kShift} }`
      : aSigned > 0
      ? `( ${kShift} , ∞ )`
      : `( −∞ , ${kShift} )`;

  // Key point image of (0,1):  solve pSigned·x − h = 0  ⇒  x = h / pSigned
  const transX = hShift / pSigned;
  const transY = aSigned + kShift;

  // refresh sampling grid if transX falls between existing nodes
  if (!xValues.includes(transX)) {
    xValues = Array.from(
      { length: Math.round(10 / STEP + 1) },
      (_, i) => -5 + i * STEP
    );
    xValues.push(transX);
    xValues.sort((m, n) => m - n);
    chart.data.labels = xValues;
  }

  // datasets re‑compute
  chart.data.datasets[0].data = parentY(bBase);
  chart.data.datasets[1].data = calcY(aSigned, bBase, hShift, kShift, pSigned);
  chart.data.datasets[2].data = xValues.map(() => kShift);
  chart.data.datasets[3].data = xValues.map(() => 0);
  chart.data.datasets[4].data = [
    { x: 0, y: -10 },
    { x: 0, y: 10 }
  ];
  chart.data.datasets[5].data = [{ x: 0, y: 1 }];
  chart.data.datasets[6].data = [{ x: transX, y: transY }];

  chart.options.plugins.pointLabels.points = [
    { x: 0, y: 1, label: "(0,1)" },
    { x: transX, y: transY, label: `(${fmt(transX)}, ${fmt(transY)})` }
  ];

  chart.update("none");
}

// Add event listeners only once
const inputIds = ["aRange", "sRange", "bRange", "hRange", "kRange", "flipChk", "flipHChk"];
inputIds.forEach(id => {
  const element = ids(id);
  if (element) {
    element.removeEventListener("input", update);
    element.addEventListener("input", update);
    
    // Add double-click handler for sliders
    if (id !== "flipChk" && id !== "flipHChk") {
      element.addEventListener("dblclick", () => {
        const defaultKey = {
          "aRange": "aStretch",
          "sRange": "pStretch",
          "bRange": "bBase",
          "hRange": "hShift",
          "kRange": "kShift"
        }[id];
        element.value = DEFAULTS[defaultKey];
        update();
      });
    }
  }
});

// Initial update
update();
