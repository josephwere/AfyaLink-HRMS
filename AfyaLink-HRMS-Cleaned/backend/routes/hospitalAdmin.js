const express = require("express");
const router = express.Router();
const { authenticate, authorizeRoles } = require("../middleware/auth");
const hospitalAdmin = require("../controllers/hospitalAdmin");

router.use(authenticate, authorizeRoles("hospitaladmin"));

router.post("/register-staff", hospitalAdmin.registerStaff);
router.get("/staff", hospitalAdmin.getHospitalStaff);

module.exports = router;
