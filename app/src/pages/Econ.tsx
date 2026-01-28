import { Link } from 'react-router-dom'

export default function Econ() {
  return (
    <main className="page">
      <div className="container widgets-page">
        <h1 className="h1">Economics</h1>
        <p className="muted" style={{ marginTop: '.25rem' }}>
          These are the original static widgets, now accessible from inside the app.
        </p>

        <div className="widgets-grid" style={{ marginTop: '1rem' }}>
          <Link className="widget-card" to="/econ/imperfect-competitor">
            <div className="title-row">
              <h3>Imperfect Competitor</h3>
            </div>
            <p>Microeconomics widget (static HTML embedded).</p>
            <span className="button">Open</span>
          </Link>

          <Link className="widget-card" to="/econ/production-cost">
            <div className="title-row">
              <h3>Production Cost</h3>
            </div>
            <p>Cost curves widget (static HTML embedded).</p>
            <span className="button">Open</span>
          </Link>

          <a className="widget-card" href="/static/econ/index.html">
            <div className="title-row">
              <h3>Legacy Econ Index</h3>
            </div>
            <p>Open the original static index page.</p>
            <span className="button">Open</span>
          </a>
        </div>
      </div>
    </main>
  )
}

