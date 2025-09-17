import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const userCount = await prisma.user.count()
    const payGuides = await prisma.payGuide.count()
    const initialized = userCount > 0
    return NextResponse.json({
      data: {
        initialized,
        stats: { users: userCount, payGuides }
      }
    })
  } catch (e) {
    console.error('GET /api/setup/status failed:', e)
    return NextResponse.json({ error: 'Failed to load setup status' }, { status: 500 })
  }
}

