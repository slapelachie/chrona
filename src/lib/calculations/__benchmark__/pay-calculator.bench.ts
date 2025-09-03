import { describe, bench } from 'vitest'
import { Decimal } from 'decimal.js'
import { PayCalculator } from '../pay-calculator'
import { PayGuide, PenaltyTimeFrame, BreakPeriod } from '@/types'

describe('PayCalculator Performance Benchmarks', () => {
  const payGuide: PayGuide = {
    id: 'test-guide',
    name: 'Test Award',
    baseRate: new Decimal('25.50'),
    minimumShiftHours: 3,
    maximumShiftHours: 10,
    timezone: 'Australia/Sydney',
    effectiveFrom: new Date(),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const penaltyTimeFrames: PenaltyTimeFrame[] = [
    {
      id: 'evening',
      payGuideId: 'test-guide',
      name: 'Evening Penalty',
      multiplier: new Decimal('1.5'),
      startTime: '18:00',
      endTime: '22:00',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'night',
      payGuideId: 'test-guide',
      name: 'Night Penalty',
      multiplier: new Decimal('1.75'),
      startTime: '22:00',
      endTime: '06:00',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'saturday',
      payGuideId: 'test-guide',
      name: 'Saturday',
      multiplier: new Decimal('1.25'),
      dayOfWeek: 6,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  const calculator = new PayCalculator(payGuide, penaltyTimeFrames)

  bench('Standard 8-hour weekday shift', () => {
    calculator.calculate(
      new Date('2024-01-15T09:00:00Z'),
      new Date('2024-01-15T17:00:00Z'),
      [
        {
          startTime: new Date('2024-01-15T12:00:00Z'),
          endTime: new Date('2024-01-15T13:00:00Z'),
        },
      ]
    )
  })

  bench('Complex overnight weekend shift with multiple penalties', () => {
    calculator.calculate(
      new Date('2024-01-19T21:00:00Z'), // Friday night
      new Date('2024-01-20T07:00:00Z'), // Saturday morning
      [
        {
          startTime: new Date('2024-01-19T23:00:00Z'),
          endTime: new Date('2024-01-19T23:30:00Z'),
        },
        {
          startTime: new Date('2024-01-20T02:00:00Z'),
          endTime: new Date('2024-01-20T02:30:00Z'),
        },
      ]
    )
  })

  bench('Long shift with overtime tiers', () => {
    calculator.calculate(
      new Date('2024-01-15T06:00:00Z'),
      new Date('2024-01-15T22:00:00Z'), // 16 hours
      [
        {
          startTime: new Date('2024-01-15T10:00:00Z'),
          endTime: new Date('2024-01-15T10:30:00Z'),
        },
        {
          startTime: new Date('2024-01-15T14:00:00Z'),
          endTime: new Date('2024-01-15T15:00:00Z'),
        },
        {
          startTime: new Date('2024-01-15T18:00:00Z'),
          endTime: new Date('2024-01-15T18:15:00Z'),
        },
      ]
    )
  })

  bench('Many break periods calculation', () => {
    const manyBreaks: BreakPeriod[] = []
    const breakStart = new Date('2024-01-15T09:00:00Z')
    
    // Generate 20 small break periods throughout the shift
    for (let i = 0; i < 20; i++) {
      const start = new Date(breakStart.getTime() + i * 30 * 60 * 1000) // Every 30 minutes
      const end = new Date(start.getTime() + 5 * 60 * 1000) // 5 minute breaks
      manyBreaks.push({ startTime: start, endTime: end })
    }

    calculator.calculate(
      new Date('2024-01-15T08:00:00Z'),
      new Date('2024-01-15T18:00:00Z'),
      manyBreaks
    )
  })

  bench('Calculator construction with many penalty rules', () => {
    const manyPenalties: PenaltyTimeFrame[] = []
    
    // Create penalties for every hour of the day
    for (let hour = 0; hour < 24; hour++) {
      const startTime = hour.toString().padStart(2, '0') + ':00'
      const endTime = ((hour + 1) % 24).toString().padStart(2, '0') + ':00'
      
      manyPenalties.push({
        id: `hour-${hour}`,
        payGuideId: 'test-guide',
        name: `Hour ${hour} Penalty`,
        multiplier: new Decimal('1.1'),
        startTime,
        endTime,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    new PayCalculator(payGuide, manyPenalties)
  })
})