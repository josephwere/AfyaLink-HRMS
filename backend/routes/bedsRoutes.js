import express from 'express';
import { listBeds, updateBed, createBed } from '../controllers/bedsController.js';
const router = express.Router();
router.get('/', listBeds);
router.post('/', createBed);
router.put('/:id', updateBed);
export default router;
