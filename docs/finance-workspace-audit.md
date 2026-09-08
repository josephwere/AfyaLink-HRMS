# Finance Workspace Architecture Audit

## Summary

The current finance workspace has serious architecture gaps:

- Frontend finance navigation is static and built from `frontend/src/app/navigation/workspaces.js`.
- Finance sidebar items are not filtered by individual route permissions; if a user can access the finance workspace, they may see many finance items even if they cannot use them.
- The frontend finance pages rely on many `/api/finance/*` endpoints.
- The backend exposes only `/api/finance/shifts/*` and `/api/finance/work-center` in `backend/routes/financeRoutes.js`.
- Many finance UI service calls target endpoints that do not currently exist in the backend, making the finance workspace unworkable.

## Current Finance Frontend Routes and Guards

| Frontend route | Page component | Allowed frontend roles | Notes |
|---|---|---|---|
| `/app/finance/home/index` | `FinanceHome` | HOSPITAL_ADMIN, HOSPITAL_ADMIN_ASSISTANT, RECEPTIONIST, PAYROLL_OFFICER, SUPER_ADMIN, SYSTEM_ADMIN, DEVELOPER | Finance workspace landing page |
| `/app/finance/executive/index` | `FinanceExecutiveDashboard` | CFO, FINANCE_MANAGER, HOSPITAL_ADMIN, SUPER_ADMIN, SYSTEM_ADMIN, DEVELOPER | CFO/Executive workspace |
| `/app/finance/billing/index` | `FinanceBilling` | HOSPITAL_ADMIN, HOSPITAL_ADMIN_ASSISTANT, RECEPTIONIST, PAYROLL_OFFICER, SUPER_ADMIN, SYSTEM_ADMIN, DEVELOPER | Billing workspace |
| `/app/finance/cashier/index` | `FinanceCashier` | RECEPTIONIST, PAYROLL_OFFICER, HOSPITAL_ADMIN, HOSPITAL_ADMIN_ASSISTANT, SUPER_ADMIN, SYSTEM_ADMIN, DEVELOPER | Cashier workspace |
| `/app/finance/payments/index` | `FinancePayments` | HOSPITAL_ADMIN, HOSPITAL_ADMIN_ASSISTANT, RECEPTIONIST, PAYROLL_OFFICER, SUPER_ADMIN, SYSTEM_ADMIN, DEVELOPER | Payments workspace |
| `/app/finance/receipts/index` | `FinanceReceipts` | HOSPITAL_ADMIN, HOSPITAL_ADMIN_ASSISTANT, RECEPTIONIST, PAYROLL_OFFICER, SUPER_ADMIN, SYSTEM_ADMIN, DEVELOPER | Receipts workspace |
| `/app/finance/refunds/index` | `FinanceRefunds` | HOSPITAL_ADMIN, HOSPITAL_ADMIN_ASSISTANT, RECEPTIONIST, PAYROLL_OFFICER, SUPER_ADMIN, SYSTEM_ADMIN, DEVELOPER | Refunds workspace |
| `/app/finance/insurance-claims/index` | `FinanceInsuranceClaims` | HOSPITAL_ADMIN, HOSPITAL_ADMIN_ASSISTANT, RECEPTIONIST, PAYROLL_OFFICER, SUPER_ADMIN, SYSTEM_ADMIN, DEVELOPER | Insurance claims workspace |
| `/app/finance/accounting/index` | `FinanceAccountingDashboard` | ACCOUNTANT, FINANCE_MANAGER, HOSPITAL_ADMIN, SUPER_ADMIN, SYSTEM_ADMIN, DEVELOPER | Accountant workspace |
| `/app/finance/general-ledger/index` | `FinanceGeneralLedger` | ACCOUNTANT, FINANCE_MANAGER, HOSPITAL_ADMIN, SUPER_ADMIN, SYSTEM_ADMIN, DEVELOPER | General ledger |
| `/app/finance/journal-entries/index` | `FinanceJournalEntries` | ACCOUNTANT, FINANCE_MANAGER, HOSPITAL_ADMIN, SUPER_ADMIN, SYSTEM_ADMIN, DEVELOPER | Journal entries |
| `/app/finance/chart-of-accounts/index` | `FinanceChartOfAccounts` | ACCOUNTANT, FINANCE_MANAGER, HOSPITAL_ADMIN, SUPER_ADMIN, SYSTEM_ADMIN, DEVELOPER | Chart of accounts |
| `/app/finance/periods/index` | `FinancePeriods` | ACCOUNTANT, FINANCE_MANAGER, HOSPITAL_ADMIN, SUPER_ADMIN, SYSTEM_ADMIN, DEVELOPER | Accounting periods |
| `/app/finance/reports/index` | `FinanceReports` | HOSPITAL_ADMIN, PAYROLL_OFFICER, FINANCE_MANAGER, CFO, SUPER_ADMIN, SYSTEM_ADMIN, DEVELOPER | Reporting |
| `/app/finance/trial-balance/index` | `FinanceTrialBalance` | ACCOUNTANT, FINANCE_MANAGER, CFO, HOSPITAL_ADMIN, SUPER_ADMIN, SYSTEM_ADMIN, DEVELOPER | Trial balance |
| `/app/finance/profit-and-loss/index` | `FinanceProfitAndLoss` | ACCOUNTANT, FINANCE_MANAGER, CFO, HOSPITAL_ADMIN, SUPER_ADMIN, SYSTEM_ADMIN, DEVELOPER | P&amp;L |
| `/app/finance/balance-sheet/index` | `FinanceBalanceSheet` | ACCOUNTANT, FINANCE_MANAGER, CFO, HOSPITAL_ADMIN, SUPER_ADMIN, SYSTEM_ADMIN, DEVELOPER | Balance sheet |
| `/app/finance/cash-flow/index` | `FinanceCashFlow` | ACCOUNTANT, FINANCE_MANAGER, CFO, HOSPITAL_ADMIN, SUPER_ADMIN, SYSTEM_ADMIN, DEVELOPER | Cash flow |
| `/app/finance/financial-intelligence/index` | `FinanceFinancialIntelligence` | ACCOUNTANT, FINANCE_MANAGER, CFO, HOSPITAL_ADMIN, SUPER_ADMIN, SYSTEM_ADMIN, DEVELOPER | Intelligence |
| `/app/finance/reconciliation/index` | `FinanceReconciliation` | ACCOUNTANT, FINANCE_MANAGER, HOSPITAL_ADMIN, SUPER_ADMIN, SYSTEM_ADMIN, DEVELOPER | Reconciliation |
| `/app/finance/audit/index` | `FinanceAudit` | GOVERNMENT_AUDITOR, ACCOUNTANT, FINANCE_MANAGER, CFO, HOSPITAL_ADMIN, SUPER_ADMIN, SYSTEM_ADMIN, DEVELOPER | Audit |
| `/app/finance/approvals/index` | `FinanceApprovals` | ACCOUNTANT, FINANCE_MANAGER, CFO, HOSPITAL_ADMIN, SUPER_ADMIN, SYSTEM_ADMIN, DEVELOPER | Approvals |
| `/app/finance/work-center` | `FinanceWorkCenter` | ACCOUNTANT, FINANCE_MANAGER, CFO, HOSPITAL_ADMIN, SUPER_ADMIN, SYSTEM_ADMIN, DEVELOPER | Work center |
| `/app/finance/consolidation/index` | `FinanceConsolidation` | FINANCE_MANAGER, CFO, HOSPITAL_ADMIN, SUPER_ADMIN, SYSTEM_ADMIN, DEVELOPER | Consolidation |
| `/app/finance/settings/index` | `FinanceSettings` | HOSPITAL_ADMIN, FINANCE_MANAGER, CFO, SUPER_ADMIN, SYSTEM_ADMIN, DEVELOPER | Finance settings |
| `/app/finance/approval-policies/index` | `FinanceApprovalPolicies` | SUPER_ADMIN, FINANCE_MANAGER, CFO | Approval policies |

## Backend Finance-Related Endpoint Coverage

| Backend route prefix | Route file | Exposed endpoints | Allowed roles | Coverage |
|---|---|---|---|---|
| `/api/finance` | `backend/routes/financeRoutes.js` | `GET /shifts/current`, `GET /shifts`, `GET /shifts/:id`, `POST /shifts`, `POST /shifts/:id/close`, `POST /shifts/:id/approve`, `POST /shifts/:id/reject`, `POST /shifts/:id/reopen`, `GET /work-center` | Cashier roles + finance approvers | Only shift workflows + work center |
| `/api/billing` | `backend/routes/billingRoutes.js` | `GET /`, `GET /list`, `GET /invoice/:id`, `GET /:id` | SUPER_ADMIN, SYSTEM_ADMIN, HOSPITAL_ADMIN, PAYROLL_OFFICER, DEVELOPER, PATIENT | Billing/list endpoints exist but general finance UI does not currently point here |
| `/api/financials` | `backend/routes/financialRoutes.js` | `POST /`, `POST /invoice`, `GET /intelligence`, `GET /hospital-intelligence`, `POST /usage-ledger`, `GET /`, `POST /:id/pay`, `POST /:id/claim`, `GET /reconcile` | HOSPITAL_ADMIN, SUPER_ADMIN, SYSTEM_ADMIN, DEVELOPER, PATIENT, DOCTOR | Some financial operations exist, but they are on a different prefix than `frontend/services/finance` expects |
| `/api/payments` | `backend/routes/paymentRoutes.js` | `POST /mpesa/stk`, `POST /mpesa/callback`, `POST /stripe/create-intent`, `POST /flutter/init`, `POST /route`, `POST /flutter/webhook`, etc. | authenticated users | Payment provider routes exist, but not finance payments business workflows |

## Missing Backend Routes for Current Finance UI

The frontend finance services call these endpoints, but they are currently not implemented under `/api/finance`:

- `/api/finance/invoices`
- `/api/finance/invoices/:id`
- `/api/finance/invoices/:id/void`
- `/api/finance/payments`
- `/api/finance/payments/:id`
- `/api/finance/receipts`
- `/api/finance/receipts/:id`
- `/api/finance/refunds`
- `/api/finance/chart-of-accounts`
- `/api/finance/chart-of-accounts/:id`
- `/api/finance/general-ledger`
- `/api/finance/journals`
- `/api/finance/periods`
- `/api/finance/periods/:id`
- `/api/finance/reconciliation`
- `/api/finance/reconciliation/:id`
- `/api/finance/reports`
- `/api/finance/reports/:id`

## Key Mismatches

- `FinanceCashier` is wired to `/api/finance/invoices`, `/api/finance/payments`, and `/api/finance/receipts`, but backend only supports shifts and work center on `/api/finance`.
- Some finance pages appear to be placeholders with no actual data logic (`FinanceExecutiveDashboard`, `FinanceAccountingDashboard`, etc.).
- Sidebar visibility is based on workspace access via `WORKSPACES_BY_ROLE`, not on individual route permission membership.
- The frontend `requireRole` guard is a direct mirror of backend role membership, but it cannot protect missing endpoint mappings or runtime service endpoint mismatches.

## Immediate Next Steps

1. Create a definitive role × sidebar item × frontend route × backend endpoint × permission matrix.
2. Triage current finance pages by role:
   - CFO: executive, cash position, budgets, approvals, reports, audit visibility
   - Finance Manager: billing, payments, expenses, budgets, approvals, reconciliation, reports
   - Accountant: ledger, journals, invoices, payments, expenses, AR/AP, reconciliation, reports
   - Cashier: cashier shift, current shift, patient payments, receipts, invoices, refunds, transaction history
3. Align finance UI service calls with actual backend routes or implement missing backend endpoints.
4. Make finance sidebar generation role-aware so only valid items are shown.
5. Verify that every visible sidebar entry resolves to a frontend route and a backend endpoint that the role can access.

## Recommendation

Do not implement placeholder UI pages first. Instead, use this audit as the canonical map and then build role-specific workflows in this order:

1. Cashier
2. Accountant
3. Finance Manager
4. CFO

This will ensure the finance workspace is grounded in real authorization, real data, and real backend workflows.
