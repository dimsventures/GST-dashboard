import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { unstable_cache } from 'next/cache'
import { getAuthContext } from '@/lib/auth'
import { getMacroData } from '@/lib/macro-data'

// Narasi makro = data GLOBAL (sama buat semua user). Pola "generate once, serve many":
// generate 1x/hari, di-cache di Next Data Cache (shared antar semua user), bukan per-user.

const SYSTEM_PROMPT = `Kamu analis makro top-down buat dashboard investasi pribadi. Dari ringkasan indikator di bawah, tulis narasi singkat bahasa Indonesia informal (gua/lu), ~180-220 kata, struktur:
1. Regime sekarang (risk-on/off/netral) + 1-2 kalimat kenapa.
2. 2-3 indikator paling menonjol minggu ini (yang gerak/ekstrem) + artinya.
3. Implikasi praktis buat investor: ini BIAS, bukan sinyal pasti. Jujur soal ketidakpastian.
Jangan pakai heading/bullet, tulis mengalir per paragraf. Jangan basa-basi pembuka.`

type Packed = { value: number | null; prev: number | null }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function summarize(d: any): string {
  const r = d.regime || {}
  const rows: [string, string][] = [
    ['Fed Net Liquidity', '$T'], ['M2 Money Supply', ''], ['DXY (Dollar)', ''],
    ['10Y Yield', '%'], ['10Y Real Yield', '%'], ['Yield Curve 10Y-2Y', '%'],
    ['HY Credit Spread', '%'], ['VIX', ''], ['Financial Conditions (NFCI)', ''],
    ['Fed Funds Rate', '%'], ['CPI YoY', '%'], ['Core CPI YoY', '%'],
    ['Unemployment', '%'], ['Nonfarm Payrolls', 'K'],
  ]
  const keys = ['netLiquidity', 'm2', 'dollar', 'y10', 'realYield', 'curve', 'hySpread', 'vix', 'nfci', 'fedRate', 'cpi', 'coreCpi', 'unemployment', 'nfp']
  const lines = keys.map((k, i) => {
    const p: Packed = d[k]
    if (!p || p.value == null) return null
    const arah = p.prev == null ? '' : p.value > p.prev ? ' (naik)' : p.value < p.prev ? ' (turun)' : ' (flat)'
    return `- ${rows[i][0]}: ${p.value.toFixed(2)}${rows[i][1]}${arah}`
  }).filter(Boolean)
  return `REGIME ENGINE: risk=${r.risk} (skor ${r.score}), likuiditas=${r.liquidity}, dollar=${r.dollar}, curve=${r.curve}\n\nINDIKATOR:\n${lines.join('\n')}`
}

// keyed by tanggal → tiap hari baru regenerate sekali, sisanya cache hit (gak manggil Claude)
const getNarrative = (dateKey: string) => unstable_cache(
  async () => {
    const d = await getMacroData()

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 700,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: summarize(d) }],
    })
    const text = resp.content.filter(b => b.type === 'text').map(b => b.type === 'text' ? b.text : '').join('').trim()
    return { narrative: text, regime: d.regime, generatedAt: new Date().toISOString() }
  },
  ['macro-narrative', dateKey],
  { revalidate: 86400, tags: ['macro-narrative'] },
)()

export async function GET(req: Request) {
  if (!getAuthContext(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY belum di-set.' }, { status: 503 })
  try {
    const dateKey = new Date().toISOString().slice(0, 10)
    return NextResponse.json(await getNarrative(dateKey))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
