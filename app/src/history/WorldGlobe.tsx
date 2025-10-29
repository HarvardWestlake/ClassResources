import { useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeInstance } from 'globe.gl'

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

type RangePreset = {
  id: string
  label: string
  min: number
  max: number
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
    nameProp: 'cntry_name',
    startProp: 'gwsyear',
    endProp: 'gweyear'
  }
]

// HB snapshots (BCE as negative years)
const HB_SNAPSHOTS: { year: number; file: string }[] = [
  // BCE
  { year: -123000, file: 'world_bc123000.geojson' },
  { year: -10000, file: 'world_bc10000.geojson' },
  { year: -8000, file: 'world_bc8000.geojson' },
  { year: -5000, file: 'world_bc5000.geojson' },
  { year: -4000, file: 'world_bc4000.geojson' },
  { year: -3000, file: 'world_bc3000.geojson' },
  { year: -2000, file: 'world_bc2000.geojson' },
  { year: -1500, file: 'world_bc1500.geojson' },
  { year: -1000, file: 'world_bc1000.geojson' },
  { year: -700, file: 'world_bc700.geojson' },
  { year: -500, file: 'world_bc500.geojson' },
  { year: -400, file: 'world_bc400.geojson' },
  { year: -323, file: 'world_bc323.geojson' },
  { year: -300, file: 'world_bc300.geojson' },
  { year: -200, file: 'world_bc200.geojson' },
  { year: -100, file: 'world_bc100.geojson' },
  { year: -1, file: 'world_bc1.geojson' },
  // CE
  { year: 100, file: 'world_100.geojson' },
  { year: 200, file: 'world_200.geojson' },
  { year: 300, file: 'world_300.geojson' },
  { year: 400, file: 'world_400.geojson' },
  { year: 500, file: 'world_500.geojson' },
  { year: 600, file: 'world_600.geojson' },
  { year: 700, file: 'world_700.geojson' },
  { year: 800, file: 'world_800.geojson' },
  { year: 900, file: 'world_900.geojson' },
  { year: 1000, file: 'world_1000.geojson' },
  { year: 1100, file: 'world_1100.geojson' },
  { year: 1200, file: 'world_1200.geojson' },
  { year: 1279, file: 'world_1279.geojson' },
  { year: 1300, file: 'world_1300.geojson' },
  { year: 1400, file: 'world_1400.geojson' },
  { year: 1492, file: 'world_1492.geojson' },
  { year: 1500, file: 'world_1500.geojson' },
  { year: 1530, file: 'world_1530.geojson' },
  { year: 1600, file: 'world_1600.geojson' },
  { year: 1650, file: 'world_1650.geojson' },
  { year: 1700, file: 'world_1700.geojson' },
  { year: 1715, file: 'world_1715.geojson' },
  { year: 1783, file: 'world_1783.geojson' },
  { year: 1800, file: 'world_1800.geojson' },
  { year: 1815, file: 'world_1815.geojson' },
  { year: 1880, file: 'world_1880.geojson' },
  // extras (still usable when outside cshapes window)
  { year: 1900, file: 'world_1900.geojson' },
  { year: 1914, file: 'world_1914.geojson' },
  { year: 1920, file: 'world_1920.geojson' },
  { year: 1930, file: 'world_1930.geojson' },
  { year: 1938, file: 'world_1938.geojson' },
  { year: 1945, file: 'world_1945.geojson' },
  { year: 1960, file: 'world_1960.geojson' },
  { year: 1994, file: 'world_1994.geojson' },
  { year: 2000, file: 'world_2000.geojson' },
  { year: 2010, file: 'world_2010.geojson' }
].sort((a,b) => a.year - b.year)

// Helper: find last snapshot index at or before a given year (avoid Array.prototype.findLastIndex for older TS libs)
function findLastSnapshotIndexAtOrBefore(targetYear: number): number {
  for (let i = HB_SNAPSHOTS.length - 1; i >= 0; i--) {
    if (HB_SNAPSHOTS[i].year <= targetYear) return i
  }
  return -1
}

function formatYear(y: number): string {
  return y < 0 ? `${Math.abs(y)} BCE` : `${y} CE`
}

const RANGE_PRESETS: RangePreset[] = [
  { id: 'ancient2today', label: '−2000 to Today', min: -2000, max: 2020 },
  { id: 'classical-medieval', label: '−500 to 1500', min: -500, max: 1500 },
  { id: 'early-modern', label: '1500 to 1886', min: 1500, max: 1886 },
  { id: 'modern-plus', label: '1850 to Today', min: 1850, max: 2020 },
  { id: 'all', label: 'All (−123000 to 2020)', min: -123000, max: 2020 }
]

export default function WorldGlobe() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [selectedNames, setSelectedNames] = useState<string[]>([])
  const [year, setYear] = useState<number>(2020)
  const [pendingYear, setPendingYear] = useState<number>(2020)
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false)
  const [rangePresetId, setRangePresetId] = useState<string>('modern-plus')
  const [customMin, setCustomMin] = useState<number>(-2000)
  const [customMax, setCustomMax] = useState<number>(2020)
  const rangePreset = useMemo<RangePreset>(() => {
    if (rangePresetId === 'custom'){
      const min = Math.min(customMin, customMax)
      const max = Math.max(customMin, customMax)
      return { id: 'custom', label: 'Custom', min, max }
    }
    return RANGE_PRESETS.find(p => p.id === rangePresetId) || RANGE_PRESETS[0]
  }, [rangePresetId, customMin, customMax])
  const provider = useMemo<Provider>(() => {
    // Prefer CShapes within its supported window
    if (year >= 1886 && year <= 2019) return PROVIDERS[1]

    // Outside that window, select HB snapshot nearest at or before the year
    const idx = findLastSnapshotIndexAtOrBefore(year)
    const snap = idx >= 0 ? HB_SNAPSHOTS[idx] : HB_SNAPSHOTS[0]
    const label = `HB Snapshot (${formatYear(snap.year)})`
    return {
      id: `hb_${snap.year}`,
      label,
      kind: 'vector',
      url: `/static/data/history/hb/${snap.file}`,
      nameProp: 'NAME'
    }
  }, [year])
  const [activeProviderLabel, setActiveProviderLabel] = useState<string>(provider.label)

  const cacheRef = useRef<Record<string, CountryFeature[]>>({})
  const globeInstanceRef = useRef<GlobeInstance | null>(null)
  const fetchAbortRef = useRef<AbortController | null>(null)
  const requestSeqRef = useRef<number>(0)
  const prevProviderIdRef = useRef<string | null>(null)
  const filteredCacheRef = useRef<Record<string, CountryFeature[]>>({})

  // Commit helper: apply current pending year as the active year (on release)
  function commitPendingYear(){
    const clamp = (v: number) => Math.min(rangePreset.max, Math.max(rangePreset.min, v))
    const clamped = clamp(pendingYear)
    if (clamped !== pendingYear) setPendingYear(clamped)
    setYear(clamped)
  }

  // Clamp pending/committed year to the selected range preset
  useEffect(() => {
    const clamp = (v: number) => Math.min(rangePreset.max, Math.max(rangePreset.min, v))
    const clampedPending = clamp(pendingYear)
    if (clampedPending !== pendingYear) setPendingYear(clampedPending)
    if (year < rangePreset.min || year > rangePreset.max) setYear(clampedPending)
  }, [rangePreset, pendingYear, year])

  function handleCustomMinChange(v: number){
    setCustomMin(v)
  }
  function handleCustomMaxChange(v: number){
    setCustomMax(v)
  }

  // Neighbor preloading helpers
  async function preloadHBAtIndex(index: number){
    const snap = HB_SNAPSHOTS[index]
    if (!snap) return
    const id = `hb_${snap.year}`
    if (cacheRef.current[id]) return
    try{
      const res = await fetch(`/static/data/history/hb/${snap.file}`)
      if (!res.ok) return
      const gj = await res.json()
      const fs = (gj?.features ?? []) as CountryFeature[]
      cacheRef.current[id] = fs
    }catch{}
  }

  function preloadAdjacent(p: Provider, y: number){
    if (p.id.startsWith('hb_')){
      const idx = findLastSnapshotIndexAtOrBefore(y)
      preloadHBAtIndex(idx - 1)
      preloadHBAtIndex(idx + 1)
    } else if (p.startProp && p.endProp){
      const base = cacheRef.current[p.id]
      if (!base) return
      const years = [y - 1, y + 1]
      for (const yy of years){
        const key = `${p.id}:${yy}`
        if (!filteredCacheRef.current[key]){
          const arr = base.filter(f => {
            const s = Number(f.properties?.[p.startProp!] ?? -Infinity)
            const e = Number(f.properties?.[p.endProp!] ?? Infinity)
            return s <= yy && yy <= e
          })
          filteredCacheRef.current[key] = arr
        }
      }
    }
  }

  useEffect(() => {
    if (!containerRef.current) return
    if (!globeInstanceRef.current){
      globeInstanceRef.current = new Globe(containerRef.current, { animateIn: true })
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
      const props = (f?.properties ?? {}) as Record<string, unknown>
      const n1 = (props['name'] ?? '') as string
      const n2 = (props['NAME'] ?? '') as string
      const n = n1 || n2
      return n || '—'
    }

    function refreshSelectedState(){
      setSelectedNames(Array.from(selected).sort((a,b)=> a.localeCompare(b)))
    }

    function applyStyles(){
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
    async function loadProvider(p: Provider){
      if (cacheRef.current[p.id]){
        features = cacheRef.current[p.id]
        applyStyles()
        setActiveProviderLabel(p.label)
        return
      }
      try{
        // Abort any in-flight fetch when switching quickly
        try { fetchAbortRef.current?.abort() } catch {}
        const seq = ++requestSeqRef.current
        const ctrl = new AbortController()
        fetchAbortRef.current = ctrl
        const res = await fetch(p.url, { signal: ctrl.signal })
        if (!res.ok) throw new Error('fetch failed')
        const gj = await res.json()
        if (seq !== requestSeqRef.current) return // stale
        const fs = (gj?.features ?? []) as CountryFeature[]
        cacheRef.current[p.id] = fs
        features = fs
        setActiveProviderLabel(p.label)
      }catch(err){
        if ((err as any)?.name === 'AbortError') return
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

    loadProvider(provider).then(() => {
      preloadAdjacent(provider, year)
    })

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
      const props = (f?.properties ?? {}) as Record<string, unknown>
      const primary = provider.nameProp || 'name'
      const n1 = (props[primary] ?? '') as string
      const n2 = (props['name'] ?? '') as string
      const n3 = (props['NAME'] ?? '') as string
      const n = n1 || n2 || n3
      return n || '—'
    }

    function refreshSelectedState(){
      setSelectedNames(Array.from(selected).sort((a,b)=> a.localeCompare(b)))
    }

    const globe = globeInstanceRef.current!

    function applyStyles(){
      globe
        .polygonsData(features.filter(f => getName(f) !== 'Antarctica'))
        .polygonAltitude((d) => (d === hover ? 0.06 : 0.01))
        .polygonCapColor((d) => selected.has(getName(d as CountryFeature)) ? 'rgba(200,16,46,0.85)' : 'rgba(120,150,170,0.65)')
        .polygonSideColor(() => 'rgba(60,80,95,0.5)')
        .polygonStrokeColor(() => 'rgba(255,255,255,0.6)')
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

    async function loadProvider(p: Provider){
      if (cacheRef.current[p.id]){
        let fs = cacheRef.current[p.id]
        if (p.startProp && p.endProp){
          const key = `${p.id}:${year}`
          let filtered = filteredCacheRef.current[key]
          if (!filtered){
            const y = year
            filtered = fs.filter(f => {
              const s = Number(f.properties?.[p.startProp!] ?? -Infinity)
              const e = Number(f.properties?.[p.endProp!] ?? Infinity)
              return s <= y && y <= e
            })
            filteredCacheRef.current[key] = filtered
          }
          fs = filtered
        }
        features = fs
        applyStyles()
        setActiveProviderLabel(p.label)
        preloadAdjacent(p, year)
        return
      }
      try{
        const res = await fetch(p.url)
        if (!res.ok) throw new Error('fetch failed')
        const gj = await res.json()
        let fs = (gj?.features ?? []) as CountryFeature[]
        cacheRef.current[p.id] = fs
        if (p.startProp && p.endProp){
          const key = `${p.id}:${year}`
          let filtered = filteredCacheRef.current[key]
          if (!filtered){
            const y = year
            filtered = fs.filter(f => {
              const s = Number(f.properties?.[p.startProp!] ?? -Infinity)
              const e = Number(f.properties?.[p.endProp!] ?? Infinity)
              return s <= y && y <= e
            })
            filteredCacheRef.current[key] = filtered
          }
          fs = filtered
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

    const isHB = provider.id.startsWith('hb_')
    const prevId = prevProviderIdRef.current
    const providerChanged = prevId !== provider.id
    if (isHB) {
      if (providerChanged) {
        loadProvider(provider).then(() => {
          preloadAdjacent(provider, year)
        })
        prevProviderIdRef.current = provider.id
      } else {
        // No reload on year-only changes for HB; just re-apply styles from cache
        features = cacheRef.current[provider.id] ?? []
        applyStyles()
        preloadAdjacent(provider, year)
      }
    } else {
      // CShapes depends on year filtering; load every time year changes
      loadProvider(provider).then(() => {
        preloadAdjacent(provider, year)
      })
      prevProviderIdRef.current = provider.id
    }
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
              <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginBottom: '.25rem', flexWrap: 'wrap' }}>
                <label htmlFor="rangePreset" className="muted">Range</label>
                <select id="rangePreset" value={rangePresetId} onChange={(e)=> setRangePresetId(e.target.value)}>
                  {RANGE_PRESETS.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                  <option value="custom">Custom</option>
                </select>
                {rangePresetId === 'custom' && (
                  <>
                    <label htmlFor="customMin" className="muted">Min</label>
                    <input id="customMin" type="number" step={1} style={{ width: 110 }}
                      value={customMin}
                      onChange={(e)=> handleCustomMinChange(Number(e.target.value))} />
                    <label htmlFor="customMax" className="muted">Max</label>
                    <input id="customMax" type="number" step={1} style={{ width: 110 }}
                      value={customMax}
                      onChange={(e)=> handleCustomMaxChange(Number(e.target.value))} />
                  </>
                )}
              </div>
              <input
                className="range"
                type="range"
                min={rangePreset.min}
                max={rangePreset.max}
                step={1}
                value={pendingYear}
                onChange={(e)=> setPendingYear(Number(e.target.value))}
                onPointerDown={()=> setIsScrubbing(true)}
                onPointerUp={()=> { setIsScrubbing(false); commitPendingYear() }}
                onPointerCancel={()=> { setIsScrubbing(false); commitPendingYear() }}
                onKeyUp={()=> { commitPendingYear() }}
              />
              <div className="muted">{formatYear(pendingYear)}</div>
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


