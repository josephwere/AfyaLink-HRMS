# AfyaLink Dashboard Global Feature Registry (Living Document)

This is the execution registry for **all dashboards**.  
It is intentionally structured as a living backlog, because an "infinite/all features" list is not physically finishable in one build.

## 1) Core Dashboards Covered

- Super Admin
- System Admin
- Hospital Admin
- Hospital Admin Assistant
- Developer
- Doctor
- Surgeon
- Nurse
- Lab Tech
- Pharmacist
- Radiologist
- Therapist
- Receptionist
- Security Officer
- Security Admin
- HR Manager
- Payroll Officer
- Community Health Worker
- Patient
- Guest
- Operations: Triage, ICU, Theatre, Imaging

## 2) What Similar Projects Usually Do

- Role-based KPIs and daily queue dashboards
- Scheduling + appointment board
- Staff roster and shift management
- Patient profile and encounter timeline
- Clinical notes, diagnostics, prescriptions
- Billing/claims and payment status
- Export and compliance audit logs
- Basic referral workflows

## 3) Common Gaps in Similar Projects

- Weak inter-hospital handover continuity
- Missing consent-aware data-sharing controls
- Poor transfer provenance/signature evidence
- Fragmented nurse/doctor workflows across many pages
- Low mobile usability for heavy forms
- Weak emergency/offline workflows
- Weak hospital-to-pharmacy referral loops

## 4) What Dashboard Users Consistently Want

- Fewer clicks for top 3 daily tasks
- One-page shift summary and pending actions
- Fast patient search + quick resume from last point
- Clear alerts with action buttons
- Reliable handover package during transfers
- Readable dark mode and mobile-first layouts
- Action outcome feedback (success/failure/next step)

## 5) AfyaLink Priority Build Matrix (Now -> Next)

### P0 (critical continuity and safety)
- Transfer handover package completeness gating
- Consent-scoped transfer exports (FHIR/HL7)
- One-click doctor/nurse quick flow (A -> B -> C)
- Unauthorized route guard fixes by role
- Dark mode readability baseline pass

### P1 (operational quality)
- Ward bed board + acuity panel
- Doctor queue prioritization with triage score
- Nurse medication round planner + late-dose alerts
- Pharmacy nearest-available and stock-aware referrals
- Readmission risk + follow-up due panel

### P2 (scale and intelligence)
- Predictive staffing tile in each role dashboard
- SLA panels (lab TAT, imaging TAT, transfer latency)
- Cross-hospital continuity score
- AI page summarization + personal assistant context
- Regional routing and nearest-facility matching

### P3 (future differentiation)
- Digital twin operations simulation per hospital
- Real-time command center for multi-facility groups
- Workflow auto-remediation agents
- Financial efficiency cockpit (cost per patient pathway)
- Role coaching and adaptive onboarding assistant

## 6) Current Strict Rule for "Done"

A dashboard feature is "done" only if:
- action is visible,
- action executes,
- result is persisted,
- result is auditable,
- role/consent guard passes,
- mobile + dark mode are readable,
- errors are actionable.

## 7) Notes

- This registry should be reviewed every sprint.
- Add new entries instead of replacing old history to preserve roadmap traceability.

