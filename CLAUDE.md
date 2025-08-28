# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Plan and Review
Before starting work.
Before you begin, write a detailed implementation plan in a file named .claude/tasks/TASK_NAME.md.

This plan should include:
- A clear, detailed breakdown of the implementation steps.
- The reasoning behind your approach.
- A list of specific tasks.

Focus on the Minimum Viable product (MVP) to avoid over-planning. Once the plan is ready, please ask me to review it. Do not proceed with the implementation until I have approved the plan.

While implementing and as you work, keep the plan updated. After you complete a task, append a detailed description of the changes you've made to the plan. This ensure thhat the progress and next steps are clear and can be easily handed to other engineers if needed.

## Testing Requirements
- **Write tests for all new features** unless explicitly told not to
- **Run tests before commiting** to ensure code quality and functionality

## Project: Chrona - Australian Casual Pay Tracker

### Project Overview
Chrona is a mobile-first Next.js application designed to track Australian casual pay, forecast future earnings through roster data, and verify actual payments against calculated amounts. This is a single-user application focusing on accurate Australian pay and tax calculations.

**Key Features:**
- Roster management and shift tracking
- Australian pay calculation engine (overtime, penalties, casual loading)
- Australian tax calculations (including HECS-HELP)
- Pay forecasting and verification
- Modern, sleek mobile-first interface
- Pay slip verification against calculated amounts

**Technology Stack:**
- Next.js 14+ with App Router and TypeScript
- Bootstrap 5 with React Bootstrap components
- Prisma ORM with SQLite (dev) / PostgreSQL (production)
- React Hook Form for form handling
- Chart.js/React-Chartjs-2 for data visualization

### Development Environment

**Database Setup:**
- Development: SQLite with Prisma
- Production: PostgreSQL support
- Run migrations: `npx prisma migrate dev`
- Seed database: `npx prisma db seed`

**Required Commands:**
- Development server: `npm run dev`
- Build: `npm run build`
- Type checking: `npm run type-check`
- Linting: `npm run lint`
- Database operations: `npx prisma studio`

### Project Structure Guidelines

**Directory Organization:**
```
src/
├── app/              # Next.js App Router pages
├── components/       # Reusable UI components
├── lib/             # Utility functions and configurations
├── types/           # TypeScript type definitions
├── hooks/           # Custom React hooks
└── styles/          # Global styles and Tailwind config
prisma/
├── schema.prisma    # Database schema
├── migrations/      # Database migrations
└── seed.ts         # Database seeding
```

**Component Naming:**
- Use kebab-case for component files: `pay-calculator.tsx`
- Use PascalCase for component names: `PayCalculator`
- Group related components in subdirectories
- Wrap React Bootstrap components for consistency: `<Button>` instead of `<BSButton>`

### Australian Pay Calculation Guidelines

**Pay Rate Implementation:**
- All rates must be configurable and updatable
- Support for multiple award types
- Accurate overtime calculations (1.5x, 2x)
- Penalty rates (evening, night, weekend, public holidays)
- Casual loading (typically 25%)

**Tax Calculations:**
- Australian tax brackets with current rates
- HECS-HELP repayment calculations
- Medicare levy and surcharge
- Tax-free threshold handling
- Accurate net pay calculations

**Data Accuracy Requirements:**
- All calculations must be precise to the cent
- Use Decimal.js for financial calculations
- Validate all inputs before processing
- Store calculated vs actual pay for verification

### Mobile-First Design Guidelines

**Responsive Design:**
- Use Bootstrap's responsive grid system (xs, sm, md, lg, xl breakpoints)
- Start with mobile design (320px+)
- Progressive enhancement using Bootstrap utility classes
- Touch-friendly interfaces with minimum 44px tap targets
- Optimize for thumb navigation with bottom-aligned primary actions

**Component Standards:**
- Use React Bootstrap form components optimized for mobile
- Implement proper input types for mobile keyboards (tel, email, number)
- Add loading states using Bootstrap spinners
- Ensure WCAG compliance using Bootstrap's accessibility features
- Use Bootstrap's form validation classes for user feedback

**Bootstrap Best Practices:**
- Use Bootstrap's container-fluid with custom mobile-container class
- Leverage Bootstrap's spacing utilities (p-*, m-*, g-*)
- Implement consistent button sizes and variants
- Use Bootstrap's card components for content organization
- Apply proper semantic HTML with Bootstrap's utility classes

### Database Migration Guidelines

**Prisma Best Practices:**
- Always create migrations for schema changes: `npx prisma migrate dev --name descriptive-name`
- Test migrations with seed data
- Never modify existing migrations
- Keep migrations atomic and reversible

**Schema Changes:**
- Add proper indexes for query optimization
- Use appropriate data types for Australian currency (Decimal)
- Include proper constraints and validations
- Document complex schema relationships

**Data Seeding:**
- Seed with realistic Australian pay guide data
- Include current tax brackets and rates
- Provide sample shifts and pay periods for testing
- Ensure seed data is regularly updated

### Pay Verification Standards

**Accuracy Requirements:**
- Calculate pay to the exact cent
- Account for rounding rules in Australian payroll
- Verify calculations against multiple scenarios
- Log discrepancies for audit purposes

**Testing Standards:**
- Unit tests for all calculation functions
- Integration tests for pay period processing
- E2E tests for critical user workflows
- Test with edge cases (public holidays, leap years, etc.)

