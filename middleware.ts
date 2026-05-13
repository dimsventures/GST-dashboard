import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createHash } from 'crypto'

function sessionToken() {
  return createHash('sha256').update(process.env.DASHBOARD_PASSWORD || '').digest('hex')
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  const cookie = request.cookies.get('gst_auth')
  if (!cookie || cookie.value !== sessionToken()) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
