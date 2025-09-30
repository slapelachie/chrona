3. Establish Baseline
   - [x] Run key scripts (`npm run dev`, `npx vitest`, `npx playwright test` if applicable) to capture pre-review failures.
     - `npm run dev` (timeout 10s) stood up Next.js 15.5.2 successfully on port 3002 after detecting port 3000 in use.
     - `npx vitest run` (completed 2025-09-29) failed: 28 test files red, 107 failing specs. Largest clusters stem from Prisma schema drift (missing fields like `hecsHelpRate`, `verified`) and updated tax APIs expecting different shapes, leaving most tax-calculation suites broken.
     - `npx playwright test` exited with "No tests found" (2025-09-29) while bootstrapping a dev server on port 3002.
   - [x] Document any failing suites before inspecting code.
     - Tax calculator + pay-period services: `Cannot read properties of undefined (reading 'plus')` indicates Decimal helper regressions or missing initialisation.
     - Prisma-backed API suites (pay periods, tax settings/config/coefficients) consistently error on schema mismatch (`Unknown argument 'verified'`, missing `hecsHelpRate`, `deleteMany` undefined), signalling generated client or schema updates not reconciled.
     - Tax preview API helpers crash because mocked Prisma client lacks `deleteMany` stubs.

4. Scan the Diff
   - [ ] Review file list for unexpected directories, generated artifacts, or secrets.
   - [ ] Confirm the change surface matches the stated scope.

5. Design Consistency
   - [ ] Verify React/Next components reuse shared primitives (`AppShell`, `Button`, `Card`).
   - [ ] Check SCSS tokens, dark-theme palettes, and responsive patterns align with Chrona standards.

6. Logic & Data Flow
   - [ ] Trace hooks/utilities (e.g., `useFinancialYearStats`) for correct memo deps and error/loading handling.
   - [ ] Cross-check updated types in `src/types` for compatibility with API responses.

7. UI & UX Validation
   - [ ] Ensure visual changes follow established UX, including status chips, charts, typography, and spacing.
   - [ ] Confirm responsive behavior across breakpoints.

8. Accessibility
   - [ ] Validate semantic elements, focus states, and ARIA attributes for interactive controls.
   - [ ] Confirm keyboard navigation works for toggles, tables, and dialogs.

9. Performance Considerations
   - [ ] Identify unnecessary re-renders or heavy computations lacking memoization.
   - [ ] Check for new large bundles or blocking API calls.

10. Tests & Coverage

- [ ] Verify unit/integration tests cover new logic and data paths.
- [ ] Request additional tests when critical flows lack coverage.

11. Manual QA

- [ ] Launch the app (`npm run dev`) and exercise affected routes (e.g., `/statistics`, `/timeline`).
- [ ] Validate API interactions and UI behavior with available mocks or staging data.

12. Documentation & Cleanliness

- [ ] Confirm README/IMPLEMENTATION_GUIDE updates when behavior changes.
- [ ] Ensure no stray TODOs, console logs, or dead code remain.

13. Summarize Findings

- [ ] Draft review comments ordered by severity with file:line references.
- [ ] Highlight outstanding risks or assumptions needing clarification.

14. Approval Gate

- [ ] Approve only after blockers resolve, tests pass, and scope matches acceptance criteria.
- [ ] Otherwise request changes with clear action items.
