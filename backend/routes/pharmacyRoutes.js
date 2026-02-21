import express from "express";
import {
  createPrescription,
  dispenseMedication,
} from "../controllers/pharmacyController.js";
import {
  listItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  addStock,
  dispenseStock,
} from "../controllers/pharmacyInventoryController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/authorize.js";
import { requireFeature } from "../middleware/requireFeature.js";

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
router.get("/", authorize("inventory", "read"), listItems);
router.get("/:id", authorize("inventory", "read"), getItem);
router.post("/", authorize("inventory", "update"), createItem);
router.put("/:id", authorize("inventory", "update"), updateItem);
router.delete("/:id", authorize("inventory", "update"), deleteItem);
router.post("/:id/add-stock", authorize("inventory", "update"), addStock);
router.post("/:id/dispense", authorize("pharmacy", "dispense"), dispenseStock);

/**
 * CREATE PRESCRIPTION
 * State: LAB_COMPLETED → PRESCRIPTION_CREATED
 * Role: doctor
 */
router.post(
  "/prescriptions",
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
  authorize("pharmacy", "write"),
  dispenseMedication
);

export default router;
