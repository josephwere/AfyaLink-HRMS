# Verification Sprint

This folder contains evidence-based verification notes for AfyaLink roles and platform checks.

## Purpose

- Capture pass/fail observations for each role.
- Record navigation, dashboard, table, form, and work center issues.
- Document any missing UI routes, permissions gaps, and data issues.
- Keep verification evidence tied to actual application behavior, not just code existence.

## Structure

- `SUPER_ADMIN.md`
- `FOUNDER.md`
- `CFO.md`
- `FINANCE_MANAGER.md`
- `ACCOUNTANT.md`
- `CASHIER.md`
- `SYSTEM_VERIFICATION.md`
- `VERIFICATION_MATRIX.md`

Each file should follow the template in `verification-template.md`.

## Verification sprint stages

### Stage 1 – Platform validation

- Login / logout
- Refresh token
- Hospital selection
- Role switching
- Navigation
- Notifications
- Global search
- Theme/layout
- Browser console (no unexpected errors)
- Backend logs (no unexpected exceptions)

Only move on once Stage 1 passes.

### Stage 2 – Finance workflow verification

Verify complete business journeys rather than isolated pages.

#### Cashier

- Open shift
- Create invoice
- Receive payment
- Receipt generated
- Invoice updated
- Close shift
- Submit shift
- Finance Manager receives approval

#### Finance Manager

- Work center
- Pending shift
- Review
- Approve
- Notification sent
- Audit entry created
- Dashboard updated

#### CFO

- Executive dashboard
- Revenue KPIs
- Cash flow
- Financial reports
- Approval queue
- Notifications

### Stage 3 – Evidence collection

For every verification item record:

- Pass / Fail
- Screenshot
- Console errors
- API response
- Database effect
- Notes

### Stage 4 – Issue triage

Every failed verification should become a tracked issue with:

- Severity (Critical / High / Medium / Low)
- Module
- Steps to reproduce
- Expected behavior
- Actual behavior
- Status (Open / Fixed / Verified)

This prevents bugs from being forgotten while new work continues.

## Master Matrix

Use `VERIFICATION_MATRIX.md` as the sprint dashboard for UI, API, and workflow verification status across finance and founder roles.
