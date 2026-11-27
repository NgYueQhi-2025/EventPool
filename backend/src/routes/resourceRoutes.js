import express from 'express';
import {
  createResource,
  getResources,
  searchResources,
  getResourceById,
  updateResource,
  archiveResource,
  updateAvailability
} from '../controllers/resourceController.js';
import {
  uploadResourceImage,
  getResourceImage,
  deleteResourceImage
} from '../controllers/imageController.js';
import { authenticate, requireClub } from '../middlewares/auth.js';

const router = express.Router();

// BUG-003 Option A: Public read endpoints for Marketplace browsing
router.get('/', getResources);
router.get('/search', searchResources); // Must be registered BEFORE /:resourceId
router.get('/:resourceId', getResourceById);
router.get('/:resourceId/image', getResourceImage);

// Protected mutation endpoints (Club only)
router.post('/', authenticate, requireClub, createResource);
router.patch('/:resourceId', authenticate, requireClub, updateResource);
router.patch('/:resourceId/archive', authenticate, requireClub, archiveResource);
router.patch('/:resourceId/availability', authenticate, requireClub, updateAvailability);
router.post('/:resourceId/image', authenticate, requireClub, uploadResourceImage);
router.delete('/:resourceId/image', authenticate, requireClub, deleteResourceImage);

export default router;
