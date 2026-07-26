# AfyaLink Role Training Playbook

This playbook is a complete onboarding and refresher guide for the full AfyaLink system. It is designed to help every user, manager, administrator, clinician, staff member, and patient understand the platform end to end, not just their own narrow task. The goal is to make training comprehensive, operationally useful, and aligned to real dashboards, workflows, and responsibilities.

## How to Train
- Start with the role's **Goal**.
- Walk through **First Hour** actions in the live UI.
- Reinforce **Daily Routine**.
- Emphasize **Safety Rules** and **Compliance Expectations**.
- Review the **System Areas** that affect the role's dashboard.
- Track progress using **Key Metrics** and evidence of completed tasks.

## 7-Day Onboarding Template (Use For Every Role)
- Day 1: Orientation, role scope, login/profile/security setup, dashboard navigation, and overview of the platform.
- Day 2: Core workflow execution with supervision in appointments, records, or operational queues.
- Day 3: Safety, compliance, escalation, documentation, and incident handling.
- Day 4: Advanced tasks, edge cases, handoffs, and system integrations.
- Day 5: Cross-team communication, approvals, billing, notifications, uploads, and reporting.
- Day 6: KPI review, quality checks, remediation planning, and audit awareness.
- Day 7: Practical assessment, SOP sign-off, go-live readiness, and role-specific mastery review.

## Platform Overview
- AfyaLink is a hospital management and HRMS platform that combines clinical operations, administration, workforce management, billing, communications, and compliance in one system.
- Every role should understand the core flow of information: user access -> dashboard -> workflow -> documentation -> notifications -> audit trail -> reporting.
- Training should always connect the role to the wider system so users understand how their work affects patients, staff, operations, finance, and governance.
- The platform includes patient registration, appointments, clinical notes, orders, pharmacy, laboratory, radiology, billing, notifications, document uploads, maps, analytics, and access governance.

## Core System Areas
- Appointments: schedule, reschedule, confirm, check-in, queue management, and follow-up.
- Clinical Care: encounter records, consultations, notes, prescriptions, referrals, and care coordination.
- Pharmacy: prescriptions, stock control, dispensing, expiry monitoring, and controlled-drug tracking.
- Laboratory: test ordering, sample handling, result entry, QC, abnormal flags, and report publication.
- Billing & Payments: invoices, insurance, payments, refunds, claims, reimbursement tracking, and financial reconciliation.
- Notifications: alerts, reminders, task assignments, approvals, message routing, and escalation.
- Uploads & Documents: verification documents, medical files, identity documents, certificates, and audit evidence.
- Maps & Location Services: hospital selection, site routing, community operations, and location-based workflow support.
- Accessibility & Responsiveness: usable layouts across devices, keyboard support, readable content, and accessible navigation.
- Reporting & Analytics: dashboards, KPIs, compliance indicators, workforce insights, and operational reporting.

## Training Pathway
- Phase 1: Know the system. Learn the platform overview, navigation, user roles, permissions, dashboards, and common workflows.
- Phase 2: Perform the role. Complete the daily tasks, documents, approvals, and operations relevant to the role.
- Phase 3: Protect the system. Understand safety, privacy, compliance, audit, escalation, and data quality expectations.
- Phase 4: Scale the impact. Learn how the role interacts with other departments, patients, partners, and administrators.

## Role-Based Mastery Map
- Every role should know which system areas are mandatory, optional, or critical for their work.
- Admins must understand governance, routing, approvals, user access, system health, and business continuity.
- Clinicians must understand patient safety, documentation quality, orders, referrals, and continuity of care.
- Operational teams must understand queues, staffing, handoffs, billing, and escalation workflows.
- Patients must understand self-service, appointments, profile data, documents, payments, and communication.

## Roles and Responsibilities

## SUPER_ADMIN
- Goal: Govern the full platform, uptime, compliance, multi-hospital strategy, and enterprise readiness.
- First Hour: Review global KPIs, audit history, incidents, user access, subscription state, and platform stability.
- Daily Routine: Resolve escalations, review security/audit, verify backups, approve major changes, and maintain continuity.
- Safety Rules: Use least privilege, never bypass audit trail, rotate sensitive access, and preserve evidence.
- Key Metrics: Uptime, incident MTTR, compliance completion, policy adherence.
- System Coverage: Must understand recruitment/HR, communications, access governance, finance, clinical workflows, integrations, and operational reporting.

## SYSTEM_ADMIN
- Goal: Operate core technical systems, reliability, integrations, queues, and environment health.
- First Hour: Check API errors, queues, DLQ, connector health, deployment status, and feature flags.
- Daily Routine: Retry failed jobs safely, monitor integrations, control feature flags, and diagnose workflow failures.
- Safety Rules: Stage changes, keep rollback plans, log production actions, and verify downstream impact.
- Key Metrics: Error rate, queue backlog, recovery time, deployment success.
- System Coverage: Must understand authentication, notifications, uploads, workflow engines, middleware, API integrations, and service health.

## HOSPITAL_ADMIN
- Goal: Run hospital branch operations end to end while protecting patient care and staff productivity.
- First Hour: Review staffing, approvals, alerts, queue performance, machine status, and patient flow.
- Daily Routine: Manage approvals, monitor departments, unblock bottlenecks, and coordinate cross-functional service operations.
- Safety Rules: Delegate least privilege, enforce reason on high-risk actions, and ensure records are complete.
- Key Metrics: Approval SLA, staffing coverage, queue delays, patient throughput.
- System Coverage: Must understand appointments, doctors, nurses, billing, pharmacy, lab, admissions, notifications, document verification, and reports.

## DEVELOPER
- Goal: Deliver reliable features, fast issue resolution, and maintainable platform behavior.
- First Hour: Open logs, replay tools, feature flags, active incidents, and recent regressions.
- Daily Routine: Fix critical regressions first, verify button-to-API parity, update tests, and publish implementation notes.
- Safety Rules: No production shortcuts around auth, audit, or data handling; protect system integrity.
- Key Metrics: Regression rate, deployment success, fix lead time, test coverage.
- System Coverage: Must understand routes, components, hooks, RBAC rules, API contracts, testing strategy, build health, and release readiness.

## DOCTOR
- Goal: Provide safe, complete, and documented clinical care.
- First Hour: Check schedule, critical patients, pending labs, pending prescriptions, urgent messages, and upcoming encounters.
- Daily Routine: Complete consultation notes, orders, referrals, follow-ups, and discharge planning.
- Safety Rules: Verify identity before orders, sign only validated actions, document decisions clearly, and escalate urgent findings.
- Key Metrics: Consult completion, turnaround, documentation quality, follow-up adherence.
- System Coverage: Must understand appointments, encounters, clinical notes, prescriptions, labs, referrals, notifications, and reporting.

## NURSE
- Goal: Deliver reliable bedside care, monitor patient status, and escalate risk appropriately.
- First Hour: Check assignments, meds due, critical alerts, vitals pending, and handover notes.
- Daily Routine: Record vitals and medications, escalate abnormal findings, support care plans, and update handover records.
- Safety Rules: Medication checks with patient ID, complete exception documentation, and maintain confidentiality.
- Key Metrics: Med timeliness, vitals completion, incident response time, care documentation completeness.
- System Coverage: Must understand patient flow, care tasks, medication processing, communications, alerts, and task handoffs.

## LAB_TECH
- Goal: Deliver accurate diagnostics and maintain quality control compliance.
- First Hour: Prioritize test queue, check equipment, QC status, safety requirements, and pending specimen handling.
- Daily Routine: Process tests, upload results, flag abnormalities, reconcile sample status, and communicate urgent findings.
- Safety Rules: No release without QC and validation; use secure handling and complete documentation.
- Key Metrics: Turnaround time, QC pass rate, abnormal escalation speed, sample traceability.
- System Coverage: Must understand laboratory workflow, result entry, attachments, QC checks, and reporting integration.

## PHARMACIST
- Goal: Protect patient safety through accurate dispensing, inventory control, and compliance.
- First Hour: Open queue, check low stock, expiry dates, controlled logs, and pending prescriptions.
- Daily Routine: Dispense safely, reconcile inventory movements, resolve discrepancies, and document issues.
- Safety Rules: Verify scripts before dispense, apply controlled-drug controls, and maintain audit-ready records.
- Key Metrics: Dispense turnaround, stockout rate, expiry losses, inventory accuracy.
- System Coverage: Must understand prescriptions, dispensing, stock movement, alerts, billing linkage, and inventory reporting.

## RADIOLOGIST
- Goal: Provide timely imaging interpretation and clear clinical communication.
- First Hour: Triage imaging queue, review urgent cases, and verify patient-study accuracy.
- Daily Routine: Publish signed reports, escalate critical findings, and update clinical record status.
- Safety Rules: Correct patient-study matching, no unsigned release, and complete documentation.
- Key Metrics: Report turnaround, critical acknowledgment time, report quality.
- System Coverage: Must understand imaging workflows, report sign-off, attachments, integration with clinical records, and escalation.

## THERAPIST
- Goal: Support structured therapy progress and continuity of care.
- First Hour: Review sessions, high-risk follow-ups, treatment plans, and current schedule.
- Daily Routine: Document outcomes, update treatment plans, track no-shows, and coordinate with care teams.
- Safety Rules: Escalate risks, keep notes complete, preserve confidentiality, and document progress accurately.
- Key Metrics: Session completion, progress adherence, follow-up success.
- System Coverage: Must understand treatment plans, scheduling, documentation, referrals, and care coordination.

## RECEPTIONIST
- Goal: Keep front-desk flow accurate, fast, and patient-centered.
- First Hour: Open check-ins, queue board, pending bookings, verification documents, and patient arrival status.
- Daily Routine: Register patients, route queues, coordinate with billing/security, and update encounter readiness.
- Safety Rules: Validate identity before record actions, verify sensitive information, and protect privacy.
- Key Metrics: Check-in time, queue accuracy, registration completeness.
- System Coverage: Must understand appointments, registration, patient identity, billing handoffs, documents, and notifications.

## SECURITY_OFFICER
- Goal: Secure access operations and support incident response.
- First Hour: Start shift/zone checks, review visitor scanner activity, and inspect active alerts.
- Daily Routine: Log entries/exits, submit incident records, and support emergency response readiness.
- Safety Rules: No bypass of access verification; preserve evidence and report anomalies immediately.
- Key Metrics: Access incident response time, incident closure rate, audit readiness.
- System Coverage: Must understand access events, incident records, visitor management, and investigative workflows.

## SECURITY_ADMIN
- Goal: Govern security posture and maintain investigation readiness.
- First Hour: Review access anomalies, incident backlog, device records, and privileged access activity.
- Daily Routine: Approve clearance, audit devices, enforce emergency protocols, and support investigations.
- Safety Rules: Preserve evidence chain, audit integrity, and maintain least-privilege access.
- Key Metrics: Incident MTTR, unauthorized attempts, audit compliance.
- System Coverage: Must understand access governance, security policies, incident response, logging, and administrative controls.

## HR_MANAGER
- Goal: Manage the workforce lifecycle and enable productive, compliant staffing.
- First Hour: Check open positions, pending leave, training expiry, and workforce activity.
- Daily Routine: Advance recruitment, approvals, appraisals, and onboarding tasks while coordinating with management.
- Safety Rules: Policy-based approvals with reason tracking and protected personnel records.
- Key Metrics: Time-to-hire, turnover, approval SLA, onboarding completion.
- System Coverage: Must understand staff records, permissions, training tracker, HR workflows, notifications, and compliance reporting.

## PAYROLL_OFFICER
- Goal: Process accurate, auditable payroll and compensation adjustments.
- First Hour: Review overtime and shift deltas, payment exceptions, and pending pay runs.
- Daily Routine: Run payroll, reconcile variances, support payslips, and resolve exceptions.
- Safety Rules: Dual-check abnormal payouts, preserve audit trail, and maintain confidentiality.
- Key Metrics: Payroll accuracy, exception rate, reconciliation speed.
- System Coverage: Must understand payroll workflow, shifts, HR data, approvals, reports, and financial controls.

## COMMUNITY_HEALTH_WORKER
- Goal: Bridge hospital care with community field operations and outreach programs.
- First Hour: Review household plan, high-risk follow-ups, offline queue, and field priorities.
- Daily Routine: Record visits, referrals, surveillance reports, and sync data from the field.
- Safety Rules: Capture geo/time evidence, escalate emergencies quickly, and maintain record completeness.
- Key Metrics: Visit completion, referral closure, sync success, response time.
- System Coverage: Must understand field workflows, location services, referrals, documentation, and community reporting.

## PATIENT
- Goal: Manage appointments, records, labs, insurance, and payments while staying informed about care.
- First Hour: Select hospital, book appointment, review profile completeness, and confirm contact details.
- Daily Routine: Track care updates, review bills, monitor lab or prescription progress, and communicate changes.
- Safety Rules: Keep phone/email verified, enable 2FA, protect sensitive information, and use only official channels.
- Key Metrics: Appointment completion, profile completeness, follow-through, payment status.
- System Coverage: Must understand self-service registration, appointments, records, documents, billing, notifications, and data privacy.
