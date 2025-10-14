import { Link, NavLink, Outlet } from 'react-router-dom'

export default function AdminLayout() {
  return (
    <div className="container">
      <h1>Admin</h1>
      <div className="controls" style={{ display: 'flex', gap: '0.5rem', marginBottom: 16 }}>
        <Link className="back-link" to="/">← Home</Link>
        <NavLink className="back-link" to="/admin">Dashboard</NavLink>
        <NavLink className="back-link" to="/admin/style-guide">Style Guide</NavLink>
      </div>
      <Outlet />
    </div>
  )
}


