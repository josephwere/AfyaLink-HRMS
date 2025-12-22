import express from 'express';
const router = express.Router();

import {
  index,
  list,
  getOne,
  invoicePdf
} from '../controllers/billingController.js';

// Dashboard summary
router.get('/', index);

// All transactions
router.get('/list', list);

// Single transaction
router.get('/:id', getOne);

// Invoice PDF
router.get('/invoice/:id', invoicePdf);

export default router;
