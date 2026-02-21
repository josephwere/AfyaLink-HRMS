# Production Runbook: Export Abuse Monitoring Thresholds

Last updated: 2026-02-21

## Scope
- CSV exports
- PDF exports
- FHIR/HL7 transfer exports

## Data Source
- `AuditLog` actions:
  - `EXPORT_UNVERIFIED_USERS_CSV`
  - `EXPORT_TRANSACTIONS_CSV`
  - `EXPORT_INVOICE_PDF`
  - `EXPORT_MEDICAL_REPORT_PDF`
  - `TRANSFER_FHIR_EXPORTED`
  - `TRANSFER_HL7_EXPORTED`
  - `MEDICAL_LEGAL_REPORT_EXPORTED`

## Alert Thresholds

## Per user (rolling 15 minutes)
- `>= 10` CSV exports: `HIGH`
- `>= 20` PDF exports: `HIGH`
- `>= 10` FHIR/HL7 exports: `CRITICAL`

## Per hospital (rolling 1 hour)
- `>= 100` CSV exports: `HIGH`
- `>= 300` PDF exports: `HIGH`
- `>= 80` FHIR/HL7 exports: `CRITICAL`

## Payload magnitude thresholds
- Any single CSV export with `rowCount > 2000`: `HIGH`
- `>= 3` CSV exports with `rowCount > 1500` by same actor in 30 minutes: `CRITICAL`

## Enforcement Actions
1. `HIGH`:
   - Notify security/admin channel
   - Mark actor session as elevated risk
   - Require step-up auth on next sensitive export
2. `CRITICAL`:
   - Temporary block export endpoints for actor (15 minutes)
   - Open incident ticket automatically
   - Require manual admin unlock

## Recommended Dashboard Widgets
- Exports by actor (15m/1h/24h)
- Exports by hospital
- Large-row CSV exports
- Consent-blocked FHIR/HL7 export attempts
- Top endpoints by export volume

## Query Examples (Mongo)
```javascript
// Last hour high-volume CSV actors
db.auditlogs.aggregate([
  { $match: { action: "EXPORT_TRANSACTIONS_CSV", createdAt: { $gte: new Date(Date.now()-60*60*1000) } } },
  { $group: { _id: "$actorId", count: { $sum: 1 }, rows: { $sum: "$metadata.rowCount" } } },
  { $sort: { count: -1 } }
]);

// FHIR/HL7 export spikes by hospital
db.auditlogs.aggregate([
  { $match: { action: { $in: ["TRANSFER_FHIR_EXPORTED", "TRANSFER_HL7_EXPORTED"] }, createdAt: { $gte: new Date(Date.now()-60*60*1000) } } },
  { $group: { _id: "$hospital", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]);
```

## Review Cadence
- Daily: Security + platform team
- Weekly: threshold tuning based on false positives
- Monthly: policy review + incident postmortems
