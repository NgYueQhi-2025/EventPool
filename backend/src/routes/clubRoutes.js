import express from 'express';
import { getAllClubs, getClubById, updateClub } from '../controllers/clubController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getAllClubs);
router.get('/:clubId', getClubById);
router.patch('/:clubId', updateClub);

export default router;

