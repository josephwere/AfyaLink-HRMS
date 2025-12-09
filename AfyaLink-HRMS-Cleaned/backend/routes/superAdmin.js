const express = require("express");
const router = express.Router();
const { authenticate, authorizeRoles } = require("../middleware/auth");
const superAdmin = require("../controllers/superAdmin");

router.use(authenticate, authorizeRoles("superadmin"));

router.post("/register-hospital-admin", superAdmin.registerHospitalAdmin);
router.get("/hospitals", superAdmin.getHospitals);

module.exports = router;
