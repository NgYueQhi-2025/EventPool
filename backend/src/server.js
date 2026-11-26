import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import clubRoutes from './routes/clubRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import resourceRoutes from './routes/resourceRoutes.js';
import { getSustainabilityMetrics } from './controllers/borrowingController.js';
import { sendError, sendSuccess } from './utils/response.js';
import borrowingRequestRoutes from './routes/borrowingRequestRoutes.js';
import { db } from './config/firebase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Trust reverse proxy headers (Render / Fly.io / Cloud Run) so req.protocol is accurate
app.set('trust proxy', 1);

// Enable CORS and body parsers
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
  : '*';
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve local uploads folder if fallback storage is used
const uploadsPath = path.resolve(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath));

// Health check endpoint
app.get('/api/health', (req, res) => {
  return sendSuccess(res, 'EventPool API is operational', {
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Mount modular API routes on /api
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/borrowing-requests', borrowingRequestRoutes);
app.get('/api/sustainability', getSustainabilityMetrics);

// Dev / Demo reset endpoint to reset Firestore to initial testing state
app.post('/api/dev/reset-demo', async (req, res) => {
  try {
    // 1. Reset Resources to initial quantities
    await db.collection('Resources').doc('res-pekom-speaker').set({
      resourceId: 'res-pekom-speaker',
      clubId: 'club-pekom',
      itemName: 'Portable Speakers',
      category: 'Audio Equipment',
      totalQuantity: 4,
      availableQuantity: 2,
      reservedQuantity: 0,
      borrowedQuantity: 2,
      condition: 'Excellent',
      location: 'PEKOM Storeroom · Block A, FSKTM',
      description: 'Pair of wireless PA speakers with stands.',
      estimatedUnitCost: 450,
      estimatedUnitWeight: 5.5,
      isArchived: false,
      isTemporarilyUnavailable: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    await db.collection('Resources').doc('res-pekom-easels').set({
      resourceId: 'res-pekom-easels',
      clubId: 'club-pekom',
      itemName: 'Display Easels',
      category: 'Exhibition & Display',
      totalQuantity: 6,
      availableQuantity: 6,
      reservedQuantity: 0,
      borrowedQuantity: 0,
      condition: 'Good',
      location: 'PEKOM Storeroom · Block A, FSKTM',
      description: 'Adjustable wooden display easels for posters.',
      estimatedUnitCost: 65,
      estimatedUnitWeight: 1.8,
      isArchived: false,
      isTemporarilyUnavailable: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    await db.collection('Resources').doc('res-pekom-lights').set({
      resourceId: 'res-pekom-lights',
      clubId: 'club-pekom',
      itemName: 'Event String Lights',
      category: 'Lighting',
      totalQuantity: 10,
      availableQuantity: 0,
      reservedQuantity: 0,
      borrowedQuantity: 10,
      condition: 'Good',
      location: 'PEKOM Storeroom · Block A, FSKTM',
      description: 'Warm white outdoor string lights.',
      estimatedUnitCost: 35,
      estimatedUnitWeight: 0.8,
      isArchived: false,
      isTemporarilyUnavailable: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    await db.collection('Resources').doc('res-pekom-projector').set({
      resourceId: 'res-pekom-projector',
      clubId: 'club-pekom',
      itemName: 'HD Multimedia Projector',
      category: 'Audio & Visual',
      totalQuantity: 1,
      availableQuantity: 0,
      reservedQuantity: 0,
      borrowedQuantity: 1,
      condition: 'Good',
      location: 'PEKOM Storeroom · Block A, FSKTM',
      description: '1080p 3600-lumen projector.',
      estimatedUnitCost: 1200,
      estimatedUnitWeight: 2.9,
      isArchived: false,
      isTemporarilyUnavailable: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // 2. Reset Borrowing Requests to initial pending/return states
    await db.collection('BorrowingRequests').doc('req-101').set({
      requestId: 'req-101',
      resourceId: 'res-pekom-speaker',
      ownerClubId: 'club-pekom',
      requesterClubId: 'PTUM',
      quantity: 2,
      purpose: 'Culture Night 2026',
      pickupDate: '2026-11-21',
      expectedReturnDate: '2026-11-23',
      status: 'Pending',
      wouldHavePurchased: true,
      remarks: 'Will pick up after 2pm lecture.',
      createdAt: '2026-11-12T10:00:00.000Z',
      updatedAt: '2026-11-12T10:00:00.000Z',
    });

    await db.collection('BorrowingRequests').doc('req-102').set({
      requestId: 'req-102',
      resourceId: 'res-pekom-easels',
      ownerClubId: 'club-pekom',
      requesterClubId: 'UMDSC',
      quantity: 4,
      purpose: 'Student Showcase',
      pickupDate: '2026-11-24',
      expectedReturnDate: '2026-11-25',
      status: 'Pending',
      wouldHavePurchased: true,
      createdAt: '2026-11-13T10:00:00.000Z',
      updatedAt: '2026-11-13T10:00:00.000Z',
    });

    await db.collection('BorrowingRequests').doc('req-106').set({
      requestId: 'req-106',
      resourceId: 'res-pekom-lights',
      ownerClubId: 'club-pekom',
      requesterClubId: 'PTUM',
      quantity: 10,
      purpose: 'Mid-Autumn Lantern Walk',
      pickupDate: '2026-11-10',
      expectedReturnDate: '2026-11-13',
      actualReturnDate: '2026-11-13',
      status: 'Return Pending',
      wouldHavePurchased: false,
      createdAt: '2026-11-06T10:00:00.000Z',
      updatedAt: '2026-11-13T10:00:00.000Z',
    });

    await db.collection('BorrowingRequests').doc('req-108').set({
      requestId: 'req-108',
      resourceId: 'res-pekom-speaker',
      ownerClubId: 'club-pekom',
      requesterClubId: 'REC',
      quantity: 2,
      purpose: 'Robotics Demo & Pit Day',
      pickupDate: '2026-11-11',
      expectedReturnDate: '2026-11-14',
      actualReturnDate: '2026-11-14',
      status: 'Return Pending',
      wouldHavePurchased: true,
      remarks: 'Returned to FSKTM lab storage on Monday evening.',
      createdAt: '2026-11-07T10:00:00.000Z',
      updatedAt: '2026-11-14T10:00:00.000Z',
    });

    // Clean up temporary req-109 if it exists
    await db.collection('BorrowingRequests').doc('req-109').delete().catch(() => {});

    return sendSuccess(res, 'Demo data reset successfully in Firestore.');
  } catch (err) {
    console.error('Failed to reset demo data in Firestore:', err);
    return sendError(res, 'Failed to reset demo data', 'RESET_FAILED', 500);
  }
});

// 404 handler for unmapped endpoints
app.use((req, res) => {
  return sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, 'NOT_FOUND', 404);
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  const status = err.statusCode || 500;
  return sendError(res, err.message || 'Internal server error', err.code || 'INTERNAL_ERROR', status);
});

// Only listen when run directly (allows importing in tests without port conflicts)
const isEntryPoint = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isEntryPoint && process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[EventPool API] Server running on port ${PORT}`);
    console.log(`[EventPool API] Base URL: http://localhost:${PORT}/api`);
  });
}

export default app;

