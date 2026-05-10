'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    async function load() {
      const [e, l, t, g] = await Promise.all([
        supabase.from('entries').select('*').order('date'),
        supabase.from('lessons').select('*').order('date'),
        supabase.from('todos').select('*'),
        supabase.from('goals').select('*'),
      ])
      setData({
        entries: e.data || [],
        lessons: l.data || [],
        todos: t.data || [],
        goals: g.data || [],
      })
    }
    load()
  }, [])

  useEffect(() => {
    if (!data) return
    ;(window as any).__SUPABASE_DATA__ = data
    ;(window as any).__SAVE__ = async (type: string, payload: any) => {
      if (type === 'entry') {
        const { error } = await supabase.from('entries').upsert(payload, { onConflict: 'date' })
        if (error) console.error(error)
      }
      if (type === 'lesson') {
        const { error } = await supabase.from('lessons').upsert(payload, { onConflict: 'date' })
        if (error) console.error(error)
      }
      if (type === 'todo') {
        const { error } = await supabase.from('todos').upsert(payload)
        if (error) console.error(error)
      }
      if (type === 'goal') {
        const { error } = await supabase.from('goals').upsert(payload)
        if (error) console.error(error)
      }
    }
    window.dispatchEvent(new Event('supabase-ready'))
  }, [data])

  if (!data) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'Poppins,sans-serif',color:'#888'}}>
      Loading...
    </div>
  )

  return <div id="app-root" />
}