import express from "express";
import { adminOverride } from "../controllers/workflowAdminController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post(
  "/override",
  requireAuth,
  requireRole("admin"),
  adminOverride
);

export default router;
