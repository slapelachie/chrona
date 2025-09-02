# Phase 1: Core Shift Management - Detailed Tasks

**Status**: In Progress | **Total Tasks**: 159

**YOU HAVE ACCESS TO CONTEXT7**

## Overview
Core MVP functionality for shift tracking, Australian pay calculations, and mobile-first UI. This file contains all detailed tasks for Phase 1 implementation following strict test-first development methodology with logical dependency ordering.

## 🧪 MANDATORY TEST-FIRST DEVELOPMENT PROCESS

**⚠️ CRITICAL: NO FEATURE IMPLEMENTATION WITHOUT TESTS FIRST ⚠️**

### Test-First Development Workflow
1. **Write Tests First** - Always write comprehensive tests before implementing any feature
2. **Red Phase** - Run tests and ensure they fail (proving they test the right thing)
3. **Green Phase** - Implement minimal code to make tests pass
4. **Refactor Phase** - Clean up code while keeping tests passing
5. **Validate** - Run full test suite before considering feature complete

### Blackbox Testing Requirements
All features must be tested using **blackbox testing principles**:
- Test from the user's perspective without knowledge of internal implementation
- Focus on inputs, outputs, and expected behavior
- Test API endpoints as complete request/response cycles
- Test UI components through user interactions (clicks, form submissions)
- Verify calculated results without testing internal calculation steps

### Testing Standards
- **Unit Tests**: Every calculation function, utility, and service
- **Integration Tests**: API endpoints tested as complete workflows
- **Component Tests**: UI interactions and user flows
- **E2E Tests**: Critical user journeys from start to finish
- **Edge Case Tests**: Boundary conditions, error states, invalid inputs

### Test Coverage Requirements
- Minimum 95% code coverage for all new features
- 100% coverage for pay calculation logic (financial accuracy critical)
- All API endpoints must have request/response tests
- All UI components must have interaction tests

## 🧪 Foundation & Testing Setup (15 Tasks)

### Goal 1: Test Infrastructure & Framework Setup
- [x] 1.1 Configure Vitest testing framework with TypeScript support
- [x] 1.2 Set up test database with SQLite in-memory for fast testing
- [x] 1.3 Configure test utilities for database reset and seeding
- [x] 1.4 Set up API testing utilities with request/response validation
- [x] 1.5 Configure component testing with React Testing Library
- [x] 1.6 Set up test coverage reporting and CI/CD integration

### Goal 2: Database Schema & Migrations (Foundation)
- [x] 2.1 Create User model migration with basic fields (id, name, email, timezone)
- [x] 2.2 Create PayGuide model migration (id, name, baseRate, casualLoading, overtimeRules)
- [x] 2.3 Create PenaltyTimeFrame model migration (id, name, multiplier, dayOfWeek, startTime, endTime)
- [x] 2.4 Create Shift model migration (id, userId, payGuideId, startTime, endTime, breakMinutes)
- [x] 2.5 Create PayPeriod model migration (id, userId, startDate, endDate, status)
- [x] 2.6 Run migrations and verify schema in database

### Goal 3: Database Seeding & Test Data
- [x] 3.1 Create seed data for default PayGuide (Australian retail award rates)
- [x] 3.2 Create seed data for common PenaltyTimeFrames (weekend, evening, night, public holiday)
- [x] 3.3 Create seed data for sample User

---

## ⚙️ Core Engine Testing & Implementation (50 Tasks)

> **Critical:** The pay calculation engine is the single source of truth - no calculations done elsewhere.
> **Timezone Handling:** Store data in UTC format, convert on frontend for consistency.

### Goal 4: Pay Calculation Engine Tests (Write First - 15 Tasks)
- [x] 4.1 Write tests for basic pay calculations (hours * rate)
- [x] 4.2 Add tests for overtime calculations (1.5x, 2x rates)
- [x] 4.3 Create tests for weekend penalty calculations (150%, 200%)
- [x] 4.4 Add tests for evening/night penalty calculations
- [x] 4.5 Write tests for public holiday calculations (250% rate)
- [x] 4.6 Create tests for casual loading calculations (0-25%)
- [x] 4.7 Add tests for complex scenarios (multiple penalties, overtime + penalties)
- [x] 4.8 Test calculations against real Australian payslip examples
- [x] 4.9 Write tests for midnight shift calculations (spanning two days)
- [x] 4.10 Add tests for leap year date handling (Feb 29)
- [x] 4.11 Create tests for minimum wage compliance validation
- [x] 4.12 Add tests for maximum shift length validation
- [x] 4.13 Write tests for negative time/duration input handling
- [x] 4.14 Create tests for extreme decimal precision scenarios
- [x] 4.15 Add tests for penalty overlap resolution and validation

### Goal 5: Pay Calculation Engine Implementation (20 Tasks)
- [x] 5.1 Install Decimal.js package and configure for financial precision
- [x] 5.2 Create utility functions for currency operations (add, subtract, multiply, divide)
- [x] 5.3 Create currency formatting functions for Australian dollars
- [x] 5.4 Replace all number-based calculations with Decimal operations
- [x] 5.5 Add rounding functions that comply with Australian payroll standards
- [x] 5.6 Test precision with edge cases (0.1 + 0.2, large numbers, small decimals)
- [x] 5.7 Create core PayCalculator class with calculate() method
- [x] 5.8 Implement base pay calculation (hours * base rate)
- [x] 5.9 Add support for break time deduction
- [x] 5.10 Create pay breakdown structure (base, overtime, penalties, casual loading, total)
- [x] 5.11 Add validation for minimum wage compliance
- [x] 5.12 Test calculator with various shift scenarios
- [x] 5.13 Create OvertimeCalculator with configurable rules
- [x] 5.14 Implement daily overtime (1.5x after 8 hours, 2x after 12 hours)
- [ ] 5.15 Implement weekly overtime calculations
- [x] 5.16 Add overtime exclusion rules (penalties vs overtime priority)
- [x] 5.17 Create CasualLoadingCalculator with configurable rates
- [x] 5.18 Create PayCalculationValidator class with input validation
- [x] 5.19 Implement calculation cross-checks and business rule validation
- [x] 5.20 Add audit logging for all calculations

### Goal 6: Timezone Handling Tests & Implementation (8 Tasks)
- [x] 6.1 Write tests for UTC storage and local display conversion
- [x] 6.2 Add tests for daylight saving time transitions
- [x] 6.3 Create tests for shift spanning midnight (date boundary)
- [x] 6.4 Add tests for timezone-aware penalty calculations
- [x] 6.5 Install and configure timezone handling library (date-fns-tz)
- [x] 6.6 Create timezone conversion utilities (UTC to local, local to UTC)
- [x] 6.7 Implement shift time normalization to UTC for storage
- [x] 6.8 Add timezone-aware penalty time frame evaluation

### Goal 7: Penalty Time Frame Tests & Implementation (7 Tasks)
- [x] 7.1 Write tests for Saturday/Sunday penalty detection and application
- [x] 7.2 Create tests for evening penalty time frame (6pm-11pm)
- [x] 7.3 Add tests for night penalty time frame (11pm-6am)
- [x] 7.4 Write tests for public holiday penalty detection
- [ ] 7.5 Add tests for break time deduction from penalty periods
- [x] 7.6 Create PenaltyTimeFrameService with overlap detection logic
- [ ] 7.7 Fix penalty calculation to account for break time deduction

---

## 🔗 API Testing & Implementation (25 Tasks)

### Goal 8: API Endpoint Tests (Write First - 7 Tasks)
- [x] 8.1 Write tests for GET /api/shifts with various query parameters
- [x] 8.2 Add tests for POST /api/shifts with valid and invalid data
- [x] 8.3 Create tests for PUT /api/shifts/[id] with validation
- [x] 8.4 Add tests for DELETE /api/shifts/[id] with cleanup
- [x] 8.5 Write tests for GET /api/pay-rates endpoint
- [x] 8.6 Create tests for POST /api/shifts/preview with calculation
- [x] 8.7 Add tests for API error handling and status codes

### Goal 9: CRUD API Implementation (12 Tasks)
- [x] 9.1 Implement GET /api/shifts endpoint with filtering and pagination
- [x] 9.2 Implement POST /api/shifts endpoint with validation
- [x] 9.3 Implement PUT /api/shifts/[id] endpoint with validation
- [x] 9.4 Implement DELETE /api/shifts/[id] endpoint with proper cleanup
- [x] 9.5 Add request validation for all shift endpoints
- [x] 9.6 Add error handling for all shift endpoints
- [x] 9.7 Implement GET /api/pay-rates endpoint
- [x] 9.8 Implement POST /api/pay-rates endpoint with validation
- [x] 9.9 Implement PUT /api/pay-rates/[id] endpoint with validation
- [x] 9.10 Implement DELETE /api/pay-rates/[id] endpoint with proper cleanup
- [x] 9.11 Add request validation for all pay rate endpoints
- [x] 9.12 Add error handling for all pay rate endpoints

### Goal 10: Calculation Preview API (6 Tasks)
- [x] 10.1 Implement POST /api/shifts/preview endpoint
- [x] 10.2 Add shift validation without database persistence
- [x] 10.3 Integrate pay calculation engine for preview calculations
- [x] 10.4 Return detailed pay breakdown (base, overtime, penalties, total)
- [x] 10.5 Add error handling for invalid preview requests
- [ ] 10.6 Optimize for real-time performance (sub-100ms response)

---

## 🎨 UI Testing & Implementation (45 Tasks)

### Goal 11: UI Component Tests (Write First - 7 Tasks)
- [ ] 11.1 Create tests for shift form user interactions (typing, clicking)
- [ ] 11.2 Add tests for pay rate selector functionality
- [ ] 11.3 Write tests for real-time preview updates
- [ ] 11.4 Create tests for shift list interactions (scroll, filter, sort)
- [ ] 11.5 Add tests for mobile swipe actions and touch interactions
- [ ] 11.6 Write tests for form validation and error messages
- [ ] 11.7 Create tests for component accessibility (screen readers, keyboard navigation)

### Goal 12: Mobile-First Responsive Framework (12 Tasks)
- [ ] 12.1 Set up Bootstrap breakpoints (xs: 320px, sm: 576px, md: 768px, lg: 992px, xl: 1200px)
- [ ] 12.2 Create mobile-container utility class for optimal mobile widths
- [ ] 12.3 Implement responsive column layouts for all components
- [ ] 12.4 Add responsive spacing utilities (margins, padding)
- [ ] 12.5 Test grid system across all target screen sizes
- [ ] 12.6 Optimize grid for portrait and landscape orientations
- [ ] 12.7 Ensure all buttons meet 44px minimum touch target size
- [ ] 12.8 Add adequate spacing between interactive elements (8px+ gaps)
- [ ] 12.9 Implement larger touch targets for form inputs
- [ ] 12.10 Create thumb-zone friendly navigation patterns
- [ ] 12.11 Add visual feedback for touch interactions (hover states, active states)
- [ ] 12.12 Test touch interactions on actual mobile devices

### Goal 13: Form Components & Validation (13 Tasks)
- [ ] 13.1 Create ShiftForm component with React Hook Form
- [ ] 13.2 Add responsive date picker optimized for mobile (native HTML5 or library)
- [ ] 13.3 Add responsive time picker optimized for mobile (native HTML5 or library)
- [ ] 13.4 Implement duration input with automatic calculation
- [ ] 13.5 Add break time input with validation
- [ ] 13.6 Create form validation with real-time feedback
- [ ] 13.7 Add mobile-friendly submit button (bottom-aligned, 44px+ height)
- [ ] 13.8 Test form on various screen sizes (320px to 1200px+)
- [ ] 13.9 Build PayRateSelector with Bootstrap dropdown/modal
- [ ] 13.10 Display available pay guides with rates and descriptions
- [ ] 13.11 Add search/filter functionality for multiple pay guides
- [ ] 13.12 Implement mobile-friendly selection interface
- [ ] 13.13 Create new pay rate creation flow

### Goal 14: Real-time Preview & Visualization (13 Tasks)
- [ ] 14.1 Create ShiftPreview component with live updates
- [ ] 14.2 Connect to /api/shifts/preview endpoint
- [ ] 14.3 Display pay breakdown (base, overtime, penalties, casual loading, total)
- [ ] 14.4 Add loading states and error handling
- [ ] 14.5 Implement debounced API calls for performance
- [ ] 14.6 Add currency formatting for all amounts
- [ ] 14.7 Test preview updates in real-time (<100ms response)
- [ ] 14.8 Create ShiftList component with Bootstrap cards/list groups
- [ ] 14.9 Add infinite scroll or pagination for performance
- [ ] 14.10 Implement swipe actions for edit/delete (mobile)
- [ ] 14.11 Build PayBreakdown component with clear visual hierarchy
- [ ] 14.12 Add progress bars or charts for pay components
- [ ] 14.13 Display itemized breakdown (hours, rates, calculations)

---

## 🚀 Integration & E2E Testing (24 Tasks)

### Goal 15: End-to-End User Journey Tests (Write First - 7 Tasks)
- [ ] 15.1 Create E2E test for full shift creation user journey
- [ ] 15.2 Write integration test for shift form submission to database
- [ ] 15.3 Add test for shift validation and error handling
- [ ] 15.4 Create test for shift editing and updates
- [ ] 15.5 Add test for shift deletion and confirmation
- [ ] 15.6 Write test for shift list display and filtering
- [ ] 15.7 Test shift creation across different devices/screen sizes

### Goal 16: Performance & Mobile Optimization (17 Tasks)
- [ ] 16.1 Move primary form submit buttons to bottom of viewport
- [ ] 16.2 Create sticky bottom action bars for key actions
- [ ] 16.3 Implement bottom sheet patterns for secondary actions
- [ ] 16.4 Add floating action button (FAB) for quick shift creation
- [ ] 16.5 Ensure bottom actions don't interfere with iOS safe areas
- [ ] 16.6 Test thumb reach zones on various device sizes
- [ ] 16.7 Start with mobile-optimized base styles
- [ ] 16.8 Add tablet enhancements using Bootstrap md breakpoint
- [ ] 16.9 Implement desktop features using Bootstrap lg/xl breakpoints
- [ ] 16.10 Create responsive navigation (mobile hamburger → desktop sidebar)
- [ ] 16.11 Add desktop-specific features (keyboard shortcuts, hover effects)
- [ ] 16.12 Test progressive enhancement degradation
- [ ] 16.13 Implement lazy loading for shift list and images
- [ ] 16.14 Add progressive loading states and skeleton screens
- [ ] 16.15 Optimize bundle size and code splitting
- [ ] 16.16 Implement service worker for offline functionality
- [ ] 16.17 Add performance monitoring and Core Web Vitals tracking

---


## 🎯 Success Criteria

- ✅ All tests written BEFORE implementation (true test-first development)
- ✅ All tests pass with 95%+ coverage (100% for pay calculations) 
- ✅ Shift creation works end-to-end from mobile form to database
- ✅ Pay calculations are accurate to the cent for all scenarios
- ✅ API endpoints handle all CRUD operations with proper validation
- ✅ Mobile interface is fully functional on 320px+ screens
- ✅ Real-time preview updates without lag on mobile devices

## 🔄 Test-First Implementation Process

1. **Write Tests First** - Create failing tests for each goal
2. **Red Phase** - Verify tests fail (proving they test the right behavior)
3. **Green Phase** - Implement minimal code to make tests pass
4. **Refactor Phase** - Improve code while keeping tests green
5. **Validate** - Run full test suite before marking goal complete

---

## 📊 Progress Tracking (Reorganized by New Goal Structure)

### 🧪 Foundation & Testing Setup: 12/15 Complete (80%)
- Goal 1: Test Infrastructure - 6/6 Complete (100%)
- Goal 2: Database Schema - 6/6 Complete (100%) 
- Goal 3: Database Seeding - 3/3 Complete (100%)

### ⚙️ Core Engine Testing & Implementation: 45/50 Complete (90%)
- Goal 4: Pay Calculation Tests - 15/15 Complete (100%)
- Goal 5: Pay Engine Implementation - 19/20 Complete (95%)
- Goal 6: Timezone Handling - 8/8 Complete (100%)
- Goal 7: Penalty Time Frames - 5/7 Complete (71%)

### 🔗 API Testing & Implementation: 24/25 Complete (96%)
- Goal 8: API Endpoint Tests - 7/7 Complete (100%)
- Goal 9: CRUD API Implementation - 12/12 Complete (100%)
- Goal 10: Preview API - 5/6 Complete (83%)

### 🎨 UI Testing & Implementation: 0/45 Complete (0%)
- Goal 11: UI Component Tests - 0/7 Complete (0%)
- Goal 12: Mobile-First Framework - 0/12 Complete (0%)
- Goal 13: Form Components - 0/13 Complete (0%)
- Goal 14: Preview & Visualization - 0/13 Complete (0%)

### 🚀 Integration & E2E Testing: 0/24 Complete (0%)
- Goal 15: E2E User Journeys - 0/7 Complete (0%)
- Goal 16: Performance & Mobile - 0/17 Complete (0%)

**Overall Progress: 86/159 tasks complete (54%)**

### Next Priority Areas (Test-First Order):
1. **Goal 7** - Complete penalty break time deduction (2 remaining tasks)
2. **Goal 5** - Implement weekly overtime calculations (1 remaining task)
3. **Goal 10** - Optimize preview API performance (1 remaining task)
4. **Goal 11** - Begin UI component tests (7 new tasks)
5. **Goal 12** - Start mobile-first responsive framework (12 new tasks)

---

*Back to [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)*