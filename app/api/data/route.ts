import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)
}

export async function GET() {
  const db = sb()
  const [e, l, t, g, w, a] = await Promise.all([
    db.from('entries').select('*').order('date'),
    db.from('lessons').select('*').order('date'),
    db.from('todos').select('*'),
    db.from('goals').select('*'),
    db.from('wishes').select('*').order('created_at'),
    db.from('activities').select('*').order('created_at'),
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
