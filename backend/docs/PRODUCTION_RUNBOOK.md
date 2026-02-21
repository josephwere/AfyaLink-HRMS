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

