import { useEffect, useMemo, useRef, useState } from 'react'

type Mode = 'complete' | 'simplified' | 'animated'

type ShowToggles = {
  demand: boolean
  supply: boolean
  cs: boolean
  ps: boolean
  dwl: boolean
  guides: boolean
}

type State = {
  // Linear demand: P = a - b Q (b>0)
  a: number
  b: number
  // Linear supply: P = c + d Q + t (d>0)
  c: number
  d: number
  // Per-unit tax (supply upward shift)
  t: number
  // Market: second supply curve shift (S1 -> S2 downward by shift)
  s2Shift: number
  show: ShowToggles
  mode: Mode
  chart: 'market' | 'firm'
}

function clamp(x: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, x)) }
function fmt(x: number, d = 2) { return Number.isFinite(x) ? (+x).toFixed(d) : '–' }
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export default function SupplyDemand() {
  const [state, setState] = useState<State>({
    a: 120,
    b: 0.9,
    c: 20,
    d: 0.9,
    t: 0,
    s2Shift: 15,
    show: { demand: true, supply: true, cs: true, ps: true, dwl: true, guides: true },
    mode: 'complete',
    chart: 'market',
  })

  const defaultState = useMemo(() => ({ ...state }), [])
  const [animating, setAnimating] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const statusRef = useRef<HTMLParagraphElement | null>(null)

  // Helpers: demand/supply functions
  const P_d = (Q: number, s = state) => Math.max(0, s.a - s.b * Q)
  const P_s = (Q: number, s = state) => Math.max(0, s.c + s.d * Q + s.t)
  const P_s0 = (Q: number, s = state) => Math.max(0, s.c + s.d * Q)

  const computed = useMemo(() => {
    const s = state
    const denom = s.b + s.d

    // Supply 1 (S1) vs Supply 2 (S2 = S1 shifted down by s2Shift)
    const c2 = Math.max(0, s.c - s.s2Shift)

    // Old equilibrium (S1 with tax t)
    const numer1 = s.a - (s.c + s.t)
    let qOld = denom > 0 ? numer1 / denom : 0
    if (!Number.isFinite(qOld) || qOld < 0) qOld = 0
    const pOld = P_d(qOld, s)
    const pOldProd = Math.max(0, pOld - s.t)

    // New equilibrium (S2 with same tax t)
    const numer2 = s.a - (c2 + s.t)
    let qNew = denom > 0 ? numer2 / denom : 0
    if (!Number.isFinite(qNew) || qNew < 0) qNew = 0
    const pNew = P_d(qNew, s)
    const pNewProd = Math.max(0, pNew - s.t)

    // Market axes
    const qChoke = s.b > 0 ? s.a / s.b : 100
    const qCandidates = [qChoke, qOld, qNew, Math.sqrt( (s.a||1) )].filter(Number.isFinite)
    const QmaxM = Math.max(10, ...qCandidates) * 1.15
    const pCandidates = [s.a, P_s(QmaxM * 0.7, s), P_s0(QmaxM * 0.7, s), pOld, pNew].filter(Number.isFinite)
    let PmaxM = Math.max(10, ...pCandidates) * 1.15
    PmaxM = Math.min(PmaxM, s.a * 3 + 500)

    // Surpluses at old equilibrium (S1)
    const cs = 0.5 * Math.max(0, s.a - pOld) * Math.max(0, qOld)
    const ps = 0.5 * Math.max(0, pOldProd - s.c) * Math.max(0, qOld)
    const dwl = s.t > 0 ? (0.5 * s.t * Math.max(0, ( (s.a - s.c) / (s.b + s.d) ) - qOld )) : 0

    // P1, P2, Q1, Q2 labels
    const P1 = Math.max(pOld, pNew)
    const P2 = Math.min(pOld, pNew)
    const Q1 = Math.max(qOld, qNew) // higher quantity after supply increase
    const Q2 = Math.min(qOld, qNew)

    // Firm side parameters (stylized)
    const v = 30, w = 0.8, F = 300
    const MCf = (Q: number) => v + w * Q
    const ATCf = (Q: number) => (Q <= 0 ? Infinity : F / Q + v + 0.5 * w * Q)
    const qFirm1 = Math.max(0, (P1 - v) / w)
    const qFirm2 = Math.max(0, (P2 - v) / w)
    const atc1 = ATCf(qFirm1)
    const atc2 = ATCf(qFirm2)
    const profit1 = (P1 - atc1) * qFirm1

    // Firm axes
    const QmaxF = Math.max(10, qFirm1, qFirm2, Math.sqrt((2 * F) / Math.max(0.1, w))) * 1.2
    let PmaxF = Math.max(10, P1, P2, MCf(QmaxF * 0.9), ATCf(Math.max(0.1, qFirm1))) * 1.15
    PmaxF = Math.min(PmaxF, P1 * 3 + 400)

    const dQ = Q1 - Q2
    const dP = P1 - P2

    return { c2, qOld, pOld, pOldProd, qNew, pNew, pNewProd, QmaxM, PmaxM, cs, ps, dwl, P1, P2, Q1, Q2, dQ, dP,
             v, w, F, qFirm1, qFirm2, atc1, atc2, profit1, QmaxF, PmaxF }
  }, [state])

  // Drawing
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const cssW = (canvas.clientWidth || 900)
    const cssH = (canvas.clientHeight || 420)
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssW, cssH)

    function drawAxes(Qmax: number, Pmax: number) {
      const pad = 28
      const left = pad, right = pad, top = pad, bottom = pad + 12
      const W = cssW - left - right
      const H = cssH - top - bottom
      const x = (q: number) => left + (q / Qmax) * W
      const y = (p: number) => top + (1 - p / Pmax) * H

      ctx.save()
      ctx.strokeStyle = '#999'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(left, top)
      ctx.lineTo(left, cssH - bottom)
      ctx.lineTo(cssW - right, cssH - bottom)
      ctx.stroke()
      ctx.fillStyle = '#000'
      ctx.font = '14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
      for (let i = 1; i <= 5; i++) {
        const X = left + (i / 5) * W
        ctx.beginPath(); ctx.moveTo(X, cssH - bottom); ctx.lineTo(X, cssH - bottom + 6); ctx.stroke()
      }
      for (let i = 1; i <= 5; i++) {
        const Y = top + (1 - i / 5) * H
        ctx.beginPath(); ctx.moveTo(left - 6, Y); ctx.lineTo(left, Y); ctx.stroke()
      }
      ctx.fillText('Q', cssW - right - 8, cssH - bottom + 16)
      ctx.fillText('P', left - 12, top + 12)
      ctx.restore()

      return { x, y, left, right, top, bottom, W, H }
    }

    function drawCurve(fn: (q: number) => number, color: string, sc: {x:(q:number)=>number, y:(p:number)=>number}, Qmax:number, dash?: number[]) {
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2; if (dash) ctx.setLineDash(dash)
      ctx.beginPath()
      let started = false
      const samples = 200
      for (let i = 0; i <= samples; i++) {
        const q = (i / samples) * Qmax
        const p = fn(q)
        if (!Number.isFinite(p)) continue
        const X = sc.x(q), Y = sc.y(p)
        if (!started) { ctx.moveTo(X, Y); started = true } else ctx.lineTo(X, Y)
      }
      ctx.stroke(); ctx.restore()
    }

    function fillPolygon(points: Array<[number, number]>, fill: string) {
      if (points.length < 3) return
      ctx.save(); ctx.fillStyle = fill; ctx.beginPath()
      ctx.moveTo(points[0][0], points[0][1])
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1])
      ctx.closePath(); ctx.fill(); ctx.restore()
    }

    if (state.chart === 'market') {
      const sc = drawAxes(computed.QmaxM, computed.PmaxM)

      // DWL between tax and no-tax for S1
      if (state.show.dwl && state.t > 0) {
        const N = 60
        const demandPts: Array<[number, number]> = []
        const supplyTaxPts: Array<[number, number]> = []
        const denom = state.b + state.d
        const qNoTax = denom > 0 ? (state.a - state.c) / denom : 0
        for (let i = 0; i <= N; i++) {
          const q = computed.qOld + (qNoTax - computed.qOld) * (i / N)
          demandPts.push([sc.x(q), sc.y(P_d(q, state))])
        }
        for (let i = 0; i <= N; i++) {
          const q = qNoTax - (qNoTax - computed.qOld) * (i / N)
          supplyTaxPts.push([sc.x(q), sc.y(P_s(q, state))])
        }
        fillPolygon([...demandPts, ...supplyTaxPts], '#f0b80022')
      }

      // Curves
      if (state.show.demand) drawCurve(q => P_d(q, state), '#333', sc, computed.QmaxM)
      if (state.show.supply) {
        drawCurve(q => state.c + state.d * q + state.t, '#0B84A5', sc, computed.QmaxM)
        drawCurve(q => computed.c2 + state.d * q + state.t, '#0B84A5', sc, computed.QmaxM, [6,4])
      }

      // P1 / P2 dashed lines
      ctx.save(); ctx.setLineDash([6,4]); ctx.strokeStyle = '#bf2b34'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(sc.x(0), sc.y(computed.P1)); ctx.lineTo(sc.x(computed.QmaxM), sc.y(computed.P1)); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(sc.x(0), sc.y(computed.P2)); ctx.lineTo(sc.x(computed.QmaxM), sc.y(computed.P2)); ctx.stroke()
      ctx.restore()

      // Marker points (old/new)
      ctx.save(); ctx.fillStyle = '#000'
      ctx.beginPath(); ctx.arc(sc.x(state.s2Shift>0?computed.Q2:computed.Q1), sc.y(state.s2Shift>0?computed.P1:computed.P2), 3, 0, Math.PI*2); ctx.fill()
      ctx.beginPath(); ctx.arc(sc.x(state.s2Shift>0?computed.Q1:computed.Q2), sc.y(state.s2Shift>0?computed.P2:computed.P1), 3, 0, Math.PI*2); ctx.fill(); ctx.restore()

    } else {
      // Firm view
      const sc = drawAxes(computed.QmaxF, computed.PmaxF)

      // Curves
      const MCf = (Q: number) => computed.v + computed.w * Q
      const ATCf = (Q: number) => (Q <= 0 ? Infinity : computed.F / Q + computed.v + 0.5 * computed.w * Q)
      drawCurve(MCf, '#0B84A5', sc, computed.QmaxF) // MC in green-ish
      drawCurve(ATCf, '#F0B800', sc, computed.QmaxF) // ATC in gold

      // Horizontal MR lines at P1 and P2
      ctx.save(); ctx.strokeStyle = '#6b5b95'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(sc.x(0), sc.y(computed.P1)); ctx.lineTo(sc.x(computed.QmaxF), sc.y(computed.P1)); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(sc.x(0), sc.y(computed.P2)); ctx.lineTo(sc.x(computed.QmaxF), sc.y(computed.P2)); ctx.stroke()
      ctx.restore()

      // Vertical dashed Q lines
      ctx.save(); ctx.setLineDash([5,5]); ctx.strokeStyle = '#bf2b34'
      ctx.beginPath(); ctx.moveTo(sc.x(computed.qFirm2), sc.y(0)); ctx.lineTo(sc.x(computed.qFirm2), sc.y(computed.P2)); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(sc.x(computed.qFirm1), sc.y(0)); ctx.lineTo(sc.x(computed.qFirm1), sc.y(computed.P1)); ctx.stroke()
      ctx.restore()

      // Profit rectangle at higher price P1
      if (computed.P1 > 0 && computed.qFirm1 > 0) {
        const top = Math.min(sc.y(computed.P1), sc.y(computed.atc1))
        const bottom = Math.max(sc.y(computed.P1), sc.y(computed.atc1))
        ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.2)'
        ctx.fillRect(sc.x(0), top, sc.x(computed.qFirm1) - sc.x(0), bottom - top)
        ctx.restore()
      }

      // Markers
      ctx.save(); ctx.fillStyle = '#000'
      ctx.beginPath(); ctx.arc(sc.x(computed.qFirm1), sc.y(computed.P1), 3, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(sc.x(computed.qFirm2), sc.y(computed.P2), 3, 0, Math.PI * 2); ctx.fill(); ctx.restore()
    }
  }, [state, computed])

  useEffect(() => {
    const handle = () => {
      // Trigger redraw on resize by nudging state without changing values
      setState(s => ({ ...s }))
    }
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [])

  function setMode(next: Mode) {
    setState(s => ({ ...s, mode: next }))
  }

  function animateTo(target: Partial<State>, ms = 900) {
    if (animating) return
    setAnimating(true)
    statusRef.current && (statusRef.current.textContent = 'Animating…')
    const start = state
    const startTime = performance.now()
    function frame(now: number) {
      const t = clamp((now - startTime) / ms, 0, 1)
      const e = easeInOutCubic(t)
      setState(prev => ({
        ...prev,
        a: lerp(start.a, target.a ?? start.a, e),
        b: lerp(start.b, target.b ?? start.b, e),
        c: lerp(start.c, target.c ?? start.c, e),
        d: lerp(start.d, target.d ?? start.d, e),
        t: lerp(start.t, target.t ?? start.t, e),
      }))
      if (t < 1) requestAnimationFrame(frame)
      else {
        setAnimating(false)
        statusRef.current && (statusRef.current.textContent = '')
      }
    }
    requestAnimationFrame(frame)
  }

  const Controls = () => (
    <div className="controls" aria-label="Model controls">
      <div className="control">
        <div className="label-row" style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:'.5rem'}}>
          <label htmlFor="aRange"><span className={state.mode==='simplified' ? '' : 'technical'}>Demand intercept <strong>a</strong></span><span className={state.mode==='simplified' ? '' : 'plain'}>Max price when Q=0</span></label>
          <input type="number" id="aNum" step={1} min={10} max={500} value={state.a} onChange={e=>{ const v = (e.currentTarget as HTMLInputElement).valueAsNumber; if (!Number.isFinite(v)) return; setState(s=>({...s,a:v})) }} />
        </div>
        <input type="range" id="aRange" min={10} max={500} step={1} value={state.a} onChange={e=>{ const v = (e.currentTarget as HTMLInputElement).valueAsNumber; if (!Number.isFinite(v)) return; setState(s=>({...s,a:v})) }} />
      </div>

      <div className="control">
        <div className="label-row" style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:'.5rem'}}>
          <label htmlFor="bRange"><span className={state.mode==='simplified' ? '' : 'technical'}>Demand slope <strong>b</strong></span><span className={state.mode==='simplified' ? '' : 'plain'}>Price drop per unit</span></label>
          <input type="number" id="bNum" step={0.05} min={0.05} max={8} value={state.b} onChange={e=>{ const v = (e.currentTarget as HTMLInputElement).valueAsNumber; if (!Number.isFinite(v)) return; setState(s=>({...s,b:v})) }} />
        </div>
        <input type="range" id="bRange" min={0.05} max={8} step={0.05} value={state.b} onChange={e=>{ const v = (e.currentTarget as HTMLInputElement).valueAsNumber; if (!Number.isFinite(v)) return; setState(s=>({...s,b:v})) }} />
      </div>

      <div className="control">
        <div className="label-row" style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:'.5rem'}}>
          <label htmlFor="cRange"><span className={state.mode==='simplified' ? '' : 'technical'}>Supply intercept <strong>c</strong></span><span className={state.mode==='simplified' ? '' : 'plain'}>Min price at Q=0</span></label>
          <input type="number" id="cNum" step={1} min={0} max={300} value={state.c} onChange={e=>{ const v = (e.currentTarget as HTMLInputElement).valueAsNumber; if (!Number.isFinite(v)) return; setState(s=>({...s,c:v})) }} />
        </div>
        <input type="range" id="cRange" min={0} max={300} step={1} value={state.c} onChange={e=>{ const v = (e.currentTarget as HTMLInputElement).valueAsNumber; if (!Number.isFinite(v)) return; setState(s=>({...s,c:v})) }} />
      </div>

      <div className="control">
        <div className="label-row" style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:'.5rem'}}>
          <label htmlFor="dRange"><span className={state.mode==='simplified' ? '' : 'technical'}>Supply slope <strong>d</strong></span><span className={state.mode==='simplified' ? '' : 'plain'}>How fast cost rises</span></label>
          <input type="number" id="dNum" step={0.05} min={0.05} max={6} value={state.d} onChange={e=>{ const v = (e.currentTarget as HTMLInputElement).valueAsNumber; if (!Number.isFinite(v)) return; setState(s=>({...s,d:v})) }} />
        </div>
        <input type="range" id="dRange" min={0.05} max={6} step={0.05} value={state.d} onChange={e=>{ const v = (e.currentTarget as HTMLInputElement).valueAsNumber; if (!Number.isFinite(v)) return; setState(s=>({...s,d:v})) }} />
      </div>

      <div className="control">
        <div className="label-row" style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:'.5rem'}}>
          <label htmlFor="tRange"><span className={state.mode==='simplified' ? '' : 'technical'}>Per‑unit tax <strong>t</strong></span><span className={state.mode==='simplified' ? '' : 'plain'}>Upward shift of supply</span></label>
          <input type="number" id="tNum" step={1} min={0} max={100} value={state.t} onChange={e=>{ const v = (e.currentTarget as HTMLInputElement).valueAsNumber; if (!Number.isFinite(v)) return; setState(s=>({...s,t:v})) }} />
        </div>
        <input type="range" id="tRange" min={0} max={100} step={1} value={state.t} onChange={e=>{ const v = (e.currentTarget as HTMLInputElement).valueAsNumber; if (!Number.isFinite(v)) return; setState(s=>({...s,t:v})) }} />
      </div>

      <div className="control">
        <div className="label-row" style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:'.5rem'}}>
          <label htmlFor="s2Range"><span className={state.mode==='simplified' ? '' : 'technical'}>Supply shift S2 vs S1</span><span className={state.mode==='simplified' ? '' : 'plain'}>Move supply right (lower price)</span></label>
          <input type="number" id="s2Num" step={1} min={0} max={60} value={state.s2Shift} onChange={e=>{ const v = (e.currentTarget as HTMLInputElement).valueAsNumber; if (!Number.isFinite(v)) return; setState(s=>({...s,s2Shift:clamp(v,0,60)})) }} />
        </div>
        <input type="range" id="s2Range" min={0} max={60} step={1} value={state.s2Shift} onChange={e=>{ const v = (e.currentTarget as HTMLInputElement).valueAsNumber; if (!Number.isFinite(v)) return; setState(s=>({...s,s2Shift:clamp(v,0,60)})) }} />
      </div>

      <div className="divider" />

      <div className="toggle-row" role="group" aria-label="Toggle curves" style={{display:'flex', flexWrap:'wrap', gap:'.5rem'}}>
        <label className="inline-check" style={{display:'flex', alignItems:'center', gap:'.35rem'}}><input type="checkbox" checked={state.show.demand} onChange={e=>setState(s=>({...s,show:{...s.show,demand:e.target.checked}}))} /> Demand</label>
        <label className="inline-check" style={{display:'flex', alignItems:'center', gap:'.35rem'}}><input type="checkbox" checked={state.show.supply} onChange={e=>setState(s=>({...s,show:{...s.show,supply:e.target.checked}}))} /> Supply</label>
        <label className="inline-check" style={{display:'flex', alignItems:'center', gap:'.35rem'}}><input type="checkbox" checked={state.show.cs} onChange={e=>setState(s=>({...s,show:{...s.show,cs:e.target.checked}}))} /> Consumer surplus</label>
        <label className="inline-check" style={{display:'flex', alignItems:'center', gap:'.35rem'}}><input type="checkbox" checked={state.show.ps} onChange={e=>setState(s=>({...s,show:{...s.show,ps:e.target.checked}}))} /> Producer surplus</label>
        <label className="inline-check" style={{display:'flex', alignItems:'center', gap:'.35rem'}}><input type="checkbox" checked={state.show.dwl} onChange={e=>setState(s=>({...s,show:{...s.show,dwl:e.target.checked}}))} /> Deadweight loss</label>
        <label className="inline-check" style={{display:'flex', alignItems:'center', gap:'.35rem'}}><input type="checkbox" checked={state.show.guides} onChange={e=>setState(s=>({...s,show:{...s.show,guides:e.target.checked}}))} /> Guides at Q*, P*</label>
      </div>

      <div className="divider" />

      <div className="control">
        <button className="widget-action-button" onClick={()=>animateTo(defaultState, 600)} disabled={animating}>Reset to sensible defaults</button>
      </div>
    </div>
  )

  const Legend = () => (
    <div className="legend" aria-label="Legend">
      <h3>Legend</h3>
      <p><span className="swatch" style={{background:'#333'}} /> Demand</p>
      <p><span className="swatch" style={{background:'#0B84A5'}} /> Supply S1</p>
      <p><span className="swatch" style={{background:'#0B84A5'}} /> Supply S2 (dashed)</p>
      <p><span className="swatch axis" /> Axes & guides</p>
      <p className="small">Shading: green = consumer surplus, teal = producer surplus, gold = DWL</p>
    </div>
  )

  const Info = () => {
    if (state.mode === 'complete') {
      return (
        <div className="info">
          <h3 className="technical">Technical snapshot</h3>
          <p className="technical"><strong>Demand:</strong> P(Q)=a−bQ &nbsp;&nbsp; <strong>Supply:</strong> c+dQ+t</p>
          <p className="technical"><strong>Equilibrium:</strong> a−bQ = c+dQ+t → Q = (a−c−t)/(b+d). We show two supplies S1 and S2.</p>
          <p className="technical"><strong>Comparative statics:</strong> S1→S2 lowers price (P1→P2) and raises quantity (Q2→Q1). A competitive firm moves where MC=P, so its output changes from q(P1)→q(P2).</p>
          <div className="divider" />
          <p className="small"><strong>Status:</strong> Market: Q1={fmt(computed.Q1)}, Q2={fmt(computed.Q2)}, P1={fmt(computed.P1)}, P2={fmt(computed.P2)} • ΔQ={fmt(computed.dQ)} • ΔP={fmt(computed.dP)}</p>
        </div>
      )
    }
    if (state.mode === 'simplified') {
      return (
        <div className="info">
          <h3>Plain‑English snapshot</h3>
          <p><strong>Where lines meet</strong> is the market’s price and quantity.</p>
          <p><strong>Above the price</strong> up to the buyers’ line is buyers’ gain (consumer surplus).</p>
          <p><strong>Below the price</strong> down to the sellers’ line is sellers’ gain (producer surplus).</p>
          <div className="divider" />
          <p className="small">Now: Market moved from (Q2,P1) to (Q1,P2). Q1≈<strong>{fmt(computed.Q1)}</strong>, Q2≈<strong>{fmt(computed.Q2)}</strong>, P1≈<strong>{fmt(computed.P1)}</strong>, P2≈<strong>{fmt(computed.P2)}</strong>.</p>
        </div>
      )
    }
    return (
      <div className="info">
        <h3>Animated mode</h3>
        <p>Click scenario buttons to animate common shocks: demand or supply shifts, elasticity changes, or a per‑unit tax.</p>
        <p className="small subtle">You can still tweak sliders while animations run.</p>
      </div>
    )
  }

  return (
    <main className="page">
      <div className="container" id="sd-app">
        <a className="back-link" href="#" onClick={e=>e.preventDefault()}>Supply & Demand Explorer</a>
        <h1>Supply & Demand Equilibrium</h1>

        <div className="topbar" role="tablist" aria-label="Mode selector" style={{display:'flex', gap:'.5rem', justifyContent:'center', flexWrap:'wrap', marginBottom:'.5rem'}}>
          <button className="widget-action-button" aria-pressed={state.mode==='complete'} onClick={()=>setMode('complete')}>Complete</button>
          <button className="widget-action-button" aria-pressed={state.mode==='simplified'} onClick={()=>setMode('simplified')}>Simplified</button>
          <button className="widget-action-button" aria-pressed={state.mode==='animated'} onClick={()=>setMode('animated')}>Animated</button>
        </div>

        <div className="topbar" role="tablist" aria-label="Chart selector" style={{display:'flex', gap:'.5rem', justifyContent:'center', flexWrap:'wrap', marginBottom:'.5rem'}}>
          <button className="widget-action-button" aria-pressed={state.chart==='market'} onClick={()=>setState(s=>({...s, chart:'market'}))}>Market</button>
          <button className="widget-action-button" aria-pressed={state.chart==='firm'} onClick={()=>setState(s=>({...s, chart:'firm'}))}>Firm</button>
        </div>

        <div className="controls-container">
          <aside className="sidebar">
            <Controls />
            <Legend />
            <Info />
          </aside>
          <section className="chartarea">
            <canvas ref={canvasRef} width={900} height={420} aria-label="Supply and demand chart" />

            <div className="kpi" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))', gap:'.5rem', marginTop:'.25rem'}}>
              <div className="card" style={{background:'#f8f9fa', borderRadius:'6px', padding:'.5rem', textAlign:'center'}}><h4 style={{margin:0, fontSize:'.9rem'}}>Q1 (new)</h4><p style={{margin:'.3rem 0 0', fontWeight:600}}>{fmt(computed.Q1)}</p></div>
              <div className="card" style={{background:'#f8f9fa', borderRadius:'6px', padding:'.5rem', textAlign:'center'}}><h4 style={{margin:0, fontSize:'.9rem'}}>Q2 (old)</h4><p style={{margin:'.3rem 0 0', fontWeight:600}}>{fmt(computed.Q2)}</p></div>
              <div className="card" style={{background:'#f8f9fa', borderRadius:'6px', padding:'.5rem', textAlign:'center'}}><h4 style={{margin:0, fontSize:'.9rem'}}>P1 (old)</h4><p style={{margin:'.3rem 0 0', fontWeight:600}}>{fmt(computed.P1)}</p></div>
              <div className="card" style={{background:'#f8f9fa', borderRadius:'6px', padding:'.5rem', textAlign:'center'}}><h4 style={{margin:0, fontSize:'.9rem'}}>P2 (new)</h4><p style={{margin:'.3rem 0 0', fontWeight:600}}>{fmt(computed.P2)}</p></div>
              <div className="card" style={{background:'#f8f9fa', borderRadius:'6px', padding:'.5rem', textAlign:'center'}}><h4 style={{margin:0, fontSize:'.9rem'}}>ΔQ / ΔP</h4><p style={{margin:'.3rem 0 0', fontWeight:600}}>{fmt(computed.dQ)} / {fmt(computed.dP)}</p></div>
            </div>

            {state.mode==='animated' && (
              <div className="behavior-row" style={{display:'flex', flexWrap:'wrap', gap:'.5rem', marginTop:'.25rem'}}>
                <button className="widget-action-button" title="Shift demand up" onClick={()=>animateTo({ a: state.a * 1.2 })} disabled={animating}>Demand ↑</button>
                <button className="widget-action-button" title="Shift demand down" onClick={()=>animateTo({ a: Math.max(10, state.a * 0.85) })} disabled={animating}>Demand ↓</button>
                <button className="widget-action-button" title="More elastic demand (flatter)" onClick={()=>animateTo({ b: Math.max(0.05, state.b * 0.7) })} disabled={animating}>More Elastic (D)</button>
                <button className="widget-action-button" title="Less elastic demand (steeper)" onClick={()=>animateTo({ b: Math.min(8, state.b * 1.4) })} disabled={animating}>Less Elastic (D)</button>
                <button className="widget-action-button" title="Shift supply up" onClick={()=>animateTo({ c: Math.min(300, state.c + 10) })} disabled={animating}>Supply ↑</button>
                <button className="widget-action-button" title="Shift supply down" onClick={()=>animateTo({ c: Math.max(0, state.c - 10) })} disabled={animating}>Supply ↓</button>
                <button className="widget-action-button" title="Change supply slope" onClick={()=>animateTo({ d: clamp(state.d * 1.15, 0.05, 6) })} disabled={animating}>Steeper (S)</button>
                <button className="widget-action-button" title="Change supply slope" onClick={()=>animateTo({ d: clamp(state.d * 0.85, 0.05, 6) })} disabled={animating}>Flatter (S)</button>
                <button className="widget-action-button" title="Add per-unit tax" onClick={()=>animateTo({ t: Math.min(100, state.t + 10) })} disabled={animating}>Tax +</button>
                <button className="widget-action-button" title="Remove tax" onClick={()=>animateTo({ t: 0 })} disabled={animating}>Tax 0</button>
              </div>
            )}

            <p className="subtle small" ref={statusRef} aria-live="polite" style={{color:'#666', fontSize:'.85rem'}} />
          </section>
        </div>
      </div>
    </main>
  )
}


