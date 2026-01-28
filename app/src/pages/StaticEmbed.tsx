import { useEffect } from 'react'
import { Link } from 'react-router-dom'

type StaticEmbedProps = {
  title: string
  src: string
  backTo: string
  backLabel: string
}

export default function StaticEmbed({ title, src, backTo, backLabel }: StaticEmbedProps) {
  useEffect(() => {
    const prev = document.title
    document.title = `${title} · Class Resources`
    return () => { document.title = prev }
  }, [title])

  return (
    <main className="page">
      <div className="container widgets-page">
        <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link className="btn btn--outline" to={backTo}>← {backLabel}</Link>
          <h1 className="h1" style={{ margin: 0 }}>{title}</h1>
          <a className="btn" href={src} target="_blank" rel="noreferrer">Open in new tab</a>
        </div>

        <section className="panel" style={{ marginTop: '1rem' }}>
          <iframe
            title={title}
            src={src}
            style={{
              width: '100%',
              height: '75vh',
              border: '1px solid rgba(0,0,0,.15)',
              borderRadius: 12,
              background: '#fff'
            }}
          />
        </section>
      </div>
    </main>
  )
}

