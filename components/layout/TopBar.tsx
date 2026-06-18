'use client'

import { useEffect, useState } from 'react'

interface TopBarProps {
  title: string
  onHamburgerClick: () => void
}

export function TopBar({ title, onHamburgerClick }: TopBarProps) {
  const [date, setDate] = useState('')
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDate(
      new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    )
    const saved = localStorage.getItem('dark')
    if (saved === '1') {
      document.body.classList.add('dark')
      setDark(true)
    }
  }, [])

  function toggleDark() {
    const isDark = document.body.classList.toggle('dark')
    setDark(isDark)
    localStorage.setItem('dark', isDark ? '1' : '0')
  }

  return (
    <header className="bg-white border-b border-[#e4e2de] h-[52px] px-6 flex items-center justify-between sticky top-0 z-[100]">
      <div className="flex items-center">
        <button
          className="md:hidden bg-[#d12b2b] border-none rounded-lg w-[38px] h-[38px] cursor-pointer flex items-center justify-center text-white text-lg shadow-[0_2px_8px_rgba(0,0,0,.25)] shrink-0 mr-2.5 active:scale-95 transition-transform"
          onClick={onHamburgerClick}
          aria-label="Toggle menu"
        >
          ☰
        </button>
        <span className="text-sm font-bold text-[#111]">{title}</span>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          className="bg-transparent border border-[#e4e2de] w-[30px] h-[30px] rounded-[6px] flex items-center justify-center cursor-pointer text-sm transition-all duration-150 hover:border-[#d12b2b] shrink-0"
          onClick={toggleDark}
          title="Toggle dark mode"
        >
          {dark ? '☀️' : '🌙'}
        </button>
        <span className="text-[11px] text-[#888]">{date}</span>
      </div>
    </header>
  )
}
