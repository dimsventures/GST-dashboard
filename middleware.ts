import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function decodeJwt(token: string): { sub: string; exp: number } | null {
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  const accessToken = request.cookies.get('sb_access_token')?.value
  const refreshToken = request.cookies.get('sb_refresh_token')?.value

  if (!accessToken) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const payload = decodeJwt(accessToken)
  if (!payload?.sub) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const now = Math.floor(Date.now() / 1000)
  const isExpired = payload.exp && payload.exp < now

  if (isExpired) {
    if (!refreshToken) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    try {
      const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)
      const { data, error } = await sb.auth.refreshSession({ refresh_token: refreshToken })

      if (error || !data.session) {
        return NextResponse.redirect(new URL('/login', request.url))
      }

      const cookieOpts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      }

      let response: NextResponse
      if (pathname === '/') {
        response = NextResponse.redirect(new URL('/dashboard', request.url))
      } else {
        // Forward new token to the API route via modified request headers
        // so that API route handlers use the fresh token, not the expired one
        const requestHeaders = new Headers(request.headers)
        const existingCookie = requestHeaders.get('cookie') || ''
        const cleanedCookie = existingCookie
          .replace(/sb_access_token=[^;]*(;\s*)?/g, '')
          .replace(/sb_refresh_token=[^;]*(;\s*)?/g, '')
          .replace(/;\s*$/, '')
        const newCookie = [
          cleanedCookie,
          `sb_access_token=${data.session.access_token}`,
          `sb_refresh_token=${data.session.refresh_token}`,
        ].filter(Boolean).join('; ')
        requestHeaders.set('cookie', newCookie)
        response = NextResponse.next({ request: { headers: requestHeaders } })
      }

      response.cookies.set('sb_access_token', data.session.access_token, cookieOpts)
      response.cookies.set('sb_refresh_token', data.session.refresh_token, cookieOpts)
      return response
    } catch {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  if (pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.json).*)'],
}
