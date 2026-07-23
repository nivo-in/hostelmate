/**
 * @file apps/server/src/index.js
 * Source code module for HostelMate index.js.
 */

import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import { generalLimiter, notificationLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import requestLogger from './middleware/requestLogger.js';
import { requestId } from './middleware/requestId.js';
import logger from './config/logger.js';
import { redis } from './config/redis.js';
import { initSocket } from './config/socket.js';
import { startCurfewJob } from './config/curfewJob.js';

import attendanceRoutes from './routes/attendance.js';
import leavesRoutes from './routes/leaves.js';
import complaintsRoutes from './routes/complaints.js';
import messRoutes from './routes/mess.js';
import noticesRoutes from './routes/notices.js';
import lostFoundRoutes from './routes/lost-found.js';
import statsRoutes from './routes/stats.js';
import staffFeedbackRoutes from './routes/staff-feedback.js';
import curfewRoutes from './routes/curfew.js';
import notificationsRoutes from './routes/notifications.js';
import roomsRoutes from './routes/rooms.js';
import auditRoutes from './routes/audit.js';
import studentsRoutes from './routes/students.js';
import parentRoutes from './routes/parent.js';
import visitorsRoutes from './routes/visitors.js';
import paymentsRoutes from './routes/payments.js';
import healthRoutes from './routes/health.js';
import institutionsRoutes from './routes/institutions.js';
import aiRoutes from './routes/ai.js';
import demoRoutes from './routes/demo.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Create HTTP server and attach Socket.io
const httpServer = createServer(app);
initSocket(httpServer);

// Swagger setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'HostelMate API',
      version: '1.0.0',
      description: 'Smart hostel management API by Nivo Technologies',
    },
    servers: [
      {
        url: 'http://localhost:3001',
      },
    ],
  },
  apis: ['./src/routes/*.js', './src/docs/*.js'], // Assuming we might add swagger annotations later
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl)
      if (!origin) {return callback(null, true);}
      // Allow localhost and local network IPs
      if (
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        origin.match(/^https?:\/\/192\.168\.\d+\.\d+/) ||
        origin.match(/^https?:\/\/10\.\d+\.\d+\.\d+/)
      ) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(morgan('dev'));
app.use(express.json());
app.use(generalLimiter);
app.use(requestId);
app.use(requestLogger);

// Health check
app.use('/health', healthRoutes);

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    product: 'HostelMate',
    company: 'Nivo',
    version: '1.0.0',
  });
});

// Routes version 1
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/leaves', leavesRoutes);
app.use('/api/v1/complaints', complaintsRoutes);
app.use('/api/v1/mess', messRoutes);
app.use('/api/v1/notices', noticesRoutes);
app.use('/api/v1/lost-found', lostFoundRoutes);
app.use('/api/v1/stats', statsRoutes);
app.use('/api/v1/staff-feedback', staffFeedbackRoutes);
app.use('/api/v1/curfew', curfewRoutes);
app.use('/api/v1/notifications', notificationLimiter, notificationsRoutes);
app.use('/api/v1/rooms', roomsRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/students', studentsRoutes);
app.use('/api/v1/parent', parentRoutes);
app.use('/api/v1/visitors', visitorsRoutes);
app.use('/api/v1/payments', paymentsRoutes);
app.use('/api/v1/institutions', institutionsRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/demo', demoRoutes);

// Backward compatibility redirect
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/v1')) {return next();}
  res.redirect(307, `/api/v1${req.url}`);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Global error handler
app.use(errorHandler);

// Start server
let server;
if (process.env.NODE_ENV !== 'test') {
  server = httpServer.listen(PORT, '0.0.0.0', async () => {
    logger.info(`HostelMate server running on port ${PORT}`);

    try {
      await redis.ping();
      logger.info('Redis connected successfully');
      startCurfewJob();
    } catch (err) {
      logger.warn('Redis connection failed — caching disabled');
    }
  });

  server.on('error', (err) => {
    logger.error('Server error:', err);
  });
}

export default app;
