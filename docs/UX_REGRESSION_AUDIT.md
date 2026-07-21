# UX Regression Audit

## Dashboard order
- Super Admin: Workspace Overview → Platform Health → Hospitals → Users → Analytics
- Hospital Admin: Workspace Overview → Departments → Beds → Rooms → Wards → Staff
- Pharmacy: Workspace Overview → Inventory → Prescriptions → Dispensing
- Patient: Appointments → Medical Records → Bills → Messages

## RBAC guardrails
- Infrastructure quick actions should only appear for roles with matching permissions.
- Dashboard cards must be gated through shared permission helpers rather than ad hoc role checks.

## AI context expectations
- The AI provider should receive route, workspace, hospital, patient, encounter, and department context on each page.

## Workflow expectations
- Save/Edit flows should remain compact and preserve the original state transitions.

## Current status
- Dashboard shell polish: in progress
- RBAC restoration: in progress
- AI context restoration: in progress
- Overflow/card polish: pending
- Save/Edit workflow restoration: pending
