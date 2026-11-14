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
import { sendError, sendSuccess } from './utils/response.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and body parsers
app.use(cors());
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

// Only listen when run directly (allows importing in tests if needed)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[EventPool API] Server running on port ${PORT}`);
    console.log(`[EventPool API] Base URL: http://localhost:${PORT}/api`);
  });
}

export default app;

