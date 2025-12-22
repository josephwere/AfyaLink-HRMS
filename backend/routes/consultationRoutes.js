import express from "express";
import auth from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import { audit } from "../middleware/audit.js";
import { finishConsultation } from "../controllers/consultationController.js";

const router = express.Router();

router.post(
  "/complete",
  auth,
  authorize("consultation", "complete"),
  audit("CONSULTATION_COMPLETE", "consultation"),
  finishConsultation
);

export default router;
