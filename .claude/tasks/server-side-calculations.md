# Server-Side Calculations Task

## Problem Statement
The enhanced-shift-form.tsx currently uses client-side calculations for shift preview, while actual shift creation uses server-side calculations with the EnhancedPayCalculator. This inconsistency leads to different results between preview and actual shifts.

## Current Issue
- Preview calculations are done in the component using mock logic
- Actual shift creation uses the proper EnhancedPayCalculator on the server
- Users see different values in preview vs actual results
- This breaks user trust and creates confusion

## Solution
Create a new API endpoint `/api/shifts/preview` that uses the same calculation engine as actual shift creation, ensuring 100% consistency.

## Implementation Plan

### 1. Create Preview API Endpoint
**File**: `src/app/api/shifts/preview/route.ts`

**Functionality**:
- Accept same parameters as shift creation (startTime, endTime, breakMinutes, payGuideId, penaltyOverrides)
- Use EnhancedPayCalculator with the same logic as actual shift creation
- Return detailed calculation breakdown
- Handle validation and error cases
- No database writes - pure calculation endpoint

### 2. Update Enhanced Shift Form
**File**: `src/components/enhanced-shift-form.tsx`

**Changes**:
- Remove client-side calculation logic
- Add API call to `/api/shifts/preview` when form data changes
- Add proper loading states during calculation
- Handle API errors gracefully
- Debounce API calls to avoid excessive requests
- Cache results for identical inputs

### 3. Add Loading and Error States
- Loading spinner during calculation
- Error handling for API failures
- Fallback to basic calculation if API unavailable
- Clear error states when inputs change

## Technical Details

### API Endpoint Structure
```typescript
POST /api/shifts/preview
{
  startTime: string,
  endTime: string,
  breakMinutes: number,
  payGuideId: string,
  penaltyOverrides?: PenaltyOverride,
  autoCalculatePenalties: boolean
}

Response: EnhancedShiftCalculation
```

### Form Integration
- Replace `calculateShiftPreview()` function with API call
- Add debounced API calls (500ms delay)
- Implement request cancellation for rapid input changes
- Cache calculations to avoid duplicate API calls

## Success Criteria
1. Preview calculations exactly match actual shift calculations
2. No performance degradation despite API calls
3. Proper error handling and user feedback
4. Consistent user experience across preview and creation

## Files to Modify
1. `src/app/api/shifts/preview/route.ts` (new)
2. `src/components/enhanced-shift-form.tsx` (update)
3. Add types if needed in `src/types/index.ts`