import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAuthContext } from '@/lib/auth'

const SYSTEM_PROMPT = `Kamu adalah Jarvis — AI personal assistant dari pemilik dashboard ini. Kamu tahu SEMUA data mereka: entries harian, lessons, todos, goals, wishes, aktivitas detail, portfolio, dan transaksi keuangan. Kamu berbicara jujur, direct, kadang push back kalau ada inkonsistensi antara goals dan behavior. Bahasa Indonesia informal (gua/lu). Jangan basa-basi. Panggil pemiliknya 'Boss'.`

export async function POST(req: Request) {
  const ctx = getAuthContext(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })
  }
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const { message, history = [] } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })

  const db = ctx.db
  const [entries, lessons, todos, goals, wishes, activities, txs, assets, positions, snapshots, withdrawals, recons, buffers] = await Promise.all([
    db.from('gst_entries').select('*').order('date'),
    db.from('gst_lesson_items').select('*').order('date').order('ts'),
    db.from('gst_todos').select('*').order('created_at', { ascending: false }),
    db.from('gst_goals').select('*').order('created_at', { ascending: false }),
    db.from('gst_wishes').select('*').order('created_at'),
    db.from('gst_activities').select('*').order('created_at', { ascending: false }).limit(500),
    db.from('finance_transactions').select('*').order('date', { ascending: false }).limit(500),
    db.from('portfolio_assets').select('*'),
    db.from('portfolio_positions').select('*').order('date', { ascending: false }).limit(200),
    db.from('portfolio_snapshots').select('*').order('date', { ascending: false }).limit(100),
    db.from('portfolio_withdrawals').select('*').order('date', { ascending: false }),
    db.from('finance_reconciliations').select('*').order('date', { ascending: false }).limit(100),
    db.from('finance_buffer_logs').select('*').order('created_at', { ascending: false }).limit(100),
  ])

  const dataContext = `
=== DATA DASHBOARD BOSS (per ${new Date().toLocaleDateString('id-ID')}) ===

ENTRIES HARIAN (skor religion/work/market/physical/social per hari):
${JSON.stringify(entries.data || [], null, 2)}

AKTIVITAS DETAIL (aktivitas spesifik per hari):
${JSON.stringify(activities.data || [], null, 2)}

LESSONS (pelajaran yang dicatat):
${JSON.stringify(lessons.data || [], null, 2)}

TODOS (task harian):
${JSON.stringify(todos.data || [], null, 2)}

GOALS (target tahunan/bulanan):
${JSON.stringify(goals.data || [], null, 2)}

WISHES (dream list):
${JSON.stringify(wishes.data || [], null, 2)}

TRANSAKSI KEUANGAN:
${JSON.stringify(txs.data || [], null, 2)}

PORTFOLIO ASSETS:
${JSON.stringify(assets.data || [], null, 2)}

PORTFOLIO POSITIONS:
${JSON.stringify(positions.data || [], null, 2)}

PORTFOLIO SNAPSHOTS:
${JSON.stringify(snapshots.data || [], null, 2)}

PORTFOLIO WITHDRAWALS:
${JSON.stringify(withdrawals.data || [], null, 2)}

FINANCE RECONCILIATIONS:
${JSON.stringify(recons.data || [], null, 2)}

FINANCE BUFFER LOGS:
${JSON.stringify(buffers.data || [], null, 2)}
`

  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-20),
    { role: 'user', content: message },
  ]

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT + '\n\n' + dataContext,
    messages,
  })

  const reply = response.content[0].type === 'text' ? response.content[0].text : ''
  return NextResponse.json({ reply })
}
