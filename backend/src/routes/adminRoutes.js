import express from 'express';
import {
  getAdminProfile,
  createClub,
  deactivateClub,
  getAdminDashboard
} from '../controllers/adminController.js';
import { authenticate, requireAdmin } from '../middlewares/auth.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate, requireAdmin);

router.get('/profile', getAdminProfile);
router.post('/clubs', createClub);
router.patch('/clubs/:clubId/deactivate', deactivateClub);
router.get('/dashboard', getAdminDashboard);

export default router;

