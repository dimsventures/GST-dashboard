import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'

export async function GET(req: Request) {
  const ctx = getAuthContext(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await ctx.db
    .from('gst_activity_categories')
    .select('*')
    .order('sort_order')
    .order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const ctx = getAuthContext(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()

  const { count } = await ctx.db
    .from('gst_activity_categories')
    .select('*', { count: 'exact', head: true })

  if ((count || 0) >= 7) {
    return NextResponse.json(
      { error: 'max_categories', message: "7 kategori udah cukup brads, keep it focused!" },
      { status: 400 }
    )
  }

  const { data, error } = await ctx.db
    .from('gst_activity_categories')
    .insert({ ...body, user_id: ctx.userId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const ctx = getAuthContext(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, ...update } = await req.json()
  const { data, error } = await ctx.db
    .from('gst_activity_categories')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const ctx = getAuthContext(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await ctx.db.from('gst_activity_categories').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
