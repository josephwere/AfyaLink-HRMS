# Workflow Automation Phase 1

Last updated: 2026-02-21

## Implemented

- Added workforce automation policy model:
  - `backend/models/WorkflowAutomationPolicy.js`
- Added policy-aware request auto-approval for:
  - Leave requests
  - Overtime requests
  - Shift requests
- Added automation policy APIs:
  - `GET /api/workforce/automation/policies`
  - `PUT /api/workforce/automation/policies/:requestType`
- Added audit logging for auto-approved requests and policy updates.

## UI wiring

- Hospital Admin approvals page now includes:
  - Automation policy table
  - Per-request-type policy editing
  - Save actions

## Notes

- This phase focuses on deterministic policy-based automation.
- Next phase can add:
  - policy simulation mode
  - chained approvals and fallback routing
  - no-code workflow graph editor

