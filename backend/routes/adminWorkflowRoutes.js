import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { adminOverrideWorkflow } from "../controllers/adminWorkflowController.js";

const router = express.Router();

/**
 * ADMIN WORKFLOW OVERRIDES
 */
router.post(
  "/override",
  requireAuth,
  adminOverrideWorkflow
);

export default router;
