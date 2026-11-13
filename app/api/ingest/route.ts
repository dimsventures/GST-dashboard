import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual, createHash, randomUUID } from 'crypto'

const MAX_LEN = 2000
const KINDS = ['lesson', 'activity', 'goal', 'todo', 'wish'] as const
type Kind = typeof KINDS[number]

function safeEqual(a: string, b: string) {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

function config() {
  const secret = process.env.INGEST_SECRET
  const ownerId = process.env.GST_OWNER_ID
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret || !ownerId || !url || !serviceKey) return null
  return { secret, ownerId, url, serviceKey }
}

function authorized(req: Request, secret: string) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  return !!token && safeEqual(token, secret)
}

const bad = (error: string) => NextResponse.json({ error }, { status: 400 })

export async function GET(req: Request) {
  const cfg = config()
  if (!cfg) return NextResponse.json({ error: 'Ingest belum dikonfigurasi.' }, { status: 503 })
  if (!authorized(req, cfg.secret)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (new URL(req.url).searchParams.get('list') !== 'categories') return bad('list harus "categories".')

  const admin = createClient(cfg.url, cfg.serviceKey)
  const { data, error } = await admin
    .from('gst_activity_categories')
    .select('key, label')
    .eq('user_id', cfg.ownerId)
    .order('sort_order')
    .order('created_at')
  if (error) return NextResponse.json({ error: 'Gagal membaca kategori.' }, { status: 500 })
  return NextResponse.json({ categories: data || [], v: 2 })
}

export async function POST(req: Request) {
  const cfg = config()
  if (!cfg) return NextResponse.json({ error: 'Ingest belum dikonfigurasi.' }, { status: 503 })
  if (!authorized(req, cfg.secret)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { kind?: unknown; text?: unknown; date?: unknown; category?: unknown; scope?: unknown; mode?: unknown }
  try {
    body = await req.json()
  } catch {
    return bad('Body harus JSON.')
  }

  if (body.kind !== undefined && !(KINDS as readonly unknown[]).includes(body.kind)) {
    return bad(`kind harus salah satu dari: ${KINDS.join(', ')}.`)
  }
  const kind: Kind = (body.kind as Kind | undefined) ?? 'lesson'

  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) return bad('text wajib diisi.')
  if (text.length > MAX_LEN) return bad(`text maks ${MAX_LEN} karakter.`)

  let date: string
  if (body.date === undefined) {
    date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
  } else if (typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) && !isNaN(Date.parse(body.date))) {
    date = body.date
  } else {
    return bad('date harus format YYYY-MM-DD.')
  }

  const admin = createClient(cfg.url, cfg.serviceKey)
  const nowIso = new Date().toISOString()
  const fail = () => NextResponse.json({ error: 'Gagal menyimpan.' }, { status: 500 })

  if (kind === 'lesson') {
    const { data, error } = await admin
      .from('gst_lesson_items')
      .insert({ date, text, category: 'General', ts: nowIso, user_id: cfg.ownerId })
      .select('id, date')
      .single()
    if (error) return fail()
    return NextResponse.json({ ok: true, kind, id: data.id, date: data.date })
  }

  if (kind === 'activity') {
    const category = typeof body.category === 'string' ? body.category.trim() : ''
    if (!category) return bad('category wajib diisi untuk activity.')
    const { data: cat, error: catErr } = await admin
      .from('gst_activity_categories')
      .select('key')
      .eq('user_id', cfg.ownerId)
      .eq('key', category)
      .maybeSingle()
    if (catErr) return fail()
    if (!cat) return bad('kategori tidak dikenal')
    const { data, error } = await admin
      .from('gst_activities')
      .insert({ date, category, text, user_id: cfg.ownerId })
      .select('id')
      .single()
    if (error) return fail()
    return NextResponse.json({ ok: true, kind, id: data.id })
  }

  if (kind === 'goal') {
    if (body.scope !== 'year' && body.scope !== 'month') return bad('scope wajib "year" atau "month" untuk goal.')
    const scope = body.scope
    // Ikuti halaman gst: goal year -> yr terisi & ym null; goal month -> ym terisi & yr null.
    const row = {
      id: randomUUID(), text, scope,
      yr: scope === 'year' ? Number(date.slice(0, 4)) : null,
      ym: scope === 'month' ? date.slice(0, 7) : null,
      done: false, done_date: null, user_id: cfg.ownerId,
    }
    const { error } = await admin.from('gst_goals').insert(row)
    if (error) return fail()
    return NextResponse.json({ ok: true, kind, id: row.id })
  }

  if (kind === 'todo') {
    const mode = body.mode === undefined ? 'doing' : body.mode
    if (mode !== 'doing' && mode !== 'learning') return bad('mode harus doing atau learning')
    const row = { id: randomUUID(), text, cat: null, done: false, done_date: null, mode, points_to: 'personal', created_at: nowIso, user_id: cfg.ownerId }
    const { error } = await admin.from('gst_todos').insert(row)
    if (error) return fail()
    return NextResponse.json({ ok: true, kind, id: row.id })
  }

  const row = { id: randomUUID(), text, done: false, done_date: null, achievement_story: null, created_at: nowIso, user_id: cfg.ownerId }
  const { error } = await admin.from('gst_wishes').insert(row)
  if (error) return fail()
  return NextResponse.json({ ok: true, kind, id: row.id })
}
