# CLAUDE_PROJECT_SPEC.md

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
This project is a **single-user web application** for tracking **casual pay in Australia** and forecasting future earnings based on rostered shifts. It must account for:
- Fair Work pay rules (overtime, penalties, allowances)  
- Australian tax thresholds (including HECS/HELP repayment obligations)  
- Pay verification (comparing actual payslips with forecasts)  

The system should prioritize **design and usability first**, followed by backend/pay calculation logic.

---

## Goals
- Provide a **mobile-first, sleek, modern interface**
- Enable users to:
  1. Enter rosters (planned shifts)  
  2. Forecast pay automatically  
  3. Verify actual pay against forecasts  
  4. Visualize income, deductions, and tax  

- Support **SQLite in development** and a **production-ready relational DB** (Postgres/MySQL) with migrations.

---

## Core Features

### 1. Roster Management
- Input rostered shifts (date, time, hours, role, etc.)
- Support recurring shifts or manual entry
- Store metadata (location, job classification, pay grade if relevant)

### 2. Pay Forecasting
- Apply Fair Work pay guide rules ([Fair Work Award MA000004](https://awards.fairwork.gov.au/MA000004.html)):
  - Base hourly rate  
  - Overtime multipliers  
  - Penalty rates (weekend, public holiday, night shifts)  
  - Allowances (meal, travel, uniform, etc.)
- Forecast gross pay from rostered shifts
- Apply **Australian tax threshold model**:
  - Progressive tax brackets  
  - Medicare levy  
  - HECS/HELP repayment thresholds

### 3. Pay Verification
- Allow manual entry of actual payslip values
- Compare against forecasts:
  - Show discrepancies (highlight over/underpayment)
  - Track history of adjustments and notes

### 4. Dashboard
- Present key insights:
  - Forecast vs. actual income  
  - Tax + HECS deductions  
  - Upcoming rostered pay  
  - Weekly/monthly/annual summaries  
- Include graphs (earnings over time, breakdown by type of pay, tax deductions)

---

## Technical Requirements

### Frontend
- **Next.js** (App Router)  
- **TypeScript** for type safety  
- **TailwindCSS** for styling  
- UI must be responsive (mobile-first), accessible (ARIA roles, focus states), and modern (rounded corners, shadows, clean typography).

### Backend
- **Next.js server actions / API routes**  
- **Database**:  
  - Development: SQLite  
  - Production: Postgres or MySQL (ask before deciding)  
  - Must support migrations (Prisma or similar)  
- **Business Logic Layer**:
  - Pay rule engine (Fair Work rules)  
  - Tax/HECS calculation engine  
  - Verification and discrepancy detection  

### Authentication
- Single-user app initially  
- Local session storage (no multi-user accounts needed in v1)

### Deployment
- Target deployment: Vercel (or similar)  
- Configurable environment variables (DB connection, secrets, etc.)

---

## Data Model (Initial Draft)

- **User** (single-user instance, placeholder table for future multi-user)  
  - `id`, `name`, `settings` (optional tax/HECS configs)  

- **Shift**  
  - `id`, `date`, `start_time`, `end_time`, `hours_worked`, `role`, `pay_rate_applied`  

- **PayRule**  
  - `id`, `type` (overtime, weekend, penalty, allowance)  
  - `multiplier` or `fixed_amount`  
  - `conditions` (time/day triggers)  

- **Forecast**  
  - `id`, `shift_id`, `gross_pay`, `tax_deductions`, `net_pay`  

- **Payslip**  
  - `id`, `date_received`, `gross`, `net`, `tax_paid`, `hecs_paid`  
  - Links to relevant forecast(s)  

- **Verification**  
  - `id`, `forecast_id`, `payslip_id`, `status` (matched/under/over)  
  - `discrepancy_amount`, `notes`

---

## Implementation Plan

### Phase 1: Design & UI
- Build wireframes/mockups (Dashboard, Roster, Forecast, Pay Verification)  
- Create reusable components:
  - Navbar, cards, tables, modals, charts  
  - Forms (shift input, payslip entry)  
- Implement responsive layout (mobile → desktop scaling)

### Phase 2: Data & Backend Setup
- Initialize database with Prisma (or alternative ORM)  
- Implement schema + migrations for shifts, pays, rules, and verification  
- Seed with example pay rules and tax brackets  

### Phase 3: Pay Forecast Engine
- Core logic for:
  - Base rate x hours  
  - Penalties and overtime (based on shift conditions)  
  - Tax and HECS deductions  
- Store forecast results linked to shifts  

### Phase 4: Pay Verification
- Input payslip values  
- Compare forecast vs actual  
- Record discrepancies  
- Add alerts for mismatches  

### Phase 5: Dashboard & Reporting
- Charts and graphs:
  - Income over time  
  - Gross vs net  
  - Tax breakdown  
- Export options (CSV/Excel for records)

### Phase 6: Deployment & Production Prep
- Config for SQLite (dev) and Postgres/MySQL (prod)  
- Add migration scripts  
- Create `.env.example` file with all required environment variables  

---

## Design Guidelines
- **Modern, sleek UI**:
  - Rounded corners, soft shadows, subtle gradients
  - Clean typography, consistent spacing
- **Accessible**:
  - Semantic HTML, ARIA roles, screen reader labels
- **Charts/Visuals**:
  - Use libraries like Recharts or Chart.js
  - Prioritize clarity, not clutter  

---

## Future Enhancements (Not in v1)
- Multi-user support with authentication
- Rosters import (CSV/Excel upload)  
- Payslip OCR (auto-read payslips)  
- Notifications/reminders  
- Real-time sync with Fair Work updates  

---

## Instructions for Claude (coding partner)
- Work in **small, reviewable chunks**.  
- Output code in **file-by-file format** (with filenames).  
- Start with **UI design + components** (mocked data), then move into backend logic.  
- Always propose schema/migrations before implementing them.  
- Ask before finalizing the production DB engine.  
- Keep UI modern, sleek, and mobile-first.  
