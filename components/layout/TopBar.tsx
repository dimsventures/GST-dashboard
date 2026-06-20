'use client'

import { useEffect, useState, useRef, type CSSProperties } from 'react'

interface TopBarProps {
  title: string
  onHamburgerClick: () => void
}

type LessonItem = { date: string; text: string; category: string | null }

function fmtLessonDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']
  return dt.getDate() + ' ' + m[dt.getMonth()]
}

function todayStr() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

function LessonTicker() {
  const [items, setItems] = useState<LessonItem[]>([])
  const [idx, setIdx] = useState(0)
  const [dur, setDur] = useState(20)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/data')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const raw = Array.isArray(d?.lessons) ? d.lessons : []
        const today = todayStr()
        const past = raw
          .filter((it: { date: string }) => it.date < today)
          .sort((a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date))
          .map((it: { date: string; text: string; category: string | null }) => ({ date: it.date, text: it.text, category: it.category || null }))
        setItems(past)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!items.length) return
    const text = items[idx]?.text || ''
    const d = Math.max(16, Math.min(30, 16 + text.length * 0.12))
    setDur(d)
    timerRef.current = setTimeout(() => setIdx(i => (i + 1) % items.length), d * 1000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [idx, items])

  if (!items.length) return null

  const cur = items[idx]
  return (
    <div key={idx} className="hdr-lesson-item" style={{ '--lsn-dur': dur + 's' } as CSSProperties}>
      {cur.category
        ? <span className="lsn-cat-tag">{cur.category}</span>
        : <span className="hdr-lesson-date">🔒 {fmtLessonDate(cur.date)}</span>}
      <span className="hdr-lesson-text">{cur.text}</span>
    </div>
  )
}

export function TopBar({ title, onHamburgerClick }: TopBarProps) {
  const [date, setDate] = useState('')
  const [dark, setDark] = useState(true)

  useEffect(() => {
    setDate(
      new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    )
    const saved = localStorage.getItem('gst_theme')
    if (saved === 'light') {
      document.body.classList.remove('dark')
      setDark(false)
    }
  }, [])

  function toggleDark() {
    const isDark = document.body.classList.toggle('dark')
    setDark(isDark)
    localStorage.setItem('gst_theme', isDark ? 'dark' : 'light')
  }

  return (
    <header className="bg-[#111111] h-[52px] px-6 flex items-center justify-between sticky top-0 z-[100]">
      <style>{`
        .hdr-lessons{flex:1;min-width:0;display:flex;align-items:center;overflow:hidden;-webkit-mask-image:linear-gradient(to right,transparent,#000 24px,#000 calc(100% - 24px),transparent);mask-image:linear-gradient(to right,transparent,#000 24px,#000 calc(100% - 24px),transparent);}
        @keyframes lsn-scroll{from{transform:translateX(80vw)}to{transform:translateX(-80vw)}}
        .hdr-lesson-item{display:inline-flex;align-items:center;gap:6px;padding:4px 14px;background:rgba(62,109,240,.14);border:1px solid rgba(62,109,240,.35);border-radius:6px;font-size:11px;color:var(--text);white-space:nowrap;flex-shrink:0;animation:lsn-scroll var(--lsn-dur,22s) linear forwards;}
        .hdr-lesson-item .hdr-lesson-date{font-weight:700;color:#3e6df0;font-size:10px;letter-spacing:.06em;text-transform:uppercase;}
        .hdr-lesson-item .hdr-lesson-text{color:var(--text2);}
        .lsn-cat-tag{display:inline-flex;align-items:center;font-size:8px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:2px 7px;border-radius:10px;background:var(--gold-bg);color:var(--gold);border:1px solid var(--gold-border);margin-right:4px;}
      `}</style>
      <div className="flex items-center shrink-0">
        <button
          className="md:hidden bg-[#3e6df0] border-none rounded-lg w-[38px] h-[38px] cursor-pointer flex items-center justify-center text-white text-lg shadow-[0_2px_8px_rgba(0,0,0,.4)] shrink-0 mr-2.5 active:scale-95 transition-transform"
          onClick={onHamburgerClick}
          aria-label="Toggle menu"
        >
          ☰
        </button>
        <span className="text-base font-bold text-white">{title}</span>
      </div>

      <div className="hdr-lessons hidden md:flex mx-4">
        <LessonTicker />
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <button
          className="bg-transparent border border-white/10 w-[30px] h-[30px] rounded-[6px] flex items-center justify-center cursor-pointer text-sm transition-all duration-150 hover:border-[#3e6df0] shrink-0"
          onClick={toggleDark}
          title="Toggle dark mode"
        >
          {dark ? '☀️' : '🌙'}
        </button>
        <span className="text-[11px] text-white/35 hidden sm:block">{date}</span>
      </div>
    </header>
  )
}
