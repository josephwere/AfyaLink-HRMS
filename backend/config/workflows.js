// backend/config/workflows.js

/**
 * All possible workflow states
 */
export const WORKFLOW_STATES = {
  CONSULTATION: "CONSULTATION",
  LAB_ORDERED: "LAB_ORDERED",
  LAB_COMPLETED: "LAB_COMPLETED",
  PRESCRIPTION_CREATED: "PRESCRIPTION_CREATED",
  DISPENSED: "DISPENSED",
  BILLED: "BILLED",
  PAID: "PAID",

  // SHA / Admin states
  SHA_PENDING: "SHA_PENDING",
  SHA_APPROVED: "SHA_APPROVED",
  SHA_REJECTED: "SHA_REJECTED",
  ADMIN_OVERRIDE_APPROVE: "ADMIN_OVERRIDE_APPROVE",
  ADMIN_OVERRIDE_REJECT: "ADMIN_OVERRIDE_REJECT",
};

/**
 * Clinical workflow transitions (patient care lifecycle)
 */
export const CLINICAL_WORKFLOW_TRANSITIONS = {
  CONSULTATION: ["LAB_ORDERED", "PRESCRIPTION_CREATED"],
  LAB_ORDERED: ["LAB_COMPLETED"],
  LAB_COMPLETED: ["PRESCRIPTION_CREATED"],
  PRESCRIPTION_CREATED: ["DISPENSED"],
  DISPENSED: ["BILLED"],
  BILLED: ["PAID"],
};

/**
 * Administrative / Insurance (SHA) transitions
 */
export const ADMIN_WORKFLOW_TRANSITIONS = {
  SHA_PENDING: ["SHA_APPROVED", "SHA_REJECTED"],

  // Admin override allowed from any state
  "*": ["ADMIN_OVERRIDE_APPROVE", "ADMIN_OVERRIDE_REJECT"],
};

/**
 * ✅ ENGINE-COMPATIBLE EXPORT
 * This is what workflowEngine imports
 */
export const WORKFLOW_TRANSITIONS = {
  ...CLINICAL_WORKFLOW_TRANSITIONS,
  ...ADMIN_WORKFLOW_TRANSITIONS,
};

/**
 * ✅ Default export (safe for future imports)
 */
export default WORKFLOW_TRANSITIONS;
