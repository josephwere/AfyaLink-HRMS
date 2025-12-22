import express from 'express';
import { index, list } from '../controllers/notificationsController.js';
const router = express.Router();

router.get('/', index);
router.get('/list', list);

export default router;
