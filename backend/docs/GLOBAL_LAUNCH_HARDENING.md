# Global Launch Hardening

This document covers the final operator actions for AfyaLink as traffic expands beyond a single market and a single deployment region.

## 1. Same-origin frontend networking

- Frontend browser traffic should use the shared same-origin resolver instead of hard-coded backend origins.
- Blob downloads, WebSocket bootstraps, CRDT sync, payment calls, AI chat helpers, and offline replay should all route through the same browser-visible origin first.
- Treat direct backend origins as infrastructure details, not UI runtime configuration.

## 2. Session storage policy

- Active refresh sessions are capped with `MAX_ACTIVE_REFRESH_SESSIONS` (default `8`).
- Revoked and evicted sessions are retained as metadata with `sessionId`, `tokenHash`, `lastSeenAt`, `lastIp`, `country`, and `revokeReason`.
- Password reset, password change, logout, refresh rotation, and self-delete now update session records instead of letting `refreshTokens` grow forever.

## 3. Vercel firewall and bot-management tuning

Use Vercel’s official firewall tooling before tightening blocks on `/login` or `/api/auth/login`.

- Start in Firewall Observability and inspect challenged or denied requests by path, country, JA4, and rule before changing protections.
- Put auth-path custom rules behind `Log` first, then move to `Rate Limit`, `Challenge`, or `Deny` only after traffic patterns are understood.
- Keep Attack Challenge Mode as an incident switch for targeted attacks, not the default state for a healthcare login flow.
- If you must challenge auth traffic, prefer custom rules scoped to the login paths over whole-site challenge mode.
- Send logs to your SIEM with Log Drains before launch so false positives show up quickly.

Official references:

- Vercel Firewall: https://vercel.com/docs/vercel-firewall
- Firewall Observability: https://vercel.com/docs/vercel-firewall/firewall-observability
- WAF Rate Limiting: https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting
- Attack Challenge Mode: https://vercel.com/docs/vercel-firewall/attack-challenge-mode

## 4. Synthetic monitoring and alerting

- The scheduled GitHub workflow `.github/workflows/synthetic-live-smoke.yml` runs `backend/scripts/live-smoke-suite.mjs` every 15 minutes.
- Set these secrets before enabling it:
  - `SYNTHETIC_SUPER_ADMIN_IDENTIFIER`
  - `SYNTHETIC_SUPER_ADMIN_PASSWORD`
  - optional `SYNTHETIC_HOSPITAL_ADMIN_IDENTIFIER`
  - optional `SYNTHETIC_HOSPITAL_ADMIN_PASSWORD`
- Set `SYNTHETIC_BASE_URL` as a repository variable if production uses a different hostname.
- `REQUIRED_ROLE_SUITES=SUPER_ADMIN` ensures the workflow fails if the dashboard smoke account is missing.

For true multi-region coverage, run the same smoke suite from at least three probe locations such as:

- US East
- Europe West
- Africa or India / APAC

Recommended options:

- self-hosted GitHub runners in each region
- an external synthetic provider that can invoke the script or equivalent HTTP checks

Wire alerts to the SLOs in `backend/ops/slo/afyalink-slo.yml`, especially:

- `/readyz`
- `/api/system-settings/public`
- `/api/auth/login`
- one authenticated dashboard route

## 5. Localization rollout

- User profile preferences now persist `locale`, `appLanguage`, `patientLanguage`, `timeZone`, and `currency`.
- Browser defaults should be written once per user profile so locale formatting survives frontend and backend redeploys.
- Before opening a new country, audit remaining hard-coded `toLocaleString()` and currency labels in dashboards and patient-facing summaries.
- Phone capture should remain E.164 based, with country selection at input time instead of assuming one national format.
- Onboarding, consent text, billing copy, and patient notifications should be reviewed country by country, not only translated.

## 6. Geography and resilience

- Serve public images, icons, and documents from a CDN-first origin with cache headers and object-store fallbacks.
- Move queue-heavy or retry-heavy background work off the main web node.
- Run restore drills for Mongo backups and document the measured RPO/RTO every quarter.
- Keep a data residency register for each operating country before storing regulated health data there.
- Maintain a primary-region / secondary-region failover plan and exercise it with synthetic traffic, not just health checks.

## 7. Asset hygiene

- Broken remote branding assets should fall back to shipped defaults immediately.
- Cache known-bad remote asset URLs client-side so the app stops retrying the same 404 icon every route load.
- Review branding uploads regularly and delete stale Cloudinary or object-store references that no longer exist.
