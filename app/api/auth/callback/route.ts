import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', req.url))
  }

  const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_ANON_KEY!,
    },
    body: JSON.stringify({ auth_code: code }),
  })

  if (!res.ok) {
    return NextResponse.redirect(new URL('/login?error=oauth_failed', req.url))
  }

  const { access_token, refresh_token } = await res.json()

  const response = NextResponse.redirect(new URL('/dashboard.html', req.url))
  response.cookies.set('sb_access_token', access_token, {
    httpOnly: true, secure: true, sameSite: 'lax', maxAge: 3600, path: '/',
  })
  response.cookies.set('sb_refresh_token', refresh_token, {
    httpOnly: true, secure: true, sameSite: 'lax', maxAge: 86400 * 30, path: '/',
  })
  return response
}
