# AfyaLink Dashboard Gap Analysis

## Current Role Coverage (Frontend Route + Dashboard)

Implemented dedicated dashboards:
- `SUPER_ADMIN` -> `/super-admin` (`frontend/src/pages/SuperAdmin/Dashboard.jsx`)
- `SYSTEM_ADMIN` -> `/system-admin` (`frontend/src/pages/SystemAdmin/Dashboard.jsx`)
- `HOSPITAL_ADMIN` -> `/hospital-admin` (`frontend/src/pages/HospitalAdmin/Dashboard.jsx`)
- `DEVELOPER` -> `/developer` (`frontend/src/pages/Developer/Dashboard.jsx`)
- `DOCTOR` -> `/doctor` (`frontend/src/pages/Doctor/Dashboard.jsx`)
- `SURGEON` -> `/surgeon` (`frontend/src/pages/Surgeon/Dashboard.jsx`)
- `NURSE` -> `/nurse` (`frontend/src/pages/Nurse/Dashboard.jsx`)
- `LAB_TECH` -> `/lab-tech` (`frontend/src/pages/LabTech/Dashboard.jsx`)
- `PHARMACIST` -> `/pharmacy` (`frontend/src/pages/Pharmacy/Index.jsx`)
- `SECURITY_OFFICER` -> `/security-officer` (`frontend/src/pages/Security/OfficerDashboard.jsx`)
- `SECURITY_ADMIN` -> `/security-admin` (`frontend/src/pages/Security/AdminDashboard.jsx`)
- `HR_MANAGER` -> `/hr-manager` (`frontend/src/pages/HRManager/Dashboard.jsx`)
- `PAYROLL_OFFICER` -> `/payroll-officer` (`frontend/src/pages/PayrollOfficer/Dashboard.jsx`)
- `COMMUNITY_HEALTH_WORKER` -> `/community-health-worker` (`frontend/src/pages/CommunityHealthWorker/Dashboard.jsx`)
- `PATIENT` -> `/patient` (`frontend/src/pages/Patient/Dashboard.jsx`)
- `GUEST` -> `/guest` (`frontend/src/pages/GuestDashboard.jsx`)
- `RADIOLOGIST` -> `/radiologist` (`frontend/src/pages/Radiologist/Dashboard.jsx`)
- `THERAPIST` -> `/therapist` (`frontend/src/pages/Therapist/Dashboard.jsx`)
- `RECEPTIONIST` -> `/receptionist` (`frontend/src/pages/Receptionist/Dashboard.jsx`)

Roles with optional shared fallback:
- `RADIOLOGIST` / `THERAPIST` / `RECEPTIONIST` can still use `/staff` shared dashboard.

## Specialty Hospital Dashboards Status

Implemented:
1. Emergency/Triage desk dashboard (`/ops/triage`)
2. ICU/Ward operations dashboard (`/ops/icu`)
3. Theatre/Operating room dashboard (`/ops/theatre`)
4. Imaging operations dashboard (`/ops/imaging`)
5. Emergency command dashboard (`/ops/emergency-command`)
6. Neonatal ICU dashboard (`/ops/neonatal-icu`)
7. Dialysis operations dashboard (`/ops/dialysis`)
8. Oncology day-care dashboard (`/ops/oncology-daycare`)

Remaining optional expansion dashboards:
- None in current phase.

## Backend Dashboard API Status

Implemented in `backend/routes/dashboardRoutes.js`:
- doctor, nurse, hr, payroll, staff, lab-tech, security-admin, security-officer, hospital-admin, patient, super-admin, community-health-worker, radiologist, therapist, receptionist, surgeon
- ops/triage, ops/icu, ops/theatre, ops/imaging, ops/emergency-command, ops/neonatal-icu, ops/dialysis, ops/oncology-daycare

## Recommended Next Build Order

1. Add real-time websocket tiles for all ops dashboards.
2. Add role-scoped drill-down pages per metric card.
3. Add benchmark/SLA trend charts for each ops dashboard.
4. Add alert rule builder per ops dashboard.

## Global Registry

For the full living backlog (similar-project baselines, known gaps, user needs, and future roadmap), see:

- `frontend/docs/dashboard-global-feature-registry.md`
