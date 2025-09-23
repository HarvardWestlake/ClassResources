// =========================
//  Logarithmic Explorer JS
//  Horizontal form:  a·log_b(p·x - h) + k
// =========================

// ----- Data helpers -----
const STEP = 0.1;
const xValues = Array.from(
  { length: Math.round(20 / STEP + 1) },
  (_, i) => -10 + i * STEP
); // -10 → 10
const parentY = (b) => xValues.map((x) => {
  if (x <= 0) return undefined;
  return Math.log(x) / Math.log(b);
});
const calcY = (a, b, h, k, pSigned) =>
  xValues.map((x) => {
    // First apply horizontal transformations
    const transformedX = pSigned * x - h;
    // Check domain restriction
    if (transformedX <= 0) return undefined;
    // Then apply vertical transformations
    return a * (Math.log(transformedX) / Math.log(b)) + k;
  });

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
const ctx = document.getElementById("logChart").getContext("2d");
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
        data: xValues.map(() => hShift),
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
        label: "P(1,0)",
        type: "scatter",
        data: [{ x: 1, y: 0 }],
        borderColor: "#666",
        backgroundColor: "#666",
        pointRadius: 5
      },
      {
        label: "P'",
        type: "scatter",
        data: [{ x: 1, y: 0 }],
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
        min: -10,
        max: 10,
        ticks: {
          stepSize: 1
        },
        title: { display: true, text: "x" },
        border: { color: "black", width: 2 },
        grid: { color: "rgba(0,0,0,0.1)" }
      },
      y: {
        min: -5,
        max: 5,
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

// ----- Helpers -----
const fmt = (n) =>
  Math.abs(n) >= 1000 ? n.toFixed(0) : parseFloat(n.toFixed(2));
function formatEq(a, b, h, k, pSigned) {
  const aStr = Math.abs(a) === 1 ? (a < 0 ? "-" : "") : fmt(a);
  const pStr = pSigned === 1 ? "" : pSigned === -1 ? "-" : fmt(pSigned);
  const hPart = h === 0 ? "" : h > 0 ? ` - ${fmt(h)}` : ` + ${fmt(-h)}`;
  const logPart = `log<sub>${fmt(b)}</sub>(${pStr}x${hPart})`;
  const kStr = k === 0 ? "" : k > 0 ? ` + ${fmt(k)}` : ` - ${fmt(-k)}`;
  return (aStr ? `${aStr}${logPart}` : logPart) + kStr;
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
  parentEq.innerHTML = `log<sub>${bBase}</sub>(x)`;
  eqText.innerHTML = formatEq(aSigned, bBase, hShift, kShift, pSigned);
  
  // Calculate asymptote position based on horizontal transformations
  const asymptoteX = hShift / pSigned;
  asymptoteText.textContent = fmt(asymptoteX);
  domainText.innerHTML = pSigned > 0 ? 
    `( ${fmt(asymptoteX)} , ∞ )` : 
    `( −∞ , ${fmt(asymptoteX)} )`;

  rangeText.innerHTML = `( −∞ , ∞ )`;

  // Key point image of (1,0):  solve pSigned·x − h = 1  ⇒  x = (1 + h) / pSigned
  const transX = (1 + hShift) / pSigned;
  const transY = kShift;

  // datasets re‑compute
  chart.data.datasets[0].data = parentY(bBase);
  chart.data.datasets[1].data = calcY(aSigned, bBase, hShift, kShift, pSigned);
  // Update asymptote to be vertical at the correct position
  chart.data.datasets[2].data = [
    { x: asymptoteX, y: -5 },
    { x: asymptoteX, y: 5 }
  ];
  // Update x-axis to span full width
  chart.data.datasets[3].data = [
    { x: -10, y: 0 },
    { x: 10, y: 0 }
  ];
  // Update y-axis to span full height
  chart.data.datasets[4].data = [
    { x: 0, y: -5 },
    { x: 0, y: 5 }
  ];
  chart.data.datasets[5].data = [{ x: 1, y: 0 }];
  chart.data.datasets[6].data = [{ x: transX, y: transY }];

  chart.options.plugins.pointLabels.points = [
    { x: 1, y: 0, label: "(1,0)" },
    { x: transX, y: transY, label: `(${fmt(transX)}, ${fmt(transY)})` }
  ];

  chart.update();
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