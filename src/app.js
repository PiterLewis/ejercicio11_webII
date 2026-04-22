// src/app.js — Configuración de Express (sin listen)
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './docs/swagger.js';
import routes from './routes/index.js';
import healthRoutes from './routes/health.routes.js';
import { requestLogger } from './middleware/logger.middleware.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { env, isProduction } from './config/env.js';

const app = express();

// Detrás de proxy/load balancer (Railway, Render, Fly): confiar en X-Forwarded-*
// para obtener IP real y esquema HTTPS. Imprescindible en producción.
if (isProduction) {
  app.set('trust proxy', 1);
}

app.use(
  cors({
    origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(','),
    credentials: true
  })
);
app.use(express.json({ limit: '1mb' }));

app.use(requestLogger);

// Health endpoints montados en /api para coincidir con el resto de la API
app.use('/api', healthRoutes);

// Documentación Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rutas de la API
app.use('/api', routes);

// Manejador global de errores
app.use(errorMiddleware);

export default app;
