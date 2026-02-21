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
