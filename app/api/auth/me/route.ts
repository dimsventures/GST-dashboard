import { NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/auth'

export async function GET(req: Request) {
  const token = getAccessToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': process.env.SUPABASE_ANON_KEY!,
      },
    })
    if (!res.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const user = await res.json()
    const identities: string[] = (user.identities || []).map((i: { provider: string }) => i.provider)
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
      identities,
    })
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
}
