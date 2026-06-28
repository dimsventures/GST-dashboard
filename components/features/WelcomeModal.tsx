'use client'

import { useEffect, useState } from 'react'

type Step = { title: string; body: string; emoji: string }

const STEPS: Step[] = [
  {
    emoji: '👋',
    title: 'Selamat datang',
    body: 'Ini bukan sekadar tracker. GST Dashboard itu satu tempat buat ngatur seluruh hidup lo — produktivitas, keuangan, investasi, sampai second brain. Gua kenalin bentar ya.',
  },
  {
    emoji: '🧩',
    title: 'Apa aja yang bisa lo lakuin',
    body: 'Habit & goal harian, tracking keuangan + savings rate, portfolio dengan harga pasar live, makro & valuasi saham, berita yang dikurasi AI, plus Jarvis — asisten AI yang ngerti data lo.',
  },
  {
    emoji: '🚀',
    title: 'Mulai dari Habit lo',
    body: 'Langkah pertama: buka Habit, lalu bikin kategori versi lo sendiri — misal Deep Work, Gym, Reading, Family. Dari situ tracking harian & chart-nya baru jalan. Gak ada template paksaan; semua punya lo.',
  },
]

const LINKS = [
  { href: '/gst', label: 'Habit & Goal', emoji: '🎯' },
  { href: '/finance', label: 'Keuangan', emoji: '💰' },
  { href: '/portfolio', label: 'Portfolio', emoji: '📈' },
]

export function WelcomeModal() {
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')

  useEffect(() => {
    if (localStorage.getItem('gst_onboarded')) return
    setShow(true)
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (u?.name) setName(u.name) })
      .catch(() => {})
  }, [])

  function close() {
    localStorage.setItem('gst_onboarded', '1')
    setShow(false)
  }

  if (!show) return null

  const cur = STEPS[step]
  const last = step === STEPS.length - 1
  const greeting = step === 0 && name ? `Halo, ${name}! ` : ''

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-5 bg-black/70 backdrop-blur-[3px]"
      onClick={e => { if (e.target === e.currentTarget) close() }}
    >
      <div className="w-full max-w-[420px] bg-[#0e1324] border border-[rgba(122,162,255,.28)] rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,.6)] overflow-hidden">
        <div className="px-6 pt-7 pb-6 text-center">
          <div className="text-4xl mb-3">{cur.emoji}</div>
          <div className="text-[17px] font-bold text-[#eef0f5] mb-2">{greeting}{cur.title}</div>
          <div className="text-[12.5px] leading-[1.6] text-[#97a0b3]">{cur.body}</div>

          {last && (
            <div className="grid grid-cols-3 gap-2 mt-5">
              {LINKS.map(l => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => localStorage.setItem('gst_onboarded', '1')}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white/[.03] border border-white/8 no-underline transition-colors hover:border-[#3e6df0] hover:bg-white/5"
                >
                  <span className="text-xl">{l.emoji}</span>
                  <span className="text-[10px] font-semibold text-[#cbd2e0]">{l.label}</span>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-white/8">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className="h-1.5 rounded-full transition-all duration-200"
                style={{ width: i === step ? 18 : 6, background: i === step ? '#3e6df0' : 'rgba(255,255,255,.18)' }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {!last ? (
              <>
                <button
                  onClick={close}
                  className="bg-transparent border-none text-[11px] font-semibold text-white/40 cursor-pointer px-2 py-1.5 hover:text-white/70 transition-colors"
                >
                  Lewati
                </button>
                <button
                  onClick={() => setStep(s => s + 1)}
                  className="bg-[#3e6df0] text-white border-none rounded-lg px-4 py-1.5 text-[12px] font-semibold cursor-pointer hover:bg-[#2f56d1] transition-colors"
                >
                  Lanjut
                </button>
              </>
            ) : (
              <button
                onClick={close}
                className="bg-[#3e6df0] text-white border-none rounded-lg px-4 py-1.5 text-[12px] font-semibold cursor-pointer hover:bg-[#2f56d1] transition-colors"
              >
                Mulai eksplor
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
