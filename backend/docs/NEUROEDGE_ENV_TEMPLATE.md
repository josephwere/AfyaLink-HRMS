# NeuroEdge Environment Template

Use `backend/.env.example` as the baseline and set these values in production secret storage.

```env
# NeuroEdge core
NEUROEDGE_API_BASE=https://api.neuroedge.dev
NEUROEDGE_API_BASE_FAILOVER=
NEUROEDGE_API_KEY=replace_with_secure_token
# Optional: if using bearer token instead of api key
# NEUROEDGE_BEARER_TOKEN=replace_with_secure_bearer
# Optional: set only if NeuroEdge requires an explicit model for chat completions
NEUROEDGE_CHAT_MODEL=

# Network + retry
NEUROEDGE_TIMEOUT_MS=30000
NEUROEDGE_RETRIES=2
NEUROEDGE_RETRY_BACKOFF_MS=300

# Circuit breaker
NEUROEDGE_CIRCUIT_THRESHOLD=5
NEUROEDGE_CIRCUIT_COOLDOWN_MS=15000
```

## Rollout Safety
- For the current pilot integration, AfyaLink uses NeuroEdge `POST /v1/chat/completions` for assistant and text-first extraction workflows.
- NeuroEdge upstream health for this pilot is `GET /health`.
- `POST /v1/chat/stream` and `POST /v1/feedback` are available in the pilot contract but are not yet wired into AfyaLink runtime paths.
- `PILOT /v1/documents/*` and `PILOT /v1/creator/*` remain later-ready upstream APIs and are not yet integrated in AfyaLink.
- Keep `NEUROEDGE_API_BASE` unset in lower environments until gateway smoke tests pass.
- Enable access only for platform roles first (`SUPER_ADMIN`, `SYSTEM_ADMIN`, `DEVELOPER`), then widen.
- Run `npm run neuroedge:sync-indexes` before enabling traffic.
- Monitor `/api/ai/gateway/health` and audit logs before hospital-wide usage.
