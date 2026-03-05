# AfyaLink Identity Separation Model (Media-Ready)

## 1) Hospital Entity
- Stores hospital identity, location, plan, limits, and admins.
- Keeps operational configuration (features, insurance/payment, customization).

## 2) User Entity
- Single identity record for every person.
- Role determines behavior:
  - Staff roles: hospital-scoped (must be linked to one hospital).
  - Patient/Guest roles: non-staff access.

## 3) Staff Authenticity Controls
- Hospital-scoped roles are blocked unless a hospital is linked.
- Staff onboarding is admin-driven (not self-registration).
- Staff role changes are audited with actor/tenant metadata.

## 4) Staff Exit Handling
- When a staff member is removed, they are demoted to `PATIENT`.
- Hospital linkage is removed.
- Employment state is marked inactive with separation metadata.

## 5) Cross-Hospital Staff Transfer
- Uses transfer workflow with transfer letter reference.
- Requires:
  - Source hospital approval
  - Destination hospital approval
- Completion automatically re-links staff to destination hospital.

## 6) Scale Assist Role
- `HOSPITAL_ADMIN_ASSISTANT` supports large hospitals in:
  - Staff registration
  - Staff management
  - Transfer operations
- Limits global privilege while reducing hospital admin workload.
