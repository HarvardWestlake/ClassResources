// Mode switching
const tabComprehensive = document.getElementById('tabComprehensive');
const tabFormative = document.getElementById('tabFormative');
const tabAnimated = document.getElementById('tabAnimated');
const viewComprehensive = document.getElementById('viewComprehensive');
const viewFormative = document.getElementById('viewFormative');
const viewAnimated = document.getElementById('viewAnimated');

function setActiveTab(tab) {
  [tabComprehensive, tabFormative, tabAnimated].forEach(btn => {
    if (!btn) return;
    const isActive = btn === tab;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });
  viewComprehensive.hidden = tab !== tabComprehensive;
  viewFormative.hidden = tab !== tabFormative;
  viewAnimated.hidden = tab !== tabAnimated;
}

tabComprehensive?.addEventListener('click', () => setActiveTab(tabComprehensive));
tabFormative?.addEventListener('click', () => setActiveTab(tabFormative));
tabAnimated?.addEventListener('click', () => setActiveTab(tabAnimated));

// Animated map timeline
const yearRange = document.getElementById('yearRange');
const yearLabel = document.getElementById('yearLabel');
const playPause = document.getElementById('playPause');
const eventsList = document.getElementById('eventsList');

let map;
let layers = [];
let playing = false;
let timerId = null;

// Minimal geo points for key events (approximate lat/lon)
const timeline = [
  { year: 1500, label: 'Mesoamerican centers of cacao use', coords: [15.5, -90.5] },
  { year: 1528, label: 'Cacao to Iberian courts', coords: [40.4, -3.7] },
  { year: 1650, label: 'Chocolate houses in London', coords: [51.5, -0.12] },
  { year: 1828, label: 'Van Houten press (Netherlands)', coords: [52.37, 4.9] },
  { year: 1847, label: 'First solid bar (Fry, UK)', coords: [51.46, -2.59] },
  { year: 1879, label: 'Conching (Lindt, Switzerland)', coords: [46.95, 7.44] },
  { year: 1900, label: 'West African production expansion', coords: [6.8, -5.0] },
  { year: 1950, label: 'Global mass-market confectionery', coords: [48.1, 11.58] },
  { year: 2000, label: 'Certification & sustainability focus', coords: [5.3, -3.9] },
];

function initMap() {
  const mapEl = document.getElementById('map');
  if (!mapEl) return;
  map = L.map('map', { zoomControl: true, attributionControl: true }).setView([20, 0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 6,
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
}

function renderEvents(upToYear) {
  // Clear current markers
  layers.forEach(layer => layer.remove());
  layers = [];

  // Render markers up to year
  const shown = timeline.filter(e => e.year <= upToYear);
  shown.forEach((e, idx) => {
    const marker = L.circleMarker(e.coords, {
      radius: 6,
      color: '#E60000',
      fillColor: '#E60000',
      fillOpacity: 0.8,
      weight: 1
    }).addTo(map);
    marker.bindPopup(`<strong>${e.year}</strong><br/>${e.label}`);
    layers.push(marker);

    // simple trail animation
    setTimeout(() => marker.openPopup(), 150 + idx * 80);
    setTimeout(() => marker.closePopup(), 1000 + idx * 80);
  });

  // Update side list
  if (eventsList) {
    eventsList.innerHTML = shown
      .map(e => `<li><span class="badge badge-accent">${e.year}</span> ${e.label}</li>`)
      .join('');
  }
}

function setYear(y) {
  if (yearLabel) yearLabel.textContent = String(y);
  if (map) renderEvents(y);
}

function step() {
  if (!playing) return;
  const min = Number(yearRange.min);
  const max = Number(yearRange.max);
  let val = Number(yearRange.value);
  val = Math.min(max, val + 10);
  yearRange.value = String(val);
  setYear(val);
  if (val >= max) {
    playing = false;
    playPause.textContent = 'Play';
    return;
  }
  timerId = setTimeout(step, 700);
}

function togglePlay() {
  playing = !playing;
  playPause.textContent = playing ? 'Pause' : 'Play';
  if (playing) step();
  else if (timerId) { clearTimeout(timerId); timerId = null; }
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  initMap();
  setYear(Number(yearRange?.value || 1500));
});

yearRange?.addEventListener('input', (e) => {
  const v = Number(e.target.value);
  setYear(v);
});

playPause?.addEventListener('click', togglePlay);


