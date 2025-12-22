import express from "express";
import {
  createPrescription,
  dispenseMedication,
} from "../controllers/pharmacyController.js";
import protect from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";

const router = express.Router();

/* ======================================================
   PHARMACY WORKFLOW ROUTES (STRICT)
====================================================== */

/**
 * CREATE PRESCRIPTION
 * State: LAB_COMPLETED → PRESCRIPTION_CREATED
 * Role: doctor
 */
router.post(
  "/prescriptions",
  protect,
  authorize("doctor", "write"),
  createPrescription
);

/**
 * DISPENSE MEDICATION
 * State: PRESCRIPTION_CREATED → DISPENSED
 * Role: pharmacy
 */
router.post(
  "/dispense",
  protect,
  authorize("pharmacy", "write"),
  dispenseMedication
);

export default router;
