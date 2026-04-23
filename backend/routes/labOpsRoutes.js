import express from "express";
import {
  createLabOpsRecord,
  listLabOpsRecords,
} from "../controllers/labOpsController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(
  protect,
  requireRole("LAB_TECH", "DOCTOR", "HOSPITAL_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER")
);

router.get("/", listLabOpsRecords);
router.post("/", createLabOpsRecord);

export default router;
