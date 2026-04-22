// src/routes/health.routes.js — Endpoints de health check / readiness
import { Router } from 'express';
import prisma from '../config/prisma.js';
import { env } from '../config/env.js';
import logger from '../utils/logger.js';

const router = Router();

let appReady = false;

export const markReady = () => {
  appReady = true;
};

export const markNotReady = () => {
  appReady = false;
};

/**
 * @openapi
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: Liveness y check de dependencias
 *     description: Devuelve 200 si la app responde y la BD está accesible. 503 si la BD no responde.
 *     responses:
 *       200:
 *         description: Aplicación y dependencias OK
 *       503:
 *         description: Base de datos no disponible
 */
router.get('/health', async (req, res) => {
  const payload = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    payload.database = 'connected';
    res.json(payload);
  } catch (err) {
    logger.error({ err }, 'health: DB ping falló');
    payload.status = 'error';
    payload.database = 'disconnected';
    res.status(503).json(payload);
  }
});

/**
 * @openapi
 * /api/ready:
 *   get:
 *     tags: [Health]
 *     summary: Readiness probe (Kubernetes/Cloud Run)
 *     responses:
 *       200:
 *         description: Aplicación lista para recibir tráfico
 *       503:
 *         description: Aplicación todavía arrancando o cerrándose
 */
router.get('/ready', (req, res) => {
  if (!appReady) {
    return res.status(503).json({
      status: 'not_ready',
      message: 'La aplicación no está lista'
    });
  }
  res.json({ status: 'ready', timestamp: new Date().toISOString() });
});

export default router;
