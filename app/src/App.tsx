import { Routes, Route, Link } from 'react-router-dom'
import './App.css'

function Home() {
  return (
    <div className="container">
      <h1>Class Resources</h1>
      <div className="controls-container" style={{ gap: '1rem' }}>
        <div className="controls" style={{ flex: '1 1 240px' }}>
          <Link className="back-link" to="/about">About</Link>
          <Link className="back-link" to="/admin">Admin · Style Guide</Link>
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
            <p><Link to="/admin">Admin · Style Guide</Link></p>
          </div>
        </div>
      </div>
    </div>
  )
}

function About() {
  return (
    <div style={{ padding: 24 }}>
      <h2>About</h2>
      <p>This app will gradually replace the legacy static pages.</p>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="about" element={<About />} />
      <Route path="admin" element={<StyleGuide />} />
      <Route path="*" element={<Home />} />
    </Routes>
  )
}

function StyleGuide() {
  return (
    <div className="container">
      <h1>Style Guide</h1>
      <div className="controls-container" style={{ gap: '1rem' }}>
        <div className="controls" style={{ flex: '1 1 260px' }}>
          <a className="back-link" href="/">← Back Home</a>
          <div className="control">
            <label>Buttons</label>
            <div className="grid grid-3">
              <button className="btn">Primary</button>
              <button className="btn btn-outline">Outline</button>
              <button className="btn btn-link">Link Button</button>
              <button className="btn btn-sm">Small</button>
              <button className="btn btn-lg">Large</button>
              <button className="btn" disabled>Disabled</button>
            </div>
          </div>
          <div className="control inline">
            <label>Inline Controls</label>
            <input type="checkbox" />
            <input type="range" />
          </div>
          <div className="control">
            <label>Inputs</label>
            <input className="input" placeholder="Text input" />
            <div className="helper-text">Helper text for input.</div>
            <input className="input is-invalid" placeholder="Invalid input" />
            <div className="error-text">Validation message.</div>
            <select className="select">
              <option>Option A</option>
              <option>Option B</option>
            </select>
            <textarea className="textarea" placeholder="Textarea" />
          </div>
          <div className="control">
            <label>Badges</label>
            <div className="grid grid-3">
              <span className="badge badge-primary">Primary</span>
              <span className="badge badge-neutral">Neutral</span>
              <span className="badge badge-accent">Accent</span>
            </div>
          </div>
        </div>
        <div className="chartarea">
          <div className="info">
            <h3>Typography</h3>
            <p>Body uses Source Sans Pro with standard spacing.</p>
          </div>
          <div className="legend">
            <h3>Swatches</h3>
            <p>
              <span className="swatch parent"></span> Neutral<br/>
              <span className="swatch trans"></span> Primary<br/>
              <span className="swatch axis"></span> Accent
            </p>
          </div>
          <div className="divider" />
          <div className="panel">
            <div className="grid grid-3">
              <div className="alert alert-info">This is an info alert.</div>
              <div className="alert alert-success">This is a success alert.</div>
              <div className="alert alert-warning">This is a warning alert.</div>
            </div>
            <div className="spacer" />
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Example</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Button</td>
                  <td><button className="btn btn-sm">Click</button></td>
                  <td className="muted">Primary button</td>
                </tr>
                <tr>
                  <td>Badge</td>
                  <td><span className="badge badge-accent">New</span></td>
                  <td className="muted">Accent badge</td>
                </tr>
                <tr>
                  <td>Input</td>
                  <td><input className="input" placeholder="Text" /></td>
                  <td className="muted">Default input</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
