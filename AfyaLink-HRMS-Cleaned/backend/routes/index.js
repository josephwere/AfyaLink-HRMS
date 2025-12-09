const express = require('express');
const router = express.Router();

router.use('/auth', require('./authRoutes'));
router.use('/patients', require('./patientRoutes'));
router.use('/appointments', require('./appointmentRoutes'));
router.use('/reports', require('./reportRoutes'));
router.use('/labs', require('./labRoutes'));
router.use('/hospitals', require('./hospitalRoutes'));

module.exports = router;
