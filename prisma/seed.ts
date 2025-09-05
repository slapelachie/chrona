import { PrismaClient } from '@prisma/client'
import { Decimal } from 'decimal.js'

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
      description: 'General Retail Industry Award 2020 - Adult casual employee minimum rates',
      effectiveFrom: new Date('2025-07-01'), // Updated to match test data
      isActive: true,
    },
  })
  console.log(`✅ Created pay guide: ${retailPayGuide.name} (${retailPayGuide.id})`)

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
      description: 'Hospitality Industry (General) Award 2020 - Adult casual employee minimum rates',
      effectiveFrom: new Date('2025-07-01'), // Updated date
      isActive: true,
    },
  })
  console.log(`✅ Created pay guide: ${hospitalityPayGuide.name} (${hospitalityPayGuide.id})`)

  // Create Penalty Time Frames for Retail Award
  console.log('⏰ Creating penalty time frames for retail award...')
  
  // Casual loading (125% - applies to all hours)
  const casualLoading = await prisma.penaltyTimeFrame.create({
    data: {
      payGuideId: retailPayGuide.id,
      name: 'Casual Loading',
      multiplier: new Decimal('1.25'),
      description: '25% casual loading rate',
      isActive: true,
    },
  })

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
        description: '110% penalty rate for weekday evening work (7pm-midnight)',
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
        description: 'Daily overtime for weekdays (1.75x first 3hrs, 2.25x after)',
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
        name: 'New Year\'s Day',
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
  payPeriodStart.setDate(today.getDate() - (today.getDay() + 6) % 14) // Start of current fortnight
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
  console.log(`✅ Created current pay period: ${currentPayPeriod.startDate.toDateString()} - ${currentPayPeriod.endDate.toDateString()}`)

  // Create sample shifts with various scenarios
  console.log('🕒 Creating sample shifts...')
  
  const shifts = [
    // Regular weekday shift
    {
      userId: user.id,
      payGuideId: retailPayGuide.id,
      startTime: new Date('2024-09-02T09:00:00Z'), // Monday 9am
      endTime: new Date('2024-09-02T17:00:00Z'),   // Monday 5pm  
      breakMinutes: 30,
      notes: 'Regular weekday shift',
      payPeriodId: currentPayPeriod.id,
    },
    // Weekend shift with penalty
    {
      userId: user.id,
      payGuideId: retailPayGuide.id,
      startTime: new Date('2024-09-07T10:00:00Z'), // Saturday 10am
      endTime: new Date('2024-09-07T18:00:00Z'),   // Saturday 6pm
      breakMinutes: 30,
      notes: 'Weekend shift with Saturday penalty',
      payPeriodId: currentPayPeriod.id,
    },
    // Evening shift with penalty
    {
      userId: user.id,
      payGuideId: retailPayGuide.id,
      startTime: new Date('2024-09-03T16:00:00Z'), // Tuesday 4pm
      endTime: new Date('2024-09-03T22:00:00Z'),   // Tuesday 10pm
      breakMinutes: 30,
      notes: 'Evening shift crossing into penalty time',
      payPeriodId: currentPayPeriod.id,
    },
    // Long shift with overtime
    {
      userId: user.id,
      payGuideId: retailPayGuide.id,
      startTime: new Date('2024-09-04T08:00:00Z'), // Wednesday 8am
      endTime: new Date('2024-09-04T19:00:00Z'),   // Wednesday 7pm (11 hours)
      breakMinutes: 60,
      notes: 'Long shift with overtime and evening penalty',
      payPeriodId: currentPayPeriod.id,
    },
    // Sunday shift with high penalty
    {
      userId: user.id,
      payGuideId: retailPayGuide.id,
      startTime: new Date('2024-09-08T11:00:00Z'), // Sunday 11am
      endTime: new Date('2024-09-08T17:00:00Z'),   // Sunday 5pm
      breakMinutes: 30,
      notes: 'Sunday shift with 200% penalty rate',
      payPeriodId: currentPayPeriod.id,
    },
    // Night shift
    {
      userId: user.id,
      payGuideId: hospitalityPayGuide.id,
      startTime: new Date('2024-09-05T22:00:00Z'), // Thursday 10pm
      endTime: new Date('2024-09-06T04:00:00Z'),   // Friday 4am
      breakMinutes: 30,
      notes: 'Night shift crossing midnight',
      payPeriodId: currentPayPeriod.id,
    },
  ]

  const createdShifts = []
  for (const shiftData of shifts) {
    const shift = await prisma.shift.create({ data: shiftData })
    createdShifts.push(shift)
    console.log(`✅ Created shift: ${shift.startTime.toLocaleString()} - ${shift.endTime.toLocaleString()}`)
  }

  // Create sample break periods for shifts
  console.log('☕ Creating sample break periods...')
  const breakPeriods = [
    // Regular weekday shift - lunch break
    {
      shiftId: createdShifts[0].id,
      startTime: new Date('2024-09-02T13:00:00Z'), // 1pm lunch
      endTime: new Date('2024-09-02T13:30:00Z'),   // 1:30pm
    },
    // Weekend shift - lunch break
    {
      shiftId: createdShifts[1].id,
      startTime: new Date('2024-09-07T13:30:00Z'), // 1:30pm lunch  
      endTime: new Date('2024-09-07T14:00:00Z'),   // 2pm
    },
    // Evening shift - dinner break
    {
      shiftId: createdShifts[2].id,
      startTime: new Date('2024-09-03T19:00:00Z'), // 7pm dinner
      endTime: new Date('2024-09-03T19:30:00Z'),   // 7:30pm
    },
    // Long shift - lunch + dinner break
    {
      shiftId: createdShifts[3].id,
      startTime: new Date('2024-09-04T12:00:00Z'), // 12pm lunch
      endTime: new Date('2024-09-04T12:30:00Z'),   // 12:30pm
    },
    {
      shiftId: createdShifts[3].id,
      startTime: new Date('2024-09-04T16:00:00Z'), // 4pm break
      endTime: new Date('2024-09-04T16:15:00Z'),   // 4:15pm
    },
    // Sunday shift - afternoon break
    {
      shiftId: createdShifts[4].id,
      startTime: new Date('2024-09-08T14:00:00Z'), // 2pm break
      endTime: new Date('2024-09-08T14:15:00Z'),   // 2:15pm
    },
    // Night shift - midnight break
    {
      shiftId: createdShifts[5].id,
      startTime: new Date('2024-09-06T01:00:00Z'), // 1am break
      endTime: new Date('2024-09-06T01:30:00Z'),   // 1:30am
    },
  ]

  for (const breakData of breakPeriods) {
    await prisma.breakPeriod.create({ data: breakData })
  }
  console.log(`✅ Created ${breakPeriods.length} break periods`)

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
      actualPay: new Decimal('2145.75'),
      verified: true,
    },
  })
  console.log(`✅ Created previous pay period: ${previousPayPeriod.startDate.toDateString()} - ${previousPayPeriod.endDate.toDateString()}`)

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