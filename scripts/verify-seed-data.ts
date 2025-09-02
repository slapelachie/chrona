/**
 * Quick script to verify the seed data was populated correctly
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifySeededData() {
  console.log('🔍 Verifying seeded data...\n')

  try {
    // Check users
    const users = await prisma.user.findMany()
    console.log(`👤 Users: ${users.length}`)
    if (users.length > 0) {
      console.log(`   - Default user: ${users[0].name} (${users[0].email})`)
    }

    // Check pay guides
    const payGuides = await prisma.payGuide.findMany({
      include: {
        penaltyTimeFrames: true,
        _count: {
          select: { shifts: true }
        }
      }
    })
    console.log(`\n💰 Pay Guides: ${payGuides.length}`)
    payGuides.forEach(guide => {
      console.log(`   - ${guide.name}: $${guide.baseRate}/hr, ${guide.casualLoading * 100}% casual loading`)
      console.log(`     Penalty time frames: ${guide.penaltyTimeFrames.length}`)
      console.log(`     Shifts using this guide: ${guide._count.shifts}`)
    })

    // Check penalty time frames
    const penalties = await prisma.penaltyTimeFrame.findMany({
      include: {
        payGuide: {
          select: { name: true }
        }
      }
    })
    console.log(`\n⏰ Penalty Time Frames: ${penalties.length}`)
    const penaltiesByGuide = penalties.reduce((acc, penalty) => {
      const guideName = penalty.payGuide.name
      if (!acc[guideName]) acc[guideName] = []
      acc[guideName].push(penalty)
      return acc
    }, {} as Record<string, any[]>)

    Object.entries(penaltiesByGuide).forEach(([guideName, penalties]) => {
      console.log(`   ${guideName}:`)
      penalties.forEach(penalty => {
        console.log(`     - ${penalty.name}: ${penalty.multiplier}x multiplier`)
      })
    })

    // Check shifts
    const shifts = await prisma.shift.findMany({
      include: {
        payGuide: {
          select: { name: true }
        },
        payPeriod: {
          select: { status: true }
        }
      }
    })
    console.log(`\n🕒 Shifts: ${shifts.length}`)
    shifts.forEach((shift, index) => {
      const start = new Date(shift.startTime).toLocaleString()
      const end = new Date(shift.endTime).toLocaleString()
      const duration = ((shift.endTime.getTime() - shift.startTime.getTime()) / (1000 * 60 * 60)).toFixed(1)
      console.log(`   ${index + 1}. ${start} - ${end} (${duration}h)`)
      console.log(`      Pay guide: ${shift.payGuide.name}`)
      console.log(`      Break: ${shift.breakMinutes}min, Notes: ${shift.notes || 'None'}`)
    })

    // Check pay periods
    const payPeriods = await prisma.payPeriod.findMany({
      include: {
        _count: {
          select: { shifts: true }
        }
      },
      orderBy: { startDate: 'asc' }
    })
    console.log(`\n📅 Pay Periods: ${payPeriods.length}`)
    payPeriods.forEach((period, index) => {
      const start = period.startDate.toDateString()
      const end = period.endDate.toDateString()
      console.log(`   ${index + 1}. ${start} - ${end} (${period.status})`)
      console.log(`      Shifts: ${period._count.shifts}`)
      if (period.totalPay) {
        console.log(`      Total pay: $${period.totalPay}`)
      }
    })

    console.log('\n✅ Seed data verification complete!')

    // Test some calculations with the seeded data
    console.log('\n🧮 Testing calculations with seeded data...')
    
    const testShift = shifts[0]
    if (testShift) {
      const { PayCalculator } = await import('../src/lib/calculations/pay-calculator')
      
      const payGuide = await prisma.payGuide.findUnique({
        where: { id: testShift.payGuideId },
        include: { penaltyTimeFrames: true }
      })

      if (payGuide) {
        const calculator = new PayCalculator(payGuide as any, payGuide.penaltyTimeFrames as any)
        const result = calculator.calculate(
          testShift.startTime,
          testShift.endTime,
          testShift.breakMinutes
        )

        console.log(`Test calculation for shift: ${testShift.startTime.toLocaleString()} - ${testShift.endTime.toLocaleString()}`)
        console.log(`Total hours: ${result.breakdown.totalPay.toString()}`)
        console.log(`Base pay: $${result.breakdown.basePay.toString()}`)
        console.log(`Penalty pay: $${result.breakdown.penaltyPay.toString()}`)
        console.log(`Casual pay: $${result.breakdown.casualPay.toString()}`)
        console.log(`Total pay: $${result.breakdown.totalPay.toString()}`)
        console.log(`Applied penalties: ${result.penalties.length}`)
      }
    }

  } catch (error) {
    console.error('❌ Error verifying seed data:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

verifySeededData()