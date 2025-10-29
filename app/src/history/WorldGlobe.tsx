import { useEffect, useRef, useState } from 'react'
import Globe, { type GlobeInstance } from 'globe.gl'

// GeoJSON feature for country polygons
type CountryFeature = {
  type: 'Feature'
  id?: string | number
  properties: { name?: string; NAME?: string; [k: string]: unknown }
  geometry: { type: string; coordinates: any }
}

const MODERN_URL = '/static/data/history/world_modern.geojson'

export default function WorldGlobe() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const globeInstanceRef = useRef<GlobeInstance | null>(null)
  const cacheRef = useRef<CountryFeature[] | null>(null)
  const [selectedNames, setSelectedNames] = useState<string[]>([])

  useEffect(() => {
    if (!containerRef.current) return

    if (!globeInstanceRef.current) {
      globeInstanceRef.current = new Globe(containerRef.current, { animateIn: true })
    }

    const globe = globeInstanceRef.current
      .backgroundColor('#f2f0ec')
      .width(containerRef.current.clientWidth)
      .height(Math.min(420, Math.round(containerRef.current.clientWidth * 0.45)))
      .showGraticules(true)
      .showAtmosphere(true)
      .atmosphereColor('#9cc3e5')
      .atmosphereAltitude(0.18)
      .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
      .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
      .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png')

    let features: CountryFeature[] = []
    let hover: CountryFeature | null = null
    const selected = new Set<string>()

    function getName(f: CountryFeature): string {
      const props = (f?.properties ?? {}) as Record<string, unknown>
      const n1 = (props['name'] ?? '') as string
      const n2 = (props['NAME'] ?? '') as string
      const n = n1 || n2
      return n || '—'
    }

    function refreshSelectedState() {
      setSelectedNames(Array.from(selected).sort((a, b) => a.localeCompare(b)))
    }

    function applyStyles() {
      globe
        .polygonsData(features.filter(f => getName(f) !== 'Antarctica'))
        .polygonAltitude((d) => (d === hover ? 0.06 : 0.01))
        .polygonCapColor((d) => selected.has(getName(d as CountryFeature)) ? 'rgba(200,16,46,0.85)' : 'rgba(120,150,170,0.65)')
        .polygonSideColor(() => 'rgba(60,80,95,0.5)')
        .polygonStrokeColor(() => 'rgba(255,255,255,0.6)')
        .polygonsTransitionDuration(0)
        .polygonLabel((d) => {
          const name = getName(d as CountryFeature)
          return `
            <div style="padding:.25rem .35rem; font-weight:600; color:#000">
              ${name}
            </div>
          `
        })
        .onPolygonHover((d) => {
          hover = d as CountryFeature | null
          globe.polygonAltitude(globe.polygonAltitude())
        })
        .onPolygonClick((d) => {
          const name = getName(d as CountryFeature)
          if (selected.has(name)) selected.delete(name); else selected.add(name)
          globe.polygonCapColor(globe.polygonCapColor())
          refreshSelectedState()
        })
    }

    async function loadModern() {
      if (cacheRef.current) {
        features = cacheRef.current
        applyStyles()
        return
      }
      try {
        const res = await fetch(MODERN_URL)
        const gj = await res.json()
        features = (gj?.features ?? []) as CountryFeature[]
        cacheRef.current = features
      } catch {
        features = []
      }
      applyStyles()
    }

    loadModern()

    function handleResize() {
      if (!containerRef.current) return
      const w = containerRef.current.clientWidth
      globe.width(w)
      globe.height(Math.min(420, Math.round(w * 0.45)))
    }
    const ro = new ResizeObserver(handleResize)
    ro.observe(containerRef.current)

    return () => {
      try { ro.disconnect() } catch {}
    }
  }, [])

  return (
    <main className="page">
      <div className="container widgets-page">
        <h1 className="h1">3D World — Modern (Small)</h1>

        <section className="panel" style={{ overflow: 'hidden' }}>
          <div ref={containerRef} style={{ width: '100%', minHeight: 260 }} />
        </section>

        <section className="panel">
          <div className="eyebrow">Selected Countries</div>
          {selectedNames.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>Click countries on the globe to select them.</p>
          ) : (
            <ul className="list-plain" style={{ columns: 2 }}>
              {selectedNames.map(n => <li key={n}>{n}</li>)}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}


