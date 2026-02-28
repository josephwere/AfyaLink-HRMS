# On-Call Workflow

## Rotation Model
- Primary and secondary 24/7 rotation.
- Weekly handoff at fixed UTC time.
- Escalation path: primary -> secondary -> leadership.

## Minimum Inputs Per Shift
- Active dashboard link.
- Current open incidents from `/api/sre/incidents?status=OPEN`.
- Known risk advisories and deployment change log.

## Shift Checklist
1. Verify metrics endpoint and alert pipeline health.
2. Check open incidents and acknowledge ownership.
3. Validate critical routes health (`/healthz`, `/readyz`, `/api/auth/login`).
4. Confirm queue/DLQ status for integration reliability.

## Escalation Rules
- Page secondary after 5 minutes without ack.
- Escalate to leadership for `SEV1` immediately.
- Trigger comms owner for any user-facing degradation > 10 minutes.

## Shift Handoff
- Transfer open incidents with current status and next action.
- Attach unresolved risk notes and pending remediation links.
