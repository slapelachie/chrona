import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create default user for single-user application
  const user = await prisma.user.upsert({
    where: { id: 'default-user' },
    update: {},
    create: {
      id: 'default-user',
      name: 'Default User',
      email: 'user@example.com',
      claimsTaxFreeThreshold: true,
      hasHECSDebt: false,
      hasStudentFinancialSupplement: false,
      medicareLevyExemption: false,
    },
  })
  console.log('👤 Created default user:', user.name)

  // Seed Australian Tax Brackets for 2024-25
  const taxBrackets2024_25 = [
    { minIncome: 0, maxIncome: 18200, taxRate: 0, baseTax: 0 },
    { minIncome: 18201, maxIncome: 45000, taxRate: 0.19, baseTax: 0 },
    { minIncome: 45001, maxIncome: 120000, taxRate: 0.325, baseTax: 5092 },
    { minIncome: 120001, maxIncome: 180000, taxRate: 0.37, baseTax: 29467 },
    { minIncome: 180001, maxIncome: null, taxRate: 0.45, baseTax: 51667 },
  ]

  for (const bracket of taxBrackets2024_25) {
    await prisma.taxBracket.upsert({
      where: {
        year_minIncome: {
          year: '2024-25',
          minIncome: bracket.minIncome,
        },
      },
      update: {},
      create: {
        year: '2024-25',
        minIncome: bracket.minIncome,
        maxIncome: bracket.maxIncome,
        taxRate: bracket.taxRate,
        baseTax: bracket.baseTax,
      },
    })
  }
  console.log('💰 Seeded 2024-25 tax brackets')

  // Seed HECS-HELP repayment thresholds for 2024-25
  const hecsThresholds2024_25 = [
    { minIncome: 51550, maxIncome: 59518, repaymentRate: 0.01 },
    { minIncome: 59519, maxIncome: 63089, repaymentRate: 0.02 },
    { minIncome: 63090, maxIncome: 66875, repaymentRate: 0.025 },
    { minIncome: 66876, maxIncome: 70888, repaymentRate: 0.03 },
    { minIncome: 70889, maxIncome: 75140, repaymentRate: 0.035 },
    { minIncome: 75141, maxIncome: 79649, repaymentRate: 0.04 },
    { minIncome: 79650, maxIncome: 84429, repaymentRate: 0.045 },
    { minIncome: 84430, maxIncome: 89494, repaymentRate: 0.05 },
    { minIncome: 89495, maxIncome: 94865, repaymentRate: 0.055 },
    { minIncome: 94866, maxIncome: 100560, repaymentRate: 0.06 },
    { minIncome: 100561, maxIncome: 106607, repaymentRate: 0.065 },
    { minIncome: 106608, maxIncome: 113028, repaymentRate: 0.07 },
    { minIncome: 113029, maxIncome: 119847, repaymentRate: 0.075 },
    { minIncome: 119848, maxIncome: 127090, repaymentRate: 0.08 },
    { minIncome: 127091, maxIncome: 134788, repaymentRate: 0.085 },
    { minIncome: 134789, maxIncome: 142974, repaymentRate: 0.09 },
    { minIncome: 142975, maxIncome: 151682, repaymentRate: 0.095 },
    { minIncome: 151683, maxIncome: null, repaymentRate: 0.10 },
  ]

  for (const threshold of hecsThresholds2024_25) {
    await prisma.hECSThreshold.upsert({
      where: {
        year_minIncome: {
          year: '2024-25',
          minIncome: threshold.minIncome,
        },
      },
      update: {},
      create: {
        year: '2024-25',
        minIncome: threshold.minIncome,
        maxIncome: threshold.maxIncome,
        repaymentRate: threshold.repaymentRate,
      },
    })
  }
  console.log('🎓 Seeded 2024-25 HECS thresholds')

  // Seed Australian Public Holidays for 2025 (National)
  const publicHolidays2025 = [
    { name: 'New Year\'s Day', date: new Date('2025-01-01'), state: 'NATIONAL' },
    { name: 'Australia Day', date: new Date('2025-01-27'), state: 'NATIONAL' },
    { name: 'Good Friday', date: new Date('2025-04-18'), state: 'NATIONAL' },
    { name: 'Easter Saturday', date: new Date('2025-04-19'), state: 'NATIONAL' },
    { name: 'Easter Monday', date: new Date('2025-04-21'), state: 'NATIONAL' },
    { name: 'ANZAC Day', date: new Date('2025-04-25'), state: 'NATIONAL' },
    { name: 'Queen\'s Birthday', date: new Date('2025-06-09'), state: 'NATIONAL' },
    { name: 'Christmas Day', date: new Date('2025-12-25'), state: 'NATIONAL' },
    { name: 'Boxing Day', date: new Date('2025-12-26'), state: 'NATIONAL' },
  ]

  for (const holiday of publicHolidays2025) {
    await prisma.publicHoliday.upsert({
      where: {
        date_state: {
          date: holiday.date,
          state: holiday.state,
        },
      },
      update: {},
      create: {
        name: holiday.name,
        date: holiday.date,
        state: holiday.state,
      },
    })
  }
  console.log('🎉 Seeded 2025 public holidays')

  // Create a sample pay guide based on General Retail Industry Award
  const payGuide = await prisma.payGuide.upsert({
    where: { id: 'retail-award-2024' },
    update: {},
    create: {
      id: 'retail-award-2024',
      name: 'General Retail Industry Award MA000004 - Level 1',
      effectiveFrom: new Date('2024-07-01'),
      isActive: true,
      userId: user.id,
      baseHourlyRate: 23.23, // Level 1 adult rate (example)
      casualLoading: 0.25, // 25% casual loading
      overtimeRate1_5x: 1.5,
      overtimeRate2x: 2.0,
      eveningPenalty: 1.15, // 15% evening penalty (6pm-10pm)
      nightPenalty: 1.30, // 30% night penalty (10pm-6am)
      saturdayPenalty: 1.25, // 25% Saturday penalty
      sundayPenalty: 1.75, // 75% Sunday penalty
      publicHolidayPenalty: 2.50, // 150% public holiday penalty
      eveningStart: '18:00',
      eveningEnd: '22:00',
      nightStart: '22:00',
      nightEnd: '06:00',
      dailyOvertimeHours: 8.0,
      weeklyOvertimeHours: 38.0,
    },
  })
  console.log('📋 Created sample pay guide:', payGuide.name)

  // Create sample shifts for demonstration
  const today = new Date()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay()) // Start of current week (Sunday)

  // Monday shift
  const mondayShift = new Date(startOfWeek)
  mondayShift.setDate(startOfWeek.getDate() + 1) // Monday
  mondayShift.setHours(9, 0, 0, 0) // 9 AM
  const mondayEnd = new Date(mondayShift)
  mondayEnd.setHours(17, 0, 0, 0) // 5 PM

  await prisma.shift.create({
    data: {
      userId: user.id,
      payGuideId: payGuide.id,
      startTime: mondayShift,
      endTime: mondayEnd,
      breakMinutes: 30,
      shiftType: 'REGULAR',
      status: 'COMPLETED',
      notes: 'Regular weekday shift',
    },
  })

  // Saturday shift with penalty
  const saturdayShift = new Date(startOfWeek)
  saturdayShift.setDate(startOfWeek.getDate() + 6) // Saturday
  saturdayShift.setHours(10, 0, 0, 0) // 10 AM
  const saturdayEnd = new Date(saturdayShift)
  saturdayEnd.setHours(16, 0, 0, 0) // 4 PM

  await prisma.shift.create({
    data: {
      userId: user.id,
      payGuideId: payGuide.id,
      startTime: saturdayShift,
      endTime: saturdayEnd,
      breakMinutes: 30,
      shiftType: 'WEEKEND',
      status: 'COMPLETED',
      notes: 'Saturday shift with penalty rates',
    },
  })

  console.log('⏰ Created sample shifts')

  console.log('✅ Seeding completed successfully!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })