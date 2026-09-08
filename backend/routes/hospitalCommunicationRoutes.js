import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { permit } from "../middleware/roleMiddleware.js";
import {
  createHospitalBroadcastItem,
  getHospitalCommunicationAnalyticsSummary,
  getHospitalTemplatePreview,
  listHospitalBroadcasts,
  listHospitalCommunicationTemplates,
  listHospitalNotificationLogs,
  sendHospitalBroadcastNow,
  upsertHospitalCommunicationTemplate,
} from "../controllers/hospitalCommunicationController.js";

const router = express.Router();

router.use(
  protect,
  permit("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN")
);

router.get("/templates", listHospitalCommunicationTemplates);
router.get("/templates/preview", getHospitalTemplatePreview);
router.post("/templates", upsertHospitalCommunicationTemplate);
router.get("/broadcasts", listHospitalBroadcasts);
router.post("/broadcasts", createHospitalBroadcastItem);
router.post("/broadcasts/:broadcastId/send", sendHospitalBroadcastNow);
router.get("/analytics", getHospitalCommunicationAnalyticsSummary);
router.get("/analytics/drilldown", getHospitalCommunicationAnalyticsSummary);
router.get("/logs", listHospitalNotificationLogs);

export default router;
