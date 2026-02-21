# Risk-Adaptive Auth Phase 2

Last updated: 2026-02-21

## Implemented

- Added DB-backed adaptive risk policy:
  - `backend/models/RiskPolicy.js`
  - `backend/utils/riskPolicy.js`
- Added system-admin policy APIs:
  - `GET /api/system-admin/risk-policy`
  - `PUT /api/system-admin/risk-policy`
- Added impossible-travel signal to risk scoring:
  - country change within configured short window increases risk score
- Added CRITICAL risk restriction flow:
  - login can place temporary restriction (`risk:restricted:<userId>`) in Redis
  - protected API requests are blocked while restricted, except step-up and logout routes
- Added session security metadata on user profile:
  - last login timestamp/ip/country
  - last risk level/score
  - restricted-until marker

## Endpoint behavior

- `GET /api/auth/session-risk` now returns:
  - current risk level/score/reasons
  - active step-up state
  - active restriction payload if present
  - active policy snapshot (thresholds + windows)

## Operational effect

- Sensitive routes continue requiring recent step-up.
- Critical-login anomalies now trigger temporary policy lock automatically until successful step-up or expiry.

