import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'

export async function GET(req: Request) {
  const ctx = getAuthContext(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url   = new URL(req.url)
  const date  = url.searchParams.get('date')
  const month = url.searchParams.get('month')
  const year  = url.searchParams.get('year')
  const PAGE  = 500
  const page = (from: number, withCount = false) => {
    let q = ctx.db
      .from('finance_transactions')
      .select('*', withCount ? { count: 'exact' } : undefined)
      .order('date')
      .order('id')
      .range(from, from + PAGE - 1)
    if (date)  q = q.eq('date', date)
    if (month) q = q.like('date', `${month}%`)
    if (year)  q = q.like('date', `${year}-%`)
    return q
  }
  const first = await page(0, true)
  if (first.error) return NextResponse.json({ error: first.error.message }, { status: 500 })
  const all: any[] = first.data ?? []
  const total = first.count ?? all.length
  if (all.length === PAGE && total > PAGE) {
    const pages = Math.ceil(total / PAGE)
    const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => page((i + 1) * PAGE)))
    for (const r of rest) {
      if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 })
      all.push(...(r.data ?? []))
    }
  }
  return NextResponse.json(all)
}

export async function POST(req: Request) {
  const ctx = getAuthContext(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { data, error } = await ctx.db.from('finance_transactions').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const ctx = getAuthContext(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await ctx.db.from('finance_transactions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
