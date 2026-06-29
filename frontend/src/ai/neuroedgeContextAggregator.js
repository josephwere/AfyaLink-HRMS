export function createInitialNeuroEdgeContextSnapshot() {
  return {
    currentWorkspace: {
      module: "Workspace",
      page: "Home",
      workflow: "General assistance",
      hospitalId: null,
      department: null,
      currentTask: "",
      taskContext: "",
    },
    patient: null,
    appointment: null,
    form: {
      name: "",
      focusedField: "",
      completedFields: 0,
      remainingFields: 0,
      status: "",
    },
    selection: "",
    ui: {
      activeElement: "",
      openDialog: "",
      selectedText: "",
    },
    actor: {
      role: "User",
      permissions: [],
    },
    lastEventAt: null,
  };
}

export function aggregateNeuroEdgeEvent(snapshot = createInitialNeuroEdgeContextSnapshot(), event = {}) {
  const type = event?.type || "";
  const detail = event?.detail || {};
  const next = {
    ...snapshot,
    lastEventAt: event?.timestamp || Date.now(),
  };

  switch (type) {
    case "PAGE_OPENED":
      next.currentWorkspace = {
        ...next.currentWorkspace,
        page: detail.pathname || detail.page || next.currentWorkspace.page,
        module: detail.module || next.currentWorkspace.module,
      };
      break;
    case "USER_SIGNED_IN":
      next.actor = {
        ...next.actor,
        role: detail.user?.role || next.actor.role,
      };
      break;
    case "USER_SIGNED_OUT":
      next.actor = {
        role: "Guest",
        permissions: [],
      };
      next.currentWorkspace = {
        ...next.currentWorkspace,
        module: "Workspace",
        workflow: "General assistance",
        currentTask: "",
      };
      break;
    case "PATIENT_SELECTED":
      next.patient = detail.patient || next.patient;
      next.currentWorkspace = {
        ...next.currentWorkspace,
        module: "Clinical",
        currentTask: next.currentWorkspace.currentTask || "Review patient record",
      };
      break;
    case "PATIENT_UPDATED":
      next.patient = {
        ...next.patient,
        ...detail.patient,
      };
      break;
    case "APPOINTMENT_OPENED":
      next.appointment = detail.appointment || next.appointment;
      next.currentWorkspace = {
        ...next.currentWorkspace,
        module: "Scheduling",
        workflow: "Appointment review",
        currentTask: detail.appointment?.type ? `Review ${detail.appointment.type}` : "Review appointment",
      };
      break;
    case "APPOINTMENT_COMPLETED":
      next.appointment = {
        ...next.appointment,
        ...detail.appointment,
        status: detail.appointment?.status || "COMPLETED",
      };
      next.currentWorkspace = {
        ...next.currentWorkspace,
        currentTask: "Follow up on completed appointment",
      };
      break;
    case "PRESCRIPTION_OPENED":
      next.currentWorkspace = {
        ...next.currentWorkspace,
        module: "Clinical",
        currentTask: "Review prescription",
      };
      break;
    case "LAB_RESULT_SELECTED":
      next.currentWorkspace = {
        ...next.currentWorkspace,
        module: "Clinical",
        currentTask: "Review lab result",
      };
      break;
    case "NOTE_EDITING_STARTED":
      next.currentWorkspace = {
        ...next.currentWorkspace,
        module: "Clinical",
        currentTask: "Write consultation notes",
      };
      break;
    case "FORM_OPENED":
      next.form = {
        ...next.form,
        name: detail.formName || next.form.name,
        status: "in-progress",
      };
      next.currentWorkspace = {
        ...next.currentWorkspace,
        currentTask: detail.formName ? `Filling ${detail.formName}` : next.currentWorkspace.currentTask,
      };
      break;
    case "FIELD_FOCUSED":
      next.form = {
        ...next.form,
        focusedField: detail.fieldName || next.form.focusedField,
      };
      break;
    case "FIELD_CHANGED":
      next.form = {
        ...next.form,
        completedFields: Number.isFinite(detail.completedFields)
          ? detail.completedFields
          : next.form.completedFields,
        remainingFields: Number.isFinite(detail.remainingFields)
          ? detail.remainingFields
          : next.form.remainingFields,
      };
      break;
    case "FORM_SUBMITTED":
      next.form = {
        ...next.form,
        status: detail.status || "submitted",
      };
      next.currentWorkspace = {
        ...next.currentWorkspace,
        currentTask: detail.formName ? `Submitted ${detail.formName}` : "Form submitted",
      };
      break;
    case "HOSPITAL_CHANGED":
      next.currentWorkspace = {
        ...next.currentWorkspace,
        hospitalId: detail.hospitalId || next.currentWorkspace.hospitalId,
      };
      break;
    case "DEPARTMENT_CHANGED":
      next.currentWorkspace = {
        ...next.currentWorkspace,
        department: detail.department || next.currentWorkspace.department,
      };
      break;
    case "ROLE_CHANGED":
      next.actor = {
        ...next.actor,
        role: detail.role || next.actor.role,
      };
      break;
    default:
      break;
  }

  return next;
}
