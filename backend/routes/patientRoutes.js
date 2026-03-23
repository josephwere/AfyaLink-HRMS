// backend/routes/patientRoutes.js

import express from "express";
import {
  createPatient,
  listPatients,
  getPatient,
  searchPatients,
  searchGuardianAccounts,
  deactivatePatient,
} from "../controllers/patientController.js";

import { protect } from "../middleware/authMiddleware.js";
import { planGuard } from "../middleware/planGuard.js";

const router = express.Router();

/**
 * ======================================================
 * 🧑‍⚕️ CREATE PATIENT — PLAN LIMITED
 * ======================================================
 */
router.post(
  "/",
  protect,
  planGuard({ limitKey: "patients" }), // 🧑‍⚕️ PATIENT LIMIT ENFORCED
  createPatient
);

router.get("/", protect, listPatients);

/**
 * ======================================================
 * 🔍 SEARCH PATIENTS
 * ======================================================
 */
router.get("/search", protect, searchPatients);
router.get("/guardians/search", protect, searchGuardianAccounts);

/**
 * ======================================================
 * 📄 GET SINGLE PATIENT
 * ======================================================
 */
router.get("/:id", protect, getPatient);

/**
 * ======================================================
 * 🚫 DEACTIVATE PATIENT (SOFT DELETE)
 * ======================================================
 */
router.patch("/:id/deactivate", protect, deactivatePatient);

export default router;
