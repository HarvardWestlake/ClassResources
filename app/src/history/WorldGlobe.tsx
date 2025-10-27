import { useEffect, useMemo, useRef, useState } from 'react'
import Globe from 'globe.gl'

type CountryFeature = {
  type: 'Feature'
  id?: string | number
  properties: { name?: string; [k: string]: unknown }
  geometry: { type: string; coordinates: any }
}

type Provider = {
  id: string
  label: string
  kind: 'vector'
  url: string
  nameProp?: string
  startProp?: string
  endProp?: string
}

const PROVIDERS: Provider[] = [
  {
    id: 'modern',
    label: 'Modern World (Natural Earth)',
    kind: 'vector',
    url: '/static/data/history/world_modern.geojson',
    nameProp: 'name'
  },
  // Historical provider (local CShapes 2.0)
  {
    id: 'cshapes',
    label: 'CShapes 2.0 (1886–2019)',
    kind: 'vector',
    url: '/static/data/history/cshapes_2_0.geojson',
    nameProp: 'country_name',
    startProp: 'start_year',
    endProp: 'end_year'
  }
]

export default function WorldGlobe() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [selectedNames, setSelectedNames] = useState<string[]>([])
  const [year, setYear] = useState<number>(2020)
  const provider = useMemo<Provider>(() => {
    if (year >= 1886 && year <= 2019) return PROVIDERS[1]
    return PROVIDERS[0]
  }, [year])
  const [activeProviderLabel, setActiveProviderLabel] = useState<string>(provider.label)

  const cacheRef = useRef<Record<string, CountryFeature[]>>({})
  const globeInstanceRef = useRef<ReturnType<typeof Globe> | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    if (!globeInstanceRef.current){
      globeInstanceRef.current = Globe({ animateIn: true })(containerRef.current)
    }
    const globe = globeInstanceRef.current
      .backgroundColor('#f2f0ec')
      .width(containerRef.current.clientWidth)
      .height(Math.min(640, Math.round(containerRef.current.clientWidth * 0.55)))
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
      const n = (f?.properties?.name ?? '') as string
      return n || '—'
    }

    function refreshSelectedState(){
      setSelectedNames(Array.from(selected).sort((a,b)=> a.localeCompare(b)))
    }

    function applyStyles(){
      globe
        .polygonsData(features.filter(f => getName(f) !== 'Antarctica'))
        .polygonAltitude((d: CountryFeature) => (d === hover ? 0.06 : 0.01))
        .polygonCapColor((d: CountryFeature) => selected.has(getName(d)) ? 'rgba(200,16,46,0.85)' : 'rgba(120,150,170,0.65)')
        .polygonSideColor(() => 'rgba(60,80,95,0.5)')
        .polygonStrokeColor(() => 'rgba(255,255,255,0.6)')
        .polygonLabel((d: CountryFeature) => {
          const name = getName(d)
          return `
            <div style="padding:.25rem .35rem; font-weight:600; color:#000">
              ${name}
            </div>
          `
        })
        .onPolygonHover((d: CountryFeature | null) => {
          hover = d
          globe.polygonAltitude(globe.polygonAltitude())
        })
        .onPolygonClick((d: CountryFeature) => {
          const name = getName(d)
          if (selected.has(name)) selected.delete(name); else selected.add(name)
          globe.polygonCapColor(globe.polygonCapColor())
          refreshSelectedState()
        })
    }
    async function loadProvider(p: Provider){
      if (cacheRef.current[p.id]){
        features = cacheRef.current[p.id]
        applyStyles()
        setActiveProviderLabel(p.label)
        return
      }
      try{
        const res = await fetch(p.url)
        if (!res.ok) throw new Error('fetch failed')
        const gj = await res.json()
        const fs = (gj?.features ?? []) as CountryFeature[]
        cacheRef.current[p.id] = fs
        features = fs
        setActiveProviderLabel(p.label)
      }catch{
        // Fallback to modern
        const fallback = PROVIDERS[0]
        if (cacheRef.current[fallback.id]){
          features = cacheRef.current[fallback.id]
        } else {
          try{
            const res2 = await fetch(fallback.url)
            const gj2 = await res2.json()
            const fs2 = (gj2?.features ?? []) as CountryFeature[]
            cacheRef.current[fallback.id] = fs2
            features = fs2
          }catch{
            features = []
          }
        }
        setActiveProviderLabel('Modern World (fallback)')
      }
      applyStyles()
    }

    loadProvider(provider)

    function handleResize(){
      if (!containerRef.current) return
      const w = containerRef.current.clientWidth
      globe.width(w)
      globe.height(Math.min(640, Math.round(w * 0.55)))
    }
    const ro = new ResizeObserver(handleResize)
    ro.observe(containerRef.current)

    return () => {
      try { ro.disconnect() } catch {}
    }
  }, [])

  useEffect(() => {
    let features: CountryFeature[] = []
    let hover: CountryFeature | null = null
    const selected = new Set<string>()

    function getName(f: CountryFeature): string {
      const p = provider.nameProp || 'name'
      const n = (f?.properties?.[p] ?? '') as string
      return n || '—'
    }

    function refreshSelectedState(){
      setSelectedNames(Array.from(selected).sort((a,b)=> a.localeCompare(b)))
    }

    const globe = globeInstanceRef.current!

    function applyStyles(){
      globe
        .polygonsData(features.filter(f => getName(f) !== 'Antarctica'))
        .polygonAltitude((d: CountryFeature) => (d === hover ? 0.06 : 0.01))
        .polygonCapColor((d: CountryFeature) => selected.has(getName(d)) ? 'rgba(200,16,46,0.85)' : 'rgba(120,150,170,0.65)')
        .polygonSideColor(() => 'rgba(60,80,95,0.5)')
        .polygonStrokeColor(() => 'rgba(255,255,255,0.6)')
        .polygonLabel((d: CountryFeature) => {
          const name = getName(d)
          return `
            <div style="padding:.25rem .35rem; font-weight:600; color:#000">
              ${name}
            </div>
          `
        })
        .onPolygonHover((d: CountryFeature | null) => {
          hover = d
          globe.polygonAltitude(globe.polygonAltitude())
        })
        .onPolygonClick((d: CountryFeature) => {
          const name = getName(d)
          if (selected.has(name)) selected.delete(name); else selected.add(name)
          globe.polygonCapColor(globe.polygonCapColor())
          refreshSelectedState()
        })
    }

    async function loadProvider(p: Provider){
      if (cacheRef.current[p.id]){
        let fs = cacheRef.current[p.id]
        // Year filter if fields exist
        if (p.startProp && p.endProp){
          const y = year
          fs = fs.filter(f => {
            const s = Number(f.properties?.[p.startProp!] ?? -Infinity)
            const e = Number(f.properties?.[p.endProp!] ?? Infinity)
            return s <= y && y <= e
          })
        }
        features = fs
        applyStyles()
        setActiveProviderLabel(p.label)
        return
      }
      try{
        const res = await fetch(p.url)
        if (!res.ok) throw new Error('fetch failed')
        const gj = await res.json()
        let fs = (gj?.features ?? []) as CountryFeature[]
        cacheRef.current[p.id] = fs
        if (p.startProp && p.endProp){
          const y = year
          fs = fs.filter(f => {
            const s = Number(f.properties?.[p.startProp!] ?? -Infinity)
            const e = Number(f.properties?.[p.endProp!] ?? Infinity)
            return s <= y && y <= e
          })
        }
        features = fs
        setActiveProviderLabel(p.label)
      }catch{
        const fallback = PROVIDERS[0]
        if (cacheRef.current[fallback.id]){
          features = cacheRef.current[fallback.id]
        } else {
          try{
            const res2 = await fetch(fallback.url)
            const gj2 = await res2.json()
            features = (gj2?.features ?? []) as CountryFeature[]
            cacheRef.current[fallback.id] = features
          }catch{
            features = []
          }
        }
        setActiveProviderLabel('Modern World (fallback)')
      }
      applyStyles()
    }

    loadProvider(provider)
  }, [provider, year])

  return (
    <main className="page">
      <div className="container widgets-page">
        <h1 className="h1">3D World — Select Countries</h1>

        <section className="panel" style={{ overflow: 'hidden' }}>
          <div ref={containerRef} style={{ width: '100%', minHeight: 360 }} />
        </section>

        <section className="panel">
          <div className="grid gap-md" style={{ alignItems: 'center', gridTemplateColumns: '1fr auto' }}>
            <div>
              <div className="eyebrow">Year</div>
              <input
                className="range"
                type="range"
                min={-500}
                max={2020}
                step={1}
                value={year}
                onChange={(e)=> setYear(Number(e.target.value))}
              />
              <div className="muted">{year}</div>
            </div>
            <div className="badge badge--neutral">Map: {activeProviderLabel}</div>
          </div>
        </section>

        <section className="panel">
          <div className="eyebrow">Timeframe Legend</div>
          <ul className="list-plain" style={{ margin: 0 }}>
            <li><span className="badge badge--neutral" style={{ marginRight: '.5rem' }}>Pre‑1886</span> Modern baseline (fallback until historical dataset is loaded)</li>
            <li><span className="badge badge--neutral" style={{ marginRight: '.5rem' }}>1886–2019</span> Historical borders (CShapes) — will auto‑switch; currently falls back if unavailable</li>
            <li><span className="badge badge--neutral" style={{ marginRight: '.5rem' }}>2020+</span> Modern baseline</li>
          </ul>
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


