# Phase 6 Execution (Operational Continuity)

## Scope
- Executive readiness report automation
- Post-launch 30/60/90 review initialization
- Final full-program gate

## Commands

1. Generate executive readiness report:
```bash
npm --prefix backend run exec:readiness:report
```

2. Initialize post-launch review cycle:
```bash
npm --prefix backend run postlaunch:review:init -- "Kenya Wave 1"
```

3. Run final phase gate:
```bash
npm --prefix backend run phase6:gate
```

## Artifacts
- `backend/artifacts/executive-reports/readiness-*.json`
- `backend/artifacts/postlaunch/<slug>/30-60-90-plan.json`

## Outcome
- `GO`: all program phase gates passed.
- `NO_GO`: at least one gate failed; follow reported blockers.
