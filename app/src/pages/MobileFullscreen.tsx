import { Link } from 'react-router-dom'

export default function MobileFullscreen() {
  return (
    <div className="app-shell">
      <header className="app-shell__bar">
        <div className="app-shell__title">HW · Fullscreen Demo</div>
        <Link to="/" className="btn btn--outline btn--sm">Exit</Link>
      </header>

      <main className="app-shell__content">
        <section className="panel">
          <h1 className="h4">Sign in</h1>
          <form className="form stack-sm">
            <label className="label" htmlFor="u">Username</label>
            <input id="u" className="input" />
            <label className="label" htmlFor="p">Password</label>
            <input id="p" type="password" className="input" />
            <button className="btn btn--block">Login</button>
            <button type="button" className="btn btn--ghost btn--block">Reset Password</button>
          </form>
        </section>

        <section className="panel">
          <h2 className="h6 eyebrow">Helpful links</h2>
          <ul className="list-plain">
            <li><a className="link" href="#">Directory</a></li>
            <li><a className="link" href="#">Maps</a></li>
            <li><a className="link" href="#">HW Media+</a></li>
          </ul>
        </section>
      </main>
    </div>
  )
}


