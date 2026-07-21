# AFY-P1-017 Route Audit

Date: 2026-07-08
Scope: frontend route coverage, canonical app routes, legacy route aliases, and workspace navigation consistency.

## Executive summary

The route system has a strong foundation, but it is not fully synchronized yet. The main router currently defines 123 canonical `/app/...` routes, while the navigation model exposes 61 workspace navigation paths. The legacy route map also contains 172 aliases, and a subset of those targets do not currently exist as routed pages in the main app shell.

## Evidence snapshot

- Main router: `frontend/src/App.jsx`
- Workspace navigation: `frontend/src/app/navigation/workspaces.js`
- Legacy route map: `frontend/src/app/routing/legacyRouteMap.js`
- Canonical path helper: `frontend/src/app/routing/canonicalizePath.js`

## Findings

### 1. Legacy aliases point to routes that are not defined in the main router

The audit found 23 legacy targets that resolve to canonical paths that are not defined in `frontend/src/App.jsx`.

Missing targets include:
- `/app/governance/claims/index`
- `/app/governance/command/county`
- `/app/governance/fraud/index`
- `/app/governance/registry/hospitals`
- `/app/governance/registry/patient-identity`
- `/app/governance/registry/pharmacies`
- `/app/governance/reports/regulatory`
- `/app/governance/verification/hospitals`
- `/app/platform/security/admin/home`
- `/app/platform/security/officer/home`
- `/app/portal/appointments/index`
- `/app/portal/billing/index`
- `/app/portal/diagnostics/lab-results`
- `/app/portal/discovery/ads`
- `/app/portal/discovery/hospitals`
- `/app/portal/family/records`
- `/app/portal/family/timeline`
- `/app/portal/home/index`
- `/app/portal/insurance/index`
- `/app/portal/medications/prescriptions`
- `/app/portal/records/index`
- `/app/portal/support/feedback`
- `/app/portal/transfers/index`

### 2. Workspace navigation is ahead of the router for several governance and portal entries

The workspace navigation file includes governance and portal links that are not currently represented as route entries in the main router.

Examples:
- `/app/governance/claims/index`
- `/app/governance/registry/hospitals`
- `/app/governance/registry/patient-identity`
- `/app/portal/home/index`
- `/app/portal/appointments/index`
- `/app/portal/records/index`
- `/app/portal/billing/index`

### 3. Security home aliases are mapped but not currently routed

The legacy route map redirects security-specific entrypoints to security home pages, but the main router does not currently define those canonical pages.

Affected values:
- `/app/platform/security/officer/home`
- `/app/platform/security/admin/home`

## Risk level

Medium. The route system is functional for core care, operations, platform, and governance flows, but stale aliases and missing canonical targets can create broken links, failed redirects, and inconsistent navigation.

## Recommended next step

Implement route parity for the missing governance, portal, and security targets before expanding the UI surface further.
