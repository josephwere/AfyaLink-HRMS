# Global Claims Fraud Guard — AfyaLink Architecture

This document defines the **production-ready, global fraud-prevention system** implemented in AfyaLink. It is designed for **national health funds, insurers, and regulators** and is compatible across countries, currencies, and regulatory rules.

---

## 1) Core Goals

- **Stop fake claims**: reject impossible or duplicated claims before payment.
- **Verify identity**: prevent ghost patients and duplicate profiles.
- **Verify hospitals**: only accredited hospitals can submit claims.
- **Immutable audit trail**: every claim action is traceable.
- **Government dashboard**: real-time monitoring and decision workflows.
- **Global adaptability**: country-specific limits, currencies, and fund rules.

---

## 2) Data Model (Live in Code)

### 2.1 Claim (`backend/models/Claim.js`)
Represents a submitted insurance claim.

Key fields:
- `hospital`, `patient`, `provider`, `country`, `currency`, `totalAmount`
- `servicePeriod.start`, `servicePeriod.end`
- `procedures[]` with `code`, `name`, `quantity`, `amount`, `performedAt`
- `status`: `SUBMITTED | REVIEW_REQUIRED | APPROVED | REJECTED | PAID | VOID`
- `riskScore`, `riskFlags[]`, `riskSignals[]`
- `duplicateOf`, `duplicateGroup`
- `signature` (HMAC-based, immutable)
- `patientSnapshot` (immutable identity at submission)
- `hospitalSnapshot` (immutable verification at submission)
- `decision.reviewedBy`, `decision.reviewedAt`, `decision.notes`
- `metadata` (extra compliance payloads)

### 2.2 Fraud Alerts (`backend/models/FraudAlert.js`)
Flags suspicious claims.

Key fields:
- `claim`, `hospital`, `patient`
- `severity`: `LOW | MEDIUM | HIGH`
- `signals[]` (fraud rules triggered)
- `status`: `OPEN | REVIEWING | RESOLVED | DISMISSED`
- `notes`, `resolvedBy`, `resolvedAt`

### 2.3 Claim Audit Logs (`backend/models/ClaimAuditLog.js`)
Immutable audit trail for all claim actions.

Key fields:
- `claim`
- `sequence` (monotonic)
- `event` (e.g. `CLAIM_SUBMITTED`, `CLAIM_REVIEWED`)
- `payload` (immutable snapshot)
- `actor`, `createdAt`

### 2.4 Patient Identity Registry (`backend/models/PatientIdentityRegistry.js`)
Global patient registry (national ID / health ID / biometrics).

Key fields:
- `country`, `nationalId`, `healthId`, `biometricId`
- `status`: `VERIFIED | UNVERIFIED | BLOCKED`
- `attributes` (DOB, gender, etc.)

### 2.5 Claim Rules (`backend/models/ClaimRule.js`)
Country and fund specific fraud rules.

Key fields:
- `country`, `provider`, `ruleType`, `procedureCode`
- `maxPerYear`, `minAge`, `maxAge`, `gender`
- `cooldownDays`, `enabled`, `severity`

---

## 3) Claim Submission Pipeline (Production Flow)

### 3.1 Hospital Verification & Signature
Only verified hospitals can submit:

- Hospital must be **Government-verified** (`Hospital.verification.status === VERIFIED`).
- Hospital must have **claim signature keys** provisioned:
  - `Hospital.claimsSecurity.hmacSecretEnc`
  - `CLAIM_SECRET_KEY` (server master key)

Claims submitted without valid signature are rejected.

### 3.2 Submission (API)
Endpoint:
```
POST /api/claims
```

Pipeline:
1. Validate hospital + patient linkage.
2. Verify request signature.
3. Normalize service period, validate request fields.
4. Evaluate fraud engine.
5. Persist Claim, FraudAlert, and ClaimAuditLog.

---

## 4) Fraud Prevention Rules (Global, Configurable)

The rules engine (`backend/services/claimFraudEngine.js`) applies **deterministic, global policies** plus **country-specific rules**.

### 4.1 Mandatory Global Rules
- **Hospital Verification Rule**
  - Reject if hospital is not verified or not authorized to submit claims.
- **Patient Identity Rule**
  - Reject if patient is not in national registry or is blocked.
- **Duplicate Claim Rule**
  - Reject or flag if same patient + procedure + time is repeated.
- **Procedure Frequency Rule**
  - Example: open-heart surgery max 1/year.
- **Biological / Age / Gender Rule**
  - Example: maternity claims only for female.
- **Time Feasibility Rule**
  - Prevent impossible timing sequences.

### 4.2 Country-Specific Rule Examples (via ClaimRule)
Examples:
- Kenya SHA: `OPEN_HEART` max `1` per `365` days.
- Global maternity: `DELIVERY` min `240` days between births.
- Dialysis: no more than `3` per week.

Rules are stored per country + provider and evaluated dynamically.

---

## 5) Fraud Scoring (AI + Heuristics)

Risk score is computed per claim:

- **Base risk** from rule violations.
- **Outlier detection**: abnormal volume per hospital or patient.
- **Duplicate detection** across hospitals and countries.
- **Historical pattern risk** by provider and facility.

Risk score is 0–100.
- `>= 70` → `REVIEW_REQUIRED`
- `>= 90` → `REJECTED`

Fraud alerts are created when any rule triggers.

---

## 6) Immutable Audit Trail

Every claim action produces an immutable audit record.

Examples:
```
CLAIM_SUBMITTED
CLAIM_REVIEWED
CLAIM_VERIFICATION_REQUESTED
CLAIM_REJECTED
```

Auditors can export these logs for legal or regulatory action.

---

## 7) Government Dashboard (Integrated)

### 7.1 Endpoint: Overview
```
GET /api/claims/government/overview
```

Returns:
- Summary totals (approved/rejected/pending)
- Suspicious claims list
- Hospital monitoring metrics
- Country/fund summaries
- Trend timeline for the last 30 days (default)

### 7.2 Endpoint: Patient History
```
GET /api/claims/government/patient-history?q={id}
```

Returns:
- Patient identity details
- All claims across hospitals
- Fraud alerts tied to that patient

### 7.3 Workflow Actions
```
POST /api/claims/:id/review
POST /api/claims/:id/request-verification
```

Each action is audited and updates FraudAlert status.

---

## 8) Pseudocode (Executable Logic)

### 8.1 Claim Submission
```
function submitClaim(req):
    hospital = verifyHospital(req.hospitalId)
    patient = verifyPatient(req.patientId)

    if hospital.requiresSignature:
        assert verifySignature(req)

    claim = buildClaim(req, hospital, patient)
    evaluation = evaluateClaim(claim, hospital, patient)

    claim.riskScore = evaluation.score
    claim.status = evaluation.statusOverride
    saveClaim(claim)

    if evaluation.signals.length > 0:
        createFraudAlert(claim, evaluation.signals)

    appendAudit(claim, "CLAIM_SUBMITTED")
    return claim
```

### 8.2 Fraud Evaluation
```
function evaluateClaim(claim, hospital, patient):
    signals = []

    if hospital.notVerified:
        signals.add(HOSPITAL_NOT_VERIFIED, HIGH)
    if patient.notInRegistry:
        signals.add(PATIENT_NOT_VERIFIED, HIGH)

    if duplicateClaimExists(claim):
        signals.add(DUPLICATE_CLAIM, HIGH)

    if violatesProcedureFrequency(claim):
        signals.add(PROCEDURE_FREQUENCY, HIGH)

    if violatesAgeGenderRules(claim):
        signals.add(BIOLOGICAL_IMPOSSIBILITY, HIGH)

    riskScore = score(signals)

    if riskScore >= 90: status = REJECTED
    else if riskScore >= 70: status = REVIEW_REQUIRED
    else status = SUBMITTED

    return { signals, riskScore, status }
```

---

## 9) Global Adaptability

AfyaLink supports:
- **Multiple countries & funds**
- **Multiple currencies**
- **Local rules per country**
- **Provider-specific overrides**

This is done via:
- `ClaimRule` (global config)
- `PatientIdentityRegistry` (national identity)
- `Hospital.verification` (authorized facilities)

---

## 10) Compliance & Security

- Immutable audit logs
- Digital signatures for every claim
- Role-based access to dashboard
- Exportable reports for prosecution

---

## Final Outcome

AfyaLink is now:
- **Fraud-proof at global scale**
- **Compliant with national health fund rules**
- **Ready for government rollout**
- **Verifiable, auditable, and resistant to fake claims**

