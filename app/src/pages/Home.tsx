import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="container">
      <h1>Class Resources</h1>
      <div className="controls-container" style={{ gap: '1rem' }}>
        <div className="controls" style={{ flex: '1 1 240px' }}>
          <Link className="back-link" to="/about">About</Link>
          <Link className="back-link" to="/history">History of Chocolate</Link>
          <Link className="back-link" to="/admin">Admin Dashboard</Link>
          <Link className="back-link" to="/admin/style-guide">Style Guide</Link>
          <a className="back-link" href="/static/math/index.html">Math (legacy)</a>
          <a className="back-link" href="/static/code/index.html">Code (legacy)</a>
          <a className="back-link" href="/static/econ/index.html">Economics (legacy)</a>
          <a className="back-link" href="/static/stats/index.html">Statistics (legacy)</a>
        </div>
        <div className="chartarea">
          <p className="info">Welcome! This homepage uses the shared site styles for consistent layout and typography.</p>
          <div className="legend">
            <h3>Quick Links</h3>
            <p><Link to="/about">About the Site</Link></p>
            <p><Link to="/history">History of Chocolate</Link></p>
            <p><Link to="/admin">Admin Dashboard</Link></p>
            <p><Link to="/admin/style-guide">Style Guide</Link></p>
          </div>
        </div>
      </div>
    </div>
  )
}


