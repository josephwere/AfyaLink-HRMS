import express from "express";
import {
  createAppointment,
  listAppointments,
  getAppointment,
  updateAppointment,
  deleteAppointment,
} from "../controllers/appointmentController.js";

import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/authorize.js";
import { audit } from "../middleware/audit.js";

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
