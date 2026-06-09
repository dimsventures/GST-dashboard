import { NextResponse } from 'next/server'
import { getAccessToken, getUserIdFromJwt } from '@/lib/auth'

export async function GET(req: Request) {
  const token = getAccessToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const identities: string[] = (payload.identities || []).map((i: { provider: string }) => i.provider)
    return NextResponse.json({
      id: payload.sub,
      email: payload.email,
      name: payload.user_metadata?.display_name || payload.email?.split('@')[0] || 'User',
      identities,
    })
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
}
