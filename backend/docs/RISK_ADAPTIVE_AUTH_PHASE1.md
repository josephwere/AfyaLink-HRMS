# Risk-Adaptive Auth Phase 1

Last updated: 2026-02-21

## Implemented

- Session risk scoring integrated into login token claims:
  - `riskLevel`
  - `riskScore`
- Step-up verification timestamp support in access tokens:
  - `stepUpVerifiedAt`
- New risk/step-up auth endpoints:
  - `GET /api/auth/session-risk`
  - `POST /api/auth/step-up/request`
  - `POST /api/auth/step-up/verify`
- Sensitive-route step-up enforcement:
  - `POST /api/payment-settings/save`
  - `POST /api/payment-settings/reveal/verify`
  - `POST /api/payment-settings/rotate-password`
  - `POST /api/workflows/admin/override`
  - `POST /api/admin/workflows/override`
  - `POST /api/break-glass/activate`
  - `POST /api/break-glass/deactivate`

## Security behavior

- Step-up validity window is route-specific (10-20 minutes currently).
- If missing/expired step-up:
  - response: `403`
  - code: `STEP_UP_REQUIRED`
- Step-up completion sets `stepup:last:<userId>` in Redis for bounded time and returns a refreshed access token with `stepUpVerifiedAt`.

## Notes

- This phase does not yet include impossible-travel geolocation checks or adaptive policy tuning by role/hospital.
- Next phase should add:
  - risk policy config in admin UI
  - per-action adaptive thresholds
  - anomaly-triggered temporary session restrictions
