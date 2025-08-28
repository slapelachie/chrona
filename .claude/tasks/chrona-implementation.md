# Chrona - Australian Pay Tracker Implementation Plan

## Project Status: Foundation Complete ✅

### Completed Components (Phase 1)

#### ✅ Project Foundation
- Next.js 14+ project initialized with TypeScript
- Bootstrap 5 configured with custom professional dark theme
- Comprehensive color system inspired by modern dark interfaces
- ESLint and Prettier configured
- Project structure established following mobile-first principles

#### ✅ Database Infrastructure  
- SQLite database configured with Prisma ORM
- Comprehensive schema designed for Australian pay tracking:
  - User model for single-user setup
  - PayGuide model with award rates and penalties
  - TaxBracket and HECSThreshold models for Australian tax system
  - PublicHoliday model for penalty rate calculations
  - Shift model for work tracking with calculated fields
  - PayPeriod model for pay cycle management
  - PayVerification model for actual vs calculated pay comparison
- Database seeded with 2024-25 Australian tax data and HECS thresholds
- Sample pay guide based on General Retail Industry Award created
- Initial migrations successfully applied

#### ✅ Type System
- Comprehensive TypeScript types defined
- Prisma-generated types exported for consistency
- Form interfaces and calculation types established

#### ✅ Development Environment
- All build processes working correctly
- Code quality tools configured and passing
- Database seed script operational with realistic Australian data

#### ✅ Professional Design System
- **Dark-First Approach**: Modern professional dark theme as default
- **Comprehensive Color Palette**: 
  - Background hierarchy: Base (#27292c), Muted (#202225), Elevated (#37393c)
  - Text hierarchy: Primary (#aaa), Secondary (#777), Tertiary (#5a5a5a)
  - Accent system: Teal primary (#3bbbcc) with hover and active states
  - Status colors: Success (green), Warning (orange), Error (red), Info (blue)
  - Pay-specific colors: Regular shifts (teal), Overtime (coral), Penalty (purple), Holiday (violet)
- **Accessibility Focused**: WCAG AA compliant contrast ratios, proper focus management
- **Mobile-Optimized**: Touch-friendly interactions, appropriate shadows for dark theme
- **Professional Polish**: Subtle animations, elevated card design, sophisticated typography

---

## Next Implementation Phases

### Phase 2: Core Pay Calculation Engine (High Priority)
**Objective**: Build the foundational pay calculation system

#### 2.1 Australian Pay Calculations (`src/lib/calculations/`)
- **pay-calculator.ts**: Core pay calculation logic
  - Regular hours calculation
  - Overtime detection and calculation (1.5x, 2x rates)
  - Penalty rate calculations (evening, night, weekend, public holiday)
  - Casual loading application (25%)
  - Break time handling

- **tax-calculator.ts**: Australian tax system implementation
  - Income tax calculation using progressive tax brackets
  - HECS-HELP repayment calculation
  - Medicare levy calculation (2%)
  - Tax-free threshold handling
  - Net pay calculation from gross pay

- **pay-period-calculator.ts**: Pay period aggregation
  - Weekly/fortnightly pay period calculations
  - Superannuation calculation (11% minimum)
  - YTD earnings tracking
  - Pay period boundary management

#### 2.2 Date and Time Utilities (`src/lib/utils/`)
- **date-utils.ts**: Australian business logic
  - Public holiday detection
  - Business day calculations
  - Pay period date generation
  - Shift time parsing and validation

- **shift-utils.ts**: Shift-specific calculations
  - Shift duration calculation with breaks
  - Penalty time period detection
  - Overtime threshold checking

### Phase 3: Dashboard and Core UI (High Priority)
**Objective**: Create the main user interface for pay tracking

#### 3.1 Dashboard Page (`src/app/dashboard/`)
- **Current Pay Period Summary**
  - Hours worked to date
  - Estimated gross/net pay
  - Shifts remaining in period
  - Pay date countdown

- **Quick Actions**
  - Add new shift (mobile-optimized form)
  - View upcoming shifts
  - Quick pay verification

- **Key Metrics Cards**
  - Weekly hours trend
  - Average hourly earnings
  - Upcoming penalty shifts
  - Verification status

#### 3.2 Navigation and Layout (`src/components/layout/`)
- **Mobile-first navigation** with bottom tab bar
- **Responsive header** with user info and settings
- **Page transitions** optimized for mobile

#### 3.3 Core Components (`src/components/`)
- **shift-form.tsx**: Add/edit shifts with React Bootstrap form components
- **pay-summary-card.tsx**: Pay period summary using Bootstrap cards
- **hours-breakdown.tsx**: Visual hours breakdown with Bootstrap progress bars
- **earnings-chart.tsx**: Simple earnings visualization with Chart.js integration

### Phase 4: Shift Management (Medium Priority)
**Objective**: Complete shift lifecycle management

#### 4.1 Shift Management Pages
- **Add Shift**: Time picker, shift type selection, break management
- **Shift List**: Current and upcoming shifts with edit/delete
- **Shift Details**: Detailed view with pay breakdown
- **Recurring Shifts**: Template-based shift creation

#### 4.2 Smart Features
- **Public Holiday Detection**: Automatic penalty rate application
- **Shift Validation**: Overlap detection, reasonable duration checks
- **Quick Entry**: Recent shift templates, common shift patterns

### Phase 5: Pay Verification System (Medium Priority)
**Objective**: Implement actual vs calculated pay comparison

#### 5.1 Pay Verification Workflow
- **Pay Slip Input**: Manual entry of actual pay details
- **Discrepancy Detection**: Automated comparison with calculations
- **Verification History**: Track accuracy over time
- **Dispute Tracking**: Note discrepancies for follow-up

#### 5.2 Reporting Features
- **Pay Period Reports**: Detailed breakdown of calculations
- **Annual Summaries**: Tax year totals and averages
- **Accuracy Metrics**: Historical verification success rate

### Phase 6: Settings and Configuration (Low Priority)
**Objective**: Make the application configurable for different awards and situations

#### 6.1 User Settings
- **Personal Details**: Tax settings, HECS debt status
- **Pay Guide Selection**: Multiple award support
- **Notification Preferences**: Shift reminders, pay date alerts

#### 6.2 Pay Guide Management
- **Award Selection**: Common Australian awards
- **Custom Rates**: Override default rates
- **Rate History**: Track rate changes over time

---

## Technical Implementation Strategy

### Mobile-First Approach
- Bootstrap's responsive grid system (xs, sm, md, lg, xl breakpoints)
- React Bootstrap form components optimized for mobile input
- Touch-friendly interfaces with appropriate tap targets (min 44px)
- Progressive enhancement using Bootstrap's utility classes
- Offline-capable core functionality where possible

### Data Accuracy Focus
- Use Decimal.js for all financial calculations
- Implement comprehensive validation at all levels
- Store both calculated and actual values for verification
- Include audit trails for all pay calculations

### Australian Compliance
- Current tax rates and thresholds (2024-25)
- Accurate public holiday handling by state
- Modern award pay scales and penalties
- Superannuation guarantee compliance

### Performance Considerations
- Efficient database queries with proper indexing
- Client-side caching for frequently accessed data
- Optimistic updates for better user experience
- Bootstrap's optimized CSS and JavaScript bundles
- Selective Bootstrap component imports to reduce bundle size

---

## Success Criteria

### Phase 2 Success Metrics
- [ ] Accurate pay calculations within 1 cent precision
- [ ] Comprehensive test coverage for calculation engine
- [ ] Support for common Australian awards and penalties
- [ ] Correct tax and HECS calculations

### Phase 3 Success Metrics  
- [ ] Intuitive mobile-first dashboard interface using Bootstrap components
- [ ] Sub-2-second page load times with optimized Bootstrap bundle
- [ ] Responsive design working on 320px+ screens using Bootstrap grid
- [ ] Accessible interface meeting WCAG guidelines with Bootstrap's accessibility features

### Phase 4 Success Metrics
- [ ] Complete shift lifecycle management
- [ ] Efficient bulk shift entry workflows
- [ ] Automatic penalty rate detection
- [ ] Robust data validation and error handling

### Overall Project Success
- [ ] Single-user application fully functional
- [ ] Accurate Australian pay and tax calculations
- [ ] Modern, mobile-optimized Bootstrap interface
- [ ] Pay verification capability with discrepancy detection
- [ ] Production-ready code with comprehensive testing

---

## Risk Mitigation

### Technical Risks
- **Data Accuracy**: Comprehensive testing with real-world scenarios
- **Mobile Performance**: Regular testing on actual devices
- **Tax Compliance**: Regular updates to Australian tax tables

### User Experience Risks
- **Complexity**: Progressive disclosure of advanced features
- **Data Entry**: Smart defaults and validation
- **Learning Curve**: Intuitive design and helpful onboarding

### Maintenance Risks
- **Award Changes**: Modular pay guide system for easy updates
- **Tax Changes**: Externalized tax tables for annual updates
- **Database Growth**: Efficient queries and data archival strategy

---

## Next Steps

1. **Immediate**: Begin Phase 2 implementation with pay calculation engine
2. **Week 1-2**: Complete core calculation libraries with tests
3. **Week 3-4**: Implement dashboard UI and basic shift management
4. **Week 5+**: Iterative development of remaining phases based on testing and feedback

This plan provides a solid foundation for building a comprehensive Australian pay tracking application while maintaining focus on accuracy, usability, and mobile-first design principles using Bootstrap 5's robust responsive framework.

## Technology Stack Update

### Frontend Framework
- **Next.js 15+** with App Router and TypeScript
- **Bootstrap 5.3+** with comprehensive custom dark theme overrides
- **Professional Color System** inspired by modern dark interfaces
- **Bootstrap Icons** for consistent iconography

### UI Component Strategy & Design System
- **Dark-First Design**: Professional dark theme as primary interface
- **Color Hierarchy**: Sophisticated background and text layering system
- **Custom Bootstrap Components**: Enhanced with professional styling
- **Responsive Grid System**: Bootstrap's 12-column layout with dark theme optimization
- **CSS Custom Properties**: Comprehensive variable system for consistent theming
- **Pay Tracking Optimized**: Specialized colors for shift types and financial data
- **Accessibility First**: WCAG AA compliant with proper focus and contrast management

### Design System Benefits
- **Professional Appearance**: Modern dark theme suitable for financial applications
- **Better User Experience**: Reduced eye strain, battery optimization on OLED displays
- **Australian Professional Context**: Sophisticated styling appropriate for pay tracking
- **Bootstrap Foundation**: Mature CSS framework with enhanced custom theming
- **Accessibility Excellence**: WCAG AA compliance with proper contrast and focus management
- **Mobile Optimization**: Dark theme optimized for various mobile lighting conditions
- **Comprehensive Color System**: Specialized pay tracking colors with professional polish
- **Maintainable Codebase**: Well-organized CSS custom properties for easy theme updates