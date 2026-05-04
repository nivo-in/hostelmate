import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(helmet())
app.use(cors({ origin: 'http://localhost:5173' }))
app.use(morgan('dev'))
app.use(express.json())

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    product: 'HostelMate',
    company: 'Nivo',
    version: '1.0.0'
  })
})

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`HostelMate server running on http://localhost:${PORT}`)
})

server.on('error', (err) => {
  console.error('Server error:', err)
})

export default app