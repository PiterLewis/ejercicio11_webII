// src/utils/logger.js — Logger estructurado con Pino
import pino from 'pino';
import { env, isProduction } from '../config/env.js';

const logger = pino({
  level: env.LOG_LEVEL,
  base: { pid: process.pid },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: !isProduction
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss.l' }
      }
    : undefined,
  redact: {
    paths: ['req.headers.authorization', 'password', '*.password'],
    censor: '[REDACTED]'
  }
});

export default logger;
