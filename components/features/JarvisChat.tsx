'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'

interface Message {
  role: 'user' | 'bot'
  content: string
}

export function JarvisChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const msgsRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (msgsRef.current) {
      msgsRef.current.scrollTop = msgsRef.current.scrollHeight
    }
  }, [messages])

  function toggle() {
    setOpen(o => {
      if (!o && messages.length === 0) {
        setMessages([{ role: 'bot', content: 'Siap, Boss. Mau bahas apa hari ini?' }])
      }
      return !o
    })
    setTimeout(() => inputRef.current?.focus(), 200)
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 90) + 'px'
  }

  async function send() {
    const msg = input.trim()
    if (!msg || loading) return

    setInput('')
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }

    const history = messages
      .filter(m => m.role === 'user' || m.role === 'bot')
      .map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.content }))

    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: history.slice(0, -1) }),
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'bot', content: data.reply || '...' }])
    } catch {
      setMessages(prev => [...prev, { role: 'bot', content: '❌ Jarvis error. Coba lagi.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={toggle}
        title="Jarvis AI"
        className={[
          'fixed bottom-6 right-6 z-[999] w-12 h-12 rounded-full border-none cursor-pointer flex items-center justify-center text-xl text-white shadow-[0_4px_16px_rgba(0,0,0,.25)] transition-all duration-200',
          open ? 'bg-[#3e6df0] scale-110' : 'bg-[#111] hover:bg-[#3e6df0] hover:scale-110',
        ].join(' ')}
      >
        <svg viewBox="0 0 40 40" width="28" height="28" aria-hidden="true">
          <path d="M7 16 L11 4 L18 13 Z" fill="#dfe6f5" />
          <path d="M33 16 L29 4 L22 13 Z" fill="#dfe6f5" />
          <circle cx="20" cy="22" r="13" fill="#dfe6f5" />
          <circle cx="15.5" cy="20.5" r="2.5" fill="#1b2942" />
          <circle cx="24.5" cy="20.5" r="2.5" fill="#1b2942" />
          <path d="M18 25 L22 25 L20 27.5 Z" fill="#ff9bb0" />
        </svg>
      </button>

      {/* Panel */}
      <div
        className={[
          'fixed bottom-[84px] right-6 z-[998] w-[360px] max-h-[540px] bg-white border border-[#e4e2de] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,.15)] flex flex-col overflow-hidden transition-all duration-[220ms]',
          open ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto' : 'opacity-0 translate-y-5 scale-[.97] pointer-events-none',
          'max-sm:w-[calc(100vw-48px)] max-sm:right-6',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#111] text-white rounded-t-xl shrink-0">
          <div className="flex items-center gap-2 font-bold text-[13px] tracking-[.04em]">
            <span className="text-base">🐱</span>
            JARVIS
            <span className="text-[10px] font-normal text-white/50">AI Assistant</span>
          </div>
          <button
            onClick={toggle}
            className="bg-transparent border-none text-white/60 cursor-pointer text-base leading-none p-0.5 transition-colors hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div
          ref={msgsRef}
          className="flex-1 overflow-y-auto px-3.5 py-3.5 flex flex-col gap-2.5 min-h-[200px]"
        >
          {messages.map((m, i) => (
            <div
              key={i}
              className={[
                'max-w-[85%] px-3 py-2 rounded-xl text-[12px] leading-[1.5] whitespace-pre-wrap',
                m.role === 'user'
                  ? 'self-end bg-[#111] text-white rounded-br-sm'
                  : 'self-start bg-[#f5f4f2] text-[#1a1a1a] rounded-bl-sm border border-[#e4e2de]',
              ].join(' ')}
            >
              {m.content}
            </div>
          ))}
          {loading && (
            <div className="self-start bg-[#f5f4f2] text-[#888] border border-[#e4e2de] px-3 py-2 rounded-xl rounded-bl-sm text-[12px]">
              ···
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex items-end gap-2 px-3 py-2.5 border-t border-[#e4e2de] bg-white shrink-0">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => { setInput(e.target.value); autoResize(e.target) }}
            onKeyDown={handleKey}
            placeholder="Tanya Jarvis..."
            rows={1}
            className="flex-1 border border-[#e4e2de] rounded-lg px-2.5 py-2 text-[12px] text-[#1a1a1a] bg-[#f5f4f2] resize-none max-h-[90px] outline-none transition-colors duration-150 focus:border-[#d0cdc8] leading-[1.45] font-[inherit]"
          />
          <button
            onClick={() => { setMessages([]); setInput('') }}
            className="bg-transparent border-none text-[#888] cursor-pointer text-[10px] shrink-0 p-1 transition-colors hover:text-[#3e6df0]"
            title="Clear chat"
          >
            ↺
          </button>
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="bg-[#111] text-white border-none rounded-lg w-[34px] h-[34px] flex items-center justify-center cursor-pointer shrink-0 text-sm transition-colors hover:bg-[#3e6df0] disabled:opacity-40 disabled:cursor-default"
          >
            ➤
          </button>
        </div>
      </div>
    </>
  )
}
