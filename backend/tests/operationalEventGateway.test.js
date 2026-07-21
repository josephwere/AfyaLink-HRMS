import { describe, test, expect, beforeAll, afterAll } from "@jest/globals";
import setup from "./setupTestEnv.js";
import AuditLog from "../models/AuditLog.js";
import Notification from "../models/Notification.js";
import { emitOperationalEvent, subscribeOperationalEvent } from "../services/operationalEventGateway.js";
import { emitTelemedicineEvent } from "../services/telemedicineEventBridge.js";

let teardown;

beforeAll(async () => {
  teardown = await setup();
});

afterAll(async () => {
  if (teardown) await teardown();
});

describe("Operational event gateway", () => {
  test("fans out events to subscribers and persists audit plus notification records", async () => {
    const received = [];
    const unsubscribe = subscribeOperationalEvent("PATIENT_ADMITTED", (event) => received.push(event));

    try {
      const emitted = await emitOperationalEvent({
        type: "PATIENT_ADMITTED",
        source: "admissions-service",
        hospitalId: "hospital-001",
        actor: "doctor-123",
        entity: { type: "Patient", id: "patient-123" },
        correlationId: "corr-001",
        traceId: "trace-001",
        metadata: { lane: "admissions" },
        payload: {
          resourceId: "507f1f77bcf86cd799439011",
          patientId: "patient-123",
          notification: {
            title: "Patient admitted",
            body: "A new patient has been admitted.",
            category: "ADMISSIONS",
            meta: { patientId: "patient-123" },
          },
        },
      });

      expect(emitted.type).toBe("PATIENT_ADMITTED");
      expect(emitted.source).toBe("admissions-service");
      expect(emitted.hospitalId).toBe("hospital-001");
      expect(emitted.entity).toEqual({ type: "Patient", id: "patient-123" });
      expect(emitted.correlationId).toBe("corr-001");
      expect(emitted.traceId).toBe("trace-001");
      expect(emitted.metadata).toEqual({ lane: "admissions" });
      expect(received).toHaveLength(1);
      expect(received[0].payload.patientId).toBe("patient-123");

      const auditEntry = await AuditLog.findOne({ action: "PATIENT_ADMITTED" }).lean();
      expect(auditEntry).toBeTruthy();

      const notificationEntry = await Notification.findOne({ title: "Patient admitted" }).lean();
      expect(notificationEntry).toBeTruthy();
      expect(notificationEntry.category).toBe("ADMISSIONS");
    } finally {
      unsubscribe();
    }
  });

  test("orchestrates follow-on operational steps for admitted patients", async () => {
    const received = [];
    const unsubscribe = subscribeOperationalEvent("BED_ASSIGNED", (event) => received.push(event));

    try {
      await emitOperationalEvent({
        type: "PATIENT_ADMITTED",
        source: "admissions-service",
        hospitalId: "hospital-001",
        actor: "doctor-123",
        entity: { type: "Patient", id: "patient-123" },
        payload: {
          resourceId: "507f1f77bcf86cd799439011",
          patientId: "patient-123",
        },
      });

      expect(received).toHaveLength(1);
      expect(received[0].payload.patientId).toBe("patient-123");
      expect(received[0].payload.workflowStep).toBe("assign-bed");
    } finally {
      unsubscribe();
    }
  });

  test("bridges telemedicine activity into operational events", async () => {
    const received = [];
    const unsubscribe = subscribeOperationalEvent("VIDEO_CALL_REQUESTED", (event) => received.push(event));

    try {
      await emitTelemedicineEvent({
        type: "VIDEO_CALL_REQUESTED",
        hospitalId: "hospital-001",
        actor: "doctor-456",
        entity: { type: "Appointment", id: "appointment-789" },
        payload: {
          patientId: "patient-123",
          appointmentId: "appointment-789",
        },
      });

      expect(received).toHaveLength(1);
      expect(received[0].payload.patientId).toBe("patient-123");
      expect(received[0].payload.appointmentId).toBe("appointment-789");
    } finally {
      unsubscribe();
    }
  });
});
