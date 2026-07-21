/**
 * backend/utils/serializers.js
 * Centralized serialization helpers for consistent ID exposure across API responses
 */

/**
 * Serialize a user document to include readable ID fields
 */
export function serializeUser(user) {
  if (!user) return null;
  const obj = user.toObject ? user.toObject() : user;
  return {
    _id: obj._id,
    userId: obj.userId,
    name: obj.name,
    email: obj.email,
    role: obj.role,
    active: obj.active,
    hospital: obj.hospital,
    hospitalId: obj.hospitalId,
    phone: obj.phone,
    nationalIdNumber: obj.nationalIdNumber,
    authMethods: obj.authMethods,
    authProvider: obj.authProvider,
    employment: obj.employment,
    preferences: obj.preferences,
    sessionSecurity: obj.sessionSecurity,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    // Include any other fields that are safe to expose
    ...obj,
  };
}

/**
 * Serialize a hospital document to include readable ID fields
 */
export function serializeHospital(hospital) {
  if (!hospital) return null;
  const obj = hospital.toObject ? hospital.toObject() : hospital;
  return {
    _id: obj._id,
    hospitalId: obj.hospitalId,
    name: obj.name,
    code: obj.code,
    registration: obj.registration,
    metadata: obj.metadata,
    status: obj.status,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    ...obj,
  };
}

/**
 * Serialize a pharmacy document to include readable ID fields
 */
export function serializePharmacy(pharmacy) {
  if (!pharmacy) return null;
  const obj = pharmacy.toObject ? pharmacy.toObject() : pharmacy;
  return {
    _id: obj._id,
    pharmacyId: obj.pharmacyId,
    name: obj.name,
    licenseNumber: obj.licenseNumber,
    status: obj.status,
    location: obj.location,
    contact: obj.contact,
    services: obj.services,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    ...obj,
  };
}

/**
 * Serialize a patient document to include readable ID fields
 */
export function serializePatient(patient) {
  if (!patient) return null;
  const obj = patient.toObject ? patient.toObject() : patient;
  return {
    _id: obj._id,
    patientId: obj.patientId,
    firstName: obj.firstName,
    lastName: obj.lastName,
    dob: obj.dob,
    gender: obj.gender,
    nationalId: obj.nationalId,
    contact: obj.contact,
    hospital: obj.hospital,
    hospitalId: obj.hospitalId,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    ...obj,
  };
}

/**
 * Serialize an appointment document to include readable ID fields
 */
export function serializeAppointment(appointment) {
  if (!appointment) return null;
  const obj = appointment.toObject ? appointment.toObject() : appointment;
  return {
    _id: obj._id,
    appointmentId: obj.appointmentId,
    patient: obj.patient,
    patientId: obj.patientId,
    doctor: obj.doctor,
    userId: obj.userId,
    hospital: obj.hospital,
    hospitalId: obj.hospitalId,
    appointmentType: obj.appointmentType,
    status: obj.status,
    startTime: obj.startTime,
    endTime: obj.endTime,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    ...obj,
  };
}

/**
 * Serialize an encounter document to include readable ID fields
 */
export function serializeEncounter(encounter) {
  if (!encounter) return null;
  const obj = encounter.toObject ? encounter.toObject() : encounter;
  return {
    _id: obj._id,
    encounterId: obj.encounterId,
    patient: obj.patient,
    patientId: obj.patientId,
    hospital: obj.hospital,
    hospitalId: obj.hospitalId,
    provider: obj.provider,
    userId: obj.userId,
    status: obj.status,
    type: obj.type,
    visitDate: obj.visitDate,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    ...obj,
  };
}

/**
 * Serialize a prescription document to include readable ID fields
 */
export function serializePrescription(prescription) {
  if (!prescription) return null;
  const obj = prescription.toObject ? prescription.toObject() : prescription;
  return {
    _id: obj._id,
    prescriptionId: obj.prescriptionId,
    patient: obj.patient,
    patientId: obj.patientId,
    provider: obj.provider,
    userId: obj.userId,
    hospital: obj.hospital,
    hospitalId: obj.hospitalId,
    medications: obj.medications,
    status: obj.status,
    issueDate: obj.issueDate,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    ...obj,
  };
}

/**
 * Serialize an invoice document to include readable ID fields
 */
export function serializeInvoice(invoice) {
  if (!invoice) return null;
  const obj = invoice.toObject ? invoice.toObject() : invoice;
  return {
    _id: obj._id,
    invoiceId: obj.invoiceId,
    patient: obj.patient,
    patientId: obj.patientId,
    hospital: obj.hospital,
    hospitalId: obj.hospitalId,
    total: obj.total,
    status: obj.status,
    issueDate: obj.issueDate,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    ...obj,
  };
}

/**
 * Serialize a laboratory order document to include readable ID fields
 */
export function serializeLaboratoryOrder(order) {
  if (!order) return null;
  const obj = order.toObject ? order.toObject() : order;
  return {
    _id: obj._id,
    laboratoryRequestId: obj.laboratoryRequestId,
    patient: obj.patient,
    patientId: obj.patientId,
    hospital: obj.hospital,
    hospitalId: obj.hospitalId,
    tests: obj.tests,
    status: obj.status,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    ...obj,
  };
}

/**
 * Serialize a radiology study document to include readable ID fields
 */
export function serializeRadiologyStudy(study) {
  if (!study) return null;
  const obj = study.toObject ? study.toObject() : study;
  return {
    _id: obj._id,
    radiologyRequestId: obj.radiologyRequestId,
    patient: obj.patient,
    patientId: obj.patientId,
    hospital: obj.hospital,
    hospitalId: obj.hospitalId,
    studyType: obj.studyType,
    status: obj.status,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    ...obj,
  };
}

/**
 * Serialize a claim document to include readable ID fields
 */
export function serializeClaim(claim) {
  if (!claim) return null;
  const obj = claim.toObject ? claim.toObject() : claim;
  return {
    _id: obj._id,
    claimId: obj.claimId,
    patient: obj.patient,
    patientId: obj.patientId,
    hospital: obj.hospital,
    hospitalId: obj.hospitalId,
    amount: obj.amount,
    status: obj.status,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    ...obj,
  };
}

/**
 * Serialize a referral document to include readable ID fields
 */
export function serializeReferral(referral) {
  if (!referral) return null;
  const obj = referral.toObject ? referral.toObject() : referral;
  return {
    _id: obj._id,
    referralId: obj.referralId,
    patient: obj.patient,
    patientId: obj.patientId,
    from: obj.from,
    to: obj.to,
    status: obj.status,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    ...obj,
  };
}
