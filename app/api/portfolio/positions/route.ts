import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'

export async function GET(req: Request) {
  const ctx = getAuthContext(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await ctx.db
    .from('portfolio_positions')
    .select('*')
    .order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const ctx = getAuthContext(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { action, ...rest } = body

  if (action === 'add_buy') {
    const { id, add_qty, buy_price } = rest
    if (!id || !add_qty || !buy_price) {
      return NextResponse.json({ error: 'id, add_qty, buy_price required' }, { status: 400 })
    }

    const { data: pos, error: fetchErr } = await ctx.db
      .from('portfolio_positions')
      .select('*')
      .eq('id', id)
      .single()
    if (fetchErr || !pos) {
      return NextResponse.json({ error: 'Position not found' }, { status: 404 })
    }

    const oldQty = Number(pos.qty)
    const oldAvg = Number(pos.avg_buy_price)
    const addQty = Number(add_qty)
    const addPrice = Number(buy_price)

    const isStock = pos.ticker_type === 'stock_idr'
    const oldUnits = isStock ? oldQty * 100 : oldQty
    const addUnits = isStock ? addQty * 100 : addQty

    const newAvg = (oldUnits * oldAvg + addUnits * addPrice) / (oldUnits + addUnits)
    const newQty = oldQty + addQty

    const { data, error } = await ctx.db
      .from('portfolio_positions')
      .update({
        qty: newQty,
        avg_buy_price: Math.round(newAvg * 100) / 100,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (action === 'sell') {
    const { id, sell_qty } = rest
    if (!id || !sell_qty) {
      return NextResponse.json({ error: 'id, sell_qty required' }, { status: 400 })
    }

    const { data: pos, error: fetchErr } = await ctx.db
      .from('portfolio_positions')
      .select('*')
      .eq('id', id)
      .single()
    if (fetchErr || !pos) {
      return NextResponse.json({ error: 'Position not found' }, { status: 404 })
    }

    const newQty = Number(pos.qty) - Number(sell_qty)
    if (newQty < 0) {
      return NextResponse.json({ error: 'Sell qty exceeds holdings' }, { status: 400 })
    }

    if (newQty === 0) {
      const { data, error } = await ctx.db
        .from('portfolio_positions')
        .update({ qty: 0, is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }

    const { data, error } = await ctx.db
      .from('portfolio_positions')
      .update({ qty: newQty, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { ticker, ticker_type, asset_id, qty, avg_buy_price } = rest
  if (!ticker || !asset_id) {
    return NextResponse.json({ error: 'ticker and asset_id required' }, { status: 400 })
  }

  const { data, error } = await ctx.db
    .from('portfolio_positions')
    .insert({
      ticker: ticker.toUpperCase(),
      ticker_type: ticker_type || 'stock_idr',
      asset_id,
      qty: qty || 0,
      avg_buy_price: avg_buy_price || 0,
      is_active: true,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const ctx = getAuthContext(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { id, ...rest } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data, error } = await ctx.db
    .from('portfolio_positions')
    .update({ ...rest, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const ctx = getAuthContext(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await ctx.db.from('portfolio_positions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
