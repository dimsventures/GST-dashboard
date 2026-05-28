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
  const now = new Date()
  const d90 = new Date(now); d90.setDate(d90.getDate() - 90)
  const d90str = d90.toISOString().slice(0, 10)

  const [entries, lessons, todos, goals, wishes, activities, txs, assets, positions, snapshots, withdrawals, recons, buffers] = await Promise.all([
    db.from('gst_entries').select('*').gte('date', d90str).order('date'),
    db.from('gst_lesson_items').select('*').order('date').order('ts'),
    db.from('gst_todos').select('*').eq('done', false).order('created_at', { ascending: false }).limit(100),
    db.from('gst_goals').select('*').order('created_at', { ascending: false }),
    db.from('gst_wishes').select('*').order('created_at'),
    db.from('gst_activities').select('*').gte('date', d90str).order('date', { ascending: false }).limit(200),
    db.from('finance_transactions').select('*').order('date', { ascending: false }).limit(100),
    db.from('portfolio_assets').select('*'),
    db.from('portfolio_positions').select('*').order('date', { ascending: false }).limit(50),
    db.from('portfolio_snapshots').select('*').order('date', { ascending: false }).limit(30),
    db.from('portfolio_withdrawals').select('*').order('date', { ascending: false }),
    db.from('finance_reconciliations').select('*').order('date', { ascending: false }).limit(30),
    db.from('finance_buffer_logs').select('*').order('created_at', { ascending: false }).limit(30),
  ])

  const j = (d: unknown) => JSON.stringify(d)
  const dataContext = `=== DATA DASHBOARD BOSS (per ${now.toLocaleDateString('id-ID')}, entries 90 hari terakhir) ===
ENTRIES HARIAN:${j(entries.data||[])}
AKTIVITAS DETAIL:${j(activities.data||[])}
LESSONS:${j(lessons.data||[])}
TODOS (belum selesai):${j(todos.data||[])}
GOALS:${j(goals.data||[])}
WISHES:${j(wishes.data||[])}
TRANSAKSI KEUANGAN:${j(txs.data||[])}
PORTFOLIO ASSETS:${j(assets.data||[])}
PORTFOLIO POSITIONS:${j(positions.data||[])}
PORTFOLIO SNAPSHOTS:${j(snapshots.data||[])}
PORTFOLIO WITHDRAWALS:${j(withdrawals.data||[])}
FINANCE RECONCILIATIONS:${j(recons.data||[])}
FINANCE BUFFER LOGS:${j(buffers.data||[])}`

  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-20),
    { role: 'user', content: message },
  ]

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: SYSTEM_PROMPT + '\n\n' + dataContext,
    messages,
  })

  const reply = response.content[0].type === 'text' ? response.content[0].text : ''
  return NextResponse.json({ reply })
}
