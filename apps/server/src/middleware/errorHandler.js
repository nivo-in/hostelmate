import logger from '../config/logger.js'

export const errorHandler = (err, req, res, next) => {
  logger.error(`${err.message} - ${req.method} ${req.originalUrl} - User: ${req.user?.id || 'anonymous'}\n${err.stack}`)

  const isDev = process.env.NODE_ENV === 'development'
  let statusCode = err.statusCode || 500
  let message = err.message || 'Internal Server Error'

  if (err.name === 'ZodError') {
    statusCode = 400
    message = 'Validation Error'
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401
    message = 'Unauthorized'
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403
    message = 'Forbidden'
  } else if (err.name === 'NotFoundError') {
    statusCode = 404
    message = 'Not Found'
  }

  const response = {
    success: false,
    error: message,
  }

  if (isDev) {
    response.stack = err.stack
    if (err.details) response.details = err.details
  }

  res.status(statusCode).json(response)
}
