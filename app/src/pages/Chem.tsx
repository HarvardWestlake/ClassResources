import { Link } from 'react-router-dom'

export default function Chem() {
  return (
    <main className="page">
      <div className="container widgets-page">
        <h1 className="h1">Chemistry</h1>
        <p className="muted" style={{ marginTop: '.25rem' }}>
          These are the original static widgets, now accessible from inside the app.
        </p>

        <div className="widgets-grid" style={{ marginTop: '1rem' }}>
          <Link className="widget-card" to="/chem/crystallization">
            <div className="title-row">
              <h3>Crystallization Explorer</h3>
            </div>
            <p>Visualize crystal growth dynamics (static HTML embedded).</p>
            <span className="button">Open</span>
          </Link>

          <a className="widget-card" href="/static/chem/index.html">
            <div className="title-row">
              <h3>Legacy Chem Index</h3>
            </div>
            <p>Open the original static index page.</p>
            <span className="button">Open</span>
          </a>
        </div>
      </div>
    </main>
  )
}

