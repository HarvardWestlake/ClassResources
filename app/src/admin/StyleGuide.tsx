export default function StyleGuide() {
  return (
    <main className="page">
      <div className="container styleguide">
        <h1 className="h2">Style Guide</h1>

        {/* Homepage Layout (Header, Sections, Modules) */}
        <section className="panel">
          <h2 className="h5 eyebrow">Homepage Layout</h2>
          <p className="muted">Demonstrates the homepage header, section headings, and module grid using shared classes.</p>
          <div className="widgets-page">
            <h1 className="h1">Class Resources (Demo)</h1>

            <h2>Subjects</h2>
            <div className="widgets-grid">
              <a className="widget-card" href="#">
                <div className="title-row">
                  <h3>Math</h3>
                </div>
                <p>Interactive math learning widgets and explorations.</p>
                <span className="button">Open</span>
              </a>
              <a className="widget-card" href="#">
                <div className="title-row">
                  <h3>Code</h3>
                </div>
                <p>Programming visualizations, data structures, and crypto demos.</p>
                <span className="button">Open</span>
              </a>
              <a className="widget-card" href="#">
                <div className="title-row">
                  <h3>Economics</h3>
                </div>
                <p>Micro and macro interactive widgets.</p>
                <span className="button">Open</span>
              </a>
            </div>

            <h2>Admin</h2>
            <div className="widgets-grid">
              <a className="widget-card" href="#">
                <div className="title-row">
                  <h3>Style Guide</h3>
                </div>
                <p>UI components, tokens, and patterns used across the app.</p>
                <span className="button">Open</span>
              </a>
            </div>
          </div>
        </section>

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

            <div className="divider" />
            <div className="stack-sm">
              <div className="h6">Red uppercase heading utility (.red)</div>
              <div className="h1 red">H1 – Red Uppercase</div>
              <div className="h2 red">H2 – Red Uppercase</div>
              <div className="h3 red">H3 – Red Uppercase</div>
              <div className="h4 red">H4 – Red Uppercase</div>
            </div>
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
            <button className="btn btn--caps">All Caps</button>
            <button className="btn btn--sm">Small</button>
            <button className="btn btn--lg">Large</button>
            <button className="btn" disabled>Disabled</button>
            {/* Custom v2 demo (Style Guide only) */}
            <button className="custom-button custom-button--v2" style={{ width: '100%' }}>
              <span className="decorator"><span className="chev-rect" /><span className="stretch-bar" /></span>
              <span className="txt">Dive In</span>
              <span className="plus-icon"></span>
            </button>
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



