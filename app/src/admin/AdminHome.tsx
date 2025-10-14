import { Link } from 'react-router-dom'

export default function AdminHome() {
  return (
    <div className="panel">
      <h2>Admin Dashboard</h2>
      <p>Manage administrative tools and resources.</p>
      <div className="grid grid-3">
        <Link className="btn" to="/admin/style-guide">Open Style Guide</Link>
      </div>
    </div>
  )
}


