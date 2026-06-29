import express from "express";
import {
  createPrescription,
  listPrescriptions,
  dispenseMedication,
} from "../controllers/pharmacyController.js";
import {
  listItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  addStock,
  reserveStock,
  dispenseStock,
  listAvailableMedicines,
} from "../controllers/pharmacyInventoryController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/authorize.js";
import { requireFeature } from "../middleware/requireFeature.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = express.Router();

/* ======================================================
   PHARMACY WORKFLOW ROUTES (STRICT)
====================================================== */

/* 🔐 GLOBAL GUARDS */
router.use(protect);
router.use(requireFeature("pharmacy"));

/* ======================================================
   PHARMACY INVENTORY
====================================================== */
router.post(
  "/prescriptions",
  authorize("doctor", "write"),
  createPrescription
);

router.get(
  "/prescriptions",
  requireRole("DOCTOR", "PHARMACIST", "PATIENT", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  listPrescriptions
);

router.get(
  "/available-medicines",
  requireRole("DOCTOR", "SURGEON", "PHARMACIST", "LAB_TECH", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  listAvailableMedicines
);

/**
 * DISPENSE MEDICATION
 * State: PRESCRIPTION_CREATED → DISPENSED
 * Role: pharmacy
 */
router.post(
  "/dispense",
  authorize("pharmacy", "write"),
  dispenseMedication
);

router.get("/", authorize("inventory", "read"), listItems);
router.get("/:id", authorize("inventory", "read"), getItem);
router.post("/", authorize("inventory", "update"), createItem);
router.put("/:id", authorize("inventory", "update"), updateItem);
router.delete("/:id", authorize("inventory", "update"), deleteItem);
router.post("/:id/add-stock", authorize("inventory", "update"), addStock);
router.post("/:id/reserve", authorize("pharmacy", "dispense"), reserveStock);
router.post("/:id/dispense", authorize("pharmacy", "dispense"), dispenseStock);

export default router;
