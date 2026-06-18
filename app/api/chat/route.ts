import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAuthContext } from '@/lib/auth'

const SYSTEM_PROMPT = `Kamu adalah Jarvis — AI personal assistant dari pemilik dashboard ini. Kamu tahu SEMUA data mereka: entries harian, lessons, todos, goals, wishes, aktivitas detail, portfolio, dan transaksi keuangan. Kamu berbicara jujur, direct, kadang push back kalau ada inkonsistensi antara goals dan behavior. Bahasa Indonesia informal (gua/lu). Jangan basa-basi. Panggil pemiliknya 'Boss'.

Kamu sekarang punya tools untuk write ke database. Gunakan tools ini ketika Boss explicitly minta tambah, update, atau catat sesuatu. Selalu konfirmasi action yang sudah dieksekusi. Jangan eksekusi write action tanpa explicit request dari Boss.`

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'add_todo',
    description: 'Tambah todo baru ke daftar tugas Boss',
    input_schema: {
      type: 'object' as const,
      properties: {
        task: { type: 'string', description: 'Teks todo yang mau ditambahkan' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Prioritas (opsional)' },
      },
      required: ['task'],
    },
  },
  {
    name: 'complete_todo',
    description: 'Tandai todo sebagai selesai (done)',
    input_schema: {
      type: 'object' as const,
      properties: {
        todo_id: { type: 'string', description: 'ID todo yang mau diselesaikan' },
      },
      required: ['todo_id'],
    },
  },
  {
    name: 'add_entry',
    description: 'Catat atau update entry harian',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string', description: 'Tanggal format YYYY-MM-DD' },
        status: { type: 'string', description: 'Status/catatan singkat hari ini' },
        mood: { type: 'string', description: 'Mood atau extra notes' },
      },
      required: ['date'],
    },
  },
  {
    name: 'add_transaction',
    description: 'Catat transaksi keuangan (pemasukan, pengeluaran, investasi)',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string', description: 'Tanggal format YYYY-MM-DD' },
        amount: { type: 'number', description: 'Nominal dalam Rupiah' },
        category: { type: 'string', description: 'Kategori transaksi (misal: Makan, Transport, Gaji)' },
        description: { type: 'string', description: 'Deskripsi atau catatan tambahan' },
        type: { type: 'string', enum: ['income', 'expense', 'investment', 'buffer'], description: 'Tipe transaksi' },
      },
      required: ['date', 'amount', 'category', 'type'],
    },
  },
  {
    name: 'add_lesson',
    description: 'Tambah lesson atau pembelajaran ke log Boss',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string', description: 'Tanggal format YYYY-MM-DD' },
        content: { type: 'string', description: 'Isi lesson yang mau dicatat' },
        category: { type: 'string', description: 'Kategori lesson (opsional, misal: Finance, Health, Mental)' },
      },
      required: ['date', 'content'],
    },
  },
  {
    name: 'update_goal',
    description: 'Update status atau progress goal Boss',
    input_schema: {
      type: 'object' as const,
      properties: {
        goal_id: { type: 'string', description: 'ID goal yang mau diupdate' },
        progress: { type: 'number', description: 'Progress 0-100 (opsional)' },
        status: { type: 'string', description: 'Status baru, "done" untuk tandai selesai' },
        notes: { type: 'string', description: 'Catatan update (opsional)' },
      },
      required: ['goal_id'],
    },
  },
]

type ToolInput = Record<string, unknown>

async function executeTool(
  name: string,
  input: ToolInput,
  db: ReturnType<typeof import('@/lib/auth').createUserClient>,
  userId: string,
): Promise<string> {
  try {
    switch (name) {
      case 'add_todo': {
        const task = input.task as string
        const { data, error } = await db
          .from('gst_todos')
          .insert({ text: task, done: false, created_at: new Date().toISOString(), mode: 'doing', points_to: 'personal' })
          .select()
          .single()
        if (error) throw new Error(error.message)
        return `✅ Todo ditambahkan: "${task}" (id: ${data.id})`
      }

      case 'complete_todo': {
        const todo_id = input.todo_id as string
        const { error } = await db
          .from('gst_todos')
          .update({ done: true, done_date: new Date().toISOString().slice(0, 10) })
          .eq('id', todo_id)
        if (error) throw new Error(error.message)
        return `✅ Todo ${todo_id} ditandai selesai`
      }

      case 'add_entry': {
        const { date, status, mood } = input as { date: string; status?: string; mood?: string }
        const body: Record<string, unknown> = { date }
        if (status) body.status = status
        if (mood) body.extra = mood
        const { error } = await db.from('gst_entries').upsert(body, { onConflict: 'date' })
        if (error) throw new Error(error.message)
        return `✅ Entry tanggal ${date} dicatat`
      }

      case 'add_transaction': {
        const { date, amount, category, description, type } = input as {
          date: string; amount: number; category: string; description?: string; type: string
        }
        const { data, error } = await db
          .from('finance_transactions')
          .insert({ date, amount, category, note: description || null, type })
          .select()
          .single()
        if (error) throw new Error(error.message)
        return `✅ Transaksi dicatat: ${type} Rp${amount.toLocaleString('id-ID')} - ${category}${description ? ` (${description})` : ''} (id: ${data.id})`
      }

      case 'add_lesson': {
        const { date, content, category } = input as { date: string; content: string; category?: string }
        const { data, error } = await db
          .from('gst_lesson_items')
          .insert({ date, text: content, category: category || 'General', ts: new Date().toISOString(), user_id: userId })
          .select()
          .single()
        if (error) throw new Error(error.message)
        return `✅ Lesson dicatat: "${content.slice(0, 60)}${content.length > 60 ? '...' : ''}" (id: ${data.id})`
      }

      case 'update_goal': {
        const { goal_id, progress, status, notes } = input as {
          goal_id: string; progress?: number; status?: string; notes?: string
        }
        const updates: Record<string, unknown> = {}
        if (progress !== undefined) updates.progress = progress
        if (status === 'done') { updates.done = true; updates.done_date = new Date().toISOString().slice(0, 10) }
        if (notes) updates.notes = notes
        if (Object.keys(updates).length === 0) return '⚠️ Tidak ada field yang diupdate'
        const { error } = await db.from('gst_goals').update(updates).eq('id', goal_id)
        if (error) throw new Error(error.message)
        return `✅ Goal ${goal_id} diupdate: ${JSON.stringify(updates)}`
      }

      default:
        return `❌ Tool tidak dikenal: ${name}`
    }
  } catch (err) {
    return `❌ Error eksekusi ${name}: ${err instanceof Error ? err.message : String(err)}`
  }
}

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

  let reply = ''
  const MAX_ITERATIONS = 5

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT + '\n\n' + dataContext,
      messages,
      tools: TOOLS,
    })

    const textBlocks = response.content.filter(b => b.type === 'text')
    if (textBlocks.length > 0) {
      reply = textBlocks.map(b => b.type === 'text' ? b.text : '').join('')
    }

    if (response.stop_reason !== 'tool_use') break

    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use')
    messages.push({ role: 'assistant', content: response.content })

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (block) => {
        if (block.type !== 'tool_use') return null
        const result = await executeTool(block.name, block.input as ToolInput, db, ctx.userId)
        return { type: 'tool_result' as const, tool_use_id: block.id, content: result }
      })
    ).then(r => r.filter(Boolean) as Anthropic.ToolResultBlockParam[])

    messages.push({ role: 'user', content: toolResults })
  }

  return NextResponse.json({ reply })
}
