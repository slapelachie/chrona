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


## Project Overview
Chrona is a single-user Next.js application for tracking Australian casual pay with customizable rates, tax calculations, and pay verification. The application focuses on Australian tax compliance including HECS debt, Medicare levy, and complex penalty rate structures.


## Common Development Commands

### Development Server
```bash
npm run dev          # Start development server on localhost:3000
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript compiler without emitting files
```

### Database Operations
```bash
npx prisma migrate dev          # Create and apply new migration
npx prisma migrate dev --name   # Create migration with specific name
npx prisma generate            # Generate Prisma client
npx prisma studio             # Open Prisma Studio database browser
npx prisma db seed           # Run seed script (when implemented)
```

### Key Build Commands
- Always run `npm run type-check` before committing
- Run `npm run build` to ensure production build works
- Database migrations are required when changing `prisma/schema.prisma`

## Architecture Overview

### Database Architecture (Prisma + SQLite)
The application uses a comprehensive database schema designed for Australian casual pay tracking:

**Core Models:**
- `Settings` - Single-row configuration for tax settings, HECS debt, superannuation rates
- `PayRate` - Flexible pay rate system supporting base rates, overtime, penalties, night rates
- `Shift` - Individual work shifts with calculated hours and pay breakdowns
- `PayPeriod` - Aggregated pay calculations for fortnightly/weekly periods
- `PayVerification` - Comparison between calculated and actual pay received
- `TaxBracket` & `HecsThreshold` - Australian tax tables (seed data)

**Key Design Decisions:**
- SQLite for development, configurable for production databases
- Decimal fields for precise financial calculations
- Effective date tracking for pay rate changes
- Audit trail with `createdAt`/`updatedAt` on all models

### Frontend Architecture (Next.js 14 App Router)

**Page Structure:**
- `/` - Landing page with project overview
- `/dashboard` - Main overview with key metrics and forecasts
- `/roster` - Shift management and calendar view
- `/settings` - Tax configuration and pay rate management
- `/verification` - Pay comparison and accuracy tracking

**Component Architecture:**
- `src/components/ui/` - shadcn/ui base components (Button, Card, Form, Input)
- `src/components/navigation.tsx` - Main navigation with active state handling
- Form validation using React Hook Form + Zod schemas
- Responsive design with Tailwind CSS and CSS variables for theming

### Type System (`src/types/index.ts`)
- Re-exports Prisma-generated types
- Zod schemas for form validation (`settingsSchema`, `payRateSchema`, etc.)
- Utility types for calculations and API responses
- Strong typing for Australian tax calculations

### Key Technical Patterns

**Form Handling:**
- React Hook Form with Zod resolvers for validation
- Form components follow shadcn/ui patterns
- Type-safe form data with inferred Zod types

**Database Access:**
- Centralized Prisma client in `src/lib/db.ts`
- Development logging enabled for query debugging
- Global instance management for Next.js hot reloading

**Styling System:**
- Tailwind CSS with design system tokens
- shadcn/ui components with variant-based styling
- CSS variables for consistent theming (light/dark support planned)

## Australian Tax Compliance Features

The application is specifically designed for Australian casual workers:
- Configurable tax-free threshold election
- HECS/HELP debt tracking and repayment calculations
- Medicare levy with exemption support
- Complex penalty rates (weekends, public holidays, night shifts)
- Fortnightly/weekly pay period support
- Superannuation guarantee calculation (11%)

## Development Workflow

### Implementation Planning
Before major features, create detailed plans in `.claude/tasks/TASK_NAME.md` with:
- Step-by-step implementation approach
- Database schema changes required
- Component and API design
- Testing strategy

### Database Changes
1. Modify `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name descriptive-name`
3. Update TypeScript types in `src/types/index.ts` if needed
4. Regenerate Prisma client with `npx prisma generate`

### Component Development
- Use shadcn/ui patterns for consistency
- Implement responsive design with Tailwind
- Create Zod schemas for form validation
- Follow Next.js App Router conventions

### Financial Calculations
- Use Decimal fields in database for precision
- Implement calculation engines in `src/lib/` utilities
- Create comprehensive test coverage for tax calculations
- Validate against Australian tax rules and rates

## Current Implementation Status
Phase 1 (Infrastructure) is complete. The application has:
- Full database schema with migrations
- Complete page routing and navigation
- Component system with shadcn/ui
- Type system with Zod validation
- Responsive UI foundation

Next phases focus on implementing the core pay calculation engine, settings management, and shift tracking functionality.
