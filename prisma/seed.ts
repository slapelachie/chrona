import { PrismaClient } from '@prisma/client'
import { Decimal } from 'decimal.js'
import { 
  calculateAndUpdateShift, 
  updateShiftWithCalculation, 
  fetchShiftBreakPeriods 
} from '../src/lib/shift-calculation'
import { PayPeriodSyncService } from '../src/lib/pay-period-sync-service'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seeding...')

  // Create default user
  console.log('👤 Creating default user...')
  const user = await prisma.user.upsert({
    where: { email: 'user@chrona.app' },
    update: {},
    create: {
      name: 'Default User',
      email: 'user@chrona.app',
      timezone: 'Australia/Sydney',
    },
  })
  console.log(`✅ Created user: ${user.name} (${user.id})`)

  // Create default tax settings for the user
  console.log('💰 Creating default tax settings...')
  const taxSettings = await prisma.taxSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      claimedTaxFreeThreshold: true,
      isForeignResident: false,
      hasTaxFileNumber: true,
      medicareExemption: 'none',
      hecsHelpRate: null,
    },
  })
  console.log(`✅ Created tax settings for user`)

  // Create Australian Retail Award Pay Guide
  console.log('💰 Creating Australian Retail Award pay guide...')
  const retailPayGuide = await prisma.payGuide.upsert({
    where: { name: 'General Retail Industry Award 2020' },
    update: {},
    create: {
      name: 'General Retail Industry Award 2020',
      baseRate: new Decimal('26.55'), // Updated rate per test data
      minimumShiftHours: 3,
      maximumShiftHours: 11,
      timezone: 'Australia/Brisbane', // Per test data
      description:
        'General Retail Industry Award 2020 - Adult casual employee minimum rates',
      effectiveFrom: new Date('2025-07-01'), // Updated to match test data
      isActive: true,
    },
  })
  console.log(
    `✅ Created pay guide: ${retailPayGuide.name} (${retailPayGuide.id})`
  )

  // Create Hospitality Award Pay Guide
  console.log('🍽️ Creating Hospitality Award pay guide...')
  const hospitalityPayGuide = await prisma.payGuide.upsert({
    where: { name: 'Hospitality Industry (General) Award 2020' },
    update: {},
    create: {
      name: 'Hospitality Industry (General) Award 2020',
      baseRate: new Decimal('26.55'), // Updated to match retail
      minimumShiftHours: 3,
      maximumShiftHours: 11,
      timezone: 'Australia/Sydney',
      description:
        'Hospitality Industry (General) Award 2020 - Adult casual employee minimum rates',
      effectiveFrom: new Date('2025-07-01'), // Updated date
      isActive: true,
    },
  })
  console.log(
    `✅ Created pay guide: ${hospitalityPayGuide.name} (${hospitalityPayGuide.id})`
  )

  // Create Penalty Time Frames for Retail Award
  console.log('⏰ Creating penalty time frames for retail award...')

  // Saturday penalty (150%)
  const saturdayPenalty = await prisma.penaltyTimeFrame.create({
    data: {
      payGuideId: retailPayGuide.id,
      name: 'Saturday Penalty',
      multiplier: new Decimal('1.5'),
      dayOfWeek: 6, // Saturday
      description: '150% penalty rate for Saturday work',
      isActive: true,
    },
  })

  // Sunday penalty (200%)
  const sundayPenalty = await prisma.penaltyTimeFrame.create({
    data: {
      payGuideId: retailPayGuide.id,
      name: 'Sunday Penalty',
      multiplier: new Decimal('2.0'),
      dayOfWeek: 0, // Sunday
      description: '200% penalty rate for Sunday work',
      isActive: true,
    },
  })

  // Evening penalty (125% after 6pm weekdays)
  const eveningPenalty = await prisma.penaltyTimeFrame.create({
    data: {
      payGuideId: retailPayGuide.id,
      name: 'Evening Penalty (Weekdays)',
      multiplier: new Decimal('1.25'),
      startTime: '18:00',
      endTime: '23:59',
      description: '125% penalty rate for weekday evening work (6pm-midnight)',
      isActive: true,
    },
  })

  // Night penalty (130% after midnight)
  const nightPenalty = await prisma.penaltyTimeFrame.create({
    data: {
      payGuideId: retailPayGuide.id,
      name: 'Night Penalty',
      multiplier: new Decimal('1.3'),
      startTime: '00:00',
      endTime: '06:00',
      description: '130% penalty rate for night work (midnight-6am)',
      isActive: true,
    },
  })

  // Public holiday penalty (250%)
  const publicHolidayPenalty = await prisma.penaltyTimeFrame.create({
    data: {
      payGuideId: retailPayGuide.id,
      name: 'Public Holiday Penalty',
      multiplier: new Decimal('2.5'),
      isPublicHoliday: true,
      description: '250% penalty rate for public holiday work',
      isActive: true,
    },
  })

  console.log(`✅ Created ${6} penalty time frames for retail award`)

  // Create similar penalty time frames for hospitality award
  console.log('🍽️ Creating penalty time frames for hospitality award...')

  await prisma.penaltyTimeFrame.createMany({
    data: [
      {
        payGuideId: hospitalityPayGuide.id,
        name: 'Saturday Penalty',
        multiplier: new Decimal('1.5'),
        dayOfWeek: 6,
        description: '150% penalty rate for Saturday work',
        isActive: true,
      },
      {
        payGuideId: hospitalityPayGuide.id,
        name: 'Sunday Penalty',
        multiplier: new Decimal('1.75'),
        dayOfWeek: 0,
        description: '175% penalty rate for Sunday work',
        isActive: true,
      },
      {
        payGuideId: hospitalityPayGuide.id,
        name: 'Evening Penalty (Weekdays)',
        multiplier: new Decimal('1.1'),
        startTime: '19:00',
        endTime: '23:59',
        description:
          '110% penalty rate for weekday evening work (7pm-midnight)',
        isActive: true,
      },
      {
        payGuideId: hospitalityPayGuide.id,
        name: 'Night Penalty',
        multiplier: new Decimal('1.15'),
        startTime: '00:00',
        endTime: '07:00',
        description: '115% penalty rate for night work (midnight-7am)',
        isActive: true,
      },
      {
        payGuideId: hospitalityPayGuide.id,
        name: 'Public Holiday Penalty',
        multiplier: new Decimal('2.5'),
        isPublicHoliday: true,
        description: '250% penalty rate for public holiday work',
        isActive: true,
      },
    ],
  })

  console.log(`✅ Created penalty time frames for hospitality award`)

  // Create overtime time frames for retail award
  console.log('⏰ Creating overtime time frames for retail award...')
  await prisma.overtimeTimeFrame.createMany({
    data: [
      {
        payGuideId: retailPayGuide.id,
        name: 'Daily Overtime - Weekdays',
        firstThreeHoursMult: new Decimal('1.75'),
        afterThreeHoursMult: new Decimal('2.25'),
        description:
          'Daily overtime for weekdays (1.75x first 3hrs, 2.25x after)',
        isActive: true,
      },
      {
        payGuideId: retailPayGuide.id,
        name: 'Daily Overtime - Sunday',
        firstThreeHoursMult: new Decimal('2.25'),
        afterThreeHoursMult: new Decimal('2.25'),
        dayOfWeek: 0, // Sunday
        description: 'Daily overtime for Sunday (2.25x all hours)',
        isActive: true,
      },
      {
        payGuideId: retailPayGuide.id,
        name: 'Public Holiday Overtime',
        firstThreeHoursMult: new Decimal('2.75'),
        afterThreeHoursMult: new Decimal('2.75'),
        isPublicHoliday: true,
        description: 'Overtime on public holidays (2.75x all hours)',
        isActive: true,
      },
    ],
  })
  console.log(`✅ Created overtime time frames for retail award`)

  // Create sample public holidays
  console.log('🎉 Creating sample public holidays...')
  await prisma.publicHoliday.createMany({
    data: [
      {
        payGuideId: retailPayGuide.id,
        name: 'Christmas Day',
        date: new Date('2025-12-25'),
        isActive: true,
      },
      {
        payGuideId: retailPayGuide.id,
        name: 'Boxing Day',
        date: new Date('2025-12-26'),
        isActive: true,
      },
      {
        payGuideId: retailPayGuide.id,
        name: "New Year's Day",
        date: new Date('2025-01-01'),
        isActive: true,
      },
    ],
  })
  console.log(`✅ Created sample public holidays`)

  // Create current pay period (fortnightly)
  console.log('📅 Creating current pay period...')
  const today = new Date()
  const payPeriodStart = new Date(today)
  payPeriodStart.setDate(today.getDate() - ((today.getDay() + 6) % 14)) // Start of current fortnight
  payPeriodStart.setHours(0, 0, 0, 0)

  const payPeriodEnd = new Date(payPeriodStart)
  payPeriodEnd.setDate(payPeriodStart.getDate() + 13)
  payPeriodEnd.setHours(23, 59, 59, 999)

  const currentPayPeriod = await prisma.payPeriod.create({
    data: {
      userId: user.id,
      startDate: payPeriodStart,
      endDate: payPeriodEnd,
      status: 'open',
    },
  })
  console.log(
    `✅ Created current pay period: ${currentPayPeriod.startDate.toDateString()} - ${currentPayPeriod.endDate.toDateString()}`
  )

  // Create sample shifts with various scenarios
  console.log('🕒 Creating sample shifts...')

  const shifts = [
    // Regular weekday shift
    {
      userId: user.id,
      payGuideId: retailPayGuide.id,
      startTime: new Date('2024-09-02T09:00:00Z'), // Monday 9am
      endTime: new Date('2024-09-02T17:00:00Z'), // Monday 5pm
      notes: 'Regular weekday shift',
      payPeriodId: currentPayPeriod.id,
    },
    // Weekend shift with penalty
    {
      userId: user.id,
      payGuideId: retailPayGuide.id,
      startTime: new Date('2024-09-07T10:00:00Z'), // Saturday 10am
      endTime: new Date('2024-09-07T18:00:00Z'), // Saturday 6pm
      notes: 'Weekend shift with Saturday penalty',
      payPeriodId: currentPayPeriod.id,
    },
    // Evening shift with penalty
    {
      userId: user.id,
      payGuideId: retailPayGuide.id,
      startTime: new Date('2024-09-03T16:00:00Z'), // Tuesday 4pm
      endTime: new Date('2024-09-03T22:00:00Z'), // Tuesday 10pm
      notes: 'Evening shift crossing into penalty time',
      payPeriodId: currentPayPeriod.id,
    },
    // Long shift with overtime
    {
      userId: user.id,
      payGuideId: retailPayGuide.id,
      startTime: new Date('2024-09-04T08:00:00Z'), // Wednesday 8am
      endTime: new Date('2024-09-04T19:00:00Z'), // Wednesday 7pm (11 hours)
      notes: 'Long shift with overtime and evening penalty',
      payPeriodId: currentPayPeriod.id,
    },
    // Sunday shift with high penalty
    {
      userId: user.id,
      payGuideId: retailPayGuide.id,
      startTime: new Date('2024-09-08T11:00:00Z'), // Sunday 11am
      endTime: new Date('2024-09-08T17:00:00Z'), // Sunday 5pm
      notes: 'Sunday shift with 200% penalty rate',
      payPeriodId: currentPayPeriod.id,
    },
    // Night shift
    {
      userId: user.id,
      payGuideId: hospitalityPayGuide.id,
      startTime: new Date('2024-09-05T22:00:00Z'), // Thursday 10pm
      endTime: new Date('2024-09-06T04:00:00Z'), // Friday 4am
      notes: 'Night shift crossing midnight',
      payPeriodId: currentPayPeriod.id,
    },
  ]

  const createdShifts = []
  for (const shiftData of shifts) {
    const shift = await prisma.shift.create({ data: shiftData })
    
    // Calculate pay for the shift (no break periods exist yet)
    const calculation = await calculateAndUpdateShift({
      payGuideId: shift.payGuideId,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakPeriods: []
    })

    if (calculation) {
      // Update the shift with calculated pay values
      await updateShiftWithCalculation(shift.id, calculation)
      console.log(
        `✅ Created shift with pay: ${shift.startTime.toLocaleString()} - ${shift.endTime.toLocaleString()} (Total: $${calculation.totalPay.toFixed(2)})`
      )
    } else {
      console.log(
        `⚠️ Created shift without pay calculation: ${shift.startTime.toLocaleString()} - ${shift.endTime.toLocaleString()}`
      )
    }
    
    createdShifts.push(shift)
  }

  // Create sample break periods for shifts
  console.log('☕ Creating sample break periods...')
  const breakPeriods = [
    // Regular weekday shift - lunch break
    {
      shiftId: createdShifts[0].id,
      startTime: new Date('2024-09-02T13:00:00Z'), // 1pm lunch
      endTime: new Date('2024-09-02T13:30:00Z'), // 1:30pm
    },
    // Weekend shift - lunch break
    {
      shiftId: createdShifts[1].id,
      startTime: new Date('2024-09-07T13:30:00Z'), // 1:30pm lunch
      endTime: new Date('2024-09-07T14:00:00Z'), // 2pm
    },
    // Evening shift - dinner break
    {
      shiftId: createdShifts[2].id,
      startTime: new Date('2024-09-03T19:00:00Z'), // 7pm dinner
      endTime: new Date('2024-09-03T19:30:00Z'), // 7:30pm
    },
    // Long shift - lunch + dinner break
    {
      shiftId: createdShifts[3].id,
      startTime: new Date('2024-09-04T12:00:00Z'), // 12pm lunch
      endTime: new Date('2024-09-04T12:30:00Z'), // 12:30pm
    },
    {
      shiftId: createdShifts[3].id,
      startTime: new Date('2024-09-04T16:00:00Z'), // 4pm break
      endTime: new Date('2024-09-04T16:15:00Z'), // 4:15pm
    },
    // Sunday shift - afternoon break
    {
      shiftId: createdShifts[4].id,
      startTime: new Date('2024-09-08T14:00:00Z'), // 2pm break
      endTime: new Date('2024-09-08T14:15:00Z'), // 2:15pm
    },
    // Night shift - midnight break
    {
      shiftId: createdShifts[5].id,
      startTime: new Date('2024-09-06T01:00:00Z'), // 1am break
      endTime: new Date('2024-09-06T01:30:00Z'), // 1:30am
    },
  ]

  for (const breakData of breakPeriods) {
    await prisma.breakPeriod.create({ data: breakData })
  }
  console.log(`✅ Created ${breakPeriods.length} break periods`)

  // Recalculate pay for shifts that now have break periods
  console.log('♻️  Recalculating shift pay with break periods...')
  const affectedShiftIds = [...new Set(breakPeriods.map(bp => bp.shiftId))]
  
  for (const shiftId of affectedShiftIds) {
    const shift = createdShifts.find(s => s.id === shiftId)
    if (shift) {
      // Fetch break periods for this shift
      const shiftBreakPeriods = await fetchShiftBreakPeriods(shiftId)
      
      // Recalculate pay with break periods
      const calculation = await calculateAndUpdateShift({
        payGuideId: shift.payGuideId,
        startTime: shift.startTime,
        endTime: shift.endTime,
        breakPeriods: shiftBreakPeriods
      })

      if (calculation) {
        // Update the shift with recalculated pay values
        await updateShiftWithCalculation(shiftId, calculation)
        console.log(
          `✅ Recalculated shift pay with breaks: ${shift.startTime.toLocaleString()} (Total: $${calculation.totalPay.toFixed(2)})`
        )
      }
    }
  }

  // Demonstrate automatic pay period sync by triggering calculations
  console.log('🔄 Triggering automatic pay period sync and tax calculations...')
  await PayPeriodSyncService.syncPayPeriod(currentPayPeriod.id)
  
  // Fetch the updated pay period to show the results
  const updatedCurrentPayPeriod = await prisma.payPeriod.findUnique({
    where: { id: currentPayPeriod.id },
    include: { shifts: true }
  })
  
  if (updatedCurrentPayPeriod) {
    console.log(`📊 Current pay period totals after sync:`)
    console.log(`   Hours: ${updatedCurrentPayPeriod.totalHours?.toFixed(2) || '0'} hours`)
    console.log(`   Gross Pay: $${updatedCurrentPayPeriod.totalPay?.toFixed(2) || '0'}`)
    console.log(`   Tax Withholding: $${updatedCurrentPayPeriod.paygWithholding?.toFixed(2) || '0'}`)
    console.log(`   Net Pay: $${updatedCurrentPayPeriod.netPay?.toFixed(2) || '0'}`)
  }

  // Create previous pay period with completed status
  console.log('📊 Creating previous pay period...')
  const previousPayPeriodStart = new Date(payPeriodStart)
  previousPayPeriodStart.setDate(payPeriodStart.getDate() - 14)

  const previousPayPeriodEnd = new Date(previousPayPeriodStart)
  previousPayPeriodEnd.setDate(previousPayPeriodStart.getDate() + 13)
  previousPayPeriodEnd.setHours(23, 59, 59, 999)

  const previousPayPeriod = await prisma.payPeriod.create({
    data: {
      userId: user.id,
      startDate: previousPayPeriodStart,
      endDate: previousPayPeriodEnd,
      status: 'paid',
      totalHours: new Decimal('76.5'),
      totalPay: new Decimal('2145.75'),
      paygWithholding: new Decimal('429.15'), // Example tax withholding
      totalWithholdings: new Decimal('429.15'),
      netPay: new Decimal('1716.60'),
      actualPay: new Decimal('1716.60'),
      verified: true,
    },
  })
  console.log(
    `✅ Created previous pay period: ${previousPayPeriod.startDate.toDateString()} - ${previousPayPeriod.endDate.toDateString()}`
  )

  // Seed tax coefficients for 2024-25 tax year
  console.log('💰 Seeding ATO tax coefficients for 2024-25...')
  const taxYear = '2024-25'
  
  // Tax Rate Configuration for 2024-25
  const taxRateConfig = await prisma.taxRateConfig.upsert({
    where: { taxYear },
    update: {},
    create: {
      taxYear,
      medicareRate: new Decimal('0.02'), // 2%
      medicareLowIncomeThreshold: new Decimal('26000'),
      medicareHighIncomeThreshold: new Decimal('32500'),
      description: 'Medicare levy rates and thresholds for 2024-25 tax year',
      isActive: true,
    },
  })
  console.log(`✅ Created tax rate config for ${taxYear}`)

  // Tax Coefficients - Scale 2 (Claimed tax-free threshold - most common)
  const scale2Coefficients = [
    { earningsFrom: new Decimal(0), earningsTo: new Decimal(371), coefficientA: new Decimal(0), coefficientB: new Decimal(0), description: 'Tax-free threshold bracket' },
    { earningsFrom: new Decimal(371), earningsTo: new Decimal(515), coefficientA: new Decimal(0.19), coefficientB: new Decimal(70.5385), description: '19% tax bracket' },
    { earningsFrom: new Decimal(515), earningsTo: new Decimal(721), coefficientA: new Decimal(0.2348), coefficientB: new Decimal(93.4615), description: '23.48% effective rate bracket' },
    { earningsFrom: new Decimal(721), earningsTo: new Decimal(1282), coefficientA: new Decimal(0.219), coefficientB: new Decimal(82.1154), description: '21.9% effective rate bracket' },
    { earningsFrom: new Decimal(1282), earningsTo: new Decimal(2307), coefficientA: new Decimal(0.3477), coefficientB: new Decimal(247.1154), description: '34.77% effective rate bracket' },
    { earningsFrom: new Decimal(2307), earningsTo: null, coefficientA: new Decimal(0.45), coefficientB: new Decimal(482.6731), description: '45% top tax bracket' },
  ]

  // Tax Coefficients - Scale 1 (Did not claim tax-free threshold)
  const scale1Coefficients = [
    { earningsFrom: new Decimal(0), earningsTo: new Decimal(88), coefficientA: new Decimal(0.19), coefficientB: new Decimal(0), description: '19% from first dollar' },
    { earningsFrom: new Decimal(88), earningsTo: new Decimal(371), coefficientA: new Decimal(0.2348), coefficientB: new Decimal(12.7692), description: '23.48% effective rate bracket' },
    { earningsFrom: new Decimal(371), earningsTo: new Decimal(515), coefficientA: new Decimal(0.219), coefficientB: new Decimal(6.5385), description: '21.9% effective rate bracket' },
    { earningsFrom: new Decimal(515), earningsTo: new Decimal(721), coefficientA: new Decimal(0.3477), coefficientB: new Decimal(72.5385), description: '34.77% effective rate bracket' },
    { earningsFrom: new Decimal(721), earningsTo: new Decimal(1282), coefficientA: new Decimal(0.45), coefficientB: new Decimal(146.0769), description: '45% tax bracket' },
    { earningsFrom: new Decimal(1282), earningsTo: null, coefficientA: new Decimal(0.45), coefficientB: new Decimal(146.0769), description: '45% top tax bracket' },
  ]

  // Insert Scale 2 coefficients
  for (const coeff of scale2Coefficients) {
    await prisma.taxCoefficient.upsert({
      where: {
        taxYear_scale_earningsFrom: {
          taxYear,
          scale: 'scale2',
          earningsFrom: coeff.earningsFrom,
        },
      },
      update: {},
      create: {
        taxYear,
        scale: 'scale2',
        earningsFrom: coeff.earningsFrom,
        earningsTo: coeff.earningsTo,
        coefficientA: coeff.coefficientA,
        coefficientB: coeff.coefficientB,
        description: coeff.description,
        isActive: true,
      },
    })
  }

  // Insert Scale 1 coefficients
  for (const coeff of scale1Coefficients) {
    await prisma.taxCoefficient.upsert({
      where: {
        taxYear_scale_earningsFrom: {
          taxYear,
          scale: 'scale1',
          earningsFrom: coeff.earningsFrom,
        },
      },
      update: {},
      create: {
        taxYear,
        scale: 'scale1',
        earningsFrom: coeff.earningsFrom,
        earningsTo: coeff.earningsTo,
        coefficientA: coeff.coefficientA,
        coefficientB: coeff.coefficientB,
        description: coeff.description,
        isActive: true,
      },
    })
  }

  console.log(`✅ Created ${scale1Coefficients.length + scale2Coefficients.length} tax coefficients`)

  // HECS-HELP thresholds for 2024-25
  console.log('🎓 Seeding HECS-HELP thresholds for 2024-25...')
  const hecsThresholds = [
    { incomeFrom: new Decimal(51550), incomeTo: new Decimal(59518), rate: new Decimal(0.01), description: '1% repayment rate' },
    { incomeFrom: new Decimal(59518), incomeTo: new Decimal(63090), rate: new Decimal(0.02), description: '2% repayment rate' },
    { incomeFrom: new Decimal(63090), incomeTo: new Decimal(66662), rate: new Decimal(0.025), description: '2.5% repayment rate' },
    { incomeFrom: new Decimal(66662), incomeTo: new Decimal(70235), rate: new Decimal(0.03), description: '3% repayment rate' },
    { incomeFrom: new Decimal(70235), incomeTo: new Decimal(74808), rate: new Decimal(0.035), description: '3.5% repayment rate' },
    { incomeFrom: new Decimal(74808), incomeTo: new Decimal(79381), rate: new Decimal(0.04), description: '4% repayment rate' },
    { incomeFrom: new Decimal(79381), incomeTo: new Decimal(84981), rate: new Decimal(0.045), description: '4.5% repayment rate' },
    { incomeFrom: new Decimal(84981), incomeTo: new Decimal(90554), rate: new Decimal(0.05), description: '5% repayment rate' },
    { incomeFrom: new Decimal(90554), incomeTo: new Decimal(96127), rate: new Decimal(0.055), description: '5.5% repayment rate' },
    { incomeFrom: new Decimal(96127), incomeTo: new Decimal(101700), rate: new Decimal(0.06), description: '6% repayment rate' },
    { incomeFrom: new Decimal(101700), incomeTo: new Decimal(109177), rate: new Decimal(0.065), description: '6.5% repayment rate' },
    { incomeFrom: new Decimal(109177), incomeTo: new Decimal(116653), rate: new Decimal(0.07), description: '7% repayment rate' },
    { incomeFrom: new Decimal(116653), incomeTo: new Decimal(124130), rate: new Decimal(0.075), description: '7.5% repayment rate' },
    { incomeFrom: new Decimal(124130), incomeTo: new Decimal(131607), rate: new Decimal(0.08), description: '8% repayment rate' },
    { incomeFrom: new Decimal(131607), incomeTo: new Decimal(139083), rate: new Decimal(0.085), description: '8.5% repayment rate' },
    { incomeFrom: new Decimal(139083), incomeTo: new Decimal(147560), rate: new Decimal(0.09), description: '9% repayment rate' },
    { incomeFrom: new Decimal(147560), incomeTo: new Decimal(156037), rate: new Decimal(0.095), description: '9.5% repayment rate' },
    { incomeFrom: new Decimal(156037), incomeTo: null, rate: new Decimal(0.10), description: '10% maximum repayment rate' },
  ]

  for (const threshold of hecsThresholds) {
    await prisma.hecsThreshold.upsert({
      where: {
        taxYear_incomeFrom: {
          taxYear,
          incomeFrom: threshold.incomeFrom,
        },
      },
      update: {},
      create: {
        taxYear,
        incomeFrom: threshold.incomeFrom,
        incomeTo: threshold.incomeTo,
        rate: threshold.rate,
        description: threshold.description,
        isActive: true,
      },
    })
  }

  console.log(`✅ Created ${hecsThresholds.length} HECS-HELP thresholds`)

  console.log('✨ Database seeding completed successfully!')
  console.log('\n📈 Seeded data summary:')
  console.log(`   👤 Users: ${1}`)
  console.log(`   💰 Pay Guides: ${2}`)
  console.log(`   ⏰ Penalty Time Frames: ${11}`)
  console.log(`   🔄 Overtime Time Frames: ${3}`)
  console.log(`   🎉 Public Holidays: ${3}`)
  console.log(`   🕒 Shifts: ${6}`)
  console.log(`   ☕ Break Periods: ${7}`)
  console.log(`   📅 Pay Periods: ${2}`)
  console.log(`   🧮 Tax Coefficients: ${scale1Coefficients.length + scale2Coefficients.length}`)
  console.log(`   🎓 HECS-HELP Thresholds: ${hecsThresholds.length}`)
  console.log(`   ⚙️  Tax Rate Configs: ${1}`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Error during seeding:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
