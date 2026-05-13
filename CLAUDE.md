# GST Dashboard — Claude Context

## Arsitektur
- **UI utama**: `public/legacy.html` — single-file SPA, semua logic frontend ada di sini
- **Backend**: Next.js App Router, API routes di `app/api/` (data, entries, lessons, todos, goals, wishes)
- **Database**: Supabase — akses server-side only via env var `SUPABASE_URL` + `SUPABASE_ANON_KEY`
- **Deploy**: Vercel — push ke `main` = auto deploy ke `gst-dashboard-tau.vercel.app`

## File penting
- `public/legacy.html` — edit di sini untuk semua perubahan UI/logic
- `app/api/data/route.ts` — GET semua tabel sekaligus
- `app/api/[table]/route.ts` — POST upsert + DELETE per tabel
- `.env.local` — SUPABASE_URL dan SUPABASE_ANON_KEY (jangan commit)

## Database tables
- `entries` — log harian (date, rel/rs, work/ws, mkt/ms, phy/ps, soc, extra)
- `lessons` — field `text` berisi JSON array items `[{id, text, ts}]`
- `todos` — task harian (id, text, cat, done, done_date)
- `goals` — target tahunan/bulanan (id, text, scope, yr, ym, done, done_date)
- `wishes` — dream list (id, text, done, done_date, achievement_story, created_at)

## Aturan coding
- Tidak ada komentar kecuali WHY yang non-obvious
- Bahasa Indonesia informal saat komunikasi
- Edit `legacy.html` langsung — jangan buat file baru kecuali API route
- Commit message: conventional commits (feat:, fix:, security:) + Co-Authored-By Claude

## Next.js
Versi ini mungkin berbeda dari training data — cek `node_modules/next/dist/docs/` jika ragu.
