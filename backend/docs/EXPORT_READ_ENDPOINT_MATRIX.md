# Export/Read Endpoint Matrix (Security Audit)

Last updated: 2026-02-21

## Covered Endpoint Types
- PDF
- CSV
- FHIR
- HL7
- JSON download-style exports / high-sensitivity reads

## Matrix

| Endpoint | Type | Auth | Role Gate | Tenant/Consent Scope | Status |
|---|---|---|---|---|---|
| `GET /api/reports/medical/:encounterId` | PDF | `protect` | `SUPER_ADMIN,SYSTEM_ADMIN,HOSPITAL_ADMIN,DOCTOR` | `encounterReadGuard` cross-hospital block | Locked |
| `GET /api/medical-legal/:encounterId/export` | JSON report export | `protect` | `SUPER_ADMIN,SYSTEM_ADMIN,HOSPITAL_ADMIN,DOCTOR` | `encounterReadGuard` + audit | Locked |
| `GET /api/transfers/:id/fhir` | FHIR | `protect` | `Doctor/HospitalAdmin/SystemAdmin/SuperAdmin/Developer` | `requireTransferConsent` + consent scopes | Locked |
| `GET /api/transfers/:id/hl7` | HL7 | `protect` | `Doctor/HospitalAdmin/SystemAdmin/SuperAdmin/Developer` | `requireTransferConsent` + consent scopes | Locked |
| `GET /api/transfers/:id/audit` | Audit read | `protect` | `HospitalAdmin/SystemAdmin/SuperAdmin/Developer` | `requireTransferConsent` | Locked |
| `GET /api/admin/export/unverified-users` | CSV | `protect` | `SUPER_ADMIN,HOSPITAL_ADMIN` | hospital scoping for hospital admin | Locked |
| `GET /api/transactions?exportCsv=1` | CSV | `protect` | `SUPER_ADMIN,SYSTEM_ADMIN,HOSPITAL_ADMIN,PAYROLL_OFFICER,DEVELOPER` | hospital scoped unless privileged override | Locked |
| `GET /api/billing/invoice/:id` | PDF | `protect` | billing route role gate | transaction `hospital` match in controller | Locked |
| `GET /api/external-read/incidents` | JSON read | `externalAccessGuard` | external scope token | hospital-bound + paginated | Locked |

## Key Notes
- Cross-hospital export surfaces now use middleware guards (`encounterReadGuard`, `requireTransferConsent`) before controller execution.
- Consent scope enforcement blocks FHIR/HL7 payload export when no allowed fields remain.
- CSV export of unverified users is no longer global for hospital admins.
- High-volume read exports are capped and paginated.
- CSV/PDF export endpoints in active routes now emit export audit events (`recordExportEvent` or explicit `AuditLog` entries).
- Heavy CSV exports are now range/row capped (`/api/transactions`, `/api/admin/export/unverified-users`).
- AuthZ regression script coverage expanded for additional read/export-adjacent surfaces:
  - `/api/workforce/overtime`
  - `/api/workforce/shifts`
  - `/api/transfers/:id/consent`

## Recommended Next Audit
- Add automated nightly check that fails CI if a new CSV/PDF endpoint is introduced without audit logging.
- Add per-role export quotas and step-up auth for repeated high-volume exports.
