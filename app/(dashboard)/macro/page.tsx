'use client'

import { useEffect, useRef } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'

type Pt = { d: string; v: number }
type Packed = { value: number | null; prev: number | null; series: Pt[] }
type Cfg = { key: string; sec: 'engine' | 'policy' | 'backdrop'; label: string; up: 'good' | 'bad'; fmt: (v: number) => string; dfmt: (d: number) => string; desc: string }

const GREEN = '#34d399', RED = '#f6685e', NEU = '#687087'

const M_IND: Cfg[] = [
  { key: 'netLiquidity', sec: 'engine', label: 'Fed Net Liquidity', up: 'good', fmt: v => '$' + v.toFixed(2) + 'T', dfmt: d => (d >= 0 ? '+' : '') + d.toFixed(2) + 'T', desc: 'WALCL − TGA − RRP. Naik = likuiditas ngalir ke risk asset.' },
  { key: 'm2', sec: 'engine', label: 'M2 Money Supply', up: 'good', fmt: v => '$' + (v / 1000).toFixed(2) + 'T', dfmt: d => (d >= 0 ? '+' : '') + (d / 1000).toFixed(2) + 'T', desc: 'Uang beredar (US, proxy global). Lead BTC ~10–12 minggu.' },
  { key: 'dollar', sec: 'engine', label: 'DXY (Dollar Index)', up: 'bad', fmt: v => v.toFixed(2), dfmt: d => (d >= 0 ? '+' : '') + d.toFixed(2), desc: 'Dollar kuat = headwind buat risk asset & crypto.' },
  { key: 'y10', sec: 'engine', label: '10Y Treasury Yield', up: 'bad', fmt: v => v.toFixed(2) + '%', dfmt: d => (d >= 0 ? '+' : '') + Math.round(d * 100) + 'bps', desc: 'Yield naik = cost of capital naik.' },
  { key: 'realYield', sec: 'engine', label: '10Y Real Yield', up: 'bad', fmt: v => v.toFixed(2) + '%', dfmt: d => (d >= 0 ? '+' : '') + Math.round(d * 100) + 'bps', desc: 'Real yield naik = tekanan buat gold & growth.' },
  { key: 'curve', sec: 'engine', label: 'Yield Curve 10Y−2Y', up: 'good', fmt: v => (v >= 0 ? '+' : '') + v.toFixed(2) + '%', dfmt: d => (d >= 0 ? '+' : '') + Math.round(d * 100) + 'bps', desc: 'Negatif = inverted (sinyal resesi klasik).' },
  { key: 'hySpread', sec: 'engine', label: 'HY Credit Spread', up: 'bad', fmt: v => v.toFixed(2) + '%', dfmt: d => (d >= 0 ? '+' : '') + Math.round(d * 100) + 'bps', desc: 'Melebar = stress kredit / risk-off.' },
  { key: 'vix', sec: 'engine', label: 'VIX', up: 'bad', fmt: v => v.toFixed(1), dfmt: d => (d >= 0 ? '+' : '') + d.toFixed(1), desc: '>22 takut · <15 tenang/komplasen.' },
  { key: 'nfci', sec: 'engine', label: 'Financial Conditions', up: 'bad', fmt: v => v.toFixed(2), dfmt: d => (d >= 0 ? '+' : '') + d.toFixed(2), desc: 'NFCI. >0 ketat/restriktif · <0 longgar.' },
  { key: 'fedRate', sec: 'policy', label: 'Fed Funds Rate', up: 'bad', fmt: v => v.toFixed(2) + '%', dfmt: d => (d >= 0 ? '+' : '') + Math.round(d * 100) + 'bps', desc: 'Policy rate. Naik = pengetatan.' },
  { key: 'cpi', sec: 'policy', label: 'CPI YoY', up: 'bad', fmt: v => v.toFixed(1) + '%', dfmt: d => (d >= 0 ? '+' : '') + d.toFixed(1) + 'pp', desc: 'Inflasi headline → keputusan Fed.' },
  { key: 'coreCpi', sec: 'policy', label: 'Core CPI YoY', up: 'bad', fmt: v => v.toFixed(1) + '%', dfmt: d => (d >= 0 ? '+' : '') + d.toFixed(1) + 'pp', desc: 'Inflasi inti (lengket).' },
  { key: 'ppi', sec: 'policy', label: 'PPI YoY', up: 'bad', fmt: v => v.toFixed(1) + '%', dfmt: d => (d >= 0 ? '+' : '') + d.toFixed(1) + 'pp', desc: 'Harga produsen — leads CPI.' },
  { key: 'philly', sec: 'backdrop', label: 'Philly Fed Mfg (proxy ISM)', up: 'good', fmt: v => v.toFixed(1), dfmt: d => (d >= 0 ? '+' : '') + d.toFixed(1), desc: 'Survey manufaktur leading. >0 = ekspansi.' },
  { key: 'nfp', sec: 'backdrop', label: 'Nonfarm Payrolls', up: 'good', fmt: v => (v >= 0 ? '+' : '') + Math.round(v) + 'K', dfmt: d => (d >= 0 ? '+' : '') + Math.round(d) + 'K', desc: 'Tambahan lapangan kerja per bulan.' },
  { key: 'unemployment', sec: 'backdrop', label: 'Unemployment Rate', up: 'bad', fmt: v => v.toFixed(1) + '%', dfmt: d => (d >= 0 ? '+' : '') + d.toFixed(1) + 'pp', desc: 'Naik = ekonomi melemah.' },
  { key: 'retail', sec: 'backdrop', label: 'Retail Sales YoY', up: 'good', fmt: v => v.toFixed(1) + '%', dfmt: d => (d >= 0 ? '+' : '') + d.toFixed(1) + 'pp', desc: 'Demand konsumen.' },
]
const SECS: [string, string][] = [['engine', 'Engine — Bias Risk'], ['policy', 'Policy & Inflasi'], ['backdrop', 'Backdrop Ekonomi']]

// Penjelasan panjang per indikator: what = ini apa, how = cara baca/pakai
const INFO: Record<string, { what: string; how: string }> = {
  netLiquidity: { what: 'Likuiditas bersih yang Fed alirkan ke sistem: aset Fed (WALCL) dikurangi saldo kas pemerintah (TGA) dan reverse repo (RRP). Proksi "berapa banyak uang nganggur yang bisa ngalir ke aset".', how: 'Naik = likuiditas longgar, biasanya ngangkat risk asset (saham, BTC). Turun = ketat. Salah satu driver paling kuat buat crypto/Nasdaq sejak 2020.' },
  m2: { what: 'Total uang beredar di ekonomi AS (tunai + tabungan + deposito), proksi global money supply.', how: 'Naik = lebih banyak uang nyari rumah, sering lead BTC ~10–12 minggu. Flat/turun = headwind likuiditas.' },
  dollar: { what: 'Indeks kekuatan dolar AS terhadap 6 mata uang utama (DXY).', how: 'Dolar kuat = pengetat global, headwind buat risk asset, emerging market & crypto. Dolar lemah = tailwind.' },
  y10: { what: 'Imbal hasil obligasi pemerintah AS tenor 10 tahun — patokan "harga uang" jangka panjang.', how: 'Naik = cost of capital naik, tekan valuasi aset growth. Turun = melonggar.' },
  realYield: { what: 'Yield 10Y dikurangi ekspektasi inflasi (TIPS 10Y) — "bunga riil" setelah inflasi.', how: 'Tinggi/naik = aset tanpa-yield (emas, BTC, growth) kurang menarik. Negatif/turun = tailwind buat aset itu.' },
  curve: { what: 'Selisih yield 10Y dikurangi 2Y — bentuk kurva imbal hasil.', how: 'Negatif (inverted) = pasar ekspektasi pemangkasan/resesi (akurat tiap resesi sejak 1955, dengan lag). Positif & menanjak = ekspansi sehat.' },
  hySpread: { what: 'Selisih yield obligasi high-yield (junk) terhadap Treasury — premi risiko kredit.', how: 'Melebar = investor minta kompensasi lebih → stress kredit/risk-off (melonjak di 2008, 2020, 2022). Menyempit = tenang, risk-on.' },
  vix: { what: 'Indeks volatilitas opsi S&P 500 — "indeks ketakutan" pasar.', how: '>30 panik, 20–30 waspada, 15–20 normal, <15 tenang (kadang komplasen). Spike tajam sering nandain dasar pasar jangka pendek.' },
  nfci: { what: 'Chicago Fed National Financial Conditions Index — gabungan 100+ indikator kondisi keuangan jadi satu angka.', how: '>0 = kondisi lebih ketat dari rata-rata (risk-off), <0 = lebih longgar (risk-on), 0 = netral.' },
  fedRate: { what: 'Suku bunga acuan Fed (Fed Funds Rate) — induk dari semua yield lain.', how: 'Naik = pengetatan moneter (tekan likuiditas & risk asset). Dipangkas = pelonggaran.' },
  cpi: { what: 'Inflasi harga konsumen tahunan (headline, termasuk pangan & energi).', how: 'Target Fed ~2%. >4% panas (Fed hawkish), 2–4% menuju normal, <2% lembut/disinflasi (ruang pelonggaran).' },
  coreCpi: { what: 'Inflasi inti — CPI tanpa pangan & energi yang volatil. Lebih "lengket" & jadi acuan utama Fed.', how: 'Sama: target ~2%. Inti tinggi & lengket = Fed susah pangkas. Turun = sinyal pelonggaran ke depan.' },
  ppi: { what: 'Inflasi harga produsen — biaya di tingkat pabrik/grosir.', how: 'Sering mendahului CPI (biaya produsen diteruskan ke konsumen). Naik = tekanan inflasi di pipeline.' },
  philly: { what: 'Survei manufaktur Philadelphia Fed — proksi ISM (ISM asli gak gratis di FRED).', how: '>0 = manufaktur ekspansi, <0 = kontraksi. Leading buat siklus ekonomi.' },
  nfp: { what: 'Nonfarm Payrolls — tambahan lapangan kerja non-tani per bulan.', how: '>150K sehat, 50–150K melambat, <0 kontraksi (PHK bersih). Kerja kuat = ekonomi kuat, tapi bisa bikin Fed hawkish.' },
  unemployment: { what: 'Tingkat pengangguran AS.', how: 'Naik = ekonomi melemah (bisa picu pelonggaran Fed). <~4% = pasar kerja ketat. Naik tajam = warning resesi (Sahm rule).' },
  retail: { what: 'Penjualan ritel tahunan — denyut belanja konsumen (~70% ekonomi AS).', how: '>4% permintaan kuat, 0–4% moderat, <0 lemah.' },
}

type Reading = { tone: string; text: string }
const READ: Record<string, (v: number, d: number | null) => Reading> = {
  vix: v => v > 30 ? { tone: RED, text: 'panik ekstrem — sering dekat titik kapitulasi/bottom jangka pendek.' } : v >= 22 ? { tone: RED, text: 'pasar waspada/takut.' } : v >= 15 ? { tone: NEU, text: 'volatilitas normal.' } : { tone: GREEN, text: 'tenang — hati-hati komplasen.' },
  nfci: v => v > 0.1 ? { tone: RED, text: 'kondisi keuangan ketat (risk-off).' } : v < -0.1 ? { tone: GREEN, text: 'kondisi keuangan longgar (risk-on).' } : { tone: NEU, text: 'netral.' },
  curve: v => v < 0 ? { tone: RED, text: 'inverted — sinyal resesi klasik (dengan lag).' } : v < 0.5 ? { tone: NEU, text: 'datar — belum sehat penuh.' } : { tone: GREEN, text: 'normal & menanjak — sehat.' },
  hySpread: v => v > 5 ? { tone: RED, text: 'spread lebar — stress kredit tinggi.' } : v > 3.5 ? { tone: NEU, text: 'mulai naik — waspada kredit.' } : { tone: GREEN, text: 'sempit — kredit tenang.' },
  realYield: v => v > 2 ? { tone: RED, text: 'real yield tinggi — tekan emas/BTC/growth.' } : v > 1 ? { tone: NEU, text: 'moderat.' } : { tone: GREEN, text: 'rendah/negatif — tailwind aset tanpa-yield.' },
  cpi: v => v > 4 ? { tone: RED, text: 'inflasi panas — Fed cenderung ketat.' } : v > 2.5 ? { tone: NEU, text: 'di atas target, menuju normal.' } : { tone: GREEN, text: 'dekat/di bawah target 2% — ruang pelonggaran.' },
  coreCpi: v => v > 4 ? { tone: RED, text: 'inti panas & lengket — Fed susah pangkas.' } : v > 2.5 ? { tone: NEU, text: 'di atas target, masih lengket.' } : { tone: GREEN, text: 'mendekati target — sinyal pelonggaran.' },
  ppi: v => v > 3 ? { tone: RED, text: 'tekanan harga produsen tinggi.' } : v > 1 ? { tone: NEU, text: 'moderat.' } : { tone: GREEN, text: 'jinak.' },
  fedRate: (_v, d) => d != null && d > 0 ? { tone: RED, text: 'lagi dinaikin — pengetatan.' } : d != null && d < 0 ? { tone: GREEN, text: 'lagi dipangkas — pelonggaran.' } : { tone: NEU, text: 'ditahan.' },
  philly: v => v < 0 ? { tone: RED, text: 'manufaktur kontraksi.' } : { tone: GREEN, text: 'manufaktur ekspansi.' },
  nfp: v => v < 0 ? { tone: RED, text: 'kontraksi lapangan kerja — PHK bersih.' } : v < 100 ? { tone: NEU, text: 'pertumbuhan kerja melambat.' } : { tone: GREEN, text: 'pasar kerja sehat.' },
  unemployment: (v, d) => v > 5 ? { tone: RED, text: 'pengangguran tinggi — ekonomi lemah.' } : d != null && d >= 0.3 ? { tone: RED, text: 'naik tajam — warning (Sahm rule).' } : v < 4 ? { tone: GREEN, text: 'pasar kerja ketat/kuat.' } : { tone: NEU, text: 'stabil.' },
  retail: v => v < 0 ? { tone: RED, text: 'belanja konsumen lemah.' } : v < 4 ? { tone: NEU, text: 'belanja moderat.' } : { tone: GREEN, text: 'belanja kuat.' },
}
function readNow(cfg: Cfg, v: number | null, d: number | null): Reading {
  if (v == null) return { tone: NEU, text: 'data belum tersedia.' }
  if (READ[cfg.key]) return READ[cfg.key](v, d)
  const good = cfg.up === 'good' ? (d ?? 0) >= 0 : (d ?? 0) < 0
  const arah = d == null ? 'flat' : d >= 0 ? 'lagi naik' : 'lagi turun'
  return { tone: d == null ? NEU : good ? GREEN : RED, text: `${arah} (30 hari terakhir) → secara makna condong ${good ? 'risk-on' : 'risk-off'}.` }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let macroData: any = null
let chartKey = '', chartRange = 'all'
let macroChart: import('chart.js').Chart | null = null
let macroView = 'cards', combRange = 'all'
let combChart: import('chart.js').Chart | null = null
const ENGINE = ['netLiquidity', 'm2', 'dollar', 'y10', 'realYield', 'curve', 'hySpread', 'vix', 'nfci']
// orientasi ke arah risk-on (+1 = naik berarti risk-on, -1 = naik berarti risk-off)
const ORIENT: Record<string, number> = { netLiquidity: 1, m2: 1, dollar: -1, y10: -1, realYield: -1, curve: 1, hySpread: -1, vix: -1, nfci: -1 }
const COMB_COLORS: Record<string, string> = { netLiquidity: '#3e6df0', m2: '#60a5fa', dollar: '#f0a93e', y10: '#e879a8', realYield: '#9b6ef0', curve: '#34c2d4', hySpread: '#f6685e', vix: '#fb923c', nfci: '#a3e635' }
let ChartLib: typeof import('chart.js') | null = null
async function getChart() {
  if (!ChartLib) { ChartLib = await import('chart.js'); ChartLib.Chart.register(...ChartLib.registerables) }
  return ChartLib.Chart
}

async function api(path: string) { const r = await fetch(path); if (!r.ok) throw new Error(await r.text()); return r.json() }
function cfgOf(key: string) { return M_IND.find(c => c.key === key) }
function colOf(cfg: Cfg, delta: number | null) {
  if (delta == null) return NEU
  const good = cfg.up === 'good' ? delta >= 0 : delta < 0
  return good ? GREEN : RED
}

function sparkSvg(vals: number[], color: string) {
  const w = 60, h = 24, n = vals.length
  if (n < 2) return ''
  const min = Math.min(...vals), max = Math.max(...vals), rng = (max - min) || 1
  const pts = vals.map((v, i) => `${(i / (n - 1) * w).toFixed(1)},${(h - 2 - ((v - min) / rng) * (h - 4)).toFixed(1)}`).join(' ')
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`
}

function card(cfg: Cfg, data: Packed) {
  if (!data || data.value == null) return `<div class="m-card"><div class="m-label">${cfg.label}</div><div class="m-val">—</div><div class="m-desc">${cfg.desc}</div></div>`
  const v = data.value, prev = data.prev
  const delta = prev != null ? v - prev : null
  const col = colOf(cfg, delta)
  const spark = (data.series || []).slice(-30).map(p => p.v)
  return `<div class="m-card" data-key="${cfg.key}">
    <div class="m-card-top"><span class="m-label">${cfg.label}</span><span class="m-spark">${sparkSvg(spark, col)}</span></div>
    <div class="m-val">${cfg.fmt(v)}</div>
    <div class="m-delta" style="color:${col}">${delta == null ? '—' : (delta >= 0 ? '▲ ' : '▼ ') + cfg.dfmt(delta)}<span class="m-period">30 hari</span></div>
    <div class="m-desc">${cfg.desc}</div>
  </div>`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderMacro(d: any) {
  macroData = d
  const banner = document.getElementById('macro-banner')
  if (!d || d.error) {
    if (banner) banner.innerHTML = `<div class="m-err">${d?.error || 'Gagal memuat data makro.'} — pastikan FRED_API_KEY udah di-set.</div>`
    return
  }
  const r = d.regime || {}
  const chip = (label: string, val: string, tone: string) => `<div class="m-chip ${tone}"><span class="m-chip-l">${label}</span><span class="m-chip-v">${val}</span></div>`
  const liqTone = r.liquidity === 'expanding' ? 'good' : r.liquidity === 'contracting' ? 'bad' : 'neu'
  const dolTone = r.dollar === 'tailwind' ? 'good' : r.dollar === 'headwind' ? 'bad' : 'neu'
  const riskTone = r.risk === 'risk-on' ? 'good' : r.risk === 'risk-off' ? 'bad' : 'neu'
  const verdict = r.risk === 'risk-on'
    ? 'Kondisi condong mendukung risk asset (crypto/saham growth). Pantau pembalikan likuiditas & dollar.'
    : r.risk === 'risk-off'
      ? 'Kondisi menekan risk asset — likuiditas/kredit/dollar lagi gak ramah. Defensif & jaga cash.'
      : 'Sinyal campur, belum ada bias kuat. Tunggu konfirmasi arah likuiditas & dollar.'
  if (banner) banner.innerHTML =
    `<div class="m-chips">${chip('Likuiditas', r.liquidity === 'expanding' ? 'Ekspansi' : r.liquidity === 'contracting' ? 'Kontraksi' : 'Flat', liqTone)}${chip('Dollar', r.dollar === 'tailwind' ? 'Tailwind' : r.dollar === 'headwind' ? 'Headwind' : 'Flat', dolTone)}${chip('Yield Curve', r.curve === 'inverted' ? 'Inverted' : 'Normal', r.curve === 'inverted' ? 'bad' : 'neu')}${chip('Bias Risk', r.risk === 'risk-on' ? 'Risk-On' : r.risk === 'risk-off' ? 'Risk-Off' : 'Netral', riskTone)}</div>
     <div class="m-verdict">${verdict}</div>`

  SECS.forEach(([sec]) => {
    const el = document.getElementById('macro-grid-' + sec)
    if (el) el.innerHTML = M_IND.filter(c => c.sec === sec).map(c => card(c, d[c.key])).join('')
  })
}

async function init() {
  try { renderMacro(await api('/api/macro')) }
  catch (e) {
    const b = document.getElementById('macro-banner')
    if (b) b.innerHTML = `<div class="m-err">Gagal memuat data makro: ${(e as Error).message}</div>`
  }
}

async function openChart(key: string) {
  if (!macroData || !macroData[key]) return
  chartKey = key; chartRange = 'all'
  const cfg = cfgOf(key)
  document.getElementById('mc-title')!.textContent = cfg?.label || ''
  const dd = document.getElementById('mc-desc')
  if (dd && cfg) {
    const data: Packed = macroData[key]
    const v = data?.value ?? null
    const delta = (v != null && data?.prev != null) ? v - data.prev : null
    const info = INFO[key]
    const rd = readNow(cfg, v, delta)
    dd.innerHTML = `
      <div class="mc-info-row"><span class="mc-info-k">Apa ini</span><span class="mc-info-v">${info?.what || cfg.desc}</span></div>
      <div class="mc-info-row"><span class="mc-info-k">Cara baca</span><span class="mc-info-v">${info?.how || ''}</span></div>
      <div class="mc-info-row"><span class="mc-info-k">Sekarang</span><span class="mc-info-v"><b style="color:${rd.tone}">${v != null ? cfg.fmt(v) : '—'}${delta != null ? ' (' + (delta >= 0 ? '▲' : '▼') + ' ' + cfg.dfmt(delta) + ' / 30 hari)' : ''}</b> — ${rd.text}</span></div>`
  }
  document.querySelectorAll('#mc-overlay .mc-range').forEach(b => b.classList.toggle('active', (b as HTMLElement).dataset.r === 'all'))
  document.getElementById('mc-overlay')!.classList.add('open')
  await drawChart()
}
function setChartRange(r: string) {
  chartRange = r
  document.querySelectorAll('#mc-overlay .mc-range').forEach(b => b.classList.toggle('active', (b as HTMLElement).dataset.r === r))
  drawChart()
}
function closeChart() {
  document.getElementById('mc-overlay')?.classList.remove('open')
  if (macroChart) { macroChart.destroy(); macroChart = null }
}
async function drawChart() {
  const cfg = cfgOf(chartKey); if (!cfg) return
  const data: Packed = macroData[chartKey]
  const yrs = chartRange === '1y' ? 1 : chartRange === '3y' ? 3 : chartRange === '5y' ? 5 : 99
  const cut = new Date(); cut.setFullYear(cut.getFullYear() - yrs)
  const cutKey = cut.toISOString().slice(0, 10)
  const pts = (data.series || []).filter(p => chartRange === 'all' || p.d >= cutKey)
  const valEl = document.getElementById('mc-value')
  if (valEl) valEl.textContent = data.value != null ? cfg.fmt(data.value) : '—'
  const delta = (data.value != null && data.prev != null) ? data.value - data.prev : null
  const col = colOf(cfg, delta)
  const canvas = document.getElementById('macro-chart') as HTMLCanvasElement
  if (!canvas) return
  if (macroChart) { macroChart.destroy(); macroChart = null }
  if (pts.length < 2) return
  const Chart = await getChart()
  macroChart = new Chart(canvas, {
    type: 'line',
    data: { labels: pts.map(p => p.d), datasets: [{ data: pts.map(p => p.v), borderColor: col, backgroundColor: col + '14', borderWidth: 1.6, pointRadius: 0, tension: .2, fill: true }] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
      plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#687087', font: { size: 9 }, maxTicksLimit: 8, maxRotation: 0 } },
        y: { grid: { color: 'rgba(255,255,255,.06)' }, ticks: { color: '#687087', font: { size: 9 } } },
      },
    },
  })
}

function monthGrid(years: number): string[] {
  const out: string[] = []
  const d = new Date(); d.setFullYear(d.getFullYear() - years); d.setDate(1)
  const end = new Date()
  while (d <= end) { out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`); d.setMonth(d.getMonth() + 1) }
  return out
}
function valOnOrBefore(s: Pt[], key: string): number | null {
  let r: number | null = null
  for (const p of s) { if (p.d <= key) r = p.v; else break }
  return r
}
function zscore(arr: (number | null)[]): (number | null)[] {
  const vals = arr.filter((x): x is number => x != null)
  if (vals.length < 2) return arr.map(() => null)
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) || 1
  return arr.map(x => x == null ? null : (x - mean) / sd)
}
function setMacroView(v: string) {
  macroView = v
  document.getElementById('mv-cards')?.classList.toggle('active', v === 'cards')
  document.getElementById('mv-comb')?.classList.toggle('active', v === 'comb')
  const cv = document.getElementById('macro-cards-view'), cmv = document.getElementById('macro-comb-view')
  if (cv) cv.style.display = v === 'cards' ? 'block' : 'none'
  if (cmv) cmv.style.display = v === 'comb' ? 'block' : 'none'
  if (v === 'comb') drawCombined()
}
function setCombRange(r: string) {
  combRange = r
  document.querySelectorAll('.comb-range').forEach(b => b.classList.toggle('active', (b as HTMLElement).dataset.r === r))
  drawCombined()
}
function indexSeries(s: Pt[], grid: string[]): (number | null)[] {
  const raw = grid.map(g => valOnOrBefore(s, g.slice(0, 7) + '-31'))
  const base = raw.find((v): v is number => v != null)
  if (base == null) return raw.map(() => null)
  return raw.map(v => v == null ? null : (v / base) * 100)
}
async function drawCombined() {
  if (!macroData || macroData.error) return
  const maxYrs = new Date().getFullYear() - 2013
  const yrs = combRange === '1y' ? 1 : combRange === '3y' ? 3 : combRange === '5y' ? 5 : maxYrs
  const grid = monthGrid(yrs)
  const labels = grid.map(g => g.slice(0, 7))
  const z: Record<string, (number | null)[]> = {}
  ENGINE.forEach(k => {
    const s = (macroData[k]?.series || []) as Pt[]
    const raw = grid.map(g => valOnOrBefore(s, g.slice(0, 7) + '-31'))
    z[k] = zscore(raw).map(v => v == null ? null : v * (ORIENT[k] || 1))
  })
  const composite = grid.map((_, i) => {
    const vals = ENGINE.map(k => z[k][i]).filter((v): v is number => v != null)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  })
  const btcIdx = indexSeries((macroData.btcusd?.series || []) as Pt[], grid)
  const spxIdx = indexSeries((macroData.spx?.series || []) as Pt[], grid)
  const canvas = document.getElementById('macro-comb-chart') as HTMLCanvasElement
  if (!canvas) return
  if (combChart) { combChart.destroy(); combChart = null }
  const Chart = await getChart()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const datasets: any[] = [
    { label: '__zero', data: grid.map(() => 0), borderColor: 'rgba(255,255,255,.22)', borderDash: [4, 4], borderWidth: 1, pointRadius: 0, fill: false },
    { label: 'Composite (Bias Risk)', data: composite, borderColor: '#eef0f5', borderWidth: 2.6, pointRadius: 0, tension: .3, fill: false },
    { label: 'BTC/USD (indexed=100)', data: btcIdx, borderColor: '#f7931a', borderWidth: 1.6, pointRadius: 0, tension: .25, fill: false, yAxisID: 'y1' },
    { label: 'S&P 500 (indexed=100)', data: spxIdx, borderColor: '#4ade80', borderWidth: 1.6, pointRadius: 0, tension: .25, fill: false, yAxisID: 'y1' },
    ...ENGINE.map(k => ({ label: cfgOf(k)?.label || k, data: z[k], borderColor: COMB_COLORS[k], borderWidth: 1, pointRadius: 0, tension: .3, fill: false, hidden: true })),
  ]
  combChart = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, position: 'top', labels: { color: '#97a0b3', font: { size: 9 }, boxWidth: 12, padding: 9, filter: (it: { text: string }) => it.text !== '__zero' } },
        tooltip: { filter: (it: { dataset: { label?: string } }) => it.dataset.label !== '__zero' },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#687087', font: { size: 9 }, maxTicksLimit: 8, maxRotation: 0 } },
        y: { grid: { color: 'rgba(255,255,255,.06)' }, ticks: { color: '#687087', font: { size: 9 } }, suggestedMin: -2.5, suggestedMax: 2.5 },
        y1: { position: 'right', grid: { display: false }, ticks: { color: '#687087', font: { size: 9 } }, title: { display: true, text: 'Price index', color: '#687087', font: { size: 9 } } },
      },
    },
  })
}

export default function MacroPage() {
  const initRef = useRef(false)
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    init()
    const onClick = (e: MouseEvent) => {
      const card = (e.target as HTMLElement).closest('.m-card') as HTMLElement | null
      if (card?.dataset.key) openChart(card.dataset.key)
    }
    document.addEventListener('click', onClick)
    return () => { document.removeEventListener('click', onClick); if (macroChart) { macroChart.destroy(); macroChart = null }; if (combChart) { combChart.destroy(); combChart = null }; macroData = null }
  }, [])

  return (
    <DashboardShell title="The Macro">
      <style>{`
        :root{
          --bg:#0b0c10;--white:#15161c;--bg2:#1c1e27;--border:rgba(255,255,255,.08);--border2:rgba(255,255,255,.16);
          --text:#eef0f5;--text2:#97a0b3;--text3:#687087;--text4:rgba(255,255,255,.14);
          --blue:#3e6df0;--green:#34d399;--loss:#f6685e;
          --sb:0 2px 8px rgba(0,0,0,.30),0 3px 11px rgba(62,109,240,.18);
        }
        .macro-wrap{max-width:1120px;margin:0 auto;padding:18px 16px 60px;}
        .macro-banner{background:var(--white);border:1px solid var(--border);border-radius:14px;box-shadow:var(--sb);padding:16px 18px;margin-bottom:18px;}
        .m-chips{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px;}
        .m-chip{display:flex;flex-direction:column;gap:2px;padding:9px 14px;border-radius:10px;border:1px solid var(--border);min-width:110px;}
        .m-chip.good{border-color:rgba(52,211,153,.4);background:rgba(52,211,153,.08);}
        .m-chip.bad{border-color:rgba(246,104,94,.4);background:rgba(246,104,94,.08);}
        .m-chip-l{font-size:8.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);}
        .m-chip-v{font-size:15px;font-weight:700;color:var(--text);}
        .m-chip.good .m-chip-v{color:var(--green);}.m-chip.bad .m-chip-v{color:var(--loss);}
        .m-verdict{font-size:12.5px;color:var(--text2);line-height:1.6;border-top:1px solid var(--border);padding-top:11px;}
        .m-err{font-size:12px;color:var(--loss);line-height:1.6;}
        .m-sec-hd{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);margin:6px 2px 9px;}
        .m-view-tabs{display:flex;gap:3px;margin-bottom:16px;}
        .m-vtab{font-size:11px;font-weight:700;padding:7px 16px;border-radius:9px;border:none;background:none;color:var(--text3);cursor:pointer;transition:all .15s;}
        .m-vtab.active{background:var(--blue);color:#fff;}
        .m-vtab:not(.active):hover{color:var(--text);}
        .m-comb-hd{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px;}
        .m-comb-wrap{position:relative;height:380px;}
        .m-comb-note{font-size:10.5px;color:var(--text3);line-height:1.6;margin-top:12px;}
        .macro-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(248px,1fr));gap:12px;margin-bottom:22px;}
        .m-card{background:var(--white);border:1px solid var(--border);border-radius:12px;box-shadow:var(--sb);padding:14px 16px;cursor:pointer;transition:border-color .15s,transform .15s;}
        .m-card[data-key]:hover{border-color:var(--border2);transform:translateY(-1px);}
        .m-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:24px;}
        .m-label{font-size:9.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--text2);}
        .m-val{font-size:22px;font-weight:700;color:var(--text);margin-top:8px;line-height:1.1;}
        .m-delta{font-size:11px;font-weight:700;margin-top:4px;display:flex;align-items:baseline;gap:6px;}
        .m-period{font-size:8px;font-weight:600;color:var(--text4);letter-spacing:.04em;text-transform:uppercase;}
        .m-desc{font-size:10px;color:var(--text3);line-height:1.55;margin-top:9px;}
        .mc-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:500;display:none;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(3px);}
        .mc-overlay.open{display:flex;}
        .mc-modal{background:#14161e;border:1px solid var(--border2);border-radius:18px;width:100%;max-width:640px;box-shadow:0 18px 54px rgba(0,0,0,.6);padding:18px 20px 20px;}
        .mc-hd{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:6px;}
        .mc-title{font-size:14px;font-weight:700;color:var(--text);}
        .mc-value{font-size:24px;font-weight:700;color:var(--text);margin-top:2px;}
        .mc-close{background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;line-height:1;}
        .mc-ranges{display:flex;gap:5px;flex-wrap:wrap;margin:10px 0;}
        .mc-range{font-size:9px;font-weight:700;padding:4px 11px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--text2);cursor:pointer;}
        .mc-range.active{background:var(--blue);color:#fff;border-color:var(--blue);}
        .mc-chart-wrap{position:relative;height:300px;}
        .mc-desc{font-size:11px;color:var(--text3);line-height:1.6;margin-top:14px;display:flex;flex-direction:column;gap:9px;}
        .mc-info-row{display:flex;gap:10px;align-items:flex-start;}
        .mc-info-k{flex:0 0 64px;font-size:8.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text3);padding-top:1px;}
        .mc-info-v{flex:1;font-size:11.5px;color:var(--text2);line-height:1.6;}
        .m-comb-legend{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:8px 18px;margin-top:14px;padding-top:14px;border-top:1px solid var(--border);}
        .m-cl-item{display:flex;gap:8px;align-items:flex-start;font-size:10.5px;color:var(--text2);line-height:1.5;}
        .m-cl-dot{flex:0 0 9px;width:9px;height:9px;border-radius:50%;margin-top:3px;}
        .m-cl-or{font-size:9px;font-weight:700;color:var(--text3);letter-spacing:.02em;}
        @media(max-width:768px){.macro-grid{grid-template-columns:1fr;}}
      `}</style>
      <div className="macro-wrap">
        <div className="macro-banner" id="macro-banner"><div className="m-err" style={{ color: 'var(--text3)' }}>Memuat data makro…</div></div>
        <div className="m-view-tabs">
          <button id="mv-cards" className="m-vtab active" onClick={() => setMacroView('cards')}>Indikator</button>
          <button id="mv-comb" className="m-vtab" onClick={() => setMacroView('comb')}>Combined</button>
        </div>
        <div id="macro-cards-view">
          {SECS.map(([sec, label]) => (
            <div key={sec}>
              <div className="m-sec-hd">{label}</div>
              <div className="macro-grid" id={'macro-grid-' + sec}></div>
            </div>
          ))}
        </div>
        <div id="macro-comb-view" style={{ display: 'none' }}>
          <div className="macro-banner">
            <div className="m-comb-hd">
              <div className="m-sec-hd" style={{ margin: 0 }}>Composite Regime — z-score (oriented: naik = risk-on)</div>
              <div className="mc-ranges" style={{ margin: 0 }}>
                {[['1y', '1Y'], ['3y', '3Y'], ['5y', '5Y'], ['all', 'All']].map(([r, l]) => (
                  <button key={r} className={'comb-range mc-range' + (r === 'all' ? ' active' : '')} data-r={r} onClick={() => setCombRange(r)}>{l}</button>
                ))}
              </div>
            </div>
            <div className="m-comb-wrap"><canvas id="macro-comb-chart"></canvas></div>
            <div className="m-comb-note">Garis tebal putih = <b>Composite</b> (rata-rata semua indikator engine, di-orient ke arah risk-on, sumbu kiri). Garis oranye/hijau = <b>BTC/USD</b> &amp; <b>S&amp;P 500</b> (di-indeks ke 100 di awal periode, sumbu kanan) — buat validasi visual apakah regime risk-on/off beneran nempel sama gerak harga. Histori narik balik sampai 2013 (titik mulai RRP/Net Liquidity). Klik legend buat munculin/sembunyiin indikator individual — pas garis-garis <b>clustering</b> searah = regime kuat.</div>
            <div className="m-comb-legend">
              <div className="m-cl-item"><span className="m-cl-dot" style={{ background: '#eef0f5' }}></span><div><b>Composite (Bias Risk)</b> — rata-rata z-score 9 indikator engine yang udah di-orient. Di atas 0 = bias risk-on, di bawah 0 = risk-off.</div></div>
              <div className="m-cl-item"><span className="m-cl-dot" style={{ background: '#f7931a' }}></span><div><b>BTC/USD</b> <span className="m-cl-or">aset referensi (sumbu kanan)</span> — buat ngecek apakah composite nempel sama harga aset beneran.</div></div>
              <div className="m-cl-item"><span className="m-cl-dot" style={{ background: '#4ade80' }}></span><div><b>S&amp;P 500</b> <span className="m-cl-or">aset referensi (sumbu kanan)</span> — pembanding ekuitas AS.</div></div>
              {ENGINE.map(k => {
                const c = cfgOf(k); if (!c) return null
                return (
                  <div className="m-cl-item" key={k}>
                    <span className="m-cl-dot" style={{ background: COMB_COLORS[k] }}></span>
                    <div><b>{c.label}</b> <span className="m-cl-or">{ORIENT[k] > 0 ? 'naik = risk-on' : 'naik = risk-off (garis dibalik)'}</span> — {c.desc}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mc-overlay" id="mc-overlay" onClick={e => { if (e.target === e.currentTarget) closeChart() }}>
        <div className="mc-modal">
          <div className="mc-hd">
            <div>
              <div className="mc-title" id="mc-title"></div>
              <div className="mc-value" id="mc-value"></div>
            </div>
            <button className="mc-close" onClick={closeChart}>✕</button>
          </div>
          <div className="mc-ranges">
            {[['1y', '1Y'], ['3y', '3Y'], ['5y', '5Y'], ['all', 'All']].map(([r, l]) => (
              <button key={r} className={'mc-range' + (r === 'all' ? ' active' : '')} data-r={r} onClick={() => setChartRange(r)}>{l}</button>
            ))}
          </div>
          <div className="mc-chart-wrap"><canvas id="macro-chart"></canvas></div>
          <div className="mc-desc" id="mc-desc"></div>
        </div>
      </div>
    </DashboardShell>
  )
}
