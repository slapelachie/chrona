import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ensureDatabaseMigrated } from '@/lib/database-migration'

export async function GET(request: NextRequest) {
  try {
    let migrationsApplied = true
    try {
      await ensureDatabaseMigrated()
    } catch (err) {
      migrationsApplied = false
      console.error('Prisma migrations check failed during setup status probe:', err)
    }

    let userCount = 0
    let payGuides = 0
    let databaseHealthy = true

    try {
      userCount = await prisma.user.count()
      payGuides = await prisma.payGuide.count()
    } catch (err) {
      databaseHealthy = false
      console.error('Database check failed during setup status probe:', err)
    }

    const initialized = migrationsApplied && databaseHealthy && userCount > 0

    return NextResponse.json({
      data: {
        initialized,
        stats: { users: userCount, payGuides },
        checks: {
          migrationsApplied,
          databaseHealthy,
        },
      },
    }, {
      headers: request.headers.get('cache-control') ? undefined : { 'cache-control': 'no-store' },
    })
  } catch (e) {
    console.error('GET /api/setup/status failed:', e)
    return NextResponse.json({ error: 'Failed to load setup status' }, { status: 500 })
  }
}
