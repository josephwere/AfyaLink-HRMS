# Verification Matrix

This master matrix separates implementation status from actual verification status so the sprint dashboard shows what exists in code versus what has been proven end-to-end.

Use this file as the release readiness dashboard for the current verification sprint. Update the `Status` and `Notes` columns as you complete each role or module.

| Module | Implemented | UI Verified | API Verified | Workflow Verified | Roles | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| System Verification | ✅ | ✅ | ✅ | ✅ | All | Ready | Global counts and service health verified. |
| Founder Role View | ✅ | ✅ | ✅ | ✅ | Super Admin | Ready | Role-view switching and Founder workspace entry are implemented. |
| Cashier | ✅ | ⌛ | ⌛ | ⌛ | Cashier | Verifying | End-to-end payment, receipt, invoice, shift, approval workflow verification in progress. |
| Finance Work Center | ✅ | ⌛ | ✅ | ⌛ | CFO, Finance Manager | Verifying | UI navigation present; workflow completion pending. |
| Approval Engine | ✅ | ⚠️ | ✅ | ⌛ | Finance | Partial | Approval APIs exist; work-item handoff and UI behavior need validation. |
| Notifications | ✅ | ⚠️ | ✅ | ⚠️ | Finance | Needs UI | Notifications backend active; front-end display needs review. |
| Audit Trail | ✅ | ⌛ | ✅ | ⌛ | Finance | In Progress | Audit logging exists, but visibility and traceability need testing. |

## How to use this matrix

- Update `UI` when the role can access the expected pages and menus.
- Update `API` when the related backend endpoints return correct data and actions.
- Update `Workflow` when the end-to-end business flow completes successfully.
- Use `Status` values such as `Pass`, `Partial`, `In Progress`, `Needs UI`, or `Fail`.
- Add notes for discovered gaps, missing demo data, or blocked UI behavior.

## Recommended next steps

1. Verify each finance role through the Founder role switcher.
2. Record actual workflow observations in the individual role files.
3. Update this matrix with concrete statuses after each verification run.
4. Fix issues immediately when the workflow does not complete.

---

> This matrix is the single source of truth for verification readiness in the current sprint.
