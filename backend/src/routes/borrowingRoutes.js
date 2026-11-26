import express from 'express';
import {
  createBorrowingRequest,
  getBorrowingRequests,
  getBorrowingRequestById,
  approveBorrowingRequest,
  rejectBorrowingRequest,
  markBorrowed,
  cancelBorrowingRequest,
  initiateReturn,
  verifyReturn,
} from '../controllers/borrowingController.js';
import { authenticate, requireClub } from '../middlewares/auth.js';

const router = express.Router();

// All borrowing-request routes require authentication
router.use(authenticate);

// List & Create
router.get('/', getBorrowingRequests);
router.post('/', requireClub, createBorrowingRequest);

// Details
router.get('/:requestId', getBorrowingRequestById);

// State Transitions
router.patch('/:requestId/approve', requireClub, approveBorrowingRequest);
router.patch('/:requestId/reject', requireClub, rejectBorrowingRequest);
router.patch('/:requestId/borrow', requireClub, markBorrowed);
router.patch('/:requestId/cancel', requireClub, cancelBorrowingRequest);
router.patch('/:requestId/initiate-return', requireClub, initiateReturn);
router.post('/:requestId/return', requireClub, verifyReturn);
router.patch('/:requestId/return', requireClub, verifyReturn);

export default router;
