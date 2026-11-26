
import express from 'express';
import {
  submitBorrowingRequest,
  approveBorrowingRequest,
  rejectBorrowingRequest,
  cancelBorrowingRequest,
  getBorrowingRequests,
  getBorrowingRequestById,
  submitResourceReturn,
  completeBorrowingRequest,
  markResourceBorrowed
} from '../controllers/borrowingRequestController.js';
import {
  initiateReturn,
  verifyReturn,
} from '../controllers/borrowingController.js';

import { authenticate, requireClub } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticate);

// GET: Club and Admin
router.get('/', getBorrowingRequests);
router.get('/:requestId', getBorrowingRequestById);

// POST/PATCH: Club only
router.post('/', requireClub, submitBorrowingRequest);
router.patch('/:requestId/approve', requireClub, approveBorrowingRequest);
router.patch('/:requestId/reject', requireClub, rejectBorrowingRequest);
router.patch('/:requestId/cancel', requireClub, cancelBorrowingRequest);
router.patch('/:requestId/return', requireClub, submitResourceReturn);
router.patch('/:requestId/complete', requireClub, completeBorrowingRequest);
router.patch('/:requestId/borrow', requireClub, markResourceBorrowed);
router.patch('/:requestId/initiate-return', requireClub, initiateReturn);
router.post('/:requestId/return', requireClub, verifyReturn);

export default router;
