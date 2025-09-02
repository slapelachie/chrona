# Chrona Implementation Checklist

**YOU HAVE ACCESS TO CONTEXT7**

## Project Overview
Mobile-first Australian casual pay tracker using **strict test-first development**. Track implementation progress with this checklist.

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

---

## 📋 Core Infrastructure (PENDING)

### Database Schema
- [ ] User Model (single user app)
- [ ] PayGuide Model (award rates & penalties) 
- [ ] PenaltyTimeFrame Model (flexible penalty system)
- [ ] Shift Model (core shift tracking)
- [ ] PayPeriod Model (pay period management)

### Tech Stack Setup
- [x] Next.js 15+ with App Router, TypeScript
- [x] React Bootstrap 5
- [x] Vitest testing framework with React Testing Library
- [x] Playwright for E2E testing
- [ ] Prisma ORM with SQLite (dev)
- [ ] Decimal.js for financial precision

---

## 📋 Phase 1: Core Shift Management
**Status**: In Progress | **File**: [PHASE_1_TASKS.md](./PHASE_1_TASKS.md)

### Overview
Core MVP functionality for shift tracking, pay calculations, and mobile-first UI. Focus on test-first development with blackbox testing methodology.

### 5 Key Goal Areas (152 Tasks Total)
1. 🗄️ **Database & API** (30 tasks) - Models, migrations, seeding, CRUD endpoints
2. ⚙️ **Pay Calculation Engine** (42 tasks) - Decimal.js, penalties, overtime, validation  
3. 🎨 **UI Components** (35 tasks) - Forms, selectors, previews, mobile optimization
4. 🧪 **Testing** (45 tasks) - Blackbox tests, integration tests, E2E workflows
5. 📱 **Mobile-First Design** (30 tasks) - Responsive grid, touch interfaces, performance

### Success Criteria
- All tests pass with 95%+ coverage (100% for pay calculations)
- End-to-end shift creation works on mobile (320px+)
- Pay calculations accurate to the cent for all Australian retail award scenarios
- Real-time preview <100ms response time
- Mobile interface fully functional with touch-friendly interactions

### Critical Requirements
- **Test-First Development**: Write comprehensive blackbox tests BEFORE implementing features
- **Single Source of Truth**: Pay calculation engine handles all calculations server-side
- **Timezone Handling**: Store data in UTC, convert on frontend for consistency
- **Mobile-First**: Progressive enhancement from 320px to desktop

→ **[View Detailed Tasks](./PHASE_1_TASKS.md)** (152 specific, actionable tasks)

---

## 📋 Phase 2: Pay Period Management (PENDING)

### Pay Period Service
- [ ] Automatic pay period creation
- [ ] Shift assignment to pay periods
- [ ] Fortnightly pay period calculations
- [ ] Pay period status management

### Components
- [ ] Pay Period Display component
- [ ] Summary cards with totals
- [ ] Period navigation interface

### Testing (WRITE TESTS FIRST)
- [ ] **Blackbox tests for automatic pay period assignment** (test complete workflows)
- [ ] **Fortnightly calculation tests** (test period boundaries and totals)
- [ ] **Pay period status transition tests** (test state changes end-to-end)

---

## 💰 Phase 3: Australian Tax Calculations (PENDING)

### Tax Engine
- [ ] Australian tax bracket system
- [ ] HECS-HELP repayment calculations
- [ ] Medicare levy calculations
- [ ] Tax-free threshold handling
- [ ] Net pay calculations

### Components
- [ ] Tax Calculator component
- [ ] Tax settings management
- [ ] Net pay display

### Testing (WRITE TESTS FIRST)
- [ ] **Blackbox Australian tax bracket tests** (test tax calculations for various incomes)
- [ ] **HECS-HELP calculation blackbox tests** (test repayment calculations end-to-end)
- [ ] **Medicare levy blackbox tests** (test levy calculations with various scenarios)
- [ ] **Tax accuracy validation tests** (test against ATO examples and edge cases)

---

## 🎯 Critical Features Status

### Pay Calculation Accuracy
- [ ] Decimal.js implementation
- [ ] Australian retail award overtime rules
- [ ] Configurable penalty time frames
- [ ] Public holiday calculations (250% rate)
- [ ] Accurate rounding to the cent

### Mobile Experience
- [ ] Bootstrap responsive design
- [ ] Mobile-optimized navigation
- [ ] Touch-friendly form controls
- [ ] Mobile performance optimization

### API Design
- [ ] RESTful endpoints
- [ ] Server-side validation
- [ ] Server-side calculations
- [ ] Timezone-aware date/time handling
- [ ] Error handling improvements

---

## 🧪 Testing Coverage

### Test Infrastructure
- [x] Vitest configuration with React Testing Library
- [x] Test directory structure setup (`src/test/`, `tests/e2e/`)
- [x] Test data fixtures and utilities
- [x] Mock data and API testing setup

### Test Categories (ALL BLACKBOX APPROACH)
- [ ] **Unit tests for calculation functions** (test inputs/outputs, not implementation)
- [ ] **Integration tests for API endpoints** (test complete request/response cycles)
- [ ] **Component tests for UI interactions** (test user actions and visual results)
- [ ] **E2E tests for critical workflows** (test complete user journeys)

---

## 🚀 Development Commands
```bash
npm run dev          # Development server
npm run test         # Run test suite  
npm run build        # Production build
npm run type-check   # TypeScript validation
npm run lint         # Code linting
npx prisma migrate dev    # Database migrations
npx prisma db seed       # Seed test data
```

---

## 📝 Implementation Notes

### Recently Completed
- ✅ **Testing Framework Setup**: Comprehensive testing infrastructure with Vitest and Playwright
- ✅ **React Testing Library**: Component testing setup with utilities and helpers  
- ✅ **E2E Testing**: Page object models, test fixtures, and cross-browser testing
- ✅ **Mobile Testing**: Responsive design testing and mobile device emulation
- ✅ **Australian Pay Testing**: Currency formatting and specialized test data

### Implementation Priority
1. **Phase 1**: Core Infrastructure and Shift Management (MVP)
2. **Phase 2**: Pay Period Management
3. **Phase 3**: Australian Tax Calculations

### Focus Areas
- **Mandatory test-first development approach** (no exceptions)
- **Blackbox testing methodology** (test behavior, not implementation)
- Mobile-first responsive design
- Accurate Australian pay calculations
- Clean, maintainable architecture

### Test-First Implementation Rules
1. **Never write production code without failing tests first**
2. **Always use blackbox testing approach** - test what the feature does, not how it does it
3. **Run `npm run test` before every commit** - all tests must pass
4. **Achieve minimum 95% test coverage** for new features
5. **Write tests for edge cases and error conditions** before implementing error handling