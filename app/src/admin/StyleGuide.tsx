export default function StyleGuide() {
  return (
    <>
      <h2>Style Guide</h2>
      <div className="controls-container" style={{ gap: '1rem' }}>
        <div className="controls" style={{ flex: '1 1 260px' }}>
          <div className="control">
            <label>Buttons</label>
            <div className="grid grid-3">
              <button className="btn">Primary</button>
              <button className="btn btn-outline">Outline</button>
              <button className="btn btn-link">Link Button</button>
              <button className="btn btn-sm">Small</button>
              <button className="btn btn-lg">Large</button>
              <button className="btn" disabled>Disabled</button>
            </div>
          </div>
          <div className="control inline">
            <label>Inline Controls</label>
            <input type="checkbox" />
            <input type="range" />
          </div>
          <div className="control">
            <label>Inputs</label>
            <input className="input" placeholder="Text input" />
            <div className="helper-text">Helper text for input.</div>
            <input className="input is-invalid" placeholder="Invalid input" />
            <div className="error-text">Validation message.</div>
            <select className="select">
              <option>Option A</option>
              <option>Option B</option>
            </select>
            <textarea className="textarea" placeholder="Textarea" />
          </div>
          <div className="control">
            <label>Badges</label>
            <div className="grid grid-3">
              <span className="badge badge-primary">Primary</span>
              <span className="badge badge-neutral">Neutral</span>
              <span className="badge badge-accent">Accent</span>
            </div>
          </div>
        </div>
        <div className="chartarea">
          <div className="info">
            <h3>Typography</h3>
            <p>Body uses Source Sans Pro with standard spacing.</p>
          </div>
          <div className="legend">
            <h3>Swatches</h3>
            <p>
              <span className="swatch parent"></span> Neutral<br/>
              <span className="swatch trans"></span> Primary<br/>
              <span className="swatch axis"></span> Accent
            </p>
          </div>
          <div className="divider" />
          <div className="panel">
            <div className="grid grid-3">
              <div className="alert alert-info">This is an info alert.</div>
              <div className="alert alert-success">This is a success alert.</div>
              <div className="alert alert-warning">This is a warning alert.</div>
            </div>
            <div className="spacer" />
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Example</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Button</td>
                  <td><button className="btn btn-sm">Click</button></td>
                  <td className="muted">Primary button</td>
                </tr>
                <tr>
                  <td>Badge</td>
                  <td><span className="badge badge-accent">New</span></td>
                  <td className="muted">Accent badge</td>
                </tr>
                <tr>
                  <td>Input</td>
                  <td><input className="input" placeholder="Text" /></td>
                  <td className="muted">Default input</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}


