# Phase 3 Execution (Pilot Cutover + Hypercare)

## Scope
- Staging failover automation and evidence capture.
- Pilot cutover artifact workflow.
- Hypercare KPI snapshot automation.

## Commands

1. Initialize pilot hospital package:
```bash
npm --prefix backend run pilot:onboarding:init -- "Hospital Name"
```

2. Start cutover workflow:
```bash
npm --prefix backend run pilot:cutover:run -- "Hospital Name"
```

3. Capture hypercare KPIs (default 24h):
```bash
npm --prefix backend run hypercare:kpi:snapshot
```

4. Run staging failover drill + evidence:
```bash
npm --prefix backend run staging:failover:run
```

5. Full phase gate:
```bash
npm --prefix backend run phase3:gate
```

6. Consolidated operations gate (before/with phase 3):
```bash
npm --prefix backend run ops:full:gate
```

## Artifacts
- `backend/artifacts/pilot-onboarding/<hospital-slug>/`
- `backend/artifacts/hypercare/snapshot-*.json`
- `backend/artifacts/failover-drill/<timestamp>/`

## Notes
- `phase3:gate` assumes reachable DB and backend endpoint for readiness/security tests.
- `phase3:gate` now enforces `perf:capacity:gate`; ensure k6 summary exists first:
  - `npm --prefix backend run perf:k6:kenya-peak`
- Keep `MONGO_URI`, `FRONTEND_URL`, and `METRICS_TOKEN` correctly configured.
