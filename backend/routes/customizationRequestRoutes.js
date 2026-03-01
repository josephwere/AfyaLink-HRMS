import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createCustomizationRequest,
  listCustomizationRequests,
  updateCustomizationRequestStatus,
} from "../controllers/customizationRequestController.js";

const router = express.Router();

router.use(protect);

router.get("/", listCustomizationRequests);
router.post("/", createCustomizationRequest);
router.patch("/:id/status", updateCustomizationRequestStatus);

export default router;

