import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual, createHash } from 'crypto'

const MAX_LEN = 2000

function safeEqual(a: string, b: string) {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

export async function POST(req: Request) {
  const secret = process.env.INGEST_SECRET
  const ownerId = process.env.GST_OWNER_ID
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret || !ownerId || !url || !serviceKey) {
    return NextResponse.json({ error: 'Ingest belum dikonfigurasi.' }, { status: 503 })
  }

  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token || !safeEqual(token, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { text?: unknown; date?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body harus JSON.' }, { status: 400 })
  }

  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) return NextResponse.json({ error: 'text wajib diisi.' }, { status: 400 })
  if (text.length > MAX_LEN) return NextResponse.json({ error: `text maks ${MAX_LEN} karakter.` }, { status: 400 })

  let date: string
  if (body.date === undefined) {
    date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
  } else if (typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) && !isNaN(Date.parse(body.date))) {
    date = body.date
  } else {
    return NextResponse.json({ error: 'date harus format YYYY-MM-DD.' }, { status: 400 })
  }

  const admin = createClient(url, serviceKey)
  const { data, error } = await admin
    .from('gst_lesson_items')
    .insert({ date, text, category: 'General', ts: new Date().toISOString(), user_id: ownerId })
    .select('id, date')
    .single()
  if (error) return NextResponse.json({ error: 'Gagal menyimpan.' }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id, date: data.date })
}
