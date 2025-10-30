import { Link } from 'react-router-dom'

export default function History() {
  return (
    <main className="page">
      <div className="container widgets-page">
        <h1 className="h1">History</h1>

        <div className="widgets-grid">
          <Link className="widget-card" to="/history/world">
            <div className="title-row">
              <h3>3D World — Select Countries</h3>
              <div className="function">In‑app 3D globe with selectable countries</div>
            </div>
            <p>Explore a fully interactive 3D world. Click countries to select them; list updates live.</p>
            <span className="button">Open In‑App</span>
          </Link>

          <Link className="widget-card" to="/history/lecture">
            <div className="title-row">
              <h3>Lecture of the Day</h3>
              <div className="function">Upload JSON and scroll a clean timeline</div>
            </div>
            <p>Student‑mode viewer: upload a story JSON to browse a clear, scrollable timeline of major events. Click any event to view details, images, and dates.</p>
            <span className="button">Open Viewer</span>
          </Link>

          <a className="widget-card" href="/static/history/widgets/chocolate-history/chocolate-history.html">
            <div className="title-row">
              <h3>Chocolate: A Global History</h3>
              <div className="function">Origins → Columbian Exchange → Industry → Globalization</div>
            </div>
            <p>Explore cacao's journey from Mesoamerican ritual drink to a global commodity. Switch between comprehensive, formative, and animated map views.</p>
            <span className="button">Launch Widget</span>
          </a>

          <a className="widget-card" href="/static/history/widgets/chocolate-history/timeline-map.html">
            <div className="title-row">
              <h3>Chocolate: Timeline Map</h3>
              <div className="function">Scroll the timeline to highlight places worldwide</div>
            </div>
            <p>Interactive world map with a scroll-driven timeline. Includes Ecuador (c. 3300 BCE), Manila (1670), and the Netherlands (1828). Add your own countries or coordinates.</p>
            <span className="button">Open Timeline Map</span>
          </a>

          <a className="widget-card" href="/static/history/widgets/history-map/history-map.html">
            <div className="title-row">
              <h3>World Timeline — 2D/3D Map</h3>
              <div className="function">Switch between 2D map and 3D globe with a time slider</div>
            </div>
            <p>Explore global events on a labeled world map with borders. Toggle between flat and globe views, highlight events over time, and fly to locations.</p>
            <span className="button">Open 2D/3D Map</span>
          </a>
        </div>
      </div>
    </main>
  )
}


