import { exportExpiringUsersCSV } from "../controllers/adminVerificationController.js";

router.get(
  "/export/unverified-users",
  auth,
  requireRole("SUPER_ADMIN", "HOSPITAL_ADMIN"),
  exportExpiringUsersCSV
);
