# AFY-P1-020 Interactive Surface Audit

- Generated: 2026-07-21T20:46:38.182Z
- Total interactive surfaces scanned: 280
- Resolved: 76
- Unresolved: 204
- Canonical routes discovered: 162

## Surface distribution

- deep-link: 46
- button: 151
- dashboard-card: 83

## Unresolved targets

- src/components/AccessDeniedCard.jsx:14 [deep-link] interactive action -> /profile (no matching canonical route)
- src/components/ConsultationRoom.jsx:648 [deep-link] interactive action -> /patient/medical-records (no matching canonical route)
- src/components/ConsultationRoom.jsx:657 [deep-link] interactive action -> /patient/prescriptions (no matching canonical route)
- src/hooks/useCommerceConfig.js:114 [button] interactive action -> /hospital-admin/customization (no matching canonical route)
- src/hooks/useRevenueIntelligence.js:98 [button] interactive action -> /hospital-admin/financials (no matching canonical route)
- src/hooks/useRevenueIntelligence.js:113 [button] interactive action -> /hospital-admin/claims (no matching canonical route)
- src/hooks/useRevenueIntelligence.js:118 [button] interactive action -> /payments/full (no matching canonical route)
- src/pages/Admin/AccessControl.jsx:37 [button] interactive action -> /profile (no matching canonical route)
- src/pages/Admin/AccessControl.jsx:41 [button] interactive action -> /profile (no matching canonical route)
- src/pages/Admin/CreateAdmin.jsx:47 [deep-link] Manage Super Assistants -> /admin/super-assistants (no matching canonical route)
- src/pages/Admin/Dashboard.jsx:86 [deep-link] Open Audit Logs -> /admin/audit-logs (no matching canonical route)
- src/pages/Admin/Dashboard.jsx:87 [deep-link] Open AI Autofill Audit -> /admin/ai-autofill-audit (no matching canonical route)
- src/pages/Admin/Dashboard.jsx:88 [deep-link] Create Admin -> /admin/create-admin (no matching canonical route)
- src/pages/Admin/Dashboard.jsx:89 [deep-link] Super Assistants -> /admin/super-assistants (no matching canonical route)
- src/pages/Admin/SuperAssistants.jsx:59 [deep-link] Register Super Assistant -> /admin/create-admin (no matching canonical route)
- src/pages/Developer/DecisionCockpit.jsx:33 [button] Open Queue Replay -> /developer/queue-replay (no matching canonical route)
- src/pages/Developer/DecisionCockpit.jsx:34 [button] Provenance Verify -> /developer/provenance-verify (no matching canonical route)
- src/pages/Developer/DecisionCockpit.jsx:35 [button] Webhook Recovery -> /developer/webhook-retry (no matching canonical route)
- src/pages/Developer/DecisionCockpit.jsx:72 [dashboard-card] DLQ Failed -> /developer/queue-replay (no matching canonical route)
- src/pages/Developer/ProvenanceVerify.jsx:36 [button] Transfer Command Center -> /hospital-admin/transfer-command-center (no matching canonical route)
