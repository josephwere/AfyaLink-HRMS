# AfyaLink Verification & Governance Rules

## Core Principle
Every role must be tested using **its own account**.

Never use:

- `role_override`
- impersonation
- Workspace Role Switcher
except when specifically testing those features.

Authentication, authorization, routing, permissions, and workflows must always be verified using the actual user assigned to that role.

---

# Super Admin Responsibilities (Founder Level)
The Super Admin represents the **AfyaLink Founder / Platform Owner**.

The Super Admin is **not** a hospital administrator.

Its responsibilities are limited to platform governance.

## Super Admin can:

- Register hospitals.
- Register the **first Hospital Administrator** for each hospital.
- Register the **first Government Administrator** for government organizations.
- Register platform-level executives such as Founder, CEO, COO, CIO, CTO, and other Platform Executives.
- Register government users that belong to the national platform.
- Activate or deactivate hospitals.
- Suspend hospitals.
- Manage platform-wide settings.
- View platform analytics.
- Manage subscriptions and licensing.
- Perform platform governance.

## Super Admin must NOT create
The Super Admin must never create hospital operational users such as:

- Doctors
- Nurses
- Receptionists
- Cashiers
- Pharmacists
- Laboratory Technicians
- Radiologists
- HR Officers
- Finance Officers
- Accountants
- Payroll Officers
- Ward Staff
- Department Staff
- Branch Staff

Those users belong to individual hospitals.

---

# Hospital Administrator Responsibilities
Once a hospital has been created, the Hospital Administrator becomes responsible for that hospital.

The Hospital Administrator can:

- Create branches.
- Create departments.
- Create wards.
- Create beds.
- Create clinics.
- Create laboratories.
- Create pharmacies.
- Register all hospital staff.
- Assign departmental roles.
- Manage hospital permissions.
- Activate or deactivate hospital staff.
- Manage hospital configuration.

The Hospital Administrator owns everything inside the hospital.

---

# Department Managers
Department managers manage only their assigned departments.

Examples include:

- HR Manager
- Finance Manager
- Pharmacy Manager
- Laboratory Manager
- Radiology Manager

They manage users and workflows within their departments only.

---

# Verification Strategy

## Phase 1 — Super Admin (Platform Setup Only)
Use the seeded Super Admin account only for platform setup.

Tasks:

- Log in as `super@afya.demo`.
- Create any missing hospitals.
- Register the first Hospital Administrator for each hospital.
- Register the first Government Administrator where applicable.
- Register platform executives if required.
- Activate accounts.
- Record generated credentials in the verification document.

Once setup is complete:

**Stop using the Super Admin account** unless another role genuinely requires a platform-level administrative action.

---

# Phase 2 — Hospital Administrator
Log in as the Hospital Administrator.

The Hospital Administrator should:

- Create branches.
- Create departments.
- Create wards.
- Create beds.
- Create laboratories.
- Create pharmacies.
- Register all hospital staff.
- Assign permissions.
- Activate accounts.

Generate accounts for every hospital role that will be tested.

---

# Phase 3 — Role-by-Role Verification
For every created or seeded account:

1. Log out.
2. Log in using that user's own credentials.
3. Verify only that user's dashboard.
4. Execute that user's workflows.
5. Capture:

- Dashboard screenshot
- Console log
- Network requests
- PASS/FAIL
- Bugs discovered

Never substitute another role for convenience.

---

# Verification Order

## Platform

1. Founder
2. CEO / Chief Executive Officer
3. Super Admin

## Hospital Administration

1. Hospital Administrator

## Finance

1. CFO
2. Finance Manager
3. Accountant
4. Cashier
5. Payroll Officer

## Human Resources

1. HR Manager

## Clinical

1. Receptionist
2. Doctor
3. Nurse

## Diagnostics

1. Laboratory Technician
2. Radiologist

## Pharmacy

1. Pharmacist

## Insurance

1. Insurance Officer

## Compliance

1. System Auditor

## Patient

1. Patient

---

# Missing Role Rule
If a required role does not exist:

1. Log out.
2. Log in as the Hospital Administrator (or Super Admin if it is a platform-level role).
3. Create the missing account.
4. Log out.
5. Log in as the new user.
6. Continue verification.

Never replace one role with another simply to continue testing.

---

# Deliverables
Maintain a verification matrix such as:

Role | Login | Dashboard | Workflow | API | Console | Result
:---:|:---:|:---:|:---:|:---:|:---:|:---:
Founder | ✅ | ✅ | ✅ | ✅ | Clean | PASS
Hospital Administrator | ✅ | ✅ | ✅ | ✅ | Clean | PASS
CFO | ✅ | ✅ | ⚠ | ✅ | Hospital context | FAIL
Cashier | ✅ | ✅ | ✅ | ✅ | Clean | PASS

Create one report for every verified role:

- FOUNDER.md
- SUPER_ADMIN.md
- HOSPITAL_ADMIN.md
- CFO.md
- FINANCE_MANAGER.md
- ACCOUNTANT.md
- CASHIER.md
- PAYROLL_OFFICER.md
- HR_MANAGER.md
- DOCTOR.md
- NURSE.md
- LABORATORY_TECHNICIAN.md
- PHARMACIST.md
- RADIOLOGIST.md
- PATIENT.md
- INSURANCE_OFFICER.md
- SYSTEM_AUDITOR.md

Each report should include:

- Account used (username or email; omit passwords if preferred)
- Dashboard screenshots
- Workflow evidence
- Console logs
- Network/API evidence
- Bugs identified
- Recommended fixes
- Final PASS/FAIL decision

---

This governance model aligns with how a real multi-tenant hospital platform operates: the **Super Admin remains the platform owner**, while the **Hospital Administrator has full authority over hospital resources and staff**. It also results in more accurate end-to-end verification because every dashboard and workflow is exercised by the role that will actually use it in production.
