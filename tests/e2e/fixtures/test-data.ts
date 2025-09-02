/**
 * Test data fixtures for E2E tests
 */

export const testUsers = {
  casualWorker: {
    name: 'Test Casual Worker',
    email: 'worker@test.com',
    tfnDeclared: true,
    claimsTaxFreeThreshold: true,
    hasHECSDebt: false,
  }
}

export const testPayGuides = {
  retailAward2024: {
    name: 'Retail Award 2024',
    baseHourlyRate: 25.50, // Includes 25% casual loading
    overtimeRate1_5x: 1.75, // 175%
    overtimeRate2x: 2.25,   // 225%
    dailyOvertimeHours: 9,
    weeklyOvertimeHours: 38,
  }
}

export const testShifts = {
  regularShift: {
    startTime: '09:00',
    endTime: '17:00',
    breakMinutes: 30,
    shiftType: 'CASUAL',
    location: 'Test Store',
    notes: 'Regular 8 hour shift',
  },
  shortShift: {
    startTime: '10:00',
    endTime: '14:00',
    breakMinutes: 0,
    shiftType: 'CASUAL',
    location: 'Test Store',
    notes: 'Short 4 hour shift',
  },
  overtimeShift: {
    startTime: '08:00',
    endTime: '19:00',
    breakMinutes: 60,
    shiftType: 'CASUAL',
    location: 'Test Store',
    notes: 'Long shift with overtime',
  },
  weekendShift: {
    startTime: '10:00',
    endTime: '16:00',
    breakMinutes: 30,
    shiftType: 'CASUAL',
    location: 'Test Store',
    notes: 'Weekend shift with penalty rates',
  }
}

export const testPenaltyTimeFrames = {
  eveningPenalty: {
    name: 'Evening Penalty',
    description: 'Evening penalty rate 125%',
    startTime: '18:00',
    endTime: '22:00',
    penaltyRate: 1.25,
    priority: 1,
  },
  nightPenalty: {
    name: 'Night Penalty',
    description: 'Night penalty rate 150%',
    startTime: '22:00',
    endTime: '06:00',
    penaltyRate: 1.50,
    priority: 2,
  },
  weekendPenalty: {
    name: 'Weekend Penalty',
    description: 'Weekend penalty rate 150%',
    startTime: '00:00',
    endTime: '23:59',
    penaltyRate: 1.50,
    dayOfWeek: [6, 0], // Saturday and Sunday
    priority: 1,
  }
}

export const expectedCalculations = {
  regularShift: {
    totalHours: 7.5, // 8 hours minus 30 min break
    regularHours: 7.5,
    overtimeHours: 0,
    penaltyHours: 0,
    grossPay: 191.25, // 7.5 * $25.50
  },
  shortShift: {
    totalHours: 4,
    regularHours: 4,
    overtimeHours: 0,
    penaltyHours: 0,
    grossPay: 102.00, // 4 * $25.50
  },
  overtimeShift: {
    totalHours: 10, // 11 hours minus 60 min break
    regularHours: 8,
    overtimeHours: 2,
    penaltyHours: 0,
    grossPay: 293.50, // (8 * $25.50) + (2 * $44.625)
  }
}