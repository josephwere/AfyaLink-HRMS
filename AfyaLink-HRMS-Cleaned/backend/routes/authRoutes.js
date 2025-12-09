// routes/authRoutes.js
import express from 'express';
import { loginUser, registerUser, getMe } from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/login', loginUser);
router.post('/register', registerUser);

// Protected route: get current logged-in user
router.get('/me', authenticate, getMe);

export default router;
