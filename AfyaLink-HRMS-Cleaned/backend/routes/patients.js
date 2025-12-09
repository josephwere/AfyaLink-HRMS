const express = require('express');
const router = express.Router();
const pc = require('../controllers/patientController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// List all patients
router.get('/', 
  authenticate, 
  authorize(['admin', 'doctor', 'nurse']), 
  pc.list
);

// Get patient by ID
router.get('/:id',
  authenticate,
  authorize(['admin', 'doctor', 'nurse']),
  pc.get
);

// Create patient
router.post('/',
  authenticate,
  authorize(['admin', 'doctor', 'nurse']),
  pc.create
);

// Update patient
router.put('/:id',
  authenticate,
  authorize(['admin', 'doctor', 'nurse']),
  pc.update
);

// Add vitals (only doctors and nurses)
router.post('/:id/vitals',
  authenticate,
  authorize(['doctor', 'nurse']),
  pc.addVitals
);

module.exports = router;
