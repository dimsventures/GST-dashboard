import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)
}

export async function GET(req: Request) {
  const url   = new URL(req.url)
  const date  = url.searchParams.get('date')
  const month = url.searchParams.get('month')
  const year  = url.searchParams.get('year')
  const PAGE  = 500
  const all: any[] = []
  let from = 0
  while (true) {
    let q = sb().from('finance_transactions').select('*').order('date').range(from, from + PAGE - 1)
    if (date)  q = q.eq('date', date)
    if (month) q = q.like('date', `${month}%`)
    if (year)  q = q.like('date', `${year}-%`)
    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data?.length) break
    all.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return NextResponse.json(all)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { data, error } = await sb().from('finance_transactions').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await sb().from('finance_transactions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
