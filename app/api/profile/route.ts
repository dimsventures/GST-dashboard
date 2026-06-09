import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'

export async function PATCH(req: Request) {
  const ctx = getAuthContext(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ctx.token}`,
      'apikey': process.env.SUPABASE_ANON_KEY!,
    },
    body: JSON.stringify({ data: { display_name: name.trim() } }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
