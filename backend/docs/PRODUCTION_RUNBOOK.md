# AfyaLink Production Runbook (24x7)

## 1. Core Requirements
- Run at least 2 backend nodes behind a load balancer.
- Use sticky sessions for Socket.IO/WebSocket traffic.
- Use MongoDB replica set (or managed cluster) with backups enabled.
- Put Redis (or Upstash Redis) in production for queues/cache/realtime coordination.

## 2. Health and Readiness
- Liveness: `GET /healthz`
- Readiness: `GET /readyz`
- Root: `GET /`

Use LB health checks on `/readyz` with failure threshold and automatic instance drain.

## 2.1 Pre-Production Gate (Must Pass)
Run this exact sequence before every production rollout:

1. `npm run preprod:preflight`
2. Start backend: `npm run dev` (or `npm run start:prod` in a production-like shell)
3. In a second shell: `npm run security:gate`
4. `npm run test`

Notes:
- `preprod:preflight` enforces required production env and DB reachability.
- `security:gate` requires backend to be reachable at `http://localhost:5000`.
- Twilio/Flutterwave warnings are non-blocking unless those channels are part of go-live scope.

## 3. Process Management
- Recommended: PM2/systemd/container orchestration.
- Included PM2 config: `backend/ecosystem.config.cjs`
- Start example:
  - `pm2 start ecosystem.config.cjs --env production`

## 4. Zero-Downtime Deploy
1. Deploy new version to standby instances.
2. Verify `/readyz` and smoke API calls.
3. Shift traffic gradually.
4. Drain old instances.
5. Monitor error rates and latency for 15 minutes.

## 5. Critical Monitoring
- API 5xx rate
- Request latency p95/p99
- DB connection state
- Queue backlog (jobs waiting/failed)
- Auth failure spikes
- Memory/CPU per instance

## 6. Incident Safety
- Graceful shutdown is enabled for `SIGTERM`/`SIGINT`.
- Unhandled exceptions/rejections are logged.
- Keep rolling restart policy at infrastructure level.

## 7. Data Protection
- Daily backups + point-in-time recovery.
- Offsite backup retention.
- Audit logs retained per compliance policy.

## 8. Hospital Migration Cutover Playbook
Use this for hospitals moving from an existing HIS/EMR/LIS/PACS into AfyaLink without downtime.

### 8.1 Pre-Cutover Checklist
- Create a migration project in `Migration Hub` (`/system-admin/migrations`).
- Register and test source connector (`/api/migrations/:id/test-connector`).
- Confirm data mapping coverage for demographics, appointments, encounters, labs, billing.
- Validate consent and transfer policy for cross-hospital exchange.
- Freeze schema changes in source and target 24h before cutover.

### 8.2 Dry Run
- Start dry run (`/api/migrations/:id/dry-run`).
- Compare source vs AfyaLink counts:
  - total records
  - required fields completeness
  - duplicate collision count
- Resolve mapping/data quality errors.

### 8.3 Parallel Run
- Keep legacy system active.
- Enable dual-write and incremental sync.
- Run AfyaLink in shadow mode for clinical/admin verification.
- Track divergence metric: source rows vs Afya rows over time.

### 8.4 Cutover Window
- Announce cutover window to hospital operations.
- Stop non-essential writes for a short controlled window.
- Run final delta sync.
- Switch operational traffic to AfyaLink.
- Keep rollback plan available until acceptance sign-off.

### 8.5 Post-Cutover Validation
- Validate appointment creation, lab flow, pharmacy flow, billing, notifications.
- Validate communication channels (doctor↔lab, lab↔pharmacy, nurse↔doctor, security↔reception).
- Export legal evidence bundle (`/api/audit/evidence-bundle`) and archive with cutover report.
- Monitor p95 latency, 5xx, queue backlogs, and auth failures for 48h.

### 8.6 Rollback Criteria
- Trigger rollback only if:
  - data integrity breach
  - sustained critical workflow failure
  - unacceptable patient-safety risk
- Execute rollback using last stable source snapshot + documented replay plan.

## 9. NeuroEdge Gateway Rollout

### 9.1 Pre-Enable
- Set NeuroEdge env vars (see `backend/docs/NEUROEDGE_ENV_TEMPLATE.md`).
- Run `npm run neuroedge:sync-indexes` once per environment rollout.
- Verify `/api/ai/gateway/health` returns `ok: true` for admin users.
- Confirm ABAC policies exist for `domain=AI`, `resource=neuroedge_gateway`.

### 9.1.1 Render Deployment Env Checklist
Set these in the Render dashboard for the backend service, then redeploy:

```env
NEUROEDGE_API_BASE=https://api.neuroedge.dev
NEUROEDGE_API_KEY=replace_in_render_dashboard
NEUROEDGE_CHAT_MODEL=
NEUROEDGE_TIMEOUT_MS=30000
NEUROEDGE_RETRIES=2
NEUROEDGE_RETRY_BACKOFF_MS=300
NEUROEDGE_CIRCUIT_THRESHOLD=5
NEUROEDGE_CIRCUIT_COOLDOWN_MS=15000
```

Notes:
- Keep the real API key only in Render secret storage. Do not commit it to the repo.
- The current AfyaLink pilot integration actively uses upstream `POST /v1/chat/completions`, `POST /v1/chat/stream`, `POST /v1/feedback`, and `GET /health`.
- Upstream `PILOT /v1/documents/*` and `PILOT /v1/creator/*` can be enabled in later passes without changing the base URL.
- After setting env vars, verify:
  - backend `GET /api/ai/gateway/health`
  - one authenticated assistant/chat request
  - one authenticated assistant streaming request
  - one assistant feedback submission
  - audit log creation for the AI call

### 9.2 Safe Rollout Order
1. Enable for `SUPER_ADMIN`, `SYSTEM_ADMIN`, `DEVELOPER` only.
2. Validate extraction, transform, risk, and simulation paths.
3. Review audit logs + AI gateway metrics (latency, failure, guardrail denies).
4. Expand to hospital roles gradually.

### 9.3 Rollback
- Remove/empty `NEUROEDGE_API_BASE` and recycle app processes.
- Existing non-gateway AI endpoints remain available according to current providers/config.
- Keep investigation evidence from `AuditLog` and `AIGatewayJob`.

### 9.4 Degradation Incident Playbook
- Symptoms:
  - repeated `NEUROEDGE_TIMEOUT`
  - `NEUROEDGE_CIRCUIT_OPEN`
  - elevated gateway 5xx
- Actions:
  1. Freeze high-risk AI actions (transforms/simulation) for non-platform roles.
  2. Route critical workflows to manual mode + human review.
  3. Capture evidence: correlation id, endpoint, actor, hospital, request hash.
  4. Restore service and run controlled replay for failed async jobs.
