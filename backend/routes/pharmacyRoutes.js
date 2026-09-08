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
import {
  listSuppliers,
  createSupplier,
  listPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrder,
  listStockRisks,
  listSupplierRelationships,
  createSupplierRelationship,
  updateSupplierRelationship,
  listSupplierProducts,
  upsertSupplierProduct,
  listRfqs,
  createRfq,
  listQuotations,
  createQuotation,
  awardQuotation,
  createShipment,
  receivePurchaseOrder,
  createSupplierInvoice,
  recordSupplierPayment,
} from "../controllers/pharmacyProcurementController.js";
import {
  createRegulatoryProduct,
  listRegulatoryProducts,
  upsertSupplierLicense,
  verifyBatch,
  listBatchControls,
  releaseBatch,
  createRecall,
  listRecalls,
  listSupplierCompliance,
  returnBatchToSupplier,
  transferBatch,
  listSafetySignals,
  transitionSafetySignal,
  acknowledgeRecall,
  submitRecallReconciliation,
  destroyBatch,
} from "../controllers/pharmacyTraceabilityController.js";

const router = express.Router();

/* ======================================================
   PHARMACY WORKFLOW ROUTES (STRICT)
====================================================== */

/* 🔐 GLOBAL GUARDS */
router.use(protect);

router.get("/trace/regulatory-products", requireRole("PHARMACIST", "HOSPITAL_ADMIN", "SUPPLIER", "GOVERNMENT_REGULATOR", "GOVERNMENT_ADMIN", "GOVERNMENT_AUDITOR", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), listRegulatoryProducts);
router.post("/trace/regulatory-products", requireRole("GOVERNMENT_REGULATOR", "GOVERNMENT_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), createRegulatoryProduct);
router.put("/trace/supplier-license", requireRole("SUPPLIER", "GOVERNMENT_REGULATOR", "GOVERNMENT_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), upsertSupplierLicense);
router.post("/trace/verify-batch", requireRole("PHARMACIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "GOVERNMENT_REGULATOR", "GOVERNMENT_ADMIN", "GOVERNMENT_AUDITOR", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), verifyBatch);
router.get("/trace/batch-controls", requireRole("PHARMACIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "GOVERNMENT_REGULATOR", "GOVERNMENT_ADMIN", "GOVERNMENT_AUDITOR", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), listBatchControls);
router.post("/trace/batch-controls/:id/release", requireRole("PHARMACIST", "HOSPITAL_ADMIN", "GOVERNMENT_REGULATOR", "GOVERNMENT_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), releaseBatch);
router.get("/trace/recalls", requireRole("GOVERNMENT_REGULATOR", "GOVERNMENT_ADMIN", "GOVERNMENT_AUDITOR", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), listRecalls);
router.get("/trace/supplier-compliance", requireRole("SUPPLIER", "PHARMACIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "GOVERNMENT_REGULATOR", "GOVERNMENT_ADMIN", "GOVERNMENT_AUDITOR", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), listSupplierCompliance);
router.post("/trace/batch-returns", requireRole("PHARMACIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), returnBatchToSupplier);
router.post("/trace/batch-transfers", requireRole("PHARMACIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), transferBatch);
router.get("/trace/safety-signals", requireRole("SUPPLIER", "PHARMACIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "GOVERNMENT_REGULATOR", "GOVERNMENT_ADMIN", "GOVERNMENT_AUDITOR", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), listSafetySignals);
router.patch("/trace/safety-signals/:id", requireRole("GOVERNMENT_REGULATOR", "GOVERNMENT_ADMIN", "GOVERNMENT_AUDITOR", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), transitionSafetySignal);
router.post("/trace/recalls", requireRole("GOVERNMENT_REGULATOR", "GOVERNMENT_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), createRecall);
router.post("/trace/recalls/:id/acknowledge", requireRole("PHARMACIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), acknowledgeRecall);
router.post("/trace/recalls/:id/reconciliation", requireRole("PHARMACIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), submitRecallReconciliation);
router.post("/trace/batch-destructions", requireRole("PHARMACIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), destroyBatch);

/* ======================================================
   PATIENT / CLINICAL PRESCRIPTION READS
====================================================== */
router.get(
  "/prescriptions",
  requireRole("DOCTOR", "PHARMACIST", "PATIENT", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  listPrescriptions
);

router.use(requireFeature("pharmacy"));

router.get("/suppliers", requireRole("PHARMACIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SUPPLIER", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), listSuppliers);
router.post("/suppliers", requireRole("PHARMACIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), createSupplier);
router.get("/purchase-orders", requireRole("PHARMACIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SUPPLIER", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), listPurchaseOrders);
router.post("/purchase-orders", requireRole("PHARMACIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), createPurchaseOrder);
router.patch("/purchase-orders/:id", requireRole("PHARMACIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SUPPLIER", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), updatePurchaseOrder);
router.get("/stock-risks", requireRole("PHARMACIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), listStockRisks);
router.get("/supplier-relationships", requireRole("PHARMACIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), listSupplierRelationships);
router.post("/supplier-relationships", requireRole("PHARMACIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), createSupplierRelationship);
router.patch("/supplier-relationships/:id", requireRole("HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), updateSupplierRelationship);
router.get("/supplier-products", requireRole("SUPPLIER", "PHARMACIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), listSupplierProducts);
router.post("/supplier-products", requireRole("SUPPLIER"), upsertSupplierProduct);
router.patch("/supplier-products/:id", requireRole("SUPPLIER"), upsertSupplierProduct);
router.get("/rfqs", requireRole("SUPPLIER", "PHARMACIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), listRfqs);
router.post("/rfqs", requireRole("PHARMACIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), createRfq);
router.get("/quotations", requireRole("SUPPLIER", "PHARMACIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), listQuotations);
router.post("/quotations", requireRole("SUPPLIER"), createQuotation);
router.post("/quotations/:id/award", requireRole("PHARMACIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), awardQuotation);
router.post("/shipments", requireRole("SUPPLIER"), createShipment);
router.post("/purchase-orders/:id/receive", requireRole("PHARMACIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), receivePurchaseOrder);
router.post("/supplier-invoices", requireRole("SUPPLIER"), createSupplierInvoice);
router.post("/supplier-payments", requireRole("PHARMACIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"), recordSupplierPayment);

/* ======================================================
   PHARMACY INVENTORY
====================================================== */
router.post(
  "/prescriptions",
  authorize("doctor", "write"),
  createPrescription
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
