import { Routes, Route, Link } from 'react-router-dom'
import './App.css'

function Home() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Class Resources App</h1>
      <p>New SPA under /app with legacy sections preserved.</p>
      <nav style={{ display: 'grid', gap: 8 }}>
        <Link to="/about">About</Link>
        <a href="/static/math/index.html">Math (legacy)</a>
        <a href="/static/code/index.html">Code (legacy)</a>
        <a href="/static/econ/index.html">Economics (legacy)</a>
        <a href="/static/stats/index.html">Statistics (legacy)</a>
      </nav>
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
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
