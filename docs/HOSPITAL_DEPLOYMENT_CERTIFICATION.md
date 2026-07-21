# Hospital Deployment Certification

- Generated: 2026-07-09T18:55:34.032Z
- Certification status: **NOT CERTIFIED FOR PRODUCTION**

## 1. Is AfyaLink safe for production?

- Partially or No. The E2E test crawl or E2E specs surfaced active errors or test failures. All blockers must be cleared before starting production operations.

## 2. Is it safe for multiple hospitals?

- Pending. The E2E specs surfaced errors in permissions or core workflows, which must be resolved to guarantee absolute cross-tenant isolation.

## 3. Maximum recommended users

- Initial rollout: 100-250 concurrent users.
- Multi-hospital scaling: 1,000-2,500 concurrent users following full database indexing review.

## 4. Rollout strategy

- Phase 1: Pilot single hospital (e.g. AfyaLink Demo Medical Center) with general consultations and front-desk bookings.
- Phase 2: Open full workflows (Lab, Pharmacy, Inpatient wards, Billing) in staging environments.
- Phase 3: Rollout to secondary partner clinics and hospitals following 2 weeks of zero-incident live operation.

## 5. Remaining blockers

- Playwright E2E suite has 16 failing test specs.
- Crawl found 68 unreachable, forbidden, or broken pages.
