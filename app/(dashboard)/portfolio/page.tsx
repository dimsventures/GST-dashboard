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
let assets: any[] = [], snapshots: any[] = [], withdrawals: any[] = [], positions: any[] = [], financeTransactions: any[] = []
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let marketPrices: Record<string, any> = {}, usdIdrRate = 0, fetchedAt: Date | null = null
let snapMonth = '', portoChart: import('chart.js').Chart | null = null, allocChart: import('chart.js').Chart | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let benchmarkData: any[] | null = null, benchChart: import('chart.js').Chart | null = null, benchPeriod = 'all'

const TYPE_LABEL: Record<string, string> = { stocks_idr: 'Saham IDR', crypto_idr: 'Crypto IDR', crypto_usd: 'Crypto USD', wallet_usd: 'Wallet USD', stocks_usd: 'Saham USD', other: 'Lainnya' }
const typeColor: Record<string, string> = { stocks_idr: '#3b82f6', crypto_idr: '#8b5cf6', crypto_usd: '#f59e0b', wallet_usd: '#ec4899', stocks_usd: '#14b8a6', other: '#6b7280' }
const EXP_CATS = ['Housing', 'Consumption', 'Needs', 'Joy', 'Transport', 'Utilities', 'Electronic', 'Charity', 'Unexpected']
const ALLOC_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316', '#14b8a6', '#84cc16']
const BENCH_COLORS: Record<string, string> = { portfolio: '#10b981', ihsg: '#8b5cf6', btc: '#f59e0b', gold: '#c9841a' }
const MNS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function p2(n: number) { return String(n).padStart(2, '0') }
function todayStr() { const n = new Date(); return `${n.getFullYear()}-${p2(n.getMonth()+1)}-${p2(n.getDate())}` }
function monthStr(y: number, m: number) { return `${y}-${p2(m+1)}` }
function fmtRp(n: number) { return 'Rp ' + Math.round(n).toLocaleString('id-ID') }
function fmtUsd(n: number) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) }
function fmtPct(n: number) { return (n >= 0 ? '+' : '') + n.toFixed(1) + '%' }
function fmtNum(n: number) { return Math.round(n).toLocaleString('id-ID') }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function api(path: string, method = 'GET', body: any = null) {
  const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const r = await fetch(path, opts)
  if (!r.ok) { const t = await r.text(); throw new Error(t) }
  return r.json()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function brokerTickerType(asset: any) {
  if (!asset) return 'stock_idr'
  if (asset.type === 'stocks_idr') return 'stock_idr'
  if (asset.type === 'stocks_usd') return 'stock_usd'
  if (['crypto_usd', 'crypto_idr', 'wallet_usd'].includes(asset.type)) return 'crypto'
  return 'stock_idr'
}

function renderFetchedAt() {
  const el = document.getElementById('fetched-at')
  if (!fetchedAt) { if (el) el.textContent = ''; return }
  const h = fetchedAt.getHours(), m = fetchedAt.getMinutes()
  if (el) el.textContent = `${p2(h)}:${p2(m)} WIB`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMktPrice(pos: any) { return marketPrices[pos.ticker]?.price || 0 }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMktChange(pos: any) { return marketPrices[pos.ticker]?.changePercent || 0 }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calcMarketValue(pos: any) {
  const price = getMktPrice(pos)
  if (!price) return 0
  const qty = Number(pos.qty)
  if (pos.ticker_type === 'stock_idr') return qty * 100 * price
  if (pos.ticker_type === 'crypto' || pos.ticker_type === 'stock_usd') return qty * price * (usdIdrRate || 0)
  return 0
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calcCostBasis(pos: any) {
  const qty = Number(pos.qty), avg = Number(pos.avg_buy_price)
  if (pos.ticker_type === 'stock_idr') return qty * 100 * avg
  if (pos.ticker_type === 'crypto' || pos.ticker_type === 'stock_usd') return qty * avg * (usdIdrRate || 0)
  return 0
}

function render() {
  renderAssets()
  renderPositions()
  renderSummary()
  renderOutlook()
  renderPortoPeriodBar()
  renderPortoSection()
  renderWithdrawals()
  renderWdAssetSelect()
  updateWdAlloc()
  if (benchmarkData) renderBenchmarkChart(benchPeriod)
}

function renderAssets() {
  const el = document.getElementById('asset-list')
  if (!el) return
  if (!assets.length) { el.innerHTML = '<div style="padding:12px 14px;font-size:10px;color:var(--text4);">Belum ada broker.</div>'; return }
  el.innerHTML = assets.map(a => {
    const posCount = positions.filter(p => p.asset_id === a.id && p.is_active).length
    return `<div class="asset-item">
      <div class="asset-dot" style="background:${typeColor[a.type] || '#999'};opacity:${a.is_active ? 1 : .3};"></div>
      <div style="flex:1;min-width:0;">
        <div class="asset-name">${a.name}</div>
        <div class="asset-type">${TYPE_LABEL[a.type] || a.type}${posCount ? ' · ' + posCount + ' posisi' : ''}</div>
      </div>
      <span class="asset-currency">${a.currency}</span>
      <button class="asset-toggle" onclick="toggleAsset('${a.id}',${!a.is_active})" title="${a.is_active ? 'Nonaktifkan' : 'Aktifkan'}">${a.is_active ? '●' : '○'}</button>
    </div>`
  }).join('')
}

let addAssetOpen = false
function toggleAddAsset() {
  addAssetOpen = !addAssetOpen
  const el = document.getElementById('add-asset-form')
  if (el) el.style.display = addAssetOpen ? 'block' : 'none'
}

function onBrokerTypeChange() {
  const type = (document.getElementById('new-asset-type') as HTMLSelectElement)?.value
  const cur = type === 'stocks_idr' ? 'IDR' : 'USD'
  const el = document.getElementById('new-asset-currency-preview')
  if (el) el.textContent = 'Currency: ' + cur
}

async function addAsset() {
  const name = (document.getElementById('new-asset-name') as HTMLInputElement)?.value.trim()
  const type = (document.getElementById('new-asset-type') as HTMLSelectElement)?.value
  const currency = type === 'stocks_idr' ? 'IDR' : 'USD'
  if (!name) return
  const a = await api('/api/portfolio/assets', 'POST', { name, type, currency, is_active: true })
  assets.push(a)
  const inp = document.getElementById('new-asset-name') as HTMLInputElement
  if (inp) inp.value = ''
  addAssetOpen = false
  const form = document.getElementById('add-asset-form')
  if (form) form.style.display = 'none'
  render()
}

async function toggleAsset(id: string, active: boolean) {
  await api('/api/portfolio/assets', 'PATCH', { id, is_active: active })
  const a = assets.find(x => x.id === id)
  if (a) a.is_active = active
  render()
}

function renderPositions() {
  const container = document.getElementById('positions-container')
  if (!container) return
  const activeAssets = assets.filter(a => a.is_active)
  const activePositions = positions.filter(p => p.is_active)

  if (!activeAssets.length) {
    container.innerHTML = '<div class="pos-empty">Tambahkan broker dulu di panel kiri.</div>'
    return
  }

  let html = ''
  activeAssets.forEach(asset => {
    const assetPositions = activePositions.filter(p => p.asset_id === asset.id && Number(p.qty) > 0)
    let brokerTotal = 0
    assetPositions.forEach(p => { brokerTotal += calcMarketValue(p) })
    const cashIdle = Number(asset.cash_idle) || 0
    const cashIdr = asset.currency === 'USD' ? cashIdle * (usdIdrRate || 0) : cashIdle
    const brokerGrand = brokerTotal + cashIdr

    html += `<div class="pos-section">`
    html += `<div class="pos-broker-hdr">
      <div class="pos-broker-name">
        <span style="width:8px;height:8px;border-radius:50%;background:${typeColor[asset.type] || '#999'};display:inline-block;"></span>
        ${asset.name}
      </div>
      <div class="pos-broker-total" style="color:${brokerGrand > 0 ? 'var(--green)' : 'var(--text3)'}">${brokerGrand > 0 ? fmtRp(brokerGrand) : '—'}</div>
    </div>`

    if (assetPositions.length) {
      const isStock = brokerTickerType(asset) === 'stock_idr'
      html += `<table class="pos-table"><thead><tr>
        <th>Ticker</th><th>${isStock ? 'Lot' : 'Qty'}</th><th>Avg Buy</th><th>Market</th><th>Value</th><th>G/L</th><th></th>
      </tr></thead><tbody>`

      assetPositions.forEach(pos => {
        const mktPrice = getMktPrice(pos), mktChg = getMktChange(pos)
        const mv = calcMarketValue(pos), cb = calcCostBasis(pos)
        const gl = mv - cb, glPct = cb > 0 ? (gl / cb * 100) : 0
        const isUsd = pos.ticker_type === 'crypto' || pos.ticker_type === 'stock_usd'
        const avgDisplay = isUsd ? fmtUsd(Number(pos.avg_buy_price)) : fmtRp(Number(pos.avg_buy_price))
        const mktDisplay = mktPrice ? (isUsd ? fmtUsd(mktPrice) : fmtRp(mktPrice)) : '<span style="color:var(--text4);font-style:italic;">...</span>'
        const mktClass = mktChg >= 0 ? 'mkt-up' : 'mkt-down'
        const glClass = gl >= 0 ? 'pos' : 'neg'

        html += `<tr>
          <td><span class="pos-ticker">${pos.ticker}</span></td>
          <td>${Number(pos.qty)}</td>
          <td>${avgDisplay}</td>
          <td class="${mktClass}">${mktDisplay}</td>
          <td style="font-weight:600;">${mktPrice ? fmtRp(mv) : '—'}</td>
          <td><span class="pos-gl ${glClass}">${mktPrice ? fmtPct(glPct) : '—'}</span></td>
          <td><div class="pos-act">
            <button onclick="openAddBuy('${pos.id}')" title="Beli Lagi">+</button>
            <button class="sell" onclick="openSell('${pos.id}')" title="Jual">−</button>
          </div></td>
        </tr>`
      })
      html += `</tbody></table>`
    }

    const isUsdBroker = asset.currency === 'USD'
    const cashDisplay = isUsdBroker ? Number(cashIdle || 0) : cashIdle
    html += `<div style="padding:8px 16px;display:flex;align-items:center;gap:8px;border-top:1px solid var(--border);">
      <span style="font-size:10px;font-weight:600;color:var(--text3);white-space:nowrap;">Cash idle</span>
      <input type="${isUsdBroker ? 'number' : 'text'}" class="mini-inp" id="cash-${asset.id}" value="${isUsdBroker ? (cashDisplay || '') : (cashIdle ? fmtNum(cashIdle) : '')}" placeholder="0" step="${isUsdBroker ? '0.01' : '1'}" style="margin:0;text-align:right;font-weight:600;max-width:160px;" ${isUsdBroker ? '' : `oninput="onCashInput(this)"`} onblur="saveCash('${asset.id}')">
      <span style="font-size:9px;color:var(--text4);">${asset.currency}</span>
      ${isUsdBroker && cashDisplay > 0 && usdIdrRate ? `<span style="font-size:8px;color:var(--text4);">≈ ${fmtRp(cashDisplay * usdIdrRate)}</span>` : ''}
    </div>`
    html += `<div class="pos-add-row"><button class="pos-add-btn" onclick="openAddPosition('${asset.id}')">+ Tambah Posisi</button></div>`
    html += `</div>`
  })

  container.innerHTML = html
}

function numParse(s: string) { return parseInt((s || '').replace(/\./g, '')) || 0 }
function onCashInput(el: HTMLInputElement) {
  const raw = numParse(el.value)
  el.value = raw > 0 ? fmtNum(raw) : ''
}
async function saveCash(assetId: string) {
  const el = document.getElementById('cash-' + assetId) as HTMLInputElement
  const asset = assets.find(a => a.id === assetId)
  if (!asset || !el) return
  const val = asset.currency === 'USD' ? parseFloat(el.value || '0') : numParse(el.value)
  if (Number(asset.cash_idle || 0) === val) return
  asset.cash_idle = val
  try { await api('/api/portfolio/assets', 'PATCH', { id: assetId, cash_idle: val }) } catch (e) { console.warn('Save cash failed:', e) }
  renderSummary()
}

function getTotalCash() {
  return assets.filter(a => a.is_active).reduce((sum, a) => {
    const cash = Number(a.cash_idle) || 0
    return sum + (a.currency === 'USD' ? cash * (usdIdrRate || 0) : cash)
  }, 0)
}

function totalDepositedForAsset(assetId: string, month: string) {
  return financeTransactions.filter(t => t.asset_id === assetId && t.date.slice(0, 7) <= month).reduce((sum, t) => sum + (t.amount || 0), 0)
}

function renderSummary() {
  const activePos = positions.filter(p => p.is_active && Number(p.qty) > 0)
  let totalVal = 0, totalCost = 0, totalDep = 0

  activePos.forEach(p => { totalVal += calcMarketValue(p); totalCost += calcCostBasis(p) })
  const totalCash = getTotalCash()
  totalVal += totalCash

  assets.filter(a => a.is_active).forEach(a => { totalDep += totalDepositedForAsset(a.id, snapMonth) })

  const gl = totalVal - totalDep, roi = totalDep > 0 ? (gl / totalDep * 100) : 0

  const el = (id: string) => document.getElementById(id)
  if (el('total-value')) { el('total-value')!.textContent = fmtRp(totalVal); (el('total-value') as HTMLElement).style.color = 'var(--text)' }
  if (el('total-deposit')) el('total-deposit')!.textContent = fmtRp(totalDep)
  if (el('total-gl')) { el('total-gl')!.textContent = fmtRp(gl); (el('total-gl') as HTMLElement).style.color = gl >= 0 ? 'var(--green)' : 'var(--loss)' }
  if (el('total-cash')) el('total-cash')!.textContent = fmtRp(totalCash)
  const cashPct = totalVal > 0 ? (totalCash / totalVal * 100) : 0
  const cashEl = el('cash-pct') as HTMLElement
  if (cashEl) { cashEl.textContent = cashPct.toFixed(1) + '%'; cashEl.style.color = cashPct >= 30 ? 'var(--green)' : cashPct >= 20 ? 'var(--gold)' : 'var(--red)' }
  if (el('active-count')) el('active-count')!.textContent = String(activePos.length)
  if (el('roi-pill')) el('roi-pill')!.innerHTML = `<span class="roi-pill ${roi >= 0 ? 'pos' : 'neg'}">${fmtPct(roi)} ROI</span>`

  const bd = el('pos-breakdown')
  if (!activePos.length && !totalCash) {
    if (bd) bd.innerHTML = '<div style="padding:14px;font-size:10px;color:var(--text4);text-align:center;">Belum ada posisi.</div>'
    renderAllocChart([], [], totalVal, totalCash)
    return
  }

  const sorted = [...activePos].sort((a, b) => calcMarketValue(b) - calcMarketValue(a))
  if (bd) bd.innerHTML = sorted.map(pos => {
    const mv = calcMarketValue(pos), cb = calcCostBasis(pos)
    const gl = mv - cb, glPct = cb > 0 ? (gl / cb * 100) : 0
    const pct = totalVal > 0 ? (mv / totalVal * 100) : 0
    const asset = assets.find(a => a.id === pos.asset_id)
    const color = typeColor[asset?.type] || '#999'
    return `<div class="bk-item">
      <div class="bk-item-hdr">
        <div class="bk-item-name"><span style="width:7px;height:7px;border-radius:50%;background:${color};display:inline-block;"></span>${pos.ticker}</div>
        <div class="bk-item-val" style="color:${mv > 0 ? 'var(--text)' : 'var(--text3)'}">${mv > 0 ? fmtRp(mv) : '—'}</div>
      </div>
      <div class="bk-item-bar"><div class="bk-item-fill" style="width:${pct.toFixed(1)}%;background:${color};"></div></div>
      <div class="bk-item-meta">
        <span>${Number(pos.qty)}${pos.ticker_type === 'stock_idr' ? ' lot' : ' unit'} @ ${asset?.type === 'stocks_idr' ? fmtRp(Number(pos.avg_buy_price)) : fmtUsd(Number(pos.avg_buy_price))}</span>
        <span style="color:${gl >= 0 ? 'var(--green)' : 'var(--loss)'}">${mv > 0 ? fmtPct(glPct) : '—'}</span>
      </div>
    </div>`
  }).join('')

  if (totalCash > 0 && bd) {
    const cashPctBk = totalVal > 0 ? (totalCash / totalVal * 100) : 0
    bd.innerHTML += `<div class="bk-item">
      <div class="bk-item-hdr">
        <div class="bk-item-name"><span style="width:7px;height:7px;border-radius:50%;background:#9ca3af;display:inline-block;"></span>Cash</div>
        <div class="bk-item-val" style="color:var(--gold)">${fmtRp(totalCash)}</div>
      </div>
      <div class="bk-item-bar"><div class="bk-item-fill" style="width:${cashPctBk.toFixed(1)}%;background:#9ca3af;"></div></div>
      <div class="bk-item-meta"><span>Semua broker</span><span style="color:var(--text3);">${cashPctBk.toFixed(1)}%</span></div>
    </div>`
  }

  renderAllocChart(sorted, activePos, totalVal, totalCash)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function renderAllocChart(_sorted: any[], activePos: any[], totalVal: number, totalCash: number) {
  const merged: Record<string, number> = {}
  activePos.forEach(p => { const mv = calcMarketValue(p); if (!mv) return; merged[p.ticker] = (merged[p.ticker] || 0) + mv })
  const labels = Object.keys(merged).sort((a, b) => merged[b] - merged[a])
  const values = labels.map(l => merged[l])
  if (totalCash > 0) { labels.push('Cash'); values.push(totalCash) }

  const canvas = document.getElementById('alloc-chart') as HTMLCanvasElement
  if (!canvas) return
  if (allocChart) { allocChart.destroy(); allocChart = null }
  if (!values.length) return

  const colors = labels.map((l, i) => l === 'Cash' ? '#9ca3af' : ALLOC_COLORS[i % ALLOC_COLORS.length])
  const Chart = await getChart()
  allocChart = new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: '#15161c' }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.label}: ${fmtRp(ctx.raw as number)} (${((ctx.raw as number) / totalVal * 100).toFixed(1)}%)` } }
      }
    }
  })

  const leg = document.getElementById('alloc-legend')
  if (leg) leg.innerHTML = labels.map((l, i) => {
    const v = values[i], pct = (v / totalVal * 100).toFixed(1), col = colors[i]
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="width:8px;height:8px;border-radius:50%;background:${col};flex-shrink:0;display:inline-block;"></span>
        <span style="font-size:11px;font-weight:600;color:var(--text);">${l}</span>
      </div>
      <div>
        <span style="font-size:11px;font-weight:700;color:${l === 'Cash' ? 'var(--gold)' : 'var(--text)'};">${fmtRp(v)}</span>
        <span style="font-size:10px;color:var(--text3);margin-left:6px;">${pct}%</span>
      </div>
    </div>`
  }).join('')
}

const MN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
function renderSnapMonthLabel() {
  const [y, m] = snapMonth.split('-').map(Number)
  const el = document.getElementById('snap-month-lbl')
  if (el) el.textContent = `${MN[m - 1]} ${y}`
}
function snapMonthChange(d: number) {
  const [y, m] = snapMonth.split('-').map(Number)
  const nd = new Date(y, m - 1 + d, 1)
  snapMonth = monthStr(nd.getFullYear(), nd.getMonth())
  renderSnapMonthLabel()
  renderSummary()
}

async function saveSnapshots() {
  const btn = document.getElementById('btn-snap') as HTMLButtonElement
  if (btn) { btn.textContent = 'Menyimpan...'; btn.disabled = true }
  try {
    const activeAssets = assets.filter(a => a.is_active)
    for (const asset of activeAssets) {
      const assetPositions = positions.filter(p => p.asset_id === asset.id && p.is_active && Number(p.qty) > 0)
      let totalMv = 0
      const tickers: string[] = []
      assetPositions.forEach(p => {
        const mv = calcMarketValue(p)
        totalMv += mv
        tickers.push(`${p.ticker}:${Number(p.qty)}@${getMktPrice(p)}`)
      })
      const cashIdle = Number(asset.cash_idle) || 0
      const cashIdr = asset.currency === 'USD' ? cashIdle * (usdIdrRate || 0) : cashIdle
      totalMv += cashIdr
      if (cashIdle > 0) tickers.push(`CASH:${fmtNum(cashIdle)}`)
      if (totalMv === 0 && !totalDepositedForAsset(asset.id, snapMonth)) continue
      const note = tickers.join(', ')
      const s = await api('/api/portfolio/snapshots', 'POST', { asset_id: asset.id, month: snapMonth, current_value: Math.round(totalMv), note: note || null })
      const idx = snapshots.findIndex(x => x.asset_id === asset.id && x.month === snapMonth)
      if (idx >= 0) snapshots[idx] = s; else snapshots.push(s)
    }
    renderChart()
    if (btn) { btn.textContent = '✓ Tersimpan!'; setTimeout(() => { btn.textContent = '💾 Simpan Snapshot'; btn.disabled = false }, 1500) }
  } catch (e) { alert('Gagal: ' + (e as Error).message); if (btn) { btn.textContent = '💾 Simpan Snapshot'; btn.disabled = false } }
}

let portoPeriod = 'all', portoTab = 'chart', portoGran = 'monthly'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dailyData: any[] = []
const PORTO_PERIODS: [string, string][] = [['all', 'All'], ['5y', '5Y'], ['3y', '3Y'], ['1y', '1Y'], ['6m', '6M'], ['1m', '1M'], ['ytd', 'YTD']]
function monthsBack(n: number) { const d = new Date(); d.setMonth(d.getMonth() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
function portoPeriodFrom(allMonths: string[]) {
  const now = new Date()
  switch (portoPeriod) {
    case 'ytd': return `${now.getFullYear()}-01`
    case '1m': return monthsBack(1)
    case '6m': return monthsBack(6)
    case '1y': return monthsBack(12)
    case '3y': return monthsBack(36)
    case '5y': return monthsBack(60)
    default: return allMonths[0] || '2000-01'
  }
}
function daysBack(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function fmtDayLabel(d: string) { const [, m, dd] = d.split('-'); return `${parseInt(dd)} ${MNS[parseInt(m) - 1]}` }
function getPortoSeries(): { key: string; label: string; value: number; deposited: number }[] {
  if (portoGran === 'daily') {
    return [...dailyData].sort((a, b) => a.date.localeCompare(b.date)).map(d => ({ key: d.date, label: fmtDayLabel(d.date), value: Number(d.total_value) || 0, deposited: Number(d.total_deposited) || 0 }))
  }
  const allMonths = [...new Set(snapshots.map(s => s.month))].sort() as string[]
  const valBy: Record<string, number> = Object.fromEntries(getPortfolioMonthlyValues().map(d => [d.month, d.value]))
  return allMonths.map(m => ({ key: m, label: `${MNS[parseInt(m.slice(5)) - 1]} '${m.slice(2, 4)}`, value: valBy[m] || 0, deposited: financeTransactions.filter(t => t.date.slice(0, 7) <= m).reduce((s, t) => s + (t.amount || 0), 0) }))
}
function portoFromKey(keys: string[]) {
  const now = new Date()
  if (portoGran === 'daily') {
    switch (portoPeriod) {
      case 'ytd': return `${now.getFullYear()}-01-01`
      case '1m': return daysBack(30)
      case '6m': return daysBack(182)
      case '1y': return daysBack(365)
      case '3y': return daysBack(1095)
      case '5y': return daysBack(1825)
      default: return keys[0] || ''
    }
  }
  return portoPeriodFrom(keys)
}
function setPortoGran(g: string) {
  portoGran = g
  document.getElementById('porto-gran-daily')?.classList.toggle('active', g === 'daily')
  document.getElementById('porto-gran-monthly')?.classList.toggle('active', g === 'monthly')
  renderPortoSection()
}
async function recordDailyToday() {
  if (!fetchedAt) return // harga belum kebaca, jangan rekam nilai salah
  const today = todayStr()
  if (dailyData.some(d => d.date === today)) return
  const activePos = positions.filter(p => p.is_active && Number(p.qty) > 0)
  let totalVal = getTotalCash()
  activePos.forEach(p => { totalVal += calcMarketValue(p) })
  if (totalVal <= 0) return
  const totalDeposited = financeTransactions.reduce((s, t) => s + (t.amount || 0), 0)
  try {
    const row = await api('/api/portfolio/daily', 'POST', { date: today, total_value: Math.round(totalVal), total_deposited: Math.round(totalDeposited) })
    dailyData.push(row)
  } catch (e) { console.warn('daily snapshot failed', e) }
}
function renderPortoPeriodBar() {
  const el = document.getElementById('porto-period-bar'); if (!el) return
  el.innerHTML = PORTO_PERIODS.map(([k, l]) => `<button class="porto-period${portoPeriod === k ? ' active' : ''}" onclick="setPortoPeriod('${k}')">${l}</button>`).join('')
}
function setPortoPeriod(p: string) { portoPeriod = p; renderPortoPeriodBar(); renderPortoSection() }
function setPortoTab(t: string) {
  portoTab = t
  document.getElementById('porto-tab-chart')?.classList.toggle('active', t === 'chart')
  document.getElementById('porto-tab-perf')?.classList.toggle('active', t === 'perf')
  const cw = document.getElementById('porto-chart-wrap'), pw = document.getElementById('porto-perf-wrap')
  if (cw) cw.style.display = t === 'chart' ? 'block' : 'none'
  if (pw) pw.style.display = t === 'perf' ? 'block' : 'none'
  renderPortoSection()
}
function renderPortoSection() { if (portoTab === 'chart') renderChart(); else renderPerfTable() }

function renderPerfTable() {
  const el = document.getElementById('porto-perf-wrap'); if (!el) return
  const series = getPortoSeries()
  if (series.length < 2) { el.innerHTML = `<div class="outlook-empty">${portoGran === 'daily' ? 'Data harian mulai terkumpul dari hari ini — cek lagi besok.' : 'Belum cukup snapshot bulanan.'}</div>`; return }
  const from = portoFromKey(series.map(s => s.key))
  const rows = series.map((p, i) => {
    if (i === 0) return { key: p.key, label: p.label, equity: p.value, pnl: null as number | null, pct: null as number | null }
    const prev = series[i - 1]
    const netDep = p.deposited - prev.deposited
    const pnl = (p.value - prev.value) - netDep
    const pct = prev.value > 0 ? pnl / prev.value * 100 : 0
    return { key: p.key, label: p.label, equity: p.value, pnl, pct }
  }).filter(r => r.key >= from).reverse()
  el.innerHTML = `<table class="perf-tbl"><thead><tr><th>${portoGran === 'daily' ? 'Tanggal' : 'Bulan'}</th><th>Equity</th><th>P&amp;L (market)</th></tr></thead><tbody>${rows.map(r => {
    const pnlCell = r.pnl == null ? '<span style="color:var(--text4)">—</span>'
      : `<span class="${r.pnl >= 0 ? 'pos' : 'neg'}">${r.pnl >= 0 ? '+' : ''}${fmtRp(r.pnl)} <span class="perf-pct">(${(r.pct as number) >= 0 ? '+' : ''}${(r.pct as number).toFixed(2)}%)</span></span>`
    return `<tr><td>${r.label}</td><td>${fmtRp(r.equity)}</td><td>${pnlCell}</td></tr>`
  }).join('')}</tbody></table>`
}

async function renderChart() {
  const series = getPortoSeries()
  const from = portoFromKey(series.map(s => s.key))
  const pts = series.filter(s => s.key >= from)
  const canvas = document.getElementById('porto-chart') as HTMLCanvasElement
  if (!canvas) return
  if (portoChart) { portoChart.destroy(); portoChart = null }
  if (pts.length < 1) return
  const labels = pts.map(p => p.label)
  const totalValues = pts.map(p => p.value)
  const totalDeps = pts.map(p => p.deposited)
  const Chart = await getChart()
  portoChart = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets: [
      { label: 'Portfolio Value', data: totalValues, borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,.08)', tension: .4, pointRadius: 3, pointHoverRadius: 5, borderWidth: 2, fill: true },
      { label: 'Total Deposited', data: totalDeps, borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,.06)', tension: .4, pointRadius: 3, pointHoverRadius: 5, borderWidth: 2, fill: true },
    ] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, position: 'top', labels: { font: { size: 10 }, boxWidth: 12, padding: 16, color: '#999' } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmtRp(ctx.raw as number)}` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#666', maxRotation: 45 } },
        y: { grid: { color: 'rgba(255,255,255,.06)' }, ticks: { font: { size: 9 }, color: '#666', callback: (v) => 'Rp ' + (Number(v) / 1000000).toFixed(1) + 'jt' } }
      }
    }
  })
}

function getPortfolioMonthlyValues() {
  const allMonths = [...new Set(snapshots.map(s => s.month))].sort() as string[]
  return allMonths.map(m => ({
    month: m,
    value: assets.filter(a => a.is_active).reduce((sum, a) => {
      const snap = snapshots.filter(s => s.asset_id === a.id && s.month <= m).sort((x: {month:string}, y: {month:string}) => y.month.localeCompare(x.month))[0]
      return sum + (snap?.current_value || 0)
    }, 0)
  }))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function filterByPeriod(arr: any[], period: string) {
  const now = new Date()
  let from: string
  if (period === 'ytd') from = `${now.getFullYear()}-01`
  else if (period === '1y') { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); from = d.toISOString().slice(0, 7) }
  else from = arr[0]?.month || '2000-01'
  return arr.filter(d => d.month >= from)
}

async function renderBenchmarkChart(period: string) {
  benchPeriod = period
  const porto = getPortfolioMonthlyValues()
  const portoFiltered = filterByPeriod(porto, period)
  if (!portoFiltered.length) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const benchFiltered = (benchmarkData || []).map((b: any) => ({
    ...b,
    filtered: filterByPeriod(b.data.map((d: {month:string;price:number}) => ({ month: d.month, price: d.price })), period)
  }))

  const allMonths = [...new Set([
    ...portoFiltered.map(d => d.month),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...benchFiltered.flatMap((b: any) => b.filtered.map((d: {month:string}) => d.month))
  ])].sort().filter(m => m >= portoFiltered[0].month) as string[]

  const portoByMonth = Object.fromEntries(portoFiltered.map(d => [d.month, d.value]))
  const portoValues = allMonths.map(m => portoByMonth[m] ?? null)
  const portoBase = portoValues.find(v => v != null)
  const portoCum = portoValues.map(v => v != null && portoBase ? +((v - portoBase) / portoBase * 100).toFixed(2) : null)

  const labels = allMonths.map(m => `${MNS[+m.slice(5) - 1]} '${m.slice(2, 4)}`)
  const hidden = JSON.parse(sessionStorage.getItem('bench_hidden') || '{}')

  const datasets = [
    { label: 'Portfolio', key: 'portfolio', data: portoCum, borderColor: BENCH_COLORS.portfolio, backgroundColor: 'rgba(16,185,129,.06)', borderWidth: 2, tension: .3, pointRadius: 2, spanGaps: true, fill: false, hidden: !!hidden.portfolio },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...benchFiltered.map((b: any) => {
      const byMonth = Object.fromEntries(b.filtered.map((d: {month:string;price:number}) => [d.month, d.price]))
      const vals = allMonths.map(m => (byMonth[m] as number) ?? null)
      const base = vals.find(v => v != null)
      const cum = vals.map(v => v != null && base ? +((v - base) / base * 100).toFixed(2) : null)
      return { label: b.label, key: b.key, data: cum, borderColor: BENCH_COLORS[b.key] || '#999', borderWidth: 1.5, tension: .3, pointRadius: 1.5, spanGaps: true, fill: false, hidden: !!hidden[b.key] }
    })
  ]

  const canvas = document.getElementById('bench-chart') as HTMLCanvasElement
  if (!canvas) return
  const loadingEl = document.getElementById('bench-loading')
  if (loadingEl) loadingEl.style.display = 'none'
  canvas.style.display = 'block'
  if (benchChart) { benchChart.destroy(); benchChart = null }

  const Chart = await getChart()
  benchChart = new Chart(canvas, {
    type: 'line',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { labels, datasets: datasets as any },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tooltip: { callbacks: { label: (ctx: any) => { const v = ctx.raw as number | null; return v != null ? `${ctx.dataset.label}: ${v >= 0 ? '+' : ''}${v.toFixed(1)}%` : '' } } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#666', maxRotation: 45, minRotation: 45 } },
        y: { grid: { color: 'rgba(255,255,255,.06)' }, ticks: { font: { size: 9 }, color: '#666', callback: v => (Number(v) >= 0 ? '+' : '') + Number(v).toFixed(0) + '%' } }
      }
    }
  })

  const portoLast = portoValues.filter(v => v != null).at(-1) as number | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderBenchLegend(datasets, portoCum, benchFiltered.map((b: any) => {
    const byMonth = Object.fromEntries(b.filtered.map((d: {month:string;price:number}) => [d.month, d.price]))
    const vals = allMonths.map(m => (byMonth[m] as number) ?? null)
    const base = vals.find(v => v != null)
    const last = vals.filter(v => v != null).at(-1)
    return { key: b.key, label: b.label, pct: base && last ? ((last - base) / base * 100) : null }
  }), portoBase, portoLast)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderBenchLegend(datasets: any[], portoCum: (number|null)[], benchPcts: any[], portoBase: number | undefined, portoLast: number | undefined) {
  const leg = document.getElementById('bench-legend')
  if (!leg) return
  const portoPct = portoBase && portoLast ? ((portoLast - portoBase) / portoBase * 100) : null
  const items = [
    { key: 'portfolio', label: 'Portfolio', pct: portoPct, color: BENCH_COLORS.portfolio },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...benchPcts.map((b: any) => ({ ...b, color: BENCH_COLORS[b.key] || '#999' }))
  ]
  leg.innerHTML = items.map(item => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isHidden = !benchChart || (benchChart.data.datasets as any[]).find(d => (d as any).key === item.key)?.hidden
    const pctStr = item.pct != null ? (item.pct >= 0 ? '+' : '') + item.pct.toFixed(1) + '%' : '—'
    const col = item.pct != null ? (item.pct >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--text3)'
    return `<div onclick="toggleBenchSeries('${item.key}')" style="display:flex;align-items:center;gap:5px;cursor:pointer;padding:3px 8px;border-radius:20px;border:1px solid ${isHidden ? 'var(--border)' : item.color};background:${isHidden ? 'transparent' : item.color + '18'};transition:all .15s;">
      <span style="width:10px;height:3px;border-radius:2px;background:${isHidden ? 'var(--border)' : item.color};display:inline-block;"></span>
      <span style="font-size:9px;font-weight:700;color:${isHidden ? 'var(--text4)' : item.color};">${item.label}</span>
      <span style="font-size:9px;font-weight:700;color:${isHidden ? 'var(--text4)' : col};">${pctStr}</span>
    </div>`
  }).join('')
}

function toggleBenchSeries(key: string) {
  if (!benchChart) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ds = (benchChart.data.datasets as any[]).find(d => (d as any).key === key)
  if (!ds) return
  ds.hidden = !ds.hidden
  const stored = JSON.parse(sessionStorage.getItem('bench_hidden') || '{}')
  stored[key] = ds.hidden
  sessionStorage.setItem('bench_hidden', JSON.stringify(stored))
  benchChart.update()
  renderBenchmarkChart(benchPeriod)
}

function setBenchPeriod(p: string, btn: HTMLElement) {
  benchPeriod = p
  document.querySelectorAll('.bench-period').forEach(b => {
    (b as HTMLElement).style.background = 'transparent';
    (b as HTMLElement).style.color = 'var(--text2)';
    (b as HTMLElement).style.borderColor = 'var(--border)'
  })
  btn.style.background = 'var(--blk)'; btn.style.color = 'var(--white)'; btn.style.borderColor = 'var(--blk)'
  renderBenchmarkChart(p)
}

async function fetchMarketPrices() {
  const active = positions.filter(p => p.is_active && Number(p.qty) > 0)
  const symbols: string[] = []
  active.forEach(p => {
    if (p.ticker_type === 'stock_idr') symbols.push(p.ticker + '.JK')
    else if (p.ticker_type === 'crypto') symbols.push(p.ticker + '-USD')
    else if (p.ticker_type === 'stock_usd') symbols.push(p.ticker)
  })
  const hasUsdBroker = assets.some(a => a.is_active && a.currency === 'USD')
  const hasCryptoPos = active.some(p => p.ticker_type === 'crypto')
  if (hasUsdBroker || hasCryptoPos) symbols.push('USDIDR=X')
  if (!symbols.length) { fetchedAt = new Date(); renderFetchedAt(); return }
  try {
    const el = document.getElementById('fetched-at')
    if (el) el.textContent = 'Mengambil harga...'
    const data = await api(`/api/portfolio/market-price?tickers=${[...new Set(symbols)].join(',')}`)
    marketPrices = {}
    ;(data.prices || []).forEach((p: {symbol:string;ticker:string;price:number}) => {
      if (p.symbol === 'USDIDR=X') usdIdrRate = p.price
      else marketPrices[p.ticker] = p
    })
    fetchedAt = new Date(data.fetchedAt)
  } catch (e) { console.warn('Market price fetch failed:', e) }
  renderFetchedAt()
}

async function refreshPrices() { await fetchMarketPrices(); render() }

function openModal(title: string, bodyHtml: string, footerHtml: string) {
  const t = document.getElementById('modal-title')
  const b = document.getElementById('modal-body')
  const f = document.getElementById('modal-footer')
  const o = document.getElementById('modal-overlay')
  if (t) t.textContent = title
  if (b) b.innerHTML = bodyHtml
  if (f) f.innerHTML = footerHtml
  if (o) o.classList.add('open')
}
function closeModal() { document.getElementById('modal-overlay')?.classList.remove('open') }

function openAddPosition(assetId: string) {
  const asset = assets.find(a => a.id === assetId)
  const defType = brokerTickerType(asset)
  const isCrypto = defType === 'crypto', isStockUsd = defType === 'stock_usd', isUsd = isCrypto || isStockUsd
  const placeholder = isCrypto ? 'BTC, ETH, SOL...' : isStockUsd ? 'MSTR, NVDA, PLTR...' : 'MDKA, BBCA, BBRI...'
  openModal('Tambah Posisi — ' + asset.name,
    `<label class="mlbl-f">Kode Ticker</label>
     <input class="mini-inp" id="m-ticker" placeholder="${placeholder}">
     <label class="mlbl-f">Jumlah ${isUsd ? '(unit/share)' : '(lot)'}</label>
     <input type="number" class="mini-inp" id="m-qty" placeholder="0" step="${isUsd ? '0.0001' : '1'}">
     <label class="mlbl-f">Harga Beli Rata-rata ${isUsd ? '(USD)' : '(per lembar IDR)'}</label>
     <input type="number" class="mini-inp" id="m-avg" placeholder="0" step="${isUsd ? '0.01' : '1'}">
     <label class="mlbl-f">Target / Nilai Wajar ${isUsd ? '(USD)' : '(IDR)'} — opsional</label>
     <input type="number" class="mini-inp" id="m-target" placeholder="target jual / intrinsic" step="${isUsd ? '0.01' : '1'}">
     <label class="mlbl-f">Tesis singkat — opsional</label>
     <input class="mini-inp" id="m-thesis" placeholder="kenapa beli & target segini?">`,
    `<button class="btn-cancel" onclick="closeModal()">Batal</button>
     <button class="btn-primary" onclick="submitAddPosition('${assetId}')">Tambah</button>`
  )
  setTimeout(() => (document.getElementById('m-ticker') as HTMLInputElement)?.focus(), 100)
}

async function submitAddPosition(assetId: string) {
  const ticker = (document.getElementById('m-ticker') as HTMLInputElement).value.trim().toUpperCase()
  const asset = assets.find(a => a.id === assetId)
  const type = brokerTickerType(asset)
  const qty = parseFloat((document.getElementById('m-qty') as HTMLInputElement).value)
  const avg = parseFloat((document.getElementById('m-avg') as HTMLInputElement).value)
  let target = parseFloat((document.getElementById('m-target') as HTMLInputElement)?.value) || null
  let thesis = (document.getElementById('m-thesis') as HTMLInputElement)?.value.trim() || null
  let vtype = (type === 'stock_idr' || type === 'stock_usd') ? 'intrinsic' : 'cycle'
  let bear: number | null = null, conviction: string | null = null
  // warisin valuasi dari posisi ticker yang sama (valuasi = properti ticker)
  const existing = positions.find(x => x.ticker === ticker && x.target_price)
  if (existing) {
    if (!target) target = Number(existing.target_price)
    if (!thesis) thesis = existing.thesis || null
    vtype = existing.valuation_type || vtype
    bear = existing.bear_price != null ? Number(existing.bear_price) : null
    conviction = existing.conviction || null
  }
  if (!ticker || !qty || !avg) { alert('Lengkapi semua field.'); return }
  try {
    const p = await api('/api/portfolio/positions', 'POST', { ticker, ticker_type: type, asset_id: assetId, qty, avg_buy_price: avg, target_price: target, valuation_type: vtype, bear_price: bear, conviction, thesis })
    positions.push(p)
    closeModal()
    await fetchMarketPrices()
    render()
  } catch (e) { alert('Gagal: ' + (e as Error).message) }
}

function openAddBuy(posId: string) {
  const pos = positions.find(p => p.id === posId)
  if (!pos) return
  const isUsd = pos.ticker_type === 'crypto' || pos.ticker_type === 'stock_usd'
  const qtyLabel = isUsd ? 'unit' : 'lot', priceLabel = isUsd ? 'USD' : 'IDR'
  openModal('Beli Lagi — ' + pos.ticker,
    `<div style="background:var(--bg);padding:8px 10px;border-radius:var(--r2);margin-bottom:12px;font-size:11px;">
       <strong>${pos.ticker}</strong> · ${Number(pos.qty)} ${qtyLabel} @ ${isUsd ? fmtUsd(Number(pos.avg_buy_price)) : fmtRp(Number(pos.avg_buy_price))}
     </div>
     <label class="mlbl-f">Tambah (${qtyLabel})</label>
     <input type="number" class="mini-inp" id="m-add-qty" placeholder="0" step="${isUsd ? '0.0001' : '1'}" oninput="previewAddBuy('${posId}')">
     <label class="mlbl-f">Harga Beli (${priceLabel})</label>
     <input type="number" class="mini-inp" id="m-buy-price" placeholder="0" step="${isUsd ? '0.01' : '1'}" oninput="previewAddBuy('${posId}')">
     <div class="m-preview" id="m-preview" style="display:none;"></div>`,
    `<button class="btn-cancel" onclick="closeModal()">Batal</button>
     <button class="btn-primary" onclick="submitAddBuy('${posId}')">Konfirmasi</button>`
  )
  setTimeout(() => (document.getElementById('m-add-qty') as HTMLInputElement)?.focus(), 100)
}

function previewAddBuy(posId: string) {
  const pos = positions.find(p => p.id === posId)
  if (!pos) return
  const addQty = parseFloat((document.getElementById('m-add-qty') as HTMLInputElement).value) || 0
  const buyPrice = parseFloat((document.getElementById('m-buy-price') as HTMLInputElement).value) || 0
  const el = document.getElementById('m-preview')
  if (!addQty || !buyPrice) { if (el) el.style.display = 'none'; return }
  const isStock = pos.ticker_type === 'stock_idr', isUsd = pos.ticker_type === 'crypto' || pos.ticker_type === 'stock_usd'
  const oldQty = Number(pos.qty), oldAvg = Number(pos.avg_buy_price)
  const oldUnits = isStock ? oldQty * 100 : oldQty, addUnits = isStock ? addQty * 100 : addQty
  const newAvg = (oldUnits * oldAvg + addUnits * buyPrice) / (oldUnits + addUnits)
  const newQty = oldQty + addQty
  const fmtFn = isUsd ? fmtUsd : fmtRp
  if (el) { el.style.display = 'block'; el.textContent = `Total: ${newQty} ${isStock ? 'lot' : 'unit'} · Avg baru: ${fmtFn(Math.round(newAvg * 100) / 100)}` }
}

async function submitAddBuy(posId: string) {
  const addQty = parseFloat((document.getElementById('m-add-qty') as HTMLInputElement).value)
  const buyPrice = parseFloat((document.getElementById('m-buy-price') as HTMLInputElement).value)
  if (!addQty || !buyPrice) { alert('Lengkapi semua field.'); return }
  try {
    const updated = await api('/api/portfolio/positions', 'POST', { action: 'add_buy', id: posId, add_qty: addQty, buy_price: buyPrice })
    const idx = positions.findIndex(p => p.id === posId)
    if (idx >= 0) positions[idx] = updated
    closeModal(); render()
  } catch (e) { alert('Gagal: ' + (e as Error).message) }
}

function openSell(posId: string) {
  const pos = positions.find(p => p.id === posId)
  if (!pos) return
  const isCrypto = pos.ticker_type === 'crypto', qtyLabel = isCrypto ? 'unit' : 'lot'
  openModal('Jual — ' + pos.ticker,
    `<div style="background:var(--bg);padding:8px 10px;border-radius:var(--r2);margin-bottom:12px;font-size:11px;">
       <strong>${pos.ticker}</strong> · ${Number(pos.qty)} ${qtyLabel} @ ${isCrypto ? fmtUsd(Number(pos.avg_buy_price)) : fmtRp(Number(pos.avg_buy_price))}
     </div>
     <label class="mlbl-f">Jual (${qtyLabel})</label>
     <input type="number" class="mini-inp" id="m-sell-qty" placeholder="0" step="${isCrypto ? '0.0001' : '1'}" max="${pos.qty}" oninput="previewSell('${posId}')">
     <div id="m-sell-preview" style="font-size:10px;color:var(--text3);margin-top:4px;"></div>`,
    `<button class="btn-cancel" onclick="closeModal()">Batal</button>
     <button class="btn-danger" onclick="submitSell('${posId}')">Jual</button>`
  )
  setTimeout(() => (document.getElementById('m-sell-qty') as HTMLInputElement)?.focus(), 100)
}

function previewSell(posId: string) {
  const pos = positions.find(p => p.id === posId)
  const sellQty = parseFloat((document.getElementById('m-sell-qty') as HTMLInputElement)?.value) || 0
  const el = document.getElementById('m-sell-preview')
  if (!sellQty || !el) { if (el) el.textContent = ''; return }
  const remaining = Number(pos.qty) - sellQty
  if (remaining < 0) { el.textContent = '⚠ Melebihi jumlah yang dimiliki'; el.style.color = 'var(--red)'; return }
  el.style.color = 'var(--text3)'
  el.textContent = remaining === 0 ? 'Posisi akan ditutup' : 'Sisa: ' + remaining + (pos.ticker_type === 'stock_idr' ? ' lot' : ' unit')
}

async function submitSell(posId: string) {
  const sellQty = parseFloat((document.getElementById('m-sell-qty') as HTMLInputElement).value)
  if (!sellQty) { alert('Masukkan jumlah yang dijual.'); return }
  try {
    const updated = await api('/api/portfolio/positions', 'POST', { action: 'sell', id: posId, sell_qty: sellQty })
    const idx = positions.findIndex(p => p.id === posId)
    if (idx >= 0) positions[idx] = updated
    closeModal(); render()
  } catch (e) { alert('Gagal: ' + (e as Error).message) }
}

function renderWdAssetSelect() {
  const sel = document.getElementById('wd-asset') as HTMLSelectElement
  if (!sel) return
  const active = assets.filter(a => a.is_active)
  sel.innerHTML = active.map(a => `<option value="${a.id}">${a.name}</option>`).join('')
}

function updateWdAlloc() {
  const type = (document.getElementById('wd-type') as HTMLSelectElement)?.value
  const el = document.getElementById('wd-alloc-extra')
  if (!el) return
  if (type === 'finance_expense') {
    el.innerHTML = `<select class="mini-sel" id="wd-cat">${EXP_CATS.map(c => `<option>${c}</option>`).join('')}</select>`
  } else if (type === 'reinvest') {
    const active = assets.filter(a => a.is_active)
    el.innerHTML = `<select class="mini-sel" id="wd-target">${active.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}</select>`
  } else { el.innerHTML = '' }
}

async function saveWithdrawal() {
  const assetId = (document.getElementById('wd-asset') as HTMLSelectElement)?.value
  const amt = parseInt((document.getElementById('wd-amount') as HTMLInputElement)?.value)
  const type = (document.getElementById('wd-type') as HTMLSelectElement)?.value
  const note = (document.getElementById('wd-note') as HTMLInputElement)?.value.trim()
  if (!assetId || !amt || amt <= 0) { alert('Lengkapi nominal dulu.'); return }
  const date = (document.getElementById('wd-date') as HTMLInputElement)?.value || todayStr()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = { asset_id: assetId, date, amount: amt, note: note || null }
  const reversal = { date, type: 'investment', category: 'Deposit', amount: -amt, asset_id: assetId, note: '[Porto] Tarik ' + (note || '') }
  if (type.startsWith('finance_')) {
    const finType = type.replace('finance_', '')
    const cat = type === 'finance_expense' ? ((document.getElementById('wd-cat') as HTMLSelectElement)?.value || 'Unexpected') : finType
    body.finance_type = finType; body.finance_category = cat
    await api('/api/transactions', 'POST', reversal)
    await api('/api/transactions', 'POST', { date, type: finType, category: cat, amount: amt, note: '[Porto] ' + (note || cat) })
  } else if (type === 'invest_thinkandgrow') {
    body.finance_type = 'investment'; body.finance_category = 'Think and Grow'
    await api('/api/transactions', 'POST', reversal)
    await api('/api/transactions', 'POST', { date, type: 'investment', category: 'Think and Grow', amount: amt, note: '[Porto] ' + (note || 'Think and Grow') })
  } else if (type === 'reinvest') {
    const targetId = (document.getElementById('wd-target') as HTMLSelectElement)?.value
    body.target_asset_id = targetId; body.finance_type = 'reinvest'
    await api('/api/transactions', 'POST', reversal)
    if (targetId) await api('/api/transactions', 'POST', { date, type: 'investment', category: 'Deposit', amount: amt, asset_id: targetId, note: '[Porto] Reinvest ' + (note || '') })
  }
  const wd = await api('/api/portfolio/withdrawals', 'POST', body)
  withdrawals.unshift(wd)
  const ft = await api('/api/transactions')
  financeTransactions = (ft || []).filter((t: {type:string;category:string;asset_id:unknown}) => t.type === 'investment' && t.category === 'Deposit' && t.asset_id)
  const amtInp = document.getElementById('wd-amount') as HTMLInputElement
  const noteInp = document.getElementById('wd-note') as HTMLInputElement
  if (amtInp) amtInp.value = ''
  if (noteInp) noteInp.value = ''
  render()
}

function renderWithdrawals() {
  const el = document.getElementById('wd-list')
  if (!el) return
  if (!withdrawals.length) { el.innerHTML = '<div style="padding:14px;font-size:10px;color:var(--text4);text-align:center;">Belum ada penarikan.</div>'; return }
  el.innerHTML = withdrawals.slice(0, 8).map(w => {
    const a = assets.find((x: {id:string}) => x.id === w.asset_id)
    const target = w.target_asset_id ? assets.find((x: {id:string}) => x.id === w.target_asset_id) : null
    const alloc = w.finance_type === 'reinvest' ? `→ ${target?.name || 'broker lain'}` : `→ ${w.finance_category || w.finance_type}`
    return `<div class="wd-item">
      <div class="wd-item-hdr">
        <span class="wd-asset">${a?.name || '-'}</span>
        <span style="display:flex;align-items:center;gap:6px;">
          <span class="wd-amount">-${fmtRp(w.amount)}</span>
          <button class="wd-del" onclick="delWithdrawal('${w.id}')" title="Hapus penarikan + transaksi Finance terkait">✕</button>
        </span>
      </div>
      <div class="wd-meta">${w.date} · ${alloc}${w.note ? ' · ' + w.note : ''}</div>
    </div>`
  }).join('')
}

function delWithdrawal(id: string) {
  const w = withdrawals.find((x: {id:string}) => x.id === id)
  if (!w) return
  const a = assets.find((x: {id:string}) => x.id === w.asset_id)
  openModal('Hapus Penarikan?',
    `<div style="font-size:12px;color:var(--text2);line-height:1.7;">
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r2);padding:10px 12px;margin-bottom:10px;">
        <div style="font-weight:700;font-size:13px;color:var(--text);">${a?.name || '-'} <span style="color:var(--red);">-${fmtRp(w.amount)}</span></div>
        <div style="color:var(--text3);font-size:10px;margin-top:2px;">${w.date}${w.note ? ' · ' + w.note : ''}</div>
      </div>
      Tindakan ini akan menghapus penarikan ini beserta transaksi Finance terkait yang ditandai <b>[Porto]</b>. Tidak bisa dibatalkan.
    </div>`,
    `<button class="btn-cancel" onclick="closeModal()">Batal</button>
     <button class="btn-danger" onclick="confirmDelWithdrawal('${id}')">Hapus</button>`
  )
}

async function confirmDelWithdrawal(id: string) {
  closeModal()
  const w = withdrawals.find((x: {id:string}) => x.id === id)
  if (!w) return
  const allTx = await api('/api/transactions')
  const reversal = allTx.find((t: {note:string;date:string;type:string;category:string;asset_id:string;amount:number}) => t.note?.startsWith('[Porto] Tarik') && t.date === w.date && t.type === 'investment' && t.category === 'Deposit' && t.asset_id === w.asset_id && t.amount === -w.amount)
  let counterpart = null
  if (w.finance_type === 'reinvest') {
    counterpart = allTx.find((t: {note:string;date:string;type:string;category:string;asset_id:string;amount:number}) => t.note?.startsWith('[Porto] Reinvest') && t.date === w.date && t.type === 'investment' && t.category === 'Deposit' && t.asset_id === w.target_asset_id && t.amount === w.amount)
  } else {
    counterpart = allTx.find((t: {note:string;date:string;type:string;category:string;amount:number}) => t.note?.startsWith('[Porto]') && t.date === w.date && t.type === w.finance_type && t.category === w.finance_category && t.amount === w.amount)
  }
  for (const t of [reversal, counterpart]) {
    if (t) await api('/api/transactions?id=' + t.id, 'DELETE').catch(console.error)
  }
  await api('/api/portfolio/withdrawals?id=' + id, 'DELETE')
  withdrawals = withdrawals.filter((x: {id:string}) => x.id !== id)
  const ft = await api('/api/transactions')
  financeTransactions = (ft || []).filter((t: {type:string;category:string;asset_id:unknown}) => t.type === 'investment' && t.category === 'Deposit' && t.asset_id)
  render()
}

async function fetchBenchmarks() {
  try {
    const data = await api('/api/portfolio/benchmark?range=5y')
    benchmarkData = data.benchmarks || []
    renderBenchmarkChart(benchPeriod)
  } catch {
    const el = document.getElementById('bench-loading')
    if (el) el.textContent = 'Gagal memuat benchmark data.'
  }
}

function sparkSvg(vals: number[], color: string) {
  const w = 54, h = 22, n = vals.length
  if (n < 2) return ''
  const min = Math.min(...vals), max = Math.max(...vals), rng = (max - min) || 1
  const pts = vals.map((v, i) => `${(i / (n - 1) * w).toFixed(1)},${(h - 2 - ((v - min) / rng) * (h - 4)).toFixed(1)}`).join(' ')
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="mkt-spark"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`
}

type MktItem = { key: string; label: string; sub?: string; value: string; changePct: number | null; period: string; spark: number[] | null }
function renderMarket(items: MktItem[]) {
  const el = document.getElementById('mkt-strip')
  if (!el) return
  if (!items.length) { el.innerHTML = '<div class="loading">Data market tidak tersedia.</div>'; return }
  el.innerHTML = items.map(it => {
    const has = it.changePct != null
    const up = (it.changePct ?? 0) >= 0
    const col = !has ? 'var(--text3)' : up ? '#34d399' : '#f6685e'
    const chg = !has ? '—' : (up ? '▲ ' : '▼ ') + Math.abs(it.changePct as number).toFixed(2) + '%'
    const right = it.spark && it.spark.length > 1 ? sparkSvg(it.spark, has ? col : '#687087') : ''
    return `<div class="mkt-cell">
      <div class="mkt-cell-l">
        <div class="mkt-name">${it.label}${it.sub ? ` <span class="mkt-sub">${it.sub}</span>` : ''}</div>
        <div class="mkt-val">${it.value}</div>
      </div>
      <div class="mkt-cell-r">
        ${right}
        <div class="mkt-chg" style="color:${col}">${chg}<span class="mkt-chgp">${it.period}</span></div>
      </div>
    </div>`
  }).join('')
}

async function loadMarketOverview() {
  try {
    const r = await fetch('/api/market-overview')
    if (!r.ok) throw new Error('fetch failed')
    const d = await r.json()
    renderMarket(d.items || [])
  } catch {
    const el = document.getElementById('mkt-strip')
    if (el) el.innerHTML = '<div class="loading">Gagal memuat data market.</div>'
  }
}

function classDrawdown(tt: string) {
  if (tt === 'stock_idr') return 0.30
  if (tt === 'stock_usd') return 0.25
  return 0.65 // crypto & lainnya — default agresif
}

function renderOutlook() {
  const scnEl = document.getElementById('outlook-scenarios')
  const tblEl = document.getElementById('outlook-table')
  if (!scnEl || !tblEl) return
  const activePos = positions.filter(p => p.is_active && Number(p.qty) > 0)
  const totalCash = getTotalCash()
  let curTotal = totalCash, bestTotal = totalCash, worstTotal = totalCash
  let anyTarget = false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byTicker: Record<string, any> = {}
  activePos.forEach(p => {
    const mv = calcMarketValue(p)
    const curPrice = getMktPrice(p)
    const dd = classDrawdown(p.ticker_type)
    const target = Number(p.target_price) || 0
    const bear = Number(p.bear_price) || 0
    if (target) anyTarget = true
    const best = (target && curPrice) ? mv * (target / curPrice) : mv
    const worst = (bear && curPrice) ? mv * (bear / curPrice) : mv * (1 - dd)
    curTotal += mv; bestTotal += best; worstTotal += worst
    // gabung per ticker (sama walau beda broker) — valuasi itu properti ticker
    const t = byTicker[p.ticker] || (byTicker[p.ticker] = { id: p.id, ticker: p.ticker, tt: p.ticker_type, curPrice, mv: 0, qty: 0, cost: 0, target: 0, vtype: null })
    t.id = p.id; t.mv += mv; t.qty += Number(p.qty); t.cost += Number(p.avg_buy_price) * Number(p.qty)
    if (!t.target && target) t.target = target
    if (!t.vtype && p.valuation_type) t.vtype = p.valuation_type
  })

  const pct = (v: number) => curTotal > 0 ? ((v - curTotal) / curTotal * 100) : 0
  const box = (lbl: string, val: number, p: number, cls: string, note: string) =>
    `<div class="scn-box ${cls}"><div class="scn-lbl">${lbl}</div><div class="scn-val">${fmtRp(val)}</div>` +
    `<div class="scn-pct ${cls}">${p >= 0 ? '+' : ''}${p.toFixed(1)}%</div><div class="scn-note">${note}</div></div>`
  scnEl.innerHTML =
    box('Worst Case', worstTotal, pct(worstTotal), 'worst', 'bear / drawdown kelas') +
    box('Base (sekarang)', curTotal, 0, 'base', 'nilai saat ini') +
    box('Best Case', bestTotal, pct(bestTotal), 'best', anyTarget ? 'semua target tesis kena' : 'belum ada target')

  const rows = Object.values(byTicker).sort((a, b) => b.mv - a.mv)
  if (!rows.length) { tblEl.innerHTML = '<div class="outlook-empty">Belum ada posisi. Tambah dulu di tengah.</div>'; return }
  tblEl.innerHTML = `<table class="outlook-tbl"><thead><tr>
    <th>Aset</th><th>Harga</th><th>Target</th><th>MOS</th><th>Upside</th><th></th>
  </tr></thead><tbody>${rows.map(r => {
    const isUsd = r.tt === 'crypto' || r.tt === 'stock_usd'
    const f = (n: number) => isUsd ? fmtUsd(n) : fmtRp(n)
    const wavg = r.qty ? r.cost / r.qty : 0
    const mos = (r.target && wavg) ? (r.target - wavg) / r.target * 100 : null
    const upside = (r.target && r.curPrice) ? (r.target - r.curPrice) / r.curPrice * 100 : null
    const vt = r.vtype === 'cycle' ? ' <span class="vt-tag">cycle</span>' : r.vtype === 'intrinsic' ? ' <span class="vt-tag">intrinsic</span>' : ''
    const targetCell = r.target ? f(r.target) + vt : '<span class="vt-set">— set target —</span>'
    const mosCell = mos != null ? `<span class="${mos >= 0 ? 'pos' : 'neg'}">${mos.toFixed(0)}%</span>` : '—'
    const upCell = upside != null ? `<span class="${upside >= 0 ? 'pos' : 'neg'}">${upside >= 0 ? '+' : ''}${upside.toFixed(0)}%</span>` : '—'
    return `<tr onclick="openValuation('${r.id}')" style="cursor:pointer;">
      <td class="ot-ticker">${r.ticker}</td>
      <td>${r.curPrice ? f(r.curPrice) : '—'}</td>
      <td>${targetCell}</td>
      <td>${mosCell}</td>
      <td>${upCell}</td>
      <td><button class="ot-edit" onclick="event.stopPropagation();openValuation('${r.id}')" title="Edit valuasi">🎯</button></td>
    </tr>`
  }).join('')}</tbody></table>`
}

function openValuation(posId: string) {
  const p = positions.find(x => x.id === posId)
  if (!p) return
  const isUsd = p.ticker_type === 'crypto' || p.ticker_type === 'stock_usd'
  const cur = isUsd ? 'USD' : 'IDR'
  const unit = p.ticker_type === 'stock_idr' ? 'lembar' : 'unit'
  openModal('Valuasi — ' + p.ticker,
    `<div style="font-size:10px;color:var(--text3);margin-bottom:12px;line-height:1.5;">Berlaku ke <b style="color:var(--text2)">semua posisi ${p.ticker}</b> di semua broker.</div>
     <label class="mlbl-f">Target / Nilai Wajar (${cur} per ${unit})</label>
     <input type="number" class="mini-inp" id="v-target" value="${p.target_price || ''}" placeholder="target jual / intrinsic value">
     <label class="mlbl-f">Tipe Valuasi</label>
     <select class="mini-sel" id="v-type">
       <option value="intrinsic"${p.valuation_type === 'intrinsic' ? ' selected' : ''}>Intrinsic (nilai wajar — saham)</option>
       <option value="cycle"${p.valuation_type === 'cycle' ? ' selected' : ''}>Cycle / Macro target (crypto, gold)</option>
     </select>
     <label class="mlbl-f">Bear / Worst price (opsional — kosong = drawdown kelas)</label>
     <input type="number" class="mini-inp" id="v-bear" value="${p.bear_price || ''}" placeholder="harga skenario terburuk">
     <label class="mlbl-f">Conviction</label>
     <select class="mini-sel" id="v-conv">
       <option value=""${!p.conviction ? ' selected' : ''}>—</option>
       <option value="low"${p.conviction === 'low' ? ' selected' : ''}>Low</option>
       <option value="med"${p.conviction === 'med' ? ' selected' : ''}>Medium</option>
       <option value="high"${p.conviction === 'high' ? ' selected' : ''}>High</option>
     </select>
     <label class="mlbl-f">Tesis (kenapa nilainya segini?)</label>
     <textarea class="mini-inp" id="v-thesis" rows="3" placeholder="mis. fair P/E 16 × EPS 690 = 11.040" style="resize:vertical;">${p.thesis || ''}</textarea>`,
    `<button class="btn-cancel" onclick="closeModal()">Batal</button>
     <button class="btn-primary" onclick="submitValuation('${posId}')">Simpan</button>`
  )
  setTimeout(() => (document.getElementById('v-target') as HTMLInputElement)?.focus(), 100)
}

async function submitValuation(posId: string) {
  const p = positions.find(x => x.id === posId)
  if (!p) return
  const target = parseFloat((document.getElementById('v-target') as HTMLInputElement)?.value) || null
  const bear = parseFloat((document.getElementById('v-bear') as HTMLInputElement)?.value) || null
  const vtype = (document.getElementById('v-type') as HTMLSelectElement)?.value || null
  const conv = (document.getElementById('v-conv') as HTMLSelectElement)?.value || null
  const thesis = (document.getElementById('v-thesis') as HTMLTextAreaElement)?.value.trim() || null
  const sameTicker = positions.filter(x => x.ticker === p.ticker)
  try {
    await Promise.all(sameTicker.map(pos => api('/api/portfolio/positions', 'PATCH', { id: pos.id, target_price: target, bear_price: bear, valuation_type: vtype, conviction: conv, thesis })))
    sameTicker.forEach(pos => { pos.target_price = target; pos.bear_price = bear; pos.valuation_type = vtype; pos.conviction = conv; pos.thesis = thesis })
    closeModal(); renderOutlook()
  } catch (e) { alert('Gagal simpan valuasi: ' + (e as Error).message) }
}

async function init() {
  loadMarketOverview()
  const now = new Date()
  const wdDateEl = document.getElementById('wd-date') as HTMLInputElement
  if (wdDateEl) wdDateEl.value = todayStr()
  snapMonth = monthStr(now.getFullYear(), now.getMonth())
  renderSnapMonthLabel()
  const [a, s, w, p, ft, dly] = await Promise.all([
    api('/api/portfolio/assets'),
    api('/api/portfolio/snapshots'),
    api('/api/portfolio/withdrawals'),
    api('/api/portfolio/positions'),
    api('/api/transactions'),
    api('/api/portfolio/daily'),
  ])
  assets = a; snapshots = s; withdrawals = w; positions = p; dailyData = dly || []
  financeTransactions = (ft || []).filter((t: {type:string;category:string;asset_id:unknown}) => t.type === 'investment' && t.category === 'Deposit' && t.asset_id)
  await fetchMarketPrices()
  render()
  recordDailyToday()
  fetchBenchmarks()
}

const WINDOW_FNS = [
  'toggleAddAsset', 'onBrokerTypeChange', 'addAsset', 'toggleAsset',
  'onCashInput', 'saveCash', 'openAddPosition', 'submitAddPosition',
  'openAddBuy', 'previewAddBuy', 'submitAddBuy', 'openSell', 'previewSell', 'submitSell',
  'saveWithdrawal', 'updateWdAlloc', 'delWithdrawal', 'confirmDelWithdrawal',
  'closeModal', 'refreshPrices', 'snapMonthChange', 'saveSnapshots',
  'setBenchPeriod', 'toggleBenchSeries',
  'openValuation', 'submitValuation', 'setPortoPeriod',
] as const

export default function PortfolioPage() {
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    const w = window as unknown as Record<string, unknown>
    WINDOW_FNS.forEach(fn => { w[fn] = eval(fn) })

    init()

    return () => {
      if (portoChart) { portoChart.destroy(); portoChart = null }
      if (allocChart) { allocChart.destroy(); allocChart = null }
      if (benchChart) { benchChart.destroy(); benchChart = null }
      WINDOW_FNS.forEach(fn => delete w[fn])
    }
  }, [])

  return (
    <DashboardShell title="Portfolio">
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
          --loss:#f6685e;--loss-bg:rgba(246,104,94,.14);--loss-border:rgba(246,104,94,.35);
          --r:10px;--r2:7px;
          --s1:0 1px 3px rgba(0,0,0,.4);--s2:0 6px 20px rgba(0,0,0,.45);--s3:0 10px 36px rgba(0,0,0,.55);--sb:0 2px 8px rgba(0,0,0,.30),0 3px 11px rgba(62,109,240,.22);
        }
        .porto-main{display:grid;grid-template-columns:260px 1fr 280px;gap:12px;padding:12px;}
        @media(max-width:768px){.porto-main{grid-template-columns:1fr;padding:8px;gap:8px;}}
        .card{background:var(--white);border:1px solid var(--border);border-radius:10px;box-shadow:var(--sb);overflow:hidden;margin-bottom:12px;}
        .card:last-child{margin-bottom:0;}
        .mkt-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(208px,1fr));}
        .mkt-cell{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 16px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);min-width:0;}
        .mkt-cell-l{min-width:0;}
        .mkt-name{font-size:9.5px;font-weight:700;letter-spacing:.05em;color:var(--text2);text-transform:uppercase;white-space:nowrap;display:flex;align-items:baseline;gap:4px;}
        .mkt-sub{font-size:7.5px;font-weight:600;color:var(--text3);text-transform:none;letter-spacing:0;}
        .mkt-val{font-size:14px;font-weight:700;color:var(--text);margin-top:3px;white-space:nowrap;}
        .mkt-cell-r{display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex-shrink:0;}
        .mkt-spark{display:block;}
        .mkt-chg{font-size:10px;font-weight:700;white-space:nowrap;display:flex;align-items:baseline;gap:4px;}
        .mkt-chgp{font-size:7px;font-weight:600;color:var(--text4);letter-spacing:.04em;}
        .mkt-strip .loading{grid-column:1/-1;text-align:center;padding:18px;color:var(--text4);font-size:11px;font-style:italic;}
        .outlook-body{display:grid;grid-template-columns:300px 1fr;}
        @media(max-width:768px){.outlook-body{grid-template-columns:1fr;}}
        .outlook-donut{border-right:1px solid var(--border);padding:14px 16px;}
        @media(max-width:768px){.outlook-donut{border-right:none;border-bottom:1px solid var(--border);}}
        .outlook-right{padding:14px 16px;min-width:0;}
        .scn-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;}
        .scn-box{border:1px solid var(--border);border-radius:var(--r2);padding:11px 13px;}
        .scn-box.worst{border-color:rgba(246,104,94,.32);}
        .scn-box.best{border-color:var(--green-border);}
        .scn-lbl{font-size:8.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);}
        .scn-val{font-size:16px;font-weight:700;color:var(--text);margin-top:5px;line-height:1.1;}
        .scn-pct{font-size:11px;font-weight:700;margin-top:3px;}
        .scn-pct.worst{color:#f6685e;}.scn-pct.best{color:#34d399;}.scn-pct.base{color:var(--text3);}
        .scn-note{font-size:8.5px;color:var(--text4);margin-top:4px;}
        .outlook-tbl{width:100%;border-collapse:collapse;font-size:11px;}
        .outlook-tbl th{text-align:left;padding:5px 8px;font-size:8px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text3);border-bottom:1px solid var(--border);}
        .outlook-tbl th:nth-child(n+2){text-align:right;}
        .outlook-tbl td{padding:6px 8px;border-bottom:1px solid var(--border);color:var(--text);}
        .outlook-tbl td:nth-child(n+2){text-align:right;}
        .outlook-tbl tr:last-child td{border-bottom:none;}
        .outlook-tbl tr:hover{background:rgba(255,255,255,.03);}
        .ot-ticker{font-weight:700;}
        .outlook-tbl .pos{color:var(--green);font-weight:600;}
        .outlook-tbl .neg{color:#f6685e;font-weight:600;}
        .vt-tag{font-size:7px;background:rgba(255,255,255,.06);color:var(--text3);padding:1px 4px;border-radius:6px;text-transform:uppercase;letter-spacing:.04em;}
        .vt-set{color:var(--blue);font-size:10px;}
        .ot-edit{background:none;border:none;cursor:pointer;font-size:12px;padding:0;opacity:.6;}
        .ot-edit:hover{opacity:1;}
        .outlook-empty{padding:18px;text-align:center;font-size:10px;color:var(--text4);}
        .card-hdr{padding:12px 16px 10px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
        .card-title{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text);}
        .card-body{padding:14px 16px;}
        .asset-item{display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--border);transition:background .12s;}
        .asset-item:last-child{border-bottom:none;}
        .asset-item:hover{background:rgba(255,255,255,.04);}
        .asset-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
        .asset-name{flex:1;font-size:11px;font-weight:600;color:var(--text);}
        .asset-type{font-size:9px;color:var(--text3);font-weight:500;}
        .asset-currency{font-size:8px;font-weight:700;padding:1px 5px;border-radius:8px;background:rgba(255,255,255,.08);color:var(--text3);}
        .asset-toggle{background:none;border:none;cursor:pointer;font-size:10px;color:var(--text3);transition:color .15s;}
        .asset-toggle:hover{color:var(--red);}
        .add-asset-form{padding:10px 12px;border-top:1px solid var(--border);}
        .mini-inp{width:100%;border:1px solid rgba(255,255,255,.12);border-radius:9px;padding:8px 10px;font-size:12px;outline:none;background:#0b0c10;color:#eef0f5;color-scheme:dark;margin-bottom:8px;transition:border-color .15s;box-sizing:border-box;}
        .mini-inp:focus{border-color:var(--red);}
        .mini-sel{width:100%;border:1px solid rgba(255,255,255,.12);border-radius:9px;padding:8px 10px;font-size:12px;outline:none;background:#0b0c10;color:#eef0f5;color-scheme:dark;margin-bottom:8px;box-sizing:border-box;}
        .mini-sel:focus{border-color:var(--red);}
        .btn-sm{width:100%;background:var(--blk);color:var(--bg);border:none;border-radius:var(--r2);padding:7px;font-size:10px;font-weight:700;cursor:pointer;transition:background .15s;}
        .btn-sm.red{background:var(--red);}
        .btn-sm.red:hover{background:var(--red2);}
        .pos-section{border-bottom:1px solid var(--border);}
        .pos-section:last-child{border-bottom:none;}
        .pos-broker-hdr{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:rgba(255,255,255,.03);}
        .pos-broker-name{font-size:11px;font-weight:700;display:flex;align-items:center;gap:6px;}
        .pos-broker-total{font-size:12px;font-weight:700;}
        .pos-table{width:100%;border-collapse:collapse;font-size:11px;}
        .pos-table th{text-align:left;padding:5px 10px;font-size:8px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text3);border-bottom:1px solid var(--border);}
        .pos-table th:nth-child(n+2){text-align:right;}
        .pos-table td{padding:6px 10px;border-bottom:1px solid var(--border);font-size:11px;color:var(--text);}
        .pos-table td:nth-child(n+2){text-align:right;}
        .pos-table tr:last-child td{border-bottom:none;}
        .pos-table tr:hover{background:rgba(255,255,255,.03);}
        .pos-ticker{font-weight:700;}
        .pos-act{display:flex;gap:3px;justify-content:flex-end;}
        .pos-act button{background:none;border:1px solid var(--border);border-radius:3px;padding:1px 5px;font-size:9px;cursor:pointer;color:var(--text3);transition:all .12s;}
        .pos-act button:hover{border-color:var(--text2);color:var(--text);}
        .pos-act button.sell:hover{border-color:var(--red);color:var(--red);}
        .pos-add-row{padding:8px 16px;}
        .pos-add-btn{background:none;border:1px dashed var(--border);border-radius:var(--r2);padding:6px;font-size:10px;color:var(--text3);cursor:pointer;width:100%;transition:all .15s;font-weight:600;}
        .pos-add-btn:hover{border-color:var(--green);color:var(--green);}
        .pos-empty{padding:20px 16px;text-align:center;font-size:10px;color:var(--text4);}
        .pos-gl{font-weight:600;font-size:10px;}
        .pos-gl.pos{color:var(--green);}
        .pos-gl.neg{color:var(--loss);}
        .mkt-up{color:var(--green);}
        .mkt-down{color:var(--loss);}
        .refresh-btn{background:none;border:1px solid var(--border);border-radius:var(--r2);padding:3px 8px;font-size:9px;cursor:pointer;color:var(--text3);transition:all .12s;font-weight:600;}
        .refresh-btn:hover{border-color:var(--green);color:var(--green);}
        .fetched-at{font-size:8px;color:var(--text4);margin-left:6px;}
        .snap-save-section{padding:12px 16px;border-top:2px solid var(--border);display:flex;align-items:center;gap:8px;}
        .month-nav{display:flex;align-items:center;gap:6px;}
        .mnav{background:none;border:1px solid var(--border);width:24px;height:24px;border-radius:var(--r2);cursor:pointer;font-size:11px;color:var(--text2);transition:all .15s;display:flex;align-items:center;justify-content:center;}
        .mnav:hover{border-color:var(--green);color:var(--green);}
        .mlbl{font-size:11px;font-weight:700;color:var(--text);white-space:nowrap;}
        .btn-save{background:var(--green);color:#fff;border:none;border-radius:var(--r2);padding:7px 16px;font-size:10px;font-weight:700;cursor:pointer;transition:background .15s;margin-left:auto;white-space:nowrap;}
        .btn-save:hover{background:#128c40;}
        .chart-wrap-porto{position:relative;width:100%;overflow-x:auto;padding:12px 14px;}
        .chart-wrap-porto canvas{width:100%!important;height:220px!important;}
        .porto-tab{background:none;border:none;font-size:11px;font-weight:700;color:var(--text3);cursor:pointer;padding:5px 13px;border-radius:8px;letter-spacing:.02em;transition:all .15s;}
        .porto-tab.active{background:var(--red);color:#fff;}
        .porto-tab:not(.active):hover{color:var(--text);}
        .porto-period{font-size:9px;font-weight:700;padding:3px 9px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--text2);cursor:pointer;transition:all .15s;}
        .porto-period.active{background:var(--blk);color:var(--white);border-color:var(--blk);}
        .porto-period:not(.active):hover{border-color:var(--red);color:var(--red);}
        .porto-gran{font-size:9px;font-weight:700;padding:4px 10px;border-radius:7px;border:1px solid var(--border);background:transparent;color:var(--text3);cursor:pointer;transition:all .15s;}
        .porto-gran.active{background:var(--red);color:#fff;border-color:var(--red);}
        .porto-gran:not(.active):hover{color:var(--text);}
        .perf-tbl{width:100%;border-collapse:collapse;font-size:11.5px;}
        .perf-tbl th{position:sticky;top:0;background:var(--white);text-align:left;padding:8px 16px;font-size:8px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text3);border-bottom:1px solid var(--border);}
        .perf-tbl th:nth-child(n+2){text-align:right;}
        .perf-tbl td{padding:8px 16px;border-bottom:1px solid var(--border);color:var(--text);}
        .perf-tbl td:nth-child(n+2){text-align:right;}
        .perf-tbl tr:hover{background:rgba(255,255,255,.03);}
        .perf-tbl .pos{color:var(--green);font-weight:600;}
        .perf-tbl .neg{color:var(--loss);font-weight:600;}
        .perf-pct{font-size:9px;opacity:.85;}
        .total-val{text-align:center;padding:16px 14px 10px;border-bottom:1px solid var(--border);}
        .total-num{font-size:24px;font-weight:700;}
        .total-lbl{font-size:9px;color:var(--text3);font-weight:600;letter-spacing:.08em;text-transform:uppercase;margin-top:2px;}
        .roi-pill{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;margin-top:6px;}
        .roi-pill.pos{background:var(--green-bg);color:var(--green);border:1px solid var(--green-border);}
        .roi-pill.neg{background:var(--loss-bg);color:var(--loss);border:1px solid var(--loss-border);}
        .sum-row{display:flex;justify-content:space-between;align-items:center;padding:7px 14px;border-bottom:1px solid var(--border);font-size:11px;}
        .sum-row:last-child{border-bottom:none;}
        .sum-row-lbl{color:var(--text2);font-weight:500;}
        .sum-row-val{font-weight:700;color:var(--text);}
        .bk-item{padding:8px 14px;border-bottom:1px solid var(--border);}
        .bk-item:last-child{border-bottom:none;}
        .bk-item-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;}
        .bk-item-name{font-size:10px;font-weight:700;display:flex;align-items:center;gap:5px;}
        .bk-item-val{font-size:12px;font-weight:700;}
        .bk-item-bar{height:3px;background:var(--border);border-radius:2px;overflow:hidden;margin-top:3px;}
        .bk-item-fill{height:100%;border-radius:2px;}
        .bk-item-meta{display:flex;justify-content:space-between;font-size:9px;color:var(--text3);margin-top:2px;}
        .wd-item{padding:8px 14px;border-bottom:1px solid var(--border);font-size:10px;}
        .wd-item:last-child{border-bottom:none;}
        .wd-item-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;}
        .wd-asset{font-weight:600;color:var(--text);}
        .wd-amount{font-weight:700;color:var(--red);}
        .wd-meta{color:var(--text3);}
        .wd-del{background:none;border:none;color:var(--text4);cursor:pointer;font-size:11px;padding:0 2px;transition:color .15s;flex-shrink:0;}
        .wd-del:hover{color:var(--red);}
        .moverlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:500;display:none;align-items:center;justify-content:center;padding:20px;}
        .moverlay.open{display:flex;}
        .modal{background:#14161e;border:1px solid rgba(255,255,255,.14);border-radius:18px;width:100%;max-width:400px;box-shadow:0 18px 54px rgba(0,0,0,.6);color:#eef0f5;color-scheme:dark;}
        .mhdr{padding:14px 18px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
        .mtitle{font-size:13px;font-weight:700;color:var(--text);}
        .mclose{background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;}
        .mbody{padding:16px 18px;}
        .mfooter{padding:10px 18px 16px;display:flex;gap:8px;justify-content:flex-end;}
        .mlbl-f{font-size:10px;font-weight:600;color:var(--text2);margin-bottom:5px;display:block;letter-spacing:.04em;}
        .btn-cancel{background:none;border:1px solid var(--border2);color:var(--text2);padding:8px 15px;border-radius:9px;font-size:12px;cursor:pointer;}
        .btn-cancel:hover{border-color:var(--text2);color:var(--text);}
        .btn-primary{background:var(--red);border:none;color:#fff;padding:8px 18px;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;}
        .btn-primary:hover{background:var(--red2);}
        .btn-danger{background:var(--red);border:none;color:#fff;padding:7px 18px;border-radius:var(--r2);font-size:11px;font-weight:700;cursor:pointer;}
        .m-preview{background:var(--green-bg);border:1px solid var(--green-border);border-radius:var(--r2);padding:8px 10px;font-size:10px;color:var(--green);font-weight:600;margin-top:8px;}
      `}</style>

      <div className="porto-main">
        {/* Market Card */}
        <div className="card" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
          <div className="card-hdr">
            <div className="card-title">Kondisi Market</div>
            <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-border)' }}>● Live</span>
          </div>
          <div className="mkt-strip" id="mkt-strip"><div className="loading">Memuat data market…</div></div>
        </div>

        {/* Portfolio Outlook */}
        <div className="card" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
          <div className="card-hdr">
            <div className="card-title">Portfolio Outlook</div>
            <span style={{ fontSize: 9, color: 'var(--text3)' }}>worst · base · best — proyeksi dari target tesis lu</span>
          </div>
          <div className="outlook-body">
            <div className="outlook-donut">
              <div style={{ position: 'relative', height: 200 }}><canvas id="alloc-chart"></canvas></div>
              <div id="alloc-legend" style={{ marginTop: 8 }}></div>
            </div>
            <div className="outlook-right">
              <div className="scn-grid" id="outlook-scenarios"></div>
              <div id="outlook-table"></div>
            </div>
          </div>
        </div>

        {/* LEFT */}
        <div>
          <div className="card">
            <div className="card-hdr">
              <div className="card-title">Broker</div>
              <button onClick={toggleAddAsset} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text3)' }}>+</button>
            </div>
            <div id="asset-list"></div>
            <div id="add-asset-form" className="add-asset-form" style={{ display: 'none' }}>
              <input className="mini-inp" id="new-asset-name" placeholder="Nama broker (e.g. Stockbit)" />
              <select className="mini-sel" id="new-asset-type" onChange={onBrokerTypeChange}>
                <option value="stocks_idr">Saham (IDR)</option>
                <option value="stocks_usd">Saham US (USD)</option>
                <option value="crypto_usd">Crypto (USD)</option>
              </select>
              <div id="new-asset-currency-preview" style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6, fontWeight: 600 }}>Currency: IDR</div>
              <button className="btn-sm" onClick={addAsset}>Tambah Broker</button>
            </div>
          </div>

          <div className="card">
            <div className="card-hdr"><div className="card-title">Tarik Dana</div></div>
            <div className="card-body">
              <label className="mlbl-f">Dari Broker</label>
              <select className="mini-sel" id="wd-asset" style={{ marginBottom: 10 }}></select>
              <label className="mlbl-f">Nominal (IDR)</label>
              <input type="number" className="mini-inp" id="wd-amount" placeholder="0" style={{ marginBottom: 10 }} />
              <label className="mlbl-f">Alokasi ke</label>
              <select className="mini-sel" id="wd-type" onChange={updateWdAlloc} style={{ marginBottom: 6 }}>
                <option value="finance_expense">Finance — Expense</option>
                <option value="finance_buffer">Finance — Buffer</option>
                <option value="invest_thinkandgrow">Invest — Think and Grow</option>
                <option value="reinvest">Re-invest ke broker lain</option>
              </select>
              <div id="wd-alloc-extra" style={{ marginBottom: 10 }}></div>
              <label className="mlbl-f">Tanggal</label>
              <input type="date" className="mini-inp" id="wd-date" style={{ marginBottom: 10 }} />
              <input type="text" className="mini-inp" id="wd-note" placeholder="Catatan" style={{ marginBottom: 10 }} />
              <button className="btn-sm red" onClick={saveWithdrawal}>Tarik Dana</button>
            </div>
          </div>

          <div className="card">
            <div className="card-hdr"><div className="card-title">Penarikan Terakhir</div></div>
            <div id="wd-list"><div style={{ padding: 14, fontSize: 10, color: 'var(--text4)', textAlign: 'center' }}>Belum ada penarikan.</div></div>
          </div>
        </div>

        {/* CENTER */}
        <div>
          <div className="card">
            <div className="card-hdr" style={{ flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', gap: 2 }}>
                <button id="porto-tab-chart" className="porto-tab active" onClick={() => setPortoTab('chart')}>Chart</button>
                <button id="porto-tab-perf" className="porto-tab" onClick={() => setPortoTab('perf')}>Performance</button>
              </div>
              <div style={{ display: 'flex', gap: 3 }}>
                <button id="porto-gran-daily" className="porto-gran" onClick={() => setPortoGran('daily')}>Harian</button>
                <button id="porto-gran-monthly" className="porto-gran active" onClick={() => setPortoGran('monthly')}>Bulanan</button>
              </div>
              <div id="porto-period-bar" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}></div>
            </div>
            <div id="porto-chart-wrap" className="chart-wrap-porto"><canvas id="porto-chart"></canvas></div>
            <div id="porto-perf-wrap" style={{ display: 'none', maxHeight: 320, overflowY: 'auto' }}></div>
          </div>

          <div className="card">
            <div className="card-hdr" style={{ flexWrap: 'wrap', gap: 8 }}>
              <div className="card-title">Cumulative Return</div>
              <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                <button onClick={e => setBenchPeriod('ytd', e.currentTarget)} className="bench-period" style={{ fontSize: 9, fontWeight: 700, padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer' }}>YTD</button>
                <button onClick={e => setBenchPeriod('1y', e.currentTarget)} className="bench-period" style={{ fontSize: 9, fontWeight: 700, padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer' }}>1Y</button>
                <button onClick={e => setBenchPeriod('all', e.currentTarget)} className="bench-period" style={{ fontSize: 9, fontWeight: 700, padding: '3px 10px', borderRadius: 20, border: '1px solid var(--blk)', background: 'var(--blk)', color: 'var(--white)', cursor: 'pointer' }}>All</button>
              </div>
            </div>
            <div id="bench-legend" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '6px 14px 0' }}></div>
            <div style={{ position: 'relative', height: 260, padding: '10px 14px 14px' }}>
              <canvas id="bench-chart" style={{ display: 'none' }}></canvas>
            </div>
            <div id="bench-loading" style={{ textAlign: 'center', padding: '40px 20px', fontSize: 10, color: 'var(--text4)', fontStyle: 'italic' }}>Memuat data benchmark...</div>
          </div>

          <div className="card">
            <div className="card-hdr">
              <div className="card-title">Portfolio Positions</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="fetched-at" id="fetched-at"></span>
                <button className="refresh-btn" onClick={refreshPrices}>↻ Refresh</button>
              </div>
            </div>
            <div id="positions-container"><div className="pos-empty">Memuat data...</div></div>
            <div className="snap-save-section">
              <div className="month-nav">
                <button className="mnav" onClick={() => snapMonthChange(-1)}>‹</button>
                <div className="mlbl" id="snap-month-lbl">—</div>
                <button className="mnav" onClick={() => snapMonthChange(1)}>›</button>
              </div>
              <button className="btn-save" id="btn-snap" onClick={saveSnapshots}>💾 Simpan Snapshot</button>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div>
          <div className="card">
            <div className="total-val">
              <div className="total-num" id="total-value" style={{ color: 'var(--text)' }}>Rp 0</div>
              <div className="total-lbl">Total Portfolio Value</div>
              <div id="roi-pill"></div>
            </div>
            <div className="sum-row"><span className="sum-row-lbl">Total Deposited</span><span className="sum-row-val" id="total-deposit" style={{ color: 'var(--blue)' }}>Rp 0</span></div>
            <div className="sum-row"><span className="sum-row-lbl">Unrealized G/L</span><span className="sum-row-val" id="total-gl">Rp 0</span></div>
            <div className="sum-row"><span className="sum-row-lbl">Cash</span><span className="sum-row-val" id="total-cash" style={{ color: 'var(--gold)' }}>Rp 0</span></div>
            <div className="sum-row"><span className="sum-row-lbl">Cash %</span><span className="sum-row-val" id="cash-pct">0%</span></div>
            <div className="sum-row"><span className="sum-row-lbl">Posisi Aktif</span><span className="sum-row-val" id="active-count">0</span></div>
          </div>

          <div className="card">
            <div className="card-hdr"><div className="card-title">Breakdown Posisi</div></div>
            <div id="pos-breakdown"></div>
          </div>
        </div>
      </div>

      {/* Modal */}
      <div className="moverlay" id="modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
        <div className="modal">
          <div className="mhdr">
            <div className="mtitle" id="modal-title"></div>
            <button className="mclose" onClick={closeModal}>✕</button>
          </div>
          <div className="mbody" id="modal-body"></div>
          <div className="mfooter" id="modal-footer"></div>
        </div>
      </div>
    </DashboardShell>
  )
}
