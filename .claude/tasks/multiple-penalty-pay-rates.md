# Multiple Penalty Support & Pay Rate Management

## Task Overview
Implement support for multiple overlapping penalties per shift and comprehensive pay rate management system for the Chrona pay tracking application.

## Problem Statement
Currently, the system applies only one penalty type per shift segment and lacks proper pay rate management. Australian casual employment often requires multiple penalties to be applied simultaneously (e.g., evening penalties + weekend penalties). The system also needs better pay rate selection and management capabilities.

## Current State Analysis

### Database Schema (Prisma)
- PayGuide model exists with basic penalty rates but only applies single penalties
- Shift model has `shiftType` enum but no penalty override capabilities
- No pay rate selection tracking or user preferences

### Pay Calculator (`/src/lib/calculations/pay-calculator.ts`)
- `analyzeTimeSegments()` assigns single penalty type per time segment
- `getTimeSegmentType()` returns only one penalty type (priority: public_holiday > weekend > night > evening > regular)
- No support for penalty combinations or overrides

### Shift Form (`/src/components/shift-form.tsx`)
- Basic shift type selection (REGULAR, OVERTIME, WEEKEND, PUBLIC_HOLIDAY)
- No pay rate selection functionality
- Mock pay calculation preview

### Settings (`/src/app/settings/page.tsx`)
- Static pay guide selection dropdown
- No pay rate management interface

## Implementation Plan

### Phase 1: Database Schema Enhancement

#### 1.1 Add Penalty Override Support to Shift Model
```sql
-- Migration: Add penalty override fields
ALTER TABLE shifts ADD COLUMN penalty_overrides TEXT; -- JSON field
ALTER TABLE shifts ADD COLUMN auto_calculate_penalties BOOLEAN DEFAULT true;
ALTER TABLE shifts ADD COLUMN selected_pay_guide_id TEXT;
```

#### 1.2 Enhance PayGuide Model
```sql
-- Migration: Add penalty combination rules
ALTER TABLE pay_guides ADD COLUMN allow_penalty_combination BOOLEAN DEFAULT true;
ALTER TABLE pay_guides ADD COLUMN penalty_combination_rules TEXT; -- JSON field
```

#### 1.3 Add User Preferences for Pay Rates
```sql
-- Migration: Add user pay rate preferences
ALTER TABLE users ADD COLUMN last_used_pay_guide_id TEXT;
ALTER TABLE users ADD COLUMN default_pay_guide_id TEXT;
```

### Phase 2: Pay Rate Management System

#### 2.1 Create Pay Rate Management Page (`/src/app/pay-rates/page.tsx`)
- List all pay guides with search and filtering
- Create new pay guide form with validation
- Edit existing pay guides
- Duplicate pay guide functionality
- Delete pay guide with confirmation
- Import/export pay guide data
- Preview calculations with sample shifts

#### 2.2 Create Pay Rate API Routes (`/src/app/api/pay-rates/`)
- `GET /api/pay-rates` - List all pay guides for user
- `POST /api/pay-rates` - Create new pay guide with validation
- `GET /api/pay-rates/[id]` - Get specific pay guide
- `PUT /api/pay-rates/[id]` - Update pay guide
- `DELETE /api/pay-rates/[id]` - Delete pay guide (with constraint checks)
- `POST /api/pay-rates/[id]/duplicate` - Duplicate pay guide

#### 2.3 Create Pay Rate Selection Component (`/src/components/pay-rate-selector.tsx`)
- Dropdown with pay guide selection
- Display key rates (base, casual loading, major penalties)
- "Use Last Selected" smart default
- Quick preview of selected rates

### Phase 3: Enhanced Penalty Calculation Engine

#### 3.1 Modify PayCalculator Class
- **New Method**: `analyzeMultiplePenalties(startTime, endTime)` 
  - Detect all applicable penalties for time periods
  - Return array of penalty types per time segment
  - Handle penalty combination rules

- **Enhanced Method**: `calculateHoursBreakdown(timeSegments, totalMinutes)`
  - Support multiple penalties per time segment
  - Apply penalty combination rules
  - Calculate penalty interactions correctly

- **New Method**: `applyPenaltyOverrides(autoCalculated, overrides)`
  - Apply manual penalty overrides
  - Validate override consistency
  - Maintain audit trail of changes

#### 3.2 Update Time Segment Analysis
- Modify `TimeSegment` interface to support multiple penalty types:
```typescript
interface TimeSegment {
  startTime: Date;
  endTime: Date;
  penaltyTypes: ('evening' | 'night' | 'weekend' | 'public_holiday')[];
  durationMinutes: number;
}
```

#### 3.3 Penalty Combination Logic
- Define penalty combination rules in PayGuide
- Handle overlapping penalties (e.g., Saturday evening = weekend + evening)
- Ensure penalties don't double-count base hours
- Maintain Australian award compliance

### Phase 4: Enhanced Shift Form

#### 4.1 Add Pay Rate Selection (`/src/components/shift-form.tsx`)
- Pay rate selector with search and quick access to recent selections
- Display selected pay guide details
- Real-time calculation updates when pay guide changes
- Save last used selection to user preferences

#### 4.2 Add Penalty Override Controls
- Toggle switches for manual penalty overrides
- Automatic penalty detection with override indicators
- Warning system for unusual penalty combinations
- Explanation tooltips for penalty rules

#### 4.3 Enhanced Pay Preview
- Detailed breakdown showing all applied penalties
- Side-by-side comparison of automatic vs manual calculations
- Warning indicators for potential issues
- Export calculation details

### Phase 5: API Integration

#### 5.1 Update Shift APIs (`/src/app/api/shifts/`)
- Handle pay guide selection in shift creation/update
- Process penalty override data
- Update last used pay guide preference
- Validate penalty combinations

#### 5.2 Add User Preferences API (`/src/app/api/user/preferences/`)
- `GET /api/user/preferences` - Get user preferences
- `PUT /api/user/preferences` - Update preferences
- Handle default and last-used pay guide settings

### Phase 6: Settings Integration

#### 6.1 Enhance Settings Page (`/src/app/settings/page.tsx`)
- Add default pay guide selection
- Link to pay rate management interface
- Penalty calculation preferences
- Import/export user pay guides

#### 6.2 Add Settings Navigation
- Add "Pay Rates" section to navigation
- Quick access to manage pay guides
- Import/export functionality

### Phase 7: Testing & Validation

#### 7.1 Unit Tests
- Pay calculator penalty combination logic
- API route validation and error handling
- Database constraint testing
- Edge case scenarios (midnight shifts, public holidays)

#### 7.2 Integration Tests
- End-to-end shift creation with multiple penalties
- Pay guide CRUD operations
- Settings integration
- Real Australian award compliance testing

#### 7.3 Performance Testing
- Large pay guide lists performance
- Complex penalty calculation performance
- Database query optimization

## Technical Specifications

### Penalty Override Data Structure
```typescript
interface PenaltyOverride {
  evening: boolean | null; // null = auto, true/false = override
  night: boolean | null;
  weekend: boolean | null;
  publicHoliday: boolean | null;
  overrideReason?: string;
  overrideTimestamp: Date;
}
```

### Penalty Combination Rules
```typescript
interface PenaltyCombinationRules {
  allowCombinations: boolean;
  combinationMatrix: {
    [key: string]: {
      canCombineWith: string[];
      calculation: 'additive' | 'highest' | 'custom';
      customFormula?: string;
    };
  };
}
```

### Pay Guide Selection Priority
1. User manually selected pay guide for shift
2. Last used pay guide (stored in user preferences)
3. User's default pay guide setting
4. System default pay guide

## Success Criteria

### Functional Requirements
- ✅ Multiple penalties can be applied to single shift segments
- ✅ Users can create, edit, and delete pay guides
- ✅ Shift form includes pay rate selection with smart defaults
- ✅ Manual penalty overrides work correctly
- ✅ Automatic penalty detection maintains accuracy
- ✅ Settings integration provides seamless user experience

### Technical Requirements
- ✅ All calculations accurate to the cent
- ✅ Database migrations preserve existing data
- ✅ Performance remains acceptable with large datasets
- ✅ Full test coverage of penalty calculation logic
- ✅ API endpoints properly validated and error-handled

### User Experience Requirements
- ✅ Intuitive pay rate management interface
- ✅ Clear penalty override controls
- ✅ Real-time calculation previews
- ✅ Helpful warnings and validation messages
- ✅ Mobile-responsive design maintained

## Risk Mitigation

### Data Integrity Risks
- Implement database constraints for pay guide relationships
- Add validation for penalty rate ranges and combinations
- Create backup/restore functionality for pay guides

### Calculation Accuracy Risks
- Extensive testing with real Australian award scenarios
- Validation against known pay scenarios
- Audit trail for all penalty override decisions

### Performance Risks
- Optimize database queries for pay guide selection
- Cache frequently used pay guide data
- Implement pagination for large pay guide lists

## Dependencies

### External Dependencies
- Prisma ORM for database migrations
- React Bootstrap for UI components
- Decimal.js for precise financial calculations

### Internal Dependencies
- Existing PayCalculator class
- User authentication system
- Navigation component updates

## Estimated Timeline

- **Phase 1-2**: 3-4 days (Database + Pay Rate Management)
- **Phase 3**: 4-5 days (Enhanced Calculator)
- **Phase 4**: 3-4 days (Shift Form Enhancement)
- **Phase 5**: 2-3 days (API Integration)
- **Phase 6**: 2-3 days (Settings)
- **Phase 7**: 3-4 days (Testing)

**Total Estimated Time**: 17-23 days

## Next Steps
1. Review and approve this implementation plan
2. Create database migration for penalty override fields
3. Begin with pay rate management system (most foundational component)
4. Implement enhanced penalty calculation logic
5. Update shift form with new capabilities
6. Integration testing and validation