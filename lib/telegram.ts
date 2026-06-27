const TOKEN = process.env.TELEGRAM_BOT_TOKEN

export function hasTelegram() { return !!TOKEN }

// Kirim pesan ke 1 chat. parse_mode HTML — escape teks user pakai escapeHtml() kalau perlu.
export async function sendTelegram(chatId: string, text: string) {
  if (!TOKEN) throw new Error('TELEGRAM_BOT_TOKEN belum di-set di server.')
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const j: any = await r.json().catch(() => ({}))
  if (!j.ok) throw new Error(j.description || `Telegram error (${r.status})`)
  return j
}

export function escapeHtml(s: string) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
