// src/middleware/logger.middleware.js — Middleware de logging de peticiones HTTP
import logger from '../utils/logger.js';

export const requestLogger = (req, res, next) => {
  // No loggear endpoints de health para evitar ruido en producción
  if (req.path === '/api/health' || req.path === '/api/ready') {
    return next();
  }

  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationNs = process.hrtime.bigint() - start;
    const durationMs = Number(durationNs / 1_000_000n);

    const payload = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs,
      ip: req.ip,
      userAgent: req.get('user-agent')
    };

    if (res.statusCode >= 500) {
      logger.error(payload, 'request error');
    } else if (res.statusCode >= 400) {
      logger.warn(payload, 'request warn');
    } else {
      logger.info(payload, 'request');
    }
  });

  next();
};
