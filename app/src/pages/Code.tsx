import { Link } from 'react-router-dom'
import { CODE_WIDGETS } from './widgetMaps'

export default function Code() {
  return (
    <main className="page">
      <div className="container widgets-page">
        <h1 className="h1">Code</h1>
        <p className="muted" style={{ marginTop: '.25rem' }}>
          These are the original static code widgets, now accessible from inside the app.
        </p>

        <div className="widgets-grid" style={{ marginTop: '1rem' }}>
          {Object.entries(CODE_WIDGETS).map(([slug, w]) => (
            <Link key={slug} className="widget-card" to={`/code/${slug}`}>
              <div className="title-row">
                <h3>{w.title}</h3>
              </div>
              <p>Static HTML embedded.</p>
              <span className="button">Open</span>
            </Link>
          ))}

          <a className="widget-card" href="/static/code/index.html">
            <div className="title-row">
              <h3>Legacy Code Index</h3>
            </div>
            <p>Open the original static index page.</p>
            <span className="button">Open</span>
          </a>
        </div>
      </div>
    </main>
  )
}

