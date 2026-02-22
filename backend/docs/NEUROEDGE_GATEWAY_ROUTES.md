# NeuroEdge Gateway Routes

Base path: `/api/ai/gateway`

## Endpoints
- `POST /extract`
- `POST /ingest`
- `POST /search`
- `POST /fhir-transform`
- `POST /hl7-transform`
- `POST /risk/staffing-forecast`
- `POST /risk/burnout-score`
- `POST /risk/causal-impact`
- `POST /simulate/digital-twin`
- `GET /jobs/:jobId`
- `GET /health`

## Security
- Route stack is mounted through `/api/ai` and enforced by:
  - `protect`
  - `planGuard({ feature: "ai" })`
  - role-based checks in `aiGatewayRoutes`
  - ABAC checks (`domain=AI`, `resource=neuroedge_gateway`)
- Step-up auth is required on high-risk transform/simulation routes.
- Requests are tenant/hospital scoped and denied when scope mismatch is detected.

## Consent + Guardrails
- Every call performs NeuroEdge guardrail authorization (`/v1/guardrails/authorize`) before execution.
- FHIR/HL7 payloads are filtered by consent scopes.
- Sensitive fields are masked in responses when scope is insufficient.

## Async + Idempotency
- Heavy operations run async (`extract`, `ingest`, `simulate/digital-twin`) with `QUEUED/RUNNING/SUCCEEDED/FAILED` states.
- Supports `Idempotency-Key` header and body fallback.
- Idempotent results are persisted in `AIGatewayIdempotencyLedger` and cached in Redis (best effort).

## Audit + Provenance
- Every action writes audit evidence with correlation ID.
- Decisions are persisted in `AIGatewayDecision`.
- Inference provenance is persisted in `AIGatewayProvenance` and linked to `AIGatewayJob`.

## Required Environment Variables
- `NEUROEDGE_API_BASE`
- `NEUROEDGE_API_BASE_FAILOVER` (optional)
- `NEUROEDGE_API_KEY` or `NEUROEDGE_BEARER_TOKEN`
- `NEUROEDGE_TIMEOUT_MS`
- `NEUROEDGE_RETRIES`
- `NEUROEDGE_RETRY_BACKOFF_MS`
- `NEUROEDGE_CIRCUIT_THRESHOLD`
- `NEUROEDGE_CIRCUIT_COOLDOWN_MS`
