# Architecture Blueprint v1 — AfyaLink Healthcare Platform

**Version**: 1.0  
**Date**: 2026-07-03  
**Status**: Governing Document  

---

## Platform Principles

These are the foundational rules that govern all architectural decisions in AfyaLink.

1. **One runtime owns one domain** — Clear ownership prevents conflicts and overlapping responsibilities
2. **One domain owns one state machine** — A runtime has exactly one lifecycle; no ambiguous transitions
3. **One state transition emits one domain event** — Events are the communication currency between runtimes
4. **Every mutation is idempotent** — Retries never cause inconsistency; `upsertOne` is default pattern
5. **Every important action is auditable** — Timeline models record all state changes; immutable append-only
6. **Business logic never lives in controllers** — Controllers only authorize and route; runtimes make decisions
7. **UI never owns workflow** — Workflows are defined declaratively; UI only consumes state
8. **AI advises; runtimes decide** — AI provides recommendations; business logic makes final call
9. **Every runtime can be tested independently** — No inter-runtime test dependencies; mock events only
10. **Every new module must fit the runtime architecture** — No exceptions; consistency grows the platform

These principles are non-negotiable. When in doubt, ask: *Which principle does this decision violate?*

---

## Platform Architecture Overview

AfyaLink consists of **Platform Runtimes** (business domains), **Shared Services** (cross-cutting utilities), and **Shared Workspaces** (role-based UI).

```
┌─────────────────────────────────────────────────────────────────┐
│                    Shared Workspaces (UI)                       │
│  Clinical | Emergency | Operations | Diagnostics | Admin | etc  │
└────────────────────┬────────────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────────────┐
│                                                                  │
│  Platform Runtimes (Business Domains) ────────> Shared Services  │
│                                                                  │
│  ┌─────────────────────────────────┐      ┌──────────────────┐  │
│  │  Clinical Layer                 │      │  Clock Service   │  │
│  │  • Encounter                    │      │  Maps Service    │  │
│  │  • Orders                       │      │  AI Service      │  │
│  │  • Medication (Prescriptions)   │      │  QR Service      │  │
│  │  • Laboratory                   │      │  Search Service  │  │
│  │  • Radiology                    │      │  Storage Service │  │
│  │  • Blood Bank                   │      │  Document Svc    │  │
│  │  • ICU                          │      │  Audit Service   │  │
│  │  • Ward                         │      │  Config Service  │  │
│  │  • Theatre                      │      │  Localization    │  │
│  │  • Dialysis                     │      └──────────────────┘  │
│  │  • Dental                       │                             │
│  │  • Physiotherapy                │                             │
│  └─────────────────────────────────┘                             │
│                                                                  │
│  ┌─────────────────────────────────┐                             │
│  │  Operational Layer              │                             │
│  │  • Scheduling                   │                             │
│  │  • Appointment                  │                             │
│  │  • Arrival                      │                             │
│  │  • Logistics                    │                             │
│  │  • Mortuary                     │                             │
│  │  • Facilities                   │                             │
│  │  • Maintenance                  │                             │
│  │  • Kitchen                      │                             │
│  │  • Security                     │                             │
│  └─────────────────────────────────┘                             │
│                                                                  │
│  ┌─────────────────────────────────┐                             │
│  │  Administrative Layer            │                             │
│  │  • HR                           │                             │
│  │  • Finance                      │                             │
│  │  • Payroll                      │                             │
│  │  • Inventory                    │                             │
│  │  • Procurement                  │                             │
│  │  • Assets                       │                             │
│  │  • Insurance                    │                             │
│  │  • Reporting                    │                             │
│  └─────────────────────────────────┘                             │
│                                                                  │
│  ┌─────────────────────────────────┐                             │
│  │  Platform Layer                 │                             │
│  │  • Identity                     │                             │
│  │  • Notification                 │                             │
│  │  • Workflow & Automation        │                             │
│  │  • Integration                  │                             │
│  │  • Analytics                    │                             │
│  │  • Command Center               │                             │
│  └─────────────────────────────────┘                             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

Domain Events (← → pub/sub between runtimes)
```

---

## Platform Layers

### Clinical Layer
Runtimes that directly support patient care and clinical decision-making.

- **Encounter Runtime** — Clinical workflows, assessments, treatment decisions
- **Orders Runtime** — Lab orders, imaging orders, procedure orders
- **Medication Runtime** — Prescriptions, drug interactions, dispensing
- **Laboratory Runtime** — Test orders, specimen tracking, results
- **Radiology Runtime** — Imaging studies, DICOM viewer, reports
- **Blood Bank Runtime** — Inventory, crossmatch, transfusion
- **ICU Runtime** — Intensive care admission, monitoring, protocols
- **Ward Runtime** — General admission, bed assignment, clinical observations
- **Theatre Runtime** — Surgery scheduling, anesthesia, equipment
- **Dialysis Runtime** — Sessions, vascular access, treatment plans
- **Dental Runtime** — Procedures, anesthesia, prosthetics
- **Physiotherapy Runtime** — Treatment plans, progress, outcomes
- **Home Care Runtime** — Visits, care plans, post-discharge

### Operational Layer
Runtimes that manage hospital operations and logistics.

- **Scheduling Runtime** — Availability, slots, holds, booking constraints
- **Appointment Runtime** — Lifecycle from booking to encounter handoff
- **Arrival Runtime** — Check-in, identity verification, queue management
- **Logistics Runtime** — Ambulances, drivers, dispatch, transport, specimen delivery
- **Mortuary Runtime** — Receiving deceased, chain of custody, cold-room management
- **Facilities Runtime** — Buildings, rooms, capacity, maintenance
- **Maintenance Runtime** — Equipment maintenance, repairs, schedules
- **Kitchen Runtime** — Meal preparation, dietary requirements, delivery
- **Security Runtime** — Access control, incident reporting, response

### Administrative Layer
Runtimes that support hospital management and business operations.

- **HR Runtime** — Staff records, scheduling, performance
- **Finance Runtime** — Budgets, expenses, cost centers
- **Payroll Runtime** — Wages, deductions, tax, compliance
- **Inventory Runtime** — Stock levels, reorder points, expiry tracking
- **Procurement Runtime** — Vendors, purchase orders, receipts
- **Assets Runtime** — Equipment registers, depreciation, maintenance
- **Insurance Runtime** — Verification, claims processing, payment
- **Reporting Runtime** — Financial, operational, compliance reports

### Platform Layer
Runtimes and services that enable all other runtimes.

- **Identity Runtime** — Patient/staff identity, QR, biometrics, national ID integration
- **Notification Runtime** — SMS, email, push, WhatsApp, voice delivery
- **Workflow & Automation Runtime** — Declarative workflow orchestration
- **Integration Runtime** — External system connectors, data sync, mappings
- **Analytics Runtime** — Event processing, trend analysis, dashboards
- **Command Center Runtime** — Hospital-wide operational visibility
- **Audit Service** — Compliance logging, access trails

---

## Platform Runtimes — Detailed Specifications

### SCHEDULING RUNTIME

**Maturity**: ★★★★★ Production Ready

**Purpose**: Manage availability, slots, holds, and booking windows for all resources.

**Owns**:
- Slot (availability records)
- SlotReservation (holds on slots)
- ScheduleTemplate (recurring availability patterns)
- DoctorAvailability (doctor-specific schedules)

**Writes**:
- Slot
- SlotReservation
- ScheduleTemplate

**Reads**:
- AppointmentType (constraints)
- User (resource availability)
- Hospital (configurations)
- DoctorAvailability
- DoctorLeave

**Publishes**:
- `SLOT_GENERATED`
- `SLOT_HELD`
- `SLOT_RELEASED`
- `SLOT_CONFIRMED`
- `SLOT_EXPIRED`

**Consumes**:
- (None; produces state independently)

**State Machine**:
```
AVAILABLE → HELD (with expiration) → AVAILABLE (if expired)
         → CONFIRMED (when appointment booked)
```

**Key Services**:
- slotGenerator.js — Idempotent generation from templates
- reservationExpirationJob.js — Background hold cleanup
- schedulingPolicyEngine.js — Business rule enforcement

---

### APPOINTMENT RUNTIME

**Maturity**: ★★★★☆ Near Production

**Purpose**: Manage appointment lifecycle from confirmation to encounter handoff.

**Owns**:
- Appointment (lifecycle record)
- AppointmentTimeline (audit trail)

**Writes**:
- Appointment
- AppointmentTimeline

**Reads**:
- Slot
- SlotReservation
- Patient
- User (doctor)
- Hospital
- AppointmentType

**Publishes**:
- `APPOINTMENT_CONFIRMED`
- `APPOINTMENT_CHECKED_IN`
- `APPOINTMENT_WAITING`
- `APPOINTMENT_READY`
- `APPOINTMENT_CANCELLED`
- `APPOINTMENT_EXPIRED`
- `APPOINTMENT_NO_SHOW`
- `APPOINTMENT_RESCHEDULED`
- `ENCOUNTER_REQUESTED`

**Consumes**:
- `SLOT_CONFIRMED`
- `PATIENT_READY` (from Arrival Runtime)

**State Machine**:
```
CREATED → CONFIRMED → CHECKED_IN → WAITING → READY_FOR_PROVIDER
                                              ↓
                                    OPENING_ENCOUNTER → IN_ENCOUNTER → COMPLETED

Side exits: CANCELLED, EXPIRED, NO_SHOW, RESCHEDULED
```

**Key Services**:
- appointmentRuntime.js — State machine and transitions
- doctorResourceProvider.js — Doctor availability implementation

---

### ARRIVAL RUNTIME

**Maturity**: ★★★☆☆ In Development

**Purpose**: Bridge between appointment confirmation and encounter launch; manage check-in, identity verification, and queue.

**Owns**:
- Arrival (check-in record)
- ArrivalTimeline (audit trail)

**Writes**:
- Arrival
- ArrivalTimeline

**Reads**:
- Appointment
- Patient
- User (doctor)
- Hospital

**Publishes**:
- `PATIENT_ARRIVED`
- `IDENTITY_VERIFIED`
- `PATIENT_WAITING`
- `PATIENT_CALLED`
- `PATIENT_READY`
- `ARRIVAL_NO_SHOW`
- `ARRIVAL_CANCELLED`
- `PATIENT_READY`

**Consumes**:
- `APPOINTMENT_CONFIRMED`
- `APPOINTMENT_CANCELLED` (to cancel arrival)

**State Machine**:
```
BOOKED → ARRIVED → VERIFIED → WAITING → CALLED → READY → ENCOUNTER_OPENING → COMPLETED

Side exits: CANCELLED, NO_SHOW
```

**Key Services**:
- arrivalRuntime.js — Check-in and queue management
- queueManager.js — Queue position assignment and ordering

---

### ENCOUNTER RUNTIME

**Maturity**: ★★☆☆☆ Foundation Phase

**Purpose**: Manage clinical workflows, assessments, treatment decisions, and documentation.

**Owns**:
- Encounter (clinical session record)
- EncounterTimeline (audit trail)
- ClinicalAssessment
- ClinicalDecision
- ClinicalNotes

**Writes**:
- Encounter
- EncounterTimeline
- ClinicalAssessment
- ClinicalDecision
- ClinicalNotes

**Reads**:
- Appointment
- Arrival
- Patient
- User (doctor/nurse)
- Hospital

**Publishes**:
- `ENCOUNTER_OPENED`
- `ASSESSMENT_RECORDED`
- `ORDER_CREATED`
- `PRESCRIPTION_CREATED`
- `DIAGNOSIS_RECORDED`
- `ENCOUNTER_CLOSED`
- `ENCOUNTER_CANCELLED`

**Consumes**:
- `PATIENT_READY` (from Arrival Runtime)
- `APPOINTMENT_CANCELLED`

**State Machine**:
```
OPENING → OPEN → ASSESSMENT → DECISION → TREATMENT → CLOSURE → COMPLETED

Side exits: CANCELLED, SUSPENDED, REFERRED
```

---

### TELEMEDICINE RUNTIME

**Maturity**: ★☆☆☆☆ Planned

**Purpose**: Manage WebRTC/audio/video communication; media handling only (not business logic).

**Owns**:
- TelemedicineSession (call record)
- MediaStream (recording metadata)

**Writes**:
- TelemedicineSession
- MediaStream

**Reads**:
- Encounter
- Arrival
- User (provider, patient)

**Publishes**:
- `SESSION_INITIATED`
- `SESSION_CONNECTED`
- `SESSION_RECORDING_STARTED`
- `SESSION_QUALITY_DEGRADED`
- `SESSION_ENDED`
- `MEDIA_AVAILABLE`

**Consumes**:
- `PATIENT_READY` (from Arrival Runtime)
- `ENCOUNTER_OPENED`

---

### LOGISTICS RUNTIME

**Maturity**: ★☆☆☆☆ Planned

**Purpose**: Manage ambulances, drivers, dispatch, patient transport, specimen delivery, and route optimization.

**Owns**:
- Mission (transport request)
- MissionTimeline (audit trail)
- Ambulance (vehicle record)
- Driver (operator record)
- Route (optimized path)
- Dispatch (assignment decision)

**Writes**:
- Mission
- MissionTimeline
- Route
- Dispatch

**Reads**:
- Appointment (for patient transport missions)
- Encounter (for specimen/result transport)
- Hospital (locations)
- User (drivers, dispatchers)

**Publishes**:
- `MISSION_CREATED`
- `AMBULANCE_DISPATCHED`
- `PATIENT_EN_ROUTE`
- `PATIENT_AT_HOSPITAL`
- `MISSION_COMPLETED`
- `ROUTE_OPTIMIZED`
- `DRIVER_ASSIGNED`

**Consumes**:
- `APPOINTMENT_CONFIRMED` (for patient transport pre-booking)
- `LAB_SPECIMEN_READY` (for specimen transport)

---

### PHARMACY RUNTIME

**Maturity**: ★☆☆☆☆ Planned

**Purpose**: Manage prescriptions, drug interactions, inventory, dispensing, and verified pharmacy network.

**Owns**:
- Prescription
- PrescriptionTimeline
- PharmacyNetwork (external pharmacies)
- InventoryBatch (medication stock)

**Writes**:
- Prescription
- PrescriptionTimeline
- InventoryBatch

**Reads**:
- Encounter (where prescription issued)
- Patient (medication history)
- PharmacyNetwork (verified partners)

**Publishes**:
- `PRESCRIPTION_ISSUED`
- `PRESCRIPTION_VALIDATED`
- `DRUG_INTERACTION_ALERT`
- `MEDICINE_DISPENSED`
- `REFILL_NEEDED`
- `PRESCRIPTION_EXPIRED`

**Consumes**:
- `PRESCRIPTION_CREATED` (from Encounter)
- `ENCOUNTER_CLOSED` (to validate prescriptions)

---

### MORTUARY RUNTIME

**Maturity**: ★☆☆☆☆ Planned

**Purpose**: Manage receiving of deceased patients, chain of custody, storage, and release workflows.

**Owns**:
- BodyRecord (deceased patient)
- BodyTimeline (audit trail)
- StorageAssignment (cold room location)
- ReleaseAuthorization

**Writes**:
- BodyRecord
- BodyTimeline
- StorageAssignment
- ReleaseAuthorization

**Reads**:
- Encounter (where death declared)
- Patient
- User (mortuary staff, authorized approvers)

**Publishes**:
- `BODY_RECEIVED`
- `IDENTITY_VERIFIED`
- `STORAGE_ASSIGNED`
- `RELEASE_AUTHORIZED`
- `BODY_RELEASED`
- `CHAIN_OF_CUSTODY_UPDATED`

**Consumes**:
- `ENCOUNTER_CLOSED` (to check if death occurred)
- `PATIENT_DECEASED` (trigger from clinical system)

---

### WORKFLOW & AUTOMATION RUNTIME

**Maturity**: ★☆☆☆☆ Planned (Platform Differentiator)

**Purpose**: Orchestrate multi-step business processes declaratively without code changes. This is the differentiator that allows hospitals to adapt processes without modifying application code.

**Owns**:
- WorkflowDefinition (DAG of steps)
- WorkflowExecution (instance of workflow)
- WorkflowStep (individual step record)

**Writes**:
- WorkflowDefinition
- WorkflowExecution
- WorkflowStep

**Reads**:
- (Consumes events; reads are side-effects)

**Publishes**:
- `WORKFLOW_STARTED`
- `WORKFLOW_STEP_EXECUTED`
- `WORKFLOW_COMPLETED`
- `WORKFLOW_FAILED`
- (Publishes arbitrary commands to other runtimes)

**Consumes**:
- (Any domain event can trigger workflows)

**Example Workflows**:
```
Appointment Confirmed
  ↓ (emit APPOINTMENT_CONFIRMED)
Workflow subscribes
  ↓
Step 1: Notify Patient (pub: SEND_SMS)
Step 2: Prepare Arrival QR (pub: GENERATE_QR)
Step 3: Reserve Doctor Slot (pub: HOLD_SLOT)
Step 4: Schedule Reminder 24h before (pub: SCHEDULE_JOB)
Step 5: Schedule Reminder 1h before (pub: SCHEDULE_JOB)
  ↓
Workflow completes (log: WORKFLOW_COMPLETED)
```

This allows hospitals to change reminders, add pre-visit questionnaires, or add insurance verification—all without touching code.

---

### INTEGRATION RUNTIME

**Maturity**: ★☆☆☆☆ Planned (New Addition)

**Purpose**: Manage all external system integrations. Internal runtimes publish events; Integration Runtime handles all communication with external systems (laboratories, insurers, pharmacies, medical devices, national registries).

**Owns**:
- ConnectorDefinition (how to talk to external system)
- IntegrationLog (audit trail)
- DataMapping (field transformations)
- Authentication (credentials for external systems)

**Writes**:
- IntegrationLog
- DataMapping

**Reads**:
- (Consumes events from all runtimes)

**Publishes**:
- `LAB_RESULT_IMPORTED`
- `INSURANCE_VERIFIED`
- `PAYMENT_PROCESSED`
- `EXTERNAL_SYSTEM_ERROR`
- `SYNC_COMPLETED`

**Consumes**:
- (Any domain event, as defined by connectors)

**Key Connector Types**:
- Laboratory networks (external labs send results)
- Insurance verification (check coverage before appointment)
- Pharmacy networks (sync prescriptions to retail pharmacies)
- Medical device data (pull vitals from connected devices)
- Government registries (national ID, medical license verification)
- Payment gateways (process copayments, insurance claims)

---

### NOTIFICATION RUNTIME

**Maturity**: ★★☆☆☆ Foundation Phase

**Purpose**: Central notification delivery. No module sends notifications directly; all go through this runtime.

**Owns**:
- Notification (sent message record)
- NotificationTemplate (message templates)
- NotificationPreference (user preferences)

**Writes**:
- Notification
- NotificationTemplate

**Reads**:
- User (delivery preferences)
- Patient (contact info)
- Notification history

**Publishes**:
- `NOTIFICATION_SENT`
- `NOTIFICATION_FAILED`
- `NOTIFICATION_DELIVERED`

**Consumes**:
- (Any runtime can emit: `REQUEST_SEND_SMS`, `REQUEST_SEND_EMAIL`, etc.)

**Delivery Channels**:
- SMS
- Email
- Push notification
- WhatsApp
- In-app message
- Voice call (future)

---

### IDENTITY RUNTIME

**Maturity**: ★★☆☆☆ Foundation Phase

**Purpose**: Centralized identity management for patients, staff, and external parties.

**Owns**:
- Patient (verified identity)
- ProviderIdentity (doctor, nurse, specialist)
- StaffIdentity (non-clinical staff)
- QRCode (identity reference)
- BiometricProfile (fingerprint, face, iris)

**Writes**:
- All identity records
- QRCode
- BiometricProfile

**Reads**:
- (All runtimes read identity data)

**Publishes**:
- `IDENTITY_VERIFIED`
- `IDENTITY_CREATED`
- `QR_GENERATED`

**Consumes**:
- (None; produces state independently)

**Capabilities**:
- Patient identity with QR code
- Provider identity and role
- National ID integration
- Passport integration
- Biometric matching (face, fingerprint, iris)
- Staff role-based permissions

---

### COMMAND CENTER RUNTIME

**Maturity**: ★☆☆☆☆ Planned

**Purpose**: Real-time hospital operations dashboard and AI-assisted management insights.

**Owns**:
- DashboardState (aggregated operational metrics)

**Writes**:
- DashboardState (updated from events)

**Reads**:
- (Consumes events from all runtimes)

**Publishes**:
- (Publishes UI updates via WebSocket)

**Consumes**:
- (All domain events from all runtimes)

**Real-Time Displays**:
- Waiting patients count by department
- Doctors on duty and availability
- Ambulances available and en route
- Beds available and occupied
- ICU capacity
- Operating theatres availability
- Pharmacy queue
- Laboratory turnaround
- Radiology backlog
- Emergency department status

**AI-Assisted Insights**:
- "ED will reach capacity in 37 minutes"
- "Recommend opening Room 5 and calling 2 additional nurses"
- "Lab has 45 pending results; recommend priority processing of critical tests"
- "Ambulance ETA: 8 minutes; ED bed assignment suggested"

---

## Runtime Folder Structure

Every runtime follows the same folder structure to ensure consistency.

```
encounter/
├── contracts/              # Input/output types
│   └── encounterTypes.js
├── policies/               # Business rule validation
│   ├── encounterPolicy.js
│   └── clinicalPolicy.js
├── runtime/                # Core state machine logic
│   ├── encounterRuntime.js
│   └── assessmentRunner.js
├── repositories/           # Data access layer
│   ├── encounterRepository.js
│   ├── assessmentRepository.js
│   └── noteRepository.js
├── workers/                # Background jobs
│   └── notificationWorker.js
├── events/                 # Event publishing
│   └── encounterEvents.js
├── models/                 # Mongoose schemas
│   ├── Encounter.js
│   ├── EncounterTimeline.js
│   ├── ClinicalAssessment.js
│   └── ClinicalNote.js
├── routes/                 # HTTP API endpoints
│   ├── encounterRoutes.js
│   └── assessmentRoutes.js
├── tests/                  # Integration tests
│   ├── encounter.test.js
│   ├── assessment.test.js
│   └── fixtures/
├── docs/                   # Runtime-specific documentation
│   ├── README.md
│   ├── state-machine.md
│   └── api.md
└── middleware/             # Auth, validation middleware
    └── encounterAuth.js
```

This structure is replicated for Appointment, Arrival, Logistics, Pharmacy, Mortuary, etc. Consistency means new team members immediately understand the codebase layout.

---

## Resource Provider Classification

All resources implement the same scheduling interface. This allows the Scheduling Runtime to be resource-agnostic.

### Human Resources

- **Doctor** — Consultation, diagnosis, treatment decisions
- **Nurse** — Care delivery, patient monitoring, medication administration
- **Driver** — Patient transport, specimen delivery, emergency response
- **EMT/Paramedic** — Pre-hospital care, stabilization, transport
- **Pharmacist** — Medication management, counseling, verification
- **Radiologist** — Imaging interpretation, reporting
- **Technologist** — Laboratory, imaging, equipment operation

### Physical Resources

- **Bed** — Patient accommodation (General, ICU, Maternity, etc.)
- **Consultation Room** — Outpatient encounter space
- **Operating Theatre** — Surgery facility
- **Ambulance** — Patient transport vehicle
- **Wheelchair** — Mobility assistance

### Equipment Resources

- **MRI** — Magnetic resonance imaging
- **CT Scanner** — Computed tomography
- **Ultrasound** — Real-time imaging
- **Ventilator** — Respiratory support
- **ECG Machine** — Cardiac monitoring
- **Dialysis Machine** — Renal replacement therapy
- **Laboratory Analyzer** — Automated test processing

### Digital Resources

- **Video Session** — Telemedicine consultation slot
- **AI Session** — AI-assisted consultation capacity
- **Interpreter Session** — Medical interpreter availability
- **Server/VM** — Computational capacity

### External Resources

- **Verified Pharmacy** — External dispensing network
- **Insurance Provider** — Coverage verification
- **Blood Bank** — Blood product availability
- **Government Registry** — ID verification, licensing
- **Diagnostic Facility** — External laboratory or imaging
- **Referral Hospital** — Tertiary care bed

Every resource type implements:
- `findAvailable(timeSlot, location, capabilities)` — Query availability
- `reserve(duration, requirements)` — Place hold
- `confirmReservation()` — Convert hold to confirmed
- `getCapacity()` — Max concurrent, max per day, min between, max duration
- `getWorkingHours(timezone)` — Availability schedule
- `getExceptions(startDate, endDate)` — Holidays, maintenance, leave
- `getStatus()` — Current state (AVAILABLE, BUSY, OFFLINE, MAINTENANCE)
- `supports(capability)` — Check if supports VIDEO, CHAT, VOICE, etc.

This abstraction is one of AfyaLink's core strengths: scheduling remains generic; resource providers encapsulate domain-specific behavior.

---

## Domain Events Catalog

All runtimes communicate via domain events. Consistency in naming prevents confusion.

### Event Naming Convention

- **`ENTITY_CREATED`** — New record created (e.g., `PATIENT_CREATED`, `APPOINTMENT_CREATED`)
- **`ENTITY_UPDATED`** — Record modified (e.g., `PATIENT_UPDATED`, `PRESCRIPTION_UPDATED`)
- **`ENTITY_DELETED`** — Record removed (e.g., `BODY_RELEASED` implies mortuary record completed)
- **`STATE_CHANGED`** — State transition (e.g., `APPOINTMENT_CONFIRMED`, `ARRIVAL_VERIFIED`)
- **`COMMAND`** — Request for action (e.g., `REQUEST_OPEN_ENCOUNTER`, `REQUEST_SEND_SMS`)
- **`NOTIFICATION`** — Alert to be delivered (e.g., `NOTIFY_PATIENT`, `NOTIFY_DOCTOR`)
- **`FAILURE`** — Something went wrong (e.g., `PRESCRIPTION_FAILED`, `APPOINTMENT_CONFLICT`)
- **`INTEGRATION`** — External system event (e.g., `LAB_RESULT_IMPORTED`, `PAYMENT_PROCESSED`)

### Scheduling Events

- `SLOT_GENERATED` — New slots created from template
- `SLOT_HELD` — Reservation placed; expires at timestamp
- `SLOT_RELEASED` — Hold cancelled or expired
- `SLOT_CONFIRMED` — Hold converted to appointment
- `SLOT_EXPIRED` — Expired hold automatically cleaned

### Appointment Events

- `APPOINTMENT_CONFIRMED` → Appointment moved to CONFIRMED state
- `APPOINTMENT_CHECKED_IN` → Appointment moved to CHECKED_IN state
- `APPOINTMENT_WAITING` → Appointment in queue
- `APPOINTMENT_READY` → Appointment ready for provider
- `APPOINTMENT_CANCELLED` → Appointment cancelled
- `APPOINTMENT_EXPIRED` → Appointment no longer available for check-in
- `APPOINTMENT_NO_SHOW` → Patient did not arrive
- `APPOINTMENT_RESCHEDULED` → Appointment moved to new time

### Arrival Events

- `PATIENT_ARRIVED` — Patient checked in (QR, walk-in, video join)
- `IDENTITY_VERIFIED` — Patient identity confirmed
- `PATIENT_WAITING` — Assigned queue position
- `PATIENT_CALLED` — Clinician ready; patient notified
- `PATIENT_READY` — Both parties ready for encounter
- `ARRIVAL_NO_SHOW` — Patient did not complete arrival steps
- `ARRIVAL_CANCELLED` — Arrival cancelled before encounter

### Encounter Events

- `ENCOUNTER_OPENED` — Clinical session started
- `ASSESSMENT_RECORDED` — Clinical assessment documented
- `DIAGNOSIS_RECORDED` → Clinical diagnosis recorded
- `ORDER_CREATED` — Lab/imaging/procedure order issued
- `PRESCRIPTION_CREATED` — Medication prescription issued
- `ENCOUNTER_SUSPENDED` → Encounter paused (e.g., awaiting test results)
- `ENCOUNTER_REFERRED` → Patient referred to specialist/higher level
- `ENCOUNTER_CLOSED` → Clinical session ended
- `ENCOUNTER_CANCELLED` → Clinical session cancelled

### Prescription Events

- `PRESCRIPTION_CREATED` — New prescription issued
- `PRESCRIPTION_VALIDATED` — Pharmacy validated prescription
- `DRUG_INTERACTION_ALERT` — Potential drug interaction detected
- `MEDICINE_DISPENSED` — Patient received medication
- `REFILL_NEEDED` — Time to refill prescription
- `PRESCRIPTION_EXPIRED` — Prescription no longer valid

### Logistics Events

- `MISSION_CREATED` — Transport mission requested
- `AMBULANCE_DISPATCHED` — Ambulance assigned and en route
- `PATIENT_EN_ROUTE` — Ambulance carrying patient
- `PATIENT_AT_HOSPITAL` — Patient arrived at destination
- `MISSION_COMPLETED` → Transport mission completed
- `ROUTE_OPTIMIZED` — New route calculated
- `DRIVER_ASSIGNED` — Driver assigned to mission
- `VEHICLE_MAINTENANCE_DUE` → Vehicle needs maintenance

### Notification Events

- `REQUEST_SEND_SMS` — Send SMS to phone number
- `REQUEST_SEND_EMAIL` — Send email
- `REQUEST_SEND_PUSH` — Send push notification
- `REQUEST_SEND_WHATSAPP` — Send WhatsApp message
- `NOTIFICATION_SENT` → Notification successfully sent
- `NOTIFICATION_FAILED` → Delivery failed
- `NOTIFICATION_DELIVERED` → Confirmed delivered to device

### Integration Events

- `LAB_RESULT_IMPORTED` — External lab result received
- `INSURANCE_VERIFIED` → Insurance coverage confirmed
- `PAYMENT_PROCESSED` → External payment completed
- `EXTERNAL_SYSTEM_ERROR` → Integration failed
- `SYNC_COMPLETED` → Data synchronization complete

---

## Ownership Boundaries

This table defines which runtime owns which data, and who can read/write/mutate.

| Data | Owner | Writes | Can Read | Cannot Write |
|------|-------|--------|----------|--------------|
| Slot | Scheduling | Scheduling | Appointment, Logistics | (any others) |
| SlotReservation | Scheduling | Scheduling | Appointment, Logistics | (any others) |
| Appointment | Appointment | Appointment | Arrival, Encounter, Billing, Logistics | Scheduling, any clinical |
| Arrival | Arrival | Arrival | Encounter, Clinician | Appointment, Scheduling |
| Encounter | Encounter | Encounter | Billing, Pharmacy, Lab, Radiology | Appointment, Arrival, Scheduling |
| ClinicalNote | Encounter | Encounter | Audit, Medical Records | (any others) |
| Prescription | Encounter | Encounter | Pharmacy, Billing | (any others) |
| Patient | Identity | Identity | All runtimes (read-only) | (only Identity) |
| Provider | Identity | Identity | All runtimes (read-only) | (only Identity) |
| BodyRecord | Mortuary | Mortuary | Audit, Medical Records | Encounter, Appointment |
| Mission | Logistics | Logistics | Command Center, Maps | Appointment, Scheduling |
| Ambulance | Logistics | Logistics | Command Center, Maps | (any others) |

**Key Rule**: One resource has exactly one owner. Other runtimes read and react; only owner mutates. This prevents conflicts and ensures clear accountability.

---

## Workspace Architecture

Instead of 60+ role-specific dashboards, use shared workspaces with role-based visibility.

| Workspace | Primary Roles | Key Features | Data Visible |
|-----------|---------------|--------------|--------------|
| **Clinical** | Doctor, Nurse, Specialist | Appointments, Patient profiles, Orders, Progress notes, Results | Own patients, Own department |
| **Emergency** | Ambulance driver, EMT, ED Coordinator, Triage nurse | Dispatch queue, ED waiting list, Triage board, Resources | Active missions, ED queue, Current status |
| **Diagnostics** | Lab technologist, Radiologist, Lab manager | Test orders, Results entry, DICOM viewer, Quality control | Department orders, Results to report |
| **Medication** | Pharmacist, Pharmacy manager, Inventory staff | Prescription queue, Stock levels, Drug interactions, Alerts | Department prescriptions, Stock |
| **Operations** | Bed manager, Theatre coordinator, Maintenance | Bed occupancy, Theatre schedule, Equipment status, Maintenance tickets | All beds/theatres, All equipment |
| **Administration** | HR manager, Finance manager, Hospital director | Staff records, Payroll, Budgets, Reports | Entire hospital data |
| **Logistics** | Driver, Fleet manager, Dispatcher | Active missions, Vehicle status, Route optimization, History | Assigned missions, Vehicle data |
| **Mortuary** | Mortuary officer, Supervisor, Pathologist | Bodies received, Storage occupancy, Release authorizations, Custody log | All deceased records, Storage map |
| **Command Center** | Hospital manager, Operations supervisor | Live hospital status, AI predictions, Resource allocation, Incident alerts | Real-time data from all runtimes |

Same codebase; permissions determine visible features.

---

## Technology Stack

- **Language**: Node.js (ESM modules)
- **Framework**: Express.js
- **Database**: MongoDB (transactional on replica set)
- **Time Handling**: Clock Service (Intl.DateTimeFormat; no external timezone libraries)
- **Testing**: Jest + supertest
- **Events**: EventEmitter (synchronous) + transactional outbox pattern (for durability)
- **Real-Time**: WebSocket (socket.io) for Command Center, Telemedicine signaling
- **API**: REST (current) → GraphQL (future)

---

## When Adding a New Runtime

Every new runtime must follow this checklist to ensure consistency.

1. **Define Contracts** — What data does this runtime accept/produce?
2. **Define Policies** — What business rules govern this domain?
3. **Define State Machine** — What are valid states and transitions? (VALID_TRANSITIONS object)
4. **Define Repositories** — How is data persisted?
5. **Define Events** — What events does it publish and consume? (Use naming convention)
6. **Implement ResourceProvider** (if managing resources) — Does it use Scheduling?
7. **Create Models** — Mongoose schemas with Timeline for audit trail
8. **Create Runtime** — Core business logic (never in controller)
9. **Create API Routes** — HTTP endpoints, role-based authorization
10. **Create Tests** — 100% coverage of state machine + edge cases
11. **Create Ownership Entry** — Add to ownership boundaries table
12. **Create Worker Jobs** — Background cleanup, expiration, notifications
13. **Create Documentation** — README, state machine diagram, API docs
14. **Update Blueprint** — Add runtime description with maturity level

---

## Blueprint Versioning

AfyaLink architecture will evolve over time. Blueprint versions mark major architectural phases.

### Blueprint v1 — Core Runtime Architecture
**Scope**: Scheduling, Appointment, Arrival, Encounter, Telemedicine, basic Platform runtimes  
**Focus**: Single hospital, single clinical pathway  
**Status**: IN PROGRESS  
**Target Completion**: Q3 2026  

### Blueprint v2 — Clinical Platform
**Scope**: Clinical layer complete (Orders, Pharmacy, Lab, Radiology, Blood Bank, ICU, Ward, Theatre)  
**Focus**: Multi-department hospital operations  
**Additions**: Workflow & Automation Runtime, Integration Runtime  
**Planned**: Q4 2026–Q1 2027  

### Blueprint v3 — Healthcare Network
**Scope**: Multi-hospital coordination, verified pharmacy networks, insurance integration, inter-hospital transfer  
**Focus**: Regional healthcare ecosystem  
**Additions**: Network coordination layer, federated identity  
**Planned**: Q2–Q3 2027  

### Blueprint v4 — AI Hospital Platform
**Scope**: Predictive analytics, clinical decision support, resource optimization, adaptive workflows  
**Focus**: AI-driven operations and clinical support  
**Additions**: Advanced analytics, ML-powered dispatch, clinical AI assistants  
**Planned**: Q4 2027+  

---

## Architectural Patterns

### Pattern 1: Runtime Ownership
One runtime owns one domain and its state machine. Other runtimes read and react; they never mutate another runtime's data.

**Benefit**: Clear accountability. If a bug occurs in Pharmacy data, you know Pharmacy Runtime is responsible.

### Pattern 2: Event-Driven Integration
Runtimes communicate via domain events published after transactional commit.

**Benefit**: Loose coupling. Runtimes don't need to know about each other's implementations. New runtimes can subscribe to existing events.

### Pattern 3: Immutable Audit Trails
Every state transition appends to a Timeline collection. No edits; only appends.

**Benefit**: Compliance, debugging, SLA reporting, audit trails. Never loses history.

### Pattern 4: Idempotent Mutations
All writes use unique keys (upsertOne). Retrying a request never causes inconsistency.

**Benefit**: Network failures, message replays, and duplicate events don't corrupt data.

### Pattern 5: ResourceProvider Abstraction
All resources (doctors, rooms, equipment, ambulances, beds) implement the same interface.

**Benefit**: Scheduling Runtime remains generic. New resource types require no scheduler changes.

### Pattern 6: Clock Service Centralization
All time operations go through Clock Service, not `new Date()`.

**Benefit**: Timezone-aware operations, deterministic testing, single source of truth.

### Pattern 7: Repository Pattern
Persistence is separated from business logic. Runtimes depend on repositories, not Mongoose models directly.

**Benefit**: Easy testing (mock repositories), easy to switch persistence layer.

### Pattern 8: Workflow Orchestration
Multi-step business processes are defined declaratively in Workflow Runtime, not hard-coded in controllers.

**Benefit**: Hospitals can adapt processes without code changes. New workflow steps can be added via configuration.

---

## Deployment Models

### Single Hospital
All runtimes in one deployment. Data isolated to one hospital.

### Multi-Hospital Network
- **Shared**: Identity, Notification, Analytics, Maps, Integration
- **Per-Hospital**: Scheduling, Appointment, Arrival, Encounter, all clinical runtimes
- **Federated**: Patient records marked by hospital; transfers between hospitals create new encounter

### Regional Network
- **Shared**: Identity (national registry), Notification, Maps, Integration, Analytics
- **By Region**: Scheduling, Appointment, Arrival, Encounter (with inter-hospital transfer protocol)
- **Verified External**: Pharmacy networks, diagnostic facilities, referral hospitals

---

## Conclusion

This Blueprint defines the architectural constitution of AfyaLink. Every runtime, workspace, event, and API must comply with these principles and patterns.

Consistency at every level—from naming conventions to folder structures to state machines—will allow AfyaLink to grow from a single-hospital system to a healthcare platform serving entire regions, all without losing architectural coherence.

The Platform Principles are non-negotiable. The layer structure keeps domains organized. The runtime specifications ensure consistency. The checklist prevents architectural drift.

With this Blueprint as the governing document, AfyaLink can scale across many hospitals, many departments, many specialized clinical domains—while remaining a coherent, maintainable platform.
