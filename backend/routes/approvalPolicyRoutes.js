import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { listPolicies, createPolicy, getPolicy, updatePolicy, deletePolicy, simulatePolicy } from "../controllers/approvalPolicyController.js";

const router = express.Router();

router.get("/", protect, requireRole("HOSPITAL_ADMIN", "FINANCE_MANAGER", "CFO", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"), listPolicies);
router.post("/", protect, requireRole("HOSPITAL_ADMIN", "FINANCE_MANAGER", "CFO", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"), createPolicy);
router.get("/:id", protect, requireRole("HOSPITAL_ADMIN", "FINANCE_MANAGER", "CFO", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"), getPolicy);
router.put("/:id", protect, requireRole("HOSPITAL_ADMIN", "FINANCE_MANAGER", "CFO", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"), updatePolicy);
router.delete("/:id", protect, requireRole("HOSPITAL_ADMIN", "FINANCE_MANAGER", "CFO", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"), deletePolicy);
router.post("/simulate", protect, requireRole("HOSPITAL_ADMIN", "FINANCE_MANAGER", "CFO", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"), (req, res) => simulatePolicy(req, res));

export default router;
