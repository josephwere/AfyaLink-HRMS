# AfyaLink Machine Connectivity (Hospital Devices)

This module enables secure connectivity between hospital machines and AfyaLink.

## API Base

`/api/machine-connectivity`

## Admin Endpoints (JWT + role)

Allowed roles: `HOSPITAL_ADMIN`, `SYSTEM_ADMIN`, `SUPER_ADMIN`, `DEVELOPER`

1. `GET /devices`
- List machine devices in hospital scope.

2. `POST /devices`
- Register machine device.
- Returns one-time `machineKey` (store securely in machine gateway).

Body example:

```json
{
  "name": "Cobas 6000 Analyzer",
  "code": "LAB-COBAS-01",
  "department": "LAB",
  "machineType": "LAB_ANALYZER",
  "protocol": "HL7",
  "capabilities": {
    "ingestLabResults": true
  }
}
```

3. `PATCH /devices/:id`
- Update metadata, status, active flag, capabilities.

4. `POST /devices/:id/rotate-key`
- Rotates machine key and invalidates old key.

5. `GET /overview`
- Returns machine uptime and ingestion metrics for the current hospital.

6. `GET /audit`
- Returns machine audit events with paging/filter support.

7. `GET /alerts`
- Returns machine/integration alerts for operations triage.

8. `GET /alerts/:id/timeline`
- Returns merged timeline events for one alert.

9. `GET /alerts/:id/timeline.csv`
- Exports alert timeline as CSV.

10. `GET /alerts/:id/timeline.pdf`
- Exports alert timeline as PDF with hash + signature footer.

11. `GET /alerts/:id/evidence-manifest`
- Returns signed evidence manifest (hashes + signature + export links).

12. `PATCH /alerts/:id/ack`
- Marks a machine alert as acknowledged/read.
- Optional body: `{ "reason": "operator note" }`

13. `PATCH /alerts/ack-bulk`
- Bulk acknowledge machine alerts (explicit ids or severity filter).
- Optional body: `{ "reason": "operator note" }`

14. `GET /alerts/policy`
- Returns hospital-level machine alert auto-escalation policy.

15. `PUT /alerts/policy`
- Updates hospital-level machine alert auto-escalation policy.

16. `POST /alerts/:id/escalate`
- Escalates a machine alert to privileged responders and writes audit.
- Optional body: `{ "reason": "operator note" }`

17. `POST /test/hl7-parse`
- Parses an HL7 sample payload for validation/simulator testing.

18. `POST /test/dicom-stub`
- Tests DICOM metadata ingestion path via stub response.

## Auto-Escalation Tuning

- Hospital-level policy (via `/alerts/policy`) is primary.
- Policy fields:
  - `highAfterMinutes`
  - `mediumAfterMinutes`
  - `dedupCooldownMinutes`
  - `l1Roles`
  - `l2Roles`
  - `onCallPrimaryUserIds`
  - `onCallSecondaryUserIds`
  - `requireReasonForHighSeverityActions`
- Env fallback:
  - `MACHINE_ALERT_AUTO_ESCALATE_HIGH_MINUTES` (default `15`)
  - `MACHINE_ALERT_AUTO_ESCALATE_MEDIUM_MINUTES` (default `60`)
  - `MACHINE_ALERT_DEDUP_COOLDOWN_MINUTES` (default `10`)

Unread machine alerts auto-escalate after threshold windows.
If `requireReasonForHighSeverityActions=true`, a reason is required for high-severity ACK/Escalate actions.

## Machine Endpoints (Machine Key)

Auth header:
- `x-machine-key: <machineKey>`

Optional signed payload headers:
- `x-machine-ts: <epoch_ms>`
- `x-machine-signature: <hmac_sha256(machineKey, ts + "." + JSON.stringify(body))>`

1. `POST /heartbeat`
- Updates machine health/status and last seen timestamp.

2. `POST /lab-results`
- Ingest analyzer output into existing LabOrder.

Body example:

```json
{
  "labOrderId": "65f9...",
  "result": {
    "HB": 12.6,
    "WBC": 7.1
  },
  "resultStatus": "completed",
  "externalResultId": "COBAS-R-288771",
  "testName": "FBC",
  "patientId": "65ee..."
}
```

## Operational Notes

- The system updates only existing lab orders (no blind creation from machines).
- All machine actions are written to `Audit` with source IP.
- `LabOrder.metadata.machine` stores device provenance.
- Set machine to `MAINTENANCE` to keep ingestion blocked operationally.
