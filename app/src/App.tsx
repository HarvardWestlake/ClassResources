import { Routes, Route, Link, NavLink } from 'react-router-dom'
import Home from './pages/Home.tsx'
import Chem from './pages/Chem.tsx'
import Econ from './pages/Econ.tsx'
import Math from './pages/Math.tsx'
import Code from './pages/Code.tsx'
import Stats from './pages/Stats.tsx'
import StaticEmbed from './pages/StaticEmbed.tsx'
import WidgetRoute from './pages/WidgetRoute.tsx'
import { CODE_WIDGETS, HISTORY_WIDGETS, MATH_WIDGETS, STATS_WIDGETS } from './pages/widgetMaps'
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
        <Route path="math" element={<Math />} />
        <Route path="math/:widget" element={<WidgetRoute widgets={MATH_WIDGETS} backTo="/math" backLabel="Math" />} />
        <Route path="code" element={<Code />} />
        <Route path="code/:widget" element={<WidgetRoute widgets={CODE_WIDGETS} backTo="/code" backLabel="Code" />} />
        <Route path="stats" element={<Stats />} />
        <Route path="stats/:widget" element={<WidgetRoute widgets={STATS_WIDGETS} backTo="/stats" backLabel="Statistics" />} />
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
        <Route path="history/widgets/:widget" element={<WidgetRoute widgets={HISTORY_WIDGETS} backTo="/history" backLabel="History" />} />
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
 
