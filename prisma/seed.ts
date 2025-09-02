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
      baseRate: new Decimal('25.41'), // Current adult minimum wage as of 2024
      casualLoading: new Decimal('0.25'), // 25% casual loading
      description: 'General Retail Industry Award 2020 - Adult casual employee minimum rates',
      effectiveFrom: new Date('2024-07-01'),
      isActive: true,
      overtimeRules: {
        daily: {
          regularHours: 8,
          firstOvertimeRate: 1.5,
          firstOvertimeHours: 12,
          secondOvertimeRate: 2.0
        },
        weekly: {
          regularHours: 38,
          overtimeRate: 1.5
        }
      }
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
      baseRate: new Decimal('25.41'), // Current adult minimum wage
      casualLoading: new Decimal('0.25'), // 25% casual loading
      description: 'Hospitality Industry (General) Award 2020 - Adult casual employee minimum rates',
      effectiveFrom: new Date('2024-07-01'),
      isActive: true,
      overtimeRules: {
        daily: {
          regularHours: 8,
          firstOvertimeRate: 1.5,
          firstOvertimeHours: 12,
          secondOvertimeRate: 2.0
        },
        weekly: {
          regularHours: 38,
          overtimeRate: 1.5
        }
      }
    },
  })
  console.log(`✅ Created pay guide: ${hospitalityPayGuide.name} (${hospitalityPayGuide.id})`)

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

  console.log(`✅ Created ${5} penalty time frames for retail award`)

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

  for (const shiftData of shifts) {
    const shift = await prisma.shift.create({ data: shiftData })
    console.log(`✅ Created shift: ${shift.startTime.toLocaleString()} - ${shift.endTime.toLocaleString()}`)
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
      actualPay: new Decimal('2145.75'),
      verified: true,
    },
  })
  console.log(`✅ Created previous pay period: ${previousPayPeriod.startDate.toDateString()} - ${previousPayPeriod.endDate.toDateString()}`)

  console.log('✨ Database seeding completed successfully!')
  console.log('\n📈 Seeded data summary:')
  console.log(`   👤 Users: ${1}`)
  console.log(`   💰 Pay Guides: ${2}`)
  console.log(`   ⏰ Penalty Time Frames: ${10}`)
  console.log(`   🕒 Shifts: ${6}`)
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