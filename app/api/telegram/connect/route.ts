import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'

// Status pairing user (connected?)
export async function GET(req: Request) {
  const ctx = getAuthContext(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await ctx.db.from('user_telegram').select('chat_id, connected_at').eq('user_id', ctx.userId).maybeSingle()
  return NextResponse.json({ connected: !!data?.chat_id, chat_id: data?.chat_id || null })
}

// Simpan chat_id (bukan rahasia — cuma "alamat kirim")
export async function POST(req: Request) {
  const ctx = getAuthContext(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const cid = String(body.chat_id || '').trim()
  if (!/^-?\d{5,}$/.test(cid)) return NextResponse.json({ error: 'chat_id gak valid — harus angka (dari @userinfobot).' }, { status: 400 })
  const { error } = await ctx.db.from('user_telegram').upsert(
    { user_id: ctx.userId, chat_id: cid, connected_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const ctx = getAuthContext(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { error } = await ctx.db.from('user_telegram').delete().eq('user_id', ctx.userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
