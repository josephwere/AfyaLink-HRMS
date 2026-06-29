# Phase A Verified Backlog

## Purpose

This document is the single source of truth for verified Phase A engineering work. It distinguishes implementation from verification and keeps every gap rooted in evidence.

## Summary Status

| Module | Implemented | Verified | Production Ready | Owner |
|---|:---:|:---:|:---:|---|
| Authentication | ✅ | ✅ | 🟡 | TBD |
| RBAC / Hospital isolation | ✅ | ✅ | 🟡 | TBD |
| Multi-tenancy | ✅ | ✅ | 🟡 | TBD |
| Audit / Evidence | ✅ | ✅ | 🟡 | TBD |
| Notifications | ✅ | ✅ | 🟡 | TBD |
| Offline resilience | ✅ | ✅ | 🟡 | TBD |
| Runtime / Health | ✅ | ✅ | 🟢 | TBD |
| AI Gateway | ✅ | ✅ | 🟢 | TBD |
| Appointments | ✅ | ⏳ | ⏳ | TBD |
| Laboratory | ✅ | ⏳ | ⏳ | TBD |
| Pharmacy | ✅ | ⏳ | ⏳ | TBD |
| Billing | ✅ | ⏳ | ⏳ | TBD |
| Patient workflow | ✅ | ⏳ | ⏳ | TBD |

## Evidence

The backlog is grounded in observed repository evidence. Key sources include:

- `backend/routes/authRoutes.js`
- `backend/middleware/authMiddleware.js`
- `backend/routes/auditRoutes.js`
- `backend/routes/notificationsRoutes.js`
- `backend/routes/offlineRoutes.js`
- `backend/app.js`
- `backend/services/neuroedgeGatewayClient.js`
- `backend/tests/securityHardening.test.js`
- `backend/tests/hospitalVerification.test.js`
- `backend/tests/integrationControlPlane.test.js`

## Principles

- No new feature or bug enters the backlog without evidence.
- Every backlog item includes Module, Finding, Evidence, Status, Priority, Owner, and Acceptance Criteria.
- Implementation, verification, and production readiness are tracked separately.
- Only `PHASE_A_VERIFIED_BACKLOG.md` and `PRODUCTION_READINESS_MATRIX.md` are the living governance documents for Phase A.
- The architecture is considered stable for this phase unless a critical production issue is discovered:
  - NeuroEdge remains an external AI platform.
  - AfyaLink remains the healthcare platform.
  - AI interaction is exclusively through the gateway.
  - New work focuses on verification, hardening, workflow completion, and bug fixes, not architectural redesign.

## Verification Sprint Plan

### Sprint 1 – Platform Foundation
- Verify login/logout for every supported role.
- Verify 2FA and recovery flows.
- Attempt cross-hospital access to confirm tenant isolation.
- Confirm every privileged action creates an audit record.
- Simulate offline synchronization and conflict resolution.
- Run health checks with the database unavailable.
- Test notification delivery and read/unread behavior.

### Sprint 2 – Patient Journey
- Register a patient.
- Schedule an appointment.
- Check the patient in.
- Complete a consultation.
- Create/update the EMR.
- Order laboratory tests.
- Dispense medication.
- Generate billing and process payment.
- Discharge the patient.

### Sprint 3 – Department Verification
- Verify Laboratory, Pharmacy, Billing, Insurance, Inventory, Reports, Analytics, Radiology, and other modules independently.
- Then verify their integration into the patient journey.
- Document failures as backlog items with traceable evidence.

## P0 Verified Backlog

### AFY-P0-001 Cross-hospital data isolation
- Module: auth middleware, hospital-scoped RBAC, patient flows, audit, offline metrics
- Finding: repository evidence shows strong tenant guards, but operational verification is required.
- Evidence:
  - `backend/middleware/authMiddleware.js`
  - `backend/middleware/roleMiddleware.js`
  - `backend/routes/auditRoutes.js`
  - `backend/routes/notificationsRoutes.js`
  - `backend/routes/offlineRoutes.js`
  - `backend/tests/hospitalVerification.test.js`
- Status: Implemented ✅, Verified ⏳, Production Ready ⏳
- Priority: P0
- Owner: TBD
- Acceptance criteria:
  - Token from Hospital A cannot retrieve Hospital B patient, billing, appointment, or audit records.
  - Hospital admin can query only hospital-specific audit, notifications, and offline metrics.
  - API responses do not leak other hospital IDs, names, or records.

### AFY-P0-002 Authorization bypass verification
- Module: protect middleware, requireRole guards, override logic
- Finding: endpoint guards exist, but bypass and override paths need proof.
- Evidence:
  - `backend/middleware/authMiddleware.js`
  - `backend/middleware/roleMiddleware.js`
  - `backend/routes/authRoutes.js`
  - `backend/tests/securityHardening.test.js`
- Status: Implemented ✅, Verified ⏳, Production Ready ⏳
- Priority: P0
- Owner: TBD
- Acceptance criteria:
  - All `requireRole(...)` endpoints are exercised with denied roles and return 403.
  - Privileged override behavior is audited and does not permit unintended writes.
  - Unprotected read-only routes do not grant write access.

### AFY-P0-003 Audit completeness
- Module: auditRoutes, AuditLog, ComplianceLedger, evidence bundle
- Finding: action logging is implemented; coverage across workflows must be validated.
- Evidence:
  - `backend/routes/auditRoutes.js`
  - `backend/models/AuditLog.js`
  - `backend/models/ComplianceLedger.js`
  - existing audit route behavior
- Status: Implemented ✅, Verified ⏳, Production Ready ⏳
- Priority: P0
- Owner: TBD
- Acceptance criteria:
  - Sample workflows produce corresponding AuditLog entries.
  - `GET /api/audit/evidence-bundle` returns logs and ledger entries for requested time ranges.
  - Audit entries include actor, hospital, resource, action, and timestamps.

### AFY-P0-004 Patient record integrity
- Module: patient registration, encounter, EMR updates, transfers, discharge
- Finding: patient lifecycle support exists but end-to-end data integrity is unverified.
- Evidence:
  - `backend/models/Patient.js`
  - patient route controllers and workflow controllers
  - `backend/routes/patientRoutes.js`
- Status: Implemented ✅, Verified ⏳, Production Ready ⏳
- Priority: P0
- Owner: TBD
- Acceptance criteria:
  - Patient created in one hospital remains isolated and intact across registration, consultation, lab, pharmacy, and billing.
  - Updates do not overwrite unrelated patient records.
  - Data remains consistent when branches/hospitals are verified or deactivated.

### AFY-P0-005 Billing accuracy
- Module: billing, claims, payments, insurance connectors
- Finding: billing flows are present; numeric accuracy and reconciliation need verification.
- Evidence:
  - `backend/routes/billingRoutes.js`
  - `backend/routes/claimsRoutes.js`
  - `backend/services/etimsService.js`
  - `backend/tests/integrationControlPlane.test.js`
- Status: Implemented ✅, Verified ⏳, Production Ready ⏳
- Priority: P0
- Owner: TBD
- Acceptance criteria:
  - Billing workflow generates invoices and claims with expected totals.
  - Payment capture updates billing status and audit trail.
  - Insurance integrations report ready/failed statuses consistently.

### AFY-P0-006 Offline synchronization conflict resolution
- Module: offlineRoutes, integrationQueue, offline client metrics
- Finding: offline support exists, but recovery and duplication handling require operational proof.
- Evidence:
  - `backend/routes/offlineRoutes.js`
  - `backend/services/integrationQueue.js`
  - `backend/models/OfflineClientMetric.js`
- Status: Implemented ✅, Verified ⏳, Production Ready ⏳
- Priority: P0
- Owner: TBD
- Acceptance criteria:
  - Offline client metrics are stored and retrievable by hospital/admin.
  - Offline upload path accepts queued items and records the action in audit.
  - Failed or duplicate payloads do not create duplicate records or cross-tenant leaks.

### AFY-P0-007 Backup and disaster recovery verification
- Module: readiness probes, database readiness, startup/shutdown
- Finding: runtime readiness is implemented; backup/recovery needs explicit operational validation.
- Evidence:
  - `backend/app.js`
  - `backend/config/db.js`
  - `/readyz` and `/api/health` endpoints
- Status: Implemented ✅, Verified ⏳, Production Ready ⏳
- Priority: P0
- Owner: TBD
- Acceptance criteria:
  - `/readyz` and `/api/health` report DB unavailability correctly.
  - Service restarts cleanly after simulated failure.
  - Backup/restore procedures are documented or automated where available.

### AFY-P0-008 Performance under concurrent users
- Module: app runtime, auth, database, async jobs
- Finding: hardening and load probes exist; full load testing is pending.
- Evidence:
  - `backend/app.js`
  - `backend/perf/k6/smoke.js`
  - `backend/perf/k6/global-burst.js`
- Status: Implemented ✅, Verified ⏳, Production Ready ⏳
- Priority: P0
- Owner: TBD
- Acceptance criteria:
  - Smoke/load tests against `/readyz`, auth, patient, and billing paths.
  - No unacceptable error spikes or queue backlogs during expected bursts.

### AFY-P0-009 Google OAuth token verification workflow
- Module: googleAuthController, OAuth2Client, token verification, frontend integration
- Observed blocker: Google OAuth login returns "Invalid Google token."
- Verified gap: `.env.example` did not document `GOOGLE_CLIENT_ID`, which could lead to deployment misconfiguration.
- Evidence:
  - `backend/controllers/googleAuthController.js` (line 10): OAuth2Client constructs using process.env.GOOGLE_CLIENT_ID
  - `backend/.env.example`: Missing GOOGLE_CLIENT_ID configuration
  - `backend/routes/authRoutes.js` (line 35): POST /google endpoint registered
  - `backend/tests/auth.test.js` (line 90+): Test for Google account password reset exists but no Google OAuth flow test
- Status: Implemented ✅, Verified ❌, Production Ready ❌
- Priority: P0 (blocking Auth verification)
- Owner: TBD
- Root cause: Pending verification
- Acceptance criteria (all must pass to close AFY-P0-009):
  - ✅ `.env.example` documents GOOGLE_CLIENT_ID (completed)
  - Backend starts with a valid GOOGLE_CLIENT_ID matching Google Cloud OAuth credentials.
  - Frontend uses the same OAuth Client ID as backend.
  - Google Sign-In returns an **ID token** (not access token) to backend.
  - Backend successfully verifies the ID token signature and expiry.
  - Token audience (`aud` claim) matches the configured GOOGLE_CLIENT_ID.
  - A new patient account is created correctly when signing in with Google for the first time.
  - An existing patient account links correctly to Google OAuth without losing local auth methods.
  - Invalid tokens are rejected with 401 "Invalid Google token".
  - Expired tokens are rejected with 401 "Invalid Google token".
  - Malformed tokens are rejected with 401 "Invalid Google token".
  - Tokens with mismatched audience are rejected with 401 "Invalid Google token".
  - Unverified email on Google account is rejected with 403 "Google email not verified".
  - Audit log records successful Google sign-ins (action: GOOGLE_LOGIN).
  - Audit log records failed Google sign-in attempts with error details.

## P1 Verified Backlog

- Notification reliability and delivery
- Reporting completeness and audit dashboards
- UI/UX consistency for role-specific workspaces
- Mobile responsiveness for critical workflows

## P2 Verified Backlog

- Documentation alignment and handover artifacts
- Developer experience improvements
- Code cleanup only where it removes verified risk
- Performance optimization after verified bottlenecks are identified

## Regression Checklist

Before release, verified modules must pass:

- [ ] API tests pass
- [ ] Frontend workflow passes
- [ ] RBAC verified
- [ ] Audit verified
- [ ] Offline verified
- [ ] Notifications verified
- [ ] Dashboard metrics verified

## Release Blockers

### P0 – Release blockers

- Security vulnerabilities
- Cross-tenant isolation failures
- Data integrity issues
- Billing inaccuracies
- Missing audit coverage

### P1 – Pre-launch improvements

- UX refinements
- Performance tuning
- Documentation
- Additional automated tests

### P2 – Post-launch enhancements

- Nice-to-have features
- Refactoring
- Optimizations

## Document relationship

- `PHASE_A_VERIFIED_BACKLOG.md` is the detailed engineering verification backlog.
- `PRODUCTION_READINESS_MATRIX.md` is the executive readiness dashboard.

## Next Milestone

Move from source-level audit into end-to-end workflow verification:

1. Hospital onboarding
2. Staff onboarding + role assignment
3. Patient registration
4. Appointment scheduling
5. Consultation + EMR updates
6. Lab order + result flow
7. Pharmacy prescription + dispensing
8. Billing, insurance, payment
9. Discharge + reporting

## Operational Rule

No new feature or bug enters the backlog without evidence. Every future backlog item must reference the observed gap, the module, expected behavior, priority, and acceptance criteria.
