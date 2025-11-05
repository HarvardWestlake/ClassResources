import { useEffect, useRef, useState } from 'react'
import Globe, { type GlobeInstance } from 'globe.gl'

// ---------------- Types ----------------

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

// Events system
type EventBase = {
  id: string
  title: string
  dateStart: string // ISO date (YYYY-MM-DD)
  dateEnd?: string // ISO date (YYYY-MM-DD)
  color: string
  description: string // plain text
  media?: { imageDataUrl?: string; imageUrl?: string; caption?: string }
  impactKm: number
  importance: 'major' | 'minor'
}

type PointEvent = EventBase & {
  type: 'point'
  location: { lat: number; lon: number }
}

type PathEvent = EventBase & {
  type: 'path'
  start: { lat: number; lon: number }
  end: { lat: number; lon: number }
}

type EventSpec = PointEvent | PathEvent

// Propagation link connecting two point events
type EventLink = {
  id: string
  fromId: string
  toId: string
  importance: 'major' | 'minor'
  color?: string
}

// Export structure keyed by date
type StoryExport = {
  version: 'story/v1'
  meta: { title: string; exportedAt: string }
  settings: { impactUnit: 'km' }
  timeline: Record<string, Array<{
    id: string
    type: 'point' | 'path'
    title: string
    dateStart: string
    dateEnd?: string
    color: string
    description: string
    impactKm: number
    importance: 'major' | 'minor'
    location?: { lat: number; lon: number }
    start?: { lat: number; lon: number }
    end?: { lat: number; lon: number }
    media?: { imageDataUrl?: string; imageUrl?: string; caption?: string }
  }>>
  links?: Array<{
    id: string
    fromId: string
    toId: string
    importance: 'major' | 'minor'
    color?: string
  }>
}

// ---------------- Constants ----------------

const MODERN_URL = '/static/data/history/world_modern.geojson'
const EARTH_RADIUS_KM = 6371

// ---------------- Component ----------------

export default function WorldGlobe() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const globeInstanceRef = useRef<GlobeInstance | null>(null)

  // Data caches/refs for globe layers
  const countriesCacheRef = useRef<CountryFeature[] | null>(null)
  const countriesRef = useRef<CountryFeature[]>([])
  const circleFeaturesRef = useRef<CountryFeature[]>([])
  const ringItemsRef = useRef<RingItem[]>([])
  const arrowsRef = useRef<ArrowSpec[]>([])
  const reapplyRef = useRef<() => void>(() => {})

  const [selectedNames, setSelectedNames] = useState<string[]>([])

  // Legacy Circle & Arrow UI (kept in teacher mode)
  const [circles, setCircles] = useState<CircleSpec[]>([])
  const [latInput, setLatInput] = useState<string>('0')
  const [lngInput, setLngInput] = useState<string>('0')
  const [radiusInput, setRadiusInput] = useState<string>('250')
  const [thicknessInput, setThicknessInput] = useState<string>('100')
  const [colorInput, setColorInput] = useState<string>('#e53935')
  const [animateInput, setAnimateInput] = useState<boolean>(true)

  const [arrowsState, setArrowsState] = useState<ArrowSpec[]>([])
  const [aStartLat, setAStartLat] = useState<string>('0')
  const [aStartLng, setAStartLng] = useState<string>('0')
  const [aEndLat, setAEndLat] = useState<string>('0')
  const [aEndLng, setAEndLng] = useState<string>('0')
  const [aStrokePx, setAStrokePx] = useState<string>('8')
  const [aColor, setAColor] = useState<string>('#1976d2')
  const [aAnimMs, setAAnimMs] = useState<string>('2000')

  // Events system state
  const [teacherMode, setTeacherMode] = useState<boolean>(true)
  const [storyTitle, setStoryTitle] = useState<string>('Untitled Story')
  const [events, setEvents] = useState<EventSpec[]>([])
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10))

  // Event form state
  const [evType, setEvType] = useState<'point' | 'path'>('point')
  const [evTitle, setEvTitle] = useState<string>('')
  const [evDateStart, setEvDateStart] = useState<string>(new Date().toISOString().slice(0, 10))
  const [evDateEnd, setEvDateEnd] = useState<string>('')
  const [evImpactKm, setEvImpactKm] = useState<string>('100')
  const [evColor, setEvColor] = useState<string>('#e53935')
  const [evDesc, setEvDesc] = useState<string>('')
  const [evImageDataUrl, setEvImageDataUrl] = useState<string>('')
  const [evLat, setEvLat] = useState<string>('0')
  const [evLon, setEvLon] = useState<string>('0')
  const [evEndLat, setEvEndLat] = useState<string>('0')
  const [evEndLon, setEvEndLon] = useState<string>('0')
  const [evImportance, setEvImportance] = useState<'major' | 'minor'>('minor')

  // Links state
  const [links, setLinks] = useState<EventLink[]>([])
  const [showMajorLinks, setShowMajorLinks] = useState<boolean>(true)
  const [showMinorLinks, setShowMinorLinks] = useState<boolean>(true)
  const [lnkFromId, setLnkFromId] = useState<string>('')
  const [lnkToId, setLnkToId] = useState<string>('')
  const [lnkImportance, setLnkImportance] = useState<'major' | 'minor'>('major')
  const [lnkColor, setLnkColor] = useState<string>('')

  // ---------------- Globe bootstrap ----------------

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
        const base: ArrowSpec = { ...a, altitude, animMs: 0, initialGap: 0, dashLength: 1, dashGap: 0, strokePx: a.strokePx }
        const overlay: ArrowSpec = { ...a, altitude, animMs: a.animMs || 2000, initialGap: a.initialGap ?? Math.random(), dashLength: 0.25, dashGap: 0.9, strokePx: Math.max(1, Math.round(a.strokePx * 0.7)) }
        return [base, overlay]
      })
      globe
        .arcsData(render)
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
      ;(globe as any).arcsMerge?.(true)
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

  // ---------------- Geometry builders ----------------

  function computeRing(lat: number, lng: number, radiusKm: number, segments = 64): [number, number][] {
    const toRad = (deg: number) => deg * Math.PI / 180
    const toDeg = (rad: number) => rad * 180 / Math.PI

    const φ1 = toRad(lat)
    const λ1 = toRad(lng)
    const δ = Math.max(radiusKm, 0.001) / EARTH_RADIUS_KM

    const ring: [number, number][] = []
    for (let i = 0; i < segments; i++) {
      const θ = toRad((i / segments) * 360)
      const sinφ1 = Math.sin(φ1), cosφ1 = Math.cos(φ1)
      const sinδ = Math.sin(δ), cosδ = Math.cos(δ)
      const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ)
      const φ2 = Math.asin(Math.min(1, Math.max(-1, sinφ2)))
      const y = Math.sin(θ) * sinδ * cosφ1
      const x = cosδ - sinφ1 * Math.sin(φ2)
      let λ2 = λ1 + Math.atan2(y, x)
      λ2 = ((λ2 + Math.PI) % (2 * Math.PI)) - Math.PI
      ring.push([toDeg(λ2), toDeg(φ2)])
    }
    if (ring.length) ring.push(ring[0])
    return ring
  }

  function makeCircleFeature(lat: number, lng: number, radiusKm: number, color: string, thicknessKm: number, segments = 64): CountryFeature {
    const outer = computeRing(lat, lng, Math.max(radiusKm, 0.001), segments)
    const innerRadius = Math.max(radiusKm - Math.max(thicknessKm, 0), 0.001)
    let inner = computeRing(lat, lng, innerRadius, segments)
    inner = [...inner].reverse()
    return { type: 'Feature', properties: { __circle: true, __circleColor: color }, geometry: { type: 'Polygon', coordinates: [outer, inner] } }
  }

  // ---------------- Utility mapping ----------------

  function kmToDeg(km: number): number { return km / 111 }
  function clamp(n: number, min: number, max: number): number { return Math.min(max, Math.max(min, n)) }
  function impactToDonutThicknessKm(impactKm: number): number { return clamp(impactKm * 0.18, 30, 600) }
  function impactToArrowStrokePx(impactKm: number): number { return clamp(Math.round(impactKm / 25), 2, 24) }

  // ---------------- Legacy Circle/Arrow UI integration ----------------

  useEffect(() => {
    const staticCircles = circles.filter(c => !c.animate)
    const circlePolys = staticCircles.map(c => makeCircleFeature(c.lat, c.lng, c.radiusKm, c.color, c.thicknessKm))
    circleFeaturesRef.current = circlePolys

    // Animated circles -> GPU rings
    const rings: RingItem[] = circles
      .filter(c => c.animate)
      .map(c => {
        const maxRadiusDeg = Math.max(0.05, kmToDeg(c.radiusKm))
        const repeatMs = 2000
        const speedDegPerSec = maxRadiusDeg / (repeatMs / 1000)
        return { lat: c.lat, lng: c.lng, color: c.color, maxRadiusDeg, repeatMs, speedDegPerSec, altitude: 0.004 }
      })

    // Merge with event-driven rings later; set for now
    ringItemsRef.current = [...rings]
    reapplyRef.current()
  }, [circles])

  useEffect(() => {
    // Merge legacy arrows into arrowsRef; events will add on top later
    arrowsRef.current = [...arrowsState]
    reapplyRef.current()
  }, [arrowsState])

  // ---------------- Events: build render layers from selected date ----------------

  useEffect(() => {
    const date = selectedDate
    const T = (s: string) => new Date(s + (s.length === 10 ? 'T00:00:00Z' : '')).getTime()

    const active = events.filter(e => {
      const t = T(date)
      const a = T(e.dateStart)
      const b = e.dateEnd ? T(e.dateEnd) : a
      return t >= a && t <= b
    })
    const activeIds = new Set(active.map(e => e.id))
    const evById = new Map(events.map(e => [e.id, e]))

    // Build donuts and rings for point events; endpoint rings + arcs for path events
    const eventDonuts: CountryFeature[] = []
    const eventRings: RingItem[] = []
    const eventArrows: ArrowSpec[] = []

    for (const e of active) {
      if (e.type === 'point') {
        const r = e.impactKm
        const thick = impactToDonutThicknessKm(r)
        eventDonuts.push(makeCircleFeature(e.location.lat, e.location.lon, r, e.color, thick))
        const maxRadiusDeg = Math.max(0.05, kmToDeg(r))
        const repeatMs = 2000
        const speedDegPerSec = maxRadiusDeg / (repeatMs / 1000)
        eventRings.push({ lat: e.location.lat, lng: e.location.lon, color: e.color, maxRadiusDeg, repeatMs, speedDegPerSec, altitude: 0.004 })
      } else {
        const strokePx = impactToArrowStrokePx(e.impactKm)
        eventArrows.push({
          id: `evt-arrow-${e.id}`,
          startLat: e.start.lat,
          startLng: e.start.lon,
          endLat: e.end.lat,
          endLng: e.end.lon,
          color: e.color,
          strokePx,
          animMs: 2000,
          altitude: 0.12,
          initialGap: Math.random()
        })
        // Endpoint rings (both ends)
        const maxRadiusDeg = Math.max(0.05, kmToDeg(e.impactKm))
        const repeatMs = 2000
        const speedDegPerSec = maxRadiusDeg / (repeatMs / 1000)
        eventRings.push({ lat: e.start.lat, lng: e.start.lon, color: e.color, maxRadiusDeg, repeatMs, speedDegPerSec, altitude: 0.004 })
        eventRings.push({ lat: e.end.lat, lng: e.end.lon, color: e.color, maxRadiusDeg, repeatMs, speedDegPerSec, altitude: 0.004 })
      }
    }

    // Build arrows from propagation links (from -> to), shown when destination is active
    for (const l of links) {
      if (l.importance === 'major' && !showMajorLinks) continue
      if (l.importance === 'minor' && !showMinorLinks) continue
      const fromEv = evById.get(l.fromId)
      const toEv = evById.get(l.toId)
      if (!fromEv || !toEv) continue
      if (fromEv.type !== 'point' || toEv.type !== 'point') continue
      if (!activeIds.has(toEv.id)) continue
      const fromImp = Number(fromEv.impactKm) || 1
      const toImp = Number(toEv.impactKm) || 1
      const strokePx = impactToArrowStrokePx((fromImp + toImp) / 2)
      eventArrows.push({
        id: `link-${l.id}`,
        startLat: fromEv.location.lat,
        startLng: fromEv.location.lon,
        endLat: toEv.location.lat,
        endLng: toEv.location.lon,
        color: l.color || fromEv.color,
        strokePx,
        animMs: 2000,
        altitude: 0.12,
        initialGap: Math.random()
      })
    }

    // Merge with legacy layers
    const legacyRings = ringItemsRef.current.slice()
    const legacyArrows = arrowsState
    const legacyDonuts = circleFeaturesRef.current.slice()

    circleFeaturesRef.current = [...legacyDonuts, ...eventDonuts]
    ringItemsRef.current = [...legacyRings, ...eventRings]
    arrowsRef.current = [...legacyArrows, ...eventArrows]

    reapplyRef.current()
  }, [events, selectedDate, arrowsState])

  // ---------------- Event helpers: import/export ----------------

  function buildExport(): StoryExport {
    const timeline: StoryExport['timeline'] = {}
    for (const e of events) {
      const key = e.dateStart
      const entry = {
        id: e.id,
        type: e.type,
        title: e.title,
        dateStart: e.dateStart,
        dateEnd: e.dateEnd,
        color: e.color,
        description: e.description,
        impactKm: e.impactKm,
        importance: e.importance,
        ...(e.type === 'point'
          ? { location: { lat: e.location.lat, lon: e.location.lon } }
          : { start: { lat: e.start.lat, lon: e.start.lon }, end: { lat: e.end.lat, lon: e.end.lon } }),
        media: e.media
      }
      if (!timeline[key]) timeline[key] = []
      timeline[key].push(entry)
    }
    return {
      version: 'story/v1',
      meta: { title: storyTitle || 'Untitled Story', exportedAt: new Date().toISOString() },
      settings: { impactUnit: 'km' },
      timeline,
      links: links.map(l => ({ id: l.id, fromId: l.fromId, toId: l.toId, importance: l.importance, color: l.color }))
    }
  }

  function downloadExport() {
    const data = buildExport()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(storyTitle || 'story').replace(/\s+/g, '_')}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  async function handleImportFile(file: File) {
    try {
      const text = await file.text()
      const json = JSON.parse(text) as StoryExport
      const out: EventSpec[] = []
      const importedLinks: EventLink[] = []
      const timeline = json?.timeline || {}
      for (const [dateKey, arr] of Object.entries(timeline)) {
        for (const raw of arr) {
          if (raw.type === 'point' && raw.location) {
            out.push({
              id: raw.id || `${dateKey}-pt-${Math.random().toString(36).slice(2, 8)}`,
              type: 'point',
              title: raw.title || '',
              dateStart: raw.dateStart || dateKey,
              dateEnd: raw.dateEnd,
              color: raw.color || '#e53935',
              description: raw.description || '',
              media: raw.media,
              impactKm: Number(raw.impactKm) || 1,
              importance: (raw as any).importance === 'major' ? 'major' : 'minor',
              location: { lat: Number(raw.location.lat), lon: Number(raw.location.lon) }
            })
          } else if (raw.type === 'path' && raw.start && raw.end) {
            out.push({
              id: raw.id || `${dateKey}-path-${Math.random().toString(36).slice(2, 8)}`,
              type: 'path',
              title: raw.title || '',
              dateStart: raw.dateStart || dateKey,
              dateEnd: raw.dateEnd,
              color: raw.color || '#1976d2',
              description: raw.description || '',
              media: raw.media,
              impactKm: Number(raw.impactKm) || 1,
              importance: (raw as any).importance === 'major' ? 'major' : 'minor',
              start: { lat: Number(raw.start.lat), lon: Number(raw.start.lon) },
              end: { lat: Number(raw.end.lat), lon: Number(raw.end.lon) }
            })
          }
        }
      }
      const rawLinks = (json as any)?.links
      if (Array.isArray(rawLinks)) {
        for (const l of rawLinks) {
          if (l && typeof l.fromId === 'string' && typeof l.toId === 'string' && (l.importance === 'major' || l.importance === 'minor')) {
            importedLinks.push({ id: String(l.id || `${l.fromId}->${l.toId}`), fromId: l.fromId, toId: l.toId, importance: l.importance, color: typeof l.color === 'string' ? l.color : undefined })
          }
        }
      }
      setEvents(out)
      setLinks(importedLinks)
    } catch (err) {
      alert('Failed to import JSON: ' + (err as Error)?.message)
    }
  }

  // ---------------- Event form handlers ----------------

  function handleAddEvent() {
    const impactKm = Number(evImpactKm)
    if (!Number.isFinite(impactKm) || impactKm <= 0) return
    const base: EventBase = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: evTitle || '(untitled)',
      dateStart: evDateStart,
      dateEnd: evDateEnd || undefined,
      color: evColor || '#e53935',
      description: evDesc || '',
      impactKm,
      importance: evImportance,
      media: evImageDataUrl ? { imageDataUrl: evImageDataUrl } : undefined
    }

    if (evType === 'point') {
      const lat = Number(evLat), lon = Number(evLon)
      if (![lat, lon].every(Number.isFinite)) return
      const e: PointEvent = { ...base, type: 'point', location: { lat, lon } }
      setEvents(arr => [...arr, e])
    } else {
      const slat = Number(evLat), slon = Number(evLon)
      const elat = Number(evEndLat), elon = Number(evEndLon)
      if (![slat, slon, elat, elon].every(Number.isFinite)) return
      const e: PathEvent = { ...base, type: 'path', start: { lat: slat, lon: slon }, end: { lat: elat, lon: elon } }
      setEvents(arr => [...arr, e])
    }

    // reset minimal fields
    setEvTitle('')
    setEvDesc('')
    setEvImageDataUrl('')
  }

  function handleRemoveEvent(id: string) {
    setEvents(arr => arr.filter(e => e.id !== id))
  }

  function handleEventImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) { setEvImageDataUrl(''); return }
    const reader = new FileReader()
    reader.onload = () => { setEvImageDataUrl(String(reader.result || '')) }
    reader.readAsDataURL(file)
  }

  // ---------------- Link handlers ----------------

  function handleAddLink() {
    if (!lnkFromId || !lnkToId || lnkFromId === lnkToId) return
    const id = `${lnkFromId}->${lnkToId}@${Date.now()}`
    const cleanColor = (lnkColor || '').trim()
    const color = /^#([\da-fA-F]{6})$/.test(cleanColor) ? cleanColor : undefined
    setLinks(arr => [...arr, { id, fromId: lnkFromId, toId: lnkToId, importance: lnkImportance, color }])
  }

  function handleRemoveLink(id: string) {
    setLinks(arr => arr.filter(l => l.id !== id))
  }

  function handleClearLinks() {
    setLinks([])
  }

  function handleAutoLink(importance: 'major' | 'minor') {
    // Build consecutive links among point events of the given importance, ordered by dateStart
    const pts = events
      .filter(e => e.type === 'point' && e.importance === importance)
      .slice()
      .sort((a, b) => (a.dateStart.localeCompare(b.dateStart)) || a.title.localeCompare(b.title)) as PointEvent[]
    if (pts.length < 2) return
    // Replace existing links of this importance with the new chain
    const others = links.filter(l => l.importance !== importance)
    const chain: EventLink[] = []
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1]
      const curr = pts[i]
      chain.push({ id: `${prev.id}->${curr.id}`, fromId: prev.id, toId: curr.id, importance, color: undefined })
    }
    setLinks([...others, ...chain])
  }

  // ---------------- Legacy UI actions ----------------

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
    setArrowsState(arr => [...arr, { id, startLat, startLng, endLat, endLng, color: aColor || '#1976d2', strokePx: Math.max(1, strokePx), animMs: Math.max(200, animMs), altitude: 0.12, initialGap: Math.random() }])
  }

  function handleRemoveArrow(id: string) {
    setArrowsState(arr => arr.filter(a => a.id !== id))
  }

  // ---------------- Render ----------------

  const exportPreview = JSON.stringify(buildExport(), null, 2)

  return (
    <main className="page">
      <div className="container widgets-page">
        <h1 className="h1">3D World — Modern (Small)</h1>

        <section className="panel" style={{ overflow: 'hidden' }}>
          <div ref={containerRef} style={{ width: '100%', minHeight: 260 }} />
        </section>

        <section className="panel">
          <div className="grid" style={{ gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', gap: '.35rem', alignItems: 'center' }}>
                <input type="checkbox" checked={teacherMode} onChange={(e)=> setTeacherMode(e.target.checked)} />
                <span className="muted">Teacher Mode</span>
              </label>
              {teacherMode && (
                <>
                  <label style={{ display: 'flex', gap: '.35rem', alignItems: 'center' }}>
                    <span className="muted">Title</span>
                    <input type="text" value={storyTitle} onChange={(e)=> setStoryTitle(e.target.value)} style={{ width: 240 }} />
                  </label>
                  <label style={{ display: 'flex', gap: '.35rem', alignItems: 'center' }}>
                    <span className="muted">Import</span>
                    <input type="file" accept="application/json" onChange={(e)=> { const f=e.target.files?.[0]; if (f) handleImportFile(f) }} />
                  </label>
                  <label style={{ display: 'flex', gap: '.35rem', alignItems: 'center' }}>
                    <input type="checkbox" checked={showMajorLinks} onChange={(e)=> setShowMajorLinks(e.target.checked)} />
                    <span className="muted">Show Major Arrows</span>
                  </label>
                  <label style={{ display: 'flex', gap: '.35rem', alignItems: 'center' }}>
                    <input type="checkbox" checked={showMinorLinks} onChange={(e)=> setShowMinorLinks(e.target.checked)} />
                    <span className="muted">Show Minor Arrows</span>
                  </label>
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
              <label className="muted">Selected Date</label>
              <input type="date" value={selectedDate} onChange={(e)=> setSelectedDate(e.target.value)} />
            </div>
          </div>
        </section>

        {teacherMode && (
          <section className="panel">
            <div className="eyebrow">Add Event</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '.5rem', alignItems: 'end' }}>
              <label>
                <div className="muted">Type</div>
                <select value={evType} onChange={(e)=> setEvType(e.target.value as any)}>
                  <option value="point">Point</option>
                  <option value="path">Path</option>
                </select>
              </label>
              <label>
                <div className="muted">Title</div>
                <input type="text" value={evTitle} onChange={(e)=> setEvTitle(e.target.value)} />
              </label>
              <label>
                <div className="muted">Start Date</div>
                <input type="date" value={evDateStart} onChange={(e)=> setEvDateStart(e.target.value)} />
              </label>
              <label>
                <div className="muted">End Date</div>
                <input type="date" value={evDateEnd} onChange={(e)=> setEvDateEnd(e.target.value)} />
              </label>
              <label>
                <div className="muted">Impact (km)</div>
                <input type="number" step={1} value={evImpactKm} onChange={(e)=> setEvImpactKm(e.target.value)} />
              </label>
              <label>
                <div className="muted">Importance</div>
                <select value={evImportance} onChange={(e)=> setEvImportance((e.target.value as 'major' | 'minor'))}>
                  <option value="major">Major</option>
                  <option value="minor">Minor</option>
                </select>
              </label>
              <label>
                <div className="muted">Color</div>
                <input type="color" value={evColor} onChange={(e)=> setEvColor(e.target.value)} />
              </label>
              {evType === 'point' ? (
                <>
                  <label>
                    <div className="muted">Lat</div>
                    <input type="number" step={0.0001} value={evLat} onChange={(e)=> setEvLat(e.target.value)} />
                  </label>
                  <label>
                    <div className="muted">Lon</div>
                    <input type="number" step={0.0001} value={evLon} onChange={(e)=> setEvLon(e.target.value)} />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    <div className="muted">Start Lat</div>
                    <input type="number" step={0.0001} value={evLat} onChange={(e)=> setEvLat(e.target.value)} />
                  </label>
                  <label>
                    <div className="muted">Start Lon</div>
                    <input type="number" step={0.0001} value={evLon} onChange={(e)=> setEvLon(e.target.value)} />
                  </label>
                  <label>
                    <div className="muted">End Lat</div>
                    <input type="number" step={0.0001} value={evEndLat} onChange={(e)=> setEvEndLat(e.target.value)} />
                  </label>
                  <label>
                    <div className="muted">End Lon</div>
                    <input type="number" step={0.0001} value={evEndLon} onChange={(e)=> setEvEndLon(e.target.value)} />
                  </label>
                </>
              )}
              <label style={{ gridColumn: '1 / -1' }}>
                <div className="muted">Description</div>
                <textarea rows={3} value={evDesc} onChange={(e)=> setEvDesc(e.target.value)} />
              </label>
              <label>
                <div className="muted">Image</div>
                <input type="file" accept="image/*" onChange={handleEventImage} />
              </label>
              <div>
                <button className="btn" onClick={handleAddEvent}>Add Event</button>
              </div>
            </div>
          </section>
        )}

        {events.length > 0 && (
          <section className="panel">
            <div className="eyebrow">Events</div>
            <ul className="list-plain" style={{ margin: 0 }}>
              {events
                .slice()
                .sort((a,b)=> (a.dateStart.localeCompare(b.dateStart)) || a.title.localeCompare(b.title))
                .map(e => (
                <li key={e.id} style={{ display:'flex', alignItems:'center', gap:'.5rem', justifyContent:'space-between', flexWrap:'wrap' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'.6rem', flexWrap:'wrap' }}>
                    <span style={{ display:'inline-block', width:14, height:14, borderRadius:'50%', background: e.color, border:'1px solid rgba(0,0,0,.2)' }} />
                    <span className="muted">{e.type.toUpperCase()}</span>
                    <span className="muted" style={{ padding: '.05rem .35rem', border: '1px solid rgba(0,0,0,.2)', borderRadius: 4 }}>
                      {e.importance === 'major' ? 'MAJOR' : 'MINOR'}
                    </span>
                    <strong>{e.title}</strong>
                    <span className="muted">{e.dateStart}{e.dateEnd ? ' — '+e.dateEnd : ''} · impact {e.impactKm} km</span>
                  </div>
                  {teacherMode && (
                    <button className="btn" onClick={()=> handleRemoveEvent(e.id)}>Remove</button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {teacherMode && (
          <>
            <section className="panel">
              <div className="eyebrow">Propagation Arrows</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '.5rem', alignItems: 'end' }}>
                <label>
                  <div className="muted">From Event</div>
                  <select value={lnkFromId} onChange={(e)=> setLnkFromId(e.target.value)}>
                    <option value="">— Select —</option>
                    {events.filter(e=> e.type==='point').slice().sort((a,b)=> a.dateStart.localeCompare(b.dateStart)).map(e=> (
                      <option key={e.id} value={e.id}>{e.dateStart} · {e.title}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <div className="muted">To Event</div>
                  <select value={lnkToId} onChange={(e)=> setLnkToId(e.target.value)}>
                    <option value="">— Select —</option>
                    {events.filter(e=> e.type==='point').slice().sort((a,b)=> a.dateStart.localeCompare(b.dateStart)).map(e=> (
                      <option key={e.id} value={e.id}>{e.dateStart} · {e.title}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <div className="muted">Importance</div>
                  <select value={lnkImportance} onChange={(e)=> setLnkImportance(e.target.value as any)}>
                    <option value="major">Major</option>
                    <option value="minor">Minor</option>
                  </select>
                </label>
                <label>
                  <div className="muted">Color (optional)</div>
                  <input type="color" value={lnkColor || '#000000'} onChange={(e)=> setLnkColor(e.target.value)} />
                </label>
                <div>
                  <button className="btn" onClick={handleAddLink}>Add Link</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '.5rem', marginTop: '.5rem', flexWrap: 'wrap' }}>
                <button className="btn" onClick={()=> handleAutoLink('major')}>Auto‑Link Major (by date)</button>
                <button className="btn" onClick={()=> handleAutoLink('minor')}>Auto‑Link Minor (by date)</button>
                <button className="btn" onClick={handleClearLinks}>Clear All Links</button>
              </div>
              {links.length > 0 && (
                <ul className="list-plain" style={{ marginTop: '.5rem' }}>
                  {links.map(l=> (
                    <li key={l.id} style={{ display:'flex', alignItems:'center', gap:'.5rem', justifyContent:'space-between', flexWrap:'wrap' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'.6rem', flexWrap:'wrap' }}>
                        <span className="muted" style={{ padding: '.05rem .35rem', border: '1px solid rgba(0,0,0,.2)', borderRadius: 4 }}>{l.importance === 'major' ? 'MAJOR' : 'MINOR'}</span>
                        <span>{l.fromId} → {l.toId}</span>
                        {l.color && <span className="muted">color <span style={{ display:'inline-block', width:12, height:12, background:l.color, border:'1px solid rgba(0,0,0,.2)' }} /></span>}
                      </div>
                      <button className="btn" onClick={()=> handleRemoveLink(l.id)}>Remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="panel">
              <div className="eyebrow">Legacy Shapes (Advanced)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '.5rem', alignItems: 'end' }}>
                <label>
                  <div className="muted">Lat</div>
                  <input type="number" step={0.0001} value={latInput} onChange={(e)=> setLatInput(e.target.value)} />
                </label>
                <label>
                  <div className="muted">Lon</div>
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
                        <label style={{ display:'flex', gap:'.35rem', alignItems: 'center' }}>
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

            {arrowsState.length > 0 && (
              <section className="panel">
                <div className="eyebrow">Arrows</div>
                <ul className="list-plain" style={{ margin: 0 }}>
                  {arrowsState.map(a => (
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
          </>
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

        <section className="panel">
          <div className="eyebrow">Output — Technical Story JSON (keyed by date)</div>
          <div style={{ display:'flex', gap:'.5rem', marginBottom:'.5rem', flexWrap:'wrap' }}>
            <button className="btn" onClick={downloadExport}>Download JSON</button>
            <button className="btn" onClick={()=> { navigator.clipboard?.writeText(exportPreview) }}>Copy JSON</button>
          </div>
          <textarea style={{ width:'100%', minHeight: 220, fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace' }} readOnly value={exportPreview} />
          <div className="muted" style={{ marginTop: '.5rem' }}>
            Notes: timeline keys are ISO dates (YYYY-MM-DD). Each entry contains point or path events with impactKm in kilometers, plain text description, and optional image data URL.
          </div>
        </section>
      </div>
    </main>
  )
}


