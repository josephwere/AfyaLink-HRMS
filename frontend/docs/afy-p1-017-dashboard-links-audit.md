# AFY-P1-017 Dashboard Link Audit

Date: 2026-07-08
Scope: dashboard-style CTA links and role landing links that should point to canonical app routes.

## Executive summary

The dashboard and workspace surfaces contain a number of links that look correct at first glance but target routes that are not currently available in the main router. This is the most immediate user-visible issue discovered during the audit.

## Evidence snapshot

- Redirect-based landing: `frontend/src/utils/redirectByRole.js`
- Workspace home navigation: `frontend/src/components/Sidebar.jsx`
- Emergency command dashboard: `frontend/src/pages/Operations/EmergencyCommandDashboard.jsx`
- Unified assistant dashboard: `frontend/src/pages/SystemAdmin/UnifiedAssistantDashboard.jsx`
- Workspace helper shortcuts: `frontend/src/utils/workspaceNavigation.js`

## Findings

### 1. Security-oriented dashboard links point to undefined targets

The emergency command dashboard includes links to:
- `/app/platform/security/admin/home`

That route is referenced by the dashboard UI but is not currently defined in the main router.

### 2. Several platform and assistant links depend on routes that are not fully present

The unified assistant experience and related platform shortcuts reference routes such as:
- `/app/platform/dev/home`
- `/app/platform/security/access-control`

The developer home route is present, while some security-related targets are not fully routed in the main App shell.

### 3. Dashboard and workspace links should be routed through the same canonical path set

The redirect map, sidebar, command palette, and individual dashboard cards all use the canonical `/app/...` convention. The remaining issue is that some of those canonical targets are still missing from the router.

## Risk level

Medium. These issues are visible in user-facing surfaces and can produce broken actions, dead-end dashboards, or confusing navigation.

## Recommended next step

Resolve the missing canonical destinations for security, portal, and governance surfaces before expanding dashboard CTA coverage.
