import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { unstable_cache } from 'next/cache'
import { getAuthContext } from '@/lib/auth'

export const maxDuration = 60

// RSS feed = cara legit & stabil (bukan HTML scrape). Ringkas + link sumber, bukan republish full.
const FEEDS: { url: string; topic: string }[] = [
  { url: 'https://venturebeat.com/category/ai/feed/', topic: 'AI' },
  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', topic: 'AI' },
  { url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', topic: 'AI' },
  { url: 'https://www.artificialintelligence-news.com/feed/', topic: 'AI' },
  { url: 'https://www.federalreserve.gov/feeds/press_all.xml', topic: 'Macro' },
  { url: 'https://finance.yahoo.com/news/rssindex', topic: 'Macro' },
  { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', topic: 'Macro' },
  { url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html', topic: 'Macro' },
  { url: 'https://cointelegraph.com/rss', topic: 'Macro' },
  { url: 'https://awealthofcommonsense.com/feed/', topic: 'Behavioral' },
  { url: 'https://www.collaborativefund.com/blog/feed/', topic: 'Behavioral' },
  { url: 'https://fs.blog/feed/', topic: 'Behavioral' },
  { url: 'https://behavioralscientist.org/feed/', topic: 'Behavioral' },
]

type Article = { title: string; link: string; desc: string; pubDate: string; source: string; topic: string }

function decode(s: string) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').trim()
}
function domain(url: string) { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' } }

async function fetchFeed(f: { url: string; topic: string }): Promise<Article[]> {
  try {
    const r = await fetch(f.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 1800 } })
    if (!r.ok) return []
    const xml = await r.text()
    const out: Article[] = []
    for (const m of xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)) {
      const item = m[1]
      const title = decode((item.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || '')
      const link = decode((item.match(/<link[^>]*>([\s\S]*?)<\/link>/) || [])[1] || '')
      const desc = decode((item.match(/<description[^>]*>([\s\S]*?)<\/description>/) || [])[1] || '').slice(0, 360)
      const pubDate = ((item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/) || [])[1] || '').trim()
      if (title) out.push({ title, link, desc, pubDate, source: domain(link || f.url), topic: f.topic })
    }
    return out
  } catch { return [] }
}

// Slot WIB (UTC+7) → 3 jendela: pagi / siang / malam, di-cache per slot
function currentSlot() {
  const now = new Date()
  const wibH = (now.getUTCHours() + 7) % 24
  const wibMs = now.getTime() + 7 * 3600000
  const date = new Date(wibMs).toISOString().slice(0, 10)
  const win = wibH < 12 ? 'pagi' : wibH < 18 ? 'siang' : 'malam'
  return `${date}-${win}`
}

const SYSTEM = `Kamu analis berita buat investor Indonesia yang fokus tiga hal: AI, ekonomi makro & investasi, dan behavioral finance. Dari daftar artikel kandidat (tiap artikel punya index [n]), pilih 4 yang PALING urgent & berdampak signifikan. Balas HANYA JSON valid (tanpa markdown fence), format:
{"picks":[{"i":<index artikel>,"summary":"ringkasan 1-2 kalimat Bahasa Indonesia, naratif","tag":"AI|Macro|Behavioral"}],"interpretation":"2-3 paragraf Bahasa Indonesia informal (gua/lu): benang merah ke-4 berita dan artinya buat investor. Ini bias/konteks, bukan ajakan beli/jual. Jujur soal ketidakpastian."}`

const getNews = (slot: string) => unstable_cache(
  async () => {
    const all = (await Promise.all(FEEDS.map(fetchFeed))).flat()
    // dedupe by title, ambil terbaru
    const seen = new Set<string>()
    const uniq: Article[] = []
    for (const a of all.sort((x, y) => new Date(y.pubDate).getTime() - new Date(x.pubDate).getTime())) {
      const k = a.title.toLowerCase().trim()
      if (seen.has(k) || !a.title) continue
      seen.add(k); uniq.push(a)
      if (uniq.length >= 28) break
    }
    if (!uniq.length) return { items: [], interpretation: 'Belum ada berita yang bisa ditarik dari sumber saat ini. Coba lagi nanti.', generatedAt: new Date().toISOString() }

    const candidates = uniq.map((a, i) => `[${i}] (${a.topic}) ${a.title} — ${a.desc} (sumber: ${a.source})`).join('\n')
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1600,
      system: SYSTEM,
      messages: [{ role: 'user', content: candidates }],
    })
    const raw = resp.content.filter(b => b.type === 'text').map(b => b.type === 'text' ? b.text : '').join('').trim()
    const json = raw.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '').trim()
    let parsed: { picks?: { i: number; summary: string; tag: string }[]; interpretation?: string } = {}
    try { parsed = JSON.parse(json) } catch { parsed = { interpretation: raw } }

    const items = (parsed.picks || []).map(p => {
      const a = uniq[p.i]
      if (!a) return null
      return { title: a.title, summary: p.summary, tag: p.tag || a.topic, source: a.source, url: a.link, date: a.pubDate }
    }).filter(Boolean).slice(0, 4)

    return { items, interpretation: parsed.interpretation || raw, generatedAt: new Date().toISOString() }
  },
  ['news', slot],
  { revalidate: 6 * 3600, tags: ['news'] },
)()

export async function GET(req: Request) {
  if (!getAuthContext(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY belum di-set.' }, { status: 503 })
  try {
    return NextResponse.json(await getNews(currentSlot()))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
