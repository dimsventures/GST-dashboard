'use client'

import { useEffect, useRef } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'

type Lesson = { id: string; date: string; text: string; category?: string | null; ts?: string }
type Kind = 'root' | 'cat' | 'lesson'
type GNode = {
  id: string; kind: Kind; label: string; full?: string; date?: string; cat?: string
  count: number; r: number; x: number; y: number; vx: number; vy: number; color: string
}
type GEdge = { a: string; b: string; k: 'root' | 'cat' }

// Module-level state (same pattern as portfolio/page.tsx)
let lessons: Lesson[] = []
let nodes: GNode[] = []
let edges: GEdge[] = []
const byId: Record<string, GNode> = {}
const nbr: Record<string, Set<string>> = {}
const catColor: Record<string, string> = {}
const hiddenCats = new Set<string>()

let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
let W = 0, H = 0, dpr = 1
let tx = 0, ty = 0, scale = 1
let alpha = 1, running = false, raf = 0
let frozen = false, query = ''
let userName = 'Saya'
let hover: GNode | null = null, sel: GNode | null = null, drag: GNode | null = null
let panning = false, panStart = { x: 0, y: 0, tx: 0, ty: 0 }, downAt = { x: 0, y: 0 }, moved = false
let ro: ResizeObserver | null = null

const PALETTE = ['#3e6df0', '#34d399', '#f0b429', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316', '#a3e635', '#fb7185', '#60a5fa', '#c084fc', '#2dd4bf']
const ROOT_COLOR = '#eef0f5'

async function api(path: string): Promise<{ lessons?: Lesson[] }> {
  const r = await fetch(path)
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

// Struktur hub radial: inti (nama user) → kategori → pesan/pelajaran. Bukan graph konsep.
function buildGraph() {
  nodes = []; edges = []
  for (const k in byId) delete byId[k]
  for (const k in nbr) delete nbr[k]
  function addNode(n: GNode) { nodes.push(n); byId[n.id] = n }

  // Inti = user
  addNode({ id: 'root', kind: 'root', label: userName, count: lessons.length, r: 0, x: 0, y: 0, vx: 0, vy: 0, color: ROOT_COLOR })

  // Kategori → nyambung ke inti
  const cats: string[] = []
  for (const l of lessons) {
    const c = (l.category || 'Tanpa Kategori').trim() || 'Tanpa Kategori'
    if (!cats.includes(c)) cats.push(c)
  }
  cats.forEach((c, i) => {
    if (!catColor[c]) catColor[c] = PALETTE[i % PALETTE.length]
    addNode({ id: 'cat:' + c, kind: 'cat', label: c, count: 0, r: 0, x: 0, y: 0, vx: 0, vy: 0, color: catColor[c] })
    edges.push({ a: 'cat:' + c, b: 'root', k: 'root' })
  })

  // Pelajaran/pesan → nyambung ke kategorinya
  for (const l of lessons) {
    const c = (l.category || 'Tanpa Kategori').trim() || 'Tanpa Kategori'
    const id = 'les:' + l.id
    const label = (l.text || '').replace(/^\[[^\]]+\]\s*/, '').slice(0, 42)
    addNode({ id, kind: 'lesson', label, full: l.text || '', date: l.date, cat: c, count: 0, r: 5.5, x: 0, y: 0, vx: 0, vy: 0, color: catColor[c] })
    edges.push({ a: id, b: 'cat:' + c, k: 'cat' })
    byId['cat:' + c].count++
  }

  // Radii + adjacency
  for (const n of nodes) {
    if (n.kind === 'root') n.r = 22 + Math.sqrt(n.count) * 1.2
    else if (n.kind === 'cat') n.r = 11 + Math.sqrt(n.count) * 3.4
    nbr[n.id] = new Set()
  }
  for (const e of edges) { nbr[e.a].add(e.b); nbr[e.b].add(e.a) }
}

function seed() {
  const cx = W / 2, cy = H / 2, rad = Math.min(W, H) * 0.34
  const cats = nodes.filter(n => n.kind === 'cat')
  const catAngle: Record<string, number> = {}
  cats.forEach((c, i) => { catAngle[c.id] = (i / Math.max(1, cats.length)) * Math.PI * 2 })
  nodes.forEach(n => {
    if (n.kind === 'root') { n.x = cx; n.y = cy; n.vx = 0; n.vy = 0; return }
    if (n.kind === 'cat') {
      const a = catAngle[n.id]
      n.x = cx + Math.cos(a) * rad * 0.42; n.y = cy + Math.sin(a) * rad * 0.42
    } else {
      const a = (catAngle['cat:' + (n.cat || '')] ?? Math.random() * Math.PI * 2) + (Math.random() - 0.5) * 0.6
      const rr = rad * (0.7 + Math.random() * 0.5)
      n.x = cx + Math.cos(a) * rr; n.y = cy + Math.sin(a) * rr
    }
    n.vx = 0; n.vy = 0
  })
}

function visible(n: GNode): boolean {
  if (n.kind === 'cat') return !hiddenCats.has(n.label)
  if (n.kind === 'lesson') return !hiddenCats.has(n.cat || '')
  return true
}

function tick() {
  const live = nodes.filter(visible)
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j]
      let dx = a.x - b.x, dy = a.y - b.y
      const d2 = dx * dx + dy * dy + 0.01, d = Math.sqrt(d2)
      const ca = a.kind === 'root' ? 5 : a.kind === 'cat' ? 3.2 : 1
      const cb = b.kind === 'root' ? 5 : b.kind === 'cat' ? 3.2 : 1
      const f = 320 * ca * cb / d2
      dx = f * dx / d; dy = f * dy / d
      a.vx += dx; a.vy += dy; b.vx -= dx; b.vy -= dy
    }
  }
  for (const e of edges) {
    const a = byId[e.a], b = byId[e.b]
    if (!visible(a) || !visible(b)) continue
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) + 0.01
    const L = e.k === 'root' ? 130 : 60   // inti→kategori lebih jauh, kategori→pesan lebih dekat
    const f = 0.03 * (d - L), fx = f * dx / d, fy = f * dy / d
    a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy
  }
  const cx = W / 2, cy = H / 2
  for (const n of live) {
    if (n.kind === 'root') { n.x = cx; n.y = cy; n.vx = 0; n.vy = 0; continue } // inti dipin di tengah
    n.vx += (cx - n.x) * 0.0012; n.vy += (cy - n.y) * 0.0012
    if (n === drag) continue
    const sp = Math.hypot(n.vx, n.vy); if (sp > 30) { n.vx *= 30 / sp; n.vy *= 30 / sp }
    n.x += n.vx * alpha; n.y += n.vy * alpha; n.vx *= 0.85; n.vy *= 0.85
  }
  alpha *= 0.988
}

function dimmed(id: string): boolean {
  const n = byId[id]
  if (query) {
    const hit = (x: GNode) => (x.label + ' ' + (x.full || '')).toLowerCase().includes(query)
    if (hit(n)) return false
    let near = false; nbr[id].forEach(x => { if (hit(byId[x])) near = true }); return !near
  }
  const f = hover || sel
  if (!f) return false
  return id !== f.id && !nbr[f.id].has(id)
}

function sx(n: GNode) { return n.x * scale + tx }
function sy(n: GNode) { return n.y * scale + ty }

function draw() {
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, W, H)
  const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7)
  g.addColorStop(0, '#0e1430'); g.addColorStop(1, '#080a14')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)

  const f = hover || sel
  // edges
  for (const e of edges) {
    const a = byId[e.a], b = byId[e.b]
    if (!visible(a) || !visible(b)) continue
    const on = !!f && (e.a === f.id || e.b === f.id)
    const faded = dimmed(e.a) && dimmed(e.b)
    ctx.globalAlpha = faded ? 0.06 : on ? 0.9 : e.k === 'root' ? 0.3 : 0.16
    ctx.strokeStyle = on ? '#9fb4ff' : e.k === 'root' ? '#7e8bc0' : '#5b6aa0'
    ctx.lineWidth = on ? 1.6 : e.k === 'root' ? 1.2 : 0.7
    ctx.beginPath(); ctx.moveTo(sx(a), sy(a)); ctx.lineTo(sx(b), sy(b)); ctx.stroke()
  }
  ctx.globalAlpha = 1

  // nodes
  for (const n of nodes) {
    if (!visible(n)) continue
    const faded = dimmed(n.id)
    const isF = !!f && f.id === n.id
    const px = sx(n), py = sy(n), r = n.r * Math.max(0.7, Math.min(scale, 1.8))
    ctx.globalAlpha = faded ? 0.18 : 1
    if (!faded && (n.kind !== 'lesson' || isF)) { ctx.shadowColor = n.color; ctx.shadowBlur = n.kind === 'root' ? 26 : isF ? 22 : 10 }
    else ctx.shadowBlur = 0
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2)
    ctx.fillStyle = n.color; ctx.fill()
    if (n.kind === 'root') { ctx.shadowBlur = 0; ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(62,109,240,.9)'; ctx.stroke() }
    else if (isF) { ctx.shadowBlur = 0; ctx.lineWidth = 2.4; ctx.strokeStyle = '#fff'; ctx.stroke() }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1

    const showLabel = n.kind === 'root' || n.kind === 'cat' || isF || (!!f && nbr[f.id].has(n.id)) ||
      (!!query && (n.label + ' ' + (n.full || '')).toLowerCase().includes(query))
    if (showLabel && !faded) {
      ctx.font = (n.kind === 'root' ? '700 14px ' : n.kind === 'cat' ? '600 12px ' : '500 11px ') + 'system-ui,-apple-system,sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      const label = n.label.length > 34 ? n.label.slice(0, 34) + '…' : n.label
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,10,20,.85)'; ctx.strokeText(label, px, py + r + 3)
      ctx.fillStyle = n.kind === 'root' ? '#fff' : n.kind === 'cat' ? '#fff' : '#aeb8d4'
      ctx.fillText(label, px, py + r + 3)
    }
  }
}

function loop() {
  running = true
  if (!frozen) tick()
  draw()
  if ((alpha > 0.02 && !frozen) || drag) raf = requestAnimationFrame(loop)
  else { running = false; draw() }
}
function reheat(v: number) { if (frozen) { draw(); return } alpha = Math.max(alpha, v); if (!running) loop() }

function resize() {
  if (!canvas || !ctx) return
  const rect = canvas.getBoundingClientRect()
  W = rect.width; H = rect.height
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = W * dpr; canvas.height = H * dpr
  draw()
}

function hit(mx: number, my: number): GNode | null {
  let best: GNode | null = null, bd = Infinity
  for (const n of nodes) {
    if (!visible(n)) continue
    const dx = mx - sx(n), dy = my - sy(n), d = dx * dx + dy * dy
    const rr = (n.r * Math.max(0.7, Math.min(scale, 1.8)) + 7); const rr2 = rr * rr
    if (d < rr2 && d < bd) { bd = d; best = n }
  }
  return best
}
function pt(ev: MouseEvent) {
  const r = canvas!.getBoundingClientRect()
  return { x: ev.clientX - r.left, y: ev.clientY - r.top }
}

function onMove(ev: MouseEvent) {
  const p = pt(ev)
  if (drag) {
    drag.x = (p.x - tx) / scale; drag.y = (p.y - ty) / scale; drag.vx = 0; drag.vy = 0
    moved = true; reheat(0.3); return
  }
  if (panning) {
    tx = panStart.tx + (p.x - panStart.x); ty = panStart.ty + (p.y - panStart.y)
    moved = true; if (!running) draw(); return
  }
  const h = hit(p.x, p.y)
  if (h !== hover) { hover = h; canvas!.style.cursor = h ? 'pointer' : 'grab'; if (!running) draw() }
}
function onDown(ev: MouseEvent) {
  const p = pt(ev); downAt = { x: p.x, y: p.y }; moved = false
  const h = hit(p.x, p.y)
  if (h) { drag = h; reheat(0.4) }
  else { panning = true; panStart = { x: p.x, y: p.y, tx, ty }; canvas!.style.cursor = 'grabbing' }
}
function onUp(ev: MouseEvent) {
  const p = pt(ev)
  const click = Math.hypot(p.x - downAt.x, p.y - downAt.y) < 5 && !moved
  if (click) {
    const n = hit(p.x, p.y)
    sel = n; renderDetail(n)
  }
  drag = null; panning = false; if (canvas) canvas.style.cursor = hover ? 'pointer' : 'grab'
  if (!running) draw()
}
function onWheel(ev: WheelEvent) {
  ev.preventDefault()
  const r = canvas!.getBoundingClientRect()
  const mx = ev.clientX - r.left, my = ev.clientY - r.top
  const factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12
  const ns = Math.max(0.3, Math.min(3.5, scale * factor))
  tx = mx - (mx - tx) * (ns / scale); ty = my - (my - ty) * (ns / scale)
  scale = ns; if (!running) draw()
}

function zoomBy(factor: number) {
  const cx = W / 2, cy = H / 2
  const ns = Math.max(0.3, Math.min(3.5, scale * factor))
  tx = cx - (cx - tx) * (ns / scale); ty = cy - (cy - ty) * (ns / scale)
  scale = ns; if (!running) draw()
}
function resetView() { scale = 1; tx = 0; ty = 0; if (!running) draw() }

function renderStats() {
  const el = document.getElementById('g-stats'); if (!el) return
  const dates = lessons.map(l => l.date).filter(Boolean).sort()
  const cats = new Set(lessons.map(l => (l.category || 'Tanpa Kategori'))).size
  const range = dates.length ? `${dates[0]} → ${dates[dates.length - 1]}` : '—'
  const cell = (n: string | number, l: string) =>
    `<div class="g-stat"><div class="g-stat-n">${n}</div><div class="g-stat-l">${l}</div></div>`
  el.innerHTML = cell(lessons.length, 'Pesan') + cell(cats, 'Kategori') +
    cell(edges.length, 'Koneksi') +
    `<div class="g-stat g-stat-wide"><div class="g-stat-n" style="font-size:12px">${range}</div><div class="g-stat-l">Rentang</div></div>`
}

function renderLegend() {
  const el = document.getElementById('g-legend'); if (!el) return
  const cats = nodes.filter(n => n.kind === 'cat').sort((a, b) => b.count - a.count)
  el.innerHTML = '<div class="g-legend-ttl">Kategori</div>' + cats.map(c => {
    const off = hiddenCats.has(c.label)
    return `<div class="g-leg-row${off ? ' off' : ''}" data-cat="${encodeURIComponent(c.label)}">
      <span class="g-leg-dot" style="background:${c.color}"></span>
      <span class="g-leg-name">${c.label}</span>
      <span class="g-leg-cnt">${c.count}</span>
    </div>`
  }).join('')
}

function renderDetail(n: GNode | null) {
  const el = document.getElementById('g-detail'); if (!el) return
  if (!n) {
    el.innerHTML = `<div class="g-d-empty"><div class="g-d-empty-ic">◓</div>Klik inti, kategori, atau pesan buat baca detailnya. Hover buat lihat jaringannya.</div>`
    return
  }
  if (n.kind === 'lesson') {
    el.innerHTML = `<div class="g-d-head">
        <span class="g-d-pill" style="background:${n.color}22;color:${n.color};border:1px solid ${n.color}55">${n.cat}</span>
        <span class="g-d-date">${n.date || ''}</span>
      </div>
      <div class="g-d-text">${escapeHtml(n.full || '')}</div>`
    return
  }
  if (n.kind === 'root') {
    const cats = nodes.filter(x => x.kind === 'cat').sort((a, b) => b.count - a.count)
    el.innerHTML = `<div class="g-d-head">
        <span class="g-d-title">${escapeHtml(n.label)}</span>
        <span class="g-d-date">${lessons.length} pesan · ${cats.length} kategori</span>
      </div>
      <div class="g-d-list">${cats.map(k =>
        `<div class="g-d-item" data-id="${k.id}"><span class="g-d-item-dot" style="background:${k.color}"></span>${escapeHtml(k.label)}<span style="margin-left:auto;font-size:10px;color:var(--pg-text3);font-weight:700">${k.count}</span></div>`
      ).join('')}</div>`
    return
  }
  // kategori
  const kids = nodes.filter(x => x.kind === 'lesson' && nbr[n.id].has(x.id))
  el.innerHTML = `<div class="g-d-head">
      <span class="g-d-title">${escapeHtml(n.label)}</span>
      <span class="g-d-date">${kids.length} pesan</span>
    </div>
    <div class="g-d-list">${kids.map(k =>
      `<div class="g-d-item" data-id="${k.id}"><span class="g-d-item-dot" style="background:${k.color}"></span>${escapeHtml(k.label)}</div>`
    ).join('')}</div>`
}
const HTML_ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
function escapeHtml(s: string) { return s.replace(/[&<>"']/g, c => HTML_ESC[c] || c) }

function focusNodeById(id: string) {
  const n = byId[id]; if (!n) return
  sel = n; renderDetail(n)
  // center on it
  tx = W / 2 - n.x * scale; ty = H / 2 - n.y * scale
  if (!running) draw()
}

async function init() {
  canvas = document.getElementById('g-canvas') as HTMLCanvasElement
  ctx = canvas.getContext('2d')
  resize()
  ro = new ResizeObserver(() => resize()); ro.observe(canvas)

  canvas.addEventListener('mousemove', onMove)
  canvas.addEventListener('mousedown', onDown)
  window.addEventListener('mouseup', onUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })

  document.getElementById('g-search')?.addEventListener('input', e => {
    query = (e.target as HTMLInputElement).value.toLowerCase().trim(); reheat(0.1); if (!running) draw()
  })
  document.getElementById('g-tg-freeze')?.addEventListener('click', e => {
    frozen = !frozen; (e.currentTarget as HTMLElement).classList.toggle('active', frozen)
    if (!frozen) reheat(0.4)
  })
  document.getElementById('g-zin')?.addEventListener('click', () => zoomBy(1.25))
  document.getElementById('g-zout')?.addEventListener('click', () => zoomBy(1 / 1.25))
  document.getElementById('g-zreset')?.addEventListener('click', resetView)

  document.getElementById('g-legend')?.addEventListener('click', e => {
    const row = (e.target as HTMLElement).closest('.g-leg-row') as HTMLElement | null
    if (!row) return
    const cat = decodeURIComponent(row.dataset.cat || '')
    if (hiddenCats.has(cat)) hiddenCats.delete(cat); else hiddenCats.add(cat)
    renderLegend(); reheat(0.4)
  })
  document.getElementById('g-detail')?.addEventListener('click', e => {
    const item = (e.target as HTMLElement).closest('[data-id]') as HTMLElement | null
    if (item?.dataset.id) focusNodeById(item.dataset.id)
  })

  try {
    const d = await api('/api/data')
    lessons = (d.lessons || []).filter(l => (l.text || '').trim())
  } catch { lessons = [] }

  try {
    const me = await fetch('/api/auth/me').then(r => r.ok ? r.json() : null)
    if (me?.name) userName = me.name
  } catch { /* default 'Saya' */ }

  if (!lessons.length) {
    const empty = document.getElementById('g-empty'); if (empty) empty.style.display = 'flex'
  }
  buildGraph(); seed(); renderStats(); renderLegend(); renderDetail(null)
  alpha = 1; loop()
}

export default function GardenPage() {
  const initRef = useRef(false)
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    init()
    return () => {
      cancelAnimationFrame(raf); running = false
      if (ro) { ro.disconnect(); ro = null }
      if (canvas) {
        canvas.removeEventListener('mousemove', onMove)
        canvas.removeEventListener('mousedown', onDown)
        canvas.removeEventListener('wheel', onWheel)
      }
      window.removeEventListener('mouseup', onUp)
      lessons = []; nodes = []; edges = []
      hover = sel = drag = null; tx = ty = 0; scale = 1
    }
  }, [])

  return (
    <DashboardShell title="Peta">
      <style>{`
        :root{
          --pg-text:#eef0f5;--pg-text2:#97a0b3;--pg-text3:#687087;
          --pg-border:rgba(255,255,255,.09);--pg-panel:#0d1120;
        }
        .peta-wrap{display:grid;grid-template-columns:1fr 320px;height:calc(100vh - 52px);overflow:hidden;}
        .peta-canvas-area{position:relative;overflow:hidden;background:#080a14;}
        #g-canvas{display:block;width:100%;height:100%;cursor:grab;}
        .g-topbar{position:absolute;top:14px;left:14px;right:14px;display:flex;gap:8px;align-items:center;pointer-events:none;z-index:5;}
        .g-topbar > *{pointer-events:auto;}
        .g-search{flex:1;max-width:380px;position:relative;}
        .g-search input{width:100%;background:rgba(13,17,32,.82);backdrop-filter:blur(8px);border:1px solid var(--pg-border);border-radius:9px;padding:9px 12px;font-size:12px;color:var(--pg-text);outline:none;box-sizing:border-box;}
        .g-search input:focus{border-color:rgba(62,109,240,.6);}
        .g-search input::placeholder{color:var(--pg-text3);}
        .g-btn{background:rgba(13,17,32,.82);backdrop-filter:blur(8px);border:1px solid var(--pg-border);border-radius:9px;padding:9px 13px;font-size:11px;font-weight:600;color:var(--pg-text2);cursor:pointer;transition:all .15s;letter-spacing:.02em;}
        .g-btn:hover{color:var(--pg-text);border-color:rgba(255,255,255,.2);}
        .g-btn.active{background:rgba(62,109,240,.22);border-color:rgba(62,109,240,.55);color:#cdd9ff;}
        .g-stats{position:absolute;bottom:14px;left:14px;display:flex;gap:7px;flex-wrap:wrap;z-index:5;max-width:62%;}
        .g-stat{background:rgba(13,17,32,.82);backdrop-filter:blur(8px);border:1px solid var(--pg-border);border-radius:9px;padding:7px 12px;min-width:60px;}
        .g-stat-n{font-size:16px;font-weight:700;color:var(--pg-text);line-height:1.1;}
        .g-stat-l{font-size:8.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--pg-text3);margin-top:2px;}
        .g-legend{position:absolute;top:60px;right:14px;width:166px;background:rgba(13,17,32,.85);backdrop-filter:blur(8px);border:1px solid var(--pg-border);border-radius:11px;padding:9px 6px 7px;z-index:5;max-height:46%;overflow:auto;}
        .g-legend-ttl{font-size:8.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--pg-text3);padding:0 8px 6px;}
        .g-leg-row{display:flex;align-items:center;gap:7px;padding:5px 8px;border-radius:6px;cursor:pointer;transition:background .12s;}
        .g-leg-row:hover{background:rgba(255,255,255,.05);}
        .g-leg-row.off{opacity:.38;}
        .g-leg-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
        .g-leg-name{flex:1;font-size:11px;color:var(--pg-text);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .g-leg-cnt{font-size:9px;color:var(--pg-text3);font-weight:700;}
        .g-zoom{position:absolute;bottom:14px;right:14px;display:flex;flex-direction:column;gap:5px;z-index:5;}
        .g-zoom button{width:32px;height:32px;background:rgba(13,17,32,.85);backdrop-filter:blur(8px);border:1px solid var(--pg-border);border-radius:8px;color:var(--pg-text2);font-size:15px;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;}
        .g-zoom button:hover{color:var(--pg-text);border-color:rgba(255,255,255,.25);}
        .g-empty{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--pg-text3);font-size:13px;text-align:center;padding:24px;}
        .g-empty-ic{font-size:34px;opacity:.5;}
        .g-detail{background:var(--pg-panel);border-left:1px solid var(--pg-border);overflow-y:auto;padding:18px 16px;}
        .g-d-empty{color:var(--pg-text3);font-size:12.5px;line-height:1.7;text-align:center;margin-top:40px;}
        .g-d-empty-ic{font-size:30px;opacity:.4;margin-bottom:10px;}
        .g-d-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:13px;flex-wrap:wrap;}
        .g-d-pill{font-size:10px;font-weight:600;padding:3px 10px;border-radius:999px;}
        .g-d-title{font-size:15px;font-weight:700;color:var(--pg-text);}
        .g-d-date{font-size:10px;color:var(--pg-text3);font-weight:600;}
        .g-d-text{font-size:13.5px;line-height:1.72;color:var(--pg-text);white-space:pre-wrap;word-break:break-word;}
        .g-d-list{display:flex;flex-direction:column;gap:2px;}
        .g-d-item{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:7px;font-size:12px;color:var(--pg-text2);cursor:pointer;transition:all .12s;line-height:1.4;}
        .g-d-item:hover{background:rgba(255,255,255,.05);color:var(--pg-text);}
        .g-d-item-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
        @media(max-width:768px){
          .peta-wrap{grid-template-columns:1fr;grid-template-rows:1fr auto;}
          .g-detail{border-left:none;border-top:1px solid var(--pg-border);max-height:38vh;}
          .g-legend{max-height:30%;}
          .g-stats{max-width:90%;}
        }
      `}</style>
      <div className="peta-wrap">
        <div className="peta-canvas-area">
          <canvas id="g-canvas" />
          <div className="g-topbar">
            <div className="g-search"><input id="g-search" placeholder="Cari pesan atau kategori…" /></div>
            <button id="g-tg-freeze" className="g-btn" title="Bekukan gerakan">Freeze</button>
          </div>
          <div className="g-stats" id="g-stats" />
          <div className="g-legend" id="g-legend" />
          <div className="g-zoom">
            <button id="g-zin" aria-label="Zoom in">+</button>
            <button id="g-zout" aria-label="Zoom out">−</button>
            <button id="g-zreset" aria-label="Reset tampilan">⊙</button>
          </div>
          <div className="g-empty" id="g-empty">
            <div className="g-empty-ic">◓</div>
            <div>Belum ada lesson yang tercatat.<br />Mulai catat pembelajaran harian di halaman GST, nanti petanya kebentuk sendiri di sini.</div>
          </div>
        </div>
        <aside className="g-detail" id="g-detail" />
      </div>
    </DashboardShell>
  )
}
