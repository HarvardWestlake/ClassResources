import { Routes, Route, Link, NavLink } from 'react-router-dom'
import Home from './pages/Home.tsx'
import History from './history/History.tsx'
import StyleGuide from './admin/StyleGuide.tsx'
import MobileFullscreen from './pages/MobileFullscreen.tsx'

function TopNav() {
  return (
    <header className="hw-topnav">
      <div className="container container--wide hw-topnav__inner">
        <Link to="/" className="hw-brand">Harvard‑Westlake</Link>
        <nav className="hw-nav">
          <NavLink to="/" end className={({ isActive }) => `hw-nav__link${isActive ? ' active' : ''}`}>Home</NavLink>
          <NavLink to="/admin" className={({ isActive }) => `hw-nav__link${isActive ? ' active' : ''}`}>Style Guide</NavLink>
          <NavLink to="/mobile" className={({ isActive }) => `hw-nav__link${isActive ? ' active' : ''}`}>Mobile Fullscreen</NavLink>
        </nav>
      </div>
    </header>
  )
}

export default function App() {
  return (
    <>
      <TopNav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="admin" element={<StyleGuide />} />
        <Route path="mobile" element={<MobileFullscreen />} />
        <Route path="history" element={<History />} />
        <Route path="*" element={<Home />} />
      </Routes>
      <footer className="hw-footer">
        <div className="container container--wide">
          <div className="muted">© Harvard‑Westlake · Demo UI</div>
        </div>
      </footer>
    </>
  )
}
 
