import { Routes, Route, Link, NavLink } from 'react-router-dom'
import Home from './pages/Home.tsx'
import Chem from './pages/Chem.tsx'
import Econ from './pages/Econ.tsx'
import StaticEmbed from './pages/StaticEmbed.tsx'
import History from './history/History.tsx'
import WorldGlobe from './history/WorldGlobe.tsx'
import LectureViewer from './history/LectureViewer.tsx'
import StyleGuide from './admin/StyleGuide.tsx'
import MobileFullscreen from './pages/MobileFullscreen.tsx'

function TopNav() {
  return (
    <header className="hw-topnav">
      <div className="container container--wide hw-topnav__inner">
        <Link to="/" className="hw-brand">Harvard‑Westlake</Link>
        <nav className="hw-nav">
          <NavLink to="/" end className={({ isActive }) => `hw-nav__link${isActive ? ' active' : ''}`}>Home</NavLink>
          <NavLink to="/history" className={({ isActive }) => `hw-nav__link${isActive ? ' active' : ''}`}>History</NavLink>
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
        <Route path="chem" element={<Chem />} />
        <Route path="chem/crystallization" element={<StaticEmbed title="Crystallization Explorer" src="/static/chem/crystallization/crystallization.html" backTo="/chem" backLabel="Chemistry" />} />
        <Route path="econ" element={<Econ />} />
        <Route path="econ/imperfect-competitor" element={<StaticEmbed title="Imperfect Competitor" src="/static/econ/widgets/imperfect-competitor/imperfect-competitor.html" backTo="/econ" backLabel="Economics" />} />
        <Route path="econ/production-cost" element={<StaticEmbed title="Production Cost" src="/static/econ/widgets/production-cost/production-cost.html" backTo="/econ" backLabel="Economics" />} />
        <Route path="admin" element={<StyleGuide />} />
        <Route path="mobile" element={<MobileFullscreen />} />
        <Route path="history" element={<History />} />
        <Route path="history/world" element={<WorldGlobe />} />
        <Route path="history/lecture" element={<LectureViewer />} />
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
 
