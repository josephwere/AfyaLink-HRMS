# AfyaLink Role Training Playbook

This playbook is for onboarding and refresher training by role.

## How to Train
- Start with the role's **Goal**.
- Walk through **First Hour** actions in the live UI.
- Reinforce **Daily Routine**.
- Emphasize **Safety Rules**.
- Track progress using **Key Metrics**.

## 7-Day Onboarding Template (Use For Every Role)
- Day 1: Orientation, role scope, login/profile/security setup, dashboard navigation.
- Day 2: Core workflow execution with supervision.
- Day 3: Safety, compliance, incident/escalation simulation.
- Day 4: Advanced tasks and edge-case handling.
- Day 5: Cross-team communication and handoff scenarios.
- Day 6: KPI review, quality checks, remediation planning.
- Day 7: Practical assessment, SOP sign-off, go-live readiness.

## SUPER_ADMIN
- Goal: Govern platform, uptime, compliance, and multi-hospital strategy.
- First Hour: Review global KPIs, incidents, audit logs, subscription/trial states.
- Daily Routine: Resolve critical escalations, review security/audit, verify backups.
- Safety Rules: Use least privilege, never bypass audit trail, rotate sensitive access.
- Key Metrics: Uptime, incident MTTR, compliance completion.

## SYSTEM_ADMIN
- Goal: Operate core technical systems and reliability.
- First Hour: Check API errors, queues, DLQ, connector health.
- Daily Routine: Retry failed jobs safely, monitor integrations, control feature flags.
- Safety Rules: Stage changes, keep rollback plans, log production actions.
- Key Metrics: Error rate, queue backlog, recovery time.

## HOSPITAL_ADMIN
- Goal: Run hospital branch operations end-to-end.
- First Hour: Review staffing/approvals/alerts, machine status, patient flow.
- Daily Routine: Manage approvals, monitor departments, unblock bottlenecks.
- Safety Rules: Delegate least privilege, enforce reason on high-risk actions.
- Key Metrics: Approval SLA, staffing coverage, queue delays.

## DEVELOPER
- Goal: Deliver reliable features and fast issue resolution.
- First Hour: Open logs, replay tools, feature flags, active incidents.
- Daily Routine: Fix critical regressions first, verify button->API parity, publish notes.
- Safety Rules: No production shortcuts around auth/audit.
- Key Metrics: Regression rate, deployment success, fix lead time.

## DOCTOR
- Goal: Safe, complete clinical care and documentation.
- First Hour: Check schedule, critical patients, pending labs/prescriptions.
- Daily Routine: Complete consultation notes, orders, referrals, follow-ups.
- Safety Rules: Verify identity before orders, sign only validated actions.
- Key Metrics: Consult completion, turnaround, documentation quality.

## NURSE
- Goal: Reliable bedside care and escalation.
- First Hour: Check assignments, meds due, critical alerts.
- Daily Routine: Record vitals/meds, escalate abnormal findings, handover notes.
- Safety Rules: Medication checks with patient ID, full exception documentation.
- Key Metrics: Med timeliness, vitals completion, incident response time.

## LAB_TECH
- Goal: Accurate diagnostics with QC compliance.
- First Hour: Prioritize test queue, check equipment/QC/safety.
- Daily Routine: Process tests, upload results, flag abnormalities.
- Safety Rules: No release without QC and validation.
- Key Metrics: Turnaround time, QC pass rate, abnormal escalation speed.

## PHARMACIST
- Goal: Safe dispensing and inventory integrity.
- First Hour: Open queue, check low stock/expiry/controlled logs.
- Daily Routine: Dispense and reconcile inventory movements.
- Safety Rules: Verify script before dispense, strict controlled-drug tracking.
- Key Metrics: Dispense turnaround, stockout rate, expiry losses.

## RADIOLOGIST
- Goal: Timely, accurate imaging interpretation.
- First Hour: Triage imaging queue and critical cases.
- Daily Routine: Publish signed reports, escalate critical findings.
- Safety Rules: Correct patient-study matching, no unsigned release.
- Key Metrics: Report turnaround, critical acknowledgment time.

## THERAPIST
- Goal: Structured therapy progress and continuity.
- First Hour: Review sessions and high-risk follow-ups.
- Daily Routine: Document outcomes, update treatment plans, track no-shows.
- Safety Rules: Escalate risks, keep notes complete and confidential.
- Key Metrics: Session completion, progress adherence.

## RECEPTIONIST
- Goal: Fast and accurate front-desk flow.
- First Hour: Open check-ins, queue board, pending bookings.
- Daily Routine: Register patients, route queues, coordinate with billing/security.
- Safety Rules: Identity validation before record actions.
- Key Metrics: Check-in time, queue accuracy.

## SECURITY_OFFICER
- Goal: Secure access operations and incident response.
- First Hour: Start shift/zone checks, visitor scanner, active alerts.
- Daily Routine: Log entries/exits, submit incident records.
- Safety Rules: No bypass of access verification.
- Key Metrics: Access incident response time.

## SECURITY_ADMIN
- Goal: Security governance and investigation readiness.
- First Hour: Review access anomalies and incident backlog.
- Daily Routine: Approve clearance, audit devices, enforce emergency protocols.
- Safety Rules: Preserve evidence chain and audit integrity.
- Key Metrics: Incident MTTR, unauthorized attempts.

## HR_MANAGER
- Goal: Staffing lifecycle and workforce performance.
- First Hour: Check open positions, pending leave, training expiries.
- Daily Routine: Advance recruitment pipeline, approvals, appraisals.
- Safety Rules: Policy-based approvals with reason tracking.
- Key Metrics: Time-to-hire, turnover, approval SLA.

## PAYROLL_OFFICER
- Goal: Accurate, auditable payroll processing.
- First Hour: Review overtime/shift deltas and exceptions.
- Daily Routine: Run payroll, reconcile variances, generate payslips.
- Safety Rules: Dual-check abnormal payouts, preserve audit trail.
- Key Metrics: Payroll accuracy, exception rate.

## COMMUNITY_HEALTH_WORKER
- Goal: Bridge hospital care with community field operations.
- First Hour: Review household plan, high-risk follow-ups, offline queue.
- Daily Routine: Record visits, referrals, surveillance reports, sync data.
- Safety Rules: Capture geo/time evidence and escalate emergencies quickly.
- Key Metrics: Visit completion, referral closure, sync success.

## PATIENT
- Goal: Manage appointments, records, labs, insurance, and payments.
- First Hour: Select hospital, book appointment, review profile completeness.
- Daily Routine: Track care updates and billing status.
- Safety Rules: Keep phone/email verified, enable 2FA.
- Key Metrics: Appointment completion, profile completeness.
