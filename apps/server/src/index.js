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

import attendanceRoutes from './routes/attendance.js'
import leavesRoutes from './routes/leaves.js'
import complaintsRoutes from './routes/complaints.js'
import messRoutes from './routes/mess.js'
import noticesRoutes from './routes/notices.js'
import lostFoundRoutes from './routes/lost-found.js'
import statsRoutes from './routes/stats.js'

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

// Health check
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

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' })
})

// Global error handler
app.use(errorHandler)

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`HostelMate server running on http://localhost:${PORT}`)
})

server.on('error', (err) => {
  console.error('Server error:', err)
})

export default app