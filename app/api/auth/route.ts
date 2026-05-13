import { createHash } from 'crypto'
import { NextResponse } from 'next/server'

function sessionToken() {
  return createHash('sha256').update(process.env.DASHBOARD_PASSWORD || '').digest('hex')
}

export async function POST(req: Request) {
  const { password } = await req.json()

  if (!password || password !== process.env.DASHBOARD_PASSWORD) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('gst_auth', sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('gst_auth')
  return res
}
