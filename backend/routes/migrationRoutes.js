import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { permit } from "../middleware/roleMiddleware.js";
import {
  createMigrationProject,
  getMigrationProject,
  listMigrationProjects,
  startMigrationDryRun,
  testMigrationConnector,
  transitionMigrationProject,
  updateMigrationProject,
} from "../controllers/migrationController.js";

const router = express.Router();

router.use(
  protect,
  permit("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN")
);

router.post("/", createMigrationProject);
router.get("/", listMigrationProjects);
router.get("/:id", getMigrationProject);
router.patch("/:id", updateMigrationProject);
router.post("/:id/transition", transitionMigrationProject);
router.post("/:id/test-connector", testMigrationConnector);
router.post("/:id/dry-run", startMigrationDryRun);

export default router;
