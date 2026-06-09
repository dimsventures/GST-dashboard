'use client'

import { useState, useEffect, FormEvent } from 'react'
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

  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return
    const params = new URLSearchParams(hash.slice(1))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    if (accessToken && refreshToken) {
      setLoading(true)
      setCookiesAndRedirect(accessToken, refreshToken)
    }
  }, [])

  async function handleGoogleLogin() {
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })
    if (err) {
      setError(err.message)
      setLoading(false)
    }
  }

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

        <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0', gap: 8 }}>
          <div style={{ flex: 1, height: 1, background: '#e4e2de' }} />
          <span style={{ fontSize: 10, color: '#aaa', fontWeight: 500 }}>atau</span>
          <div style={{ flex: 1, height: 1, background: '#e4e2de' }} />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            width: '100%', padding: '10px', border: '1px solid #e4e2de', borderRadius: 6,
            fontSize: 12, fontWeight: 600, fontFamily: 'inherit', letterSpacing: '.02em',
            cursor: loading ? 'not-allowed' : 'pointer',
            background: '#fff', color: '#1a1a1a', transition: 'background .15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Lanjut dengan Google
        </button>
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
