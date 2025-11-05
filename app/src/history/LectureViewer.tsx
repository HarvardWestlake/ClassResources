import { useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeInstance } from 'globe.gl'

// GeoJSON feature for country polygons (for modern globe backdrop)
type CountryFeature = {
  type: 'Feature'
  id?: string | number
  properties: { name?: string; NAME?: string; __circle?: boolean; __circleColor?: string; [k: string]: unknown }
  geometry: { type: string; coordinates: any }
}

const MODERN_URL = '/static/data/history/world_modern.geojson'

type ImportMedia = { imageDataUrl?: string; imageUrl?: string; caption?: string }
type ImportPoint = { id?: string; type: 'point'; title?: string; dateStart?: string; dateEnd?: string; color?: string; description?: string; impactKm?: number; importance?: 'major' | 'minor'; location?: { lat: number; lon: number }; media?: ImportMedia }
type ImportPath = { id?: string; type: 'path'; title?: string; dateStart?: string; dateEnd?: string; color?: string; description?: string; impactKm?: number; importance?: 'major' | 'minor'; start?: { lat: number; lon: number }; end?: { lat: number; lon: number }; media?: ImportMedia }
type ImportEntry = ImportPoint | ImportPath
type StoryImport = {
  version: 'story/v1'
  meta?: { title?: string; exportedAt?: string }
  settings?: { impactUnit?: 'km' }
  timeline?: Record<string, Array<ImportEntry>>
  links?: Array<{ id?: string; fromId: string; toId: string; importance: 'major' | 'minor'; color?: string }>
}

type LectureEvent = {
  id: string
  type: 'point' | 'path'
  title: string
  dateStart: string
  dateEnd?: string
  dateMs: number
  color: string
  description: string
  importance: 'major' | 'minor'
  media?: ImportMedia
  location?: { lat: number; lon: number }
  start?: { lat: number; lon: number }
  end?: { lat: number; lon: number }
}

function parseIsoDateMs(s: string): number {
  if (!s) return NaN
  // Support extended years including BCE like -3300-01-01
  const m = s.match(/^(-?\d{1,6})-(\d{2})-(\d{2})$/)
  if (!m) return NaN
  const year = Number(m[1])
  const month = Number(m[2]) - 1
  const day = Number(m[3])
  return Date.UTC(year, month, day)
}

function monthName(m: number): string { return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Math.max(0, Math.min(11, m))] }
function formatYear(y: number): string { return y < 0 ? `${Math.abs(y)} BCE` : String(y) }
function formatDisplayDate(s: string, e?: string): string {
  const sm = s.match(/^(-?\d{1,6})-(\d{2})-(\d{2})$/)
  if (!sm) return s
  const sy = Number(sm[1]); const smi = Math.max(1, Math.min(12, Number(sm[2]))) - 1
  const start = `${formatYear(sy)}, ${monthName(smi)}`
  if (!e || e === s) return start
  const em = e.match(/^(-?\d{1,6})-(\d{2})-(\d{2})$/)
  if (!em) return start
  const ey = Number(em[1]); const emi = Math.max(1, Math.min(12, Number(em[2]))) - 1
  if (ey === sy) return `${formatYear(sy)}, ${monthName(smi)} — ${monthName(emi)}`
  return `${formatYear(sy)}, ${monthName(smi)} — ${formatYear(ey)}, ${monthName(emi)}`
}

export default function LectureViewer() {
  const [storyTitle, setStoryTitle] = useState<string>('Lecture of the Day')
  const [events, setEvents] = useState<LectureEvent[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [showMinor, setShowMinor] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  const globeRef = useRef<HTMLDivElement | null>(null)
  const globeInstanceRef = useRef<GlobeInstance | null>(null)
  const countriesCacheRef = useRef<CountryFeature[] | null>(null)
  const countriesRef = useRef<CountryFeature[]>([])

  const ordered = useMemo(() => {
    return events.slice().sort((a, b) => (a.dateMs - b.dateMs) || a.title.localeCompare(b.title))
  }, [events])

  const visible = useMemo(() => ordered.filter(e => showMinor ? true : e.importance === 'major'), [ordered, showMinor])

  // Timeline span can be derived on-demand if needed

  const selected = useMemo(() => ordered.find(e => e.id === selectedId) || null, [ordered, selectedId])

  useEffect(() => {
    if (!selected && ordered.length > 0) setSelectedId(ordered[0].id)
  }, [ordered, selected])

  function handleImportFile(file: File) {
    setError('')
    file.text().then(text => {
      const json = JSON.parse(text) as StoryImport
      const title = json?.meta?.title || 'Lecture of the Day'
      const timeline = json?.timeline || {}
      const flat: LectureEvent[] = []
      for (const [dateKey, arr] of Object.entries(timeline)) {
        for (const raw of arr) {
          const base: Omit<LectureEvent, 'type' | 'location' | 'start' | 'end'> = {
            id: String((raw as any).id || `${dateKey}-${Math.random().toString(36).slice(2, 8)}`),
            title: raw.title || '(untitled)',
            dateStart: raw.dateStart || dateKey,
            dateEnd: raw.dateEnd,
            dateMs: parseIsoDateMs(raw.dateStart || dateKey),
            color: raw.color || '#e53935',
            description: raw.description || '',
            importance: (raw as any).importance === 'major' ? 'major' : 'minor',
            media: raw.media
          }
          if (raw.type === 'point' && raw.location) {
            flat.push({ ...base, type: 'point', location: { lat: Number(raw.location.lat), lon: Number(raw.location.lon) } })
          } else if (raw.type === 'path' && raw.start && raw.end) {
            flat.push({ ...base, type: 'path', start: { lat: Number(raw.start.lat), lon: Number(raw.start.lon) }, end: { lat: Number(raw.end.lat), lon: Number(raw.end.lon) } })
          }
        }
      }
      if (!flat.length) throw new Error('No events found in JSON')
      setStoryTitle(title)
      setEvents(flat)
    }).catch(err => {
      setError(String((err as Error)?.message || err))
    })
  }


  // Initialize globe
  useEffect(() => {
    if (!globeRef.current) return
    if (!globeInstanceRef.current) {
      globeInstanceRef.current = new Globe(globeRef.current, { animateIn: true })
        .backgroundColor('#f2f0ec')
        .showGraticules(true)
        .showAtmosphere(true)
        .atmosphereColor('#9cc3e5')
        .atmosphereAltitude(0.18)
        .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
        .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
        .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png')
        .width(640)
        .height(360)
    }

    const globe = globeInstanceRef.current
    function applyPolygons(features: CountryFeature[]) {
      globe
        .polygonsData(features.filter(f => (f.properties?.NAME || f.properties?.name) !== 'Antarctica'))
        .polygonAltitude(() => 0.01 as any)
        .polygonCapColor(() => 'rgba(120,150,170,0.65)' as any)
        .polygonSideColor(() => 'rgba(60,80,95,0.5)' as any)
        .polygonStrokeColor(() => 'rgba(255,255,255,0.6)' as any)
        .polygonsTransitionDuration(0)
    }
    async function loadModern() {
      if (countriesCacheRef.current) {
        countriesRef.current = countriesCacheRef.current
        applyPolygons(countriesRef.current)
        return
      }
      try {
        const res = await fetch(MODERN_URL)
        const gj = await res.json()
        const fs = (gj?.features ?? []) as CountryFeature[]
        countriesCacheRef.current = fs
        countriesRef.current = fs
        applyPolygons(fs)
      } catch {
        countriesRef.current = []
      }
    }
    function handleResize() {
      if (!globeRef.current) return
      const rect = globeRef.current.getBoundingClientRect()
      const w = Math.max(320, Math.round(rect.width || globeRef.current.clientWidth || 640))
      const h = Math.max(260, Math.min(460, Math.round(w * 0.55)))
      globe.width(w)
      globe.height(h)
    }
    // Resize now and on next frame to catch late layout
    handleResize()
    requestAnimationFrame(handleResize)
    const ro = new ResizeObserver(handleResize)
    ro.observe(globeRef.current)
    loadModern()
    return () => { try { ro.disconnect() } catch {} }
  }, [])

  // Update globe visuals on selection
  useEffect(() => {
    const globe = globeInstanceRef.current
    if (!globe) return
    const sel = events.find(e => e.id === selectedId)

    const kmToDeg = (km: number) => km / 111
    function ringForPoint(lat: number, lon: number, impactKm: number, color: string) {
      const maxRadiusDeg = Math.max(0.05, kmToDeg(Math.max(impactKm || 100, 10)))
      const repeatMs = 2000
      const speedDegPerSec = maxRadiusDeg / (repeatMs / 1000)
      return [{ lat, lng: lon, color, maxRadiusDeg, repeatMs, speedDegPerSec, altitude: 0.004 }]
    }

    // Reset
    globe.ringsData([])
    globe.arcsData([])

    if (!sel) return
    if (sel.type === 'point' && sel.location) {
      const rings = ringForPoint(sel.location.lat, sel.location.lon, Math.max(100, sel.title.length > 0 ? sel.title.length : 100), sel.color)
      globe
        .ringsData(rings)
        .ringColor('color' as any)
        .ringMaxRadius('maxRadiusDeg' as any)
        .ringPropagationSpeed('speedDegPerSec' as any)
        .ringRepeatPeriod('repeatMs' as any)
        .ringAltitude('altitude' as any)
      // Fly camera to point
      globe.pointOfView({ lat: sel.location.lat, lng: sel.location.lon, altitude: 1.25 }, 1200)
    } else if (sel.type === 'path' && sel.start && sel.end) {
      const strokePx = Math.max(2, Math.round((sel.title.length || 20) / 8))
      globe
        .arcsData([{ id: `arc-${sel.id}`, startLat: sel.start.lat, startLng: sel.start.lon, endLat: sel.end.lat, endLng: sel.end.lon, color: sel.color, strokePx, animMs: 2000, altitude: 0.12, initialGap: Math.random() }])
        .arcStartLat('startLat' as any)
        .arcStartLng('startLng' as any)
        .arcEndLat('endLat' as any)
        .arcEndLng('endLng' as any)
        .arcColor('color' as any)
        .arcAltitude('altitude' as any)
        .arcStroke('strokePx' as any)
        .arcDashLength(() => 0.25 as any)
        .arcDashGap(() => 0.9 as any)
        .arcDashInitialGap('initialGap' as any)
        .arcDashAnimateTime('animMs' as any)
        .arcsTransitionDuration(0)
      // Endpoint rings
      const startRings = ringForPoint(sel.start.lat, sel.start.lon, 120, sel.color)
      const endRings = ringForPoint(sel.end.lat, sel.end.lon, 120, sel.color)
      globe
        .ringsData([...startRings, ...endRings])
        .ringColor('color' as any)
        .ringMaxRadius('maxRadiusDeg' as any)
        .ringPropagationSpeed('speedDegPerSec' as any)
        .ringRepeatPeriod('repeatMs' as any)
        .ringAltitude('altitude' as any)
      // Fly camera to midpoint
      const midLat = (sel.start.lat + sel.end.lat) / 2
      const midLng = (sel.start.lon + sel.end.lon) / 2
      globe.pointOfView({ lat: midLat, lng: midLng, altitude: 1.5 }, 1200)
    }
  }, [selectedId, events])

  function selectPrev() {
    if (visible.length === 0) return
    const idx = visible.findIndex(e => e.id === selectedId)
    const nextIdx = Math.max(0, idx <= 0 ? 0 : idx - 1)
    setSelectedId(visible[nextIdx].id)
  }

  function selectNext() {
    if (visible.length === 0) return
    const idx = visible.findIndex(e => e.id === selectedId)
    const nextIdx = Math.min(visible.length - 1, idx < 0 ? 0 : idx + 1)
    setSelectedId(visible[nextIdx].id)
  }

  return (
    <main className="page">
      <div className="container widgets-page">
        <h1 className="h1">Lecture of the Day</h1>

        <section className="panel">
          <div className="grid" style={{ gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <strong>{storyTitle}</strong>
              <label style={{ display: 'flex', gap: '.35rem', alignItems: 'center' }}>
                <span className="muted">Upload JSON</span>
                <input type="file" accept="application/json" onChange={(e)=>{ const f=e.target.files?.[0]; if (f) handleImportFile(f) }} />
              </label>
              <label style={{ display: 'flex', gap: '.35rem', alignItems: 'center' }}>
                <input type="checkbox" checked={showMinor} onChange={(e)=> setShowMinor(e.target.checked)} />
                <span className="muted">Show minor events</span>
              </label>
              {error && <span className="muted" style={{ color: '#b00020' }}>Error: {error}</span>}
            </div>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <button className="btn" onClick={selectPrev} disabled={visible.length === 0}>Prev</button>
              <button className="btn" onClick={selectNext} disabled={visible.length === 0}>Next</button>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="eyebrow">Lecture</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.2fr) 1fr', gap: '1rem', alignItems: 'start' }}>
            <div>
              <div ref={globeRef} style={{ width: '100%', minWidth: 320, minHeight: 260 }} />
              {selected && (
                <div style={{ marginTop: '1rem' }}>
                  <div className="muted">{selected.type.toUpperCase()} · {selected.importance === 'major' ? 'Major' : 'Minor'}</div>
                  <h3 style={{ margin: '.25rem 0' }}>{selected.title}</h3>
                  <div className="muted" style={{ marginBottom: '.5rem' }}>{formatDisplayDate(selected.dateStart, selected.dateEnd)}</div>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{selected.description || '—'}</p>
                  {selected.type === 'point' && selected.location && (
                    <div className="muted" style={{ marginTop: '.5rem' }}>Location: {selected.location.lat.toFixed(3)}, {selected.location.lon.toFixed(3)}</div>
                  )}
                  {selected.type === 'path' && selected.start && selected.end && (
                    <div className="muted" style={{ marginTop: '.5rem' }}>Path: {selected.start.lat.toFixed(2)},{selected.start.lon.toFixed(2)} → {selected.end.lat.toFixed(2)},{selected.end.lon.toFixed(2)}</div>
                  )}
                  <div>
                    {selected.media?.imageDataUrl && (
                      <img src={selected.media.imageDataUrl} alt={selected.media?.caption || selected.title} style={{ width: '100%', borderRadius: 8, border: '1px solid rgba(0,0,0,.15)', marginTop: '.5rem' }} />
                    )}
                    {!selected.media?.imageDataUrl && selected.media?.imageUrl && (
                      <img src={selected.media.imageUrl} alt={selected.media?.caption || selected.title} style={{ width: '100%', borderRadius: 8, border: '1px solid rgba(0,0,0,.15)', marginTop: '.5rem' }} />
                    )}
                    {(selected.media?.caption) && (
                      <div className="muted" style={{ marginTop: '.35rem' }}>{selected.media.caption}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div style={{ maxHeight: 560, overflowY: 'auto', paddingRight: '.25rem' }}>
              {visible.length === 0 ? (
                <div className="muted">Upload a story JSON to begin.</div>
              ) : (
                <ul className="list-plain" style={{ margin: 0 }}>
                  {visible.map(e => {
                    const isSel = e.id === selectedId
                    return (
                      <li key={e.id} style={{ marginBottom: '.5rem' }}>
                        <button
                          className="btn btn--outline lecture-card"
                          onClick={()=> setSelectedId(e.id)}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left',
                            background: isSel ? '#1976d2' : '#ffffff',
                            color: isSel ? '#fff' : '#000',
                            boxShadow: isSel ? '0 2px 10px rgba(0,0,0,.15)' : 'none',
                            padding: '.75rem .9rem',
                            minHeight: 100
                          }}
                          title={e.title}
                        >
                          <div style={{ display:'flex', alignItems:'baseline', gap: '.5rem', justifyContent:'space-between' }}>
                            <div className="muted" style={{ fontSize: 'var(--step-0)' }}>{formatDisplayDate(e.dateStart, e.dateEnd)}</div>
                            <div className="muted" style={{ fontSize: 'var(--step--1)', padding: '.1rem .5rem', border: '1px solid rgba(0,0,0,.2)' }}>{e.importance === 'major' ? 'Major' : 'Minor'}</div>
                          </div>
                          <div className="lecture-card__title" style={{ fontWeight: 800, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 'var(--step-1)' }}>{e.title}</div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}


