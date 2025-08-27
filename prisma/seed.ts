import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Clear existing seed data
  await prisma.hecsThreshold.deleteMany()
  await prisma.taxBracket.deleteMany()
  await prisma.payRate.deleteMany()
  await prisma.settings.deleteMany()

  // 2024-25 Australian Tax Brackets
  console.log('📊 Seeding tax brackets...')
  await prisma.taxBracket.createMany({
    data: [
      {
        taxYear: '2024-25',
        minIncome: 0,
        maxIncome: 18200,
        taxRate: 0,
        baseAmount: 0,
      },
      {
        taxYear: '2024-25',
        minIncome: 18201,
        maxIncome: 45000,
        taxRate: 19,
        baseAmount: 0,
      },
      {
        taxYear: '2024-25',
        minIncome: 45001,
        maxIncome: 120000,
        taxRate: 32.5,
        baseAmount: 5092,
      },
      {
        taxYear: '2024-25',
        minIncome: 120001,
        maxIncome: 180000,
        taxRate: 37,
        baseAmount: 29467,
      },
      {
        taxYear: '2024-25',
        minIncome: 180001,
        maxIncome: null, // No upper limit for highest bracket
        taxRate: 45,
        baseAmount: 51667,
      },
    ],
  })

  // 2024-25 HECS Repayment Thresholds
  console.log('🎓 Seeding HECS thresholds...')
  await prisma.hecsThreshold.createMany({
    data: [
      { taxYear: '2024-25', minIncome: 51550, maxIncome: 59518, repaymentRate: 1 },
      { taxYear: '2024-25', minIncome: 59519, maxIncome: 63089, repaymentRate: 2 },
      { taxYear: '2024-25', minIncome: 63090, maxIncome: 66875, repaymentRate: 2.5 },
      { taxYear: '2024-25', minIncome: 66876, maxIncome: 70888, repaymentRate: 3 },
      { taxYear: '2024-25', minIncome: 70889, maxIncome: 75140, repaymentRate: 3.5 },
      { taxYear: '2024-25', minIncome: 75141, maxIncome: 79649, repaymentRate: 4 },
      { taxYear: '2024-25', minIncome: 79650, maxIncome: 84429, repaymentRate: 4.5 },
      { taxYear: '2024-25', minIncome: 84430, maxIncome: 89494, repaymentRate: 5 },
      { taxYear: '2024-25', minIncome: 89495, maxIncome: 94865, repaymentRate: 5.5 },
      { taxYear: '2024-25', minIncome: 94866, maxIncome: 100560, repaymentRate: 6 },
      { taxYear: '2024-25', minIncome: 100561, maxIncome: 106599, repaymentRate: 6.5 },
      { taxYear: '2024-25', minIncome: 106600, maxIncome: 113002, repaymentRate: 7 },
      { taxYear: '2024-25', minIncome: 113003, maxIncome: 119789, repaymentRate: 7.5 },
      { taxYear: '2024-25', minIncome: 119790, maxIncome: 126982, repaymentRate: 8 },
      { taxYear: '2024-25', minIncome: 126983, maxIncome: 134606, repaymentRate: 8.5 },
      { taxYear: '2024-25', minIncome: 134607, maxIncome: 142682, repaymentRate: 9 },
      { taxYear: '2024-25', minIncome: 142683, maxIncome: 151237, repaymentRate: 9.5 },
      { taxYear: '2024-25', minIncome: 151238, maxIncome: null, repaymentRate: 10 },
    ],
  })

  // Default Settings
  console.log('⚙️  Creating default settings...')
  const defaultSettings = await prisma.settings.create({
    data: {
      taxFreeThreshold: true,
      medicareExemption: false,
      hecsDebtAmount: null,
      hecsThreshold: null,
      hecsRate: null,
      extraTaxWithheld: 0,
      superRate: 11, // Current superannuation guarantee rate
      payPeriodType: 'FORTNIGHTLY',
      payPeriodStartDay: 1, // Monday
    },
  })

  // Sample Pay Rates (Australian casual rates)
  console.log('💰 Creating sample pay rates...')
  const baseDate = new Date('2024-07-01') // Start of 2024-25 financial year

  await prisma.payRate.createMany({
    data: [
      {
        name: 'Casual Base Rate',
        description: 'Standard casual hourly rate with 25% loading',
        baseRate: 28.50,
        effectiveFrom: baseDate,
        rateType: 'BASE',
        multiplier: 1.25, // Casual loading
        isDefault: true,
        applyWeekend: false,
        applyPublicHoliday: false,
        applyNight: false,
      },
      {
        name: 'Weekend Rate',
        description: 'Weekend casual rate (Saturday/Sunday)',
        baseRate: 28.50,
        effectiveFrom: baseDate,
        rateType: 'PENALTY',
        multiplier: 1.5, // Weekend penalty
        isDefault: false,
        applyWeekend: true,
        applyPublicHoliday: false,
        applyNight: false,
      },
      {
        name: 'Public Holiday Rate',
        description: 'Public holiday casual rate',
        baseRate: 28.50,
        effectiveFrom: baseDate,
        rateType: 'PENALTY',
        multiplier: 2.5, // Public holiday penalty
        isDefault: false,
        applyWeekend: false,
        applyPublicHoliday: true,
        applyNight: false,
      },
      {
        name: 'Night Rate',
        description: 'Night shift rate (10pm-6am)',
        baseRate: 28.50,
        effectiveFrom: baseDate,
        rateType: 'PENALTY',
        multiplier: 1.15, // Night loading
        isDefault: false,
        applyWeekend: false,
        applyPublicHoliday: false,
        applyNight: true,
        nightStart: '22:00',
        nightEnd: '06:00',
      },
      {
        name: 'Overtime Rate',
        description: 'Overtime rate after 8 hours per day',
        baseRate: 28.50,
        effectiveFrom: baseDate,
        rateType: 'OVERTIME',
        multiplier: 1.5, // Time and a half
        isDefault: false,
        applyWeekend: false,
        applyPublicHoliday: false,
        applyNight: false,
        overtimeThreshold: 8, // After 8 hours per day
        overtimeMultiplier: 1.5,
      },
    ],
  })

  console.log('✅ Database seed completed successfully!')
  console.log(`📈 Created ${await prisma.taxBracket.count()} tax brackets`)
  console.log(`🎓 Created ${await prisma.hecsThreshold.count()} HECS thresholds`)
  console.log(`💰 Created ${await prisma.payRate.count()} pay rates`)
  console.log(`⚙️  Created default settings record`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })