# GST Dashboard — Claude Context

## Arsitektur
- **UI utama**: Next.js App Router, React pages di `app/(dashboard)/*/page.tsx` (dashboard, gst, finance, portfolio, profile) — `public/*.html` lama udah dihapus (dead code sejak migrasi React kelar)
- **Shared layout**: `components/layout/Sidebar.tsx` dan `TopBar.tsx` dipakai semua halaman
- **Backend**: Next.js App Router, API routes per fitur di `app/api/` (data, entries, lessons, todos, goals, wishes, finance-*, portfolio/*, dll)
- **Database**: Supabase — akses server-side only via env var `SUPABASE_URL` + `SUPABASE_ANON_KEY`
- **Deploy**: Vercel — push ke `main` = auto deploy ke `gst-dashboard-tau.vercel.app`

## File penting
- `app/(dashboard)/gst/page.tsx` — GST tracker (todo, lesson, wishes, calendar) — dulu namanya legacy.html
- `app/(dashboard)/dashboard/page.tsx`, `finance/page.tsx`, `portfolio/page.tsx`, `profile/page.tsx` — halaman lain
- `app/api/data/route.ts` — GET semua tabel sekaligus
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
- Edit `page.tsx` halaman terkait langsung di `app/(dashboard)/` — jangan buat file baru kecuali API route
- Commit message: conventional commits (feat:, fix:, security:) + Co-Authored-By Claude

## Next.js
Versi ini mungkin berbeda dari training data — cek `node_modules/next/dist/docs/` jika ragu.
