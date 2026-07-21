# AFY-P1-017 Role Synchronization Audit

Date: 2026-07-08
Scope: role coverage between backend schema, frontend router guards, redirect logic, and workspace visibility.

## Executive summary

The backend and frontend role model are mostly aligned. The backend user schema and the frontend redirect map both cover the same core role set, including the hospital-scoped, platform, governance, and patient/guest roles. The main gap is not missing role names, but inconsistent landing behavior and route parity for a small set of specialized roles.

## Evidence snapshot

- Backend role enum: `backend/models/User.js`
- Backend role grouping helpers: `backend/utils/roleSets.js`
- Frontend role redirect map: `frontend/src/utils/redirectByRole.js`
- Frontend route guards: `frontend/src/App.jsx`
- Workspace visibility by role: `frontend/src/app/navigation/workspaces.js`

## Findings

### 1. Role set parity is mostly intact

The frontend redirect map defines 26 roles, and the backend user role enum defines the same broad role set.

This indicates that the core role vocabulary is synchronized.

### 2. Some role-specific landing routes point to destinations that are not fully represented in the route tree

Examples:
- `SECURITY_ADMIN` and `SECURITY_OFFICER` currently redirect to platform home or legacy security-home targets, but the canonical security home routes are not fully defined in the main router.
- `SUPER_ASSISTANT` has an explicit landing route to the unified assistant experience, and that route is present, but the surrounding workspace experience remains somewhat fragmented around security and platform operations.

### 3. Role-based workspace visibility is broader than the current route coverage

The workspace navigation model exposes role-accessible workspaces such as governance and portal, but the main router still has holes for several canonical targets that these roles may be expected to reach.

This creates a mismatch between what the app says a role can access and what the route tree actually serves.

## Risk level

Medium. The platform is not blocked by missing role names, but role-driven navigation can still lead to dead ends or inconsistent landing experiences.

## Recommended next step

Bring the specialized role destinations into the router and align the landing targets for security and assistant-oriented roles with the actual available pages.
