import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAuthContext } from '@/lib/auth'

const SYSTEM_PROMPT = `Kamu adalah Jarvis — AI personal assistant dari pemilik dashboard ini. Kamu tahu SEMUA data mereka: entries harian, lessons, todos, goals, wishes. Kamu berbicara jujur, direct, kadang push back kalau ada inkonsistensi antara goals dan behavior. Bahasa Indonesia informal (gua/lu). Jangan basa-basi. Panggil pemiliknya 'Boss'.`

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
  const [e, l, t, g, w] = await Promise.all([
    db.from('gst_entries').select('*').order('date'),
    db.from('gst_lesson_items').select('*').order('date').order('ts'),
    db.from('gst_todos').select('*').order('created_at', { ascending: false }),
    db.from('gst_goals').select('*').order('created_at', { ascending: false }),
    db.from('gst_wishes').select('*').order('created_at'),
  ])

  const dataContext = `
=== DATA DASHBOARD BOSS (per ${new Date().toLocaleDateString('id-ID')}) ===

ENTRIES HARIAN (log aktivitas):
${JSON.stringify(e.data || [], null, 2)}

LESSONS (pelajaran yang dicatat):
${JSON.stringify(l.data || [], null, 2)}

TODOS (task harian):
${JSON.stringify(t.data || [], null, 2)}

GOALS (target tahunan/bulanan):
${JSON.stringify(g.data || [], null, 2)}

WISHES (dream list):
${JSON.stringify(w.data || [], null, 2)}
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
