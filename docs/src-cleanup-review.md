# src Cleanup Review – 2025-10-29

- [x] **Blocker:** `src/lib/pay-period-tax-service.ts` now delegates to `getTaxYearStringFromDate`/`getCurrentAuTaxYearString`, fixing the padding bug.
- [x] **Major:** `src/lib/pay-period-range.ts` is a thin wrapper over `calculatePayPeriod` from `pay-period-utils`, eliminating duplicate period math.
- [x] **Major:** Shared `validateTimeString`/`validateDayOfWeek` live in `src/lib/validation.ts` and both time-frame validators import them.
- [x] **Major:** Introduced `TimeFramesEditor` with variant config so the overtime/penalty editors are lightweight wrappers.
- [x] **Minor:** Added `transformTimeFrameBase`/`withAuditFields` helpers so the response mappers share logic.
- [x] **Minor:** Removed unused `roundDownToDollar` from `TimeCalculations`.
- [x] **Minor:** Deleted the placeholder `src/lib/utils.test.ts` suite.
