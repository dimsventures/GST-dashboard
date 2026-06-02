import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'

export async function GET(req: Request) {
  const ctx = getAuthContext(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = ctx.db
  const [e, l, t, g, w, a, tc] = await Promise.all([
    db.from('gst_entries').select('*').order('date'),
    db.from('gst_lesson_items').select('*').order('date').order('ts'),
    db.from('gst_todos').select('*').order('created_at', { ascending: false }),
    db.from('gst_goals').select('*').order('created_at', { ascending: false }),
    db.from('gst_wishes').select('*').order('created_at'),
    db.from('gst_activities').select('*')
      .order('created_at', { ascending: false })
      .limit(3000),
    db.from('gst_todo_categories').select('*').order('sort_order').order('created_at'),
  ])
  if (a.error) console.error('[data/activities] Supabase error:', a.error)
  return NextResponse.json({
    entries:        e.data || [],
    lessons:        l.data || [],
    todos:          t.data || [],
    goals:          g.data || [],
    wishes:         w.data || [],
    activities:     a.data || [],
    todoCategories: tc.data || [],
  })
}
