import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'

export async function GET(req: Request) {
  const ctx = getAuthContext(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = ctx.db
  const [e, l, t, g, w, a] = await Promise.all([
    db.from('gst_entries').select('*').order('date'),
    db.from('gst_lessons').select('*').order('date'),
    db.from('gst_todos').select('*').order('created_at', { ascending: false }),
    db.from('gst_goals').select('*').order('created_at', { ascending: false }),
    db.from('gst_wishes').select('*').order('created_at'),
    db.from('gst_activities').select('*')
      .gte('date', `${new Date().getFullYear()}-01-01`)
      .order('created_at'),
  ])
  if (a.error) console.error('[data/activities] Supabase error:', a.error)
  return NextResponse.json({
    entries:    e.data || [],
    lessons:    l.data || [],
    todos:      t.data || [],
    goals:      g.data || [],
    wishes:     w.data || [],
    activities: a.data || [],
  })
}
