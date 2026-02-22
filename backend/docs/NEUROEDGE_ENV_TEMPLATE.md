# NeuroEdge Environment Template

Use `backend/.env.example` as the baseline and set these values in production secret storage.

```env
# NeuroEdge core
NEUROEDGE_API_BASE=https://neuroedge.internal
NEUROEDGE_API_BASE_FAILOVER=https://neuroedge-backup-1.internal,https://neuroedge-backup-2.internal
NEUROEDGE_API_KEY=replace_with_secure_token
# Optional: if using bearer token instead of api key
# NEUROEDGE_BEARER_TOKEN=replace_with_secure_bearer

# Network + retry
NEUROEDGE_TIMEOUT_MS=30000
NEUROEDGE_RETRIES=2
NEUROEDGE_RETRY_BACKOFF_MS=300

# Circuit breaker
NEUROEDGE_CIRCUIT_THRESHOLD=5
NEUROEDGE_CIRCUIT_COOLDOWN_MS=15000
```

## Rollout Safety
- Keep `NEUROEDGE_API_BASE` unset in lower environments until gateway smoke tests pass.
- Enable access only for platform roles first (`SUPER_ADMIN`, `SYSTEM_ADMIN`, `DEVELOPER`), then widen.
- Run `npm run neuroedge:sync-indexes` before enabling traffic.
- Monitor `/api/ai/gateway/health` and audit logs before hospital-wide usage.
