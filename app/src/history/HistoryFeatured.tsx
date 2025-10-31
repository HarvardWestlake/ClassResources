import { useMemo, useState } from 'react'

type EventItem = {
  id: string
  title: string
  date: string
  place?: string
  description?: string
}

export default function HistoryFeatured() {
  const events = useMemo<EventItem[]>(() => ([
    {
      id: 'philly-1776',
      title: 'US Declaration of Independence',
      date: '1776-07-04',
      place: 'Philadelphia, USA',
      description: 'Adoption of the Declaration at Philadelphia.'
    },
    {
      id: 'bastille-1789',
      title: 'Storming of the Bastille',
      date: '1789-07-14',
      place: 'Paris, France',
      description: 'French Revolution flashpoint.'
    },
    {
      id: 'berlinwall-1989',
      title: 'Fall of the Berlin Wall',
      date: '1989-11-09',
      place: 'Berlin, Germany',
      description: 'Borders open; reunification follows.'
    }
  ]), [])

  const [idx, setIdx] = useState(0)
  const current = events[idx]

  function prev(){ setIdx(i => (i - 1 + events.length) % events.length) }
  function next(){ setIdx(i => (i + 1) % events.length) }

  return (
    <section className="panel panel--right-decor" aria-label="Featured history module">
      <div className="grid gap-md grid-2@md" style={{ alignItems: 'center' }}>
        <div className="stack-md">
          <div className="eyebrow">Featured</div>
          <h2 className="h3" style={{ marginTop: 0 }}>World Events Teaser</h2>
          <p className="lead" style={{ marginTop: 0 }}>
            A simple in‑app module previewing key world events. Use the controls to browse.
          </p>

          <div className="stack-sm" role="group" aria-label="Event details">
            <div className="badge badge--neutral">{new Date(current.date).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'2-digit' })}</div>
            <h3 className="h4" style={{ margin: 0 }}>{current.title}</h3>
            {current.place ? <div className="muted">{current.place}</div> : null}
            {current.description ? <p style={{ marginTop: '.25rem' }}>{current.description}</p> : null}
          </div>

          <div className="inline-controls" style={{ gap: '.5rem' }}>
            <button className="btn btn--sm" onClick={prev} aria-label="Previous">◀ Prev</button>
            <input
              className="range"
              type="range"
              min={0}
              max={events.length - 1}
              value={idx}
              onChange={(e)=> setIdx(Number(e.target.value))}
              aria-label="Event index"
              style={{ flex: 1 }}
            />
            <button className="btn btn--sm" onClick={next} aria-label="Next">Next ▶</button>
          </div>

          <div className="grid gap-sm" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <a className="btn btn--outline" href="/static/history/widgets/chocolate-history/chocolate-history.html">Open Chocolate (static)</a>
            <a className="btn btn--outline" href="/static/history/widgets/chocolate-history/timeline-map.html">Open Timeline Map (static)</a>
            <a className="btn btn--outline" href="/static/history/widgets/history-map/history-map.html">Open 2D/3D Map (static)</a>
          </div>
        </div>

        <div className="panel" aria-hidden>
          <div style={{ display:'grid', placeItems:'center', minHeight: 220 }}>
            <div style={{ textAlign:'center' }}>
              <div className="badge badge--primary">In‑App Module</div>
              <div className="spacer" />
              <div className="h5" style={{ margin: 0 }}>{current.title}</div>
              <div className="muted">{new Date(current.date).toLocaleDateString()}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}


