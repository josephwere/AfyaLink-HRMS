import express from "express";
import { getWorkflowTimeline } from "../controllers/workflowController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * WORKFLOW READ-ONLY ROUTES
 * 🔒 NEVER MUTATES STATE
 */

/**
 * GET workflow timeline + allowed transitions
 * Used by:
 * - Doctor encounter page
 * - Admin audit page
 *
 * GET /api/workflows/:encounterId/timeline
 */
router.get(
  "/:encounterId/timeline",
  requireAuth,
  getWorkflowTimeline
);

export default router;
