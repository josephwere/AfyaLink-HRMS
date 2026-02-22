# Legal-Execution-Only Readiness

Use this gate to verify that technical implementation is complete and only legal/regulatory execution remains.

## Run

```bash
npm --prefix backend run readiness:legal-only
```

## Gate Requirements
- Phase 6 gate passes.
- Frontend production build passes.
- Backend production preflight passes.
- Critical production env vars are set:
  - `MONGO_URI`
  - `JWT_SECRET`
  - `JWT_ACCESS_SECRET`
  - `FRONTEND_URL`
  - `METRICS_TOKEN`
  - `FLW_SECRET_KEY`
  - `FLW_WEBHOOK_SECRET`
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`

## If Gate Passes
Technical work is complete for rollout execution.
Remaining work is legal and institutional:
- Government licenses/approvals
- Country legal interpretation and compliance sign-off
- Signed hospital/government agreements
