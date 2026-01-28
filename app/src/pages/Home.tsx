import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <main className="page">
      <div className="container widgets-page">
        <h1 className="h1">Class Resources</h1>

        <h2>Subjects</h2>
        <div className="widgets-grid">
          <Link className="widget-card" to="/math">
            <div className="title-row">
              <h3>Math</h3>
            </div>
            <p>Interactive math learning widgets and explorations.</p>
            <span className="button">Open</span>
          </Link>

          <Link className="widget-card" to="/code">
            <div className="title-row">
              <h3>Code</h3>
            </div>
            <p>Programming visualizations, data structures, and crypto demos.</p>
            <span className="button">Open</span>
          </Link>

          <Link className="widget-card" to="/econ">
            <div className="title-row">
              <h3>Economics</h3>
            </div>
            <p>Micro and macro interactive widgets.</p>
            <span className="button">Open</span>
          </Link>

          <Link className="widget-card" to="/chem">
            <div className="title-row">
              <h3>Chemistry</h3>
            </div>
            <p>Hands-on chemistry demos and visualizations.</p>
            <span className="button">Open</span>
          </Link>

          <Link className="widget-card" to="/stats">
            <div className="title-row">
              <h3>Statistics</h3>
            </div>
            <p>Stats tools, visualizations, and calculators.</p>
            <span className="button">Open</span>
          </Link>

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


