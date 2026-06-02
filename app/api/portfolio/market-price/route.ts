import { NextResponse } from 'next/server'

interface ChartMeta {
  symbol: string
  regularMarketPrice: number
  chartPreviousClose: number
  currency: string | null
  shortName: string
  longName?: string
  regularMarketDayHigh: number
  regularMarketDayLow: number
  regularMarketVolume: number
  fiftyTwoWeekHigh: number
  fiftyTwoWeekLow: number
  marketState?: string
}

interface MarketPriceResult {
  symbol: string
  ticker: string
  price: number
  change: number
  changePercent: number
  previousClose: number
  dayHigh: number
  dayLow: number
  volume: number
  week52High: number
  week52Low: number
  currency: string
  name: string
}

async function fetchOneChart(symbol: string): Promise<MarketPriceResult | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
  if (!res.ok) return null
  const json = await res.json()
  const meta: ChartMeta | undefined = json?.chart?.result?.[0]?.meta
  if (!meta) return null

  const change = meta.regularMarketPrice - meta.chartPreviousClose
  const changePercent = meta.chartPreviousClose > 0
    ? (change / meta.chartPreviousClose) * 100
    : 0

  return {
    symbol: meta.symbol,
    ticker: meta.symbol.replace('.JK', '').replace(/-USD$/, ''),
    price: meta.regularMarketPrice,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    previousClose: meta.chartPreviousClose,
    dayHigh: meta.regularMarketDayHigh,
    dayLow: meta.regularMarketDayLow,
    volume: meta.regularMarketVolume,
    week52High: meta.fiftyTwoWeekHigh,
    week52Low: meta.fiftyTwoWeekLow,
    currency: meta.currency || 'IDR',
    name: meta.longName || meta.shortName,
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const tickers = url.searchParams.get('tickers')

  if (!tickers) {
    return NextResponse.json(
      { error: 'tickers parameter required (comma-separated, e.g. MDKA.JK,BBCA.JK)' },
      { status: 400 }
    )
  }

  const symbols = tickers.split(',').map(s => s.trim()).filter(Boolean)
  if (symbols.length === 0) {
    return NextResponse.json({ error: 'no valid tickers provided' }, { status: 400 })
  }
  if (symbols.length > 20) {
    return NextResponse.json({ error: 'max 20 tickers per request' }, { status: 400 })
  }

  try {
    const results = await Promise.all(symbols.map(fetchOneChart))

    const prices = results.filter((r): r is MarketPriceResult => r !== null)
    const notFound = symbols.filter(s => !prices.some(p => p.symbol === s))

    return NextResponse.json({
      prices,
      ...(notFound.length > 0 && { notFound }),
      fetchedAt: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to fetch market prices', detail: message }, { status: 500 })
  }
}
