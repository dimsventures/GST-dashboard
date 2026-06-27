import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getNewsDigest, currentSlot } from '@/lib/news'

export const maxDuration = 60

export async function GET(req: Request) {
  if (!getAuthContext(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY belum di-set.' }, { status: 503 })
  try {
    return NextResponse.json(await getNewsDigest(currentSlot()))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
