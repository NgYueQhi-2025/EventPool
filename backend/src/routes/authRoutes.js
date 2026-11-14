import express from 'express';
import { getProfile } from '../controllers/authController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// GET /api/auth/profile
router.get('/profile', authenticate, getProfile);

export default router;

