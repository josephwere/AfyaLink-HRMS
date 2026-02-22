# AfyaLink Performance Harness

## Prerequisites
- Install `k6`: https://k6.io/docs/get-started/installation/
- Backend running locally or in target environment.

## Scenarios
- `k6/smoke.js`: quick endpoint sanity test.
- `k6/kenya-peak.js`: mixed peak-hour profile approximating nationwide daytime traffic.

## Run
```bash
BASE_URL=http://localhost:5000 k6 run backend/perf/k6/smoke.js
BASE_URL=http://localhost:5000 AUTH_TOKEN=<jwt> k6 run backend/perf/k6/kenya-peak.js
```

## Pass Criteria
- Error rate < 1% under baseline.
- p95 latency <= SLO targets for auth, dashboard, and appointment creation.
- No sustained queue growth after test completion.
