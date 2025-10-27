# Testing Backlog – Pay Guide & UI Foundations

## High Priority

| Area | File / Entry Point | Suggested Coverage | Rationale | Status |
| --- | --- | --- | --- | --- |
| Pay guide duplication API | `src/app/api/pay-rates/[id]/duplicate/route.ts` | Vitest API tests seeding a guide (with penalty/overtime/public holiday rows) and calling `POST` to assert 201 payload, relationship cloning, `isActive` default, 404 for unknown IDs, and validation failures | Complex transactional logic with no direct tests; protects new duplication flow and validation branches | ✅ Completed |
| Pay guide utilities | `src/lib/pay-guide-utils.ts` | Unit tests (mock prisma) for `generateUniquePayGuideName` collisions/guard, blank name rejection, and `buildPayGuideUpdateData`/`createPayGuideData` Decimal/Date transforms | Ensures utility helpers stay stable while refactoring persistence logic | ✅ Completed |
| Pay guide validation | `src/lib/pay-guide-validation.ts` | Cases covering optional update fields, invalid IANA timezones, min/max shift hours comparisons, and date range errors | Locks down validation behaviour shared across create/update/duplicate APIs | ✅ Completed |
| Pay guide form | `src/components/pay-guides/pay-guide-form.tsx` | React Testing Library spec for edit prefill, optimistic submit state, success callback emission, and error messaging on fetch failures | Critical UX entry point; verifies new component primitives and fetch paths | ✅ Completed |
| Pay guide list | `src/components/pay-guides/pay-guides-list.tsx` | Component tests stubbing `fetch`, `confirm`, `alert`, and `router` to cover search filtering, active-only toggle, duplicate/delete flows, and error UI | Ensures list interactions remain consistent after future styling/data changes | ✅ Completed |
| Settings pay guide selector | `src/components/settings/pay-guide-selector.tsx` | Tests for fetch lifecycle, search filtering, “set default” button, and error display (mocking `usePreferences` + requests) | Guards new settings UX and preference wiring | ✅ Completed |

## Secondary

| Area | File / Entry Point | Suggested Coverage | Rationale | Status |
| --- | --- | --- | --- | --- |
| Select component | `src/components/ui/select.tsx` | Snapshot/interaction tests verifying generated IDs, label association, aria attributes, required glyph, and disabled state styling | Foundational form control used across pages | ✅ Completed |
| Toggle component | `src/components/ui/toggle.tsx` | Tests for label association, description rendering, aria-disabled behaviour, and keyboard toggling | Ensures accessibility parity for custom toggle | ✅ Completed |
| Alert component | `src/components/ui/alert.tsx` | Tests that tone-to-role mapping and custom role overrides render correctly | Prevents regressions in accessibility semantics | ✅ Completed |
| Card component | `src/components/ui/card.tsx` | Tests for interactive focusability, loading skeleton layout, and padding variants | Guards against subtle UX regressions in shared layout primitive | ✅ Completed |
| Preferences hook | `src/hooks/use-preferences.ts` | Unit tests faking `localStorage`/`fetch` to cover hydration, clamp logic, optimistic merges, error recovery, and reset | Keeps client preference sync reliable across settings surfaces | ✅ Completed |
| Settings panels consuming preferences | e.g. `src/components/settings/shift-preferences.tsx` | Lightweight render test ensuring toggles wire through `usePreferences` | Detects integration breakages once hook is covered | ✅ Completed |

## Next Steps

1. Land high-priority specs, then run `npm run test:run` to baseline.
2. Schedule secondary coverage after primitives stabilise to avoid regressions as the design system evolves.
