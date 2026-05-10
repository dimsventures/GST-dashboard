const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(url, key)

const raw = fs.readFileSync('/mnt/c/Users/DESKTOP/Downloads/gst-backup-from-excel.json', 'utf8')
const { data } = JSON.parse(raw)

async function importData() {
  const { error: e1 } = await supabase.from('entries').insert(data.entries)
  if (e1) console.error('entries error:', e1.message)
  else console.log('✓ entries imported:', data.entries.length)

  const { error: e2 } = await supabase.from('lessons').insert(data.lessons)
  if (e2) console.error('lessons error:', e2.message)
  else console.log('✓ lessons imported:', data.lessons.length)
}

importData()
