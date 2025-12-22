export const WORKFLOW_SLA = {
  LAB_ORDERED: {
    maxMinutes: 60,
    alert: "LAB_DELAY",
  },
  PRESCRIPTION_CREATED: {
    maxMinutes: 45,
    alert: "PHARMACY_DELAY",
  },
  DISPENSED: {
    maxMinutes: 30,
    alert: "PAYMENT_DELAY",
  },
};
