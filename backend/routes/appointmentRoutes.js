import express from "express";
import {
  createAppointment,
  listAppointments,
  listHospitalDoctors,
  getHospitalSlotSuggestions,
  getHospitalAppointmentOps,
  assignAppointmentDoctor,
  getDoctorAvailability,
  upsertDoctorAvailability,
  listCalls,
  createCallSession,
  blockCallSession,
  activateCallSession,
  endCallSession,
  softDeleteCallSession,
  getAppointment,
  updateAppointment,
  deleteAppointment,
} from "../controllers/appointmentController.js";

import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/authorize.js";
import { audit } from "../middleware/audit.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = express.Router();

/* ======================================================
   APPOINTMENTS — RBAC + ABAC + AUDIT (FINAL)
====================================================== */

/**
 * CREATE appointment
 */
router.post(
  "/",
  protect,
  authorize("appointments", "create"),
  audit("APPOINTMENT_CREATE", "appointments"),
  createAppointment
);

/**
 * LIST appointments
 */
router.get(
  "/",
  protect,
  authorize("appointments", "read"),
  listAppointments
);

router.get(
  "/doctors",
  protect,
  authorize("appointments", "read"),
  listHospitalDoctors
);

router.get(
  "/suggestions",
  protect,
  authorize("appointments", "read"),
  getHospitalSlotSuggestions
);

router.get(
  "/ops/queue",
  protect,
  requireRole("HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "SUPER_ASSISTANT"),
  getHospitalAppointmentOps
);

router.post(
  "/:id/assign",
  protect,
  requireRole("HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "SUPER_ASSISTANT"),
  audit("APPOINTMENT_ASSIGN_DOCTOR", "appointments"),
  assignAppointmentDoctor
);

router.get(
  "/doctors/:doctorId/availability",
  protect,
  authorize("appointments", "read"),
  getDoctorAvailability
);

router.put(
  "/doctors/:doctorId/availability",
  protect,
  authorize("appointments", "update"),
  audit("DOCTOR_AVAILABILITY_UPSERT", "appointments"),
  upsertDoctorAvailability
);

router.get(
  "/calls",
  protect,
  authorize("appointments", "read"),
  listCalls
);

router.post(
  "/calls",
  protect,
  authorize("appointments", "create"),
  audit("CALL_SESSION_CREATE", "appointments"),
  createCallSession
);

router.patch(
  "/calls/:id/block",
  protect,
  requireRole("HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "SUPER_ASSISTANT"),
  audit("CALL_SESSION_BLOCK", "appointments"),
  blockCallSession
);

router.patch(
  "/calls/:id/activate",
  protect,
  authorize("appointments", "update"),
  audit("CALL_SESSION_ACTIVATE", "appointments"),
  activateCallSession
);

router.patch(
  "/calls/:id/end",
  protect,
  authorize("appointments", "update"),
  audit("CALL_SESSION_END", "appointments"),
  endCallSession
);

router.delete(
  "/calls/:id",
  protect,
  requireRole("HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "SUPER_ASSISTANT"),
  audit("CALL_SESSION_DELETE", "appointments"),
  softDeleteCallSession
);

/**
 * GET single appointment
 */
router.get(
  "/:id",
  protect,
  authorize("appointments", "read"),
  getAppointment
);

/**
 * UPDATE appointment
 */
router.patch(
  "/:id",
  protect,
  authorize("appointments", "update"),
  audit("APPOINTMENT_UPDATE", "appointments"),
  updateAppointment
);

/**
 * DELETE appointment
 */
router.delete(
  "/:id",
  protect,
  authorize("appointments", "delete"),
  audit("APPOINTMENT_DELETE", "appointments"),
  deleteAppointment
);

export default router;
