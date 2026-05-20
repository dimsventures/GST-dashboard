'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

interface Props {
  supabaseUrl: string
  supabaseKey: string
}

export default function LoginForm({ supabaseUrl, supabaseKey }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (mode === 'register') {
      if (password.length < 6) {
        setError('Password minimal 6 karakter.')
        setLoading(false)
        return
      }

      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name || email.split('@')[0] } }
      })

      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }

      if (data.session) {
        await setCookiesAndRedirect(data.session.access_token, data.session.refresh_token)
      } else {
        setSuccess('Cek email untuk verifikasi, lalu login.')
        setMode('login')
        setLoading(false)
      }
    } else {
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (err) {
        setError(err.message === 'Invalid login credentials' ? 'Email atau password salah.' : err.message)
        setLoading(false)
        return
      }

      if (data.session) {
        await setCookiesAndRedirect(data.session.access_token, data.session.refresh_token)
      }
    }
  }

  async function setCookiesAndRedirect(accessToken: string, refreshToken: string) {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
    })
    if (res.ok) {
      router.push('/dashboard.html')
    } else {
      setError('Gagal menyimpan session.')
      setLoading(false)
    }
  }

  const isLogin = mode === 'login'

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
        maxWidth: 380,
        boxShadow: '0 8px 24px rgba(0,0,0,.08)',
      }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', letterSpacing: '.02em' }}>
            GST<span style={{ color: '#d12b2b' }}>.</span>
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
            {isLogin ? 'Masuk ke akun kamu' : 'Buat akun baru'}
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: 0,
          marginBottom: 20,
          borderRadius: 6,
          border: '1px solid #e4e2de',
          overflow: 'hidden',
        }}>
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); setSuccess('') }}
            style={{
              flex: 1, padding: '8px', border: 'none', fontSize: 11, fontWeight: 600,
              fontFamily: 'inherit', cursor: 'pointer',
              background: isLogin ? '#1a1a1a' : '#f5f4f2',
              color: isLogin ? '#fff' : '#888',
              transition: 'all .15s',
            }}
          >Masuk</button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(''); setSuccess('') }}
            style={{
              flex: 1, padding: '8px', border: 'none', fontSize: 11, fontWeight: 600,
              fontFamily: 'inherit', cursor: 'pointer',
              background: !isLogin ? '#1a1a1a' : '#f5f4f2',
              color: !isLogin ? '#fff' : '#888',
              transition: 'all .15s',
            }}
          >Daftar</button>
        </div>

        {success && (
          <div style={{
            fontSize: 11, color: '#15a34a', marginBottom: 14, fontWeight: 500,
            background: '#f0fdf4', padding: '8px 10px', borderRadius: 6,
            border: '1px solid #bbf7d0',
          }}>{success}</div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <>
              <label style={{ fontSize: 10, fontWeight: 600, color: '#4a4a4a', display: 'block', marginBottom: 4 }}>
                Nama
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Nama kamu"
                style={inputStyle(false)}
              />
            </>
          )}

          <label style={{ fontSize: 10, fontWeight: 600, color: '#4a4a4a', display: 'block', marginBottom: 4 }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="email@example.com"
            autoFocus
            required
            style={inputStyle(false)}
          />

          <label style={{ fontSize: 10, fontWeight: 600, color: '#4a4a4a', display: 'block', marginBottom: 4 }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={isLogin ? 'Password' : 'Min. 6 karakter'}
            required
            style={inputStyle(!!error)}
          />

          {error && (
            <div style={{
              fontSize: 11, color: '#d12b2b', marginBottom: 12, fontWeight: 500,
            }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            style={{
              width: '100%', padding: '10px', border: 'none', borderRadius: 6,
              fontSize: 12, fontWeight: 600, fontFamily: 'inherit', letterSpacing: '.04em',
              cursor: loading || !email || !password ? 'not-allowed' : 'pointer',
              background: loading || !email || !password ? '#c0bdb8' : '#d12b2b',
              color: '#fff', transition: 'background .15s', marginTop: 4,
            }}
          >
            {loading ? 'Tunggu...' : isLogin ? 'Masuk' : 'Daftar'}
          </button>
        </form>
      </div>
    </div>
  )
}

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: '100%', padding: '10px 13px',
    border: `1px solid ${hasError ? '#d12b2b' : '#e4e2de'}`,
    borderRadius: 6, fontSize: 13, fontFamily: 'inherit',
    color: '#1a1a1a', background: '#f5f4f2', outline: 'none',
    marginBottom: 14, transition: 'border-color .15s',
    boxSizing: 'border-box' as const,
  }
}
