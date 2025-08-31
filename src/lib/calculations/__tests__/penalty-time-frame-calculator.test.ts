import { EnhancedPayCalculator } from '../enhanced-pay-calculator';
import { PayGuideWithPenalties } from '@/types';
import Decimal from 'decimal.js';

describe('PenaltyTimeFrameCalculator', () => {
  const mockPayGuide: PayGuideWithPenalties = {
    id: 'test-pay-guide',
    name: 'Test Pay Guide',
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: null,
    isActive: true,
    userId: 'test-user',
    createdAt: new Date(),
    updatedAt: new Date(),
    baseHourlyRate: new Decimal(25.00),
    casualLoading: new Decimal(0.25),
    overtimeRate1_5x: new Decimal(1.5),
    overtimeRate2x: new Decimal(2.0),
    dailyOvertimeHours: new Decimal(9.0),
    specialDayOvertimeHours: new Decimal(11.0),
    weeklyOvertimeHours: new Decimal(38.0),
    overtimeOnSpanBoundary: true,
    overtimeOnDailyLimit: true,
    overtimeOnWeeklyLimit: true,
    penaltyTimeFrames: [
      {
        id: 'custom-penalty-1',
        payGuideId: 'test-pay-guide',
        name: 'Late Night Premium',
        description: 'Extra penalty for very late hours',
        startTime: '02:00',
        endTime: '06:00',
        penaltyRate: new Decimal(2.0), // 100% penalty (double time)
        dayOfWeek: null, // All days
        priority: 10, // High priority
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'custom-penalty-2',
        payGuideId: 'test-pay-guide',
        name: 'Weekend Morning Boost',
        description: 'Extra penalty for weekend morning shifts',
        startTime: '06:00',
        endTime: '12:00',
        penaltyRate: new Decimal(1.25), // 25% penalty
        dayOfWeek: 6, // Saturday only
        priority: 5, // Medium priority
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]
  };

  describe('Custom penalty calculations', () => {
    it('should apply custom late night penalty', () => {
      const calculator = new EnhancedPayCalculator(mockPayGuide);
      
      // Create a shift from 2 AM to 6 AM (4 hours during late night penalty)
      const startTime = new Date('2024-01-15T02:00:00Z'); // Monday 2 AM
      const endTime = new Date('2024-01-15T06:00:00Z'); // Monday 6 AM
      
      const result = calculator.calculateShift(startTime, endTime, 0);
      
      // Should have custom penalty applied
      expect(result.breakdown.customPenalties).toHaveLength(1);
      expect(result.breakdown.customPenalties[0].name).toBe('Late Night Premium');
      expect(result.breakdown.customPenalties[0].hours).toEqual(new Decimal(4));
      expect(result.breakdown.customPenalties[0].rate).toEqual(new Decimal(50)); // $25 * 2.0
      expect(result.breakdown.customPenalties[0].amount).toEqual(new Decimal(200)); // 4 hours * $50
    });

    it('should apply weekend custom penalty on Saturday', () => {
      const calculator = new EnhancedPayCalculator(mockPayGuide);
      
      // Create a shift from 8 AM to 12 PM on Saturday (4 hours during weekend morning boost)
      const startTime = new Date('2024-01-20T08:00:00Z'); // Saturday 8 AM
      const endTime = new Date('2024-01-20T12:00:00Z'); // Saturday 12 PM
      
      const result = calculator.calculateShift(startTime, endTime, 0);
      
      // Should have custom penalty applied
      expect(result.breakdown.customPenalties).toHaveLength(1);
      expect(result.breakdown.customPenalties[0].name).toBe('Weekend Morning Boost');
      expect(result.breakdown.customPenalties[0].hours).toEqual(new Decimal(4));
      expect(result.breakdown.customPenalties[0].rate).toEqual(new Decimal(31.25)); // $25 * 1.25
      expect(result.breakdown.customPenalties[0].amount).toEqual(new Decimal(125)); // 4 hours * $31.25
    });

    it('should not apply weekend custom penalty on Sunday', () => {
      const calculator = new EnhancedPayCalculator(mockPayGuide);
      
      // Create a shift from 8 AM to 12 PM on Sunday (should not get weekend morning boost)
      const startTime = new Date('2024-01-21T08:00:00Z'); // Sunday 8 AM
      const endTime = new Date('2024-01-21T12:00:00Z'); // Sunday 12 PM
      
      const result = calculator.calculateShift(startTime, endTime, 0);
      
      // Should not have the Saturday-specific penalty
      const saturdayPenalty = result.breakdown.customPenalties.find(p => p.name === 'Weekend Morning Boost');
      expect(saturdayPenalty).toBeUndefined();
    });

    it('should handle multiple custom penalties with priority', () => {
      const calculator = new EnhancedPayCalculator(mockPayGuide);
      
      // Create a shift that overlaps with both penalties (2 AM to 8 AM on Saturday)
      const startTime = new Date('2024-01-20T02:00:00Z'); // Saturday 2 AM
      const endTime = new Date('2024-01-20T08:00:00Z'); // Saturday 8 AM
      
      const result = calculator.calculateShift(startTime, endTime, 0);
      
      // Should have both penalties applied to their respective time segments
      expect(result.breakdown.customPenalties).toHaveLength(2);
      
      const lateNightPenalty = result.breakdown.customPenalties.find(p => p.name === 'Late Night Premium');
      const morningBoostPenalty = result.breakdown.customPenalties.find(p => p.name === 'Weekend Morning Boost');
      
      expect(lateNightPenalty).toBeDefined();
      expect(morningBoostPenalty).toBeDefined();
      
      // Late night penalty should apply from 2-6 AM (4 hours)
      expect(lateNightPenalty!.hours).toEqual(new Decimal(4));
      
      // Morning boost should apply from 6-8 AM (2 hours)
      expect(morningBoostPenalty!.hours).toEqual(new Decimal(2));
    });

    it('should ignore inactive custom penalties', () => {
      const inactivePayGuide: PayGuideWithPenalties = {
        ...mockPayGuide,
        penaltyTimeFrames: [
          {
            ...mockPayGuide.penaltyTimeFrames![0],
            isActive: false // Make the penalty inactive
          }
        ]
      };
      
      const calculator = new EnhancedPayCalculator(inactivePayGuide);
      
      const startTime = new Date('2024-01-15T02:00:00Z'); // Monday 2 AM
      const endTime = new Date('2024-01-15T06:00:00Z'); // Monday 6 AM
      
      const result = calculator.calculateShift(startTime, endTime, 0);
      
      // Should not have any custom penalties since the penalty is inactive
      expect(result.breakdown.customPenalties).toHaveLength(0);
    });
  });
});