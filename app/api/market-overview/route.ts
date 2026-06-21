import { NextResponse } from 'next/server'

export const revalidate = 300 // cache 5 menit, hindari rate-limit sumber eksternal

type Item = {
  key: string
  label: string
  sub?: string
  value: string
  changePct: number | null
  period: '7d' | '24h'
  spark: number[] | null
}

const RV = { next: { revalidate: 300 } } as const

// ── Yahoo Finance: harga + sparkline 7 hari + % change 7d ──
async function yahoo7d(symbol: string): Promise<{ price: number; spark: number[]; changePct: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1mo`
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, ...RV })
    if (!r.ok) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const j: any = await r.json()
    const res = j?.chart?.result?.[0]
    const closes: number[] = (res?.indicators?.quote?.[0]?.close || []).filter((x: number | null) => x != null)
    const price: number = res?.meta?.regularMarketPrice ?? closes[closes.length - 1]
    if (!closes.length || price == null) return null
    const window = closes.slice(-7)
    const spark = [...window.slice(0, -1), price]
    const base = window[0]
    const changePct = base ? ((price - base) / base) * 100 : 0
    return { price, spark, changePct }
  } catch { return null }
}

// ── Fear & Greed (crypto) dari alternative.me ──
async function fng(): Promise<{ value: number; label: string; spark: number[]; changePct: number } | null> {
  try {
    const r = await fetch('https://api.alternative.me/fng/?limit=8&format=json', RV)
    if (!r.ok) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const j: any = await r.json()
    const data: Array<{ value: string; value_classification: string }> = j?.data || []
    if (!data.length) return null
    const vals = data.map(d => Number(d.value)).reverse() // oldest -> newest
    const now = vals[vals.length - 1]
    const base = vals[0]
    const changePct = base ? ((now - base) / base) * 100 : 0
    return { value: now, label: data[0].value_classification, spark: vals, changePct }
  } catch { return null }
}

// ── CoinGecko: total mcap, BTC dominance, stablecoin dominance (+ perubahan 24h) ──
async function coingecko() {
  try {
    const [gR, mR] = await Promise.all([
      fetch('https://api.coingecko.com/api/v3/global', RV),
      fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,tether,usd-coin', RV),
    ])
    if (!gR.ok) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g: any = (await gR.json())?.data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const markets: any[] = mR.ok ? await mR.json() : []
    const totalMcap: number = g?.total_market_cap?.usd
    const totalChg: number | null = g?.market_cap_change_percentage_24h_usd ?? null
    const pct = g?.market_cap_percentage || {}
    const btcDom: number = pct.btc
    const stableDom: number = (pct.usdt || 0) + (pct.usdc || 0) + (pct.dai || 0) + (pct.busd || 0)

    const byId: Record<string, { mc: number; chg: number }> = {}
    markets.forEach(m => { byId[m.id] = { mc: m.market_cap, chg: m.market_cap_change_percentage_24h || 0 } })
    const totalPrev = totalChg != null && totalMcap ? totalMcap / (1 + totalChg / 100) : totalMcap

    function domChange(curMc: number, prevMc: number): number | null {
      if (!totalMcap || !totalPrev || !curMc) return null
      const domNow = curMc / totalMcap
      const domPrev = prevMc / totalPrev
      return domPrev ? ((domNow - domPrev) / domPrev) * 100 : null
    }

    let btcDomChg: number | null = null
    if (byId.bitcoin) btcDomChg = domChange(byId.bitcoin.mc, byId.bitcoin.mc / (1 + byId.bitcoin.chg / 100))

    const stableMc = (byId.tether?.mc || 0) + (byId['usd-coin']?.mc || 0)
    const stablePrev = (byId.tether ? byId.tether.mc / (1 + byId.tether.chg / 100) : 0)
      + (byId['usd-coin'] ? byId['usd-coin'].mc / (1 + byId['usd-coin'].chg / 100) : 0)
    const stableDomChg = stableMc ? domChange(stableMc, stablePrev) : null

    return { totalMcap, totalChg, btcDom, btcDomChg, stableDom, stableDomChg }
  } catch { return null }
}

function usd(n: number, dec = 2) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

export async function GET() {
  const [dxy, spx, gold, btc, fg, cg] = await Promise.all([
    yahoo7d('DX-Y.NYB'),
    yahoo7d('^GSPC'),
    yahoo7d('GC=F'),
    yahoo7d('BTC-USD'),
    fng(),
    coingecko(),
  ])

  const items: Item[] = []

  items.push({
    key: 'dxy', label: 'DXY', period: '7d',
    value: dxy ? dxy.price.toFixed(2) : '—',
    changePct: dxy ? dxy.changePct : null, spark: dxy ? dxy.spark : null,
  })
  items.push({
    key: 'spx', label: 'SPX', period: '7d',
    value: spx ? spx.price.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—',
    changePct: spx ? spx.changePct : null, spark: spx ? spx.spark : null,
  })
  items.push({
    key: 'gold', label: 'Gold', period: '7d',
    value: gold ? usd(gold.price, 1) : '—',
    changePct: gold ? gold.changePct : null, spark: gold ? gold.spark : null,
  })
  items.push({
    key: 'btc', label: 'BTC', period: '7d',
    value: btc ? usd(btc.price, 0) : '—',
    changePct: btc ? btc.changePct : null, spark: btc ? btc.spark : null,
  })
  items.push({
    key: 'mcap', label: 'Total Mcap', period: '24h',
    value: cg?.totalMcap ? '$' + (cg.totalMcap / 1e12).toFixed(2) + 'T' : '—',
    changePct: cg?.totalChg ?? null, spark: null,
  })
  items.push({
    key: 'fng', label: 'Fear & Greed', sub: fg?.label, period: '7d',
    value: fg ? String(fg.value) : '—',
    changePct: fg ? fg.changePct : null, spark: fg ? fg.spark : null,
  })
  items.push({
    key: 'btcdom', label: 'BTC Dom', period: '24h',
    value: cg?.btcDom != null ? cg.btcDom.toFixed(1) + '%' : '—',
    changePct: cg?.btcDomChg ?? null, spark: null,
  })
  items.push({
    key: 'stabledom', label: 'USD Dom', sub: 'stablecoin', period: '24h',
    value: cg?.stableDom != null ? cg.stableDom.toFixed(1) + '%' : '—',
    changePct: cg?.stableDomChg ?? null, spark: null,
  })

  return NextResponse.json({ items, fetchedAt: new Date().toISOString() })
}
