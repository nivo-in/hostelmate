import { Server } from 'socket.io'
import logger from './logger.js'

/** @type {import('socket.io').Server | null} */
let io = null

/**
 * Initialize Socket.io server attached to an HTTP server instance.
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production'
        ? process.env.FRONTEND_URL
        : ['http://localhost:3000', 'http://192.168.29.142:3000'],
      methods: ['GET', 'POST'],
      credentials: true
    }
  })

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`)

    socket.on('join', (userId) => {
      socket.join(`user:${userId}`)
      logger.info(`User ${userId} joined room`)
    })

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`)
    })
  })

  return io
}

/**
 * Get the initialized Socket.io instance.
 * @returns {import('socket.io').Server}
 */
export function getIO() {
  if (!io) throw new Error('Socket.io not initialized')
  return io
}

/**
 * Emit an event to a specific user's room.
 * @param {string} userId
 * @param {string} event
 * @param {object} data
 */
export function emitToUser(userId, event, data) {
  if (!io) return
  io.to(`user:${userId}`).emit(event, data)
}

/**
 * Emit an event to all connected clients.
 * @param {string} event
 * @param {object} data
 */
export function emitToAll(event, data) {
  if (!io) return
  io.emit(event, data)
}
