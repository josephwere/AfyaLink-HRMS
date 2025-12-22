import express from "express";
import { completeLab } from "../controllers/labController.js";

const router = express.Router();

/**
 * LAB WORKFLOW ROUTE
 * LAB_ORDERED → LAB_COMPLETED
 */
router.post("/complete", completeLab);

export default router;
