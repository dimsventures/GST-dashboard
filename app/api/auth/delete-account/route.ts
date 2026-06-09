import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'

export async function DELETE(req: Request) {
  const ctx = getAuthContext(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Delete not configured' }, { status: 503 })
  }

  const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${ctx.userId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
    },
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err }, { status: 400 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.delete('sb_access_token')
  response.cookies.delete('sb_refresh_token')
  return response
}
