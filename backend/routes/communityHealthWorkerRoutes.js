import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { permit } from "../middleware/roleMiddleware.js";
import {
  addHouseholdMember,
  createChildGrowthRecord,
  createChronicLog,
  createDiseaseReport,
  createGeoLog,
  createHousehold,
  createMaternalRecord,
  createReferral,
  createVaccinationRecord,
  getChwDashboard,
  getPerformance,
  listFieldVisits,
  listHouseholds,
  listReferrals,
  recordFieldVisit,
} from "../controllers/communityHealthWorkerController.js";

const router = express.Router();

router.use(
  protect,
  permit(
    "COMMUNITY_HEALTH_WORKER",
    "HOSPITAL_ADMIN",
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "DEVELOPER",
    "HR_MANAGER"
  )
);

router.get("/dashboard", getChwDashboard);
router.get("/households", listHouseholds);
router.post("/households", createHousehold);
router.post("/households/:id/members", addHouseholdMember);
router.post("/households/:id/visits", recordFieldVisit);
router.get("/visits", listFieldVisits);

router.post("/maternal", createMaternalRecord);
router.post("/child-growth", createChildGrowthRecord);
router.post("/vaccinations", createVaccinationRecord);
router.post("/chronic", createChronicLog);
router.post("/disease-reports", createDiseaseReport);
router.post("/referrals", createReferral);
router.get("/referrals", listReferrals);
router.get("/performance", getPerformance);
router.post("/geo-logs", createGeoLog);

export default router;

