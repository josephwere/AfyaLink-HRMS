# AfyaLink Competitor Matrix + Roadmap (Kenya)

## 1) Competitor Matrix (Kenya HMIS/HCM)

Legend:
- P = parity
- A = ahead
- G = gap

| Capability | AfyaID | MedicentreV3 | K-Afya | TibaTrack | Sanitas | AfyaLink (Now) | AfyaLink (Target) |
|---|---|---|---|---|---|---|---|
| Cross-hospital identity | P | G | G | G | G | G | A |
| Referral/transfer continuity | G | G | G | G | P | G | A |
| SHA HIE integration | G | P | G | G | G | G | A |
| KRA eTIMS | G | P | G | G | G | G | A |
| M-PESA | P | P | G | P | G | P | A |
| HL7/FHIR | G | P | P | G | G | P | A |
| DICOM imaging | G | P | G | G | P | G | A |
| Claims/denial management | G | G | G | G | G | G | A |
| HR/payroll/LMS | G | P | G | G | P | P | A |
| Biometric attendance | G | P | G | G | G | G | A |
| Command center / county ops | G | G | G | G | G | P | A |
| Offline-first CHW workflows | G | G | G | G | G | P | A |
| Pharmacy network layer | G | G | G | G | G | P | A |
| Practical AI workflows | G | G | G | G | G | P | A |
| Support / onboarding speed | P | P | P | P | P | P | A |

Key: AfyaLink is currently strong in workflow depth, offline ops, and AI. The win requires: verified interoperability, cross-hospital identity, claims/revenue protection, and county command operations.

## 2) Strategy: How AfyaLink Wins

1. **Continuity moat**
   - Best referral and transfer packet flow in Kenya.
   - Consent, provenance, audit bundle, and SLAs for handover completion.

2. **Operations + HR + clinical in one**
   - Workforce, payroll, training, and clinical operations in a single operational surface.

3. **Offline-first execution**
   - Queue capture, vitals, referrals, and pharmacy issue with sync replay and conflict resolution.

4. **Government integrations as core**
   - SHA HIE, eTIMS, M-PESA, HL7/FHIR, DICOM.

5. **AI inside workflow**
   - Triage, no-show prediction, SLA alerts, readmission risk, handoff completeness checks.

## 3) 90-Day Roadmap (Build Order)

1. **Integration Control Plane (SHA, eTIMS, M-PESA)**
   - Partner readiness, rollout, live signals, cutover checklist.

2. **Referral/Transfer Continuity Hub**
   - Transfer packet builder, consent enforcement, provenance viewer, handover SLA.

3. **Revenue Protection**
   - Auto-charge capture + denial tracking + reconciliation.

4. **Workforce moat**
   - Biometric attendance, rota, leave, payroll, LMS + credential expiry.

5. **County Command Center**
   - Beds, queues, TAT, outages, stock risk, transfer bottlenecks.

6. **Offline workflows**
   - Encrypted cache, sync replay, conflict resolver, audit trails.

## 4) Exact Modules + Screens to Build Next

### A) Integration Control Plane
- `Integration Control Plane`
- `SHA HIE Readiness`
- `eTIMS Invoices`
- `M-PESA Collections`
- `Insurance Eligibility & Claims`

APIs:
- `/api/integrations/sha/*`
- `/api/integrations/etims/*`
- `/api/integrations/mpesa/*`
- `/api/integrations/insurance/*`
- `/api/interop/fhir/*`
- `/api/interop/hl7/*`
- `/api/interop/dicom/*`

### B) Referral / Continuity Hub
- `Transfer Command Center`
- `Transfer Packet Review`
- `Consent & Provenance Viewer`
- `Handover SLA Monitor`

APIs:
- `/api/transfers/identity-match`
- `/api/transfers/packet/build`
- `/api/transfers/packet/:id`
- `/api/transfers/:id/accept`
- `/api/transfers/:id/reject`

### C) Revenue Protection
- `Charge Capture`
- `Denial Queue`
- `Reconciliation Dashboard`
- `Revenue Leakage Monitor`

APIs:
- `/api/claims/capture`
- `/api/claims/denials`
- `/api/claims/reconciliation`

### D) Workforce Moat
- `Biometric Attendance Console`
- `Shift Planner`
- `Leave & Coverage`
- `Payroll Inputs`
- `Credential Expiry Tracker`
- `LMS Training Tracker`

APIs:
- `/api/workforce/biometric/*`
- `/api/workforce/credentials/*`
- `/api/training/lms/*`

### E) County Command Center
- `County Operations Dashboard`
- `Bed State & Occupancy`
- `Queue Heatmap`
- `Outage Monitor`
- `Stock Risk`
- `Referral Bottleneck Map`

APIs:
- `/api/command-center/*`

### F) Offline Sync Core
- `Offline Capture`
- `Sync Queue`
- `Conflict Resolver`
- `Audit Trail`

APIs:
- `/api/offline/sync/*`

### G) Pharmacy Network
- `Nearest Stock Finder`
- `Substitution Rules`
- `External Referral`
- `Dispensing Audit`

APIs:
- `/api/pharmacy-network/stock-search`
- `/api/pharmacy-network/substitutions/*`

### H) NeuroEdge Clinical Intelligence
- `Triage Scoring`
- `No-show Prediction`
- `Readmission Risk`
- `Lab/Radiology SLA Alerts`

APIs:
- `/api/ai/triage/*`
- `/api/ai/risk/*`

## 5) Implementation Moat

- 7-day onboarding pack
- migration templates + import tooling
- role training + LMS
- 24/7 support via WhatsApp
- release notes + change management

## 6) Immediate Engineering Backlog (First 6 sprints)

Sprint 1
- SHA + eTIMS + M-PESA integration control plane MVP
- Integration health, runtime, audit logs

Sprint 2
- Transfer packet builder + consent enforcement
- Handover SLA and transfer status cards

Sprint 3
- Billing auto-capture and denial queue
- Revenue leakage alerting

Sprint 4
- Biometric attendance + shift planner
- Credential expiry alerts

Sprint 5
- County command center baseline
- Bed, queue, outage, stock risk panels

Sprint 6
- Offline capture + sync replay
- Conflict resolver and audit replay

## 7) Positioning Copy (Use in Sales)

AfyaLink is the operations + workforce + continuity platform for Kenya’s hospitals.
Not just HMIS. It connects clinical care, staff operations, and inter-facility continuity in one workflow system.
