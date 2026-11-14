import express from 'express';
import { createEvent, getEvents } from '../controllers/eventController.js';
import { authenticate, requireClub } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticate);

// Create event (Club only)
router.post('/', requireClub, createEvent);

// List events (Club views own, Admin views all with filters)
router.get('/', getEvents);

export default router;

