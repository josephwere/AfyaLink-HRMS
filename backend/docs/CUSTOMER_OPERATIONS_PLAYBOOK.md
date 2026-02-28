# Customer Operations and Rollout Playbook

## Customer Lifecycle
1. Pre-sales technical validation
2. Onboarding and data migration planning
3. Pilot go-live
4. Hypercare (first 30 days)
5. Steady-state support and optimization

## Support Model
- Tier 1: user support and workflow guidance.
- Tier 2: integration/configuration troubleshooting.
- Tier 3: engineering escalation.

## Pilot Ops APIs
- `GET /api/pilot/onboarding`: list onboarding checklists.
- `POST /api/pilot/onboarding`: create/update pilot onboarding checklist.
- `PATCH /api/pilot/onboarding/:id/item/:key`: mark checklist item complete/incomplete.
- `GET /api/sre/incidents`: operations incident handoff view.

## SLA Targets
- Sev1 response: <= 15 min.
- Sev2 response: <= 1 hour.
- Sev3 response: <= 4 hours.

## Training Program
- Role-based curriculum from `frontend/docs/role-training-playbook.md`.
- Admin training: governance, audit, incident handling.
- Clinical training: workflow, safety, escalation.

## Success Metrics
- Time to first value per hospital.
- Active users by role.
- Workflow completion rates.
- Support ticket reopen rate.
