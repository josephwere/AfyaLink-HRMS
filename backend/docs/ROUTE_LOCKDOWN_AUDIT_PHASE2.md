## Route Lockdown Audit (Phase 2)

This batch finalized remaining legacy/mixed route auth usage and normalized role labels.

### Routes migrated from legacy `middleware/auth.js` to `authMiddleware.protect`

- `backend/routes/dlqRoutes.js`
- `backend/routes/dlqInspectRoutes.js`
- `backend/routes/dlqAdminRoutes.js`
- `backend/routes/connectorsRoutes.js`
- `backend/routes/offlineRoutes.js`
- `backend/routes/signalingTokenRoutes.js`
- `backend/routes/crdtApiRoutes.js`

### Role normalization fixes (canonical uppercase roles)

- `backend/routes/transferRoutes.js`
- `backend/routes/financialRoutes.js`
- `backend/routes/mlRoutes.js`
- `backend/routes/adminEmergencyRoutes.js`

### Middleware consistency fixes (`roleMiddleware.requireRole`)

- `backend/routes/superAdmin.js`
- `backend/routes/systemAdminRoutes.js`
- `backend/routes/developerRoutes.js`
- `backend/routes/hospitalAdmin.js`
- `backend/routes/workflowAdminRoutes.js`

### Additional authorization hardening

- Added explicit privileged role gate to workflow replay route:
  - `backend/routes/workflowReplayRoutes.js`
  - Allowed: `SUPER_ADMIN`, `SYSTEM_ADMIN`, `HOSPITAL_ADMIN`, `DEVELOPER`

### Regression automation update

- Extended endpoint coverage in:
  - `backend/scripts/authz-regression.mjs`
- New protected endpoint checks include:
  - `/api/workforce/sla/policies`
  - `/api/workforce/queue-insights`
  - `/api/developer/workflow-sla/run`
  - `/api/integrations/dlq*`
  - `/api/connectors`
  - `/api/offline/status`
  - `/api/signaling/token`
  - `/api/crdt-api/patients`

### Route-lockdown CI gate

- Added route/auth/export hardening audit script:
  - `backend/scripts/route-lockdown-audit.mjs`
- Added npm command:
  - `npm run audit:route-lockdown`
- Added GitHub Actions workflow:
  - `.github/workflows/backend-security-gate.yml`
- Gate checks:
  - non-public routes must be protected (`protect`/equivalent guard)
  - critical export endpoints must retain export audit logging
  - transfer FHIR/HL7 consent-scope enforcement must remain in place
