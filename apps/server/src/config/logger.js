/**
 * @file apps/server/src/config/logger.js
 * Server configuration and helper utilities for logger operations.
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const { combine, timestamp, printf, colorize } = winston.format;

const logFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `[${level}] ${timestamp} - ${message}${metaStr}`;
});

const fileTransport = new DailyRotateFile({
  filename: 'logs/hostelmate-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
});

// Separate error-only log file for production alerting
const errorFileTransport = new DailyRotateFile({
  filename: 'logs/hostelmate-error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '10m',
  maxFiles: '30d',
  level: 'error',
});

const consoleTransport = new winston.transports.Console({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
});

const transports = [consoleTransport];
if (process.env.NODE_ENV !== 'test') {
  transports.push(fileTransport);
  transports.push(errorFileTransport);
}

const logger = winston.createLogger({
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
  },
  defaultMeta: { service: 'hostelmate-api', env: process.env.NODE_ENV || 'development' },
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
  transports,
});

export default logger;
