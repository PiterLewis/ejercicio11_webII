// src/routes/stats.routes.js
import { Router } from 'express';
import { getStatsCtrl, markOverdueLoansCtrl } from '../controllers/stats.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import checkRol from '../middleware/rol.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Stats
 *   description: Estadísticas de la biblioteca
 */

/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: Estadísticas generales (libros más prestados, mejor valorados)
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas de la biblioteca
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     totals:
 *                       type: object
 *                     loansByStatus:
 *                       type: object
 *                     mostBorrowed:
 *                       type: array
 *                     bestRated:
 *                       type: array
 */
router.get(
  '/',
  authMiddleware,
  checkRol(['LIBRARIAN', 'ADMIN']),
  getStatsCtrl
);

/**
 * @swagger
 * /api/stats/overdue:
 *   put:
 *     summary: Marcar préstamos vencidos y obtener lista (Librarian/Admin)
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Préstamos marcados como OVERDUE y listado completo
 */
router.put(
  '/overdue',
  authMiddleware,
  checkRol(['LIBRARIAN', 'ADMIN']),
  markOverdueLoansCtrl
);

export default router;
