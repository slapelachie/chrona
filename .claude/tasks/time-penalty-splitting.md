# Time-Based Penalty Splitting Task

## Problem Statement
**FIXME Reference**: Line 170-171 in `src/components/enhanced-shift-form.tsx`
> "//FIXME, this only uses the start time, in reality, it should split up the penalty to be ordinary hours and night hours"

The current penalty calculation logic has a fundamental flaw - it uses only the shift start time to determine penalties, rather than calculating penalties based on the actual time spent in each penalty period.

## Current Issue
**Example Problem**:
- Shift: 6 PM - 2 AM (8 hours)
- Current logic: Uses 6 PM start time → applies evening penalty to ALL 8 hours
- **Correct logic should be**:
  - 6 PM - 10 PM (4 hours): Evening penalty
  - 10 PM - 2 AM (4 hours): Night penalty

## Impact
- Incorrect pay calculations for shifts spanning multiple penalty periods
- Over/under payment of penalty rates
- Non-compliance with Australian award structures
- User confusion about pay calculations

## Solution
Implement proper time-segment-based penalty calculations in the EnhancedPayCalculator to accurately split shifts into appropriate penalty periods.

## Technical Investigation Required

### 1. Current Implementation Analysis
**File**: `src/lib/calculations/enhanced-pay-calculator.ts`

**Current Logic** (Lines ~170-180):
```typescript
// This logic exists but may not be working correctly
private analyzeMultiplePenalties(startTime: Date, endTime: Date, breakMinutes: number): EnhancedTimeSegment[]
```

**Issues to Fix**:
- Verify time segment boundary detection
- Ensure proper penalty assignment per time segment
- Fix any logic errors in penalty time calculations
- Handle overnight shifts correctly

### 2. Expected Behavior
**Proper Time Segment Calculation**:
- Split shift into time boundaries (evening start/end, night start/end)
- Calculate actual minutes spent in each penalty period
- Apply appropriate penalty rates to each segment
- Handle breaks correctly (reduce from each segment proportionally)

### 3. Test Cases Needed
**Complex Scenarios**:
1. **Evening to Night**: 6 PM - 2 AM (spans evening + night)
2. **Night to Day**: 10 PM - 8 AM (spans night + regular)
3. **Saturday Night**: Saturday 6 PM - Sunday 2 AM (weekend + evening + night)
4. **With Breaks**: 6 PM - 2 AM with 1-hour break (how to allocate break time)
5. **Overnight Shifts**: Shifts crossing midnight boundary

## Implementation Plan

### Phase 1: Investigation and Testing
1. **Audit Current Logic**: Review EnhancedPayCalculator implementation
2. **Create Test Cases**: Develop comprehensive test scenarios
3. **Identify Gaps**: Find specific issues in current implementation
4. **Document Expected Behavior**: Define correct calculation logic

### Phase 2: Fix Implementation
1. **Time Segment Logic**: Ensure proper boundary detection
2. **Penalty Assignment**: Fix penalty application per segment
3. **Break Handling**: Implement proper break time allocation
4. **Overnight Shifts**: Handle midnight boundary crossings

### Phase 3: Client-Side Updates
1. **Form Preview**: Update enhanced-shift-form.tsx preview logic
2. **Validation**: Add warnings for complex penalty scenarios
3. **UI Feedback**: Show penalty breakdown by time period

## Specific Areas to Fix

### 1. Enhanced Pay Calculator
**File**: `src/lib/calculations/enhanced-pay-calculator.ts`

**Functions to Review/Fix**:
- `analyzeMultiplePenalties()` - Time segment creation
- `getAllApplicablePenalties()` - Penalty detection per segment
- `getNextSegmentBoundary()` - Boundary calculation
- `calculateEnhancedHoursBreakdown()` - Hours breakdown per penalty type

### 2. Client-Side Preview
**File**: `src/components/enhanced-shift-form.tsx`

**Functions to Fix**:
- `calculateShiftPreview()` - Replace with proper server-side calculation
- Remove mock penalty logic (lines 170-180)
- Add proper time-based penalty preview

## Success Criteria
1. **Accurate Time Splitting**: Shifts correctly divided by penalty boundaries
2. **Correct Pay Calculations**: Pay matches Australian award requirements
3. **Overnight Shift Support**: Proper handling of midnight boundary crossings
4. **Break Time Allocation**: Breaks properly distributed across penalty periods
5. **UI Consistency**: Preview matches actual calculation results

## Test Scenarios Required
```typescript
// Test Case 1: Evening to Night Shift
startTime: '18:00', endTime: '02:00', breakMinutes: 30
Expected: 4h evening penalty + 4h night penalty (minus break allocation)

// Test Case 2: Saturday Night Shift
date: 'Saturday', startTime: '18:00', endTime: '02:00'
Expected: Weekend + evening + night penalties (combination rules)

// Test Case 3: Simple Night Shift
startTime: '22:00', endTime: '06:00', breakMinutes: 60
Expected: 8h night penalty (minus 1h break)
```

## Priority
**High Priority** - This affects core calculation accuracy and Australian award compliance.

## Files to Modify
1. `src/lib/calculations/enhanced-pay-calculator.ts` (fix time splitting logic)
2. `src/components/enhanced-shift-form.tsx` (remove FIXME, update preview)
3. Add comprehensive tests for penalty calculations