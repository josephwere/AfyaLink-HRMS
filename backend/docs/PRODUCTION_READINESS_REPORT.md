# AfyaLink Production Readiness Report

## Scope

This report covers configuration, readiness, worker observability, notification reliability, PPB verification, authorization, privacy, payment safety, ledger integrity, disaster recovery, and the medicine safety drill.

## Required deployment configuration

Production must provide values through the deployment secret manager, never source control:

- `MONGO_URI`
- `JWT_SECRET` and `JWT_ACCESS_SECRET` with at least 32 random characters
- `CLAIM_SECRET_KEY`
- `FRONTEND_URL` and explicit `CORS_ORIGIN`
- `REDIS_URL`, or the complete `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- `PPB_REGISTRY_URL` and `PPB_API_KEY` together when live PPB verification is required
- notification provider credentials for every enabled delivery channel
- payment, object-storage, and AI provider credentials for enabled deployment modes

When PPB variables are absent, evidence remains explicitly `INTERNAL_REGISTRY`. A partial PPB configuration fails validation.

## Operational checks

- Liveness: `GET /healthz`
- Readiness: `GET /readyz`
- Preflight: `npm run preprod:preflight`
- Security gate: `npm run security:gate`
- Backend tests: `npm test`
- Frontend build: `cd frontend && npm run build`

Readiness checks Mongo reachability, required Redis configuration, PPB configuration pairing, and background-worker health. Responses are sanitized and do not include credentials or connection strings.

## Recovery requirements

The deployment owner must provide and periodically test:

- MongoDB replica-set or managed-cluster backups with point-in-time recovery. Target RPO: 15 minutes; target RTO: 60 minutes.
- Redis persistence or a documented rebuild strategy. Background jobs in Mongo are authoritative; queued Bull work must be replayable.
- Compliance ledger and regulatory evidence included in Mongo backups and protected from deletion.
- Object-storage versioning and encrypted offsite replication for evidence files. Target RPO: 24 hours unless the deployment contract requires lower.
- A tested restore runbook with access control, audit trail, and post-restore ledger verification.

These are deployment prerequisites, not claims that backups are active in the local workspace.

## Known limitations

- Actual PPB availability, credentials, rate limits, and response SLA depend on the deployed regulator integration.
- Notification provider delivery depends on configured provider credentials and downstream availability.
- Worker heartbeat reflects application worker activity; orchestration-level process health must still be monitored by the deployment platform.
- Payment provider callback reconciliation requires the provider-specific webhook contract and signing secret for each enabled provider.

## Validation evidence

Fresh validation from this hardening pass:

- Focused configuration, PPB, safety drill, intelligence, and ledger tests: passed, exit code `0`.
- Full focused pharmacy/regulatory safety set: passed, exit code `0`.
- Backend production-readiness module loading: passed, exit code `0`.
- Touched-file diagnostics: no errors.
- Frontend production build: passed, exit code `0`.
- Full backend Jest run: started but was interrupted before a clean completion; not accepted as a readiness gate.
- Frontend Vitest focused government-claims path: passed, 2 tests, exit code `0`, after stabilizing the hook's default filter dependencies. The full frontend Vitest suite was previously observed hanging in this path and needs a fresh complete run before acceptance.
- Live staging smoke, provider connectivity, Redis reachability, and deployment topology checks were not run from this local workspace.

Record clean exit codes and deployment URLs from staging in the release change record before production rollout.
