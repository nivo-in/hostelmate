import logger from '../config/logger.js';

const requestLogger = (req, res, next) => {
  if (req.path === '/health') {
    return next();
  }

  const start = Date.now();
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms - ${ip}`);
  });

  next();
};

export default requestLogger;
