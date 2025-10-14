export default function StyleGuide() {
  return (
    <main className="page">
      <div className="container">
        <h1 className="h2">Style Guide</h1>

        {/* Typography */}
        <section className="panel">
          <h2 className="h5 eyebrow">Typography Scale</h2>
          <p className="muted">
            Headlines use Source Sans Black; subheads Semibold; body Light/Regular. (Arial as fallback when needed.)
          </p>
          <div className="stack-md">
            <div className="type-sample">
              <div className="h1">H1 – Discover your voice</div>
              <div className="h2">H2 – Discover your power</div>
              <div className="h3">H3 – Discover your community</div>
              <div className="h4">H4 – Section heading</div>
              <div className="h5">H5 – Panel / Card heading</div>
              <div className="h6">H6 – Small heading</div>
              <p className="lead">Lead – Larger body for intro paragraphs.</p>
              <p>
                Body – Source Sans with comfortable line height. Links like
                <a className="link" href="#"> this</a> are underlined on hover and
                use HW red.
              </p>
              <p className="eyebrow">Eyebrow – small uppercase label</p>
            </div>
          </div>
        </section>

        {/* Buttons */}
        <section className="panel">
          <h2 className="h5 eyebrow">Buttons</h2>
          <div className="grid grid-3@md gap-md">
            <button className="btn">Primary</button>
            <button className="btn btn--outline">Outline</button>
            <button className="btn btn--ghost">Ghost</button>
            <button className="btn btn--sm">Small</button>
            <button className="btn btn--lg">Large</button>
            <button className="btn" disabled>Disabled</button>
          </div>
        </section>

        {/* Badges + Alerts */}
        <section className="panel">
          <h2 className="h5 eyebrow">Badges & Alerts</h2>
          <div className="stack-sm">
            <div className="stack-xs">
              <span className="badge badge--primary">Primary</span>
              <span className="badge badge--neutral">Neutral</span>
              <span className="badge badge--accent">Accent</span>
            </div>
            <div className="grid grid-3@md gap-md">
              <div className="alert alert--info">This is an info alert.</div>
              <div className="alert alert--success">This is a success alert.</div>
              <div className="alert alert--warning">This is a warning alert.</div>
            </div>
          </div>
        </section>

        {/* Forms */}
        <section className="panel">
          <h2 className="h5 eyebrow">Forms</h2>
          <p className="muted">
            Controls are 44px high minimum for touch, have 1px borders, clear focus rings,
            and never overflow their container.
          </p>
          <form className="form grid grid-2@md gap-lg">
            <div className="stack-sm">
              <label className="label" htmlFor="name">Name</label>
              <input id="name" className="input" placeholder="Jane Wolverine" />

              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" className="input" placeholder="wolverine@hw.com" />

              <label className="label" htmlFor="password">Password</label>
              <div className="input-group">
                <span className="input-prefix">@</span>
                <input id="password" type="password" className="input" placeholder="••••••••" />
                <button type="button" className="input-suffix btn btn--outline">Show</button>
              </div>
              <div className="helper-text">Use 12+ characters.</div>

              <label className="label" htmlFor="select">Program</label>
              <select id="select" className="select">
                <option>Upper School</option>
                <option>Middle School</option>
              </select>

              <label className="label" htmlFor="msg">Message</label>
              <textarea id="msg" className="textarea" rows={4} placeholder="Write your message…" />

              <div className="field">
                <label className="checkbox">
                  <input type="checkbox" /> <span>Subscribe to updates</span>
                </label>
              </div>

              <div className="field">
                <span className="label">Role</span>
                <label className="radio"><input name="role" type="radio" defaultChecked /> <span>Student</span></label>
                <label className="radio"><input name="role" type="radio" /> <span>Parent</span></label>
                <label className="radio"><input name="role" type="radio" /> <span>Faculty</span></label>
              </div>

              <div className="field">
                <label className="switch">
                  <input type="checkbox" /> <span className="switch__slider" /> Enable notifications
                </label>
              </div>
            </div>

            <div className="stack-sm">
              <label className="label" htmlFor="range">Range</label>
              <input id="range" type="range" className="range" />

              <label className="label" htmlFor="file">Upload file</label>
              <input id="file" type="file" className="input-file" />

              <div className="field">
                <label className="label">Inline controls</label>
                <div className="inline-controls">
                  <input type="checkbox" /> <span>Checkbox</span>
                  <input type="radio" name="r2" /> <span>Radio</span>
                </div>
              </div>

              <div className="field">
                <label className="label">Validation</label>
                <input className="input is-valid" placeholder="Looks good" />
                <div className="valid-text">Success message.</div>
                <input className="input is-invalid" placeholder="Has an error" />
                <div className="error-text">Please correct this field.</div>
              </div>
            </div>

            <div className="grid grid-2 gap-sm col-span-2">
              <button className="btn">Submit</button>
              <button className="btn btn--outline" type="button">Cancel</button>
            </div>
          </form>
        </section>

        {/* Tables */}
        <section className="panel">
          <h2 className="h5 eyebrow">Tables</h2>
          <table className="table table--sm">
            <thead>
              <tr>
                <th>Component</th><th>Example</th><th>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Button</td>
                <td><button className="btn btn--sm">Click</button></td>
                <td className="muted">Primary button</td>
              </tr>
              <tr>
                <td>Badge</td>
                <td><span className="badge badge--accent">New</span></td>
                <td className="muted">Accent badge</td>
              </tr>
              <tr>
                <td>Input</td>
                <td><input className="input" placeholder="Text" /></td>
                <td className="muted">Default input</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </main>
  )
}



