# SRE and Observability Operations

## SLOs
- API availability: 99.9% monthly.
- Auth/login p95: <= 600ms.
- Dashboard p95: <= 1200ms.
- Appointment create p95: <= 900ms.
- Queue replay success within 15 minutes for 99% of jobs.

## Error Budgets
- Availability error budget per month: 43m 49s.
- Burn-rate alerts:
  - Fast burn (1h window)
  - Slow burn (6h/24h windows)

## Monitoring Required
- Request rate, error rate, latency per endpoint.
- DB query latency and slow query count.
- Queue depth + retry count + DLQ count.
- Websocket connection health.
- Connector heartbeat and ingestion failures.

## Incident Management
### Severity
- Sev1: platform unavailable or patient safety impact.
- Sev2: critical feature degraded.
- Sev3: partial non-critical degradation.

### Process
1. Incident declared in <= 5 min.
2. Commander + comms owner assigned.
3. Mitigation first, root cause second.
4. Postmortem within 48h with actions and owners.

## On-call
- 24/7 rotation for backend + platform.
- Escalation chain: primary -> secondary -> leadership.
- Runbook links embedded in alerts.

## Incident Workflow APIs
- `POST /api/sre/incidents`: declare incident.
- `POST /api/sre/incidents/:id/ack`: acknowledge incident ownership.
- `POST /api/sre/incidents/:id/escalate`: escalate and assign comms owner.
- `POST /api/sre/incidents/:id/mitigate`: mark mitigation applied.
- `POST /api/sre/incidents/:id/resolve`: resolve incident.
- `GET /api/sre/incidents`: list incidents for operations handoff.

## Connector SLA Reliability APIs
- `GET /api/connectors/analytics/sla-summary`: connector SLA health by operation.
- `GET /api/connectors/:connectorId/sla-events`: recent connector SLA probes.
