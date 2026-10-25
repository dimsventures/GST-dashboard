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
  yahooSymbol?: string
}

interface SearchQuote {
  symbol: string
  quoteType?: string
  shortname?: string
  longname?: string
}

// Yahoo kadang pakai simbol internal berakhiran angka utk crypto baru,
// contoh: PEPE -> PEPE24478-USD, SUI -> SUI20947-USD.
// Fallback: cari simbol crypto asli lewat Yahoo Search API.
async function resolveCryptoSymbol(base: string): Promise<string | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(base)}&quotesCount=20&newsCount=0`
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!res.ok) return null
    const json = await res.json()
    const quotes: SearchQuote[] = json?.quotes || []
    const exact = quotes.find(q => q.symbol === `${base.toUpperCase()}-USD` && q.quoteType === 'CRYPTOCURRENCY')
    if (exact) return exact.symbol
    const alt = quotes.find(
      q => q.quoteType === 'CRYPTOCURRENCY' && new RegExp(`^${base}\\d*-USD$`, 'i').test(q.symbol)
    )
    return alt?.symbol ?? null
  } catch {
    return null
  }
}

async function fetchOneChart(symbol: string, yahooSymbol?: string): Promise<MarketPriceResult | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol || symbol)}?interval=1d&range=1d`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
  if (!res.ok) {
    // Fallback utk crypto: resolve simbol internal Yahoo (mis. PEPE24478-USD)
    if (yahooSymbol || !/-USD$/i.test(symbol)) return null
    const base = symbol.replace(/-USD$/i, '')
    const resolved = await resolveCryptoSymbol(base)
    if (!resolved) return null
    return fetchOneChart(symbol, resolved)
  }
  const json = await res.json()
  const meta: ChartMeta | undefined = json?.chart?.result?.[0]?.meta
  if (!meta) {
    if (yahooSymbol || !/-USD$/i.test(symbol)) return null
    const base = symbol.replace(/-USD$/i, '')
    const resolved = await resolveCryptoSymbol(base)
    if (!resolved) return null
    return fetchOneChart(symbol, resolved)
  }

  const change = meta.regularMarketPrice - meta.chartPreviousClose
  const changePercent = meta.chartPreviousClose > 0
    ? (change / meta.chartPreviousClose) * 100
    : 0

  // `symbol` & `ticker` harus tetap pakai simbol yang DIMINTA (bukan simbol internal Yahoo),
  // karena client me-map harga berdasarkan ticker yang user input (mis. "PEPE").
  return {
    symbol,
    ticker: symbol.replace('.JK', '').replace(/-USD$/i, ''),
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
    ...(yahooSymbol && yahooSymbol !== symbol && { yahooSymbol }),
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
    const results = await Promise.all(symbols.map(s => fetchOneChart(s)))

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
