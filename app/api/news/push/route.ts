import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getNewsDigest, currentSlot, type NewsDigest } from '@/lib/news'
import { sendTelegram, hasTelegram, escapeHtml } from '@/lib/telegram'

export const maxDuration = 60

const EMOJI: Record<string, string> = { Macro: '🟡', AI: '🔵', Behavioral: '🟣' }

function buildMessage(d: NewsDigest): string {
  const tgl = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' })
  let msg = `📰 <b>GST Daily Digest</b> — ${tgl}\n`
  for (const g of d.groups) {
    if (!g.items.length) continue
    msg += `\n${EMOJI[g.topic] || '•'} <b>${escapeHtml(g.label)}</b>\n`
    for (const it of g.items.slice(0, 3)) {
      const t = escapeHtml(it.title)
      msg += it.url ? `• <a href="${it.url}">${t}</a>\n` : `• ${t}\n`
    }
  }
  let interp = (d.interpretation || '').trim()
  if (interp.length > 1400) interp = interp.slice(0, 1400).trim() + '…'
  interp = escapeHtml(interp).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  msg += `\n🐱 <b>Interpretasi</b>\n${interp}\n`
  msg += `\n👉 Lengkapnya: https://gst-hq.vercel.app/news`
  return msg
}

// Dipanggil Vercel Cron 1×/hari (Vercel otomatis kirim header Authorization: Bearer CRON_SECRET)
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization') || ''
  if (secret && auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!hasTelegram()) return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN belum di-set.' }, { status: 503 })
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_URL) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY/URL belum di-set.' }, { status: 503 })

  try {
    const d = await getNewsDigest(currentSlot())
    if (!d.groups.length) return NextResponse.json({ ok: false, reason: 'digest kosong' })
    const msg = buildMessage(d)
    const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const { data: users, error } = await admin.from('user_telegram').select('chat_id')
    if (error) throw new Error(error.message)
    const chatIds = (users || []).map(u => u.chat_id).filter(Boolean)
    let sent = 0, failed = 0
    for (const cid of chatIds) {
      try { await sendTelegram(cid, msg); sent++ } catch { failed++ }
    }
    return NextResponse.json({ ok: true, recipients: chatIds.length, sent, failed })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
