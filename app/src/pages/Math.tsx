import { Link } from 'react-router-dom'
import { MATH_WIDGETS } from './widgetMaps'

export default function Math() {
  return (
    <main className="page">
      <div className="container widgets-page">
        <h1 className="h1">Math</h1>
        <p className="muted" style={{ marginTop: '.25rem' }}>
          These are the original static math widgets, now accessible from inside the app.
        </p>

        <div className="widgets-grid" style={{ marginTop: '1rem' }}>
          {Object.entries(MATH_WIDGETS).map(([slug, w]) => (
            <Link key={slug} className="widget-card" to={`/math/${slug}`}>
              <div className="title-row">
                <h3>{w.title}</h3>
              </div>
              <p>Static HTML embedded.</p>
              <span className="button">Open</span>
            </Link>
          ))}

          <a className="widget-card" href="/static/math/index.html">
            <div className="title-row">
              <h3>Legacy Math Index</h3>
            </div>
            <p>Open the original static index page.</p>
            <span className="button">Open</span>
          </a>
        </div>
      </div>
    </main>
  )
}

