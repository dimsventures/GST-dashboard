'use client'

import { useEffect, useRef } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'

// ── Model & state (pola sama kayak finance/portfolio page) ─────────────
type Cat = { id: string; type: string; name: string; sort_order?: number }
type Trx = { id: string; type: string; category: string; amount: number; date: string }
type Budget = { id: string; ym: string; kind: string; category: string; planned: number }

let ym = ''
let finCats: Record<string, Cat[]> = { expense: [], income: [], investment: [], buffer: [] }
let plan: Record<string, number> = {}
let actualInc: Record<string, number> = {}
let actualExp: Record<string, number> = {}
let actualSav = 0
let showTips = false

const SAVE_CAT = 'Tabungan & Investasi'
const EXP_CATS = ['Housing', 'Consumption', 'Needs', 'Transport', 'Utilities', 'Joy', 'Electronic', 'Charity', 'Unexpected']
const INC_DEFAULT = ['Gaji', 'Usaha', 'Bonus', 'Lainnya']
// 50/30/20: pemetaan kategori ke Needs vs Wants (default sisanya = Wants)
const NEEDS = new Set(['Housing', 'Consumption', 'Needs', 'Transport', 'Utilities', 'Unexpected'])
const WANTS = new Set(['Joy', 'Electronic', 'Charity'])
const MN_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function p2(n: number) { return String(n).padStart(2, '0') }
function curMonth() { const n = new Date(); return `${n.getFullYear()}-${p2(n.getMonth() + 1)}` }
function shiftMonth(s: string, d: number) { const [y, m] = s.split('-').map(Number); const dt = new Date(y, m - 1 + d, 1); return `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}` }
function monthName(s: string) { const [y, m] = s.split('-').map(Number); return `${MN_FULL[m - 1]} ${y}` }
function fmtRp(n: number) { return 'Rp ' + Math.round(n).toLocaleString('id-ID') }
function fmtShort(n: number) {
  const a = Math.abs(n)
  if (a >= 1e9) return 'Rp ' + (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'M'
  if (a >= 1e6) return 'Rp ' + (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'jt'
  if (a >= 1e3) return 'Rp ' + Math.round(n / 1e3) + 'rb'
  return 'Rp ' + Math.round(n)
}
function parseRp(s: string) { return Number(String(s).replace(/[^\d]/g, '')) || 0 }
function esc(s: string) { return s.replace(/"/g, '&quot;') }

async function api(path: string, method = 'GET', body: unknown = null) {
  const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const r = await fetch(path, opts)
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

// ── Daftar kategori yang aktif (gabungan default + custom + yang ada datanya) ──
function incomeCats(): string[] {
  const s = new Set<string>(finCats.income.map(c => c.name))
  Object.keys(actualInc).forEach(k => s.add(k))
  Object.keys(plan).forEach(k => { if (k.startsWith('income|')) s.add(k.slice(7)) })
  if (!s.size) INC_DEFAULT.forEach(k => s.add(k))
  return [...s]
}
function expenseCats(): string[] {
  const s = new Set<string>(EXP_CATS)
  finCats.expense.forEach(c => s.add(c.name))
  Object.keys(actualExp).forEach(k => s.add(k))
  Object.keys(plan).forEach(k => { if (k.startsWith('expense|')) s.add(k.slice(8)) })
  const arr = [...s]
  // Needs dulu baru Wants, biar 50/30/20 kebaca
  return arr.sort((a, b) => groupRank(a) - groupRank(b) || a.localeCompare(b))
}
function groupOf(cat: string): 'needs' | 'wants' { return NEEDS.has(cat) ? 'needs' : WANTS.has(cat) ? 'wants' : 'wants' }
function groupRank(cat: string) { return groupOf(cat) === 'needs' ? 0 : 1 }

function pget(kind: string, cat: string) { return plan[`${kind}|${cat}`] || 0 }

// ── Render ─────────────────────────────────────────────────────────────
function gid(id: string) { return document.getElementById(id) }

function render() {
  const ml = gid('bud-monthlabel'); if (ml) ml.textContent = monthName(ym)
  renderCards()
  renderGauge()
  renderIncome()
  renderExpense()
  renderSavings()
  const tip = gid('bud-tips'); if (tip) tip.style.display = showTips ? 'block' : 'none'
}

function totals() {
  const incP = incomeCats().reduce((s, c) => s + pget('income', c), 0)
  const expP = expenseCats().reduce((s, c) => s + pget('expense', c), 0)
  const savP = pget('saving', SAVE_CAT)
  const incA = Object.values(actualInc).reduce((s, n) => s + n, 0)
  const expA = Object.values(actualExp).reduce((s, n) => s + n, 0)
  const needsP = expenseCats().filter(c => groupOf(c) === 'needs').reduce((s, c) => s + pget('expense', c), 0)
  const wantsP = expenseCats().filter(c => groupOf(c) === 'wants').reduce((s, c) => s + pget('expense', c), 0)
  return { incP, expP, savP, incA, expA, savA: actualSav, needsP, wantsP, unalloc: incP - expP - savP }
}

function renderCards() {
  const el = gid('bud-cards'); if (!el) return
  const t = totals()
  const card = (lbl: string, plan: number, actual: number, accent: string) => `
    <div class="bud-card">
      <div class="bud-card-lbl">${lbl}</div>
      <div class="bud-card-num" style="color:${accent}">${fmtRp(plan)}</div>
      <div class="bud-card-sub">aktual ${fmtRp(actual)}</div>
    </div>`
  el.innerHTML =
    card('Pendapatan', t.incP, t.incA, 'var(--green)') +
    card('Pengeluaran', t.expP, t.expA, 'var(--blue)') +
    card('Tabungan & Investasi', t.savP, t.savA, 'var(--gold)') +
    `<div class="bud-card ${t.unalloc === 0 ? 'ok' : t.unalloc > 0 ? 'warn' : 'over'}">
      <div class="bud-card-lbl">${t.unalloc >= 0 ? 'Belum Dialokasikan' : 'Over-Budget'}</div>
      <div class="bud-card-num">${fmtRp(Math.abs(t.unalloc))}</div>
      <div class="bud-card-sub">${t.unalloc === 0 ? '✓ tiap rupiah punya tugas' : t.unalloc > 0 ? 'kasih tugas — zero-based' : 'rencana lewat pendapatan'}</div>
    </div>`
}

function renderGauge() {
  const el = gid('bud-gauge'); if (!el) return
  const t = totals()
  const inc = t.incP || 1
  const rows: [string, number, number, string][] = [
    ['Needs', t.needsP / inc * 100, 50, 'var(--blue)'],
    ['Wants', t.wantsP / inc * 100, 30, 'var(--gold)'],
    ['Savings', t.savP / inc * 100, 20, 'var(--green)'],
  ]
  const bar = ([lbl, pct, target, col]: [string, number, number, string]) => {
    const over = (lbl === 'Savings') ? pct < target : pct > target
    const w = Math.min(100, pct)
    const hint = lbl === 'Savings'
      ? (pct >= target ? 'mantap 👍' : 'kurang dari ideal')
      : (pct > target ? 'agak tinggi' : 'aman')
    return `<div class="bud-g-row">
      <div class="bud-g-head"><span class="bud-g-lbl">${lbl}</span>
        <span class="bud-g-val ${over ? 'bad' : 'good'}">${Math.round(pct)}% <span class="bud-g-target">/ ideal ${target}% · ${hint}</span></span>
      </div>
      <div class="bud-g-track">
        <div class="bud-g-fill" style="width:${w}%;background:${col}"></div>
        <div class="bud-g-marker" style="left:${target}%"></div>
      </div>
    </div>`
  }
  el.innerHTML =
    `<div class="bud-sec-hd"><span>Aturan 50 / 30 / 20</span><span class="bud-sec-note">Needs ≤50% · Wants ≤30% · Savings ≥20% dari pendapatan</span></div>` +
    rows.map(bar).join('')
}

function inputRow(kind: string, cat: string, val: number) {
  return `<input type="text" inputmode="numeric" class="bud-inp" value="${val ? 'Rp ' + val.toLocaleString('id-ID') : ''}"
    placeholder="Rp 0" data-kind="${kind}" data-cat="${esc(cat)}"
    oninput="budInput(this)" onchange="budSave(this)">`
}

function renderIncome() {
  const el = gid('bud-income'); if (!el) return
  const cats = incomeCats()
  el.innerHTML = cats.map(c => {
    const a = actualInc[c] || 0
    return `<div class="bud-row">
      <span class="bud-cat">${c}</span>
      <span class="bud-row-actual">${a ? 'masuk ' + fmtShort(a) : ''}</span>
      ${inputRow('income', c, pget('income', c))}
    </div>`
  }).join('')
}

function renderExpense() {
  const el = gid('bud-expense'); if (!el) return
  const cats = expenseCats()
  let html = ''
  let lastGroup = ''
  for (const c of cats) {
    const g = groupOf(c)
    if (g !== lastGroup) {
      lastGroup = g
      html += `<div class="bud-group">${g === 'needs' ? 'NEEDS — kebutuhan' : 'WANTS — keinginan'}</div>`
    }
    const planned = pget('expense', c)
    const actual = actualExp[c] || 0
    const pct = planned ? Math.min(100, actual / planned * 100) : (actual ? 100 : 0)
    const over = planned > 0 && actual > planned
    const rem = planned - actual
    html += `<div class="bud-erow">
      <div class="bud-erow-top">
        <span class="bud-cat">${c}</span>
        ${inputRow('expense', c, planned)}
      </div>
      <div class="bud-bar"><div class="bud-bar-fill" style="width:${pct}%;background:${over ? 'var(--over)' : 'var(--blue)'}"></div></div>
      <div class="bud-erow-meta">
        <span>terpakai ${fmtShort(actual)}${planned ? ' / ' + fmtShort(planned) : ''}</span>
        <span class="${over ? 'bad' : 'good'}">${planned ? (over ? 'lewat ' + fmtShort(-rem) : 'sisa ' + fmtShort(rem)) : ''}</span>
      </div>
    </div>`
  }
  el.innerHTML = html
}

function renderSavings() {
  const el = gid('bud-savings'); if (!el) return
  const planned = pget('saving', SAVE_CAT)
  const actual = actualSav
  const pct = planned ? Math.min(100, actual / planned * 100) : (actual ? 100 : 0)
  const rem = planned - actual
  el.innerHTML = `<div class="bud-erow">
    <div class="bud-erow-top">
      <span class="bud-cat">${SAVE_CAT}<span class="bud-pyf">pay yourself first</span></span>
      ${inputRow('saving', SAVE_CAT, planned)}
    </div>
    <div class="bud-bar"><div class="bud-bar-fill" style="width:${pct}%;background:var(--gold)"></div></div>
    <div class="bud-erow-meta">
      <span>tercapai ${fmtShort(actual)}${planned ? ' / ' + fmtShort(planned) : ''}</span>
      <span class="${rem > 0 ? 'bad' : 'good'}">${planned ? (rem > 0 ? 'kurang ' + fmtShort(rem) : 'tercapai ✓') : ''}</span>
    </div>
  </div>
  <div class="bud-sav-note">Diisi dari transaksi tipe <b>investment</b> + <b>buffer</b> bulan ini di halaman Finance.</div>`
}

// ── Aksi ────────────────────────────────────────────────────────────────
function budInput(el: HTMLInputElement) {
  const v = el.value.replace(/[^\d]/g, '')
  el.value = v ? 'Rp ' + Number(v).toLocaleString('id-ID') : ''
}

async function budSave(el: HTMLInputElement) {
  const kind = el.dataset.kind || '', cat = el.dataset.cat || ''
  const val = parseRp(el.value)
  plan[`${kind}|${cat}`] = val
  render()
  try { await api('/api/finance-budgets', 'POST', { ym, kind, category: cat, planned: val }) }
  catch (e) { console.error('budget save failed', e) }
}

function applyBudgets(rows: Budget[]) {
  plan = {}
  rows.forEach(b => { plan[`${b.kind}|${b.category}`] = Number(b.planned) || 0 })
}
function applyTransactions(trx: Trx[]) {
  actualInc = {}; actualExp = {}; actualSav = 0
  trx.forEach(t => {
    const amt = Number(t.amount) || 0
    if (t.type === 'income') actualInc[t.category] = (actualInc[t.category] || 0) + amt
    else if (t.type === 'expense') actualExp[t.category] = (actualExp[t.category] || 0) + amt
    else if (t.type === 'investment' || t.type === 'buffer') actualSav += amt
  })
}

async function loadMonth() {
  const [b, trx] = await Promise.all([
    api(`/api/finance-budgets?month=${ym}`),
    api(`/api/transactions?month=${ym}`),
  ])
  applyBudgets(b as Budget[])
  applyTransactions(trx as Trx[])
  render()
}

async function budMonth(d: number) { ym = shiftMonth(ym, d); await loadMonth() }

async function budCopyPrev() {
  const prev = shiftMonth(ym, -1)
  const rows = (await api(`/api/finance-budgets?month=${prev}`)) as Budget[]
  if (!rows.length) { alert('Bulan sebelumnya (' + monthName(prev) + ') belum ada anggaran.'); return }
  const payload = rows.map(r => ({ ym, kind: r.kind, category: r.category, planned: Number(r.planned) || 0 }))
  await api('/api/finance-budgets', 'POST', payload)
  await loadMonth()
}

function budToggleTips() { showTips = !showTips; const el = gid('bud-tips'); if (el) el.style.display = showTips ? 'block' : 'none' }

async function init() {
  ym = curMonth()
  try {
    const fc = (await api('/api/finance-categories')) as Cat[]
    finCats = { expense: [], income: [], investment: [], buffer: [] }
    fc.forEach(c => { if (finCats[c.type]) finCats[c.type].push(c) })
  } catch { /* default cats dipakai */ }
  await loadMonth()
}

const WINDOW_FNS = ['budInput', 'budSave'] as const

export default function BudgetPage() {
  const initRef = useRef(false)
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    const w = window as unknown as Record<string, unknown>
    WINDOW_FNS.forEach(fn => { w[fn] = eval(fn) })
    init()
    return () => {
      WINDOW_FNS.forEach(fn => delete w[fn])
      plan = {}; actualInc = {}; actualExp = {}; actualSav = 0
    }
  }, [])

  return (
    <DashboardShell title="The Budget">
      <style>{`
        :root{
          --bg:#070d18;--card:#0b1322;--bg2:#101a30;
          --border:rgba(255,255,255,.08);--border2:rgba(255,255,255,.16);
          --text:#eef0f5;--text2:#97a0b3;--text3:#687087;
          --blue:#3e6df0;--green:#34d399;--gold:#f0b429;--over:#ef4444;
          --r:12px;--r2:8px;
        }
        .bud-wrap{max-width:920px;margin:0 auto;padding:16px 16px 60px;}
        .bud-top{display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;}
        .bud-mnav{display:flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--border);border-radius:var(--r2);padding:4px;}
        .bud-mnav button{width:30px;height:30px;border:none;background:transparent;color:var(--text2);font-size:16px;cursor:pointer;border-radius:6px;transition:all .15s;}
        .bud-mnav button:hover{background:rgba(255,255,255,.06);color:var(--text);}
        #bud-monthlabel{font-size:15px;font-weight:700;color:var(--text);min-width:130px;text-align:center;}
        .bud-act{margin-left:auto;display:flex;gap:8px;}
        .bud-act button{background:var(--card);border:1px solid var(--border);border-radius:var(--r2);padding:8px 13px;font-size:11px;font-weight:600;color:var(--text2);cursor:pointer;transition:all .15s;}
        .bud-act button:hover{color:var(--text);border-color:var(--border2);}
        .bud-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px;}
        .bud-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:13px 15px;}
        .bud-card-lbl{font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);}
        .bud-card-num{font-size:19px;font-weight:700;color:var(--text);margin-top:5px;line-height:1.1;}
        .bud-card-sub{font-size:10px;color:var(--text3);margin-top:4px;}
        .bud-card.ok{border-color:var(--green);}.bud-card.ok .bud-card-num{color:var(--green);}
        .bud-card.warn{border-color:var(--gold);}.bud-card.warn .bud-card-num{color:var(--gold);}
        .bud-card.over{border-color:var(--over);}.bud-card.over .bud-card-num{color:var(--over);}
        .bud-panel{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px;margin-bottom:14px;}
        .bud-sec-hd{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:12px;flex-wrap:wrap;}
        .bud-sec-hd > span:first-child{font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--text);}
        .bud-sec-note{font-size:10px;color:var(--text3);font-weight:500;}
        .bud-g-row{margin-bottom:11px;}.bud-g-row:last-child{margin-bottom:0;}
        .bud-g-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px;}
        .bud-g-lbl{font-size:12px;font-weight:600;color:var(--text);}
        .bud-g-val{font-size:12px;font-weight:700;}
        .bud-g-val.good{color:var(--green);}.bud-g-val.bad{color:var(--over);}
        .bud-g-target{font-size:9.5px;font-weight:500;color:var(--text3);}
        .bud-g-track{position:relative;height:8px;background:var(--bg2);border-radius:5px;overflow:hidden;}
        .bud-g-fill{height:100%;border-radius:5px;transition:width .3s;}
        .bud-g-marker{position:absolute;top:-2px;bottom:-2px;width:2px;background:rgba(255,255,255,.55);}
        .bud-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);}
        .bud-row:last-child{border-bottom:none;}
        .bud-cat{font-size:12.5px;font-weight:600;color:var(--text);flex:1;display:flex;align-items:center;gap:7px;}
        .bud-row-actual{font-size:10px;color:var(--text3);white-space:nowrap;}
        .bud-pyf{font-size:8px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--gold);background:rgba(240,180,41,.12);border:1px solid rgba(240,180,41,.3);padding:2px 6px;border-radius:6px;}
        .bud-inp{width:130px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2);padding:7px 10px;font-size:12.5px;font-weight:600;color:var(--text);outline:none;text-align:right;transition:border-color .15s;}
        .bud-inp:focus{border-color:var(--blue);}
        .bud-group{font-size:9.5px;font-weight:700;letter-spacing:.1em;color:var(--text3);margin:14px 0 6px;}.bud-group:first-child{margin-top:0;}
        .bud-erow{padding:10px 0;border-bottom:1px solid var(--border);}
        .bud-erow:last-child{border-bottom:none;}
        .bud-erow-top{display:flex;align-items:center;gap:10px;margin-bottom:7px;}
        .bud-bar{height:6px;background:var(--bg2);border-radius:4px;overflow:hidden;}
        .bud-bar-fill{height:100%;border-radius:4px;transition:width .3s;}
        .bud-erow-meta{display:flex;justify-content:space-between;font-size:10px;color:var(--text3);margin-top:5px;}
        .bud-erow-meta .good{color:var(--green);font-weight:600;}
        .bud-erow-meta .bad{color:var(--over);font-weight:600;}
        .bud-sav-note{font-size:10px;color:var(--text3);margin-top:10px;line-height:1.5;}
        .bud-tips{display:none;background:rgba(62,109,240,.06);border:1px solid rgba(62,109,240,.2);border-radius:var(--r);padding:14px 16px;margin-bottom:14px;font-size:12px;line-height:1.7;color:var(--text2);}
        .bud-tips b{color:var(--text);}
        .bud-tips ul{margin:6px 0 0;padding-left:18px;}
        @media(max-width:768px){
          .bud-cards{grid-template-columns:repeat(2,1fr);}
          .bud-inp{width:108px;}
        }
      `}</style>
      <div className="bud-wrap">
        <div className="bud-top">
          <div className="bud-mnav">
            <button onClick={() => budMonth(-1)} aria-label="Bulan sebelumnya">‹</button>
            <span id="bud-monthlabel">—</span>
            <button onClick={() => budMonth(1)} aria-label="Bulan berikutnya">›</button>
          </div>
          <div className="bud-act">
            <button onClick={() => budToggleTips()}>Teori</button>
            <button onClick={() => budCopyPrev()}>Salin bulan lalu</button>
          </div>
        </div>

        <div className="bud-tips" id="bud-tips">
          <b>Kaidah yang dipakai di halaman ini:</b>
          <ul>
            <li><b>Zero-based budgeting</b> — Pendapatan − Pengeluaran − Tabungan harus = 0. Setiap rupiah dikasih tugas, gak ada yang nganggur. Liat kartu "Belum Dialokasikan".</li>
            <li><b>50/30/20</b> — dari pendapatan: maks 50% Needs (kebutuhan), maks 30% Wants (keinginan), min 20% Savings. Liat gauge di bawah.</li>
            <li><b>Pay yourself first</b> — sisihin tabungan/investasi <i>duluan</i>, bukan dari sisa. Makanya barisnya ditandai khusus.</li>
          </ul>
        </div>

        <div className="bud-cards" id="bud-cards" />

        <div className="bud-panel" id="bud-gauge" />

        <div className="bud-panel">
          <div className="bud-sec-hd"><span>Pendapatan</span><span className="bud-sec-note">rencana pemasukan bulan ini</span></div>
          <div id="bud-income" />
        </div>

        <div className="bud-panel">
          <div className="bud-sec-hd"><span>Pengeluaran</span><span className="bud-sec-note">rencana vs realisasi per kategori</span></div>
          <div id="bud-expense" />
        </div>

        <div className="bud-panel">
          <div className="bud-sec-hd"><span>Tabungan & Investasi</span><span className="bud-sec-note">sisihin duluan</span></div>
          <div id="bud-savings" />
        </div>
      </div>
    </DashboardShell>
  )
}
