import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { permit } from "../middleware/roleMiddleware.js";
import {
  bootstrapCommunicationChannels,
  listChannelMessages,
  listCommunicationChannels,
  sendChannelMessage,
} from "../controllers/communicationController.js";

const router = express.Router();

router.use(
  protect,
  permit(
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "DEVELOPER",
    "HOSPITAL_ADMIN",
    "DOCTOR",
    "NURSE",
    "LAB_TECH",
    "PHARMACIST",
    "SECURITY_ADMIN",
    "SECURITY_OFFICER",
    "RECEPTIONIST",
    "HR_MANAGER",
    "PAYROLL_OFFICER",
    "COMMUNITY_HEALTH_WORKER"
  )
);

router.post("/bootstrap", bootstrapCommunicationChannels);
router.get("/channels", listCommunicationChannels);
router.get("/channels/:channelId/messages", listChannelMessages);
router.post("/channels/:channelId/messages", sendChannelMessage);

export default router;
