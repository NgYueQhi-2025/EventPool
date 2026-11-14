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

// All resource routes require authentication
router.use(authenticate);

// 1. Create resource (Club only)
router.post('/', requireClub, createResource);

// 2. List resources with filters and pagination
router.get('/', getResources);

// 3. Search resources (MUST BE REGISTERED BEFORE /:resourceId)
router.get('/search', searchResources);

// 4. Get resource by ID
router.get('/:resourceId', getResourceById);

// 5. Update resource details (Club owner only)
router.patch('/:resourceId', requireClub, updateResource);

// 6. Archive resource (Club owner only)
router.patch('/:resourceId/archive', requireClub, archiveResource);

// 7. Update resource temporary availability (Club owner only)
router.patch('/:resourceId/availability', requireClub, updateAvailability);

// 8. Resource image endpoints
router.post('/:resourceId/image', requireClub, uploadResourceImage);
router.get('/:resourceId/image', getResourceImage);
router.delete('/:resourceId/image', requireClub, deleteResourceImage);

export default router;

