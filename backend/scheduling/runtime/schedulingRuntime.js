import Appointment from "../../models/Appointment.js";
import DoctorAvailability from "../../models/DoctorAvailability.js";
import User from "../../models/User.js";
import { findDailyAppointmentForPatient, findDoctorBookingAt } from "../repositories/appointmentRepository.js";
import { createReservation as createReservationRepo, transitionReservationStatus as transitionReservationStatusRepo } from "../repositories/reservationRepository.js";
import mongoose from "mongoose";
import Encounter from "../../models/Encounter.js";
import { workflowService } from "../../services/workflowService.js";
import { emitOperationalEvent } from "../../services/operationalEventGateway.js";
import { createEncounterRuntime } from "../../encounter/runtime/encounterRuntime.js";
import { createTelemedicineAdapter } from "../../encounter/adapters/telemedicineAdapter.js";
import { loadActiveTemplates, findTemplateForDay } from "./scheduleTemplateEngine.js";
import { canTransitionSlot, SLOT_STATES } from "./slotStateMachine.js";
import { createSlotReservation, transitionReservationStatus } from "./slotReservationEngine.js";
import { scoreDoctorCandidate, chooseBestDoctor } from "./doctorAssignmentEngine.js";
import { allowTelemedicineMode, validateAppointmentPolicy, selectLeastLoadedDoctor, buildDoctorCandidate, doctorHasCapacity, buildAssignmentResult } from "./appointmentPolicyEngine.js";
import { buildSlots, filterAvailableSlots, normalizeDateInput } from "./slotAllocator.js";
import { isDoctorAvailableAtSlot, groupAvailabilityByDoctor } from "./availabilityEngine.js";
import { prescriptionRuntime } from "../../prescription/runtime/prescriptionRuntime.js";
import PharmacyItem from "../../models/PharmacyItem.js";
import PharmacyReservation from "../../models/PharmacyReservation.js";
import PharmacyInventoryMovement from "../../models/PharmacyInventoryMovement.js";
import PharmacyBatchControl from "../../models/PharmacyBatchControl.js";
import { notifyRolesInHospital } from "../../services/notificationService.js";

const ACTIVE_DOCTOR_ROLES = ["DOCTOR", "SURGEON"];
const EXCLUDED_APPOINTMENT_STATUSES = ["Cancelled", "Completed", "NoShow", "CANCELLED", "COMPLETED", "NO_SHOW"];
const ASSIGNABLE_DOCTOR_STATUS_QUERY = {
  $or: [
    { "metadata.doctorWorkStatus": { $exists: false } },
    { "metadata.doctorWorkStatus": { $in: ["", "AVAILABLE", "ONLINE"] } },
  ],
};

function getDayRange(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function loadDoctors(hospitalId) {
  return User.find({
    hospital: hospitalId,
    role: { $in: ACTIVE_DOCTOR_ROLES },
    active: true,
    "employment.status": { $ne: "INACTIVE" },
    ...ASSIGNABLE_DOCTOR_STATUS_QUERY,
  })
    .select("_id name employment.department metadata.doctorWorkStatus")
    .lean();
}

async function loadAvailability(hospitalId, doctorIds, dayOfWeek) {
  return DoctorAvailability.find({
    hospital: hospitalId,
    doctor: { $in: doctorIds },
    dayOfWeek,
    isAvailable: true,
    consultationAvailable: true,
  }).lean();
}

async function loadAppointmentCounts(hospitalId, doctorIds, date) {
  if (!doctorIds.length) return new Map();
  const { start, end } = getDayRange(date);
  const rows = await Appointment.aggregate([
    {
      $match: {
        doctor: { $in: doctorIds },
        hospital: hospitalId,
        scheduledAt: { $gte: start, $lte: end },
        status: { $nin: EXCLUDED_APPOINTMENT_STATUSES },
      },
    },
    {
      $group: {
        _id: "$doctor",
        appointmentsToday: { $sum: 1 },
      },
    },
  ]);
  return new Map(rows.map((row) => [String(row._id), Number(row.appointmentsToday)]));
}

export function createSchedulingRuntime({ observability } = {}) {
  async function validatePreferredDoctor({ doctorId, hospitalId, scheduledDate, consultationMode = "IN_PERSON" }) {
    const doctor = await User.findOne({
      _id: doctorId,
      hospital: hospitalId,
      role: { $in: ACTIVE_DOCTOR_ROLES },
      active: true,
      "employment.status": { $ne: "INACTIVE" },
      ...ASSIGNABLE_DOCTOR_STATUS_QUERY,
    })
      .select("_id name employment.department metadata.doctorWorkStatus")
      .lean();

    if (!doctor) return null;

    const existingDoctorBooking = await Appointment.findOne({
      doctor: doctorId,
      scheduledAt: scheduledDate,
      status: { $nin: EXCLUDED_APPOINTMENT_STATUSES },
    }).select("_id").lean();
    if (existingDoctorBooking) return null;

    const availability = await DoctorAvailability.findOne({
      doctor: doctor._id,
      hospital: hospitalId,
      dayOfWeek: scheduledDate.getDay(),
      isAvailable: true,
      consultationAvailable: true,
    }).lean();

    if (!isDoctorAvailableAtSlot(availability, scheduledDate, consultationMode)) {
      return null;
    }

    return doctor;
  }

  async function assignDoctor({
    hospitalId,
    scheduledDate,
    serviceType,
    consultationMode = "IN_PERSON",
    preferredDoctorId = null,
    policy = {},
  }) {
    if (preferredDoctorId) {
      const preferred = await validatePreferredDoctor({
        doctorId: preferredDoctorId,
        hospitalId,
        scheduledDate,
        consultationMode,
      });
      if (preferred) {
        return buildAssignmentResult(preferred, null, "preferred_doctor");
      }
    }

    const doctors = await loadDoctors(hospitalId);
    if (!doctors.length) {
      return buildAssignmentResult(null, preferredDoctorId, "no_hospital_doctors");
    }

    const doctorIds = doctors.map((doctor) => doctor._id);
    const availabilityRows = await loadAvailability(hospitalId, doctorIds, scheduledDate.getDay());
    const availabilityByDoctor = groupAvailabilityByDoctor(availabilityRows);

    const eligibleDoctors = doctors.filter((doctor) => {
      const availability = availabilityByDoctor.get(String(doctor._id));
      return isDoctorAvailableAtSlot(availability, scheduledDate, consultationMode);
    });

    if (!eligibleDoctors.length) {
      return buildAssignmentResult(null, preferredDoctorId, "no_available_schedule");
    }

    const loadByDoctor = await loadAppointmentCounts(hospitalId, eligibleDoctors.map((doc) => doc._id), scheduledDate);
    const candidates = eligibleDoctors
      .map((doctor) => {
        const availability = availabilityByDoctor.get(String(doctor._id));
        const appointmentsToday = Number(loadByDoctor.get(String(doctor._id)) || 0);
        return buildDoctorCandidate({ doctor, availability, appointmentsToday, serviceType, policy });
      })
      .filter(doctorHasCapacity);

    if (!candidates.length) {
      return buildAssignmentResult(null, preferredDoctorId, "all_slots_full");
    }

    const selected = policy?.workloadBalancingEnabled === false
      ? candidates[0]?.doctor || null
      : selectLeastLoadedDoctor(candidates);
    return buildAssignmentResult(selected, preferredDoctorId, "least_loaded_doctor");
  }

  async function getPendingQueueSize(hospitalId) {
    return Appointment.countDocuments({
      hospital: hospitalId,
      assignmentStatus: "PENDING",
      status: { $nin: EXCLUDED_APPOINTMENT_STATUSES },
      $or: [{ doctor: null }, { doctor: { $exists: false } }],
    });
  }

  async function suggestHospitalSlots({
    hospitalId,
    serviceType,
    consultationMode = "IN_PERSON",
    preferredDate = new Date(),
    limit = 3,
    durationMins = 30,
  }) {
    const baseDate = new Date(preferredDate);
    const doctors = await loadDoctors(hospitalId);
    if (!doctors.length) return [];

    const suggestions = [];
    const doctorIds = doctors.map((row) => row._id);

    for (let offset = 0; offset < 7 && suggestions.length < limit; offset += 1) {
      const targetDate = new Date(baseDate);
      targetDate.setDate(baseDate.getDate() + offset);
      const { start: dayStart, end: dayEnd } = getDayRange(targetDate);
      const availabilityRows = await loadAvailability(hospitalId, doctorIds, targetDate.getDay());
      const availabilityByDoctor = groupAvailabilityByDoctor(availabilityRows);

      const appointments = await Appointment.find({
        hospital: hospitalId,
        doctor: { $in: doctorIds },
        scheduledAt: { $gte: dayStart, $lte: dayEnd },
        status: { $nin: EXCLUDED_APPOINTMENT_STATUSES },
      })
        .select("doctor scheduledAt durationMins")
        .lean();

      for (const doctor of doctors) {
        if (suggestions.length >= limit) break;
        const availability = availabilityByDoctor.get(String(doctor._id));
        if (!isDoctorAvailableAtSlot(availability, targetDate, consultationMode)) {
          continue;
        }

        const daySlots = buildSlots({
          startTime: availability?.startTime || "08:00",
          endTime: availability?.endTime || "17:00",
          durationMins,
          day: targetDate,
        });

        const bookedRanges = appointments
          .filter((item) => String(item.doctor) === String(doctor._id))
          .map((item) => ({
            start: item.scheduledAt,
            end: new Date(new Date(item.scheduledAt).getTime() + (item.durationMins || durationMins) * 60000),
          }));

        const freeSlots = filterAvailableSlots({ slots: daySlots, bookedRanges });
        if (!freeSlots.length) continue;

        suggestions.push({
          doctorId: doctor._id,
          doctorName: doctor.name,
          specialization: doctor?.employment?.department || serviceType || "General Consultation",
          appointmentTime: freeSlots[0].start.toISOString(),
          consultationMode,
        });
      }
    }

    return suggestions.sort((a, b) => new Date(a.appointmentTime) - new Date(b.appointmentTime)).slice(0, limit);
  }

  async function bookAppointment({
    patient,
    hospitalId,
    scheduledAt,
    durationMins = 30,
    serviceType = "General Consultation",
    consultationMode = "IN_PERSON",
    doctor = null,
    assignmentStatus = doctor ? "ASSIGNED" : "PENDING",
    reason,
    createdBy,
  }) {
    const normalizedScheduledAt = normalizeDateInput(scheduledAt);
    if (!normalizedScheduledAt) {
      throw new Error("Invalid scheduledAt value");
    }

    // Validate booking policy early (read-only, outside transaction)
    const policyResult = await validateAppointmentPolicy({
      patientId: patient,
      hospitalId,
      scheduledDate: normalizedScheduledAt,
      durationMins,
      consultationMode,
      doctorId: doctor,
    });
    if (!policyResult.valid) {
      const err = new Error(policyResult.message || "Booking policy violation");
      err.code = policyResult.code;
      err.statusCode = policyResult.statusCode || 409;
      throw err;
    }
    const policy = policyResult.policy || {};

    // Auto-assign a doctor if none was provided
    if (!doctor && policy.autoAssignmentEnabled !== false) {
      try {
        const assignResult = await assignDoctor({
          hospitalId,
          scheduledDate: normalizedScheduledAt,
          serviceType,
          consultationMode,
          preferredDoctorId: null,
          policy,
        });
        doctor = assignResult.doctor?._id || assignResult.doctor || null;
        assignmentStatus = assignResult.assignmentStatus || assignmentStatus;
      } catch (_) {}
    }

    if (!doctor) {
      const pendingQueueSize = await getPendingQueueSize(hospitalId);
      if (pendingQueueSize >= Number(policy.maximumQueueSize || 50)) {
        const err = new Error("This hospital's appointment queue is currently full. Please choose another time or contact the hospital for urgent care.");
        err.code = "QUEUE_FULL";
        err.statusCode = 409;
        throw err;
      }
      assignmentStatus = "PENDING";
    }

    // If running unit tests against a standalone Mongo, use non-transactional fallback
    if (process.env.NODE_ENV === "test") {
      return await bookAppointmentNonTransactional({
        patient,
        hospitalId,
        doctor,
        normalizedScheduledAt,
        durationMins,
        serviceType,
        consultationMode,
        reason,
        assignmentStatus,
        createdBy,
      });
    }

    // Attempt transactional booking for production
    return await bookAppointmentTransactional({
      patient,
      hospitalId,
      doctor,
      normalizedScheduledAt,
      durationMins,
      serviceType,
      consultationMode,
      reason,
      assignmentStatus,
      createdBy,
    });
  }

  async function bookAppointmentNonTransactional({
    patient,
    hospitalId,
    doctor,
    normalizedScheduledAt,
    durationMins,
    serviceType,
    consultationMode,
    reason,
    assignmentStatus,
    createdBy,
  }) {
    // Non-transactional path for test environments
    const reservation = await createReservationRepo({
      appointmentId: null,
      patientId: patient,
      hospitalId,
      doctorId: doctor,
      scheduledAt: normalizedScheduledAt,
      durationMins,
      holdSeconds: 30,
      createdBy,
    });

    const wf = await workflowService.start("CONSULTATION", {
      patient,
      doctor,
      hospital: hospitalId,
      scheduledAt: normalizedScheduledAt.toISOString(),
      reason,
      serviceType,
      consultationMode,
      durationMins,
      assignmentStatus,
      createdBy,
    });

    const appointment = wf.context.appointment;
    if (normalizedScheduledAt.getTime() <= Date.now()) {
      appointment.status = "Cancelled";
      appointment.expiredAt = new Date();
      appointment.cancelledAt = appointment.expiredAt;
      await appointment.save();
    }

    await transitionReservationStatusRepo(reservation._id, "CONFIRMED");

    try {
      reservation.appointment = appointment._id;
      if (typeof reservation.save === "function") await reservation.save();
    } catch (_) {}

    observability?.emit?.("scheduling.appointment.booked", {
      appointmentId: appointment._id,
      patient,
      doctor,
      hospitalId,
      scheduledAt: normalizedScheduledAt.toISOString(),
      assignmentStatus,
    });

    return appointment;
  }

  async function bookAppointmentTransactional({
    patient,
    hospitalId,
    doctor,
    normalizedScheduledAt,
    durationMins,
    serviceType,
    consultationMode,
    reason,
    assignmentStatus,
    createdBy,
  }) {
    const session = await mongoose.startSession();
    let txSupported = false;

    try {
      session.startTransaction();
      txSupported = true;
    } catch (txErr) {
      // Transactions not supported (e.g., standalone MongoDB in dev)
      txSupported = false;
    }

    if (!txSupported) {
      try {
        session.endSession();
      } catch (_) {}
      // Fall back to non-transactional path
      return await bookAppointmentNonTransactional({
        patient,
        hospitalId,
        doctor,
        normalizedScheduledAt,
        durationMins,
        serviceType,
        consultationMode,
        reason,
        assignmentStatus,
        createdBy,
      });
    }

    try {
      // Within transaction: create reservation
      const reservation = await createReservationRepo({
        appointmentId: null,
        patientId: patient,
        hospitalId,
        doctorId: doctor,
        scheduledAt: normalizedScheduledAt,
        durationMins,
        holdSeconds: 30,
        createdBy,
        session,
      });

      // Within transaction: start workflow (creates appointment)
      const wf = await workflowService.start(
        "CONSULTATION",
        {
          patient,
          doctor,
          hospital: hospitalId,
          scheduledAt: normalizedScheduledAt.toISOString(),
          reason,
          serviceType,
          consultationMode,
          durationMins,
          assignmentStatus,
          createdBy,
        },
        { session }
      );

      // Within transaction: confirm reservation and link appointment
      const confirmed = await transitionReservationStatusRepo(reservation._id, "CONFIRMED", session);
      confirmed.appointment = wf.context.appointment._id;
      if (typeof confirmed.save === "function") {
        await confirmed.save({ session });
      }

      // Commit transaction
      await session.commitTransaction();
      session.endSession();

      // After commit: emit event
      observability?.emit?.("scheduling.appointment.booked", {
        appointmentId: wf.context.appointment._id,
        patient,
        doctor,
        hospitalId,
        scheduledAt: normalizedScheduledAt.toISOString(),
        assignmentStatus,
      });

      return wf.context.appointment;
    } catch (txErr) {
      try {
        await session.abortTransaction();
      } catch (_) {}
      try {
        session.endSession();
      } catch (_) {}

      // If the database does not support transactions, fall back to the non-transactional path.
      const txMessage = txErr?.message || "";
      const isTxUnsupported = /replica set|transactions? not supported|Transaction numbers|session.*transaction/i.test(txMessage);
      if (isTxUnsupported) {
        return await bookAppointmentNonTransactional({
          patient,
          hospitalId,
          doctor,
          normalizedScheduledAt,
          durationMins,
          serviceType,
          consultationMode,
          reason,
          assignmentStatus,
          createdBy,
        });
      }

      throw txErr;
    }
  }

  async function completeConsultation({ appointmentId, doctorId, hospitalId, notes = "", diagnosis = "", prescriptions = [] }) {
    const appointment = await Appointment.findOne({ _id: appointmentId, hospital: hospitalId }).lean();
    if (!appointment) throw new Error("Appointment not found");

    const encounterRuntime = createEncounterRuntime({ observability });
    const runtimeEncounter = encounterRuntime.createEncounter({
      patientId: appointment.patient,
      doctorId,
      mode: "IN_PERSON",
      externalId: appointment._id,
      hospitalId,
      metadata: {
        appointmentId: String(appointment._id),
        diagnosis,
        notes,
      },
    });

    const encounterDoc = new Encounter({
      patient: appointment.patient,
      doctor: doctorId,
      hospital: hospitalId,
      appointment: appointment._id,
      consultationNotes: notes,
      diagnosis,
      state: "CREATED",
    });
    encounterDoc.$locals = { ...(encounterDoc.$locals || {}), viaWorkflow: true };
    await encounterDoc.save();

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      {
        $set: {
          status: "Completed",
          completedAt: new Date(),
          completionNotes: notes,
          encounter: encounterDoc._id,
          doctor: doctorId,
          hospital: hospitalId,
          createdBy: doctorId,
        },
      },
      { new: true }
    ).lean();

    const createdPrescriptions = [];
    for (const prescriptionInput of Array.isArray(prescriptions) ? prescriptions : []) {
      const created = await prescriptionRuntime.createPrescription({
        encounterId: encounterDoc._id,
        appointmentId: appointment._id,
        patient: prescriptionInput.patient || appointment.patient,
        patientRecord: prescriptionInput.patientRecord || appointment.patient,
        doctor: prescriptionInput.doctor || doctorId,
        hospital: prescriptionInput.hospital || hospitalId,
        medications: prescriptionInput.medications || [],
        summary: prescriptionInput.summary || "",
        advice: prescriptionInput.advice || "",
      });
      createdPrescriptions.push(created);
    }

    await emitOperationalEvent({
      type: "CONSULTATION_COMPLETED",
      source: "scheduling-runtime",
      hospitalId,
      entity: "Appointment",
      payload: {
        appointmentId: String(appointment._id),
        doctorId: String(doctorId),
        patientId: String(appointment.patient),
        encounterId: String(encounterDoc._id),
        prescriptionCount: createdPrescriptions.length,
      },
    });

    return { appointment: updatedAppointment, encounter: encounterDoc, prescriptions: createdPrescriptions, runtimeEncounter };
  }

  async function reserveInventory({ hospitalId, prescriptionId, medication, requestedQuantity, performedBy }) {
    if (!hospitalId || !prescriptionId || !medication) throw new Error("Incomplete inventory reservation request");
    const item = await PharmacyItem.findOne({ hospital: hospitalId, _id: medication.pharmacyItem || medication.itemId });
    if (!item) throw new Error("Pharmacy item not found");
    const quantity = Number(requestedQuantity || medication.requestedQuantity || 1) || 1;
    if (Number(item.totalQuantity || 0) < quantity) throw new Error("Insufficient stock for reservation");
    const batch = medication.batchNumber
      ? item.batches.find((entry) => entry.batchNumber === String(medication.batchNumber))
      : item.batches.find((entry) => Number(entry.quantity || 0) >= quantity);
    if (!batch || Number(batch.quantity || 0) < quantity) throw new Error("Insufficient batch stock for reservation");
    const held = await PharmacyBatchControl.exists({ hospital: hospitalId, itemId: item._id, batchNumber: batch.batchNumber, status: { $in: ["QUARANTINED", "RECALLED"] } });
    if (held) throw new Error("Batch is under regulatory hold");

    const reservation = await PharmacyReservation.create({
      hospital: hospitalId,
      itemId: item._id,
      prescriptionId,
      batchNumber: batch.batchNumber || "",
      quantity,
      status: "ACTIVE",
      reservedBy: performedBy || null,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      note: `Reserved for prescription ${String(prescriptionId)}`,
    });

    item.totalQuantity = Number(item.totalQuantity || 0) - quantity;
    item.updatedBy = performedBy || null;
    await item.save();

    await PharmacyInventoryMovement.create({
      itemId: item._id,
      hospital: hospitalId,
      movementType: "RESERVATION",
      batchNumber: batch.batchNumber || "",
      quantity,
      previousQuantity: Number(item.totalQuantity || 0) + quantity,
      newQuantity: Number(item.totalQuantity || 0),
      referenceType: "RESERVATION",
      note: `Reserved for prescription ${String(prescriptionId)}`,
      performedBy: performedBy || null,
    });

    await notifyRolesInHospital({
      hospital: hospitalId,
      roles: ["PHARMACIST", "HOSPITAL_ADMIN"],
      title: "Prescription queued for dispense",
      body: `Inventory has been reserved for a prescription in your hospital.`,
      category: "PHARMACY",
      meta: { prescriptionId, itemId: String(item._id), type: "RESERVATION" },
    });

    return reservation;
  }

  async function dispenseMedication({ hospitalId, prescriptionId, performedBy, quantity = 1 }) {
    const reservation = await PharmacyReservation.findOne({ prescriptionId, hospital: hospitalId, status: "ACTIVE" }).lean();
    if (!reservation) throw new Error("No active reservation found");
    const item = await PharmacyItem.findOne({ hospital: hospitalId, _id: reservation.itemId });
    if (!item) throw new Error("Pharmacy item not found");
    const held = await PharmacyBatchControl.exists({ hospital: hospitalId, itemId: item._id, batchNumber: reservation.batchNumber, status: { $in: ["QUARANTINED", "RECALLED"] } });
    if (held) throw new Error("Batch is under regulatory hold");

    const dispensedQty = Number(quantity || reservation.quantity || 1);
    await PharmacyInventoryMovement.create({
      itemId: item._id,
      hospital: hospitalId,
      movementType: "DISPENSE",
      batchNumber: reservation.batchNumber || "",
      quantity: dispensedQty,
      previousQuantity: Number(item.totalQuantity || 0),
      newQuantity: Number(item.totalQuantity || 0) - dispensedQty,
      referenceType: "DISPENSE",
      note: `Dispensed for prescription ${String(prescriptionId)}`,
      performedBy: performedBy || null,
    });

    item.totalQuantity = Number(item.totalQuantity || 0) - dispensedQty;
    item.updatedBy = performedBy || null;
    await item.save();

    const updatedReservation = await PharmacyReservation.findByIdAndUpdate(reservation._id, { status: "FULFILLED", fulfilledBy: performedBy || null }, { new: true }).lean();
    await prescriptionRuntime.transitionPrescription(prescriptionId, { to: "DISPENSED", dispensedBy: performedBy || null, dispensedAt: new Date() });

    await emitOperationalEvent({
      type: "MEDICATION_DISPENSED",
      source: "scheduling-runtime",
      hospitalId,
      entity: "Prescription",
      payload: { prescriptionId: String(prescriptionId), quantity: dispensedQty },
    });

    return { reservation: updatedReservation, item };
  }

  async function completeEncounter({ appointmentId, hospitalId, doctorId, notes = "", diagnosis = "" }) {
    const appointment = await Appointment.findOne({ _id: appointmentId, hospital: hospitalId }).lean();
    if (!appointment) throw new Error("Appointment not found");
    const updatedAppointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      {
        $set: {
          status: "Completed",
          completedAt: new Date(),
          completionNotes: notes,
          doctor: doctorId,
          hospital: hospitalId,
          createdBy: doctorId,
        },
      },
      { new: true }
    ).lean();
    await emitOperationalEvent({
      type: "ENCOUNTER_COMPLETED",
      source: "scheduling-runtime",
      hospitalId,
      entity: "Encounter",
      payload: { appointmentId: String(appointmentId), doctorId: String(doctorId) },
    });
    return updatedAppointment;
  }

  return {
    validatePreferredDoctor,
    assignDoctor,
    suggestHospitalSlots,
    bookAppointment,
    completeConsultation,
    reserveInventory,
    dispenseMedication,
    completeEncounter,
  };
}
