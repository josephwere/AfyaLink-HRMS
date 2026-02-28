# Incident Command Runbook

## Trigger Conditions
- Alertmanager critical page from `afyalink-slo-alerts`.
- Direct report of production outage from hospital operations.
- Data integrity or patient-safety risk signal.

## Response Targets
- Incident declared in under 5 minutes.
- Commander assigned in under 5 minutes.
- First mitigation action in under 15 minutes.

## Roles
- Commander: drives technical mitigation and decision flow.
- Comms owner: updates status page/internal channels every 15 minutes.
- Scribe: records event timeline.

## Workflow
1. Declare incident with `POST /api/sre/incidents`.
2. Acknowledge with `POST /api/sre/incidents/:id/ack`.
3. Escalate owner/context with `POST /api/sre/incidents/:id/escalate`.
4. Apply mitigation and mark `POST /api/sre/incidents/:id/mitigate`.
5. Resolve with `POST /api/sre/incidents/:id/resolve`.

## Severity Policy
- `SEV1`: platform outage, patient-safety risk, or data corruption risk.
- `SEV2`: major degraded functionality, broad hospital impact.
- `SEV3`: partial degradation or isolated module issue.
- `SEV4`: low-impact defect with workaround.

## Post-Incident
- Start postmortem draft within 24h.
- Final postmortem with owners and action items within 48h.
- Link remediation PRs and deployment evidence.
