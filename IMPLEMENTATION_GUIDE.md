# Chrona Implementation Guide - Starting From Scratch

## Overview
Rebuild Chrona as a mobile-first Australian casual pay tracker using **test-first development** with black box testing. Focus on core MVP functionality without over-engineering.

## Core Architecture

### Tech Stack
- **Frontend**: Next.js 15+ with App Router, TypeScript, React Bootstrap 5
- **Database**: Prisma ORM with SQLite (dev) / PostgreSQL (prod)
- **Pay Calculations**: Decimal.js for financial precision
- **Testing**: Vitest with test-first approach

### Database Schema (Core MVP)

**User Model** (Single user app)
```
- id, name, email
- Tax settings: tfnDeclared, claimsTaxFreeThreshold, hasHECSDebt
- Pay period preferences: frequency (fortnightly), startDay
- Default pay guide reference
```

**PayGuide Model** (Award rates & penalties)
```
- id, name, effectiveFrom, effectiveTo, isActive
- baseHourlyRate (includes casual loading for retail)
- Overtime rates: overtimeRate1_5x (175%), overtimeRate2x (225%)
- Daily/weekly overtime thresholds: dailyOvertimeHours (9h), weeklyOvertimeHours (38h)
```

**PenaltyTimeFrame Model** (Flexible penalty system)
```
- id, payGuideId, name, description
- startTime, endTime (HH:MM format)
- penaltyRate (multiplier), dayOfWeek (optional), priority
```

**Shift Model** (Core shift tracking)
```
- id, userId, payGuideId
- startTime, endTime, breakMinutes
- shiftType, status, notes, location
- Calculated fields: totalMinutes, regularHours, overtimeHours, penaltyHours, grossPay
```

**PayPeriod Model** (Pay period management)
```
- id, userId, startDate, endDate, payDate, status
- Calculated totals: weeklyHours, totalGrossPay, totalTax, totalNetPay
```

## Implementation Phases

### Phase 1: Core Shift Management (MVP)

**Test-First Approach:**
1. Write black box tests for shift creation, calculation, and display
2. Test Australian retail award calculations (overtime, penalties, casual loading)
3. Test timezone handling for Australian users

**Key Components:**
- Enhanced Shift Form: Date/time input with timezone handling
- Pay Calculator: Australian retail award logic with configurable penalties
- Shift List: Mobile-friendly display with pay breakdowns
- Real-time Preview: Server-side calculation preview during form input

**Critical Features:**
- Accurate pay calculations using Decimal.js
- Flexible penalty time frame system
- Mobile-first responsive design
- Server-side shift preview API

### Phase 2: Pay Period Management

**Test-First Approach:**
1. Test automatic pay period assignment based on shift dates
2. Test fortnightly pay period calculations
3. Test pay period status transitions

**Key Components:**
- Pay Period Service: Automatic period creation and assignment
- Pay Period Display: Summary cards with totals
- Period Calculations: Aggregate shift data with tax calculations

### Phase 3: Australian Tax Calculations

**Test-First Approach:**
1. Test current Australian tax brackets
2. Test HECS-HELP repayment calculations
3. Test Medicare levy calculations

**Key Components:**
- Tax Calculator: Australian tax system with current rates
- Tax Bracket Management: Configurable tax rates
- Net Pay Calculations: Accurate deductions

## Key Implementation Guidelines

### Mobile-First Design
- Use Bootstrap responsive grid (xs, sm, md, lg breakpoints)
- Touch-friendly interfaces (44px minimum tap targets)
- Bottom-aligned primary actions for thumb navigation
- Progressive enhancement from 320px+ screens

### Australian Pay Accuracy
- Use Decimal.js for all financial calculations
- Implement exact Australian retail award overtime rules
- Support configurable penalty time frames
- Handle public holiday calculations (250% rate)
- Accurate rounding to the cent

### Test-First Development
- Write comprehensive black box tests before implementation
- Test edge cases: midnight shifts, public holidays, timezone boundaries
- Test calculation accuracy against real pay scenarios
- Use Vitest for fast test execution

### API Design
- RESTful endpoints with proper error handling
- First-run guard: `/setup` is the only page accessible until the initial workspace is created
- Use `/api/setup/status` for health diagnostics (migrations applied, DB reachable)
- `/api/setup/init` validates payloads server-side and returns structured error codes (e.g. `user_exists`)

### First-Time Setup Flow
- A global middleware redirects every request to `/setup` until the application has at least one user record; API requests receive a `503` with `redirectTo: '/setup'`
- `docker/start.sh` and `/api/setup/status` expose environment controls (`SKIP_DB_WAIT`, `SKIP_PRISMA_MIGRATE`, `SERVER_ENTRYPOINT`) for CI/staging bootstrap scenarios
- The setup form now runs client-side validation, surfaces inline errors, and prevents duplicate submissions while initialization is in flight
- Initialization executes inside a Prisma transaction to ensure idempotency and to avoid partial writes when multiple requests race
- Server-side validation and calculations
- Timezone-aware date/time handling
- Cursor-based pagination for performance

## Critical Success Factors

1. **Accurate Calculations**: All pay calculations must be precise to the cent
2. **Mobile Experience**: App must work seamlessly on mobile devices
3. **Test Coverage**: Comprehensive test suite covering all calculation scenarios
4. **Simple Architecture**: Focus on essential features, avoid over-engineering
5. **Australian Compliance**: Accurate implementation of Australian award wages and tax system

## Development Commands
```bash
npm run dev          # Development server
npm run test         # Run test suite
npm run build        # Production build
npm run type-check   # TypeScript validation
npx prisma migrate dev    # Database migrations
npx prisma db seed       # Seed test data
```

This guide prioritizes the MVP shift management system with accurate Australian pay calculations, using a test-first approach to ensure reliability and correctness.
