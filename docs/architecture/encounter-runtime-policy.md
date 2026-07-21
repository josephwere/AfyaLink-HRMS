# AfyaLink Encounter Runtime Engineering Policy

## Purpose
This document formalizes the architectural direction for AfyaLink as an encounter-driven healthcare runtime rather than a collection of feature-specific modules. It is the default policy for implementation decisions going forward.

## Architectural Layers

### 1. User Applications
User-facing experience surfaces that interact with the runtime:
- Web
- Mobile
- Admin
- Patient
- Doctor
- Nurse
- AI UI

### 2. Encounter Runtime (Clinical)
The core clinical runtime owns encounter lifecycle and care collaboration:
- Encounter
- Encounter state machine
- Participants
- Presence
- Timeline
- Documentation
- Orders
- Media
- Collaboration
- AI context

### 3. Platform Runtime
Shared platform capabilities that support every encounter type:
- Operational event gateway
- Workflow engine
- Execution planner
- Audit
- Notifications
- Telemetry
- Authorization
- Observability

### 4. Domain Services
Business-oriented services that execute operations without owning orchestration:
- Admissions
- Pharmacy
- Laboratory
- Radiology
- Finance
- Bed Management
- HR
- Inventory
- Billing
- Telemedicine
- Emergency
- Theatre
- ICU
- Other future domains

### 5. Infrastructure
Core runtime infrastructure:
- MongoDB
- Redis
- WebSockets
- WebRTC
- AI services
- Storage
- SMS
- Other integrations

## Governing Rules

### Rule 1 — Everything clinical is an Encounter
No module owns its own lifecycle. Clinical workflows must be modeled as encounters, including:
- Telemedicine
- Outpatient visit
- Emergency visit
- Ward round
- Home visit
- ICU review

All of these are encounter modes of the same runtime.

### Rule 2 — Domain services never own orchestration
Domain services expose business operations only. They must not:
- send notifications
- update dashboards
- publish WebSocket messages
- trigger AI
- invoke unrelated services

They should focus on well-defined operations such as:
- AdmissionsService.admitPatient()
- LaboratoryService.createOrder()
- PharmacyService.dispenseMedication()

### Rule 3 — Every state transition emits an event
Every meaningful state change in the encounter runtime must publish a standardized event such as:
- ENCOUNTER_CREATED
- PARTICIPANT_JOINED
- MEDIA_CONNECTED
- NOTE_UPDATED
- ORDER_CREATED
- PRESCRIPTION_CREATED
- LAB_ORDER_CREATED
- IMAGING_ORDER_CREATED
- ENCOUNTER_COMPLETED

The operational event gateway is the canonical integration path for these events.

### Rule 4 — AI is always a subscriber
AI must not be tightly coupled to a feature. AI services subscribe to encounter and platform events and consume shared runtime signals.

### Rule 5 — Media is an adapter, not the application
The runtime owns encounter lifecycle, participants, permissions, state, and events. Media services only provide:
- video
- audio
- screen sharing
- recording

This separation is required to keep media stability issues from destabilizing core clinical workflows.

### Rule 6 — No cross-domain business logic without the runtime
No business domain may call another business domain directly. Cross-domain coordination must occur through the Encounter Runtime or the Operational Event Gateway. Admissions, Pharmacy, Finance, Laboratory, Radiology, and other domains must publish and subscribe through shared runtime channels rather than building point-to-point service coupling.

## Architecture Compliance Checklist
Every new clinical feature should answer yes to the following before merge:
- Does it create or use an Encounter?
- Does it publish standardized Encounter events?
- Does it reuse Platform Runtime services?
- Does it avoid duplicating lifecycle logic?
- Can AI consume its events without custom integration?
- Does it expose telemetry?
- Does it produce an audit trail?

## Telemedicine Acceptance Criteria
The next implementation sprint must make consultation workflows correct and stable.

### Media
- Doctor sees the patient
- Doctor sees their own self-preview
- Patient sees the doctor
- Patient sees their own self-preview
- One remote stream per participant
- Stable reconnect handling
- Camera switching
- Microphone switching
- Screen sharing
- Waiting room support

### Clinical Workspace
Once media is stable, the encounter shell becomes the place where clinicians complete care without leaving the session:
- Patient summary
- Allergies
- Medications
- Previous encounters
- Laboratory results
- Radiology images
- Clinical notes
- Prescriptions
- Lab orders
- Imaging orders
- Referrals
- Follow-up scheduling

## Shared Platform Services
The following capabilities should be implemented as reusable services available to every encounter type:
- Presence
- Timeline
- Documentation
- Order management
- Collaboration
- Media adapter
- Audit
- Notifications
- Workflow
- Telemetry

## Executive Dashboard Integration
Executive dashboards must subscribe to encounter and platform events rather than relying on polling. Examples:
- Patient admitted → bed occupancy updates
- Lab completed → laboratory widgets refresh
- Prescription issued during a consultation → pharmacy metrics update
- Invoice paid → finance dashboard refreshes
- Encounter completed → KPIs and executive summaries update

## Release Objective: Encounter Runtime v1
The next major release should focus on delivering:
- Encounter domain model
- Encounter state machine
- Standardized encounter and event contracts
- Presence service
- Timeline service
- Media adapter interface
- Telemedicine on the encounter runtime
- Clinical workspace shell
- Operational event integration
- End-to-end two-way WebRTC video with correct local and remote rendering
- AI consuming encounter events as a platform subscriber

## Implementation Policy
When implementing new functionality, teams must ask:
1. Is this a clinical workflow? If yes, it belongs in the encounter runtime.
2. Does this represent a business operation only? If yes, it should live in a domain service.
3. Does this change state? If yes, it must emit an event.
4. Is AI involved? If yes, it should subscribe to events rather than be coupled to a feature.
5. Is media involved? If yes, it should be handled through the media adapter abstraction.
