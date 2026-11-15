import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual, createHash } from 'crypto'

// Endpoint BACA-SAJA untuk agent (Hermes Agent4). Hanya GET, hanya tabel di whitelist.
// Dijaga AGENT_READ_SECRET (BEDA dari INGEST_SECRET) dan hanya membaca data milik GST_OWNER_ID.
// Tidak ada jalur tulis. Kunci service-role tetap di server ini, tidak pernah sampai ke agent.

const TABLES = {
  finance_transactions: { order: 'date', dateCol: 'date' },
  finance_accounts: { order: 'sort_order' },
  finance_categories: { order: 'name' },
  finance_budgets: { order: 'ym', monthCol: 'ym' },
  finance_reconciliations: { order: 'created_at' },
  finance_buffer_logs: { order: 'created_at' },
  portfolio_positions: { order: 'created_at' },
  portfolio_assets: { order: 'created_at' },
  portfolio_snapshots: { order: 'month' },
  portfolio_valuations: { order: 'updated_at' },
  portfolio_withdrawals: { order: 'created_at' },
  portfolio_daily: { order: 'date', dateCol: 'date' },
  gst_activities: { order: 'date', dateCol: 'date' },
  gst_activity_categories: { order: 'sort_order' },
  gst_goals: { order: 'created_at' },
  gst_todos: { order: 'created_at' },
  gst_wishes: { order: 'created_at' },
  gst_lesson_items: { order: 'date', dateCol: 'date' },
} as const
type Table = keyof typeof TABLES

const MAX_LIMIT = 1000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-\d{2}$/

function safeEqual(a: string, b: string) {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

export async function GET(req: Request) {
  const secret = process.env.AGENT_READ_SECRET
  const ownerId = process.env.GST_OWNER_ID
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret || !ownerId || !url || !serviceKey) {
    return NextResponse.json({ error: 'Belum dikonfigurasi.' }, { status: 503 })
  }

  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token || !safeEqual(token, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sp = new URL(req.url).searchParams
  const table = sp.get('table') || ''
  if (table === 'list') return NextResponse.json({ tables: Object.keys(TABLES) })
  if (!(table in TABLES)) {
    return NextResponse.json({ error: `table harus salah satu dari: ${Object.keys(TABLES).join(', ')}` }, { status: 400 })
  }
  const cfg = TABLES[table as Table] as { order: string; dateCol?: string; monthCol?: string }

  const limit = Math.min(Math.max(parseInt(sp.get('limit') || '200', 10) || 200, 1), MAX_LIMIT)
  const from = sp.get('from'), to = sp.get('to'), month = sp.get('month')
  if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
    return NextResponse.json({ error: 'from/to harus YYYY-MM-DD.' }, { status: 400 })
  }
  if (month && !MONTH_RE.test(month)) {
    return NextResponse.json({ error: 'month harus YYYY-MM.' }, { status: 400 })
  }

  const admin = createClient(url, serviceKey)
  let q = admin.from(table).select('*').eq('user_id', ownerId)
  if (cfg.dateCol && from) q = q.gte(cfg.dateCol, from)
  if (cfg.dateCol && to) q = q.lte(cfg.dateCol, to)
  if (cfg.monthCol && month) q = q.eq(cfg.monthCol, month)
  const { data, error } = await q.order(cfg.order, { ascending: false }).limit(limit)
  if (error) return NextResponse.json({ error: 'Gagal membaca data.' }, { status: 500 })
  return NextResponse.json({ table, count: data?.length ?? 0, limit, data: data ?? [] })
}

// Semua method lain ditolak.
const deny = () => NextResponse.json({ error: 'Read-only.' }, { status: 405 })
export const POST = deny, PUT = deny, PATCH = deny, DELETE = deny
