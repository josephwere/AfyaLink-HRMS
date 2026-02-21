import express from "express";
import { completeLab } from "../controllers/labController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = express.Router();

/**
 * LAB WORKFLOW ROUTE
 * LAB_ORDERED → LAB_COMPLETED
 */
router.post(
  "/complete",
  protect,
  requireRole("LAB_TECH", "DOCTOR", "HOSPITAL_ADMIN", "SUPER_ADMIN"),
  completeLab
);

export default router;
