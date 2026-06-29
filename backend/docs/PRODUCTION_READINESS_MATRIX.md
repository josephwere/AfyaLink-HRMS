# Production Readiness Matrix

## Purpose

This document is the executive dashboard for AfyaLink production readiness. It complements `PHASE_A_VERIFIED_BACKLOG.md` by tracking high-level status, verification progress, and open issues.

## How to use

- Update this matrix after each verification cycle.
- Use it for executive status checks, launch readiness reviews, and release gating.
- Keep the detailed engineering work in `PHASE_A_VERIFIED_BACKLOG.md`.

## Architecture freeze

The architecture is stable for this phase unless a critical production issue is discovered:
- NeuroEdge remains an external AI platform.
- AfyaLink remains the healthcare platform.
- AI interaction is exclusively through the gateway.
- New work focuses on verification, hardening, workflow completion, and bug fixes.

## Readiness metrics

| Metric | Target | Current |
|---|---|---|
| Modules implemented | 100% | 100% |
| Modules verified | 100% | TBD |
| P0 blockers open | 0 | TBD |
| P1 issues open | ≤5 | TBD |
| Critical workflow pass rate | 100% | TBD |
| API integration pass rate | 100% | TBD |
| Automated test pass rate | 100% | TBD |

## Readiness Summary

| Module | Status | Completion % | Verification % | Test Coverage | Backlog IDs | Open P0 Issues | Open P1 Issues | Last Verification | Owner |
|---|:---:|:---:|:---:|:---:|---|:---:|:---:|:---:|---|
| Authentication | 🟡 | 90% | 70% | Medium | AFY-P0-002 | 0 | 1 | 2026-06-28 | TBD |
| RBAC / Hospital isolation | 🟡 | 85% | 60% | Medium | AFY-P0-001, AFY-P0-002 | 1 | 1 | 2026-06-28 | TBD |
| Multi-tenancy | 🟡 | 80% | 55% | Medium | AFY-P0-001 | 1 | 1 | 2026-06-28 | TBD |
| Audit / Evidence | 🟡 | 80% | 55% | Medium | AFY-P0-03 | 1 | 1 | 2026-06-28 | TBD |
| Notifications | 🟡 | 85% | 60% | Medium | - | 0 | 1 | 2026-06-28 | TBD |
| Offline resilience | 🟡 | 75% | 50% | Medium | AFY-P0-006 | 1 | 1 | 2026-06-28 | TBD |
| Runtime / Health | 🟢 | 95% | 80% | High | AFY-P0-007 | 0 | 0 | 2026-06-28 | TBD |
| AI Gateway | 🟢 | 100% | 100% | Medium | - | 0 | 0 | 2026-06-28 | TBD |
| Appointments | 🟡 | 80% | 30% | Low | AFY-P0-004, AFY-P0-005 | 1 | 2 | 2026-06-28 | TBD |
| Laboratory | 🟡 | 75% | 20% | Low | - | 1 | 2 | 2026-06-28 | TBD |
| Pharmacy | 🟡 | 75% | 20% | Low | - | 1 | 2 | 2026-06-28 | TBD |
| Billing | 🟡 | 75% | 20% | Low | AFY-P0-005 | 1 | 2 | 2026-06-28 | TBD |
| Patient workflow | 🟡 | 80% | 40% | Low | AFY-P0-001, AFY-P0-004, AFY-P0-005, AFY-P0-006 | 1 | 2 | 2026-06-28 | TBD |

## Status definitions

- 🟢 Production Ready: verified, audited, and safe for release.
- 🟡 In Verification: implemented and partially verified, still requires operational proof.
- 🟠 Caution: implementation exists but verification is incomplete or risk remains.
- 🔴 Blocked: critical gaps remain that prevent release.

## Current open issues

- Authentication: AFY-P0-009 Google OAuth "Invalid Google token" error (root cause pending verification; `.env.example` updated).
- RBAC / Hospital isolation: validate cross-hospital isolation across key workflows (AFY-P0-001, AFY-P0-002).
- Audit / Evidence: confirm audit completeness across patient, billing, and offline flows (AFY-P0-003).
- Offline resilience: verify conflict resolution and duplicate suppression (AFY-P0-006).

## Notes

- `Completion %` is an implementation estimate based on current repository evidence.
- `Verification %` reflects the percentage of required operational validation that has been completed.
- `Test Coverage` is an initial estimate and should be updated with actual automated coverage metrics.
- This document should remain concise and executive-friendly.

## Relationship to backlog

- Use `PHASE_A_VERIFIED_BACKLOG.md` for detailed engineering tasks, evidence, and acceptance criteria.
- Use `PRODUCTION_READINESS_MATRIX.md` for the high-level readiness snapshot and launch gating.
