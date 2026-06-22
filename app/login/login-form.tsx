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
      router.push('/dashboard')
    } else {
      setError('Gagal menyimpan session.')
      setLoading(false)
    }
  }

  const isLogin = mode === 'login'
  const disabled = loading || !email || !password

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(620px 520px at 50% 50%, rgba(62,109,240,.34) 0%, rgba(30,44,92,.42) 34%, rgba(11,12,16,1) 70%), #0b0c10',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Poppins', sans-serif",
      padding: 16,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        .gl-inp::placeholder{color:#5b6273;}
        .gl-inp:focus{border-color:#3e6df0 !important;}
        .gl-inp:-webkit-autofill,.gl-inp:-webkit-autofill:hover,.gl-inp:-webkit-autofill:focus{-webkit-box-shadow:0 0 0 1000px #1c1e27 inset !important;-webkit-text-fill-color:#eef0f5 !important;caret-color:#eef0f5;}
        .gl-btn-primary:not(:disabled):hover{background:#2f56d1 !important;}
        .gl-btn-google:hover{background:#23262f !important;border-color:rgba(255,255,255,.2) !important;}
        .gl-tab:hover{filter:brightness(1.12);}
      `}</style>
      <div style={{
        background: '#15161c',
        border: '1px solid rgba(255,255,255,.08)',
        borderRadius: 14,
        padding: '40px 36px',
        width: '100%',
        maxWidth: 380,
        boxShadow: '0 14px 44px rgba(0,0,0,.55), 0 6px 22px rgba(62,109,240,.16)',
      }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#eef0f5', letterSpacing: '.02em' }}>
            GST<span style={{ color: '#3e6df0' }}>.</span>
          </div>
          <div style={{ fontSize: 11, color: '#687087', marginTop: 4 }}>
            {isLogin ? 'Masuk ke akun kamu' : 'Buat akun baru'}
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: 0,
          marginBottom: 20,
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,.1)',
          overflow: 'hidden',
        }}>
          <button
            type="button"
            className="gl-tab"
            onClick={() => { setMode('login'); setError(''); setSuccess('') }}
            style={{
              flex: 1, padding: '8px', border: 'none', fontSize: 11, fontWeight: 600,
              fontFamily: 'inherit', cursor: 'pointer',
              background: isLogin ? '#3e6df0' : 'rgba(255,255,255,.03)',
              color: isLogin ? '#fff' : '#97a0b3',
              transition: 'all .15s',
            }}
          >Masuk</button>
          <button
            type="button"
            className="gl-tab"
            onClick={() => { setMode('register'); setError(''); setSuccess('') }}
            style={{
              flex: 1, padding: '8px', border: 'none', fontSize: 11, fontWeight: 600,
              fontFamily: 'inherit', cursor: 'pointer',
              background: !isLogin ? '#3e6df0' : 'rgba(255,255,255,.03)',
              color: !isLogin ? '#fff' : '#97a0b3',
              transition: 'all .15s',
            }}
          >Daftar</button>
        </div>

        {success && (
          <div style={{
            fontSize: 11, color: '#34d399', marginBottom: 14, fontWeight: 500,
            background: 'rgba(52,211,153,.1)', padding: '8px 10px', borderRadius: 7,
            border: '1px solid rgba(52,211,153,.28)',
          }}>{success}</div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <>
              <label style={labelStyle}>Nama</label>
              <input
                type="text"
                className="gl-inp"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Nama kamu"
                style={inputStyle(false)}
              />
            </>
          )}

          <label style={labelStyle}>Email</label>
          <input
            type="email"
            className="gl-inp"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="email@example.com"
            autoFocus
            required
            style={inputStyle(false)}
          />

          <label style={labelStyle}>Password</label>
          <input
            type="password"
            className="gl-inp"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={isLogin ? 'Password' : 'Min. 6 karakter'}
            required
            style={inputStyle(!!error)}
          />

          {error && (
            <div style={{
              fontSize: 11, color: '#f6685e', marginBottom: 12, fontWeight: 500,
            }}>{error}</div>
          )}

          <button
            type="submit"
            className="gl-btn-primary"
            disabled={disabled}
            style={{
              width: '100%', padding: '11px', border: 'none', borderRadius: 8,
              fontSize: 12, fontWeight: 600, fontFamily: 'inherit', letterSpacing: '.04em',
              cursor: disabled ? 'not-allowed' : 'pointer',
              background: disabled ? '#2a2d3a' : '#3e6df0',
              color: disabled ? '#687087' : '#fff', transition: 'background .15s', marginTop: 4,
            }}
          >
            {loading ? 'Tunggu...' : isLogin ? 'Masuk' : 'Daftar'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0', gap: 8 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.08)' }} />
          <span style={{ fontSize: 10, color: '#687087', fontWeight: 500 }}>atau</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.08)' }} />
        </div>

        <button
          type="button"
          className="gl-btn-google"
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            width: '100%', padding: '11px', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8,
            fontSize: 12, fontWeight: 600, fontFamily: 'inherit', letterSpacing: '.02em',
            cursor: loading ? 'not-allowed' : 'pointer',
            background: '#1c1e27', color: '#eef0f5', transition: 'all .15s',
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

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: '#97a0b3', display: 'block', marginBottom: 4,
}

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: '100%', padding: '10px 13px',
    border: `1px solid ${hasError ? '#f6685e' : 'rgba(255,255,255,.09)'}`,
    borderRadius: 8, fontSize: 13, fontFamily: 'inherit',
    color: '#eef0f5', background: '#1c1e27', outline: 'none',
    marginBottom: 14, transition: 'border-color .15s',
    boxSizing: 'border-box' as const,
  }
}
