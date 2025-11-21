import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <main className="page">
      <div className="container widgets-page">
        <h1 className="h1">Class Resources</h1>

        <h2>Subjects</h2>
        <div className="widgets-grid">
          <a className="widget-card" href="/static/math/index.html">
            <div className="title-row">
              <h3>Math</h3>
            </div>
            <p>Interactive math learning widgets and explorations.</p>
            <span className="button">Open</span>
          </a>

          <a className="widget-card" href="/static/code/index.html">
            <div className="title-row">
              <h3>Code</h3>
            </div>
            <p>Programming visualizations, data structures, and crypto demos.</p>
            <span className="button">Open</span>
          </a>

          <a className="widget-card" href="/static/econ/index.html">
            <div className="title-row">
              <h3>Economics</h3>
            </div>
            <p>Micro and macro interactive widgets.</p>
            <span className="button">Open</span>
          </a>

          <a className="widget-card" href="/static/chem/index.html">
            <div className="title-row">
              <h3>Chemistry</h3>
            </div>
            <p>Hands-on chemistry demos and visualizations.</p>
            <span className="button">Open</span>
          </a>

          <a className="widget-card" href="/static/physics/index.html">
            <div className="title-row">
              <h3>Physics</h3>
            </div>
            <p>Interactive physics simulations: electric fields, potentials, and electron flow.</p>
            <span className="button">Open</span>
          </a>

          <a className="widget-card" href="/static/stats/index.html">
            <div className="title-row">
              <h3>Statistics</h3>
            </div>
            <p>Stats tools, visualizations, and calculators.</p>
            <span className="button">Open</span>
          </a>

          <Link className="widget-card" to="/history">
            <div className="title-row">
              <h3>History</h3>
            </div>
            <p>Interactive timelines and maps for world histories.</p>
            <span className="button">Open</span>
          </Link>
        </div>

        <h2>Admin</h2>
        <div className="widgets-grid">
          <Link className="widget-card" to="/admin">
            <div className="title-row">
              <h3>Style Guide</h3>
            </div>
            <p>UI components, tokens, and patterns used across the app.</p>
            <span className="button">Open</span>
          </Link>
        </div>
      </div>
    </main>
  )
}


