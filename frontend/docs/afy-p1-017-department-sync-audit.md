# AFY-P1-017 Department Synchronization Audit

Date: 2026-07-08
Scope: department metadata in the backend, frontend profile handling, and whether department context is used for navigation or access decisions.

## Executive summary

Department data is present in the platform model and is editable from the profile experience, but it is not yet treated as a first-class synchronization layer across routing, workspace visibility, or role-based access. The current state is effectively a free-form profile field rather than a governed department model.

## Evidence snapshot

- Backend user employment schema: `backend/models/User.js`
- Frontend profile form handling: `frontend/src/pages/Profile.jsx`
- Role and workspace visibility logic: `frontend/src/app/navigation/workspaces.js`
- Redirect logic: `frontend/src/utils/redirectByRole.js`

## Findings

### 1. Department metadata exists on the backend

The backend user model includes:
- `employment.department`
- `employment.workLocation`
- `employment.branch`
- `hospital`

This means the data model already supports department-scoped staff context.

### 2. The frontend profile UI reads and writes department fields

The profile page consumes and persists `employment.department`, `employment.workLocation`, and `employment.branch`.

This shows that the UI is already aware of department-level identity metadata.

### 3. Department is not yet used for routing or workspace decisions

The current frontend navigation and redirect logic are role-driven only. There is no department-aware route selection, no department-based workspace filter, and no controlled department taxonomy in the UI.

This creates a synchronization gap between the stored employee context and the newly structured app shell.

## Risk level

Low to medium. The data model is present and the UI can capture the values, but the platform does not yet use department context to influence navigation or access patterns.

## Recommended next step

Introduce a shared department taxonomy and use it in profile onboarding, staff directory flows, and department-aware navigation where appropriate.
