# AfyaLink Global Readiness Program

## Objective
Prepare AfyaLink for Kenya-wide deployment first, then multi-country expansion with controlled risk, measurable reliability, and compliance-by-design.

## Program Tracks
1. Multi-region production architecture
2. SRE and observability maturity
3. Compliance and data residency
4. Integration reliability at scale
5. Enterprise security hardening
6. Performance and capacity validation
7. Customer operations and rollout playbooks

## Delivery Phases
### Phase 0 (Now - 2 weeks): Gate hardening
- Lock production configs and secrets.
- Pass security gate + test suite + frontend build in CI.
- Finalize DR runbook, incident severity model, on-call rotation.
- Baseline SLOs for API, auth, and core patient flows.

### Phase 1 (2 - 6 weeks): Kenya pilot scale
- Deploy active-passive multi-zone in one region.
- Run peak-hour load tests with realistic workflows.
- Onboard 2-5 pilot hospitals with migration playbook.
- Start compliance evidence collection and monthly audits.

### Phase 2 (6 - 12 weeks): Kenya production scale
- Enable active-active across two regions.
- Introduce queue replay SLOs, connector SLAs, and failover drills.
- Add support command center and customer success cadence.

### Phase 3 (3 - 12 months): Global expansion
- Per-country legal pack + residency strategy.
- Regional AI/data controls and encryption key segregation.
- Global support model with local implementation partners.

## Executive Go/No-Go Gates
- `security:gate` must pass 100%.
- Backend tests and frontend build must pass.
- RTO/RPO drill passed in last 30 days.
- P1/P2 incident process tested with tabletop simulation.
- Capacity test at 2x expected peak passed.
- Compliance controls mapped and evidenced.

## KPIs
- API availability (monthly)
- p95 latency for auth/profile/dashboard/appointments
- Change failure rate
- Mean time to recovery (MTTR)
- Connector success rate
- Data migration success rate
- Customer onboarding lead time

## Immediate Next Commands
From repo root:

```bash
npm --prefix backend run security:gate
npm --prefix backend test
npm --prefix frontend run build
```

Then run production preflight with real production env:

```bash
npm --prefix backend run preprod:preflight
```
