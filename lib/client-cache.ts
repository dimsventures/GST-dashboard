// Shared client-side request cache.
//
// Tujuan: beberapa komponen (Sidebar, TopBar, halaman) sering memanggil
// endpoint yang sama pada saat yang hampir bersamaan. Tanpa ini, satu kali
// buka dashboard bisa memicu 3 request /api/data (masing-masing menarik
// ribuan activity). Cache ini hanya menggabungkan request yang sedang
// berjalan (in-flight dedupe), jadi data yang ditampilkan tetap fresh.

const pending = new Map<string, Promise<unknown>>()

export function sharedFetch<T>(
  url: string,
  parse: (res: Response) => Promise<T>
): Promise<T> {
  const existing = pending.get(url)
  if (existing) return existing as Promise<T>

  const request = fetch(url)
    .then(parse)
    .finally(() => { pending.delete(url) })

  pending.set(url, request)
  return request
}

export interface AppUser {
  id: string
  email?: string
  name: string
  identities: string[]
}

export function fetchAppData<T = Record<string, unknown>>(): Promise<T> {
  return sharedFetch<T>('/api/data', res => res.json())
}

export function fetchMe(): Promise<AppUser | null> {
  return sharedFetch<AppUser | null>('/api/auth/me', res => (
    res.ok ? res.json() : Promise.resolve(null)
  )).catch(() => null)
}
