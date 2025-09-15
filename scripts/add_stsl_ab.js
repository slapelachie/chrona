// One-off script to add coefficientA/B to stsl_rates and backfill from legacy rate
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
;(async () => {
  try {
    // Add columns if they don't exist
    await prisma.$executeRawUnsafe(`ALTER TABLE stsl_rates ADD COLUMN coefficientA DECIMAL DEFAULT 0`)
  } catch (e) {
    // ignore if exists
  }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE stsl_rates ADD COLUMN coefficientB DECIMAL DEFAULT 0`)
  } catch (e) {
    // ignore if exists
  }
  try {
    await prisma.$executeRawUnsafe(`UPDATE stsl_rates SET coefficientA = COALESCE(rate, 0), coefficientB = 0 WHERE coefficientA = 0 AND coefficientB = 0`)
  } catch (e) {
    console.error('Failed to backfill coefficients:', e)
  }
  await prisma.$disconnect()
  console.log('STSL coefficients A/B ensured and backfilled')
})()

