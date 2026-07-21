/**
 * Scheduling Policy Engine
 *
 * The Policy Engine answers eligibility questions about bookings BEFORE
 * the Appointment Runtime executes them.
 *
 * It enforces business rules such as:
 * - Insurance eligibility
 * - Referral requirements
 * - Prepayment requirements
 * - Patient booking limits
 * - Doctor availability
 * - Resource constraints
 *
 * All policy decisions return structured results with business codes
 * so the frontend can provide meaningful feedback.
 */

import Appointment from "../../models/Appointment.js";
import Patient from "../../models/Patient.js";
import User from "../../models/User.js";
import AppointmentType from "../../models/AppointmentType.js";
import { clockService } from "../../services/clockService.js";

export class SchedulingPolicyEngine {
  /**
   * Check if a patient is eligible to book an appointment
   */
  async canPatientBook(patientId, appointmentTypeId, hospitalId) {
    const results = [];

    // Verify patient exists and is active
    const patient = await Patient.findById(patientId).select("_id active status");
    if (!patient) {
      return {
        allowed: false,
        code: "PATIENT_NOT_FOUND",
        message: "Patient does not exist.",
      };
    }

    if (!patient.active) {
      return {
        allowed: false,
        code: "PATIENT_INACTIVE",
        message: "Patient account is inactive.",
      };
    }

    // Verify appointment type exists
    if (appointmentTypeId) {
      const appointmentType = await AppointmentType.findById(appointmentTypeId);
      if (!appointmentType) {
        return {
          allowed: false,
          code: "APPOINTMENT_TYPE_NOT_FOUND",
          message: "Appointment type does not exist.",
        };
      }

      // Check if approval is required
      if (appointmentType.requiresApproval) {
        results.push({
          code: "REQUIRES_APPROVAL",
          message: "This appointment type requires prior approval.",
          requiresApproval: true,
        });
      }

      // Check if referral is required
      if (appointmentType.requiresReferral) {
        results.push({
          code: "REQUIRES_REFERRAL",
          message: "A referral is required for this appointment type.",
          requiresReferral: true,
        });
      }

      // Check if prepayment is required
      if (appointmentType.requiresPrepayment) {
        results.push({
          code: "REQUIRES_PREPAYMENT",
          message: "Prepayment is required for this appointment type.",
          requiresPrepayment: true,
        });
      }
    }

    // All checks passed
    return {
      allowed: true,
      code: "ELIGIBLE",
      message: "Patient is eligible to book.",
      notifications: results,
    };
  }

  /**
   * Check if a doctor can provide a service
   */
  async canDoctorProvideService(doctorId, appointmentTypeId, hospitalId) {
    // Verify doctor exists
    const doctor = await User.findById(doctorId).select(
      "_id role hospital employment.department active"
    );
    if (!doctor) {
      return {
        allowed: false,
        code: "DOCTOR_NOT_FOUND",
        message: "Doctor does not exist.",
      };
    }

    if (!doctor.active) {
      return {
        allowed: false,
        code: "DOCTOR_INACTIVE",
        message: "Doctor is inactive.",
      };
    }

    if (String(doctor.hospital) !== String(hospitalId)) {
      return {
        allowed: false,
        code: "DOCTOR_NOT_IN_HOSPITAL",
        message: "Doctor does not work at this hospital.",
      };
    }

    // Verify appointment type exists and check role requirements
    if (appointmentTypeId) {
      const appointmentType = await AppointmentType.findById(appointmentTypeId);
      if (!appointmentType) {
        return {
          allowed: false,
          code: "APPOINTMENT_TYPE_NOT_FOUND",
          message: "Appointment type does not exist.",
        };
      }

      if (appointmentType.requiredRoles && appointmentType.requiredRoles.length > 0) {
        const doctorRole = doctor.role || "DOCTOR";
        const hasRequiredRole = appointmentType.requiredRoles.some(
          (role) => String(role).toUpperCase() === String(doctorRole).toUpperCase()
        );

        if (!hasRequiredRole) {
          return {
            allowed: false,
            code: "DOCTOR_ROLE_MISMATCH",
            message: `This appointment requires a ${appointmentType.requiredRoles.join(
              " or "
            )}, but doctor is a ${doctorRole}.`,
          };
        }
      }
    }

    return {
      allowed: true,
      code: "QUALIFIED",
      message: "Doctor is qualified to provide this service.",
    };
  }

  /**
   * Check if a slot is within booking constraints
   */
  async validateBookingWindow(appointmentTypeId, scheduledAt, timeZone = "UTC") {
    if (!appointmentTypeId) {
      return { valid: true, code: "VALID_WINDOW", message: "No window constraints." };
    }

    const appointmentType = await AppointmentType.findById(appointmentTypeId);
    if (!appointmentType) {
      return {
        valid: false,
        code: "APPOINTMENT_TYPE_NOT_FOUND",
        message: "Appointment type not found.",
      };
    }

    const now = clockService.nowInTimezone(timeZone);
    const scheduledDate = new Date(scheduledAt);

    // Check minimum advance booking
    if (appointmentType.minBookingHoursAdvance > 0) {
      const minTime = new Date(now.getTime() + appointmentType.minBookingHoursAdvance * 3600000);
      if (scheduledDate < minTime) {
        return {
          valid: false,
          code: "BOOKING_TOO_SOON",
          message: `Must book at least ${appointmentType.minBookingHoursAdvance} hours in advance.`,
          earliestAvailable: minTime,
        };
      }
    }

    // Check maximum advance booking
    if (appointmentType.maxBookingHoursAdvance > 0) {
      const maxTime = new Date(now.getTime() + appointmentType.maxBookingHoursAdvance * 3600000);
      if (scheduledDate > maxTime) {
        return {
          valid: false,
          code: "BOOKING_TOO_FAR_AHEAD",
          message: `Can only book up to ${appointmentType.maxBookingHoursAdvance} hours in advance.`,
          latestAvailable: maxTime,
        };
      }
    }

    // Check allowed days of week
    if (appointmentType.allowedDaysOfWeek && appointmentType.allowedDaysOfWeek.length > 0) {
      const dayOfWeek = clockService.getDayOfWeekInTimezone(scheduledDate, timeZone);
      if (!appointmentType.allowedDaysOfWeek.includes(dayOfWeek)) {
        return {
          valid: false,
          code: "APPOINTMENT_TYPE_NOT_AVAILABLE_ON_DAY",
          message: "This appointment type is not available on that day of the week.",
          allowedDaysOfWeek: appointmentType.allowedDaysOfWeek,
        };
      }
    }

    return {
      valid: true,
      code: "WITHIN_BOOKING_WINDOW",
      message: "Appointment is within valid booking window.",
    };
  }

  /**
   * Check if a consultation mode is supported
   */
  async isModeSupported(appointmentTypeId, consultationMode) {
    if (!appointmentTypeId) {
      return {
        supported: true,
        code: "MODE_SUPPORTED",
        message: "Mode is supported.",
      };
    }

    const appointmentType = await AppointmentType.findById(appointmentTypeId);
    if (!appointmentType) {
      return {
        supported: false,
        code: "APPOINTMENT_TYPE_NOT_FOUND",
        message: "Appointment type not found.",
      };
    }

    const isSupported =
      appointmentType.supportedModes && appointmentType.supportedModes.includes(
        String(consultationMode).toUpperCase()
      );

    if (!isSupported) {
      return {
        supported: false,
        code: "MODE_NOT_SUPPORTED",
        message: `${consultationMode} is not supported for this appointment type.`,
        supportedModes: appointmentType.supportedModes,
      };
    }

    return {
      supported: true,
      code: "MODE_SUPPORTED",
      message: `${consultationMode} is supported.`,
    };
  }

  /**
   * Check patient daily booking limit (if any)
   */
  async checkPatientDailyLimit(patientId, scheduledAt, timeZone = "UTC") {
    const dayStart = clockService.startOfDayInTimezone(scheduledAt, timeZone);
    const dayEnd = clockService.endOfDayInTimezone(scheduledAt, timeZone);

    const existingAppointments = await Appointment.countDocuments({
      patient: patientId,
      scheduledAt: { $gte: dayStart, $lte: dayEnd },
      status: { $nin: ["Cancelled", "NoShow"] },
    });

    if (existingAppointments > 0) {
      return {
        allowed: false,
        code: "PATIENT_DAILY_LIMIT_REACHED",
        message: "Patient already has an appointment on this day.",
        maxPerDay: 1,
        currentCount: existingAppointments,
      };
    }

    return {
      allowed: true,
      code: "WITHIN_DAILY_LIMIT",
      message: "Patient is within daily booking limit.",
    };
  }

  /**
   * Comprehensive eligibility check before booking
   */
  async validateBookingRequest(patientId, doctorId, appointmentTypeId, hospitalId, scheduledAt, consultationMode, timeZone = "UTC") {
    const checks = {
      patientEligibility: await this.canPatientBook(patientId, appointmentTypeId, hospitalId),
      doctorQualification: doctorId
        ? await this.canDoctorProvideService(doctorId, appointmentTypeId, hospitalId)
        : null,
      bookingWindow: appointmentTypeId
        ? await this.validateBookingWindow(appointmentTypeId, scheduledAt, timeZone)
        : null,
      modeSupport: await this.isModeSupported(appointmentTypeId, consultationMode),
      dailyLimit: await this.checkPatientDailyLimit(patientId, scheduledAt, timeZone),
    };

    // Determine if booking can proceed
    const canProceed =
      checks.patientEligibility.allowed &&
      (!checks.doctorQualification || checks.doctorQualification.allowed) &&
      (!checks.bookingWindow || checks.bookingWindow.valid) &&
      checks.modeSupport.supported &&
      checks.dailyLimit.allowed;

    return {
      allowed: canProceed,
      checks,
      timestamp: clockService.nowUTC(),
    };
  }
}

// Export singleton
export const schedulingPolicyEngine = new SchedulingPolicyEngine();
