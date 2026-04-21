// src/routes/reviews.routes.js
import { Router } from 'express';
import {
  deleteReviewCtrl
} from '../controllers/reviews.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Reviews
 *   description: Reseñas de libros
 */

/**
 * @swagger
 * /api/reviews/{id}:
 *   delete:
 *     summary: Eliminar mi reseña
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Reseña eliminada
 *       403:
 *         description: No es tu reseña
 *       404:
 *         description: Reseña no encontrada
 */
router.delete('/:id', authMiddleware, deleteReviewCtrl);

export default router;
