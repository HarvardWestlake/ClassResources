import { useEffect, useRef, useState } from 'react'
import Globe, { type GlobeInstance } from 'globe.gl'

// GeoJSON feature for country polygons
type CountryFeature = {
  type: 'Feature'
  id?: string | number
  properties: { name?: string; NAME?: string; __circle?: boolean; __circleColor?: string; [k: string]: unknown }
  geometry: { type: string; coordinates: any }
}

type CircleSpec = {
  id: string
  lat: number
  lng: number
  radiusKm: number
  thicknessKm: number
  color: string
  animate: boolean
}

type ArrowSpec = {
  id: string
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  color: string
  strokePx: number
  animMs: number
  altitude?: number
  initialGap?: number
  dashLength?: number
  dashGap?: number
}

type RingItem = {
  lat: number
  lng: number
  color: string
  maxRadiusDeg: number
  repeatMs: number
  speedDegPerSec: number
  altitude: number
}

const MODERN_URL = '/static/data/history/world_modern.geojson'
const EARTH_RADIUS_KM = 6371

export default function WorldGlobe() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const globeInstanceRef = useRef<GlobeInstance | null>(null)
  const countriesCacheRef = useRef<CountryFeature[] | null>(null)
  const countriesRef = useRef<CountryFeature[]>([])
  const circleFeaturesRef = useRef<CountryFeature[]>([])
  const ringItemsRef = useRef<RingItem[]>([])
  const reapplyRef = useRef<() => void>(() => {})

  const [selectedNames, setSelectedNames] = useState<string[]>([])

  // Circles state + form inputs
  const [circles, setCircles] = useState<CircleSpec[]>([])
  const [latInput, setLatInput] = useState<string>('0')
  const [lngInput, setLngInput] = useState<string>('0')
  const [radiusInput, setRadiusInput] = useState<string>('250') // km (smaller by default)
  const [thicknessInput, setThicknessInput] = useState<string>('100') // km (thicker by default)
  const [colorInput, setColorInput] = useState<string>('#e53935')
  const [animateInput, setAnimateInput] = useState<boolean>(true)

  // Arrows state + form inputs
  const [arrows, setArrows] = useState<ArrowSpec[]>([])
  const arrowsRef = useRef<ArrowSpec[]>([])
  const [aStartLat, setAStartLat] = useState<string>('0')
  const [aStartLng, setAStartLng] = useState<string>('0')
  const [aEndLat, setAEndLat] = useState<string>('0')
  const [aEndLng, setAEndLng] = useState<string>('0')
  const [aStrokePx, setAStrokePx] = useState<string>('8')
  const [aColor, setAColor] = useState<string>('#1976d2')
  const [aAnimMs, setAAnimMs] = useState<string>('2000')

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

    let hover: CountryFeature | null = null
    const selected = new Set<string>()

    function isCircleFeature(f: CountryFeature): boolean {
      return Boolean((f?.properties ?? {})['__circle'])
    }

    function getName(f: CountryFeature): string {
      if (isCircleFeature(f)) return ''
      const props = (f?.properties ?? {}) as Record<string, unknown>
      const n1 = (props['name'] ?? '') as string
      const n2 = (props['NAME'] ?? '') as string
      const n = n1 || n2
      return n || '—'
    }

    function refreshSelectedState() {
      setSelectedNames(Array.from(selected).sort((a, b) => a.localeCompare(b)))
    }

    function allFeatures(): CountryFeature[] {
      return [
        ...(countriesRef.current || []),
        ...(circleFeaturesRef.current || [])
      ]
    }

    function hexToRgba(hex: string | undefined, alpha: number): string {
      if (!hex || typeof hex !== 'string') return `rgba(200,16,46,${alpha})`
      const m = hex.trim().match(/^#?([\da-fA-F]{6})$/)
      if (!m) return `rgba(200,16,46,${alpha})`
      const int = parseInt(m[1], 16)
      const r = (int >> 16) & 255
      const g = (int >> 8) & 255
      const b = int & 255
      return `rgba(${r},${g},${b},${alpha})`
    }

    function applyPolygons() {
      const features = allFeatures().filter(f => getName(f) !== 'Antarctica')
      globe
        .polygonsData(features)
        .polygonAltitude((d) => {
          const f = d as CountryFeature
          if (isCircleFeature(f)) return 0.004
          return (d === hover ? 0.06 : 0.01)
        })
        .polygonCapColor((d) => {
          const f = d as CountryFeature
          if (isCircleFeature(f)) return hexToRgba(f.properties?.__circleColor as string, 0.5)
          return selected.has(getName(f)) ? 'rgba(200,16,46,0.85)' : 'rgba(120,150,170,0.65)'
        })
        .polygonSideColor((d) => {
          const f = d as CountryFeature
          if (isCircleFeature(f)) return hexToRgba(f.properties?.__circleColor as string, 0.3)
          return 'rgba(60,80,95,0.5)'
        })
        .polygonStrokeColor((d) => {
          const f = d as CountryFeature
          if (isCircleFeature(f)) return (f.properties?.__circleColor as string) || 'rgba(200,16,46,0.85)'
          return 'rgba(255,255,255,0.6)'
        })
        .polygonsTransitionDuration(0)
        .polygonLabel((d) => {
          const f = d as CountryFeature
          if (isCircleFeature(f)) return ''
          const name = getName(f)
          return `
            <div style="padding:.25rem .35rem; font-weight:600; color:#000">
              ${name}
            </div>
          `
        })
        .onPolygonHover((d) => {
          const f = d as CountryFeature | null
          if (!f || isCircleFeature(f)) return
          hover = f
          globe.polygonAltitude(globe.polygonAltitude())
        })
        .onPolygonClick((d) => {
          const f = d as CountryFeature
          if (isCircleFeature(f)) return
          const name = getName(f)
          if (selected.has(name)) selected.delete(name); else selected.add(name)
          globe.polygonCapColor(globe.polygonCapColor())
          refreshSelectedState()
        })
    }

    function applyArcs() {
      const src = arrowsRef.current || []
      const render = src.flatMap(a => {
        const altitude = a.altitude ?? 0.12
        const base: ArrowSpec = {
          ...a,
          altitude,
          animMs: 0,
          initialGap: 0,
          dashLength: 1,
          dashGap: 0,
          strokePx: a.strokePx
        }
        const overlay: ArrowSpec = {
          ...a,
          altitude,
          animMs: a.animMs || 2000,
          initialGap: a.initialGap ?? Math.random(),
          dashLength: 0.25,
          dashGap: 0.9,
          strokePx: Math.max(1, Math.round(a.strokePx * 0.7))
        }
        return [base, overlay]
      })
      globe
        .arcsData(render)
        .arcsMerge(true)
        .arcStartLat('startLat' as any)
        .arcStartLng('startLng' as any)
        .arcEndLat('endLat' as any)
        .arcEndLng('endLng' as any)
        .arcColor('color' as any)
        .arcAltitude('altitude' as any)
        .arcStroke('strokePx' as any)
        .arcDashLength('dashLength' as any)
        .arcDashGap('dashGap' as any)
        .arcDashInitialGap('initialGap' as any)
        .arcDashAnimateTime('animMs' as any)
        .arcsTransitionDuration(0)
    }

    function applyRings() {
      const items = ringItemsRef.current || []
      globe
        .ringsData(items)
        .ringColor('color' as any)
        .ringMaxRadius('maxRadiusDeg' as any)
        .ringPropagationSpeed('speedDegPerSec' as any)
        .ringRepeatPeriod('repeatMs' as any)
        .ringAltitude('altitude' as any)
    }

    function reapplyAll(){
      applyPolygons()
      applyArcs()
      applyRings()
    }

    reapplyRef.current = reapplyAll

    async function loadModern() {
      if (countriesCacheRef.current) {
        countriesRef.current = countriesCacheRef.current
        reapplyAll()
        return
      }
      try {
        const res = await fetch(MODERN_URL)
        const gj = await res.json()
        const fs = (gj?.features ?? []) as CountryFeature[]
        countriesCacheRef.current = fs
        countriesRef.current = fs
      } catch {
        countriesRef.current = []
      }
      reapplyAll()
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

  // Build a geodesic ring for a given radius (static polygons only)
  function computeRing(lat: number, lng: number, radiusKm: number, segments = 64): [number, number][] {
    const toRad = (deg: number) => deg * Math.PI / 180
    const toDeg = (rad: number) => rad * 180 / Math.PI

    const φ1 = toRad(lat)
    const λ1 = toRad(lng)
    const δ = Math.max(radiusKm, 0.001) / EARTH_RADIUS_KM // angular distance

    const ring: [number, number][] = [] // [lon, lat]
    for (let i = 0; i < segments; i++) {
      const bearingDeg = (i / segments) * 360
      const θ = toRad(bearingDeg)

      const sinφ1 = Math.sin(φ1)
      const cosφ1 = Math.cos(φ1)
      const sinδ = Math.sin(δ)
      const cosδ = Math.cos(δ)

      const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ)
      const φ2 = Math.asin(Math.min(1, Math.max(-1, sinφ2)))

      const y = Math.sin(θ) * sinδ * cosφ1
      const x = cosδ - sinφ1 * Math.sin(φ2)
      let λ2 = λ1 + Math.atan2(y, x)

      // normalize to [-π, π]
      λ2 = ((λ2 + Math.PI) % (2 * Math.PI)) - Math.PI

      const lat2 = toDeg(φ2)
      const lon2 = toDeg(λ2)
      ring.push([lon2, lat2])
    }
    if (ring.length) ring.push(ring[0])
    return ring
  }

  // Create a donut polygon (ring) around (lat,lng) with outer radius and thickness (static)
  function makeCircleFeature(lat: number, lng: number, radiusKm: number, color: string, thicknessKm: number, segments = 64): CountryFeature {
    const outer = computeRing(lat, lng, Math.max(radiusKm, 0.001), segments)
    const innerRadius = Math.max(radiusKm - Math.max(thicknessKm, 0), 0.001)
    let inner = computeRing(lat, lng, innerRadius, segments)
    // Reverse inner ring for hole winding
    inner = [...inner].reverse()

    return {
      type: 'Feature',
      properties: { __circle: true, __circleColor: color },
      geometry: {
        type: 'Polygon',
        coordinates: [outer, inner]
      }
    }
  }

  // Static circles rebuild (only non-animated remain as polygons)
  useEffect(() => {
    const staticCircles = circles.filter(c => !c.animate)
    circleFeaturesRef.current = staticCircles.map(c => makeCircleFeature(c.lat, c.lng, c.radiusKm, c.color, c.thicknessKm))
    reapplyRef.current()
  }, [circles])

  // Animated circles -> GPU rings
  useEffect(() => {
    const toDeg = (km: number) => km / 111 // approx degrees per km
    const items: RingItem[] = circles
      .filter(c => c.animate)
      .map(c => {
        const maxRadiusDeg = Math.max(0.05, toDeg(c.radiusKm))
        const repeatMs = 2000 // default 2s loop
        const speedDegPerSec = maxRadiusDeg / (repeatMs / 1000)
        return {
          lat: c.lat,
          lng: c.lng,
          color: c.color,
          maxRadiusDeg,
          repeatMs,
          speedDegPerSec,
          altitude: 0.004
        }
      })
    ringItemsRef.current = items
    reapplyRef.current()
  }, [circles])

  // Keep arrows ref in sync and reapply arcs when arrows change
  useEffect(() => {
    arrowsRef.current = arrows
    reapplyRef.current()
  }, [arrows])

  function handleAddCircle() {
    const lat = Number(latInput)
    const lng = Number(lngInput)
    const radiusKm = Number(radiusInput)
    const thicknessKm = Number(thicknessInput)
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radiusKm) || !Number.isFinite(thicknessKm)) return
    const id = `${lat.toFixed(4)},${lng.toFixed(4)}@${Date.now()}`
    setCircles(arr => [...arr, { id, lat, lng, radiusKm, thicknessKm, color: colorInput || '#e53935', animate: animateInput }])
  }

  function handleRemoveCircle(id: string) {
    setCircles(arr => arr.filter(c => c.id !== id))
  }

  function handleToggleAnimate(id: string) {
    setCircles(arr => arr.map(c => c.id === id ? { ...c, animate: !c.animate } : c))
  }

  function handleAddArrow() {
    const startLat = Number(aStartLat)
    const startLng = Number(aStartLng)
    const endLat = Number(aEndLat)
    const endLng = Number(aEndLng)
    const strokePx = Number(aStrokePx)
    const animMs = Number(aAnimMs)
    if (![startLat, startLng, endLat, endLng, strokePx, animMs].every(Number.isFinite)) return
    const id = `${startLat.toFixed(4)},${startLng.toFixed(4)}->${endLat.toFixed(4)},${endLng.toFixed(4)}@${Date.now()}`
    setArrows(arr => [...arr, { id, startLat, startLng, endLat, endLng, color: aColor || '#1976d2', strokePx: Math.max(1, strokePx), animMs: Math.max(200, animMs), altitude: 0.12, initialGap: Math.random() }])
  }

  function handleRemoveArrow(id: string) {
    setArrows(arr => arr.filter(a => a.id !== id))
  }

  return (
    <main className="page">
      <div className="container widgets-page">
        <h1 className="h1">3D World — Modern (Small)</h1>

        <section className="panel" style={{ overflow: 'hidden' }}>
          <div ref={containerRef} style={{ width: '100%', minHeight: 260 }} />
        </section>

        <section className="panel">
          <div className="eyebrow">Add Circle</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '.5rem', alignItems: 'end' }}>
            <label>
              <div className="muted">Latitude</div>
              <input type="number" step={0.0001} value={latInput} onChange={(e)=> setLatInput(e.target.value)} />
            </label>
            <label>
              <div className="muted">Longitude</div>
              <input type="number" step={0.0001} value={lngInput} onChange={(e)=> setLngInput(e.target.value)} />
            </label>
            <label>
              <div className="muted">Radius (km)</div>
              <input type="number" step={1} value={radiusInput} onChange={(e)=> setRadiusInput(e.target.value)} />
            </label>
            <label>
              <div className="muted">Thickness (km)</div>
              <input type="number" step={1} value={thicknessInput} onChange={(e)=> setThicknessInput(e.target.value)} />
            </label>
            <label style={{ display:'flex', gap:'.4rem', alignItems:'center' }}>
              <input type="checkbox" checked={animateInput} onChange={(e)=> setAnimateInput(e.target.checked)} />
              <span className="muted">Animate</span>
            </label>
            <label>
              <div className="muted">Color</div>
              <input type="color" value={colorInput} onChange={(e)=> setColorInput(e.target.value)} />
            </label>
            <div>
              <button className="btn" onClick={handleAddCircle}>Add Circle</button>
            </div>
          </div>
        </section>

        {circles.length > 0 && (
          <section className="panel">
            <div className="eyebrow">Circles</div>
            <ul className="list-plain" style={{ margin: 0 }}>
              {circles.map(c => (
                <li key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: c.color, border: '1px solid rgba(0,0,0,.2)' }} />
                    <span className="muted">{c.lat.toFixed(4)}, {c.lng.toFixed(4)} · r {c.radiusKm} km · w {c.thicknessKm} km · {c.animate ? 'animated' : 'static'}</span>
                    <label style={{ display:'flex', gap:'.35rem', alignItems:'center' }}>
                      <input type="checkbox" checked={c.animate} onChange={()=> handleToggleAnimate(c.id)} />
                      <span className="muted">Animate</span>
                    </label>
                  </div>
                  <button className="btn" onClick={()=> handleRemoveCircle(c.id)}>Remove</button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="panel">
          <div className="eyebrow">Add Arrow</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '.5rem', alignItems: 'end' }}>
            <label>
              <div className="muted">Start Lat</div>
              <input type="number" step={0.0001} value={aStartLat} onChange={(e)=> setAStartLat(e.target.value)} />
            </label>
            <label>
              <div className="muted">Start Lon</div>
              <input type="number" step={0.0001} value={aStartLng} onChange={(e)=> setAStartLng(e.target.value)} />
            </label>
            <label>
              <div className="muted">End Lat</div>
              <input type="number" step={0.0001} value={aEndLat} onChange={(e)=> setAEndLat(e.target.value)} />
            </label>
            <label>
              <div className="muted">End Lon</div>
              <input type="number" step={0.0001} value={aEndLng} onChange={(e)=> setAEndLng(e.target.value)} />
            </label>
            <label>
              <div className="muted">Width (px)</div>
              <input type="number" step={1} value={aStrokePx} onChange={(e)=> setAStrokePx(e.target.value)} />
            </label>
            <label>
              <div className="muted">Loop (ms)</div>
              <input type="number" step={100} value={aAnimMs} onChange={(e)=> setAAnimMs(e.target.value)} />
            </label>
            <label>
              <div className="muted">Color</div>
              <input type="color" value={aColor} onChange={(e)=> setAColor(e.target.value)} />
            </label>
            <div>
              <button className="btn" onClick={handleAddArrow}>Add Arrow</button>
            </div>
          </div>
        </section>

        {arrows.length > 0 && (
          <section className="panel">
            <div className="eyebrow">Arrows</div>
            <ul className="list-plain" style={{ margin: 0 }}>
              {arrows.map(a => (
                <li key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: a.color, border: '1px solid rgba(0,0,0,.2)' }} />
                    <span className="muted">{a.startLat.toFixed(2)},{a.startLng.toFixed(2)} → {a.endLat.toFixed(2)},{a.endLng.toFixed(2)} · {a.strokePx}px · {a.animMs}ms</span>
                  </div>
                  <button className="btn" onClick={()=> handleRemoveArrow(a.id)}>Remove</button>
                </li>
              ))}
            </ul>
          </section>
        )}

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


