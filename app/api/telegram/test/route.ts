import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { sendTelegram, hasTelegram } from '@/lib/telegram'

export async function POST(req: Request) {
  const ctx = getAuthContext(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasTelegram()) return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN belum di-set di server (cek project Vercel GST).' }, { status: 503 })
  const { data } = await ctx.db.from('user_telegram').select('chat_id').eq('user_id', ctx.userId).maybeSingle()
  if (!data?.chat_id) return NextResponse.json({ error: 'Belum ada chat_id — connect dulu.' }, { status: 400 })
  try {
    await sendTelegram(data.chat_id, '✅ <b>Tes dari GST Dashboard berhasil!</b>\nNotifikasi (digest berita, dll) bakal nyampe ke sini.')
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
