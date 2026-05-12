import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)
}

export async function GET() {
  const db = sb()
  const [e, l, t, g] = await Promise.all([
    db.from('entries').select('*').order('date'),
    db.from('lessons').select('*').order('date'),
    db.from('todos').select('*'),
    db.from('goals').select('*'),
  ])
  return NextResponse.json({
    entries: e.data || [],
    lessons: l.data || [],
    todos:   t.data || [],
    goals:   g.data || [],
  })
}
