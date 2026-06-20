import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'

type BudgetInput = { ym: string; kind: string; category: string; planned: number; note?: string | null }

export async function GET(req: Request) {
  const ctx = getAuthContext(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const month = new URL(req.url).searchParams.get('month')
  let q = ctx.db.from('finance_budgets').select('*')
  if (month) q = q.eq('ym', month)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const ctx = getAuthContext(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = (await req.json()) as BudgetInput | BudgetInput[]
  const rows = (Array.isArray(body) ? body : [body]).map(r => ({
    ym: r.ym, kind: r.kind, category: r.category,
    planned: Math.round(Number(r.planned) || 0),
    note: r.note ?? null,
    user_id: ctx.userId,
    updated_at: new Date().toISOString(),
  }))
  const { data, error } = await ctx.db
    .from('finance_budgets')
    .upsert(rows, { onConflict: 'user_id,ym,kind,category' })
    .select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function DELETE(req: Request) {
  const ctx = getAuthContext(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const month = url.searchParams.get('month')
  let q = ctx.db.from('finance_budgets').delete()
  if (id) q = q.eq('id', id)
  else if (month) q = q.eq('ym', month)
  else return NextResponse.json({ error: 'id or month required' }, { status: 400 })
  const { error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
