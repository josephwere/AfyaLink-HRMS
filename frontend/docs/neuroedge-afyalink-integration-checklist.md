# NeuroEdge x AfyaLink Integration Checklist

## 1. What to build in NeuroEdge (must-have)
- Auth: JWT verification + tenant/hospital scoping.
- ABAC/Consent decision endpoint (`/v1/guardrails/authorize`).
- Async jobs (`QUEUED/RUNNING/SUCCEEDED/FAILED`) with idempotency key support.
- Extraction (`/v1/extract`) for PDF/image docs with OCR + table extraction.
- Ingestion (`/v1/ingest/document`) with PHI redaction + indexing.
- FHIR/HL7 transform APIs with validation and signed provenance.
- Risk APIs: staffing forecast, burnout score, causal impact.
- Digital twin simulation endpoint.
- Retrieval API with citation-first answers.

## 2. AfyaLink backend adapter to implement
Create a single AI gateway in AfyaLink backend:
- `POST /api/ai/gateway/extract`
- `POST /api/ai/gateway/ingest`
- `POST /api/ai/gateway/search`
- `POST /api/ai/gateway/fhir-transform`
- `POST /api/ai/gateway/hl7-transform`
- `POST /api/ai/gateway/risk/*`
- `POST /api/ai/gateway/simulate`
- `GET /api/ai/gateway/jobs/:jobId`

Rules in gateway:
- enforce `protect` + role/ABAC checks
- enforce consent scope masking for patient transfer/export surfaces
- persist audit event per AI action (`action`, `actor`, `resource`, `decision`, `jobId`)
- attach correlation id from request headers

## 3. Route mapping plan (current AfyaLink -> NeuroEdge)
- `/api/ai/extract` -> NeuroEdge `/v1/extract`
- `/api/triage/classify` -> NeuroEdge retrieval + classification profile
- `/api/ml/staffing/forecast` -> NeuroEdge `/v1/risk/staffing-forecast`
- `/api/ml/burnout/score` -> NeuroEdge `/v1/risk/burnout-score`
- `/api/ml/causal/impact` -> NeuroEdge `/v1/risk/causal-impact`
- `/api/ml/digital-twin/simulate` -> NeuroEdge `/v1/simulation/digital-twin`
- `/api/mapping/*` -> NeuroEdge interop transform endpoints

## 4. Security controls required before go-live
- Step-up auth required for high-risk AI actions (export, transfer, policy override).
- Strict prompt/data isolation by `tenantId` + `hospitalId`.
- Model output schema validation before writing to DB.
- Reject/flag low-confidence outputs for human review.
- Signed provenance attached to every transformation/export.

## 5. Observability SLOs
- P95 extraction latency < 8s (single-page docs).
- Job success rate >= 99.5%.
- Failed job retry success >= 95%.
- Guardrail decision latency P95 < 300ms.

## 6. Build order for your AI builder agent
1. Auth + Guardrails + Job framework
2. Extraction + Ingestion + provenance
3. FHIR/HL7 transforms + validation
4. Risk + simulation modules
5. Retrieval + NLP analytics
6. Optimization + cost controls + canary rollout

## 7. Definition of done
- End-to-end demo from AfyaLink upload -> NeuroEdge extract -> approved write-back.
- ABAC deny path tested with audit evidence.
- Transfer consent scope masking verified.
- Synthetic load test passes SLOs.
- Rollback path documented and tested.
