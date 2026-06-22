'use client'

import { useEffect, useRef } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any
type Pos = { id: string; ticker: string; ticker_type: string; avg_buy_price: number; qty: number; is_active: boolean }
type Val = { id?: string; ticker: string; ticker_type: string; method: string; inputs: Any; fair_value: number | null; bear_value: number | null; thesis: string | null }

let positions: Pos[] = []
const valByTicker: Record<string, Val> = {}
const priceByTicker: Record<string, number> = {}
let macroRegime: Any = null
let focusTicker = ''
let editTicker = ''

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function api(path: string, method = 'GET', body: any = null) {
  const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const r = await fetch(path, opts)
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

function isUsd(tt: string) { return tt === 'crypto' || tt === 'stock_usd' }
function fmtCur(n: number, tt: string) {
  if (isUsd(tt)) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return 'Rp ' + Math.round(n).toLocaleString('id-ID')
}
function typeLabel(tt: string) { return tt === 'crypto' ? 'Crypto' : tt === 'stock_usd' ? 'Saham USD' : tt === 'stock_idr' ? 'Saham IDR' : 'Lainnya' }

// ticker unik dari posisi aktif + avg cost berbobot
function tickerRows(): { ticker: string; tt: string; avgCost: number }[] {
  const m: Record<string, { ticker: string; tt: string; cost: number; qty: number }> = {}
  positions.filter(p => p.is_active && Number(p.qty) > 0).forEach(p => {
    const r = m[p.ticker] || (m[p.ticker] = { ticker: p.ticker, tt: p.ticker_type, cost: 0, qty: 0 })
    r.cost += Number(p.avg_buy_price) * Number(p.qty); r.qty += Number(p.qty)
  })
  return Object.values(m).map(r => ({ ticker: r.ticker, tt: r.tt, avgCost: r.qty ? r.cost / r.qty : 0 }))
}

// hitung fair & bear dari input + method
function computeStock(inp: Any) {
  const eps = +inp.eps || 0, fairPe = +inp.fairPe || 0, bvps = +inp.bvps || 0, fairPb = +inp.fairPb || 0
  const peVal = eps && fairPe ? eps * fairPe : null
  const pbVal = bvps && fairPb ? bvps * fairPb : null
  let fair: number | null = null
  if (inp.method === 'pb') fair = pbVal
  else if (inp.method === 'blended') { const xs = [peVal, pbVal].filter((x): x is number => x != null); fair = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null }
  else fair = peVal
  const bearPe = +inp.bearPe || 0
  const bear = bearPe && eps ? eps * bearPe : (+inp.bearPrice || null)
  return { fair, bear }
}
function computeCrypto(inp: Any) {
  return { fair: +inp.scenarioTarget || null, bear: +inp.bearPrice || null }
}

function macroTag(tt: string): { cls: string; label: string; txt: string } | null {
  if (!macroRegime) return null
  const risk = macroRegime.risk
  if (tt === 'crypto') {
    if (risk === 'risk-on') return { cls: 'tw', label: 'Tailwind', txt: 'Likuiditas/risk mendukung — crypto sensitif banget ke makro.' }
    if (risk === 'risk-off') return { cls: 'hw', label: 'Headwind', txt: 'Likuiditas ketat/dollar kuat — headwind kuat buat crypto.' }
    return { cls: 'nu', label: 'Netral', txt: 'Sinyal makro campur — crypto nunggu arah likuiditas.' }
  }
  if (risk === 'risk-on') return { cls: 'tw', label: 'Tailwind', txt: 'Regime mendukung risk asset — tailwind sedang. Fundamental tetap utama.' }
  if (risk === 'risk-off') return { cls: 'hw', label: 'Headwind', txt: 'Regime menekan risk asset — headwind. Idiosinkratik emiten tetap dominan.' }
  return { cls: 'nu', label: 'Netral', txt: 'Makro netral — fokus ke fundamental emiten.' }
}

function esc(s: string) { return (s || '').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] as string)) }

function renderGrid() {
  const el = document.getElementById('val-grid')
  if (!el) return
  const rows = tickerRows()
  if (!rows.length) { el.innerHTML = `<div class="val-empty">Belum ada posisi. Tambah dulu di The Portfolio, nanti ticker-nya muncul di sini buat divaluasi.</div>`; return }
  el.innerHTML = rows.map(r => {
    const v = valByTicker[r.ticker]
    const price = priceByTicker[r.ticker] || 0
    const tag = macroTag(r.tt)
    const tagHtml = tag ? `<span class="val-mtag val-${tag.cls}" title="${tag.txt}">${tag.label}</span>` : ''
    if (!v || v.fair_value == null) {
      return `<div class="val-card unvalued" data-ticker="${r.ticker}">
        <div class="val-card-top"><span class="val-tk">${r.ticker}</span><span class="val-type">${typeLabel(r.tt)}</span></div>
        <div class="val-price">${price ? fmtCur(price, r.tt) : '—'} <span class="val-price-l">harga skarang</span></div>
        <div class="val-unv">Belum divaluasi</div>
        ${tagHtml}
        <button class="val-cta">Hitung valuasi →</button>
      </div>`
    }
    const fair = v.fair_value
    const mos = r.avgCost && fair ? (fair - r.avgCost) / fair * 100 : null
    const upside = price && fair ? (fair - price) / price * 100 : null
    const mosCls = mos == null ? '' : mos >= 25 ? 'pos' : mos >= 0 ? 'neu' : 'neg'
    return `<div class="val-card" data-ticker="${r.ticker}">
      <div class="val-card-top"><span class="val-tk">${r.ticker}</span><span class="val-type">${typeLabel(r.tt)}${v.method ? ' · ' + v.method : ''}</span></div>
      <div class="val-fair">${fmtCur(fair, r.tt)} <span class="val-price-l">fair value</span></div>
      <div class="val-row2">
        <div><span class="val-k">Harga</span><span class="val-vv">${price ? fmtCur(price, r.tt) : '—'}</span></div>
        <div><span class="val-k">MOS</span><span class="val-vv ${mosCls}">${mos != null ? mos.toFixed(0) + '%' : '—'}</span></div>
        <div><span class="val-k">Upside</span><span class="val-vv ${upside != null && upside >= 0 ? 'pos' : 'neg'}">${upside != null ? (upside >= 0 ? '+' : '') + upside.toFixed(0) + '%' : '—'}</span></div>
      </div>
      ${tag ? `<div class="val-mnote val-${tag.cls}">${tagHtml} ${tag.txt}</div>` : ''}
    </div>`
  }).join('')
}

function openCalc(ticker: string) {
  const row = tickerRows().find(r => r.ticker === ticker)
  if (!row) return
  editTicker = ticker
  const tt = row.tt, price = priceByTicker[ticker] || 0
  const v = valByTicker[ticker]
  const inp = v?.inputs || {}
  const body = document.getElementById('vm-body')
  const modal = document.getElementById('val-modal')
  if (!body || !modal) return
  const crypto = tt === 'crypto'
  const curLbl = isUsd(tt) ? 'USD' : 'IDR'

  const fields = crypto ? `
    <div class="vm-hint">Crypto gak punya cash flow → ini bukan valuasi intrinsik, tapi <b>target skenario/siklus</b>. "MOS"-nya = jarak ke anchor, bukan margin nilai wajar.</div>
    <label class="vm-l">Target skenario (${curLbl}) — mis. TAM: % market cap emas</label>
    <input class="vm-i" id="f-scenarioTarget" type="number" value="${inp.scenarioTarget ?? ''}" placeholder="target harga skenario">
    <label class="vm-l">Bear / floor siklus (${curLbl})</label>
    <input class="vm-i" id="f-bearPrice" type="number" value="${inp.bearPrice ?? ''}" placeholder="mis. 200w MA / realized price">
  ` : `
    <label class="vm-l">Metode</label>
    <select class="vm-i" id="f-method">
      <option value="pe"${(inp.method || 'pe') === 'pe' ? ' selected' : ''}>P/E × EPS</option>
      <option value="pb"${inp.method === 'pb' ? ' selected' : ''}>P/B × BVPS</option>
      <option value="blended"${inp.method === 'blended' ? ' selected' : ''}>Blended (rata-rata)</option>
    </select>
    <div class="vm-2">
      <div><label class="vm-l">EPS (${curLbl}/lembar)</label><input class="vm-i" id="f-eps" type="number" value="${inp.eps ?? ''}" placeholder="laba per lembar"></div>
      <div><label class="vm-l">Fair P/E</label><input class="vm-i" id="f-fairPe" type="number" value="${inp.fairPe ?? ''}" placeholder="mis. 16"></div>
    </div>
    <div class="vm-2">
      <div><label class="vm-l">BVPS (${curLbl}/lembar)</label><input class="vm-i" id="f-bvps" type="number" value="${inp.bvps ?? ''}" placeholder="book value/lembar"></div>
      <div><label class="vm-l">Fair P/B</label><input class="vm-i" id="f-fairPb" type="number" value="${inp.fairPb ?? ''}" placeholder="mis. 2.5"></div>
    </div>
    <div class="vm-2">
      <div><label class="vm-l">Bear P/E (opsional)</label><input class="vm-i" id="f-bearPe" type="number" value="${inp.bearPe ?? ''}" placeholder="mis. 10"></div>
      <div><label class="vm-l">atau Bear price</label><input class="vm-i" id="f-bearPrice" type="number" value="${inp.bearPrice ?? ''}" placeholder="harga terburuk"></div>
    </div>
  `
  body.innerHTML = `
    <div class="vm-head"><div><div class="vm-tk">${ticker}</div><div class="vm-sub">${typeLabel(tt)} · harga skarang ${price ? fmtCur(price, tt) : '—'}</div></div><button class="vm-x" id="vm-cancel">✕</button></div>
    ${fields}
    <label class="vm-l">Tesis (kenapa nilainya segini?)</label>
    <textarea class="vm-i" id="f-thesis" rows="3" placeholder="mis. fair P/E 16 × EPS 690 = 11.040">${esc(v?.thesis || '')}</textarea>
    <div class="vm-prev" id="vm-prev"></div>
    <div class="vm-actions"><button class="vm-btn ghost" id="vm-cancel2">Batal</button><button class="vm-btn primary" id="vm-save">Simpan & set target</button></div>`

  body.querySelectorAll<HTMLElement>('input,select,textarea').forEach(i => i.addEventListener('input', vmRecompute))
  document.getElementById('vm-cancel')?.addEventListener('click', closeCalc)
  document.getElementById('vm-cancel2')?.addEventListener('click', closeCalc)
  document.getElementById('vm-save')?.addEventListener('click', vmSave)
  modal.classList.add('open')
  vmRecompute()
}
function closeCalc() { document.getElementById('val-modal')?.classList.remove('open'); editTicker = '' }

function readInputs() {
  const g = (id: string) => (document.getElementById('f-' + id) as HTMLInputElement | null)?.value ?? ''
  const tt = tickerRows().find(r => r.ticker === editTicker)?.tt || ''
  if (tt === 'crypto') return { method: 'scenario', scenarioTarget: g('scenarioTarget'), bearPrice: g('bearPrice') }
  return { method: g('method') || 'pe', eps: g('eps'), fairPe: g('fairPe'), bvps: g('bvps'), fairPb: g('fairPb'), bearPe: g('bearPe'), bearPrice: g('bearPrice') }
}
function calcFor(tt: string, inp: Any) { return tt === 'crypto' ? computeCrypto(inp) : computeStock(inp) }

function vmRecompute() {
  const row = tickerRows().find(r => r.ticker === editTicker); if (!row) return
  const inp = readInputs()
  const { fair, bear } = calcFor(row.tt, inp)
  const price = priceByTicker[editTicker] || 0
  const mos = row.avgCost && fair ? (fair - row.avgCost) / fair * 100 : null
  const upside = price && fair ? (fair - price) / price * 100 : null
  const prev = document.getElementById('vm-prev'); if (!prev) return
  if (fair == null) { prev.innerHTML = `<span class="vm-prev-empty">Isi input buat liat fair value…</span>`; return }
  prev.innerHTML = `
    <div class="vm-prev-row"><span>Fair value</span><b>${fmtCur(fair, row.tt)}</b></div>
    ${bear != null ? `<div class="vm-prev-row"><span>Bear</span><b>${fmtCur(bear, row.tt)}</b></div>` : ''}
    <div class="vm-prev-row"><span>MOS (vs avg cost ${fmtCur(row.avgCost, row.tt)})</span><b class="${mos != null && mos >= 0 ? 'pos' : 'neg'}">${mos != null ? mos.toFixed(0) + '%' : '—'}</b></div>
    <div class="vm-prev-row"><span>Upside (vs harga ${price ? fmtCur(price, row.tt) : '—'})</span><b class="${upside != null && upside >= 0 ? 'pos' : 'neg'}">${upside != null ? (upside >= 0 ? '+' : '') + upside.toFixed(0) + '%' : '—'}</b></div>`
}

async function vmSave() {
  const row = tickerRows().find(r => r.ticker === editTicker); if (!row) return
  const inp = readInputs()
  const { fair, bear } = calcFor(row.tt, inp)
  if (fair == null) { alert('Fair value belum kebentuk — cek input.'); return }
  const thesis = (document.getElementById('f-thesis') as HTMLTextAreaElement | null)?.value || ''
  const vtype = row.tt === 'crypto' ? 'cycle' : 'intrinsic'
  const btn = document.getElementById('vm-save') as HTMLButtonElement | null
  if (btn) { btn.disabled = true; btn.textContent = 'Nyimpen…' }
  try {
    const saved = await api('/api/portfolio/valuations', 'POST', {
      ticker: row.ticker, ticker_type: row.tt, method: inp.method, inputs: inp,
      fair_value: fair, bear_value: bear, thesis,
    })
    valByTicker[row.ticker] = saved
    // nembak ke semua posisi ticker ini → portfolio (outlook/MOS/money-mgmt) ikut update
    const same = positions.filter(p => p.ticker === row.ticker)
    await Promise.all(same.map(p => api('/api/portfolio/positions', 'PATCH', {
      id: p.id, target_price: fair, bear_price: bear ?? null, valuation_type: vtype, thesis,
    })))
    closeCalc(); renderGrid()
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = 'Gagal — coba lagi' }
    console.error(e)
  }
}

async function fetchPrices() {
  const active = positions.filter(p => p.is_active && Number(p.qty) > 0)
  const symbols: string[] = []
  active.forEach(p => {
    if (p.ticker_type === 'stock_idr') symbols.push(p.ticker + '.JK')
    else if (p.ticker_type === 'crypto') symbols.push(p.ticker + '-USD')
    else if (p.ticker_type === 'stock_usd') symbols.push(p.ticker)
  })
  if (!symbols.length) return
  try {
    const data = await api(`/api/portfolio/market-price?tickers=${[...new Set(symbols)].join(',')}`)
    ;(data.prices || []).forEach((p: { symbol: string; ticker: string; price: number }) => {
      if (p.symbol !== 'USDIDR=X') priceByTicker[p.ticker] = p.price
    })
  } catch { /* harga opsional */ }
}

async function init() {
  focusTicker = new URLSearchParams(window.location.search).get('focus') || ''
  try {
    const [p, vals] = await Promise.all([api('/api/portfolio/positions'), api('/api/portfolio/valuations')])
    positions = p || []
    ;(vals || []).forEach((v: Val) => { valByTicker[v.ticker] = v })
  } catch (e) { console.error(e) }
  renderGrid()
  fetch('/api/macro').then(r => r.ok ? r.json() : null).then(d => { if (d && !d.error) { macroRegime = d.regime; renderGrid() } }).catch(() => {})
  await fetchPrices()
  renderGrid()
  if (focusTicker && tickerRows().some(r => r.ticker === focusTicker)) openCalc(focusTicker)
}

export default function ValuationPage() {
  const initRef = useRef(false)
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    init()
    const onClick = (e: MouseEvent) => {
      const card = (e.target as HTMLElement).closest('.val-card') as HTMLElement | null
      if (card?.dataset.ticker) openCalc(card.dataset.ticker)
    }
    document.getElementById('val-grid')?.addEventListener('click', onClick)
    const modal = document.getElementById('val-modal')
    const onModal = (e: MouseEvent) => { if (e.target === modal) closeCalc() }
    modal?.addEventListener('click', onModal)
    return () => {
      document.getElementById('val-grid')?.removeEventListener('click', onClick)
      modal?.removeEventListener('click', onModal)
      positions = []; for (const k in valByTicker) delete valByTicker[k]; for (const k in priceByTicker) delete priceByTicker[k]
      macroRegime = null; editTicker = ''
    }
  }, [])

  return (
    <DashboardShell title="The Valuation">
      <style>{`
        :root{ --vbg:#0b0c10;--vcard:#15161c;--vborder:rgba(255,255,255,.08);--vb2:rgba(255,255,255,.16);
          --vt:#eef0f5;--vt2:#97a0b3;--vt3:#687087;--vblue:#3e6df0;--vgreen:#34d399;--vred:#f6685e;--vgold:#f0b429;}
        .val-wrap{max-width:1120px;margin:0 auto;padding:18px 16px 60px;}
        .val-intro{font-size:11.5px;color:var(--vt3);line-height:1.6;margin-bottom:16px;}
        .val-intro b{color:var(--vt2);}
        .val-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;}
        .val-empty{grid-column:1/-1;font-size:12px;color:var(--vt3);text-align:center;padding:40px 16px;}
        .val-card{background:var(--vcard);border:1px solid var(--vborder);border-radius:12px;padding:14px 16px;cursor:pointer;transition:border-color .15s,transform .15s;}
        .val-card:hover{border-color:var(--vb2);transform:translateY(-1px);}
        .val-card.unvalued{border-style:dashed;}
        .val-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px;}
        .val-tk{font-size:14px;font-weight:700;color:var(--vt);}
        .val-type{font-size:8.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--vt3);}
        .val-price,.val-fair{font-size:18px;font-weight:700;color:var(--vt);margin-top:9px;line-height:1.1;}
        .val-fair{color:var(--vblue);}
        .val-price-l{font-size:9px;font-weight:600;color:var(--vt3);text-transform:uppercase;letter-spacing:.04em;}
        .val-unv{font-size:11px;color:var(--vgold);margin-top:8px;font-weight:600;}
        .val-cta{margin-top:10px;width:100%;background:rgba(62,109,240,.14);border:1px solid rgba(62,109,240,.4);color:#cdd9ff;font-size:11px;font-weight:700;padding:7px;border-radius:8px;cursor:pointer;}
        .val-row2{display:flex;gap:14px;margin-top:10px;}
        .val-row2 > div{display:flex;flex-direction:column;gap:2px;}
        .val-k{font-size:8px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--vt3);}
        .val-vv{font-size:12px;font-weight:700;color:var(--vt);}
        .val-vv.pos{color:var(--vgreen);}.val-vv.neg{color:var(--vred);}.val-vv.neu{color:var(--vgold);}
        .val-mtag{display:inline-block;font-size:8px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:2px 7px;border-radius:6px;border:1px solid var(--vborder);}
        .val-mtag.val-tw,.val-mnote.val-tw .val-mtag{color:var(--vgreen);border-color:rgba(52,211,153,.4);background:rgba(52,211,153,.08);}
        .val-mtag.val-hw,.val-mnote.val-hw .val-mtag{color:var(--vred);border-color:rgba(246,104,94,.4);background:rgba(246,104,94,.08);}
        .val-mtag.val-nu,.val-mnote.val-nu .val-mtag{color:var(--vt2);}
        .val-mnote{font-size:9.5px;color:var(--vt3);line-height:1.5;margin-top:10px;display:flex;gap:6px;align-items:baseline;flex-wrap:wrap;}
        .val-card.unvalued .val-mtag{margin-top:8px;}
        .val-modal{position:fixed;inset:0;z-index:500;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.6);backdrop-filter:blur(3px);padding:20px;}
        .val-modal.open{display:flex;}
        .vm-card{background:#14161e;border:1px solid var(--vb2);border-radius:16px;width:100%;max-width:460px;max-height:90vh;overflow-y:auto;box-shadow:0 18px 54px rgba(0,0,0,.6);padding:18px 20px 18px;}
        .vm-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:6px;}
        .vm-tk{font-size:16px;font-weight:700;color:var(--vt);}
        .vm-sub{font-size:10px;color:var(--vt3);margin-top:2px;}
        .vm-x{background:none;border:none;color:var(--vt3);font-size:16px;cursor:pointer;line-height:1;}
        .vm-hint{font-size:10px;color:var(--vt3);line-height:1.5;background:rgba(240,180,41,.08);border:1px solid rgba(240,180,41,.25);border-radius:8px;padding:8px 10px;margin:8px 0;}
        .vm-hint b{color:var(--vgold);}
        .vm-l{display:block;font-size:9px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--vt3);margin:10px 0 4px;}
        .vm-i{width:100%;box-sizing:border-box;background:var(--vbg);border:1px solid var(--vborder);border-radius:8px;padding:8px 10px;font-size:12px;color:var(--vt);outline:none;font-family:inherit;}
        .vm-i:focus{border-color:rgba(62,109,240,.6);}
        .vm-2{display:flex;gap:8px;}.vm-2 > div{flex:1;min-width:0;}
        .vm-prev{margin-top:12px;padding:10px 12px;background:var(--vbg);border:1px solid var(--vborder);border-radius:10px;}
        .vm-prev-empty{font-size:10px;color:var(--vt3);font-style:italic;}
        .vm-prev-row{display:flex;align-items:baseline;justify-content:space-between;gap:10px;font-size:11px;color:var(--vt2);padding:2px 0;}
        .vm-prev-row b{font-size:13px;color:var(--vt);}
        .vm-prev-row b.pos{color:var(--vgreen);}.vm-prev-row b.neg{color:var(--vred);}
        .vm-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;}
        .vm-btn{padding:8px 16px;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid transparent;}
        .vm-btn.ghost{background:none;border-color:var(--vborder);color:var(--vt2);}
        .vm-btn.primary{background:var(--vblue);color:#fff;}
        .vm-btn:disabled{opacity:.6;cursor:default;}
        @media(max-width:768px){.val-grid{grid-template-columns:1fr;}}
      `}</style>
      <div className="val-wrap">
        <div className="val-intro">Tempat lu <b>ngitung</b> nilai wajar tiap aset — bukan nebak. Fair value yang lu hitung di sini otomatis jadi <b>target</b> di The Portfolio (MOS &amp; upside). Saham = valuasi intrinsik (multiples); crypto = target skenario/siklus. Konteks regime dari The Macro nempel di tiap aset.</div>
        <div className="val-grid" id="val-grid"></div>
      </div>
      <div className="val-modal" id="val-modal"><div className="vm-card"><div id="vm-body"></div></div></div>
    </DashboardShell>
  )
}
