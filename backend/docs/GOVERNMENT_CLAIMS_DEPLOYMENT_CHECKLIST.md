# Government Claims Dashboard — Production Deployment Checklist

This checklist hardens the `/system-admin/government-claims` experience and the `/api/government/*` backend for production. It is designed for SHA / national health fund readiness and global multi-fund deployments.

## 1. Core Service Readiness

- Backend service running with `NODE_ENV=production`.
- Frontend build deployed with the government dashboard routes enabled.
- CORS allowlist includes the production frontend host.
- Redis/queue (if used) is reachable for async ingestion and alerts.

## 2. Required Environment Variables (Backend)

Set these before production startup:

- Core:
  - `MONGO_URI`
  - `JWT_SECRET`
  - `JWT_ACCESS_SECRET`
  - `FRONTEND_URL`
- Government/SHA adapters:
  - `SHA_PREAUTH_URL`
  - `SHA_TOKEN_URL` (or `SHA_API_TOKEN`)
  - `SHA_CLIENT_ID` / `SHA_CLIENT_SECRET` (if using token URL)
  - `SHA_AUDIENCE` (optional)
  - `SHA_TIMEOUT_MS` (optional)
- eTIMS adapters:
  - `ETIMS_INVOICE_URL`
  - `ETIMS_TOKEN_URL` (or `ETIMS_API_KEY` / `ETIMS_API_TOKEN`)
  - `ETIMS_CLIENT_ID` / `ETIMS_CLIENT_SECRET` (if using token URL)
  - `ETIMS_TIMEOUT_MS` (optional)
- M-PESA runtime:
  - `MPESA_CONSUMER_KEY`
  - `MPESA_CONSUMER_SECRET`
  - `MPESA_SHORTCODE`
  - `MPESA_PASSKEY`
  - `MPESA_CALLBACK_URL`

## 3. Data & Access Controls

- Government roles provisioned:
  - `GOVERNMENT_ADMIN`, `GOVERNMENT_REGULATOR`, `GOVERNMENT_AUDITOR`, `GOVERNMENT_INSPECTOR`, `GOVERNMENT_ANALYST`.
- Hospitals and patients are linked to country/region for accurate filtering.
- Claims include:
  - `riskScore`, `provider.code`, `currency`, `country`, `signature` fields.
- Audit logs are enabled and `AUDIT_LOG_IMMUTABLE=1` in production.

## 4. Fraud Guard & Compliance Rules

- Claim rules loaded (frequency, age/gender, duplicate prevention).
- Patient identity registry populated (national IDs, biometrics where allowed).
- Government hospital registry populated (verified hospitals only).
- Hospital licenses and inspections seeded for regulatory workflows.

## 5. Integration Control Plane (System Admin)

- Validate Integration Control Plane:
  - SHA credentials show as configured.
  - eTIMS credentials show as configured.
  - M-PESA runtime env configured.
- For each partner, confirm connector exists and is in SHADOW or CUTOVER as appropriate.

## 6. Smoke Tests for `/system-admin/government-claims`

Run from backend:

```bash
BASE_URL=https://your-backend-host
GOV_DASHBOARD_TOKEN=<admin_or_government_role_token>
node scripts/government-claims-smoke.mjs
```

Expected:
- `overview`, `claims`, `hospitals`, `inspections`, `enforcement`, `health-funds`, `notifications`, `audit-logs` all return 200.
- No missing credentials in Integration Control Plane.
- Government dashboard renders without React errors.

## 7. Operational Readiness

- Error tracking enabled (Sentry or equivalent).
- Daily backup jobs for claims, audit logs, and fraud alerts.
- Monthly inspection & license review schedule configured.
- Incident runbooks updated for claims fraud spikes.

## 8. Rollback Plan

- Keep previous release artifact for instant rollback.
- Feature flag the government dashboard if needed.
- Use `/api/system-settings` to disable claims submission if external provider outage occurs.

