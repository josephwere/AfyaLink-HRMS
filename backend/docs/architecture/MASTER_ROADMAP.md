# Master Roadmap

## Purpose

This document is the authoritative implementation roadmap for AfyaLink backend platform milestones.

## Milestones

### 1. Clinical Platform Foundation
- Scheduling runtime
- Appointment runtime
- Arrival runtime
- Encounter runtime
- Clinical documentation runtime
- Orders runtime
- Prescription runtime
- Laboratory runtime
- Radiology runtime

### 2. Operational Platform
- Pharmacy runtime
- Care plans runtime
- Admission runtime
- Ward management runtime
- Operating theatre runtime
- Inventory runtime
- Logistics runtime
- Mortuary runtime

### 3. Financial and Administrative Platform
- Billing runtime
- Claims runtime
- Payments runtime
- Workforce runtime
- Compliance runtime

### 4. Shared Platform Services
- Workflow runtime
- Notification runtime
- Identity and RBAC services
- Audit and timeline services
- Event catalog and event bus
- File storage service
- Document service
- Search service
- Feature flag service
- Configuration service

### 5. Intelligence and Analytics
- Reporting runtime
- Analytics runtime
- AI services runtime
- Decision support services

## Dependency Order

1. Scheduling
2. Appointment
3. Arrival
4. Encounter
5. Clinical Documentation
6. Orders
7. Prescription
8. Laboratory
9. Radiology
10. Pharmacy
11. Care Plans
12. Admission
13. Ward Management
14. Operating Theatre
15. Billing
16. Claims
17. Inventory
18. Logistics
19. Mortuary
20. Notifications
21. Workflow Automation
22. Reporting
23. Analytics
24. AI Services

## Completion Criteria

A milestone is complete only when:
- runtime implementation exists
- repository, runtime, state machine, routes, and tests are present
- integration and regression tests pass
- startup remains green
- blueprint compliance is verified
