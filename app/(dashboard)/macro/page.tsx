'use client'

import { useEffect, useRef } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'

type Ind = { value: number | null; prev: number | null; spark: number[] }
type IndCfg = { key: string; label: string; up: 'good' | 'bad'; fmt: (v: number) => string; dfmt: (d: number) => string; desc: string }

const GREEN = '#34d399', RED = '#f6685e', NEU = '#687087'

const M_IND: IndCfg[] = [
  { key: 'netLiquidity', label: 'Fed Net Liquidity', up: 'good', fmt: v => '$' + v.toFixed(2) + 'T', dfmt: d => (d >= 0 ? '+' : '') + d.toFixed(2) + 'T', desc: 'WALCL − TGA − RRP. Naik = likuiditas ngalir ke risk asset.' },
  { key: 'm2', label: 'M2 Money Supply', up: 'good', fmt: v => '$' + (v / 1000).toFixed(2) + 'T', dfmt: d => (d >= 0 ? '+' : '') + (d / 1000).toFixed(2) + 'T', desc: 'Uang beredar. Sering lead BTC ~10–12 minggu.' },
  { key: 'dollar', label: 'US Dollar (Broad)', up: 'bad', fmt: v => v.toFixed(1), dfmt: d => (d >= 0 ? '+' : '') + d.toFixed(1), desc: 'Dollar kuat = headwind buat risk asset & crypto.' },
  { key: 'y10', label: '10Y Treasury Yield', up: 'bad', fmt: v => v.toFixed(2) + '%', dfmt: d => (d >= 0 ? '+' : '') + Math.round(d * 100) + 'bps', desc: 'Yield naik = cost of capital naik.' },
  { key: 'realYield', label: '10Y Real Yield', up: 'bad', fmt: v => v.toFixed(2) + '%', dfmt: d => (d >= 0 ? '+' : '') + Math.round(d * 100) + 'bps', desc: 'Real yield naik = tekanan buat gold & growth.' },
  { key: 'curve', label: 'Yield Curve 10Y−2Y', up: 'good', fmt: v => (v >= 0 ? '+' : '') + v.toFixed(2) + '%', dfmt: d => (d >= 0 ? '+' : '') + Math.round(d * 100) + 'bps', desc: 'Negatif = inverted (sinyal resesi klasik).' },
  { key: 'hySpread', label: 'HY Credit Spread', up: 'bad', fmt: v => v.toFixed(2) + '%', dfmt: d => (d >= 0 ? '+' : '') + Math.round(d * 100) + 'bps', desc: 'Melebar = stress kredit / risk-off.' },
  { key: 'vix', label: 'VIX', up: 'bad', fmt: v => v.toFixed(1), dfmt: d => (d >= 0 ? '+' : '') + d.toFixed(1), desc: '>22 = takut · <15 = tenang/komplasen.' },
  { key: 'nfci', label: 'Financial Conditions (NFCI)', up: 'bad', fmt: v => v.toFixed(2), dfmt: d => (d >= 0 ? '+' : '') + d.toFixed(2), desc: '>0 = ketat/restriktif · <0 = longgar.' },
]

async function api(path: string) {
  const r = await fetch(path)
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

function sparkSvg(vals: number[], color: string) {
  const w = 60, h = 24, n = vals.length
  if (n < 2) return ''
  const min = Math.min(...vals), max = Math.max(...vals), rng = (max - min) || 1
  const pts = vals.map((v, i) => `${(i / (n - 1) * w).toFixed(1)},${(h - 2 - ((v - min) / rng) * (h - 4)).toFixed(1)}`).join(' ')
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`
}

function indCard(cfg: IndCfg, data: Ind) {
  if (!data || data.value == null) return `<div class="m-card"><div class="m-label">${cfg.label}</div><div class="m-val">—</div><div class="m-desc">${cfg.desc}</div></div>`
  const v = data.value, prev = data.prev
  const delta = prev != null ? v - prev : null
  const rising = delta != null && delta >= 0
  const good = cfg.up === 'good' ? rising : !rising
  const col = delta == null ? NEU : good ? GREEN : RED
  return `<div class="m-card">
    <div class="m-card-top"><span class="m-label">${cfg.label}</span><span class="m-spark">${sparkSvg(data.spark || [], col)}</span></div>
    <div class="m-val">${cfg.fmt(v)}</div>
    <div class="m-delta" style="color:${col}">${delta == null ? '—' : (delta >= 0 ? '▲ ' : '▼ ') + cfg.dfmt(delta)}<span class="m-period">30 hari</span></div>
    <div class="m-desc">${cfg.desc}</div>
  </div>`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderMacro(d: any) {
  const banner = document.getElementById('macro-banner')
  const grid = document.getElementById('macro-grid')
  if (!d || d.error) {
    if (banner) banner.innerHTML = `<div class="m-err">${d?.error || 'Gagal memuat data makro.'} — pastikan FRED_API_KEY udah di-set di environment.</div>`
    if (grid) grid.innerHTML = ''
    return
  }
  const r = d.regime || {}
  const chip = (label: string, val: string, tone: string) => `<div class="m-chip ${tone}"><span class="m-chip-l">${label}</span><span class="m-chip-v">${val}</span></div>`
  const liqTone = r.liquidity === 'expanding' ? 'good' : r.liquidity === 'contracting' ? 'bad' : 'neu'
  const dolTone = r.dollar === 'tailwind' ? 'good' : r.dollar === 'headwind' ? 'bad' : 'neu'
  const curveTone = r.curve === 'inverted' ? 'bad' : 'neu'
  const riskTone = r.risk === 'risk-on' ? 'good' : r.risk === 'risk-off' ? 'bad' : 'neu'
  const liqTxt = r.liquidity === 'expanding' ? 'Ekspansi' : r.liquidity === 'contracting' ? 'Kontraksi' : 'Flat'
  const dolTxt = r.dollar === 'tailwind' ? 'Tailwind' : r.dollar === 'headwind' ? 'Headwind' : 'Flat'
  const riskTxt = r.risk === 'risk-on' ? 'Risk-On' : r.risk === 'risk-off' ? 'Risk-Off' : 'Netral'
  const verdict = r.risk === 'risk-on'
    ? 'Kondisi condong mendukung risk asset (crypto/saham growth). Tetap pantau pembalikan likuiditas & dollar.'
    : r.risk === 'risk-off'
      ? 'Kondisi menekan risk asset — likuiditas/credit/dollar lagi gak ramah. Defensif & jaga cash.'
      : 'Sinyal campur. Belum ada bias kuat — tunggu konfirmasi arah likuiditas & dollar.'
  if (banner) banner.innerHTML =
    `<div class="m-chips">${chip('Likuiditas', liqTxt, liqTone)}${chip('Dollar', dolTxt, dolTone)}${chip('Yield Curve', r.curve === 'inverted' ? 'Inverted' : 'Normal', curveTone)}${chip('Bias Risk', riskTxt, riskTone)}</div>
     <div class="m-verdict">${verdict}</div>`
  if (grid) grid.innerHTML = M_IND.map(c => indCard(c, d[c.key])).join('')
}

async function init() {
  try {
    const d = await api('/api/macro')
    renderMacro(d)
  } catch (e) {
    const banner = document.getElementById('macro-banner')
    if (banner) banner.innerHTML = `<div class="m-err">Gagal memuat data makro: ${(e as Error).message}</div>`
  }
}

export default function MacroPage() {
  const initRef = useRef(false)
  useEffect(() => { if (initRef.current) return; initRef.current = true; init() }, [])

  return (
    <DashboardShell title="The Macro">
      <style>{`
        :root{
          --bg:#0b0c10;--white:#15161c;--border:rgba(255,255,255,.08);
          --text:#eef0f5;--text2:#97a0b3;--text3:#687087;--text4:rgba(255,255,255,.14);
          --blue:#3e6df0;--green:#34d399;--loss:#f6685e;
          --sb:0 2px 8px rgba(0,0,0,.30),0 3px 11px rgba(62,109,240,.18);
        }
        .macro-wrap{max-width:1120px;margin:0 auto;padding:18px 16px 60px;}
        .macro-banner{background:var(--white);border:1px solid var(--border);border-radius:14px;box-shadow:var(--sb);padding:16px 18px;margin-bottom:16px;}
        .m-chips{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px;}
        .m-chip{display:flex;flex-direction:column;gap:2px;padding:9px 14px;border-radius:10px;border:1px solid var(--border);min-width:110px;}
        .m-chip.good{border-color:rgba(52,211,153,.4);background:rgba(52,211,153,.08);}
        .m-chip.bad{border-color:rgba(246,104,94,.4);background:rgba(246,104,94,.08);}
        .m-chip.neu{border-color:var(--border);}
        .m-chip-l{font-size:8.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);}
        .m-chip-v{font-size:15px;font-weight:700;color:var(--text);}
        .m-chip.good .m-chip-v{color:var(--green);}.m-chip.bad .m-chip-v{color:var(--loss);}
        .m-verdict{font-size:12.5px;color:var(--text2);line-height:1.6;border-top:1px solid var(--border);padding-top:11px;}
        .m-err{font-size:12px;color:var(--loss);line-height:1.6;}
        .macro-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(252px,1fr));gap:12px;}
        .m-card{background:var(--white);border:1px solid var(--border);border-radius:12px;box-shadow:var(--sb);padding:14px 16px;}
        .m-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:24px;}
        .m-label{font-size:9.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--text2);}
        .m-spark{flex-shrink:0;opacity:.95;}
        .m-val{font-size:23px;font-weight:700;color:var(--text);margin-top:8px;line-height:1.1;}
        .m-delta{font-size:11px;font-weight:700;margin-top:4px;display:flex;align-items:baseline;gap:6px;}
        .m-period{font-size:8px;font-weight:600;color:var(--text4);letter-spacing:.04em;text-transform:uppercase;}
        .m-desc{font-size:10px;color:var(--text3);line-height:1.55;margin-top:9px;}
        @media(max-width:768px){.macro-grid{grid-template-columns:1fr;}}
      `}</style>
      <div className="macro-wrap">
        <div className="macro-banner" id="macro-banner"><div className="m-err" style={{ color: 'var(--text3)' }}>Memuat data makro…</div></div>
        <div className="macro-grid" id="macro-grid"></div>
      </div>
    </DashboardShell>
  )
}
