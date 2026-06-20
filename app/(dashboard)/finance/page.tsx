'use client'

import { useEffect, useRef } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'

let ChartLib: typeof import('chart.js') | null = null
async function getChart() {
  if (!ChartLib) {
    ChartLib = await import('chart.js')
    ChartLib.Chart.register(...ChartLib.registerables)
  }
  return ChartLib.Chart
}

// Module-level state
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let finCats: Record<string, any[]> = { expense: [], income: [], investment: [], buffer: [] }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let finAccounts: any[] = []
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let transactions: any[] = [], bufferLogs: any[] = [], reconciliations: any[] = [], portfolioAssets: any[] = []
let currentType = 'expense', currentCat = '', currentMonth = '', bufDir = 'in'
let finChartInstance: import('chart.js').Chart | null = null
let numbersHidden = false, ytdYear = String(new Date().getFullYear())
let calY = new Date().getFullYear(), calM = new Date().getMonth()
let hiddenVals: Record<string, string> = {}
let bufExpCat = ''

const TYPE_COLOR: Record<string, string> = { income: '#15a34a', expense: '#d12b2b', investment: '#2563eb', buffer: '#c9841a' }
const TYPES = ['expense', 'income', 'investment', 'buffer']
const ACCTS_DEFAULT = [
  { name: 'Bank Jatim', legacy: 'bank_jatim' }, { name: 'Seabank', legacy: 'seabank' },
  { name: 'Bank Jago', legacy: 'bank_jago' }, { name: 'E-Wallet', legacy: 'ewallet' }, { name: 'Cash', legacy: 'cash' },
]
const CAT_COLORS_BASE: Record<string, string> = {
  'Housing': 'rgba(239,68,68,.85)', 'Consumption': 'rgba(245,158,11,.85)', 'Needs': 'rgba(34,197,94,.85)',
  'Joy': 'rgba(168,85,247,.85)', 'Transport': 'rgba(59,130,246,.85)', 'Utilities': 'rgba(20,184,166,.85)',
  'Electronic': 'rgba(249,115,22,.85)', 'Charity': 'rgba(236,72,153,.85)', 'Unexpected': 'rgba(107,114,128,.85)',
}
const PALETTE = [
  'rgba(239,68,68,.85)', 'rgba(245,158,11,.85)', 'rgba(34,197,94,.85)', 'rgba(168,85,247,.85)',
  'rgba(59,130,246,.85)', 'rgba(20,184,166,.85)', 'rgba(249,115,22,.85)', 'rgba(236,72,153,.85)',
  'rgba(107,114,128,.85)', 'rgba(234,179,8,.85)', 'rgba(16,185,129,.85)', 'rgba(99,102,241,.85)',
]
const EXP_CATS_BUF = ['Housing', 'Consumption', 'Needs', 'Joy', 'Transport', 'Utilities', 'Electronic', 'Charity', 'Unexpected']
const MN_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const MN_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function p2(n: number) { return String(n).padStart(2, '0') }
function todayStr() { const n = new Date(); return `${n.getFullYear()}-${p2(n.getMonth() + 1)}-${p2(n.getDate())}` }
function monthStr(y: number, m: number) { return `${y}-${p2(m + 1)}` }
function fmtRp(n: number) { return 'Rp ' + Number(n).toLocaleString('id-ID') }
function getCatColor(name: string, idx: number) { return CAT_COLORS_BASE[name] || PALETTE[idx % PALETTE.length] }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function api(path: string, method = 'GET', body: any = null) {
  const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const r = await fetch(path, opts)
  if (!r.ok) { const t = await r.text(); throw new Error(t) }
  return r.json()
}

function showToast(msg: string, type = 'success') {
  const icons: Record<string, string> = { success: '✓', error: '✕', warning: '!' }
  const el = document.createElement('div')
  el.className = `fin-toast ${type}`
  el.innerHTML = `<span class="fin-toast-icon">${icons[type] || '✓'}</span><span>${msg}</span>`
  const container = document.getElementById('fin-toast-container')
  if (container) container.appendChild(el)
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')))
  setTimeout(() => {
    el.classList.add('hide')
    el.addEventListener('transitionend', () => el.remove(), { once: true })
  }, 2500)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function initFinCats(fc: any[], trx: any[]) {
  if (fc && fc.length) {
    TYPES.forEach(t => { finCats[t] = fc.filter(c => c.type === t) })
  } else if (trx && trx.length) {
    const seen: Record<string, Set<string>> = { expense: new Set(), income: new Set(), investment: new Set(), buffer: new Set() }
    trx.forEach(t => { if (seen[t.type]) seen[t.type].add(t.category) })
    for (const [type, names] of Object.entries(seen)) {
      let order = 0
      for (const name of names) {
        const c = await api('/api/finance-categories', 'POST', { type, name, sort_order: order++ })
        finCats[type].push(c)
      }
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function initFinAccounts(fa: any[], rc: any[]) {
  if (fa && fa.length) {
    finAccounts = fa
  } else if (rc && rc.length) {
    for (let i = 0; i < ACCTS_DEFAULT.length; i++) {
      try { const a = await api('/api/finance-accounts', 'POST', { name: ACCTS_DEFAULT[i].name, sort_order: i }); finAccounts.push(a) }
      catch (e) { console.warn('seed acct failed', e) }
    }
  }
  renderAuditInputs()
}

function renderAuditInputs() {
  const wrap = document.getElementById('recon-inputs-wrap')
  if (!wrap) return
  if (!finAccounts.length) {
    wrap.innerHTML = '<div style="padding:12px 14px;font-size:10px;color:var(--text4);text-align:center;">Belum ada rekening. Tambah lewat ✏</div>'
    return
  }
  wrap.innerHTML = finAccounts.map(a => `
    <div class="recon-row">
      <span class="recon-lbl">${a.name}</span>
      <input type="text" inputmode="numeric" class="recon-inp" id="rc-${a.id}" placeholder="Rp 0" oninput="rcInput(this)" onfocus="rcFocus(this)" onblur="rcBlur(this)">
    </div>`).join('')
}

function rcRaw(el: HTMLInputElement) { return parseInt(el.value.replace(/[^0-9]/g, '')) || 0 }
function rcFmt(n: number) { return n ? 'Rp ' + n.toLocaleString('id-ID') : '' }
function rcInput(el: HTMLInputElement) { el.value = el.value.replace(/[^0-9]/g, ''); calcRecon() }
function rcFocus(el: HTMLInputElement) { const v = rcRaw(el); el.value = v ? String(v) : '' }
function rcBlur(el: HTMLInputElement) { const v = rcRaw(el); el.value = v ? rcFmt(v) : ''; calcRecon() }
function rcSet(id: string, val: number) { const el = document.getElementById(id) as HTMLInputElement; if (el) el.value = val ? rcFmt(val) : '' }

function render() {
  renderYtdChips()
  renderTrxList()
  renderSummary()
  renderBuffer()
  renderReconHistory()
  renderCalendar()
  calcRecon()
  setTimeout(renderFinChart, 50)
}

function renderMonthLabel() {
  const [y, m] = currentMonth.split('-').map(Number)
  const el = document.getElementById('month-lbl')
  if (el) el.textContent = `Ringkasan Bulan ${MN_FULL[m - 1]} ${y}`
}

function calPrev() { calM--; if (calM < 0) { calM = 11; calY-- } renderCalendar() }
function calNext() { calM++; if (calM > 11) { calM = 0; calY++ } renderCalendar() }
function calSelectDay(dstr: string) {
  const dateInp = document.getElementById('date-inp') as HTMLInputElement
  const filterInp = document.getElementById('trx-date-filter') as HTMLInputElement
  if (dateInp) dateInp.value = dstr
  if (filterInp) filterInp.value = dstr.slice(0, 7)
  renderCalendar(); renderTrxList()
}

function renderCalendar() {
  const lbl = document.getElementById('fin-cal-lbl')
  if (lbl) lbl.textContent = `${MN_FULL[calM]} ${calY}`
  const today = todayStr()
  const grid = document.getElementById('fin-cal-grid')
  if (!grid) return
  grid.querySelectorAll('.fin-cday').forEach(el => el.remove())
  const firstDay = new Date(calY, calM, 1).getDay()
  const dim = new Date(calY, calM + 1, 0).getDate()
  const off = firstDay === 0 ? 6 : firstDay - 1
  const prevDim = new Date(calY, calM, 0).getDate()
  const p2n = (n: number) => String(n).padStart(2, '0')
  const fmt = (y: number, m: number, d: number) => `${y}-${p2n(m + 1)}-${p2n(d)}`
  const dayExpense = (dstr: string) => transactions.filter(t => t.date === dstr && t.type === 'expense' && !(t.note?.startsWith('[Buffer]'))).reduce((s, t) => s + t.amount, 0)
  const fmtK = (n: number) => n >= 1000 ? (n / 1000).toFixed(0) + 'k' : n > 0 ? String(n) : ''
  for (let i = off - 1; i >= 0; i--) {
    const d = prevDim - i; const dstr = fmt(calY, calM - 1, d)
    const exp = dayExpense(dstr)
    const el = document.createElement('div'); el.className = 'fin-cday othermo'
    el.innerHTML = `<div class="fin-day-num">${d}</div>${exp ? `<div class="fin-day-exp">${fmtK(exp)}</div>` : ''}`
    el.onclick = () => calSelectDay(dstr); grid.appendChild(el)
  }
  for (let d = 1; d <= dim; d++) {
    const dstr = fmt(calY, calM, d)
    const exp = dayExpense(dstr)
    let cls = 'fin-cday'; if (dstr === today) cls += ' today'
    const el = document.createElement('div'); el.className = cls
    el.innerHTML = `<div class="fin-day-num">${d}</div>${exp ? `<div class="fin-day-exp">${fmtK(exp)}</div>` : ''}`
    el.onclick = () => calSelectDay(dstr); grid.appendChild(el)
  }
  const total = off + dim; const rem = (7 - total % 7) % 7
  for (let d = 1; d <= rem; d++) {
    const el = document.createElement('div'); el.className = 'fin-cday othermo'
    el.innerHTML = `<div class="fin-day-num">${d}</div>`; grid.appendChild(el)
  }
}

function renderYtdChips() {
  const years = [...new Set(transactions.map(t => t.date.slice(0, 4)))].sort()
  const chip = (label: string, val: string | null) => {
    const active = String(ytdYear || '') === String(val || '')
    return `<button data-yr="${val || ''}" onclick="selectYtdYear(this.dataset.yr||null)" style="font-size:9px;font-weight:700;padding:4px 11px;border-radius:20px;cursor:pointer;letter-spacing:.04em;transition:all .15s;border:1px solid ${active ? 'var(--blk);background:var(--blk);color:#fff' : 'var(--border);background:var(--bg);color:var(--text2)'};">${label}</button>`
  }
  const el = document.getElementById('ytd-yr-chips')
  if (el) el.innerHTML = chip('All Time', null) + years.map(y => chip(y, y)).join('')
  const ct = document.getElementById('chart-title')
  if (ct) ct.textContent = ytdYear ? `Expense per Bulan — ${ytdYear}` : 'Expense per Bulan — Semua'
}

function selectYtdYear(y: string | null) {
  ytdYear = y || ''
  const ct = document.getElementById('chart-title')
  if (ct) ct.textContent = y ? `Expense per Bulan — ${y}` : 'Expense per Bulan — Semua'
  renderYtdChips(); renderSummary(); renderFinChart()
}

async function renderFinChart() {
  const expTrx = ytdYear
    ? transactions.filter(t => t.date.startsWith(ytdYear) && t.type === 'expense' && !(t.note?.startsWith('[Buffer]')))
    : transactions.filter(t => t.type === 'expense' && !(t.note?.startsWith('[Buffer]')))
  const months = [...new Set(expTrx.map(t => t.date.slice(0, 7)))].sort()
  if (!months.length) return
  const labels = ytdYear
    ? months.map(m => MN_SHORT[parseInt(m.slice(5)) - 1])
    : months.map(m => `${MN_SHORT[parseInt(m.slice(5)) - 1]} '${m.slice(2, 4)}`)
  const cats = [...new Set(expTrx.map(t => t.category))].sort()
  const datasets = cats.map((cat, idx) => ({
    label: cat,
    data: months.map(m => transactions.filter(t => t.date.startsWith(m) && t.type === 'expense' && t.category === cat && !(t.note?.startsWith('[Buffer]'))).reduce((s, t) => s + t.amount, 0)),
    backgroundColor: getCatColor(cat, idx), stack: 's',
  })).filter(ds => ds.data.some(v => v > 0))

  const legendEl = document.getElementById('fin-chart-legend')
  if (legendEl) legendEl.innerHTML = datasets.map((ds, i) => `
    <div onclick="toggleFinCat(${i},this)" style="display:flex;align-items:center;gap:5px;font-size:9px;font-weight:600;padding:3px 8px;border-radius:12px;border:1px solid var(--border);cursor:pointer;background:var(--bg);color:var(--text2);transition:all .15s;" data-idx="${i}">
      <span style="width:8px;height:8px;border-radius:2px;background:${getCatColor(ds.label, i)};flex-shrink:0;display:inline-block;"></span>${ds.label}
    </div>`).join('')

  const canvas = document.getElementById('fin-chart-bar') as HTMLCanvasElement
  if (!canvas) return
  if (finChartInstance) { finChartInstance.destroy(); finChartInstance = null }
  const Chart = await getChart()
  finChartInstance = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
      plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false, callbacks: { label: ctx => `${ctx.dataset.label}: Rp ${(ctx.raw as number).toLocaleString('id-ID')}` } } },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { font: { size: months.length > 20 ? 8 : 9 }, color: '#666', maxRotation: months.length > 15 ? 45 : 0 } },
        y: { stacked: true, grid: { color: 'rgba(255,255,255,.06)' }, ticks: { font: { size: 9 }, color: '#666', callback: v => 'Rp ' + (Number(v) / 1000).toFixed(0) + 'k' } },
      },
    },
  })

  const tbl = document.getElementById('fin-chart-table')
  if (!tbl) return
  const totals = months.map(m => datasets.reduce((s, ds) => s + ds.data[months.indexOf(m)], 0))
  tbl.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:10px;">
    <thead><tr style="border-bottom:2px solid var(--border);">
      <th style="text-align:left;padding:5px 8px;font-weight:700;color:var(--text2);">Kategori</th>
      ${labels.map(l => `<th style="text-align:right;padding:5px 8px;font-weight:700;color:var(--text2);">${l}</th>`).join('')}
    </tr></thead>
    <tbody>
      ${datasets.map(ds => `<tr style="border-bottom:1px solid var(--border);">
        <td style="padding:5px 8px;display:flex;align-items:center;gap:6px;"><span style="width:8px;height:8px;border-radius:2px;background:${ds.backgroundColor};flex-shrink:0;display:inline-block;"></span>${ds.label}</td>
        ${ds.data.map(v => `<td style="text-align:right;padding:5px 8px;color:${v ? 'var(--text)' : 'var(--text4)'};">${v ? 'Rp ' + v.toLocaleString('id-ID') : '-'}</td>`).join('')}
      </tr>`).join('')}
      <tr style="border-top:2px solid var(--border);font-weight:700;">
        <td style="padding:6px 8px;">Total</td>
        ${totals.map(v => `<td style="text-align:right;padding:6px 8px;color:var(--red);">Rp ${v.toLocaleString('id-ID')}</td>`).join('')}
      </tr>
    </tbody>
  </table>`
}

function toggleFinCat(idx: number, el: HTMLElement) {
  if (!finChartInstance) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meta = (finChartInstance as any).getDatasetMeta(idx)
  meta.hidden = !meta.hidden
  finChartInstance.update()
  el.style.opacity = meta.hidden ? '.35' : '1'
  const tbl = document.getElementById('fin-chart-table')
  if (tbl) tbl.style.display = 'block'
}

const HIDDEN_IDS = ['s-income', 's-expense', 's-invest', 's-sisa', 's-daily', 's-opening', 's-closing']
function toggleHide() {
  numbersHidden = !numbersHidden
  const btn = document.getElementById('eye-btn')
  if (btn) btn.textContent = numbersHidden ? '🙈' : '👁'
  HIDDEN_IDS.forEach(id => {
    const el = document.getElementById(id)
    if (!el) return
    if (numbersHidden) { hiddenVals[id] = el.textContent || ''; el.textContent = '•••••••' }
    else { el.textContent = hiddenVals[id] || el.textContent || '' }
  })
  const badge = document.getElementById('save-rate-badge')
  if (badge) {
    if (numbersHidden) { hiddenVals['badge'] = badge.textContent || ''; badge.textContent = '' }
    else { badge.textContent = hiddenVals['badge'] || '' }
  }
}

function toggleBreakdown(type: string) {
  const el = document.getElementById(type === 'expense' ? 'breakdown' : 'breakdown-invest')
  const other = document.getElementById(type === 'expense' ? 'breakdown-invest' : 'breakdown')
  if (other) other.style.display = 'none'
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none'
}

function changeMonth(d: number) {
  const [y, m] = currentMonth.split('-').map(Number)
  const nd = new Date(y, m - 1 + d, 1)
  currentMonth = monthStr(nd.getFullYear(), nd.getMonth())
  const filterInp = document.getElementById('trx-date-filter') as HTMLInputElement
  if (filterInp) filterInp.value = currentMonth
  renderMonthLabel(); renderSummary(); renderTrxList(); renderFinChart()
}

function saveBudgetEndDate(val: string) {
  localStorage.setItem('gst_budget_end', val || '')
  renderSummary()
}

function renderDailyBudget(sisa: number) {
  const endStr = localStorage.getItem('gst_budget_end') || ''
  const inp = document.getElementById('budget-end-date') as HTMLInputElement
  const dailyEl = document.getElementById('s-daily')
  const infoEl = document.getElementById('daily-info')
  if (inp && endStr) inp.value = endStr
  if (!endStr) {
    if (dailyEl) dailyEl.textContent = '—'
    if (infoEl) infoEl.textContent = 'Set tanggal batas akhir →'
    return
  }
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const end = new Date(endStr + 'T00:00:00')
  const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff <= 0) {
    if (dailyEl) { dailyEl.textContent = 'Rp 0'; dailyEl.style.color = 'var(--red)' }
    if (infoEl) infoEl.textContent = 'Periode sudah lewat'
    return
  }
  const daily = Math.round(sisa / diff)
  if (dailyEl) { dailyEl.textContent = fmtRp(Math.abs(daily)); dailyEl.style.color = daily > 0 ? 'var(--gold)' : 'var(--red)' }
  if (infoEl) infoEl.textContent = 'sisa ' + diff + ' hari'
  if (numbersHidden && dailyEl) { hiddenVals['s-daily'] = dailyEl.textContent; dailyEl.textContent = '•••' }
}

function renderSummary() {
  const mo = currentMonth
  const moTrx = transactions.filter(t => t.date.startsWith(mo))
  const income = moTrx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = moTrx.filter(t => t.type === 'expense' && !(t.note?.startsWith('[Buffer]'))).reduce((s, t) => s + t.amount, 0)
  const invest = moTrx.filter(t => t.type === 'investment').reduce((s, t) => s + t.amount, 0)
  const bufferOut = moTrx.filter(t => t.type === 'buffer').reduce((s, t) => s + t.amount, 0)
  const deposit = moTrx.filter(t => t.type === 'investment' && t.category === 'Deposit').reduce((s, t) => s + t.amount, 0)
  const sisa = income - expense - invest - bufferOut
  const rate = income > 0 ? Math.round((deposit / income) * 100) : 0
  if (numbersHidden) {
    hiddenVals['s-income'] = fmtRp(income); hiddenVals['s-expense'] = fmtRp(expense)
    hiddenVals['s-invest'] = fmtRp(invest); hiddenVals['s-sisa'] = fmtRp(sisa)
    hiddenVals['badge'] = `Save Rate: ${rate}%`
  } else {
    const el = (id: string) => document.getElementById(id)
    if (el('s-income')) el('s-income')!.textContent = fmtRp(income)
    if (el('s-expense')) el('s-expense')!.textContent = fmtRp(expense)
    if (el('s-invest')) el('s-invest')!.textContent = fmtRp(invest)
    if (el('s-sisa')) el('s-sisa')!.textContent = fmtRp(sisa)
    if (el('save-rate-badge')) el('save-rate-badge')!.textContent = `Save Rate: ${rate}%`
  }
  const sisaEl = document.getElementById('s-sisa') as HTMLElement
  if (sisaEl) sisaEl.style.color = sisa >= 0 ? 'var(--gold)' : 'var(--red)'
  const fillEl = document.getElementById('saverate-fill') as HTMLElement
  if (fillEl) fillEl.style.width = Math.min(rate, 100) + '%'

  const cutoff = mo + '-01'
  const opening = transactions.reduce((s, t) => {
    if (t.date >= cutoff) return s
    if (t.note?.startsWith('[Buffer]')) return s
    if (t.type === 'income') return s + t.amount
    if (t.type === 'expense') return s - t.amount
    if (t.type === 'investment') return s - t.amount
    if (t.type === 'buffer') return s - t.amount
    return s
  }, 0)
  const closing = opening + income - expense - invest - bufferOut
  const closingEl = document.getElementById('s-closing') as HTMLElement
  if (numbersHidden) {
    hiddenVals['s-opening'] = fmtRp(opening); hiddenVals['s-closing'] = fmtRp(closing)
  } else {
    const openEl = document.getElementById('s-opening')
    if (openEl) openEl.textContent = fmtRp(opening)
    if (closingEl) closingEl.textContent = fmtRp(closing)
  }
  if (closingEl) closingEl.style.color = closing >= 0 ? 'var(--gold)' : 'var(--red)'
  renderDailyBudget(sisa)

  const cats: Record<string, number> = {}
  moTrx.filter(t => t.type === 'expense' && !(t.note?.startsWith('[Buffer]'))).forEach(t => { cats[t.category] = (cats[t.category] || 0) + t.amount })
  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1])
  const bd = document.getElementById('breakdown')
  if (bd) bd.innerHTML = sorted.length
    ? sorted.map(([k, v]) => `<div class="bk-row"><span class="bk-label">${k}</span><span class="bk-val">${fmtRp(v)}</span></div>`).join('')
    : '<div style="font-size:10px;color:var(--text4);text-align:center;padding:8px;">Belum ada pengeluaran.</div>'

  const invCats: Record<string, number> = {}
  moTrx.filter(t => t.type === 'investment').forEach(t => { invCats[t.category] = (invCats[t.category] || 0) + t.amount })
  const invSorted = Object.entries(invCats).sort((a, b) => b[1] - a[1])
  const bdi = document.getElementById('breakdown-invest')
  if (bdi) bdi.innerHTML = invSorted.length
    ? invSorted.map(([k, v]) => `<div class="bk-row"><span class="bk-label">${k}</span><span class="bk-val" style="color:var(--blue)">${fmtRp(v)}</span></div>`).join('')
    : '<div style="font-size:10px;color:var(--text4);text-align:center;padding:8px;">Belum ada investasi.</div>'

  const yrTrx = ytdYear ? transactions.filter(t => t.date.startsWith(ytdYear)) : transactions
  const ytdIncome = yrTrx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const ytdExpense = yrTrx.filter(t => t.type === 'expense' && !(t.note?.startsWith('[Buffer]'))).reduce((s, t) => s + t.amount, 0)
  const ytdDeposit = yrTrx.filter(t => t.type === 'investment' && t.category === 'Deposit').reduce((s, t) => s + t.amount, 0)
  const ytdTng = yrTrx.filter(t => t.type === 'investment' && t.category !== 'Deposit').reduce((s, t) => s + t.amount, 0)
  const pct = (v: number) => ytdIncome > 0 ? Math.round(Math.abs(v) / ytdIncome * 100) : 0
  const eld = (id: string) => document.getElementById(id)
  if (eld('ytd-income')) eld('ytd-income')!.textContent = fmtRp(ytdIncome)
  if (eld('ytd-expense')) eld('ytd-expense')!.textContent = fmtRp(ytdExpense)
  if (eld('ytd-expense-pct')) eld('ytd-expense-pct')!.textContent = ytdIncome > 0 ? pct(ytdExpense) + '%' : ''
  if (eld('ytd-invest')) eld('ytd-invest')!.textContent = fmtRp(ytdDeposit)
  if (eld('ytd-invest-pct')) eld('ytd-invest-pct')!.textContent = ytdIncome > 0 ? pct(ytdDeposit) + '%' : ''
  if (eld('ytd-tng')) { eld('ytd-tng')!.textContent = fmtRp(Math.abs(ytdTng)); (eld('ytd-tng') as HTMLElement).style.color = ytdTng >= 0 ? 'var(--gold)' : 'var(--red)' }
  if (eld('ytd-tng-pct')) { eld('ytd-tng-pct')!.textContent = ytdIncome > 0 ? pct(ytdTng) + '%' : ''; (eld('ytd-tng-pct') as HTMLElement).style.color = ytdTng >= 0 ? 'var(--gold)' : 'var(--red)' }
}

function renderTrxList() {
  const filterInp = document.getElementById('trx-date-filter') as HTMLInputElement
  const mo = filterInp?.value || currentMonth
  const list = document.getElementById('trx-list')
  if (!list) return
  const items = transactions.filter(t => t.date.startsWith(mo)).sort((a, b) => b.date.localeCompare(a.date) || (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
  if (!items.length) { list.innerHTML = '<div class="trx-empty">Belum ada transaksi bulan ini.</div>'; return }
  let lastDate = ''
  list.innerHTML = items.map(t => {
    const dayLabel = t.date !== lastDate
      ? (lastDate = t.date, `<div style="font-size:9px;font-weight:700;color:var(--text3);letter-spacing:.06em;padding:8px 14px 3px;text-transform:uppercase;">${parseInt(t.date.slice(8))} ${MN_SHORT[parseInt(t.date.slice(5, 7)) - 1]}</div>`)
      : ''
    return dayLabel + `
    <div class="trx-item">
      <div class="trx-dot" style="background:${TYPE_COLOR[t.type] || '#999'}"></div>
      <div class="trx-info">
        <div class="trx-cat">${t.category}</div>
        ${t.note ? `<div class="trx-note">${t.note}</div>` : ''}
      </div>
      <div class="trx-amount" style="color:${t.type === 'income' ? 'var(--green)' : t.type === 'investment' ? 'var(--blue)' : t.type === 'buffer' ? 'var(--gold)' : 'var(--red)'}">
        ${t.type === 'income' ? '+' : '−'}${fmtRp(t.amount)}
      </div>
      ${t.note?.startsWith('[Porto]') ? '' : `<button class="trx-del" onclick="delTransaction('${t.id}')">✕</button>`}
    </div>`
  }).join('')
}

function renderBuffer() {
  const bufCats = finCats['buffer'] || []
  const nameEl = document.getElementById('buf-account-name')
  if (nameEl) nameEl.textContent = bufCats.length ? bufCats.map(c => c.name).join(' · ') : '—'
  const bal = bufferLogs.reduce((s, l) => s + l.amount, 0)
  const balEl = document.getElementById('buf-bal')
  if (balEl) balEl.textContent = fmtRp(bal)
  const logEl = document.getElementById('buf-log-list')
  const recent = [...bufferLogs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  if (logEl) logEl.innerHTML = recent.length
    ? recent.map(l => `<div class="buf-log-item"><div style="flex:1;min-width:0;"><div style="color:var(--text3);font-size:9px;">${l.date}</div>${l.note ? `<div style="color:var(--text2);margin-top:2px;">${l.note}</div>` : ''}</div><span style="font-weight:700;color:${l.amount > 0 ? 'var(--green)' : 'var(--red)'};white-space:nowrap;flex-shrink:0;">${l.amount > 0 ? '+' : ''}${fmtRp(l.amount)}</span></div>`).join('')
    : '<div style="padding:10px 14px;font-size:10px;color:var(--text4);text-align:center;">Belum ada log buffer.</div>'
}

function toggleBufLog() {
  const logEl = document.getElementById('buf-log-list')
  const arrow = document.getElementById('buf-log-arrow')
  if (!logEl || !arrow) return
  const open = logEl.style.display === 'none'
  logEl.style.display = open ? 'block' : 'none'
  arrow.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)'
}

function openBufModal(dir: string) {
  bufDir = dir; bufExpCat = ''
  const bufName = (finCats['buffer'] || [])[0]?.name || 'Buffer'
  const titleEl = document.getElementById('buf-modal-title')
  if (titleEl) titleEl.textContent = dir === 'in' ? `+ Isi Buffer (→ ${bufName})` : '− Ambil dari Buffer'
  const dateInp = document.getElementById('buf-date') as HTMLInputElement
  const amtInp = document.getElementById('buf-amount') as HTMLInputElement
  const noteInp = document.getElementById('buf-note') as HTMLInputElement
  if (dateInp) dateInp.value = todayStr()
  if (amtInp) amtInp.value = ''
  if (noteInp) noteInp.value = ''
  const expSec = document.getElementById('buf-expense-section')
  if (expSec) expSec.style.display = dir === 'out' ? 'block' : 'none'
  if (dir === 'out') {
    const chips = document.getElementById('buf-cat-chips')
    if (chips) chips.innerHTML = EXP_CATS_BUF.map(c =>
      `<div onclick="selectBufCat(this,'${c}')" style="font-size:9px;font-weight:600;padding:4px 10px;border-radius:20px;border:1px solid var(--border);cursor:pointer;background:var(--bg);color:var(--text2);transition:all .15s;">${c}</div>`
    ).join('')
  }
  document.getElementById('buf-modal')?.classList.add('open')
  setTimeout(() => (document.getElementById('buf-amount') as HTMLInputElement)?.focus(), 100)
}

function selectBufCat(el: HTMLElement, cat: string) {
  bufExpCat = cat
  document.querySelectorAll('#buf-cat-chips div').forEach(d => {
    (d as HTMLElement).style.background = 'var(--bg)';
    (d as HTMLElement).style.color = 'var(--text2)';
    (d as HTMLElement).style.borderColor = 'var(--border)'
  })
  el.style.background = 'var(--red)'; el.style.color = '#fff'; el.style.borderColor = 'var(--red)'
}
function closeBufModal() { document.getElementById('buf-modal')?.classList.remove('open') }

async function confirmBuffer() {
  const amtInp = document.getElementById('buf-amount') as HTMLInputElement
  const amt = parseInt(amtInp?.value)
  if (!amt || amt <= 0) return
  if (bufDir === 'out' && !bufExpCat) { showToast('Pilih kategori expense dulu!', 'warning'); return }
  const noteInp = document.getElementById('buf-note') as HTMLInputElement
  const note = noteInp?.value.trim()
  const amount = bufDir === 'in' ? amt : -amt
  const selDate = (document.getElementById('buf-date') as HTMLInputElement)?.value || todayStr()
  try {
    const log = await api('/api/buffer-logs', 'POST', { date: selDate, amount, note: note || null })
    bufferLogs.push(log); bufferLogs.sort((a, b) => b.date.localeCompare(a.date))
    if (bufDir === 'in') {
      const trx = await api('/api/transactions', 'POST', { date: selDate, type: 'buffer', category: 'Isi Buffer (BLU)', amount: amt, note: note || 'Alokasi ke BLU' })
      transactions.push(trx)
    }
    if (bufDir === 'out') {
      const trx = await api('/api/transactions', 'POST', { date: selDate, type: 'expense', category: bufExpCat, amount: amt, note: '[Buffer] ' + (note || bufExpCat) })
      transactions.push(trx)
    }
    transactions.sort((a, b) => b.date.localeCompare(a.date))
    closeBufModal(); render()
  } catch (e) { showToast('Gagal: ' + (e as Error).message, 'error') }
}

function calcRecon() {
  const actual = finAccounts.reduce((s, a) => {
    const el = document.getElementById('rc-' + a.id) as HTMLInputElement
    return s + (el ? rcRaw(el) : 0)
  }, 0)
  const sysbal = transactions.reduce((s, t) => {
    if (t.note?.startsWith('[Buffer]')) return s
    if (t.type === 'income') return s + t.amount
    if (t.type === 'expense') return s - t.amount
    if (t.type === 'investment') return s - t.amount
    if (t.type === 'buffer') return s - t.amount
    return s
  }, 0)
  const diff = actual - sysbal
  const act = document.getElementById('rc-actual'), sys = document.getElementById('rc-system'), dEl = document.getElementById('rc-diff')
  if (act) act.textContent = fmtRp(actual)
  if (sys) sys.textContent = fmtRp(sysbal)
  if (dEl) { dEl.textContent = (diff >= 0 ? '+' : '') + fmtRp(diff); dEl.className = 'recon-diff-val ' + (diff === 0 ? 'ok' : 'warn') }
  const warnEl = document.getElementById('rc-warn') as HTMLElement
  if (warnEl) {
    if (diff === 0) { warnEl.style.display = 'none' }
    else if (diff > 0) { warnEl.style.display = 'block'; warnEl.style.color = 'var(--gold)'; warnEl.textContent = 'Cek dompetmu sekarang!' }
    else { warnEl.style.display = 'block'; warnEl.style.color = 'var(--red)'; warnEl.textContent = 'Ada transaksi yang belum tercatat.' }
  }
  const badge = document.getElementById('recon-badge') as HTMLElement
  if (badge) { badge.textContent = diff === 0 ? '✓ Balance' : '⚠ Selisih'; badge.style.color = diff === 0 ? 'var(--green)' : 'var(--red)' }
}

async function saveRecon() {
  const account_balances: Record<string, number> = {}
  finAccounts.forEach(a => { const el = document.getElementById('rc-' + a.id) as HTMLInputElement; account_balances[a.id] = el ? rcRaw(el) : 0 })
  const total_actual = Object.values(account_balances).reduce((s, v) => s + v, 0)
  const total_system = transactions.reduce((s, t) => {
    if (t.note?.startsWith('[Buffer]')) return s
    if (t.type === 'income') return s + t.amount
    if (t.type === 'expense') return s - t.amount
    if (t.type === 'investment') return s - t.amount
    if (t.type === 'buffer') return s - t.amount
    return s
  }, 0)
  const body = { date: todayStr(), account_balances, total_actual, total_system, difference: total_actual - total_system }
  try {
    const rc = await api('/api/reconciliations', 'POST', body)
    reconciliations.unshift(rc); renderReconHistory(); fillReconFromLast(); showToast('Audit tersimpan!', 'success')
  } catch (e) { showToast('Gagal: ' + (e as Error).message, 'error') }
}

function renderReconHistory() {
  const h = document.getElementById('recon-history')
  if (!h) return
  if (!reconciliations.length) { h.innerHTML = ''; return }
  h.innerHTML = reconciliations.slice(0, 4).map(r => `
    <div class="recon-hist-item">
      <span style="color:var(--text3)">${r.date}</span>
      <span style="font-weight:700;color:${r.difference === 0 ? 'var(--green)' : 'var(--red)'}">
        ${r.difference === 0 ? 'Balance' : 'Selisih ' + fmtRp(Math.abs(r.difference))}
      </span>
      <button onclick="delRecon('${r.id}')" style="background:none;border:none;cursor:pointer;color:var(--text4);font-size:11px;padding:0 2px;">×</button>
    </div>`).join('')
}

async function delRecon(id: string) {
  await api('/api/reconciliations?id=' + id, 'DELETE')
  reconciliations = reconciliations.filter(r => r.id !== id); renderReconHistory()
}

function fillReconFromLast() {
  if (!reconciliations.length || !finAccounts.length) return
  const last = reconciliations[0]
  if (last.account_balances && Object.keys(last.account_balances).length) {
    finAccounts.forEach(a => { rcSet('rc-' + a.id, last.account_balances[a.id] || 0) })
  } else {
    const legMap: Record<string, string> = { 'Bank Jatim': 'bank_jatim', 'Seabank': 'seabank', 'Bank Jago': 'bank_jago', 'E-Wallet': 'ewallet', 'Cash': 'cash' }
    finAccounts.forEach(a => { const k = legMap[a.name]; if (k && last[k] !== undefined) rcSet('rc-' + a.id, last[k]) })
  }
  calcRecon()
}

function switchType(type: string, el?: HTMLElement | null) {
  currentType = type; currentCat = ''
  document.querySelectorAll('.fin-ttab').forEach(t => t.classList.remove('active'))
  if (el) el.classList.add('active')
  renderCatChips(type)
}

function renderCatChips(type: string) {
  const cats = finCats[type] || []
  const chips = document.getElementById('cat-chips')
  if (!chips) return
  chips.innerHTML = cats.map(c => `<div class="cat-chip" onclick="selectCat(this,'${c.name.replace(/'/g, "\\'")}')"> ${c.name}</div>`).join('')
  if (cats.length > 0) { const firstChip = chips.firstChild as HTMLElement; if (firstChip) selectCat(firstChip, cats[0].name) }
}

function selectCat(el: HTMLElement, cat: string) {
  currentCat = cat
  document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'))
  el.classList.add('active')
  const assetRow = document.getElementById('asset-row')
  const assetSel = document.getElementById('asset-sel') as HTMLSelectElement
  if (currentType === 'investment' && cat === 'Deposit') {
    if (assetSel) assetSel.innerHTML = '<option value="">— Pilih Aset Tujuan —</option>' +
      portfolioAssets.filter(a => a.is_active).map(a => `<option value="${a.id}">${a.name} (${a.currency})</option>`).join('')
    if (assetRow) assetRow.style.display = 'flex'
  } else {
    if (assetRow) assetRow.style.display = 'none'
  }
}

async function addTransaction() {
  const amtInp = document.getElementById('amount-inp') as HTMLInputElement
  const amt = parseInt(amtInp?.value)
  if (!amt || amt <= 0) return
  const dateInp = document.getElementById('date-inp') as HTMLInputElement
  const noteInp = document.getElementById('note-inp') as HTMLInputElement
  const assetSel = document.getElementById('asset-sel') as HTMLSelectElement
  const date = dateInp?.value || todayStr()
  const note = noteInp?.value.trim()
  const assetId = assetSel?.value || null
  const body = { date, type: currentType, category: currentCat, amount: amt, note: note || null, asset_id: assetId || null }
  const btn = document.querySelector('.fin-btn-add') as HTMLButtonElement
  if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...' }
  try {
    const t = await api('/api/transactions', 'POST', body)
    transactions.push(t)
    if (currentType === 'buffer') {
      const bufName = (finCats['buffer'] || [])[0]?.name || 'Alokasi Buffer'
      const log = await api('/api/buffer-logs', 'POST', { date, amount: amt, note: note || bufName })
      bufferLogs.push(log)
    }
    if (amtInp) amtInp.value = ''
    if (noteInp) noteInp.value = ''
    if (amtInp) amtInp.focus()
    render()
  } catch (e) { showToast('Gagal: ' + (e as Error).message, 'error') }
  finally { if (btn) { btn.disabled = false; btn.textContent = '+ Tambah' } }
}

async function delTransaction(id: string) {
  const t = transactions.find(x => x.id === id)
  await api('/api/transactions?id=' + id, 'DELETE')
  transactions = transactions.filter(x => x.id !== id)
  if (t) {
    let match = null
    if (t.type === 'buffer') {
      match = bufferLogs.find(l => l.date === t.date && l.amount === t.amount)
    } else if (t.note?.startsWith('[Buffer]')) {
      match = bufferLogs.find(l => l.date === t.date && l.amount === -t.amount)
    }
    if (match) { await api('/api/buffer-logs?id=' + match.id, 'DELETE').catch(console.error); bufferLogs = bufferLogs.filter(l => l.id !== match!.id) }
  }
  render()
}

// Category manager
function openCatManager() {
  const type = currentType
  const typeLabel: Record<string, string> = { expense: 'Expense', income: 'Income', investment: 'Invest', buffer: 'Buffer' }
  const titleEl = document.getElementById('cat-modal-title')
  if (titleEl) titleEl.textContent = 'Kelola Kategori — ' + typeLabel[type]
  const addInp = document.getElementById('cat-add-inp') as HTMLInputElement
  if (addInp) addInp.value = ''
  renderCatManagerList(type)
  document.getElementById('cat-modal')?.classList.add('open')
  setTimeout(() => (document.getElementById('cat-add-inp') as HTMLInputElement)?.focus(), 100)
}

function renderCatManagerList(type: string) {
  const cats = finCats[type] || []
  const body = document.getElementById('cat-modal-body')
  if (!body) return
  if (!cats.length) { body.innerHTML = '<div style="font-size:11px;color:var(--text3);text-align:center;padding:10px;">Belum ada kategori. Tambah di bawah.</div>'; return }
  body.innerHTML = cats.map(c => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--r2);">
      <span style="flex:1;font-size:11px;font-weight:600;" id="cat-name-${c.id}">${c.name}</span>
      <input type="text" id="cat-inp-${c.id}" value="${c.name}" style="flex:1;display:none;border:1px solid var(--gold);border-radius:var(--r2);padding:3px 7px;font-size:11px;outline:none;background:var(--bg);color:var(--text);" onkeydown="if(event.key==='Enter')saveCatEdit('${c.id}','${type}')">
      <button id="cat-edit-btn-${c.id}" onclick="toggleCatEdit('${c.id}','${type}')" style="background:none;border:none;cursor:pointer;font-size:11px;color:var(--text3);padding:2px 4px;">✏</button>
      <button id="cat-save-btn-${c.id}" onclick="saveCatEdit('${c.id}','${type}')" style="display:none;background:var(--gold);color:#fff;border:none;border-radius:var(--r2);cursor:pointer;font-size:10px;padding:3px 8px;font-weight:600;">OK</button>
      <button onclick="deleteCat('${c.id}','${type}')" style="background:none;border:none;cursor:pointer;font-size:11px;color:var(--text3);padding:2px 4px;">✕</button>
    </div>`).join('')
}

function toggleCatEdit(id: string, _type: string) {
  const name = document.getElementById('cat-name-' + id) as HTMLElement
  const inp = document.getElementById('cat-inp-' + id) as HTMLInputElement
  const editBtn = document.getElementById('cat-edit-btn-' + id) as HTMLElement
  const saveBtn = document.getElementById('cat-save-btn-' + id) as HTMLElement
  if (name) name.style.display = 'none'
  if (inp) { inp.style.display = 'block'; inp.focus() }
  if (editBtn) editBtn.style.display = 'none'
  if (saveBtn) saveBtn.style.display = 'block'
}

async function saveCatEdit(id: string, type: string) {
  const inp = document.getElementById('cat-inp-' + id) as HTMLInputElement
  const name = inp?.value.trim()
  if (!name) return
  try {
    await api('/api/finance-categories?id=' + id, 'PATCH', { name })
    const cat = finCats[type]?.find(c => c.id === id)
    if (cat) cat.name = name
    renderCatManagerList(type); renderCatChips(type)
  } catch (e) { showToast('Gagal: ' + (e as Error).message, 'error') }
}

async function addCatFromManager() {
  const type = currentType
  const inp = document.getElementById('cat-add-inp') as HTMLInputElement
  const name = inp?.value.trim()
  if (!name) return
  try {
    const order = finCats[type]?.length || 0
    const c = await api('/api/finance-categories', 'POST', { type, name, sort_order: order })
    finCats[type].push(c)
    if (inp) inp.value = ''
    renderCatManagerList(type); renderCatChips(type)
  } catch (e) { showToast('Gagal: ' + (e as Error).message, 'error') }
}

async function deleteCat(id: string, type: string) {
  try {
    await api('/api/finance-categories?id=' + id, 'DELETE')
    finCats[type] = finCats[type].filter(c => c.id !== id)
    renderCatManagerList(type); renderCatChips(type)
  } catch (e) { showToast('Gagal: ' + (e as Error).message, 'error') }
}

function closeCatModal() { document.getElementById('cat-modal')?.classList.remove('open') }

// Account manager
function openAcctManager() {
  const addInp = document.getElementById('acct-add-inp') as HTMLInputElement
  if (addInp) addInp.value = ''
  renderAcctManagerList()
  document.getElementById('acct-modal')?.classList.add('open')
  setTimeout(() => (document.getElementById('acct-add-inp') as HTMLInputElement)?.focus(), 100)
}

function closeAcctModal() { document.getElementById('acct-modal')?.classList.remove('open') }

function renderAcctManagerList() {
  const body = document.getElementById('acct-modal-body')
  if (!body) return
  if (!finAccounts.length) { body.innerHTML = '<div style="font-size:11px;color:var(--text3);text-align:center;padding:10px;">Belum ada rekening. Tambah di bawah.</div>'; return }
  body.innerHTML = finAccounts.map(a => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--r2);">
      <span style="flex:1;font-size:11px;font-weight:600;" id="acct-name-${a.id}">${a.name}</span>
      <input type="text" id="acct-inp-${a.id}" value="${a.name}" style="flex:1;display:none;border:1px solid var(--gold);border-radius:var(--r2);padding:3px 7px;font-size:11px;outline:none;background:var(--bg);color:var(--text);" onkeydown="if(event.key==='Enter')saveAcctEdit('${a.id}')">
      <button id="acct-edit-btn-${a.id}" onclick="toggleAcctEdit('${a.id}')" style="background:none;border:none;cursor:pointer;font-size:11px;color:var(--text3);padding:2px 4px;">✏</button>
      <button id="acct-save-btn-${a.id}" onclick="saveAcctEdit('${a.id}')" style="display:none;background:var(--gold);color:#fff;border:none;border-radius:var(--r2);cursor:pointer;font-size:10px;padding:3px 8px;font-weight:600;">OK</button>
      <button onclick="deleteAcct('${a.id}')" style="background:none;border:none;cursor:pointer;font-size:11px;color:var(--text3);padding:2px 4px;">✕</button>
    </div>`).join('')
}

function toggleAcctEdit(id: string) {
  const name = document.getElementById('acct-name-' + id) as HTMLElement
  const inp = document.getElementById('acct-inp-' + id) as HTMLInputElement
  const editBtn = document.getElementById('acct-edit-btn-' + id) as HTMLElement
  const saveBtn = document.getElementById('acct-save-btn-' + id) as HTMLElement
  if (name) name.style.display = 'none'
  if (inp) { inp.style.display = 'block'; inp.focus() }
  if (editBtn) editBtn.style.display = 'none'
  if (saveBtn) saveBtn.style.display = 'block'
}

async function saveAcctEdit(id: string) {
  const inp = document.getElementById('acct-inp-' + id) as HTMLInputElement
  const name = inp?.value.trim()
  if (!name) return
  try {
    await api('/api/finance-accounts?id=' + id, 'PATCH', { name })
    const a = finAccounts.find(x => x.id === id); if (a) a.name = name
    renderAcctManagerList(); renderAuditInputs(); calcRecon()
  } catch (e) { showToast('Gagal: ' + (e as Error).message, 'error') }
}

async function addAcct() {
  const inp = document.getElementById('acct-add-inp') as HTMLInputElement
  const name = inp?.value.trim()
  if (!name) return
  try {
    const a = await api('/api/finance-accounts', 'POST', { name, sort_order: finAccounts.length })
    finAccounts.push(a)
    if (inp) inp.value = ''
    renderAcctManagerList(); renderAuditInputs()
  } catch (e) { showToast('Gagal: ' + (e as Error).message, 'error') }
}

async function deleteAcct(id: string) {
  try {
    await api('/api/finance-accounts?id=' + id, 'DELETE')
    finAccounts = finAccounts.filter(a => a.id !== id)
    renderAcctManagerList(); renderAuditInputs(); calcRecon()
  } catch (e) { showToast('Gagal: ' + (e as Error).message, 'error') }
}

async function init() {
  const now = new Date()
  currentMonth = monthStr(now.getFullYear(), now.getMonth())
  calY = now.getFullYear(); calM = now.getMonth()
  renderMonthLabel()
  const dateInp = document.getElementById('date-inp') as HTMLInputElement
  const filterInp = document.getElementById('trx-date-filter') as HTMLInputElement
  if (dateInp) dateInp.value = todayStr()
  if (filterInp) filterInp.value = currentMonth

  const [trx, bl, rc, pa, fc, fa] = await Promise.all([
    api('/api/transactions'), api('/api/buffer-logs'), api('/api/reconciliations'),
    api('/api/portfolio/assets'), api('/api/finance-categories'), api('/api/finance-accounts'),
  ])
  transactions = trx; bufferLogs = bl; reconciliations = rc; portfolioAssets = pa || []
  await initFinCats(fc, trx)
  await initFinAccounts(fa, rc)
  if (filterInp) filterInp.value = currentMonth
  if (dateInp) dateInp.value = todayStr()

  const firstTab = document.querySelector('.fin-ttab') as HTMLElement
  switchType(firstTab?.dataset?.type || 'income', firstTab)
  render()
  fillReconFromLast()
}

const WINDOW_FNS = [
  'calPrev', 'calNext', 'calSelectDay', 'selectYtdYear', 'toggleFinCat',
  'toggleHide', 'toggleBreakdown', 'changeMonth', 'saveBudgetEndDate',
  'switchType', 'renderCatChips', 'selectCat', 'addTransaction', 'delTransaction', 'renderTrxList',
  'toggleBufLog', 'openBufModal', 'selectBufCat', 'closeBufModal', 'confirmBuffer',
  'openCatManager', 'renderCatManagerList', 'toggleCatEdit', 'saveCatEdit', 'addCatFromManager', 'deleteCat', 'closeCatModal',
  'openAcctManager', 'closeAcctModal', 'renderAcctManagerList', 'toggleAcctEdit', 'saveAcctEdit', 'addAcct', 'deleteAcct',
  'rcInput', 'rcFocus', 'rcBlur', 'calcRecon', 'saveRecon', 'delRecon',
] as const

export default function FinancePage() {
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    const w = window as unknown as Record<string, unknown>
    WINDOW_FNS.forEach(fn => { w[fn] = eval(fn) })
    init()
    return () => {
      if (finChartInstance) { finChartInstance.destroy(); finChartInstance = null }
      WINDOW_FNS.forEach(fn => delete w[fn])
    }
  }, [])

  return (
    <DashboardShell title="Finance">
      <style>{`
        :root{
          --bg:#0b0c10;--bg2:#1c1e27;--white:#15161c;
          --border:rgba(255,255,255,.08);--border2:rgba(255,255,255,.16);
          --text:#eef0f5;--text2:#97a0b3;--text3:#687087;--text4:rgba(255,255,255,.14);
          --blk:#eef0f5;
          --red:#3e6df0;--red2:#2f56d1;--red-bg:rgba(62,109,240,.14);--red-border:rgba(62,109,240,.35);
          --green:#34d399;--green-bg:rgba(52,211,153,.12);--green-border:rgba(52,211,153,.3);
          --gold:#f0b429;--gold-bg:rgba(240,180,41,.12);--gold-border:rgba(240,180,41,.3);
          --blue:#60a5fa;--blue-bg:rgba(96,165,250,.12);
          --r:10px;--r2:7px;
          --s1:0 1px 3px rgba(0,0,0,.4);--s2:0 6px 20px rgba(0,0,0,.45);--s3:0 10px 36px rgba(0,0,0,.55);
        }
        .fin-main{display:grid;grid-template-columns:380px 1fr 300px;gap:12px;padding:12px;min-height:0;}
        @media(max-width:1024px){.fin-main{grid-template-columns:1fr;padding:8px;gap:8px;}}
        .fin-col{display:flex;flex-direction:column;gap:12px;min-height:0;}
        .fin-col:first-child{overflow:hidden;}
        .fin-col:nth-child(2){overflow-y:auto;min-width:0;}
        .fin-col:last-child{overflow-y:auto;}
        .card{background:var(--white);border:1px solid var(--border);border-radius:10px;box-shadow:var(--s1);overflow:hidden;}
        .card-hdr{padding:12px 16px 10px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
        .card-title{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text);}
        .fin-cal{padding:12px 14px;}
        .fin-cal-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}
        .fin-cal-mnth{font-size:12px;font-weight:700;color:var(--text);}
        .fin-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;}
        .fin-cdname{font-size:8px;font-weight:700;text-align:center;color:var(--text3);padding:3px 0;letter-spacing:.04em;}
        .fin-cday{font-size:9px;padding:4px 2px;text-align:center;border-radius:4px;cursor:pointer;min-height:32px;transition:background .1s;}
        .fin-cday:hover{background:rgba(255,255,255,.1);}
        .fin-cday.today .fin-day-num{background:var(--red);color:#fff;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;margin:0 auto;}
        .fin-cday.othermo{opacity:.25;}
        .fin-day-num{font-size:9px;font-weight:600;color:var(--text2);}
        .fin-day-exp{font-size:7px;color:var(--red);font-weight:700;margin-top:1px;}
        .mnav{background:none;border:1px solid var(--border);width:22px;height:22px;border-radius:var(--r2);cursor:pointer;font-size:11px;color:var(--text2);display:flex;align-items:center;justify-content:center;transition:all .15s;}
        .mnav:hover{border-color:var(--gold);color:var(--gold);}
        .type-tabs{display:flex;border-bottom:1px solid var(--border);}
        .fin-ttab{flex:1;padding:9px 4px;font-size:10px;font-weight:700;border:none;background:none;cursor:pointer;color:var(--text3);border-bottom:2px solid transparent;transition:all .15s;font-family:inherit;}
        .fin-ttab.active{color:var(--red);border-bottom-color:var(--red);}
        .fin-ttab:hover:not(.active){color:var(--text);}
        .cat-chips{display:flex;flex-wrap:wrap;gap:5px;padding:8px 12px 6px;min-height:38px;}
        .cat-chip{font-size:10px;font-weight:600;padding:4px 10px;border-radius:20px;border:1px solid var(--border);cursor:pointer;background:var(--bg);color:var(--text2);transition:all .15s;white-space:nowrap;}
        .cat-chip.active{background:var(--red);color:#fff;border-color:var(--red);}
        .amount-wrap{padding:10px 14px 8px;border-top:1px solid var(--border);}
        .amount-label{font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);margin-bottom:4px;}
        .amount-row{display:flex;align-items:center;gap:6px;}
        .amount-prefix{font-size:16px;font-weight:700;color:var(--text3);}
        .amount-inp{flex:1;border:none;outline:none;font-size:24px;font-weight:700;color:var(--text);background:transparent;font-family:inherit;width:100%;}
        .extra-row{display:flex;gap:8px;padding:0 14px 8px;}
        .date-inp,.note-inp{flex:1;border:1px solid var(--border);border-radius:var(--r2);padding:6px 8px;font-size:11px;outline:none;background:var(--bg);color:var(--text);font-family:inherit;transition:border-color .15s;}
        .date-inp:focus,.note-inp:focus{border-color:rgba(255,255,255,.25);}
        .fin-btn-add{width:calc(100% - 28px);margin:0 14px 14px;background:var(--red);color:#fff;border:none;border-radius:var(--r2);padding:9px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:background .15s;}
        .fin-btn-add:hover{background:var(--red2);}
        .trx-list{flex:1;overflow-y:auto;max-height:340px;}
        .trx-item{display:flex;align-items:center;gap:8px;padding:7px 14px;border-bottom:1px solid var(--border);transition:background .1s;}
        .trx-item:hover{background:rgba(255,255,255,.03);}
        .trx-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
        .trx-info{flex:1;min-width:0;}
        .trx-cat{font-size:11px;font-weight:600;color:var(--text);}
        .trx-note{font-size:9px;color:var(--text3);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .trx-amount{font-size:11px;font-weight:700;white-space:nowrap;flex-shrink:0;}
        .trx-del{background:none;border:none;color:var(--text4);cursor:pointer;font-size:11px;padding:0 2px;flex-shrink:0;transition:color .15s;}
        .trx-del:hover{color:var(--red);}
        .trx-empty{padding:20px 14px;text-align:center;font-size:10px;color:var(--text4);}
        .sum-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--border);}
        .sum-box{padding:12px 14px;background:var(--white);}
        .sum-lbl{font-size:8px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);margin-bottom:3px;}
        .sum-val{font-size:14px;font-weight:700;}
        .sum-val.green{color:var(--green);}
        .sum-val.red{color:var(--red);}
        .sum-val.blue{color:var(--blue);}
        .sum-val.gold{color:var(--gold);}
        .chart-wrap-fin{position:relative;min-height:200px;}
        .chart-wrap-fin canvas{width:100%!important;height:200px!important;}
        .saverate-bar{height:3px;background:var(--border);margin:0 14px;border-radius:2px;overflow:hidden;}
        .saverate-fill{height:100%;background:var(--green);border-radius:2px;transition:width .5s;}
        .breakdown,.bk-row{display:flex;justify-content:space-between;align-items:center;padding:5px 14px;border-top:1px solid var(--border);}
        .bk-label{font-size:10px;font-weight:600;color:var(--text2);}
        .bk-val{font-size:11px;font-weight:700;color:var(--red);}
        .buffer-bal{padding:14px 16px;text-align:center;border-bottom:1px solid var(--border);}
        .buffer-amt{font-size:22px;font-weight:700;color:var(--gold);}
        .buffer-lbl{font-size:8px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);margin-top:2px;}
        .btn-buf-out{background:var(--red);color:#fff;border:none;border-radius:var(--r2);padding:8px;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit;transition:background .15s;}
        .btn-buf-out:hover{background:var(--red2);}
        .buf-log-list{padding:0;}
        .buf-log-item{display:flex;align-items:flex-start;gap:8px;padding:7px 14px;border-bottom:1px solid var(--border);font-size:10px;}
        .recon-row{display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-bottom:1px solid var(--border);}
        .recon-lbl{font-size:10px;font-weight:600;color:var(--text2);}
        .recon-inp{border:1px solid var(--border);border-radius:var(--r2);padding:4px 8px;font-size:11px;text-align:right;width:120px;outline:none;background:rgba(255,255,255,.05);color:var(--text);font-family:inherit;transition:border-color .15s;}
        .recon-inp:focus{border-color:rgba(255,255,255,.3);}
        .recon-result{padding:10px 14px;}
        .recon-diff-row{display:flex;justify-content:space-between;align-items:center;padding:4px 0;}
        .recon-diff-lbl{font-size:10px;color:var(--text3);}
        .recon-diff-val{font-size:12px;font-weight:700;}
        .recon-diff-val.ok{color:var(--green);}
        .recon-diff-val.warn{color:var(--red);}
        .btn-recon{width:100%;background:var(--blk);color:var(--bg);border:none;border-radius:var(--r2);padding:8px;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit;margin-top:8px;transition:background .15s;}
        .btn-recon:hover{background:rgba(255,255,255,.9);}
        .recon-history{border-top:1px solid var(--border);padding:6px 14px;}
        .recon-hist-item{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:10px;}
        .moverlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:500;display:none;align-items:center;justify-content:center;padding:20px;}
        .moverlay.open{display:flex;}
        .modal{background:var(--bg2);border:1px solid var(--border);border-radius:10px;width:100%;max-width:400px;box-shadow:0 8px 24px rgba(0,0,0,.5);}
        .mhdr{padding:14px 18px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
        .mtitle{font-size:13px;font-weight:700;color:var(--text);}
        .mclose{background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;}
        .mbody{padding:16px 18px;}
        .mfooter{padding:10px 18px 16px;display:flex;gap:8px;justify-content:flex-end;}
        .btn-cancel{background:none;border:1px solid var(--border);color:var(--text2);padding:7px 14px;border-radius:var(--r2);font-size:11px;cursor:pointer;font-family:inherit;}
        .btn-save{background:var(--blk);border:none;color:#fff;padding:7px 18px;border-radius:var(--r2);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;}
        .btn-save.gold{background:var(--gold);}
        .fin-toast-container{position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:6px;}
        .fin-toast{display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:8px;font-size:12px;font-weight:600;color:#fff;background:#1a1a1a;border:1px solid rgba(255,255,255,.1);box-shadow:0 4px 16px rgba(0,0,0,.4);opacity:0;transform:translateY(6px);transition:all .2s;}
        .fin-toast.show{opacity:1;transform:translateY(0);}
        .fin-toast.hide{opacity:0;transform:translateY(6px);}
        .fin-toast.success{background:#15a34a;}
        .fin-toast.error{background:#d12b2b;}
        .fin-toast.warning{background:#c9841a;}
      `}</style>

      <div className="fin-main">
        {/* LEFT */}
        <div className="fin-col">
          <div className="card">
            <div className="fin-cal">
              <div className="fin-cal-nav">
                <button className="mnav" onClick={calPrev}>‹</button>
                <div className="fin-cal-mnth" id="fin-cal-lbl">—</div>
                <button className="mnav" onClick={calNext}>›</button>
              </div>
              <div className="fin-cal-grid" id="fin-cal-grid">
                <div className="fin-cdname">Sen</div><div className="fin-cdname">Sel</div><div className="fin-cdname">Rab</div>
                <div className="fin-cdname">Kam</div><div className="fin-cdname">Jum</div><div className="fin-cdname">Sab</div><div className="fin-cdname">Min</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="type-tabs">
              <button className="fin-ttab active" data-type="income" onClick={e => switchType('income', e.currentTarget)}>Income</button>
              <button className="fin-ttab" data-type="expense" onClick={e => switchType('expense', e.currentTarget)}>Expense</button>
              <button className="fin-ttab" data-type="investment" onClick={e => switchType('investment', e.currentTarget)}>Invest</button>
              <button className="fin-ttab" data-type="buffer" onClick={e => switchType('buffer', e.currentTarget)}>Buffer</button>
            </div>
            <div style={{ position: 'relative' }}>
              <div className="cat-chips" id="cat-chips"></div>
              <button onClick={openCatManager} title="Kelola kategori" style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text3)', padding: 2 }}>✏</button>
            </div>
            <div className="amount-wrap">
              <div className="amount-label">Nominal</div>
              <div className="amount-row">
                <span className="amount-prefix">Rp</span>
                <input type="number" className="amount-inp" id="amount-inp" placeholder="0" min="0" onKeyDown={e => e.key === 'Enter' && addTransaction()} />
              </div>
            </div>
            <div className="extra-row" id="asset-row" style={{ display: 'none' }}>
              <select className="note-inp" id="asset-sel" style={{ flex: 1, cursor: 'pointer' }}>
                <option value="">— Pilih Aset Tujuan —</option>
              </select>
            </div>
            <div className="extra-row">
              <input type="date" className="date-inp" id="date-inp" />
              <input type="text" className="note-inp" id="note-inp" placeholder="Catatan (optional)" onKeyDown={e => e.key === 'Enter' && addTransaction()} />
            </div>
            <button className="fin-btn-add" onClick={addTransaction}>+ Tambah</button>
          </div>

          <div className="card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="card-hdr">
              <div className="card-title">Transaksi Bulan Ini</div>
              <input type="month" id="trx-date-filter" onChange={renderTrxList} style={{ fontSize: 10, border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '3px 7px', background: 'var(--bg)', outline: 'none', color: 'var(--text2)' }} />
            </div>
            <div className="trx-list" id="trx-list"></div>
          </div>
        </div>

        {/* CENTER */}
        <div className="fin-col">
          <div className="card">
            <div className="card-hdr">
              <div className="card-title" id="ytd-title">Your Cashflow</div>
              <div id="ytd-yr-chips" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}></div>
            </div>
            <div className="sum-grid">
              <div className="sum-box"><div className="sum-lbl">Total Income</div><div className="sum-val green" id="ytd-income">Rp 0</div></div>
              <div className="sum-box">
                <div className="sum-lbl">Total Expense</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                  <div className="sum-val red" id="ytd-expense">Rp 0</div>
                  <span id="ytd-expense-pct" style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', opacity: .75 }}></span>
                </div>
              </div>
              <div className="sum-box">
                <div className="sum-lbl">Total Deposit</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                  <div className="sum-val blue" id="ytd-invest">Rp 0</div>
                  <span id="ytd-invest-pct" style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', opacity: .75 }}></span>
                </div>
              </div>
              <div className="sum-box">
                <div className="sum-lbl">Total Think &amp; Grow</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                  <div className="sum-val gold" id="ytd-tng">Rp 0</div>
                  <span id="ytd-tng-pct" style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', opacity: .75 }}></span>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-hdr"><div className="card-title" id="chart-title">Expense per Bulan</div></div>
            <div style={{ padding: '10px 14px 6px', overflowX: 'auto' }}>
              <div id="fin-chart-legend" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}></div>
              <div className="chart-wrap-fin"><canvas id="fin-chart-bar"></canvas></div>
            </div>
            <div id="fin-chart-table" style={{ overflowX: 'auto', padding: '0 14px 12px', display: 'none' }}></div>
          </div>

          <div className="card">
            <div className="card-hdr">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button className="mnav" onClick={() => changeMonth(-1)}>‹</button>
                <div className="card-title" id="month-lbl" style={{ whiteSpace: 'nowrap' }}>—</div>
                <button className="mnav" onClick={() => changeMonth(1)}>›</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div id="save-rate-badge" style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)' }}></div>
                <button onClick={toggleHide} id="eye-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text3)', padding: 0 }} title="Sembunyikan angka">👁</button>
              </div>
            </div>
            <div className="sum-grid">
              <div className="sum-box"><div className="sum-lbl">Income</div><div className="sum-val green" id="s-income">Rp 0</div></div>
              <div className="sum-box" onClick={() => toggleBreakdown('expense')} style={{ cursor: 'pointer' }} title="Klik untuk detail"><div className="sum-lbl">Life Cost ▾</div><div className="sum-val red" id="s-expense">Rp 0</div></div>
              <div className="sum-box" onClick={() => toggleBreakdown('invest')} style={{ cursor: 'pointer' }} title="Klik untuk detail"><div className="sum-lbl">Investment ▾</div><div className="sum-val blue" id="s-invest">Rp 0</div></div>
              <div className="sum-box"><div className="sum-lbl">Sisa</div><div className="sum-val gold" id="s-sisa">Rp 0</div></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderTop: '1px solid var(--border)', gap: 6 }}>
              <div>
                <div className="sum-lbl" style={{ marginBottom: 2 }}>Saldo Awal</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }} id="s-opening">Rp 0</div>
              </div>
              <div style={{ fontSize: 16, color: 'var(--border)' }}>→</div>
              <div style={{ textAlign: 'right' }}>
                <div className="sum-lbl" style={{ marginBottom: 2 }}>Saldo Akhir</div>
                <div style={{ fontSize: 13, fontWeight: 700 }} id="s-closing">Rp 0</div>
              </div>
            </div>
            <div className="saverate-bar"><div className="saverate-fill" id="saverate-fill" style={{ width: 0 }}></div></div>
            <div id="daily-budget" style={{ padding: '8px 14px 12px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 3 }}>Est. Harian</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)' }} id="s-daily">—</div>
                <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }} id="daily-info"></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <label style={{ fontSize: 8, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)', display: 'block', marginBottom: 3 }}>Batas Akhir</label>
                <input type="date" id="budget-end-date" onChange={e => saveBudgetEndDate(e.target.value)} style={{ fontFamily: 'inherit', fontSize: 11, border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '5px 8px', background: 'var(--bg)', color: 'var(--text)', outline: 'none', cursor: 'pointer' }} />
              </div>
            </div>
            <div id="breakdown" style={{ display: 'none' }}></div>
            <div id="breakdown-invest" style={{ display: 'none' }}></div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="fin-col">
          <div className="card">
            <div className="card-hdr">
              <div>
                <div className="card-title">🛡 Emergency Buffer</div>
                <div id="buf-account-name" style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2, fontWeight: 500 }}>—</div>
              </div>
            </div>
            <div className="buffer-bal">
              <div className="buffer-amt" id="buf-bal">Rp 0</div>
              <div className="buffer-lbl">Saldo Buffer</div>
            </div>
            <div style={{ padding: '10px 14px 10px' }}>
              <button className="btn-buf-out" onClick={() => openBufModal('out')} style={{ width: '100%' }}>− Ambil dari Buffer</button>
            </div>
            <div style={{ padding: '0 14px 6px', borderTop: '1px solid var(--border)' }}>
              <button onClick={toggleBufLog} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, fontWeight: 600, color: 'var(--text3)', letterSpacing: '.06em', textTransform: 'uppercase', padding: '6px 0', display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
                <span>Riwayat</span><span id="buf-log-arrow" style={{ transition: 'transform .2s', display: 'inline-block' }}>▾</span>
              </button>
            </div>
            <div id="buf-log-list" style={{ display: 'none' }}></div>
          </div>

          <div className="card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="card-hdr">
              <div className="card-title">⚖ Audit Saldo</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div id="recon-badge" style={{ fontSize: 9, fontWeight: 700 }}></div>
                <button onClick={openAcctManager} title="Kelola rekening" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text3)', padding: 2 }}>✏</button>
              </div>
            </div>
            <div id="recon-inputs-wrap"></div>
            <div className="recon-result">
              <div className="recon-diff-row"><span className="recon-diff-lbl">Total Aktual</span><span id="rc-actual" style={{ fontSize: 11, fontWeight: 700 }}>Rp 0</span></div>
              <div className="recon-diff-row"><span className="recon-diff-lbl">Saldo Sistem</span><span id="rc-system" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>Rp 0</span></div>
              <div className="recon-diff-row" style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 8 }}>
                <span className="recon-diff-lbl">Selisih</span>
                <span className="recon-diff-val" id="rc-diff">Rp 0</span>
              </div>
              <div id="rc-warn" style={{ fontSize: 9, marginTop: 4, display: 'none' }}></div>
              <button className="btn-recon" onClick={saveRecon}>Simpan Audit</button>
            </div>
            <div className="recon-history" id="recon-history"></div>
          </div>
        </div>
      </div>

      {/* Cat Modal */}
      <div className="moverlay" id="cat-modal" onClick={e => { if (e.target === e.currentTarget) closeCatModal() }}>
        <div className="modal" style={{ maxWidth: 380 }}>
          <div className="mhdr">
            <div className="mtitle" id="cat-modal-title">Kelola Kategori</div>
            <button className="mclose" onClick={closeCatModal}>✕</button>
          </div>
          <div className="mbody" id="cat-modal-body" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}></div>
          <div className="mbody" style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" id="cat-add-inp" placeholder="Nama kategori baru..." style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 'var(--r2)', padding: '7px 10px', fontSize: 12, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }} onKeyDown={e => e.key === 'Enter' && addCatFromManager()} />
              <button onClick={addCatFromManager} style={{ background: 'var(--blk)', color: '#fff', border: 'none', borderRadius: 'var(--r2)', padding: '7px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>+ Tambah</button>
            </div>
          </div>
        </div>
      </div>

      {/* Acct Modal */}
      <div className="moverlay" id="acct-modal" onClick={e => { if (e.target === e.currentTarget) closeAcctModal() }}>
        <div className="modal" style={{ maxWidth: 380 }}>
          <div className="mhdr">
            <div className="mtitle">Kelola Rekening</div>
            <button className="mclose" onClick={closeAcctModal}>✕</button>
          </div>
          <div className="mbody" id="acct-modal-body" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}></div>
          <div className="mbody" style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" id="acct-add-inp" placeholder="Nama rekening baru..." style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 'var(--r2)', padding: '7px 10px', fontSize: 12, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }} onKeyDown={e => e.key === 'Enter' && addAcct()} />
              <button onClick={addAcct} style={{ background: 'var(--blk)', color: '#fff', border: 'none', borderRadius: 'var(--r2)', padding: '7px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>+ Tambah</button>
            </div>
          </div>
        </div>
      </div>

      {/* Buffer Modal */}
      <div className="moverlay" id="buf-modal" onClick={e => { if (e.target === e.currentTarget) closeBufModal() }}>
        <div className="modal">
          <div className="mhdr">
            <div className="mtitle" id="buf-modal-title">Isi Buffer</div>
            <button className="mclose" onClick={closeBufModal}>✕</button>
          </div>
          <div className="mbody">
            <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>Tanggal</div>
            <input type="date" id="buf-date" style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 'var(--r2)', padding: '7px 10px', fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text)', marginBottom: 10 }} />
            <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>Nominal (Rp)</div>
            <input type="number" id="buf-amount" placeholder="0" style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 'var(--r2)', padding: '9px 12px', fontSize: 16, fontWeight: 700, outline: 'none', background: 'var(--bg)', color: 'var(--text)', marginBottom: 10 }} />
            <div id="buf-expense-section" style={{ display: 'none' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>Untuk expense kategori:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }} id="buf-cat-chips"></div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>Catatan:</div>
            </div>
            <input type="text" id="buf-note" placeholder="Catatan (optional)" style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '7px 10px', fontSize: 11, outline: 'none', background: 'var(--bg)', color: 'var(--text)' }} />
          </div>
          <div className="mfooter">
            <button className="btn-cancel" onClick={closeBufModal}>Batal</button>
            <button className="btn-save gold" onClick={confirmBuffer}>Simpan</button>
          </div>
        </div>
      </div>

      <div id="fin-toast-container" className="fin-toast-container"></div>
    </DashboardShell>
  )
}
