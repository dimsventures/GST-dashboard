'use client'

import { useEffect, useRef } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'

const ACT_CATS = [
  { key: 'religion',  label: 'Religion',      color: 'rgba(59,130,246,.85)' },
  { key: 'work',      label: 'Working Stage', color: 'rgba(239,68,68,.85)' },
  { key: 'personal',  label: 'Personal Wish', color: 'rgba(245,158,11,.85)' },
  { key: 'exercise',  label: 'Exercise',      color: 'rgba(34,197,94,.85)' },
  { key: 'habit',     label: 'Habit',         color: 'rgba(139,92,246,.85)' },
  { key: 'humanity',  label: 'Humanity',      color: 'rgba(20,184,166,.85)' },
]
const PORTO_COLORS = ['#3b82f6','#ef4444','#f59e0b','#10b981','#8b5cf6','#06b6d4','#ec4899']
const MN_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

let ChartLib: typeof import('chart.js') | null = null
async function getChart() {
  if (!ChartLib) {
    ChartLib = await import('chart.js')
    ChartLib.Chart.register(...ChartLib.registerables)
  }
  return ChartLib.Chart
}

let dashAllocChart: import('chart.js').Chart | null = null
let gstChart: import('chart.js').Chart | null = null
let portoHidden = false
let finHidden = false
let gstData: Record<string, unknown> = {}
let gstFilter = 'month'
let lastFinTxs: unknown[] = []
let clockTimer: ReturnType<typeof setInterval> | null = null

function fmt(n: number) { return 'Rp ' + Math.round(n).toLocaleString('id-ID') }
function fmtShort(n: number) {
  if (n >= 1000000000) return 'Rp ' + (n/1000000000).toFixed(2) + 'M'
  if (n >= 1000000) return 'Rp ' + (n/1000000).toFixed(1) + 'jt'
  return fmt(n)
}
function currentMonth() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0')
}

function startDashClock() {
  const canvas = document.getElementById('dash-clock') as HTMLCanvasElement
  if (!canvas) return
  const draw = () => {
    const ctx = canvas.getContext('2d')!
    const n = new Date()
    const w = canvas.width, cx = w/2, cy = w/2, r = cx - 1.5
    ctx.clearRect(0, 0, w, w)
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2*Math.PI); ctx.fillStyle = '#fff'; ctx.fill()
    ctx.strokeStyle = '#444'; ctx.lineWidth = 1; ctx.stroke()
    const hrs = n.getHours()%12, mins = n.getMinutes(), secs = n.getSeconds()
    const ha = (hrs*30 + mins*0.5)*Math.PI/180
    ctx.beginPath(); ctx.moveTo(cx, cy)
    ctx.lineTo(cx + (r*.5)*Math.sin(ha), cy - (r*.5)*Math.cos(ha))
    ctx.strokeStyle = '#eee'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke()
    const ma = (mins*6 + secs*.1)*Math.PI/180
    ctx.beginPath(); ctx.moveTo(cx, cy)
    ctx.lineTo(cx + (r*.72)*Math.sin(ma), cy - (r*.72)*Math.cos(ma))
    ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.stroke()
    ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, 2*Math.PI); ctx.fillStyle = '#d12b2b'; ctx.fill()
  }
  draw()
  if (clockTimer) clearInterval(clockTimer)
  clockTimer = setInterval(draw, 1000)
}

function renderGST(data: Record<string, unknown>) {
  gstData = data
  const entries  = (data.entries  as unknown[] || [])
  const wishes   = (data.wishes   as unknown[] || [])
  const lessons  = ((data.lessons as Array<{text:string}> || [])).reduce((n, l) => {
    try { return n + (JSON.parse(l.text) || []).length } catch { return n }
  }, 0)
  const now = new Date()
  const eoy = new Date(now.getFullYear(), 11, 31)
  const daysLeft = Math.ceil((eoy.getTime() - now.getTime()) / 86400000)

  const el = (id: string) => document.getElementById(id)
  if (el('ov-hari')) el('ov-hari')!.textContent = String(entries.length)
  if (el('ov-dream')) el('ov-dream')!.textContent = String(wishes.length)
  if (el('ov-lesson')) el('ov-lesson')!.textContent = String(lessons)
  if (el('ov-left')) el('ov-left')!.textContent = String(daysLeft)

  startDashClock()
  renderGSTChart(gstFilter)
}

async function renderGSTChart(filter: string) {
  gstFilter = filter
  const activities = (gstData.activities as Array<{date:string;category:string}> || [])
  let labels: string[] = [], dates: string[] = []
  const now = new Date(), yr = now.getFullYear(), mo = now.getMonth()

  const tagEl = document.getElementById('gst-tag')

  if (filter === 'month') {
    const daysInMonth = new Date(yr, mo+1, 0).getDate()
    const prefix = `${yr}-${String(mo+1).padStart(2,'0')}`
    dates = Array.from({ length: daysInMonth }, (_, i) => `${prefix}-${String(i+1).padStart(2,'0')}`)
    labels = dates.map(d => d.slice(8))
    if (tagEl) tagEl.textContent = MN_SHORT[mo] + ' ' + yr
  } else {
    const start = new Date(yr, 0, 1)
    const end = new Date(yr, mo, now.getDate())
    for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
      const s = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      dates.push(s)
      labels.push(d.getDate() === 1 ? MN_SHORT[d.getMonth()] : '')
    }
    if (tagEl) tagEl.textContent = 'YTD ' + yr
  }

  const datasets = ACT_CATS.map(c => ({
    label: c.label,
    data: dates.map(d => activities.filter(a => a.date === d && a.category === c.key).length),
    backgroundColor: c.color, borderRadius: 2, stack: 's'
  }))

  const Chart = await getChart()
  if (gstChart) { gstChart.destroy(); gstChart = null }
  const canvas = document.getElementById('gst-chart') as HTMLCanvasElement
  if (!canvas) return
  gstChart = new Chart(canvas, {
    type: 'bar', data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { mode: 'index', intersect: false, callbacks: { title: ctx => dates[(ctx[0] as {dataIndex:number}).dataIndex] || '' } }
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { font: { size: 8 }, color: '#666', maxRotation: 0, autoSkip: false } },
        y: { stacked: true, grid: { color: 'rgba(255,255,255,.06)' }, ticks: { font: { size: 8 }, color: '#666' }, min: 0 },
      }
    }
  })
}

function setGSTFilter(f: string, btn: HTMLElement) {
  document.querySelectorAll('.gst-filter').forEach(b => { b.classList.remove('gst-active') })
  btn.classList.add('gst-active')
  renderGSTChart(f)
}

function openGSTModal(type: string) {
  const overlay = document.getElementById('gst-moverlay')
  const title = document.getElementById('gst-mtitle')
  const body = document.getElementById('gst-mbody')
  if (!overlay || !title || !body) return
  overlay.style.display = 'flex'

  if (type === 'dream') {
    title.textContent = '✦ Dream List'
    const wishes = (gstData.wishes as Array<{done:boolean;text:string;achievement_story?:string}> || [])
    const done = wishes.filter(w => w.done), undone = wishes.filter(w => !w.done)
    const row = (w: typeof wishes[0]) => `<div style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;gap:10px;">
      <span style="font-size:14px;margin-top:1px;color:${w.done ? 'var(--green)' : 'var(--text4)'};">${w.done ? '✓' : '○'}</span>
      <div>
        <div style="font-size:12px;font-weight:600;color:${w.done ? 'var(--text3)' : 'var(--text)'};">${w.text}</div>
        ${w.done && w.achievement_story ? `<div style="font-size:10px;color:var(--text3);margin-top:3px;font-style:italic;">${w.achievement_story}</div>` : ''}
      </div>
    </div>`
    body.innerHTML = undone.map(row).join('') +
      (done.length ? `<div style="font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--text3);margin:12px 0 4px;text-transform:uppercase;">Tercapai</div>` + done.map(row).join('') : '') ||
      '<div style="text-align:center;padding:24px;color:var(--text4);">Belum ada dream.</div>'

  } else if (type === 'lesson') {
    title.textContent = 'Lessons This Year'
    const yr = new Date().getFullYear()
    const allItems: Array<{ts?:string;text:string}> = []
    ;(gstData.lessons as Array<{text:string}> || []).forEach(l => { try { (JSON.parse(l.text) || []).forEach((it: {ts?:string;text:string}) => allItems.push(it)) } catch {} })
    const thisYear = allItems.filter(it => !it.ts || new Date(it.ts).getFullYear() === yr).reverse()
    body.innerHTML = thisYear.length
      ? `<div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:.06em;margin:10px 0 8px;text-transform:uppercase;">Hidup ${yr} mengajarkan...</div>` +
        thisYear.map(it => `<div style="padding:9px 0;border-bottom:1px solid var(--border);">
          <div style="font-size:12px;color:var(--text);line-height:1.5;">${it.text}</div>
          ${it.ts ? `<div style="font-size:9px;color:var(--text4);margin-top:3px;">${new Date(it.ts).toLocaleDateString('id-ID',{day:'numeric',month:'long'})}</div>` : ''}
        </div>`).join('')
      : '<div style="text-align:center;padding:24px;color:var(--text4);">Belum ada lesson tahun ini.</div>'

  } else if (type === 'goals') {
    title.textContent = 'Goals Belum Tercapai'
    const goals = (gstData.goals as Array<{done:boolean;scope?:string;yr?:number;ym?:string;text:string}> || []).filter(g => !g.done)
    const yr = new Date().getFullYear()
    const annual = goals.filter(g => g.scope === 'year' || (!g.scope && g.yr === yr))
    const monthly = goals.filter(g => g.scope === 'month')
    const section = (arr: typeof goals, lbl: string) => arr.length
      ? `<div style="font-size:9px;font-weight:700;color:var(--text3);letter-spacing:.06em;margin:10px 0 4px;text-transform:uppercase;">${lbl}</div>` +
        arr.map(g => `<div style="padding:8px 0;border-bottom:1px solid var(--border);">
          <div style="font-size:12px;font-weight:600;color:var(--text);">${g.text}</div>
          ${g.ym ? `<div style="font-size:9px;color:var(--text4);margin-top:2px;">${g.ym}</div>` : ''}
        </div>`).join('') : ''
    body.innerHTML = section(annual, 'Tahunan') + section(monthly, 'Bulanan') ||
      '<div style="text-align:center;padding:24px;color:var(--text4);">Semua goals tercapai! 🎉</div>'
  }
}

function closeGSTModal() {
  const el = document.getElementById('gst-moverlay')
  if (el) el.style.display = 'none'
}

function renderFinance(txs: Array<{type:string;amount:number;category?:string}>) {
  lastFinTxs = txs
  let income = 0, expense = 0, invest = 0, deposit = 0
  ;(txs || []).forEach(t => {
    const a = Number(t.amount) || 0
    if (t.type === 'income') income += a
    else if (t.type === 'expense') expense += a
    else if (t.type === 'investment') { invest += a; if (t.category === 'Deposit') deposit += a }
  })
  const sisa = income - expense - invest
  const rate = income > 0 ? Math.round((deposit/income)*100) : 0
  const neg = rate < 0

  const month = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  const tagEl = document.getElementById('fin-tag')
  if (tagEl) tagEl.textContent = month
  const h = finHidden
  const mask = '••••••'
  const rateEl = document.getElementById('fin-rate')
  if (rateEl) { rateEl.textContent = h ? mask : rate + '%'; rateEl.className = 'fin-bar-pct' + (neg ? ' neg' : '') }
  const fill = document.getElementById('fin-bar-fill')
  if (fill) { fill.style.width = h ? '0%' : Math.max(0, Math.min(100, Math.abs(rate))) + '%'; neg ? fill.classList.add('neg') : fill.classList.remove('neg') }

  let dailyHtml = ''
  const endStr = localStorage.getItem('gst_budget_end') || ''
  if (endStr) {
    const today = new Date(); today.setHours(0,0,0,0)
    const end = new Date(endStr + 'T00:00:00')
    const diff = Math.ceil((end.getTime() - today.getTime()) / (1000*60*60*24))
    if (diff > 0) {
      const daily = Math.round(sisa/diff)
      dailyHtml = `<div class="fin-row" style="background:rgba(255,255,255,.04);border-radius:4px;padding:7px 8px;margin-top:2px;">
        <span class="fin-label" style="font-size:9px;">Est. Harian <span style="color:var(--text4);">(${diff}d)</span></span>
        <span class="fin-val ${daily>0?'green':'red'}" style="font-size:11px;">${h?mask:fmtShort(Math.abs(daily))}</span>
      </div>`
    }
  }
  const finRows = document.getElementById('fin-rows')
  if (finRows) finRows.innerHTML = `
    <div class="fin-row">
      <span class="fin-label"><span class="fin-dot" style="background:var(--green)"></span>Income</span>
      <span class="fin-val green">${h?mask:fmtShort(income)}</span>
    </div>
    <div class="fin-row">
      <span class="fin-label"><span class="fin-dot" style="background:var(--red)"></span>Life Cost</span>
      <span class="fin-val red">${h?mask:fmtShort(expense)}</span>
    </div>
    <div class="fin-row">
      <span class="fin-label"><span class="fin-dot" style="background:var(--blue)"></span>Investment</span>
      <span class="fin-val">${h?mask:fmtShort(invest)}</span>
    </div>
    <div class="fin-row">
      <span class="fin-label"><span class="fin-dot" style="background:var(--gold)"></span>Sisa</span>
      <span class="fin-val ${sisa>=0?'green':'red'}">${h?mask:fmtShort(Math.abs(sisa))}</span>
    </div>
    ${dailyHtml}
  `
}

function toggleFinHide() {
  finHidden = !finHidden
  const eye = document.getElementById('fin-eye')
  if (eye) eye.textContent = finHidden ? '🙈' : '👁'
  renderFinance(lastFinTxs as Parameters<typeof renderFinance>[0])
}

async function renderPortfolio(
  assets: Array<{is_active:boolean;currency:string;cash_idle:number}>,
  activePos: Array<{ticker:string;ticker_type:string;qty:number}>,
  prices: Record<string, {price:number}>,
  usdRate: number,
  _investTxs: unknown[]
) {
  function mktVal(p: typeof activePos[0]) {
    const pr = prices[p.ticker]?.price || 0
    if (!pr) return 0
    if (p.ticker_type === 'stock_idr') return Number(p.qty)*100*pr
    if (p.ticker_type === 'crypto') return Number(p.qty)*pr*usdRate
    return 0
  }

  let totalVal = 0
  activePos.forEach(p => { totalVal += mktVal(p) })
  const totalCash = (assets||[]).filter(a => a.is_active).reduce((s, a) => {
    const c = Number(a.cash_idle) || 0
    return s + (a.currency === 'USD' ? c*usdRate : c)
  }, 0)
  totalVal += totalCash

  const tagEl = document.getElementById('porto-tag')
  if (tagEl) tagEl.textContent = currentMonth()
  const totalEl = document.getElementById('porto-total')
  if (totalEl) totalEl.style.color = totalVal > 0 ? 'var(--green)' : 'var(--red)'

  const merged: Record<string, number> = {}
  activePos.forEach(p => { const mv = mktVal(p); if (mv > 0) merged[p.ticker] = (merged[p.ticker] || 0) + mv })
  const labels = Object.keys(merged).sort((a,b) => merged[b]-merged[a])
  const values = labels.map(l => merged[l])
  if (totalCash > 0) { labels.push('Cash'); values.push(totalCash) }

  const raw = fmt(totalVal)
  const setVis = (hide: boolean) => {
    if (totalEl) totalEl.textContent = hide ? '••••••' : raw
    const leg = document.getElementById('dash-alloc-legend')
    if (leg) leg.style.visibility = hide ? 'hidden' : 'visible'
  }
  setVis(portoHidden)

  const colors = labels.map((l, i) => l === 'Cash' ? '#9ca3af' : PORTO_COLORS[i % PORTO_COLORS.length])
  const canvas = document.getElementById('dash-alloc-chart') as HTMLCanvasElement
  if (dashAllocChart) { dashAllocChart.destroy(); dashAllocChart = null }
  const Chart = await getChart()
  if (values.length && canvas) {
    dashAllocChart = new Chart(canvas, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: '#1a1a1a' }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => `${ctx.label}: ${fmt(ctx.raw as number)} (${((ctx.raw as number)/totalVal*100).toFixed(1)}%)` } }
        }
      }
    })
  }

  const leg = document.getElementById('dash-alloc-legend')
  if (leg) leg.innerHTML = labels.map((l, i) => {
    const v = values[i], pct = (v/totalVal*100).toFixed(1), col = colors[i]
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);">
      <div style="display:flex;align-items:center;gap:7px;">
        <span style="width:7px;height:7px;border-radius:50%;background:${col};flex-shrink:0;display:inline-block;"></span>
        <span style="font-size:10px;font-weight:600;color:var(--text);">${l}</span>
      </div>
      <div>
        <span style="font-size:10px;font-weight:700;color:${l==='Cash'?'var(--gold)':'var(--text)'};">${fmtShort(v)}</span>
        <span style="font-size:9px;color:var(--text3);margin-left:5px;">${pct}%</span>
      </div>
    </div>`
  }).join('')
  if (portoHidden && leg) leg.style.visibility = 'hidden'
}

function togglePortoHide() {
  portoHidden = !portoHidden
  const eye = document.getElementById('porto-eye')
  if (eye) eye.textContent = portoHidden ? '🙈' : '👁'
  if (dashAllocChart) {
    const leg = document.getElementById('dash-alloc-legend')
    const totalEl = document.getElementById('porto-total')
    const totalVal = (dashAllocChart.data.datasets[0].data as number[]).reduce((s, v) => s + v, 0)
    if (totalEl) totalEl.textContent = portoHidden ? '••••••' : fmt(totalVal)
    if (leg) leg.style.visibility = portoHidden ? 'hidden' : 'visible'
  }
}

async function init() {
  const [gst, txs, allTxs, assets, positions] = await Promise.all([
    fetch('/api/data').then(r => r.json()).catch(() => ({})),
    fetch('/api/transactions?month=' + currentMonth()).then(r => r.json()).catch(() => []),
    fetch('/api/transactions').then(r => r.json()).catch(() => []),
    fetch('/api/portfolio/assets').then(r => r.json()).catch(() => []),
    fetch('/api/portfolio/positions').then(r => r.json()).catch(() => []),
  ])

  renderGST(gst)
  renderFinance(txs)

  const investTxs = (allTxs || []).filter((t: {type:string;category?:string;asset_id?:unknown}) => t.type === 'investment' && t.category === 'Deposit' && t.asset_id)
  const activePos = (positions || []).filter((p: {is_active:boolean;qty:number}) => p.is_active && Number(p.qty) > 0)

  const symbols: string[] = []
  activePos.forEach((p: {ticker:string;ticker_type:string}) => {
    if (p.ticker_type === 'stock_idr') symbols.push(p.ticker + '.JK')
    else if (p.ticker_type === 'crypto') symbols.push(p.ticker + '-USD')
    else symbols.push(p.ticker)
  })
  const needsUsd = (assets || []).some((a: {is_active:boolean;currency:string}) => a.is_active && a.currency === 'USD') ||
    activePos.some((p: {ticker_type:string}) => p.ticker_type === 'crypto')
  if (needsUsd) symbols.push('USDIDR=X')

  if (symbols.filter((s: string) => s !== 'USDIDR=X').length) {
    fetch('/api/portfolio/market-price?tickers=' + [...new Set(symbols)].join(','))
      .then(r => r.json())
      .then((data: {prices:Array<{symbol:string;ticker:string;price:number}>}) => {
        const prices: Record<string, {price:number}> = {}
        let usdRate = 0
        ;(data.prices || []).forEach(p => {
          if (p.symbol === 'USDIDR=X') usdRate = p.price
          else prices[p.ticker] = p
        })
        renderPortfolio(assets, activePos, prices, usdRate, investTxs)
      })
      .catch(() => renderPortfolio(assets, activePos, {}, 0, investTxs))
  } else {
    renderPortfolio(assets, activePos, {}, 0, investTxs)
  }
}

export default function DashboardPage() {
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    const w = window as unknown as Record<string, unknown>
    w.setGSTFilter = setGSTFilter
    w.openGSTModal = openGSTModal
    w.closeGSTModal = closeGSTModal
    w.toggleFinHide = toggleFinHide
    w.togglePortoHide = togglePortoHide

    init()

    return () => {
      if (clockTimer) { clearInterval(clockTimer); clockTimer = null }
      if (gstChart) { gstChart.destroy(); gstChart = null }
      if (dashAllocChart) { dashAllocChart.destroy(); dashAllocChart = null }
      delete w.setGSTFilter
      delete w.openGSTModal
      delete w.closeGSTModal
      delete w.toggleFinHide
      delete w.togglePortoHide
    }
  }, [])

  return (
    <DashboardShell title="Dashboard">
      <style>{`
        .dash-content{padding:20px 24px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px;align-content:start;}
        @media(max-width:768px){.dash-content{grid-template-columns:1fr;padding:12px;gap:12px;}}
        .card{background:var(--white);border:1px solid var(--border);border-radius:var(--r);box-shadow:var(--s1);overflow:hidden;}
        .card-hdr{padding:12px 16px 10px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
        .card-title{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text2);}
        .card-tag{font-size:9px;padding:2px 8px;border-radius:20px;font-weight:600;letter-spacing:.03em;}
        .card-tag.red{background:var(--red-bg);color:var(--red);border:1px solid var(--red-border);}
        .card-tag.green{background:var(--green-bg);color:var(--green);border:1px solid var(--green-border);}
        .card-tag.gold{background:var(--gold-bg);color:var(--gold);border:1px solid var(--gold-border);}
        .card-body{padding:16px;}
        .gst-ov{background:var(--red);border-radius:8px;padding:14px 16px;margin-bottom:12px;}
        .gst-ov-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
        .gst-ov-title{font-size:9px;font-weight:700;letter-spacing:.12em;color:#fff;text-transform:uppercase;}
        .gst-ov-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;}
        .gst-ov-box{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);border-radius:var(--r2);padding:9px 10px 7px;transition:all .15s;}
        .gst-ov-box.click{cursor:pointer;}
        .gst-ov-box.click:hover{border-color:rgba(255,255,255,.4);transform:translateY(-1px);}
        .gst-ov-val{font-size:20px;font-weight:700;color:#fff;line-height:1;}
        .gst-ov-val.gold{color:#fde68a;}
        .gst-ov-val.muted{color:#fecaca;}
        .gst-ov-lbl{font-size:8px;font-weight:500;color:rgba(255,255,255,.65);margin-top:2px;text-transform:uppercase;letter-spacing:.04em;}
        .gst-filter{font-size:9px;font-weight:700;padding:3px 10px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--text2);cursor:pointer;transition:all .15s;letter-spacing:.04em;}
        .gst-filter.gst-active{background:var(--blk);color:var(--white);border-color:var(--blk);}
        .chart-wrap{position:relative;height:150px;}
        .fin-row{display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);}
        .fin-row:last-child{border-bottom:none;}
        .fin-label{font-size:10px;color:var(--text3);font-weight:500;display:flex;align-items:center;gap:6px;}
        .fin-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
        .fin-val{font-size:12px;font-weight:700;color:var(--text);}
        .fin-val.green{color:var(--green);}
        .fin-val.red{color:var(--red);}
        .fin-bar-wrap{margin-top:12px;}
        .fin-bar-lbl{display:flex;justify-content:space-between;margin-bottom:5px;}
        .fin-bar-key{font-size:9px;color:var(--text3);letter-spacing:.06em;text-transform:uppercase;}
        .fin-bar-pct{font-size:9px;font-weight:700;color:var(--green);}
        .fin-bar-pct.neg{color:var(--red);}
        .fin-bar{height:5px;background:var(--border);border-radius:3px;overflow:hidden;}
        .fin-bar-fill{height:100%;background:var(--green);border-radius:3px;transition:width .5s;}
        .fin-bar-fill.neg{background:var(--red);}
        .porto-total{text-align:center;padding:14px 16px 10px;border-bottom:1px solid var(--border);}
        .porto-total-val{font-size:22px;font-weight:700;color:var(--green);}
        .porto-total-lbl{font-size:9px;color:var(--text3);margin-top:2px;letter-spacing:.06em;text-transform:uppercase;}
        .gst-moverlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:500;align-items:center;justify-content:center;padding:16px;}
        .gst-modal{background:var(--bg2);border:1px solid var(--border);border-radius:12px;width:100%;max-width:460px;max-height:82vh;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,.5);}
        .gst-mhdr{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border);flex-shrink:0;}
        .gst-mtitle{font-size:13px;font-weight:700;color:var(--text);}
        .gst-mbody{padding:4px 16px 16px;overflow-y:auto;}
        .gst-mclose{background:none;border:none;cursor:pointer;font-size:16px;color:var(--text3);line-height:1;padding:2px;}
        .loading{text-align:center;padding:20px;color:var(--text4);font-size:11px;font-style:italic;}
      `}</style>

      <div className="dash-content">

        {/* GST Card */}
        <div className="card">
          <div className="card-hdr">
            <span className="card-title">GST Progress</span>
            <span className="card-tag red" id="gst-tag">Bulan Ini</span>
          </div>
          <div className="card-body">
            <div className="gst-ov">
              <div className="gst-ov-hdr">
                <div className="gst-ov-title">Overview</div>
                <canvas id="dash-clock" width="32" height="32" style={{ borderRadius: '50%', background: '#1a1a1a', flexShrink: 0 }}></canvas>
              </div>
              <div className="gst-ov-grid">
                <div className="gst-ov-box"><div className="gst-ov-val" id="ov-hari">—</div><div className="gst-ov-lbl">Hari</div></div>
                <div className="gst-ov-box click" onClick={() => openGSTModal('dream')}><div className="gst-ov-val" id="ov-dream">—</div><div className="gst-ov-lbl">Dream</div></div>
                <div className="gst-ov-box click" onClick={() => openGSTModal('lesson')}><div className="gst-ov-val gold" id="ov-lesson">—</div><div className="gst-ov-lbl">Lesson</div></div>
                <div className="gst-ov-box click" onClick={() => openGSTModal('goals')}><div className="gst-ov-val muted" id="ov-left">—</div><div className="gst-ov-lbl">Left</div></div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
              <button onClick={e => setGSTFilter('month', e.currentTarget)} className="gst-filter gst-active">Bulan Ini</button>
              <button onClick={e => setGSTFilter('ytd', e.currentTarget)} className="gst-filter">YTD</button>
            </div>
            <div className="chart-wrap"><canvas id="gst-chart"></canvas></div>
          </div>
        </div>

        {/* Finance Card */}
        <div className="card">
          <div className="card-hdr">
            <span className="card-title">Finance</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="card-tag green" id="fin-tag">—</span>
              <button id="fin-eye" onClick={toggleFinHide} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: 'var(--text3)', padding: 0, lineHeight: 1 }}>👁</button>
            </div>
          </div>
          <div className="card-body">
            <div id="fin-rows"><div className="loading">Memuat...</div></div>
            <div className="fin-bar-wrap">
              <div className="fin-bar-lbl">
                <span className="fin-bar-key">Savings Rate</span>
                <span className="fin-bar-pct" id="fin-rate">—</span>
              </div>
              <div className="fin-bar"><div className="fin-bar-fill" id="fin-bar-fill" style={{ width: 0 }}></div></div>
            </div>
          </div>
        </div>

        {/* Portfolio Card */}
        <div className="card">
          <div className="card-hdr">
            <span className="card-title">Portfolio</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="card-tag gold" id="porto-tag">—</span>
              <button id="porto-eye" onClick={togglePortoHide} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: 'var(--text3)', padding: 0, lineHeight: 1 }}>👁</button>
            </div>
          </div>
          <div className="porto-total">
            <div className="porto-total-val" id="porto-total">—</div>
            <div className="porto-total-lbl">Total Portfolio Value</div>
          </div>
          <div style={{ position: 'relative', height: 170, padding: '8px 12px 0' }}>
            <canvas id="dash-alloc-chart"></canvas>
          </div>
          <div id="dash-alloc-legend" style={{ padding: '6px 14px 12px' }}></div>
        </div>

      </div>

      {/* GST Modal */}
      <div className="gst-moverlay" id="gst-moverlay" onClick={e => { if (e.target === e.currentTarget) closeGSTModal() }}>
        <div className="gst-modal">
          <div className="gst-mhdr">
            <div className="gst-mtitle" id="gst-mtitle"></div>
            <button className="gst-mclose" onClick={closeGSTModal}>✕</button>
          </div>
          <div className="gst-mbody" id="gst-mbody"></div>
        </div>
      </div>
    </DashboardShell>
  )
}
