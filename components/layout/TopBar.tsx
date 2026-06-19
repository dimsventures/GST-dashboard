'use client'

import { useEffect, useState } from 'react'

interface TopBarProps {
  title: string
  onHamburgerClick: () => void
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
    <header className="bg-[#111111] border-b border-white/8 h-[52px] px-6 flex items-center justify-between sticky top-0 z-[100]">
      <div className="flex items-center">
        <button
          className="md:hidden bg-[#d12b2b] border-none rounded-lg w-[38px] h-[38px] cursor-pointer flex items-center justify-center text-white text-lg shadow-[0_2px_8px_rgba(0,0,0,.4)] shrink-0 mr-2.5 active:scale-95 transition-transform"
          onClick={onHamburgerClick}
          aria-label="Toggle menu"
        >
          ☰
        </button>
        <span className="text-sm font-bold text-white">{title}</span>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          className="bg-transparent border border-white/10 w-[30px] h-[30px] rounded-[6px] flex items-center justify-center cursor-pointer text-sm transition-all duration-150 hover:border-[#d12b2b] shrink-0"
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
