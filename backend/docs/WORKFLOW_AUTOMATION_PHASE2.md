# Workflow Automation Phase 2

Last updated: 2026-02-21

## Implemented

- Added chained approval support on workforce requests:
  - `approvalStage` state (`L1_PENDING` -> `L2_PENDING` -> final)
  - stage-one and stage-two approver tracking fields
- Added fallback escalation routing:
  - policy-configured fallback role
  - escalation sweep endpoint for overdue L2 approvals
- Added automation simulation endpoint:
  - policy decision dry-run without mutating request records

## New endpoints

- `POST /api/workforce/automation/simulate`
- `POST /api/workforce/automation/sweep`

## Policy extensions

- `requireSecondApprover`
- `fallbackRole`
- `escalationAfterMinutes`

## UI updates

- Hospital Admin approvals page now supports:
  - editing chained approval/fallback config
  - running simulation
  - triggering escalation sweep

