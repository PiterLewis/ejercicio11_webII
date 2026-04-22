// src/index.js — Punto de entrada del servidor
import app from './app.js';
import prisma from './config/prisma.js';
import logger from './utils/logger.js';
import { env } from './config/env.js';
import { markReady, markNotReady } from './routes/health.routes.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

let server;

const startServer = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Conectado a PostgreSQL');

    server = app.listen(env.PORT, env.HOST, () => {
      logger.info(
        { port: env.PORT, host: env.HOST, env: env.NODE_ENV },
        `Servidor en http://${env.HOST}:${env.PORT}`
      );
      logger.info(`Swagger: http://${env.HOST}:${env.PORT}/api-docs`);
      markReady();
    });

    server.on('error', (err) => {
      logger.fatal({ err }, 'Error en el servidor HTTP');
      process.exit(1);
    });
  } catch (err) {
    logger.fatal({ err }, 'No se pudo iniciar el servidor');
    process.exit(1);
  }
};

// Graceful shutdown: cierra el servidor (drena conexiones) y luego Prisma.
// Si tarda más de SHUTDOWN_TIMEOUT_MS, fuerza la salida con código 1.
const shutdown = async (signal) => {
  logger.warn({ signal }, 'Señal recibida, iniciando shutdown');
  markNotReady();

  const forceExit = setTimeout(() => {
    logger.error('Timeout de shutdown alcanzado, forzando salida');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      logger.info('Servidor HTTP cerrado');
    }
    await prisma.$disconnect();
    logger.info('Prisma desconectado');
    clearTimeout(forceExit);
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error durante el shutdown');
    process.exit(1);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandledRejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaughtException');
  shutdown('uncaughtException');
});

startServer();
