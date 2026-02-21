import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
  listLeaveRequests,
  listMyLeaveRequests,
  createLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  listOvertimeRequests,
  listMyOvertimeRequests,
  createOvertimeRequest,
  approveOvertimeRequest,
  rejectOvertimeRequest,
  listShiftRequests,
  listPendingRequests,
  listMyShiftRequests,
  createShiftRequest,
  approveShiftRequest,
  rejectShiftRequest,
  getWorkforceSlaPolicies,
  upsertWorkforceSlaPolicy,
  getWorkforceQueueInsights,
  getWorkforceAutomationPolicies,
  getWorkforceAutomationPresets,
  upsertWorkforceAutomationPreset,
  deactivateWorkforceAutomationPreset,
  reactivateWorkforceAutomationPreset,
  getWorkforceAutomationPresetHistory,
  applyWorkforceAutomationPresetAll,
  upsertWorkforceAutomationPolicy,
  simulateWorkforceAutomation,
  previewWorkforceEscalation,
  runWorkforceAutomationSweep,
} from "../controllers/workforceController.js";

const router = express.Router();
const WORKFORCE_ADMIN_ROLES = [
  "HOSPITAL_ADMIN",
  "SUPER_ADMIN",
  "SYSTEM_ADMIN",
  "DEVELOPER",
];
const WORKFORCE_PRESET_LIFECYCLE_ROLES = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"];

/* =========================
   LEAVE
========================= */
router.get(
  "/leave",
  protect,
  requireRole(
    "HOSPITAL_ADMIN",
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "DEVELOPER",
    "HR_MANAGER",
    "PAYROLL_OFFICER"
  ),
  listLeaveRequests
);
router.get("/leave/my", protect, listMyLeaveRequests);
router.post("/leave", protect, createLeaveRequest);
router.post(
  "/leave/:id/approve",
  protect,
  requireRole(
    "HOSPITAL_ADMIN",
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "DEVELOPER",
    "HR_MANAGER",
    "PAYROLL_OFFICER"
  ),
  approveLeaveRequest
);
router.post(
  "/leave/:id/reject",
  protect,
  requireRole(
    "HOSPITAL_ADMIN",
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "DEVELOPER",
    "HR_MANAGER",
    "PAYROLL_OFFICER"
  ),
  rejectLeaveRequest
);

/* =========================
   OVERTIME
========================= */
router.get(
  "/overtime",
  protect,
  requireRole(
    "HOSPITAL_ADMIN",
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "DEVELOPER",
    "HR_MANAGER",
    "PAYROLL_OFFICER"
  ),
  listOvertimeRequests
);
router.get("/overtime/my", protect, listMyOvertimeRequests);
router.post("/overtime", protect, createOvertimeRequest);
router.post(
  "/overtime/:id/approve",
  protect,
  requireRole(
    "HOSPITAL_ADMIN",
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "DEVELOPER",
    "HR_MANAGER",
    "PAYROLL_OFFICER"
  ),
  approveOvertimeRequest
);
router.post(
  "/overtime/:id/reject",
  protect,
  requireRole(
    "HOSPITAL_ADMIN",
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "DEVELOPER",
    "HR_MANAGER",
    "PAYROLL_OFFICER"
  ),
  rejectOvertimeRequest
);

/* =========================
   SHIFTS
========================= */
router.get(
  "/shifts",
  protect,
  requireRole(
    "HOSPITAL_ADMIN",
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "DEVELOPER",
    "HR_MANAGER",
    "PAYROLL_OFFICER"
  ),
  listShiftRequests
);
router.get(
  "/pending",
  protect,
  requireRole(
    "HOSPITAL_ADMIN",
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "DEVELOPER",
    "HR_MANAGER",
    "PAYROLL_OFFICER"
  ),
  listPendingRequests
);
router.get("/shifts/my", protect, listMyShiftRequests);
router.post("/shifts", protect, createShiftRequest);
router.post(
  "/shifts/:id/approve",
  protect,
  requireRole(
    "HOSPITAL_ADMIN",
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "DEVELOPER",
    "HR_MANAGER",
    "PAYROLL_OFFICER"
  ),
  approveShiftRequest
);
router.post(
  "/shifts/:id/reject",
  protect,
  requireRole(
    "HOSPITAL_ADMIN",
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "DEVELOPER",
    "HR_MANAGER",
    "PAYROLL_OFFICER"
  ),
  rejectShiftRequest
);

/* =========================
   SLA POLICIES + QUEUE INSIGHTS
========================= */
router.get("/sla/policies", protect, requireRole(...WORKFORCE_ADMIN_ROLES), getWorkforceSlaPolicies);
router.put("/sla/policies/:requestType", protect, requireRole(...WORKFORCE_ADMIN_ROLES), upsertWorkforceSlaPolicy);
router.get("/queue-insights", protect, requireRole(...WORKFORCE_ADMIN_ROLES), getWorkforceQueueInsights);

/* =========================
   AUTOMATION POLICIES
========================= */
router.get("/automation/policies", protect, requireRole(...WORKFORCE_ADMIN_ROLES), getWorkforceAutomationPolicies);
router.get("/automation/presets", protect, requireRole(...WORKFORCE_ADMIN_ROLES), getWorkforceAutomationPresets);
router.post("/automation/presets", protect, requireRole(...WORKFORCE_ADMIN_ROLES), upsertWorkforceAutomationPreset);
router.delete("/automation/presets/:key", protect, requireRole(...WORKFORCE_PRESET_LIFECYCLE_ROLES), deactivateWorkforceAutomationPreset);
router.post("/automation/presets/:key/reactivate", protect, requireRole(...WORKFORCE_PRESET_LIFECYCLE_ROLES), reactivateWorkforceAutomationPreset);
router.get("/automation/presets/history", protect, requireRole(...WORKFORCE_ADMIN_ROLES), getWorkforceAutomationPresetHistory);
router.post("/automation/presets/apply-all", protect, requireRole(...WORKFORCE_ADMIN_ROLES), applyWorkforceAutomationPresetAll);
router.put("/automation/policies/:requestType", protect, requireRole(...WORKFORCE_ADMIN_ROLES), upsertWorkforceAutomationPolicy);
router.post("/automation/simulate", protect, requireRole(...WORKFORCE_ADMIN_ROLES), simulateWorkforceAutomation);
router.get("/automation/preview", protect, requireRole(...WORKFORCE_ADMIN_ROLES), previewWorkforceEscalation);
router.post("/automation/sweep", protect, requireRole(...WORKFORCE_ADMIN_ROLES), runWorkforceAutomationSweep);

export default router;
