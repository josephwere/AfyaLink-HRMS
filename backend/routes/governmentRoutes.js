import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
  getGovernmentOverview,
  listGovernmentClaims,
  listGovernmentHospitals,
  listInspections,
  createInspection,
  updateInspection,
  listEnforcementActions,
  createEnforcementAction,
  updateEnforcementAction,
  listHealthFunds,
  createHealthFund,
  updateHealthFund,
  listGovernmentNotifications,
  listAuditLogs,
} from "../controllers/governmentDashboardController.js";
import {
  listGovernmentStaff,
  registerGovernmentStaff,
} from "../controllers/governmentStaffController.js";
import {
  listGovernmentSuppliers,
  updateGovernmentSupplier,
  listRegulatoryProducts,
  createRegulatoryProduct,
  updateRegulatoryProduct,
  createRecall,
  listNationalQuarantine,
  traceBatch,
  updateRecall,
  listSupplierCompliance,
  getNationalSafetyMetrics,
  listSafetySignals,
  transitionSafetySignal,
  applyRegulatoryAction,
  getBatchInvestigation,
  getInvestigationReport,
  getRecallReconciliation,
  getRecallEvidence,
  resolveRecallDiscrepancy,
  getNationalRecallReconciliation,
  getNationalRiskAggregation,
} from "../controllers/pharmacyTraceabilityController.js";

const router = express.Router();

const GOVERNMENT_ROLES = [
  "SUPER_ADMIN",
  "SYSTEM_ADMIN",
  "DEVELOPER",
  "GOVERNMENT_ADMIN",
  "GOVERNMENT_REGULATOR",
  "GOVERNMENT_AUDITOR",
  "GOVERNMENT_INSPECTOR",
  "GOVERNMENT_ANALYST",
];

router.use(protect, requireRole(...GOVERNMENT_ROLES));

router.get("/overview", getGovernmentOverview);
router.get("/staff", listGovernmentStaff);
router.post("/staff", registerGovernmentStaff);
router.get("/claims", listGovernmentClaims);
router.get("/hospitals", listGovernmentHospitals);
router.get("/inspections", listInspections);
router.post("/inspections", createInspection);
router.patch("/inspections/:id", updateInspection);
router.get("/enforcement", listEnforcementActions);
router.post("/enforcement", createEnforcementAction);
router.patch("/enforcement/:id", updateEnforcementAction);
router.get("/health-funds", listHealthFunds);
router.post("/health-funds", createHealthFund);
router.patch("/health-funds/:id", updateHealthFund);
router.get("/notifications", listGovernmentNotifications);
router.get("/audit-logs", listAuditLogs);
router.get("/pharmacy/suppliers", listGovernmentSuppliers);
router.patch("/pharmacy/suppliers/:id/approve", (req, res, next) => { req.body = { ...req.body, status: "ACTIVE" }; return updateGovernmentSupplier(req, res, next); });
router.patch("/pharmacy/suppliers/:id/suspend", (req, res, next) => { req.body = { ...req.body, status: "SUSPENDED" }; return updateGovernmentSupplier(req, res, next); });
router.get("/pharmacy/products", listRegulatoryProducts);
router.post("/pharmacy/products", createRegulatoryProduct);
router.patch("/pharmacy/products/:id", updateRegulatoryProduct);
router.post("/pharmacy/recalls", createRecall);
router.patch("/pharmacy/recalls/:id", updateRecall);
router.get("/pharmacy/recalls/:id/reconciliation", getRecallReconciliation);
router.get("/pharmacy/recalls/:id/evidence", getRecallEvidence);
router.patch("/pharmacy/recall-discrepancies/:id/resolve", resolveRecallDiscrepancy);
router.get("/pharmacy/recalls/reconciliation", getNationalRecallReconciliation);
router.get("/pharmacy/risk/aggregation", getNationalRiskAggregation);
router.get("/pharmacy/quarantine", listNationalQuarantine);
router.get("/pharmacy/trace/:batchId", traceBatch);
router.get("/pharmacy/risk", listSupplierCompliance);
router.get("/pharmacy/metrics", getNationalSafetyMetrics);
router.get("/pharmacy/alerts", listSafetySignals);
router.patch("/pharmacy/alerts/:id", transitionSafetySignal);
router.post("/pharmacy/regulatory-action", applyRegulatoryAction);
router.get("/pharmacy/batch/:id/investigation", getInvestigationReport);
router.get("/pharmacy/supplier/:id/investigation", (req, res) => getInvestigationReport({ ...req, params: { ...req.params, type: "supplier" } }, res));
router.get("/pharmacy/product/:id/investigation", (req, res) => getInvestigationReport({ ...req, params: { ...req.params, type: "product" } }, res));
router.get("/pharmacy/alert/:id/investigation", (req, res) => getInvestigationReport({ ...req, params: { ...req.params, type: "alert" } }, res));
router.get("/pharmacy/batch/:id/investigation-legacy", getBatchInvestigation);

export default router;
