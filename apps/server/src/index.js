import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'

import { generalLimiter } from './middleware/rateLimit.js'
import { errorHandler } from './middleware/errorHandler.js'
import requestLogger from './middleware/requestLogger.js'
import logger from './config/logger.js'
import { redis } from './config/redis.js'

import attendanceRoutes from './routes/attendance.js'
import leavesRoutes from './routes/leaves.js'
import complaintsRoutes from './routes/complaints.js'
import messRoutes from './routes/mess.js'
import noticesRoutes from './routes/notices.js'
import lostFoundRoutes from './routes/lost-found.js'
import statsRoutes from './routes/stats.js'
import staffFeedbackRoutes from './routes/staff-feedback.js'
import curfewRoutes from './routes/curfew.js'
import notificationsRoutes from './routes/notifications.js'
import roomsRoutes from './routes/rooms.js'
import auditRoutes from './routes/audit.js'

const app = express()
const PORT = process.env.PORT || 3001

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
  apis: ['./src/routes/*.js'], // Assuming we might add swagger annotations later
}

const swaggerSpec = swaggerJsdoc(swaggerOptions)
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// Middleware
app.use(helmet())
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:5173'] }))
app.use(morgan('dev'))
app.use(express.json())
app.use(generalLimiter)
app.use(requestLogger)

// Health check
let redisStatus = 'disconnected'

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date(),
    redis: redisStatus
  })
})

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    product: 'HostelMate',
    company: 'Nivo',
    version: '1.0.0'
  })
})

// Routes
app.use('/api/attendance', attendanceRoutes)
app.use('/api/leaves', leavesRoutes)
app.use('/api/complaints', complaintsRoutes)
app.use('/api/mess', messRoutes)
app.use('/api/notices', noticesRoutes)
app.use('/api/lost-found', lostFoundRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/staff-feedback', staffFeedbackRoutes)
app.use('/api/curfew', curfewRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/rooms', roomsRoutes)
app.use('/api/audit', auditRoutes)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' })
})

// Global error handler
app.use(errorHandler)

// Start server
const server = app.listen(PORT, '0.0.0.0', async () => {
  logger.info(`HostelMate server running on port ${PORT}`)
  
  try {
    await redis.ping()
    redisStatus = 'connected'
    logger.info('Redis connected successfully')
  } catch (err) {
    redisStatus = 'disconnected'
    logger.warn('Redis connection failed — caching disabled')
  }
})

server.on('error', (err) => {
  logger.error('Server error:', err)
})

export default app