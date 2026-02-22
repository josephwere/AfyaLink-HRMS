# Integration SLA and Migration Playbook

## Integration Reliability SLAs
- FHIR transform success: >= 99.5%.
- HL7 parse success: >= 99.0%.
- Connector webhook ingestion success: >= 99.5%.
- Retry recovery within 15 minutes for >= 95% transient failures.

## Operational Contracts
- Every connector has: owner, SLA, retries, DLQ policy, escalation path.
- Every payload has: correlation ID, source system ID, timestamp.

## Hospital Migration Playbook
### Stage 1: Discovery
- Source systems inventory
- Data mapping and quality baseline
- Critical workflow fit-gap

### Stage 2: Parallel run
- Shadow reads + non-disruptive writes
- Validation reports for patient, appointments, billing, lab

### Stage 3: Cutover
- Freeze window and rollback point
- Real-time reconciliation for 24-72h

### Stage 4: Stabilization
- Hypercare support
- Defect triage and connector tuning

## AI-assisted Migration
- Document extraction for legacy forms.
- Schema mapping suggestions with human approval.
- Anomaly detection on migrated records.
