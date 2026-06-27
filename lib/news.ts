import Anthropic from '@anthropic-ai/sdk'
import { unstable_cache } from 'next/cache'

// RSS = cara legit & stabil (bukan HTML scrape). Ringkas + link sumber, bukan republish full.
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

export type Article = { title: string; link: string; desc: string; pubDate: string; source: string; topic: string }
export type NewsItem = { title: string; summary: string; tag: string; source: string; url: string }
export type NewsGroup = { topic: string; label: string; items: NewsItem[] }
export type NewsDigest = { groups: NewsGroup[]; interpretation: string; generatedAt: string }

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
export function currentSlot() {
  const now = new Date()
  const wibH = (now.getUTCHours() + 7) % 24
  const date = new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10)
  const win = wibH < 12 ? 'pagi' : wibH < 18 ? 'siang' : 'malam'
  return `${date}-${win}`
}

const SYSTEM = `Kamu analis berita buat investor Indonesia. Artikel kandidat dikelompokin jadi 3 kategori (tiap artikel punya index [n]):
1) Makro / Investment / Ekonomi / Trading, 2) AI & Tech, 3) Behavioral Finance.
Dari TIAP kategori, pilih maksimal 4 artikel yang PALING urgent & berdampak. Kalau di satu kategori artikelnya kurang dari 4, pilih seadanya. Balas HANYA JSON valid (tanpa markdown fence), format:
{"groups":{"Macro":[{"i":<index>,"summary":"ringkasan 1-2 kalimat Bahasa Indonesia, naratif"}],"AI":[...],"Behavioral":[...]},"interpretation":"3-4 paragraf Bahasa Indonesia informal (gua/lu): (a) benang merah tiap kategori, (b) artinya buat investor, (c) SARAN KONKRET yang bisa dicoba buat ngikutin/manfaatin perkembangan berita ini. Ini bias/konteks, bukan ajakan beli-jual. Jujur soal ketidakpastian."}`

const TOPIC_LABEL: Record<string, string> = { Macro: 'Makro · Investment · Ekonomi · Trading', AI: 'AI & Tech', Behavioral: 'Behavioral Finance' }

export const getNewsDigest = (slot: string): Promise<NewsDigest> => unstable_cache(
  async (): Promise<NewsDigest> => {
    const all = (await Promise.all(FEEDS.map(fetchFeed))).flat()
    const seen = new Set<string>()
    const byTopic: Record<string, Article[]> = { Macro: [], AI: [], Behavioral: [] }
    for (const a of all.sort((x, y) => new Date(y.pubDate).getTime() - new Date(x.pubDate).getTime())) {
      const k = a.title.toLowerCase().trim()
      if (!a.title || seen.has(k)) continue
      seen.add(k)
      const arr = byTopic[a.topic]; if (arr && arr.length < 10) arr.push(a)
    }
    const ORDER: [string, string][] = [['Macro', 'MAKRO / INVESTMENT / EKONOMI / TRADING'], ['AI', 'AI & TECH'], ['Behavioral', 'BEHAVIORAL FINANCE']]
    const pool: Article[] = []
    let text = ''
    for (const [t, label] of ORDER) {
      text += `\n=== ${label} ===\n`
      const arts = byTopic[t] || []
      if (!arts.length) { text += '(tidak ada artikel)\n'; continue }
      for (const a of arts) { pool.push(a); text += `[${pool.length - 1}] ${a.title} — ${a.desc} (sumber: ${a.source})\n` }
    }
    if (!pool.length) return { groups: [], interpretation: 'Belum ada berita yang bisa ditarik dari sumber saat ini. Coba lagi nanti.', generatedAt: new Date().toISOString() }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: 'user', content: text }],
    })
    const raw = resp.content.filter(b => b.type === 'text').map(b => b.type === 'text' ? b.text : '').join('').trim()
    const json = raw.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '').trim()
    let parsed: { groups?: Record<string, { i: number; summary: string }[]>; interpretation?: string } = {}
    try { parsed = JSON.parse(json) } catch { parsed = { interpretation: raw } }

    const buildGroup = (key: string): NewsGroup => ({
      topic: key,
      label: TOPIC_LABEL[key],
      items: ((parsed.groups?.[key]) || []).map(p => {
        const a = pool[p.i]
        return a ? { title: a.title, summary: p.summary, tag: key, source: a.source, url: a.link } : null
      }).filter((x): x is NewsItem => !!x).slice(0, 4),
    })
    const groups = [buildGroup('Macro'), buildGroup('AI'), buildGroup('Behavioral')]
    return { groups, interpretation: parsed.interpretation || raw, generatedAt: new Date().toISOString() }
  },
  ['news', slot],
  { revalidate: 6 * 3600, tags: ['news'] },
)()
