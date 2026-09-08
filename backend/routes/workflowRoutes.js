import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { listWorkItems, actionOnWorkItem, createItem } from "../controllers/workflowController.js";

const router = express.Router();

router.get("/items", protect, requireRole("ACCOUNTANT", "FINANCE_MANAGER", "CFO", "HOSPITAL_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"), listWorkItems);
router.post("/items", protect, requireRole("ACCOUNTANT", "FINANCE_MANAGER", "CFO", "HOSPITAL_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"), createItem);
router.post("/items/:id/action", protect, requireRole("ACCOUNTANT", "FINANCE_MANAGER", "CFO", "HOSPITAL_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"), actionOnWorkItem);

export default router;
