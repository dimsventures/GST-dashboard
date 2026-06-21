import { NextResponse } from 'next/server'

export const revalidate = 1800 // 30 menit — data makro gerak lambat

const KEY = process.env.FRED_API_KEY

type Obs = { date: string; value: number }
type Ind = { value: number | null; prev: number | null; spark: number[] }

async function fred(seriesId: string, limit = 600): Promise<Obs[]> {
  if (!KEY) return []
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${KEY}&file_type=json&sort_order=desc&limit=${limit}`
    const r = await fetch(url, { next: { revalidate: 1800 } })
    if (!r.ok) return []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const j: any = await r.json()
    return (j.observations || [])
      .map((o: { date: string; value: string }) => ({ date: o.date, value: parseFloat(o.value) }))
      .filter((o: Obs) => !isNaN(o.value)) // newest first (sort desc)
  } catch { return [] }
}

function latest(obs: Obs[]) { return obs[0]?.value ?? null }
function ago(obs: Obs[], days: number) {
  if (!obs.length) return null
  const t = new Date(obs[0].date); t.setDate(t.getDate() - days)
  const key = t.toISOString().slice(0, 10)
  return (obs.find(o => o.date <= key)?.value) ?? obs[obs.length - 1].value
}
function spark(obs: Obs[], n: number) { return obs.slice(0, n).map(o => o.value).reverse() }
function ind(obs: Obs[], days = 30, n = 30): Ind { return { value: latest(obs), prev: ago(obs, days), spark: spark(obs, n) } }

function onOrBefore(obs: Obs[], date: string) { return obs.find(o => o.date <= date)?.value ?? null }
// Net Liquidity (trillions) = WALCL − TGA − RRP. WALCL/TGA dalam juta $, RRP dalam miliar $.
function buildNetLiq(walcl: Obs[], tga: Obs[], rrp: Obs[]): Obs[] {
  return walcl.map(w => {
    const t = onOrBefore(tga, w.date) ?? 0
    const r = onOrBefore(rrp, w.date) ?? 0
    return { date: w.date, value: w.value / 1e6 - t / 1e6 - r / 1e3 }
  })
}

export async function GET() {
  if (!KEY) return NextResponse.json({ error: 'FRED_API_KEY belum di-set di environment.' }, { status: 500 })

  const [walcl, tga, rrp, m2, dollar, dgs10, dfii10, curve, hy, vix, nfci] = await Promise.all([
    fred('WALCL'), fred('WTREGEN'), fred('RRPONTSYD'), fred('WM2NS'),
    fred('DTWEXBGS'), fred('DGS10'), fred('DFII10'), fred('T10Y2Y'),
    fred('BAMLH0A0HYM2'), fred('VIXCLS'), fred('NFCI'),
  ])

  const netLiq = buildNetLiq(walcl, tga, rrp)
  const out = {
    netLiquidity: { value: latest(netLiq), prev: ago(netLiq, 30), spark: spark(netLiq, 26) },
    m2: ind(m2, 30, 26),
    dollar: ind(dollar),
    y10: ind(dgs10),
    realYield: ind(dfii10),
    curve: ind(curve),
    hySpread: ind(hy),
    vix: ind(vix),
    nfci: ind(nfci, 30, 26),
  }

  const dir = (a: number | null, b: number | null) => (a == null || b == null) ? 0 : Math.sign(a - b)
  const liqDir = dir(out.netLiquidity.value, out.netLiquidity.prev)
  const dollarDir = dir(out.dollar.value, out.dollar.prev)
  const hyDir = dir(out.hySpread.value, out.hySpread.prev)
  const realDir = dir(out.realYield.value, out.realYield.prev)

  let score = 0
  score += liqDir > 0 ? 1 : liqDir < 0 ? -1 : 0          // likuiditas naik = risk-on
  score += dollarDir > 0 ? -1 : dollarDir < 0 ? 1 : 0     // dollar naik = risk-off
  score += hyDir > 0 ? -1 : hyDir < 0 ? 1 : 0             // spread melebar = risk-off
  score += realDir > 0 ? -1 : realDir < 0 ? 1 : 0         // real yield naik = risk-off
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
