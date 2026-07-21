/**
 * backend/utils/exportBuilder.js
 * Build exportable data (CSV, JSON) with business IDs
 */

/**
 * Convert array of objects to CSV with business ID columns
 */
export function buildCSVWithBusinessIds(data, columns, businessIdFields = {}) {
  if (!data || data.length === 0) {
    return "No data to export";
  }

  // Build header row with business ID fields first
  const header = [];
  const businessIdCols = Object.keys(businessIdFields);
  
  businessIdCols.forEach((col) => {
    header.push(businessIdFields[col]);
  });

  columns.forEach((col) => {
    header.push(col.header || col);
  });

  const rows = [header.map(escapeCSV).join(",")];

  data.forEach((row) => {
    const csvRow = [];

    // Add business ID values
    businessIdCols.forEach((col) => {
      csvRow.push(escapeCSV(row[col] || ""));
    });

    // Add regular columns
    columns.forEach((col) => {
      const value = typeof col === "string" ? row[col] : row[col.field];
      csvRow.push(escapeCSV(value || ""));
    });

    rows.push(csvRow.join(","));
  });

  return rows.join("\n");
}

/**
 * Convert array of objects to JSON with business IDs highlighted
 */
export function buildJSONWithBusinessIds(data, businessIdFields = {}) {
  return data.map((item) => {
    const output = { ...item };

    // Ensure business ID fields are at the top level and visible
    Object.keys(businessIdFields).forEach((field) => {
      if (item[field]) {
        output[businessIdFields[field]] = item[field];
      }
    });

    return output;
  });
}

/**
 * Build table data for dashboards with business ID columns
 */
export function buildDashboardTableWithIds(data, columns, businessIdField) {
  return data.map((row) => {
    const result = {};

    // Add business ID first
    if (businessIdField && row[businessIdField]) {
      result["ID"] = row[businessIdField];
    }

    // Add other columns
    columns.forEach((col) => {
      const field = typeof col === "string" ? col : col.field;
      const label = typeof col === "string" ? col : col.label;
      result[label || field] = row[field];
    });

    return result;
  });
}

/**
 * Build PDF content sections with business IDs
 */
export function buildPDFSectionWithIds(entity, entityType, fields = []) {
  const sections = [];

  // Add business ID header
  const businessIdMap = {
    user: { id: "userId", label: "User ID" },
    patient: { id: "patientId", label: "Patient ID" },
    hospital: { id: "hospitalId", label: "Hospital ID" },
    pharmacy: { id: "pharmacyId", label: "Pharmacy ID" },
    appointment: { id: "appointmentId", label: "Appointment ID" },
    encounter: { id: "encounterId", label: "Encounter ID" },
    prescription: { id: "prescriptionId", label: "Prescription ID" },
    invoice: { id: "invoiceId", label: "Invoice ID" },
    laboratory: { id: "laboratoryRequestId", label: "Lab Request ID" },
    radiology: { id: "radiologyRequestId", label: "Radiology Request ID" },
    claim: { id: "claimId", label: "Claim ID" },
  };

  const idConfig = businessIdMap[entityType];
  if (idConfig && entity[idConfig.id]) {
    sections.push({
      type: "businessId",
      label: idConfig.label,
      value: entity[idConfig.id],
    });
  }

  // Add requested fields
  fields.forEach((field) => {
    const value = entity[field.name];
    if (value !== undefined && value !== null) {
      sections.push({
        type: "field",
        label: field.label || field.name,
        value:
          typeof value === "object"
            ? JSON.stringify(value)
            : String(value),
      });
    }
  });

  return sections;
}

/**
 * Escape CSV values to prevent injection and handle special characters
 */
function escapeCSV(value) {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

/**
 * Build appointment export data with all business IDs
 */
export function buildAppointmentExport(appointments) {
  return appointments.map((apt) => ({
    appointmentId: apt.appointmentId,
    patientId: apt.patientId,
    doctorId: apt.userId,
    hospitalId: apt.hospitalId,
    status: apt.status,
    startTime: apt.startTime,
    endTime: apt.endTime,
    type: apt.appointmentType,
    createdAt: apt.createdAt,
  }));
}

/**
 * Build patient export data with business IDs
 */
export function buildPatientExport(patients) {
  return patients.map((patient) => ({
    patientId: patient.patientId,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dob: patient.dob,
    gender: patient.gender,
    nationalId: patient.nationalId,
    hospitalId: patient.hospitalId,
    contact: patient.contact,
    createdAt: patient.createdAt,
  }));
}

/**
 * Build invoice export data with business IDs
 */
export function buildInvoiceExport(invoices) {
  return invoices.map((inv) => ({
    invoiceId: inv.invoiceId,
    patientId: inv.patientId,
    hospitalId: inv.hospitalId,
    total: inv.total,
    status: inv.status,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    createdAt: inv.createdAt,
  }));
}
