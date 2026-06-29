'use client'

import { useEffect, useRef, useState } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'

export default function ProfilePage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [googleConnected, setGoogleConnected] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [toast, setToast] = useState({ msg: '', err: false, show: false })
  const [tgConnected, setTgConnected] = useState(false)
  const [tgChatId, setTgChatId] = useState('')
  const [tgInput, setTgInput] = useState('')
  const [tgBusy, setTgBusy] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(msg: string, err = false) {
    setToast({ msg, err, show: true })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, show: false })), 2800)
  }

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : Promise.reject('unauth'))
      .then(u => {
        setName(u.name || '')
        setEmail(u.email || '')
        setGoogleConnected(u.identities?.includes('google') || false)
      })
      .catch(() => { window.location.href = '/login' })

    fetch('/api/telegram/connect')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.connected) { setTgConnected(true); setTgChatId(d.chat_id || '') } })
      .catch(() => {})

    return () => { if (toastTimer.current) clearTimeout(toastTimer.current) }
  }, [])

  async function connectTg() {
    const cid = tgInput.trim()
    if (!cid) return
    setTgBusy(true)
    try {
      const res = await fetch('/api/telegram/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: cid }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Gagal')
      setTgConnected(true); setTgChatId(cid); setTgInput('')
      showToast('Telegram tersimpan — klik Test buat mastiin.')
    } catch (e) { showToast(String((e as Error).message), true) }
    finally { setTgBusy(false) }
  }
  async function testTg() {
    setTgBusy(true)
    try {
      const res = await fetch('/api/telegram/test', { method: 'POST' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Gagal')
      showToast('Pesan tes terkirim — cek Telegram lu! 🐱')
    } catch (e) { showToast(String((e as Error).message), true) }
    finally { setTgBusy(false) }
  }
  async function disconnectTg() {
    setTgBusy(true)
    try {
      await fetch('/api/telegram/connect', { method: 'DELETE' })
      setTgConnected(false); setTgChatId(''); setTgInput('')
      showToast('Telegram di-disconnect.')
    } catch (e) { showToast(String((e as Error).message), true) }
    finally { setTgBusy(false) }
  }

  async function saveName() {
    if (!name.trim()) { showToast('Nama tidak boleh kosong', true); return }
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (res.ok) showToast('Nama berhasil disimpan')
      else {
        const d = await res.json().catch(() => ({}))
        showToast((d as { error?: string }).error || 'Gagal menyimpan', true)
      }
    } catch {
      showToast('Gagal menyimpan', true)
    } finally {
      setSaving(false)
    }
  }

  async function deleteAccount() {
    setDeleting(true)
    try {
      const res = await fetch('/api/auth/delete-account', { method: 'DELETE' })
      if (res.ok) {
        window.location.href = '/login'
      } else {
        const d = await res.json().catch(() => ({}))
        showToast((d as { error?: string }).error || 'Gagal menghapus akun', true)
        setShowDeleteConfirm(false)
      }
    } catch {
      showToast('Gagal menghapus akun', true)
      setShowDeleteConfirm(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <DashboardShell title="Profil">
      <div className="p-7 max-w-[560px]">

        {/* Name */}
        <div className="bg-[#0b1322] border border-white/8 rounded-lg mb-4 overflow-hidden">
          <div className="px-[18px] py-3.5 border-b border-white/8">
            <div className="text-[10px] font-bold tracking-[.1em] uppercase text-white/40">Nama Pengguna</div>
          </div>
          <div className="p-[18px]">
            <label className="text-[10px] font-semibold text-white/40 uppercase tracking-[.08em] mb-1.5 block">Nama</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveName()}
                placeholder="Nama kamu"
                className="flex-1 bg-white/5 border border-white/10 rounded-[5px] px-3 py-2 text-[12px] text-white outline-none focus:border-white/25 transition-colors"
              />
              <button
                onClick={saveName}
                disabled={saving}
                className="bg-white text-[#0a0a0a] border-none rounded-[5px] px-5 py-2 text-[11px] font-bold cursor-pointer transition-colors hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>

        {/* Email */}
        <div className="bg-[#0b1322] border border-white/8 rounded-lg mb-4 overflow-hidden">
          <div className="px-[18px] py-3.5 border-b border-white/8">
            <div className="text-[10px] font-bold tracking-[.1em] uppercase text-white/40">Info Akun</div>
          </div>
          <div className="p-[18px]">
            <label className="text-[10px] font-semibold text-white/40 uppercase tracking-[.08em] mb-1.5 block">Email</label>
            <input
              type="text"
              value={email}
              readOnly
              className="w-full bg-white/5 border border-white/8 rounded-[5px] px-3 py-2 text-[12px] text-white/35 cursor-default outline-none"
            />
          </div>
        </div>

        {/* Google */}
        <div className="bg-[#0b1322] border border-white/8 rounded-lg mb-4 overflow-hidden">
          <div className="px-[18px] py-3.5 border-b border-white/8">
            <div className="text-[10px] font-bold tracking-[.1em] uppercase text-white/40">Akun Terhubung</div>
          </div>
          <div className="p-[18px]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-lg">🔵</span>
                <div>
                  <div className="text-[12px] font-semibold text-white">Google</div>
                  <div className="text-[10px] text-white/40 mt-px">Masuk dengan akun Google</div>
                </div>
              </div>
              {googleConnected ? (
                <span className="inline-flex items-center gap-1.5 bg-green-950/60 text-green-400 border border-green-800/40 rounded-full px-3 py-1 text-[10px] font-bold">
                  ● Google terhubung
                </span>
              ) : (
                <a
                  href="/api/auth/link-google"
                  className="bg-blue-950/50 text-blue-400 border border-blue-800/40 rounded-[5px] px-4 py-2 text-[11px] font-bold transition-all hover:bg-blue-600 hover:text-white hover:border-blue-600 no-underline"
                >
                  Hubungkan Google
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Telegram */}
        <div className="bg-[#0b1322] border border-white/8 rounded-lg mb-4 overflow-hidden">
          <div className="px-[18px] py-3.5 border-b border-white/8 flex items-center justify-between">
            <div className="text-[10px] font-bold tracking-[.1em] uppercase text-white/40">Telegram</div>
            {tgConnected
              ? <span className="inline-flex items-center gap-1.5 bg-green-950/60 text-green-400 border border-green-800/40 rounded-full px-3 py-1 text-[10px] font-bold">● Connected</span>
              : <span className="inline-flex items-center gap-1.5 bg-white/5 text-white/40 border border-white/10 rounded-full px-3 py-1 text-[10px] font-bold">○ Belum</span>}
          </div>
          <div className="p-[18px]">
            <p className="text-[11px] text-white/45 leading-relaxed mb-2.5">Digest berita &amp; pengingat bisa dikirim ke Telegram. Cara connect:</p>
            <ol className="text-[11px] text-white/55 leading-relaxed mb-3.5 list-decimal pl-4 space-y-1">
              <li>Buka <a href="https://t.me/GST101_bot" target="_blank" rel="noopener noreferrer" className="text-blue-400 font-semibold no-underline hover:underline">@GST101_bot</a> → pencet <b>Start</b>.</li>
              <li>Ambil chat ID dari <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="text-blue-400 font-semibold no-underline hover:underline">@userinfobot</a> (dia bales angka ID lu).</li>
              <li>Paste ID-nya di bawah → Simpan → Test.</li>
            </ol>
            {tgConnected ? (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-[11px] text-white/55">chat_id: <span className="text-white font-semibold">{tgChatId}</span></div>
                <div className="flex gap-2">
                  <button onClick={testTg} disabled={tgBusy} className="bg-blue-950/50 text-blue-400 border border-blue-800/40 rounded-[5px] px-4 py-2 text-[11px] font-bold hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all disabled:opacity-50">Test</button>
                  <button onClick={disconnectTg} disabled={tgBusy} className="bg-white/5 text-white/55 border border-white/10 rounded-[5px] px-4 py-2 text-[11px] font-bold hover:bg-white/10 hover:text-white transition-all disabled:opacity-50">Disconnect</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <input value={tgInput} onChange={e => setTgInput(e.target.value)} placeholder="chat ID (angka)" className="flex-1 bg-white/5 border border-white/10 rounded-[5px] px-3 py-2 text-[12px] text-white outline-none focus:border-white/25 transition-colors" />
                <button onClick={connectTg} disabled={tgBusy || !tgInput.trim()} className="bg-white text-[#0a0a0a] border-none rounded-[5px] px-5 py-2 text-[11px] font-bold cursor-pointer hover:bg-white/90 disabled:opacity-50 transition-colors shrink-0">Simpan</button>
              </div>
            )}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-[#0b1322] border border-[#d12b2b]/30 rounded-lg overflow-hidden">
          <div className="px-[18px] py-3.5 border-b border-[#d12b2b]/20 bg-[#d12b2b]/8">
            <div className="text-[10px] font-bold tracking-[.1em] uppercase text-[#d12b2b]">Danger Zone</div>
          </div>
          <div className="p-[18px]">
            <p className="text-[11px] text-white/40 mb-3.5 leading-relaxed">
              Menghapus akun akan menghapus semua data kamu secara permanen. Tindakan ini tidak dapat dibatalkan.
            </p>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-transparent text-[#d12b2b] border border-[#d12b2b]/30 rounded-[5px] px-4 py-2 text-[11px] font-bold cursor-pointer transition-all hover:bg-[#d12b2b] hover:text-white hover:border-[#d12b2b]"
            >
              Hapus Akun
            </button>
          </div>
        </div>

      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-[500] flex items-center justify-center p-5">
          <div className="bg-[#1c1e27] border border-white/8 rounded-xl w-full max-w-[360px] shadow-[0_8px_32px_rgba(0,0,0,.6)]">
            <div className="px-5 pt-4 pb-3 border-b border-white/8">
              <div className="text-[13px] font-bold text-[#d12b2b]">Hapus Akun</div>
            </div>
            <div className="px-5 py-4 text-[12px] text-white/55 leading-relaxed">
              Kamu yakin ingin menghapus akun ini? Semua data akan hilang permanen dan tidak bisa dipulihkan.
            </div>
            <div className="px-5 pb-4 flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="bg-transparent border border-white/15 text-white/55 px-4 py-[7px] rounded-[5px] text-[11px] font-semibold cursor-pointer hover:border-white/30 hover:text-white transition-all"
              >
                Batal
              </button>
              <button
                onClick={deleteAccount}
                disabled={deleting}
                className="bg-[#d12b2b] border-none text-white px-5 py-[7px] rounded-[5px] text-[11px] font-bold cursor-pointer hover:bg-[#b32222] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      <div
        className={`fixed bottom-6 right-6 z-[9999] px-[18px] py-[11px] rounded-lg text-[12px] font-semibold shadow-[0_4px_16px_rgba(0,0,0,.4)] transition-all duration-[250ms] pointer-events-none text-white ${toast.show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} ${toast.err ? 'bg-[#d12b2b]' : 'bg-[#1c1e27] border border-white/10'}`}
      >
        {toast.msg}
      </div>
    </DashboardShell>
  )
}
