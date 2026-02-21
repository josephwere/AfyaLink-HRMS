import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { triggerAction } from "../controllers/actionController.js";

const router = express.Router();

router.post("/trigger", protect, triggerAction);

export default router;
