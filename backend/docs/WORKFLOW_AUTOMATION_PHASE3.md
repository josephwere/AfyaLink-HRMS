## Workflow Automation Phase 3

### Delivered
- Added two-level approval workflow metadata to leave/overtime/shift requests:
  - `approvalStage`
  - `stageOneApprovedBy`, `stageOneApprovedAt`
  - `stageTwoApprovedBy`, `stageTwoApprovedAt`
  - `fallbackRole`, `escalatedAt`, `escalationLevel`
- Extended automation policies with:
  - `requireSecondApprover`
  - `fallbackRole`
  - `escalationAfterMinutes`
- Added policy simulation endpoint:
  - `POST /api/workforce/automation/simulate`
- Added non-mutating escalation dry-run preview endpoint:
  - `GET /api/workforce/automation/preview`
  - includes priority-aware weighted forecast (older L2 requests contribute higher escalation pressure)
- Added escalation sweep endpoint:
  - `POST /api/workforce/automation/sweep`
- Added server-side queue-type filtered pending endpoint:
  - `GET /api/workforce/pending?kind=LEAVE|OVERTIME|SHIFT&status=PENDING&cursorMode=1`
- Added scheduled automation sweep worker:
  - `backend/workers/workforceAutomationSweep.js`
  - runs every 10 minutes from `backend/server.js`
- Added secondary-approver access paths for fallback-capable roles:
  - `HR_MANAGER`
  - `PAYROLL_OFFICER`
  - `SYSTEM_ADMIN`
  - `DEVELOPER`

### Behavior
- First approval can move request to `L2_PENDING` when policy requires second-level approval.
- Second-level approval requires a different approver than stage one.
- Escalation sweep notifies configured fallback role when L2 approval timeout is exceeded.
- Queue insights include `l2Pending` totals for triage visibility.

### Frontend
- Approvals page supports:
  - configuring second approver + fallback role + escalation timeout
  - simulation of policy decisions
  - escalation sweep trigger
  - visibility of `L2_PENDING` in queue and per-row stage
