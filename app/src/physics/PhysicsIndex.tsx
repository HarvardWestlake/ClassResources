import { Link } from 'react-router-dom'

export default function PhysicsIndex() {
  return (
    <main className="page">
      <div className="container widgets-page">
        <h1 className="h1">Physics</h1>
        <div className="widgets-grid">
          <Link className="widget-card" to="/physics/electric-charge">
            <div className="title-row">
              <h3>Electric Charge</h3>
            </div>
            <p>Explore charge distribution, conduction, grounding, and more.</p>
            <span className="button">Open</span>
          </Link>
        </div>
      </div>
    </main>
  )
}
 

