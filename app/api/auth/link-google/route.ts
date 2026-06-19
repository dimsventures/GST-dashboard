import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'

export async function GET(req: Request) {
  const ctx = getAuthContext(req)
  if (!ctx) return NextResponse.redirect(new URL('/login', req.url))

  const origin = new URL(req.url).origin
  const redirectTo = `${origin}/dashboard.html`

  const res = await fetch(
    `${process.env.SUPABASE_URL}/auth/v1/user/identities/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`,
    {
      headers: {
        'Authorization': `Bearer ${ctx.token}`,
        'apikey': process.env.SUPABASE_ANON_KEY!,
      },
      redirect: 'manual',
    }
  )

  const location = res.headers.get('location')
  if (location) return NextResponse.redirect(location)

  return NextResponse.redirect(new URL('/dashboard.html', req.url))
}
