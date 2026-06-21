import { NextResponse } from 'next/server'

export const revalidate = 1800 // 30 menit

const KEY = process.env.FRED_API_KEY

type Obs = { date: string; value: number }
type Pt = { d: string; v: number }
type Packed = { value: number | null; prev: number | null; series: Pt[] }

async function fred(seriesId: string, limit = 6000): Promise<Obs[]> {
  if (!KEY) return []
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${KEY}&file_type=json&sort_order=desc&limit=${limit}`
    const r = await fetch(url, { next: { revalidate: 1800 } })
    if (!r.ok) return []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const j: any = await r.json()
    return (j.observations || [])
      .map((o: { date: string; value: string }) => ({ date: o.date, value: parseFloat(o.value) }))
      .filter((o: Obs) => !isNaN(o.value)) // newest first
  } catch { return [] }
}

// DXY/BTC/SPX via Yahoo, dikembalikan desc (newest first) biar sama pola dgn FRED
async function yahooDaily(symbol: string, range = 'max'): Promise<Obs[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 1800 } })
    if (!r.ok) return []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const j: any = await r.json()
    const res = j?.chart?.result?.[0]
    const ts: number[] = res?.timestamp || []
    const closes: (number | null)[] = res?.indicators?.quote?.[0]?.close || []
    const out: Obs[] = []
    for (let i = 0; i < ts.length; i++) {
      if (closes[i] == null) continue
      out.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), value: closes[i] as number })
    }
    return out.reverse() // desc
  } catch { return [] }
}

function latest(obs: Obs[]) { return obs[0]?.value ?? null }
function ago(obs: Obs[], days: number) {
  if (!obs.length) return null
  const t = new Date(obs[0].date); t.setDate(t.getDate() - days)
  const key = t.toISOString().slice(0, 10)
  return (obs.find(o => o.date <= key)?.value) ?? obs[obs.length - 1].value
}
function series(obs: Obs[], years = 14): Pt[] {
  const c = new Date(); c.setFullYear(c.getFullYear() - years)
  const cut = c.toISOString().slice(0, 10)
  return obs.filter(o => o.date >= cut).map(o => ({ d: o.date, v: o.value })).reverse() // oldest -> newest
}
function pack(obs: Obs[], days = 30): Packed { return { value: latest(obs), prev: ago(obs, days), series: series(obs) } }

// transform YoY% dari index bulanan (desc): tiap titik vs ~12 bulan lebih lama
function yoy(obs: Obs[]): Obs[] {
  const out: Obs[] = []
  for (let i = 0; i < obs.length; i++) {
    const p = obs[i + 12]
    if (p && p.value) out.push({ date: obs[i].date, value: (obs[i].value - p.value) / p.value * 100 })
  }
  return out
}
// MoM change (NFP level -> perubahan bulan)
function mom(obs: Obs[]): Obs[] {
  const out: Obs[] = []
  for (let i = 0; i < obs.length - 1; i++) out.push({ date: obs[i].date, value: obs[i].value - obs[i + 1].value })
  return out
}
function onOrBefore(obs: Obs[], date: string) { return obs.find(o => o.date <= date)?.value ?? null }
function buildNetLiq(walcl: Obs[], tga: Obs[], rrp: Obs[]): Obs[] {
  return walcl.map(w => ({ date: w.date, value: w.value / 1e6 - (onOrBefore(tga, w.date) ?? 0) / 1e6 - (onOrBefore(rrp, w.date) ?? 0) / 1e3 }))
}

export async function GET() {
  if (!KEY) return NextResponse.json({ error: 'FRED_API_KEY belum di-set di environment.' }, { status: 500 })

  const [
    walcl, tga, rrp, m2, dgs10, dfii10, curve, hy, vix, nfci,
    fedRate, cpiIdx, coreCpiIdx, ppiIdx, philly, payems, unrate, retailIdx, dxy, btc, spx,
  ] = await Promise.all([
    fred('WALCL'), fred('WTREGEN'), fred('RRPONTSYD'), fred('WM2NS'),
    fred('DGS10'), fred('DFII10'), fred('T10Y2Y'), fred('BAMLH0A0HYM2'), fred('VIXCLS'), fred('NFCI'),
    fred('FEDFUNDS'), fred('CPIAUCSL'), fred('CPILFESL'), fred('PPIFIS'),
    fred('GACDISA066MSFRBPHI'), fred('PAYEMS'), fred('UNRATE'), fred('RSAFS'),
    yahooDaily('DX-Y.NYB'), yahooDaily('BTC-USD'), yahooDaily('^GSPC'),
  ])

  const netLiq = buildNetLiq(walcl, tga, rrp)
  const out = {
    // Lapis 1 — engine
    netLiquidity: pack(netLiq),
    m2: pack(m2),
    dollar: pack(dxy),
    y10: pack(dgs10),
    realYield: pack(dfii10),
    curve: pack(curve),
    hySpread: pack(hy),
    vix: pack(vix),
    nfci: pack(nfci),
    // Lapis 2 — policy & inflasi
    fedRate: pack(fedRate),
    cpi: pack(yoy(cpiIdx)),
    coreCpi: pack(yoy(coreCpiIdx)),
    ppi: pack(yoy(ppiIdx)),
    // Lapis 3 — backdrop
    philly: pack(philly),
    nfp: pack(mom(payems)),
    unemployment: pack(unrate),
    retail: pack(yoy(retailIdx)),
    // Aset referensi — overlay validasi di tab Combined, bukan bagian skor
    btcusd: pack(btc),
    spx: pack(spx),
  }

  const dir = (a: number | null, b: number | null) => (a == null || b == null) ? 0 : Math.sign(a - b)
  const liqDir = dir(out.netLiquidity.value, out.netLiquidity.prev)
  const dollarDir = dir(out.dollar.value, out.dollar.prev)
  const hyDir = dir(out.hySpread.value, out.hySpread.prev)
  const realDir = dir(out.realYield.value, out.realYield.prev)

  let score = 0
  score += liqDir > 0 ? 1 : liqDir < 0 ? -1 : 0
  score += dollarDir > 0 ? -1 : dollarDir < 0 ? 1 : 0
  score += hyDir > 0 ? -1 : hyDir < 0 ? 1 : 0
  score += realDir > 0 ? -1 : realDir < 0 ? 1 : 0
  if ((out.vix.value ?? 0) > 22) score -= 1; else if ((out.vix.value ?? 99) < 15) score += 1
  if ((out.nfci.value ?? 0) > 0) score -= 1; else score += 1

  const risk = score >= 2 ? 'risk-on' : score <= -2 ? 'risk-off' : 'neutral'

  return NextResponse.json({
    ...out,
    regime: {
      liquidity: liqDir > 0 ? 'expanding' : liqDir < 0 ? 'contracting' : 'flat',
      dollar: dollarDir > 0 ? 'headwind' : dollarDir < 0 ? 'tailwind' : 'flat',
      curve: (out.curve.value ?? 0) < 0 ? 'inverted' : 'normal',
      risk, score,
    },
    fetchedAt: new Date().toISOString(),
  })
}
