// src/middleware/error.middleware.js — Manejador global de errores Prisma y Express
import { Prisma } from '@prisma/client';
import logger from '../utils/logger.js';
import { isProduction } from '../config/env.js';

export const errorMiddleware = (err, req, res, next) => {
  logger.error({ err, path: req.originalUrl }, 'errorMiddleware');

  // Errores conocidos de Prisma
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        return res.status(409).json({
          error: true,
          message: `El campo ${err.meta?.target} ya existe`
        });
      case 'P2025':
        return res.status(404).json({
          error: true,
          message: 'Registro no encontrado'
        });
      case 'P2003':
        return res.status(400).json({
          error: true,
          message: 'Error de referencia: el registro relacionado no existe'
        });
      default:
        return res.status(400).json({
          error: true,
          message: 'Error de base de datos',
          code: err.code
        });
    }
  }

  // Errores de validación de Prisma
  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      error: true,
      message: 'Datos inválidos'
    });
  }

  // Error genérico
  const status = err.status || 500;
  res.status(status).json({
    error: true,
    message: isProduction && status === 500
      ? 'Error interno del servidor'
      : (err.message || 'Error interno del servidor')
  });
};
