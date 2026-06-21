import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'

export async function GET(req: Request) {
  const ctx = getAuthContext(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await ctx.db.from('portfolio_daily').select('*').order('date')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const ctx = getAuthContext(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const row = {
    date: body.date,
    total_value: Math.round(Number(body.total_value) || 0),
    total_deposited: Math.round(Number(body.total_deposited) || 0),
    user_id: ctx.userId,
  }
  const { data, error } = await ctx.db
    .from('portfolio_daily')
    .upsert(row, { onConflict: 'user_id,date' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
