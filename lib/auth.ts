import { createClient } from '@supabase/supabase-js'

export function getAccessToken(req: Request): string | null {
  const cookie = req.headers.get('cookie') || ''
  const match = cookie.match(/sb_access_token=([^;]+)/)
  return match ? match[1] : null
}

export function getUserIdFromJwt(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.sub || null
  } catch {
    return null
  }
}

export function createUserClient(accessToken: string) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

export function getAuthContext(req: Request) {
  const token = getAccessToken(req)
  if (!token) return null
  const userId = getUserIdFromJwt(token)
  if (!userId) return null
  return { token, userId, db: createUserClient(token) }
}
