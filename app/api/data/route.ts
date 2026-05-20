import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'

export async function GET(req: Request) {
  const ctx = getAuthContext(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = ctx.db
  const [e, l, t, g, w, a] = await Promise.all([
    db.from('gst_entries').select('*').order('date'),
    db.from('gst_lessons').select('*').order('date'),
    db.from('gst_todos').select('*'),
    db.from('gst_goals').select('*'),
    db.from('gst_wishes').select('*').order('created_at'),
    db.from('gst_activities').select('*').order('created_at'),
  ])
  return NextResponse.json({
    entries:    e.data || [],
    lessons:    l.data || [],
    todos:      t.data || [],
    goals:      g.data || [],
    wishes:     w.data || [],
    activities: a.data || [],
  })
}
