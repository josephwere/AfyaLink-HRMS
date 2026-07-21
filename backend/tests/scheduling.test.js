/**
 * Integration Tests: Scheduling Runtime
 *
 * Tests the complete flow from template creation → slot generation → booking → check-in
 * Covers:
 * - Schedule template CRUD
 * - Slot generation with idempotency
 * - Booking with policy validation
 * - Appointment lifecycle transitions
 * - Timeline recording
 * - Event emission
 * - Reservation expiration
 * - Error handling
 */

import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import setup from "./setupTestEnv.js";
import ScheduleTemplate from "../models/ScheduleTemplate.js";
import AppointmentType from "../models/AppointmentType.js";
import Appointment from "../models/Appointment.js";
import AppointmentTimeline from "../models/AppointmentTimeline.js";
import SlotReservation from "../models/SlotReservation.js";
import Slot from "../models/Slot.js";
import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import Patient from "../models/Patient.js";
import { slotGenerator } from "../scheduling/runtime/slotGenerator.js";
import { appointmentRuntime } from "../scheduling/runtime/appointmentRuntime.js";
import { schedulingPolicyEngine } from "../scheduling/policies/schedulingPolicyEngine.js";
import { clockService } from "../services/clockService.js";

describe("Scheduling Runtime - Integration Tests", () => {
  let _teardown;
  beforeAll(async () => {
    // Ensure test MongoDB is initialized when this file runs standalone
    _teardown = await setup();
  });

  let hospital;
  let doctor;
  let patient;
  let appointmentType;
  let scheduleTemplate;

  beforeAll(async () => {
    // Setup test data
    hospital = await Hospital.create({
      name: "Test Hospital",
      email: "test@hospital.com",
      phone: "+1234567890",
    });

    doctor = await User.create({
      firstName: "Dr.",
      lastName: "Smith",
      name: "Dr. Smith",
      email: "dr.smith@hospital.com",
      password: "hashed_password",
      role: "DOCTOR",
      hospital: hospital._id,
      active: true,
      employment: { status: "ACTIVE", department: "General Practice" },
    });

    patient = await Patient.create({
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      phone: "+1234567890",
      hospital: hospital._id,
      active: true,
    });

    appointmentType = await AppointmentType.create({
      name: "General Consultation",
      hospital: hospital._id,
      durationMins: 30,
      preBufferMins: 5,
      postBufferMins: 10,
      supportedModes: ["IN_PERSON", "VOICE", "VIDEO"],
      defaultMode: "IN_PERSON",
      minBookingHoursAdvance: 1,
      maxBookingHoursAdvance: 30 * 24, // 30 days
      allowedDaysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
      requiresApproval: false,
      requiresReferral: false,
      requiresPrepayment: false,
      billingCode: "GP001",
      active: true,
    });

    scheduleTemplate = await ScheduleTemplate.create({
      name: "Dr. Smith - Weekly",
      doctor: doctor._id,
      hospital: hospital._id,
      daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
      blocks: [
        {
          startTime: "09:00",
          endTime: "12:00",
          durationMins: 30,
          maxAppointments: 6,
          modes: { inPerson: true, chat: false, voice: false, video: false },
        },
        {
          startTime: "14:00",
          endTime: "17:00",
          durationMins: 30,
          maxAppointments: 6,
          modes: { inPerson: true, chat: false, voice: false, video: false },
        },
      ],
      active: true,
    });
  });

  afterAll(async () => {
    // Cleanup
    await Hospital.deleteMany({});
    await User.deleteMany({});
    await Patient.deleteMany({});
    await AppointmentType.deleteMany({});
    await ScheduleTemplate.deleteMany({});
    await Appointment.deleteMany({});
    await AppointmentTimeline.deleteMany({});
    await Slot.deleteMany({});
    await SlotReservation.deleteMany({});
    if (typeof _teardown === "function") await _teardown();
  });

  /* ========== SLOT GENERATION TESTS ========== */

  describe("Slot Generation", () => {
    function computeExpectedSlotsForRange(startDate, endDate, blocks, appointmentType) {
      let current = new Date(startDate);
      let total = 0;
      const totalSlotMins = (appointmentType.preBufferMins || 0) + appointmentType.durationMins + (appointmentType.postBufferMins || 0);
      while (current <= endDate) {
        for (const block of blocks) {
          const [sh, sm] = String(block.startTime || '00:00').split(':').map(Number);
          const [eh, em] = String(block.endTime || '00:00').split(':').map(Number);
          const start = new Date(current);
          start.setHours(sh, sm, 0, 0);
          const end = new Date(current);
          end.setHours(eh, em, 0, 0);
          const minutes = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
          total += Math.floor(minutes / totalSlotMins);
        }
        current.setUTCDate(current.getUTCDate() + 1);
      }
      return total;
    }

    it("should generate slots for a date range", async () => {
      const startDate = new Date("2024-01-15");
      const endDate = new Date("2024-01-19");

      const result = await slotGenerator.generateSlotsForDateRange(
        doctor._id,
        hospital._id,
        appointmentType._id,
        startDate,
        endDate
      );

      const expected = computeExpectedSlotsForRange(startDate, endDate, scheduleTemplate.blocks, appointmentType);

      expect(result.success).toBe(true);
      expect(result.slotsGenerated).toBe(expected);
    });

    it("should be idempotent: regenerating creates no duplicates", async () => {
      const startDate = new Date("2024-01-22");
      const endDate = new Date("2024-01-26");

      const result1 = await slotGenerator.generateSlotsForDateRange(
        doctor._id,
        hospital._id,
        appointmentType._id,
        startDate,
        endDate
      );

      const result2 = await slotGenerator.generateSlotsForDateRange(
        doctor._id,
        hospital._id,
        appointmentType._id,
        startDate,
        endDate
      );

      const expected1 = computeExpectedSlotsForRange(startDate, endDate, scheduleTemplate.blocks, appointmentType);
      expect(result1.slotsGenerated).toBe(expected1);
      expect(result2.slotsDuplicated).toBe(expected1);
      expect(result2.slotsGenerated).toBe(0);
    });

    it("should get available slots for a specific date", async () => {
      const date = new Date("2024-01-15");
      const slots = await slotGenerator.getAvailableSlots(doctor._id, date);

      expect(Array.isArray(slots)).toBe(true);
      const expectedDay = computeExpectedSlotsForRange(date, date, scheduleTemplate.blocks, appointmentType);
      expect(slots.length).toBe(expectedDay);
      expect(slots[0].status).toBe("AVAILABLE");
    });

    it("should filter slots by consultation mode", async () => {
      const date = new Date("2024-01-15");
      const slots = await slotGenerator.getAvailableSlots(doctor._id, date, "IN_PERSON");
      expect(slots.length).toBeGreaterThan(0);
      expect(slots.every((s) => s.consultationModes.includes("IN_PERSON"))).toBe(true);
    });
  });

  /* ========== POLICY ENGINE TESTS ========== */

  describe("Scheduling Policy Engine", () => {
    it("should validate patient eligibility", async () => {
      const result = await schedulingPolicyEngine.canPatientBook(
        patient._id,
        appointmentType._id,
        hospital._id
      );

      expect(result.allowed).toBe(true);
    });

    it("should validate doctor qualification", async () => {
      const result = await schedulingPolicyEngine.canDoctorProvideService(
        doctor._id,
        appointmentType._id,
        hospital._id
      );

      expect(result.allowed).toBe(true);
    });

    it("should validate booking window", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const result = await schedulingPolicyEngine.validateBookingWindow(
        appointmentType._id,
        futureDate
      );

      expect(result.valid).toBe(true);
    });

    it("should reject booking too soon", async () => {
      const tooSoon = new Date();
      tooSoon.setMinutes(tooSoon.getMinutes() + 15);

      const result = await schedulingPolicyEngine.validateBookingWindow(
        appointmentType._id,
        tooSoon
      );

      expect(result.valid).toBe(false);
      expect(result.code).toBe("BOOKING_TOO_SOON");
    });

    it("should validate mode support", async () => {
      const result = await schedulingPolicyEngine.isModeSupported(
        appointmentType._id,
        "IN_PERSON"
      );

      expect(result.supported).toBe(true);
    });

    it("should enforce daily booking limit", async () => {
      const date = new Date("2024-01-15");
      const dayStart = clockService.startOfDayInTimezone(date, "UTC");
      const dayEnd = clockService.endOfDayInTimezone(date, "UTC");

      // Create one appointment for the patient on this day (via workflow-safe save)
      const apptDoc = new Appointment({
        patient: patient._id,
        doctor: doctor._id,
        hospital: hospital._id,
        scheduledAt: dayStart,
        durationMins: 30,
        consultationMode: "IN_PERSON",
        status: "CONFIRMED",
        createdBy: doctor._id,
      });
      apptDoc.$locals = { ...(apptDoc.$locals || {}), viaWorkflow: true };
      await apptDoc.save();

      const result = await schedulingPolicyEngine.checkPatientDailyLimit(
        patient._id,
        date
      );

      expect(result.allowed).toBe(false);
      expect(result.code).toBe("PATIENT_DAILY_LIMIT_REACHED");
    });
  });

  /* ========== APPOINTMENT RUNTIME TESTS ========== */

  describe("Appointment Runtime - State Transitions", () => {
    let appointment;

    beforeAll(async () => {
      // Create an appointment in CREATED state (workflow-safe)
      const appt = new Appointment({
        patient: patient._id,
        doctor: doctor._id,
        hospital: hospital._id,
        scheduledAt: new Date("2024-01-29T10:00:00Z"),
        durationMins: 30,
        consultationMode: "IN_PERSON",
        status: "CREATED",
        createdBy: doctor._id,
      });
      appt.$locals = { ...(appt.$locals || {}), viaWorkflow: true };
      appointment = await appt.save();
    });

    it("should confirm appointment (CREATED → CONFIRMED)", async () => {
      const updated = await appointmentRuntime.confirmAppointment(
        appointment._id,
        doctor._id,
        { timezone: "UTC" }
      );

      expect(updated.status).toBe("CONFIRMED");
      expect(updated.confirmedAt).toBeDefined();
      expect(updated.confirmedBy).toEqual(doctor._id);
    });

    it("should check in patient (CONFIRMED → CHECKED_IN)", async () => {
      const updated = await appointmentRuntime.checkIn(appointment._id, doctor._id, {
        timezone: "UTC",
      });

      expect(updated.status).toBe("CHECKED_IN");
      expect(updated.checkedInAt).toBeDefined();
      expect(updated.minutesLate).toBeGreaterThanOrEqual(0);
    });

    it("should move to waiting (CHECKED_IN → WAITING)", async () => {
      const updated = await appointmentRuntime.moveToWaiting(appointment._id, {
        timezone: "UTC",
      });

      expect(updated.status).toBe("WAITING");
      expect(updated.waitingSince).toBeDefined();
    });

    it("should mark provider ready (WAITING → READY_FOR_PROVIDER)", async () => {
      const updated = await appointmentRuntime.markProviderReady(appointment._id, doctor._id, {
        timezone: "UTC",
      });

      expect(updated.status).toBe("READY_FOR_PROVIDER");
      expect(updated.providerReadyAt).toBeDefined();
      expect(updated.waitingDurationMins).toBeDefined();
    });

    it("should launch encounter (READY_FOR_PROVIDER → OPENING_ENCOUNTER)", async () => {
      const updated = await appointmentRuntime.launchEncounter(appointment._id, {
        timezone: "UTC",
      });

      expect(updated.status).toBe("OPENING_ENCOUNTER");
      expect(updated.encounterRequestedAt).toBeDefined();
    });

    it("should complete appointment (IN_ENCOUNTER → COMPLETED)", async () => {
      // First, manually set to IN_ENCOUNTER (workflow-safe update)
      await Appointment.findByIdAndUpdate(
        appointment._id,
        {
          status: "IN_ENCOUNTER",
          encounter: new mongoose.Types.ObjectId(),
          encounterStartedAt: new Date(),
        },
        { viaWorkflow: true }
      );

      const updated = await appointmentRuntime.complete(appointment._id, {
        notes: "Patient did well, no issues",
      });

      expect(updated.status).toBe("COMPLETED");
      expect(updated.completedAt).toBeDefined();
      expect(updated.actualDurationMins).toBeDefined();
    });

    it("should record timeline entries for each state change", async () => {
      const timeline = await AppointmentTimeline.find({
        appointment: appointment._id,
      }).sort({ timestamp: 1 });

      expect(timeline.length).toBeGreaterThanOrEqual(6); // CONFIRMED, CHECKED_IN, WAITING, etc.
      expect(timeline.map((t) => t.action)).toContain("CONFIRMED");
      expect(timeline.map((t) => t.action)).toContain("CHECKED_IN");
    });
  });

  /* ========== CANCELLATION & EXPIRATION TESTS ========== */

  describe("Appointment Cancellation & Expiration", () => {
    let appointment2;

    beforeAll(async () => {
      const appt2 = new Appointment({
        patient: patient._id,
        doctor: doctor._id,
        hospital: hospital._id,
        scheduledAt: new Date("2024-02-05T10:00:00Z"),
        durationMins: 30,
        consultationMode: "IN_PERSON",
        status: "CONFIRMED",
        confirmedAt: new Date(),
        createdBy: doctor._id,
      });
      appt2.$locals = { ...(appt2.$locals || {}), viaWorkflow: true };
      appointment2 = await appt2.save();
    });

    it("should cancel an appointment (CONFIRMED → CANCELLED)", async () => {
      const updated = await appointmentRuntime.cancel(
        appointment2._id,
        "Patient requested cancellation",
        patient._id,
        { timezone: "UTC" }
      );

      expect(updated.status).toBe("CANCELLED");
      expect(updated.cancelledAt).toBeDefined();
      expect(updated.cancellationReason).toBe("Patient requested cancellation");
    });

    it("should mark as no-show", async () => {
      const apptDoc = new Appointment({
        patient: patient._id,
        doctor: doctor._id,
        hospital: hospital._id,
        scheduledAt: new Date("2024-02-12T10:00:00Z"),
        durationMins: 30,
        consultationMode: "IN_PERSON",
        status: "CONFIRMED",
        confirmedAt: new Date(),
        createdBy: doctor._id,
      });
      apptDoc.$locals = { ...(apptDoc.$locals || {}), viaWorkflow: true };
      const appt = await apptDoc.save();

      const updated = await appointmentRuntime.markNoShow(appt._id, doctor._id, {
        timezone: "UTC",
      });

      expect(updated.status).toBe("NO_SHOW");
      expect(updated.noShowAt).toBeDefined();
    });
  });

  /* ========== RESERVATION EXPIRATION TESTS ========== */

  describe("Reservation Expiration", () => {
    it("should clean up expired reservations", async () => {
      // Create an expired reservation
      const expiredReservation = await SlotReservation.create({
        doctor: doctor._id,
        patient: patient._id,
        hospital: hospital._id,
        scheduledAt: new Date("2024-02-19T10:00:00Z"),
        durationMins: 30,
        status: "HELD",
        expiresAt: new Date(Date.now() - 60000), // 1 minute ago
        createdBy: doctor._id,
      });

      // Run expiration worker
      await appointmentRuntime.expireReservation(
        {
          _id: expiredReservation._id,
          slotId: "SLOT_test123",
          appointment: null,
          patient: patient._id,
          doctor: doctor._id,
          createdAt: new Date(),
        },
        new Date()
      );

      const updated = await SlotReservation.findById(expiredReservation._id);
      expect(updated.status).toBe("EXPIRED");
    });
  });

  /* ========== ERROR HANDLING TESTS ========== */

  describe("Error Handling", () => {
    it("should reject invalid state transitions", async () => {
      const apptDoc = new Appointment({
        patient: patient._id,
        doctor: doctor._id,
        hospital: hospital._id,
        scheduledAt: new Date("2024-02-26T10:00:00Z"),
        durationMins: 30,
        consultationMode: "IN_PERSON",
        status: "CONFIRMED",
        createdBy: doctor._id,
      });
      apptDoc.$locals = { ...(apptDoc.$locals || {}), viaWorkflow: true };
      const appt = await apptDoc.save();

      // Try to transition CONFIRMED → COMPLETED (should fail; must go through CHECKED_IN)
      expect(() =>
        appointmentRuntime.validateTransition("CONFIRMED", "COMPLETED")
      ).toThrow();
    });

    it("should require valid appointment type ID", async () => {
      const result = await schedulingPolicyEngine.validateBookingWindow(
        new mongoose.Types.ObjectId(),
        new Date("2024-03-15")
      );

      expect(result.valid).toBe(false);
      expect(result.code).toBe("APPOINTMENT_TYPE_NOT_FOUND");
    });
  });
});
