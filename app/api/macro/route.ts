import { NextResponse } from 'next/server'
import { getMacroData, hasFredKey } from '@/lib/macro-data'

export const revalidate = 1800 // 30 menit

export async function GET() {
  if (!hasFredKey()) return NextResponse.json({ error: 'FRED_API_KEY belum di-set di environment.' }, { status: 500 })
  try {
    return NextResponse.json(await getMacroData())
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
