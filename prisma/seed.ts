import { PrismaClient } from '@prisma/client'
import { Decimal } from 'decimal.js'
import {
  calculateAndUpdateShift,
  updateShiftWithCalculation,
  fetchShiftBreakPeriods,
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
      payPeriodType: 'WEEKLY',
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

  // Create current pay period (weekly)
  console.log('📅 Creating current pay period...')
  const today = new Date()
  const anchor = new Date(Date.UTC(1970, 0, 5, 0, 0, 0, 0)) // Monday UTC
  const dayMs = 24 * 60 * 60 * 1000
  const todayUTC = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  )
  const daysSinceAnchor = Math.floor(
    (todayUTC.getTime() - anchor.getTime()) / dayMs
  )
  const startDays = daysSinceAnchor - (daysSinceAnchor % 7)
  const payPeriodStart = new Date(anchor.getTime() + startDays * dayMs)
  const payPeriodEnd = new Date(payPeriodStart.getTime() + 6 * dayMs)
  payPeriodEnd.setUTCHours(23, 59, 59, 999)

  const currentPayPeriod = await prisma.payPeriod.upsert({
    where: { userId_startDate: { userId: user.id, startDate: payPeriodStart } },
    update: { endDate: payPeriodEnd, status: 'pending' },
    create: {
      userId: user.id,
      startDate: payPeriodStart,
      endDate: payPeriodEnd,
      status: 'pending',
    },
  })
  console.log(
    `✅ Current pay period: ${currentPayPeriod.startDate.toDateString()} - ${currentPayPeriod.endDate.toDateString()}`
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
    },
    // Weekend shift with penalty
    {
      userId: user.id,
      payGuideId: retailPayGuide.id,
      startTime: new Date('2024-09-07T10:00:00Z'), // Saturday 10am
      endTime: new Date('2024-09-07T18:00:00Z'), // Saturday 6pm
      notes: 'Weekend shift with Saturday penalty',
    },
    // Evening shift with penalty
    {
      userId: user.id,
      payGuideId: retailPayGuide.id,
      startTime: new Date('2024-09-03T16:00:00Z'), // Tuesday 4pm
      endTime: new Date('2024-09-03T22:00:00Z'), // Tuesday 10pm
      notes: 'Evening shift crossing into penalty time',
    },
    // Long shift with overtime
    {
      userId: user.id,
      payGuideId: retailPayGuide.id,
      startTime: new Date('2024-09-04T08:00:00Z'), // Wednesday 8am
      endTime: new Date('2024-09-04T19:00:00Z'), // Wednesday 7pm (11 hours)
      notes: 'Long shift with overtime and evening penalty',
    },
    // Sunday shift with high penalty
    {
      userId: user.id,
      payGuideId: retailPayGuide.id,
      startTime: new Date('2024-09-08T11:00:00Z'), // Sunday 11am
      endTime: new Date('2024-09-08T17:00:00Z'), // Sunday 5pm
      notes: 'Sunday shift with 200% penalty rate',
    },
    // Night shift
    {
      userId: user.id,
      payGuideId: hospitalityPayGuide.id,
      startTime: new Date('2024-09-05T22:00:00Z'), // Thursday 10pm
      endTime: new Date('2024-09-06T04:00:00Z'), // Friday 4am
      notes: 'Night shift crossing midnight',
    },
  ]

  const createdShifts = []
  for (const shiftData of shifts) {
    // Determine pay period for each shift based on its own date
    const s = shiftData.startTime
    const sUTC = new Date(
      Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate())
    )
    const sDays = Math.floor((sUTC.getTime() - anchor.getTime()) / dayMs)
    const sStartDays = sDays - (sDays % 7)
    const sPPStart = new Date(anchor.getTime() + sStartDays * dayMs)
    const sPPEnd = new Date(sPPStart.getTime() + 6 * dayMs)
    sPPEnd.setUTCHours(23, 59, 59, 999)

    const shiftPayPeriod = await prisma.payPeriod.upsert({
      where: { userId_startDate: { userId: user.id, startDate: sPPStart } },
      update: { endDate: sPPEnd, status: 'pending' },
      create: {
        userId: user.id,
        startDate: sPPStart,
        endDate: sPPEnd,
        status: 'pending',
      },
    })

    const shift = await prisma.shift.create({
      data: { ...shiftData, payPeriodId: shiftPayPeriod.id },
    })

    // Calculate pay for the shift (no break periods exist yet)
    const calculation = await calculateAndUpdateShift({
      payGuideId: shift.payGuideId,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakPeriods: [],
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
  const affectedShiftIds = [...new Set(breakPeriods.map((bp) => bp.shiftId))]

  for (const shiftId of affectedShiftIds) {
    const shift = createdShifts.find((s) => s.id === shiftId)
    if (shift) {
      // Fetch break periods for this shift
      const shiftBreakPeriods = await fetchShiftBreakPeriods(shiftId)

      // Recalculate pay with break periods
      const calculation = await calculateAndUpdateShift({
        payGuideId: shift.payGuideId,
        startTime: shift.startTime,
        endTime: shift.endTime,
        breakPeriods: shiftBreakPeriods,
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
    include: { shifts: true },
  })

  if (updatedCurrentPayPeriod) {
    console.log(`📊 Current pay period totals after sync:`)
    console.log(
      `   Hours: ${updatedCurrentPayPeriod.totalHours?.toFixed(2) || '0'} hours`
    )
    console.log(
      `   Gross Pay: $${updatedCurrentPayPeriod.totalPay?.toFixed(2) || '0'}`
    )
    console.log(
      `   Tax Withholding: $${updatedCurrentPayPeriod.paygWithholding?.toFixed(2) || '0'}`
    )
    console.log(
      `   Net Pay: $${updatedCurrentPayPeriod.netPay?.toFixed(2) || '0'}`
    )
  }

  // Create previous pay period with completed status
  console.log('📊 Creating previous pay period...')
  const previousPayPeriodStart = new Date(payPeriodStart)
  previousPayPeriodStart.setDate(payPeriodStart.getDate() - 7)

  const previousPayPeriodEnd = new Date(previousPayPeriodStart)
  previousPayPeriodEnd.setDate(previousPayPeriodStart.getDate() + 6)
  previousPayPeriodEnd.setHours(23, 59, 59, 999)

  const previousPayPeriod = await prisma.payPeriod.upsert({
    where: {
      userId_startDate: { userId: user.id, startDate: previousPayPeriodStart },
    },
    update: {
      endDate: previousPayPeriodEnd,
      status: 'verified',
      totalHours: new Decimal('76.5'),
      totalPay: new Decimal('2145.75'),
      paygWithholding: new Decimal('429.15'),
      totalWithholdings: new Decimal('429.15'),
      netPay: new Decimal('1716.60'),
      actualPay: new Decimal('1716.60'),
    },
    create: {
      userId: user.id,
      startDate: previousPayPeriodStart,
      endDate: previousPayPeriodEnd,
      status: 'verified',
      totalHours: new Decimal('76.5'),
      totalPay: new Decimal('2145.75'),
      paygWithholding: new Decimal('429.15'),
      totalWithholdings: new Decimal('429.15'),
      netPay: new Decimal('1716.60'),
      actualPay: new Decimal('1716.60'),
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
      description: 'Medicare levy rates and thresholds for 2024-25 tax year',
      isActive: true,
    },
  })
  console.log(`✅ Created tax rate config for ${taxYear}`)

  // Tax Coefficients - Scale 2 (Claimed tax-free threshold - most common)
  const scale2Coefficients = [
    {
      earningsFrom: new Decimal(0),
      earningsTo: new Decimal(371),
      coefficientA: new Decimal(0),
      coefficientB: new Decimal(0),
      description: 'Tax-free threshold bracket',
    },
    {
      earningsFrom: new Decimal(371),
      earningsTo: new Decimal(515),
      coefficientA: new Decimal(0.19),
      coefficientB: new Decimal(70.5385),
      description: '19% tax bracket',
    },
    {
      earningsFrom: new Decimal(515),
      earningsTo: new Decimal(721),
      coefficientA: new Decimal(0.2348),
      coefficientB: new Decimal(93.4615),
      description: '23.48% effective rate bracket',
    },
    {
      earningsFrom: new Decimal(721),
      earningsTo: new Decimal(1282),
      coefficientA: new Decimal(0.219),
      coefficientB: new Decimal(82.1154),
      description: '21.9% effective rate bracket',
    },
    {
      earningsFrom: new Decimal(1282),
      earningsTo: new Decimal(2307),
      coefficientA: new Decimal(0.3477),
      coefficientB: new Decimal(247.1154),
      description: '34.77% effective rate bracket',
    },
    {
      earningsFrom: new Decimal(2307),
      earningsTo: null,
      coefficientA: new Decimal(0.45),
      coefficientB: new Decimal(482.6731),
      description: '45% top tax bracket',
    },
  ]

  // Tax Coefficients - Scale 1 (Did not claim tax-free threshold)
  const scale1Coefficients = [
    {
      earningsFrom: new Decimal(0),
      earningsTo: new Decimal(88),
      coefficientA: new Decimal(0.19),
      coefficientB: new Decimal(0),
      description: '19% from first dollar',
    },
    {
      earningsFrom: new Decimal(88),
      earningsTo: new Decimal(371),
      coefficientA: new Decimal(0.2348),
      coefficientB: new Decimal(12.7692),
      description: '23.48% effective rate bracket',
    },
    {
      earningsFrom: new Decimal(371),
      earningsTo: new Decimal(515),
      coefficientA: new Decimal(0.219),
      coefficientB: new Decimal(6.5385),
      description: '21.9% effective rate bracket',
    },
    {
      earningsFrom: new Decimal(515),
      earningsTo: new Decimal(721),
      coefficientA: new Decimal(0.3477),
      coefficientB: new Decimal(72.5385),
      description: '34.77% effective rate bracket',
    },
    {
      earningsFrom: new Decimal(721),
      earningsTo: new Decimal(1282),
      coefficientA: new Decimal(0.45),
      coefficientB: new Decimal(146.0769),
      description: '45% tax bracket',
    },
    {
      earningsFrom: new Decimal(1282),
      earningsTo: null,
      coefficientA: new Decimal(0.45),
      coefficientB: new Decimal(146.0769),
      description: '45% top tax bracket',
    },
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

  console.log(
    `✅ Created ${scale1Coefficients.length + scale2Coefficients.length} tax coefficients`
  )

  // STSL (Schedule 8) A/B formula rates for 2024-25 (both groups)
  console.log('🎓 Seeding STSL Schedule 8 A/B component rates for 2024-25...')
  type SeedStsl = {
    scale: 'WITH_TFT_OR_FR' | 'NO_TFT'
    from: Decimal
    to: Decimal | null
    a: Decimal
    b: Decimal
    description?: string
  }
  const stslRates: SeedStsl[] = [
    // WITH_TFT_OR_FR group
    {
      scale: 'WITH_TFT_OR_FR',
      from: new Decimal(0),
      to: new Decimal(1288),
      a: new Decimal(0),
      b: new Decimal(0),
      description: 'Below 1288 – no component',
    },
    {
      scale: 'WITH_TFT_OR_FR',
      from: new Decimal(1288),
      to: new Decimal(2403),
      a: new Decimal(0.15),
      b: new Decimal(193.2692),
      description: 'Mid bracket',
    },
    {
      scale: 'WITH_TFT_OR_FR',
      from: new Decimal(2403),
      to: new Decimal(3447),
      a: new Decimal(0.17),
      b: new Decimal(241.3462),
      description: 'Upper mid bracket',
    },
    {
      scale: 'WITH_TFT_OR_FR',
      from: new Decimal(3447),
      to: null,
      a: new Decimal(0.1),
      b: new Decimal(0),
      description: 'Top bracket',
    },
    // NO_TFT group – seed non-zero brackets to enable testing
    {
      scale: 'NO_TFT',
      from: new Decimal(0),
      to: new Decimal(1000),
      a: new Decimal(0),
      b: new Decimal(0),
      description: 'Below 1000 – no component',
    },
    {
      scale: 'NO_TFT',
      from: new Decimal(1000),
      to: new Decimal(2000),
      a: new Decimal(0.12),
      b: new Decimal(120),
      description: 'Mid bracket',
    },
    {
      scale: 'NO_TFT',
      from: new Decimal(2000),
      to: new Decimal(3200),
      a: new Decimal(0.16),
      b: new Decimal(220),
      description: 'Upper mid bracket',
    },
    {
      scale: 'NO_TFT',
      from: new Decimal(3200),
      to: null,
      a: new Decimal(0.1),
      b: new Decimal(0),
      description: 'Top bracket',
    },
  ]

  let stslUpserts = 0
  for (const r of stslRates) {
    await prisma.stslRate.upsert({
      where: {
        taxYear_scale_earningsFrom: {
          taxYear,
          scale: r.scale,
          earningsFrom: r.from,
        },
      },
      update: {
        earningsTo: r.to,
        coefficientA: r.a,
        coefficientB: r.b,
        description: r.description,
        isActive: true,
      },
      create: {
        taxYear,
        scale: r.scale,
        earningsFrom: r.from,
        earningsTo: r.to,
        coefficientA: r.a,
        coefficientB: r.b,
        description: r.description,
        isActive: true,
      },
    })
    stslUpserts++
  }
  console.log(`✅ Created/updated ${stslUpserts} STSL A/B component rows`)

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
  console.log(
    `   🧮 Tax Coefficients: ${scale1Coefficients.length + scale2Coefficients.length}`
  )
  console.log(`   🎓 STSL A/B Rows: ${stslUpserts}`)
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
