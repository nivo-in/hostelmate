import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const { combine, timestamp, printf, colorize } = winston.format;

const logFormat = printf(({ level, message, timestamp }) => {
  return `[${level}] ${timestamp} - ${message}`;
});

const fileTransport = new DailyRotateFile({
  filename: 'logs/hostelmate-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
});

const consoleTransport = new winston.transports.Console({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
});

const transports = [consoleTransport];
if (process.env.NODE_ENV !== 'test') {
  transports.push(fileTransport);
}

const logger = winston.createLogger({
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
  },
  defaultMeta: { service: 'hostelmate-api' },
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
  transports,
});

export default logger;
