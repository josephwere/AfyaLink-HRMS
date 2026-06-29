import { publishNeuroEdgeEvent, NEUROEDGE_EVENT_TYPES } from "./neuroedgeEventBus.js";

export function publishUserSignedIn(user) {
  return publishNeuroEdgeEvent(NEUROEDGE_EVENT_TYPES.USER_SIGNED_IN, { user });
}

export function publishUserSignedOut() {
  return publishNeuroEdgeEvent(NEUROEDGE_EVENT_TYPES.USER_SIGNED_OUT, {});
}

export function publishPatientSelected(patient) {
  return publishNeuroEdgeEvent(NEUROEDGE_EVENT_TYPES.PATIENT_SELECTED, { patient });
}

export function publishPatientUpdated(patient) {
  return publishNeuroEdgeEvent(NEUROEDGE_EVENT_TYPES.PATIENT_UPDATED, { patient });
}

export function publishAppointmentOpened(appointment) {
  return publishNeuroEdgeEvent(NEUROEDGE_EVENT_TYPES.APPOINTMENT_OPENED, { appointment });
}

export function publishAppointmentCompleted(appointment) {
  return publishNeuroEdgeEvent(NEUROEDGE_EVENT_TYPES.APPOINTMENT_COMPLETED, { appointment });
}

export function publishPrescriptionOpened(prescription) {
  return publishNeuroEdgeEvent(NEUROEDGE_EVENT_TYPES.PRESCRIPTION_OPENED, { prescription });
}

export function publishLabResultSelected(labResult) {
  return publishNeuroEdgeEvent(NEUROEDGE_EVENT_TYPES.LAB_RESULT_SELECTED, { labResult });
}

export function publishNoteEditingStarted(noteContext) {
  return publishNeuroEdgeEvent(NEUROEDGE_EVENT_TYPES.NOTE_EDITING_STARTED, { noteContext });
}

export function publishFormOpened(formName) {
  return publishNeuroEdgeEvent(NEUROEDGE_EVENT_TYPES.FORM_OPENED, { formName });
}

export function publishFieldFocused(fieldName) {
  return publishNeuroEdgeEvent(NEUROEDGE_EVENT_TYPES.FIELD_FOCUSED, { fieldName });
}

export function publishFieldChanged(completedFields, remainingFields) {
  return publishNeuroEdgeEvent(NEUROEDGE_EVENT_TYPES.FIELD_CHANGED, { completedFields, remainingFields });
}

export function publishFormSubmitted(formName, status = "submitted") {
  return publishNeuroEdgeEvent(NEUROEDGE_EVENT_TYPES.FORM_SUBMITTED, { formName, status });
}

export function publishHospitalChanged(hospitalId) {
  return publishNeuroEdgeEvent(NEUROEDGE_EVENT_TYPES.HOSPITAL_CHANGED, { hospitalId });
}

export function publishDepartmentChanged(department) {
  return publishNeuroEdgeEvent(NEUROEDGE_EVENT_TYPES.DEPARTMENT_CHANGED, { department });
}
