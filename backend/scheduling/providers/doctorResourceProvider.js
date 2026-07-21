/**
 * DoctorResourceProvider
 *
 * Implements ResourceProvider contract for Doctor resources.
 * Adapts existing doctor availability, appointment, and scheduling logic
 * to the generic resource provider interface.
 *
 * This allows the Scheduling Runtime to treat doctors as just one type of resource,
 * without changing how doctors are stored or queried in the database.
 */

import { ResourceProvider } from "./resourceProvider.js";
import User from "../../models/User.js";
import DoctorAvailability from "../../models/DoctorAvailability.js";
import Appointment from "../../models/Appointment.js";
import ScheduleTemplate from "../../models/ScheduleTemplate.js";
import SlotReservation from "../../models/SlotReservation.js";
import { clockService } from "../../services/clockService.js";

const ACTIVE_DOCTOR_ROLES = ["DOCTOR", "SURGEON"];
const EXCLUDED_APPOINTMENT_STATUSES = ["Cancelled", "Completed", "NoShow"];

export class DoctorResourceProvider extends ResourceProvider {
  getResourceType() {
    return "DOCTOR";
  }

  /**
   * Find all available doctors for a time slot
   */
  async findAvailable(options) {
    const { startTime, durationMins, hospitalId, appointmentTypeId, timeZone = "UTC" } = options;

    if (!hospitalId) {
      throw new Error("hospitalId is required");
    }

    const doctors = await User.find({
      hospital: hospitalId,
      role: { $in: ACTIVE_DOCTOR_ROLES },
      active: true,
      "employment.status": { $ne: "INACTIVE" },
    })
      .select("_id name employment.department email")
      .lean();

    if (!doctors.length) {
      return [];
    }

    const doctorIds = doctors.map((d) => d._id);
    const dayOfWeek = clockService.getDayOfWeekInTimezone(startTime, timeZone);

    // Get availability for this day
    const availabilityRows = await DoctorAvailability.find({
      doctor: { $in: doctorIds },
      hospital: hospitalId,
      dayOfWeek,
      isAvailable: true,
      consultationAvailable: true,
    }).lean();

    const availabilityByDoctor = new Map(
      availabilityRows.map((row) => [String(row.doctor), row])
    );

    // Filter doctors who:
    // 1. Have availability on this day
    // 2. Have a free slot at this time
    // 3. Don't have a conflicting appointment
    const available = [];

    for (const doctor of doctors) {
      const availability = availabilityByDoctor.get(String(doctor._id));
      if (!availability) continue; // Doctor not available this day

      // Check if appointment time falls within availability window
      const scheduledMinute =
        startTime.getHours() * 60 + startTime.getMinutes();
      const startMin =
        Number(String(availability.startTime || "08:00").split(":")[0]) * 60 +
        Number(String(availability.startTime || "08:00").split(":")[1]);
      const endMin =
        Number(String(availability.endTime || "17:00").split(":")[0]) * 60 +
        Number(String(availability.endTime || "17:00").split(":")[1]);

      if (scheduledMinute < startMin || scheduledMinute + durationMins > endMin) {
        continue; // Outside working hours
      }

      // Check for conflicting appointments
      const conflictingAppointment = await Appointment.findOne({
        doctor: doctor._id,
        hospital: hospitalId,
        status: { $nin: EXCLUDED_APPOINTMENT_STATUSES },
        $expr: {
          $and: [
            { $gte: ["$scheduledAt", new Date(startTime.getTime() - durationMins * 60000)] },
            { $lt: ["$scheduledAt", new Date(startTime.getTime() + durationMins * 60000)] },
          ],
        },
      }).lean();

      if (conflictingAppointment) {
        continue; // Doctor already booked
      }

      available.push({
        resourceId: String(doctor._id),
        resourceName: doctor.name,
        specialization: doctor.employment?.department || "General",
        email: doctor.email,
        availableSlots: [
          {
            startTime,
            durationMins,
            endTime: new Date(startTime.getTime() + durationMins * 60000),
          },
        ],
        confidence: 0.95,
      });
    }

    return available;
  }

  /**
   * Reserve (hold) a doctor for a time slot
   */
  async reserve(options) {
    const {
      resourceId: doctorId,
      startTime,
      durationMins,
      appointmentId,
      patientId,
      holdDurationSeconds = 300,
    } = options;

    if (!doctorId || !patientId) {
      throw new Error("doctorId and patientId are required");
    }

    // Check if doctor already has a conflicting reservation
    const existingReservation = await SlotReservation.findOne({
      doctor: doctorId,
      scheduledAt: startTime,
      status: { $in: ["HELD", "CONFIRMED"] },
    });

    if (existingReservation) {
      throw new Error("Doctor already has a conflicting reservation for this time");
    }

    // Create reservation
    const expiresAt = new Date(
      clockService.nowUTC().getTime() + holdDurationSeconds * 1000
    );

    const reservation = await SlotReservation.create({
      doctor: doctorId,
      patient: patientId,
      hospital: options.hospitalId,
      scheduledAt: startTime,
      durationMins,
      appointment: appointmentId || undefined,
      status: "HELD",
      expiresAt,
      createdBy: options.createdBy,
    });

    return {
      reservationId: String(reservation._id),
      resourceId: String(doctorId),
      status: "HELD",
      expiresAt,
      startTime,
      endTime: new Date(startTime.getTime() + durationMins * 60000),
    };
  }

  /**
   * Release (cancel) a reservation
   */
  async release(reservationId) {
    const reservation = await SlotReservation.findByIdAndUpdate(
      reservationId,
      { status: "CANCELLED", updatedAt: clockService.nowUTC() },
      { new: true }
    );

    if (!reservation) {
      throw new Error(`Reservation not found: ${reservationId}`);
    }

    return {
      success: true,
      reservationId,
      status: "AVAILABLE",
    };
  }

  /**
   * Confirm a reservation
   */
  async confirmReservation(reservationId) {
    const reservation = await SlotReservation.findByIdAndUpdate(
      reservationId,
      { status: "CONFIRMED", updatedAt: clockService.nowUTC() },
      { new: true }
    );

    if (!reservation) {
      throw new Error(`Reservation not found: ${reservationId}`);
    }

    return {
      reservationId,
      status: "CONFIRMED",
      expiresAt: reservation.expiresAt,
      appointmentId: reservation.appointment,
    };
  }

  /**
   * Check if doctor supports a capability
   */
  async supports(capability) {
    // Doctors support all standard consultation modes
    const supportedModes = ["IN_PERSON", "CHAT", "VOICE", "VIDEO"];
    return supportedModes.includes(String(capability).toUpperCase());
  }

  /**
   * Get doctor capacity constraints
   */
  async getCapacity(doctorId) {
    const doctor = await User.findById(doctorId).select("_id").lean();
    if (!doctor) {
      throw new Error(`Doctor not found: ${doctorId}`);
    }

    // Default capacity for doctors
    return {
      maxConcurrentAppointments: 1,
      maxAppointmentsPerDay: 12,
      minTimeBetweenAppointments: 0,
      maxAppointmentDuration: 120,
    };
  }

  /**
   * Get working hours for a doctor
   */
  async getWorkingHours(doctorId, timeZone = "UTC") {
    const availabilityRows = await DoctorAvailability.find({
      doctor: doctorId,
      isAvailable: true,
    })
      .select("dayOfWeek startTime endTime appointmentSlots modes")
      .lean();

    if (!availabilityRows.length) {
      // Return default working hours
      return {
        workingDays: [1, 2, 3, 4, 5],
        workingHours: [
          { startTime: "08:00", endTime: "12:00" },
          { startTime: "13:00", endTime: "17:00" },
        ],
        timeZone,
      };
    }

    // Group by day
    const byDay = new Map();
    availabilityRows.forEach((row) => {
      if (!byDay.has(row.dayOfWeek)) {
        byDay.set(row.dayOfWeek, []);
      }
      byDay.get(row.dayOfWeek).push(row);
    });

    const workingHours = [];
    byDay.forEach((rows, dayOfWeek) => {
      rows.forEach((row) => {
        workingHours.push({
          dayOfWeek,
          startTime: row.startTime,
          endTime: row.endTime,
          slots: row.appointmentSlots,
        });
      });
    });

    return {
      workingDays: Array.from(byDay.keys()).sort(),
      workingHours,
      timeZone,
    };
  }

  /**
   * Get exceptions (leave, holidays) for a doctor
   */
  async getExceptions(doctorId, startDate, endDate) {
    // This could be pulled from a DoctorLeave model if one exists
    // For now, return empty
    return [];
  }

  /**
   * Get current status of a doctor
   */
  async getStatus(doctorId) {
    const doctor = await User.findById(doctorId)
      .select("_id name active employment.status")
      .lean();

    if (!doctor) {
      throw new Error(`Doctor not found: ${doctorId}`);
    }

    let status = "OFFLINE";
    if (doctor.active && doctor.employment?.status !== "INACTIVE") {
      status = "AVAILABLE";
    }

    const currentAppointment = await Appointment.findOne({
      doctor: doctorId,
      status: { $in: ["InConsultation", "CheckedIn"] },
    })
      .select("_id scheduledAt")
      .lean();

    if (currentAppointment) {
      status = "BUSY";
    }

    return {
      resourceId: String(doctorId),
      status,
      currentActivity: currentAppointment ? { appointmentId: String(currentAppointment._id) } : null,
      nextAvailable: null, // TODO: calculate from schedule
    };
  }

  /**
   * List all doctors in a hospital
   */
  async listResources(hospitalId, filters = {}) {
    const query = {
      hospital: hospitalId,
      role: { $in: ACTIVE_DOCTOR_ROLES },
    };

    if (filters.active !== undefined) {
      query.active = filters.active;
    }

    const doctors = await User.find(query)
      .select("_id name email employment.department employment.status active")
      .lean();

    return doctors.map((doctor) => ({
      resourceId: String(doctor._id),
      name: doctor.name,
      email: doctor.email,
      specialization: doctor.employment?.department || "General",
      status: doctor.active && doctor.employment?.status !== "INACTIVE" ? "AVAILABLE" : "OFFLINE",
    }));
  }

  /**
   * Assign a doctor to an appointment
   */
  async assignToAppointment(appointmentId, doctorId) {
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      throw new Error(`Appointment not found: ${appointmentId}`);
    }

    appointment.doctor = doctorId;
    appointment.assignmentStatus = "ASSIGNED";
    await appointment.save();

    return {
      appointmentId,
      resourceId: doctorId,
      status: "BOOKED",
      assignedAt: clockService.nowUTC(),
    };
  }

  /**
   * Release a doctor from an appointment
   */
  async releaseFromAppointment(appointmentId) {
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      throw new Error(`Appointment not found: ${appointmentId}`);
    }

    appointment.doctor = null;
    appointment.assignmentStatus = "PENDING";
    await appointment.save();

    return {
      appointmentId,
      status: "UNASSIGNED",
      releasedAt: clockService.nowUTC(),
    };
  }
}
