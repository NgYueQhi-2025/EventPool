import express from 'express';
import { getAllClubs, getClubById, updateClub } from '../controllers/clubController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// BUG-003 Option A: Public club directory reads
router.get('/', getAllClubs);
router.get('/:clubId', getClubById);

// Protected update endpoint
router.patch('/:clubId', authenticate, updateClub);

export default router;
