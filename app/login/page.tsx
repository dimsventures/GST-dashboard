'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      router.push('/')
      router.refresh()
    } else {
      setError('Password salah.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f4f2',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Poppins', sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{
        background: '#fff',
        border: '1px solid #e4e2de',
        borderRadius: 12,
        padding: '40px 36px',
        width: '100%',
        maxWidth: 360,
        boxShadow: '0 8px 24px rgba(0,0,0,.08)',
      }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', letterSpacing: '.02em' }}>
            Hello <span style={{ color: '#d12b2b' }}>Dims</span>
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 4, fontWeight: 400 }}>
            Masukkan password untuk lanjut
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            style={{
              width: '100%',
              padding: '10px 13px',
              border: `1px solid ${error ? '#d12b2b' : '#e4e2de'}`,
              borderRadius: 6,
              fontSize: 13,
              fontFamily: 'inherit',
              color: '#1a1a1a',
              background: '#f5f4f2',
              outline: 'none',
              marginBottom: error ? 8 : 16,
              transition: 'border-color .15s',
            }}
            onFocus={e => { if (!error) e.target.style.borderColor = '#1a1a1a' }}
            onBlur={e => { if (!error) e.target.style.borderColor = '#e4e2de' }}
          />

          {error && (
            <div style={{
              fontSize: 11,
              color: '#d12b2b',
              marginBottom: 12,
              fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: '100%',
              padding: '10px',
              background: loading || !password ? '#c0bdb8' : '#d12b2b',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'inherit',
              letterSpacing: '.04em',
              cursor: loading || !password ? 'not-allowed' : 'pointer',
              transition: 'background .15s',
            }}
          >
            {loading ? 'Masuk...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  )
}
