import { NextResponse } from 'next/server'

const BENCHMARKS = [
  { key: 'ihsg', symbol: '^JKSE',   label: 'IHSG' },
  { key: 'btc',  symbol: 'BTC-USD', label: 'BTC'  },
  { key: 'gold', symbol: 'GC=F',    label: 'Gold' },
]

async function fetchMonthly(symbol: string, range: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1mo&range=${range}`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 3600 } })
  if (!res.ok) return []
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) return []
  const timestamps: number[] = result.timestamp || []
  const closes: number[] =
    result.indicators?.adjclose?.[0]?.adjclose ||
    result.indicators?.quote?.[0]?.close || []
  return timestamps
    .map((ts, i) => ({ month: new Date(ts * 1000).toISOString().slice(0, 7), price: closes[i] ?? null }))
    .filter(d => d.price != null)
}

export async function GET(req: Request) {
  const range = new URL(req.url).searchParams.get('range') || '5y'
  try {
    const results = await Promise.all(
      BENCHMARKS.map(async b => ({ ...b, data: await fetchMonthly(b.symbol, range) }))
    )
    return NextResponse.json({ benchmarks: results })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
