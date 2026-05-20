import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)
}

export async function POST(req: Request) {
  const { access_token, refresh_token } = await req.json()

  if (!access_token) {
    return NextResponse.json({ error: 'No access token' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  }

  res.cookies.set('sb_access_token', access_token, cookieOpts)
  if (refresh_token) {
    res.cookies.set('sb_refresh_token', refresh_token, cookieOpts)
  }

  return res
}

export async function PUT(req: Request) {
  const refreshToken = req.headers.get('cookie')?.match(/sb_refresh_token=([^;]+)/)?.[1]
  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 })
  }

  const { data, error } = await sb().auth.refreshSession({ refresh_token: refreshToken })
  if (error || !data.session) {
    return NextResponse.json({ error: 'Refresh failed' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  }

  res.cookies.set('sb_access_token', data.session.access_token, cookieOpts)
  res.cookies.set('sb_refresh_token', data.session.refresh_token, cookieOpts)
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('sb_access_token')
  res.cookies.delete('sb_refresh_token')
  res.cookies.delete('gst_auth')
  return res
}
