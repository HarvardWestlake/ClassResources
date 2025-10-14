import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <main className="page">
      <div className="container">
        <h1 className="h1">Class Resources</h1>
        <div className="grid grid-2@md gap-lg">
          <aside className="panel">
            <h2 className="h5 eyebrow">Quick links</h2>
            <ul className="list-plain">
              <li><Link className="link" to="/about">About</Link></li>
              <li><Link className="link" to="/admin">Admin · Style Guide</Link></li>
              <li><a className="link" href="/static/math/index.html">Math (legacy)</a></li>
              <li><a className="link" href="/static/code/index.html">Code (legacy)</a></li>
              <li><a className="link" href="/static/econ/index.html">Economics (legacy)</a></li>
              <li><a className="link" href="/static/stats/index.html">Statistics (legacy)</a></li>
            </ul>
          </aside>

          <section className="panel">
            <p className="lead">
              Welcome! This homepage uses shared site styles aligned to the HW brand guide.
            </p>
            <div className="divider" />
            <div className="legend">
              <h3 className="h6">Swatches</h3>
              <p><span className="swatch swatch--black" /> Black</p>
              <p><span className="swatch swatch--red" /> Red (186C)</p>
              <p><span className="swatch swatch--gold" /> Gold (124C)</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}


