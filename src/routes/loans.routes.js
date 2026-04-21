// src/routes/loans.routes.js
import { Router } from 'express';
import {
  getMyLoansCtrl,
  getAllLoansCtrl,
  createLoanCtrl,
  returnLoanCtrl
} from '../controllers/loans.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import checkRol from '../middleware/rol.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createLoanSchema } from '../schemas/loan.schema.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Loans
 *   description: Sistema de préstamos de libros
 */

/**
 * @swagger
 * /api/loans:
 *   get:
 *     summary: Mis préstamos
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de préstamos del usuario
 */
router.get('/', authMiddleware, getMyLoansCtrl);

/**
 * @swagger
 * /api/loans/all:
 *   get:
 *     summary: Todos los préstamos (Librarian/Admin)
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, RETURNED, OVERDUE] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Lista paginada de todos los préstamos
 */
router.get('/all', authMiddleware, checkRol(['LIBRARIAN', 'ADMIN']), getAllLoansCtrl);

/**
 * @swagger
 * /api/loans:
 *   post:
 *     summary: Solicitar préstamo
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bookId]
 *             properties:
 *               bookId:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       201:
 *         description: Préstamo creado
 *       400:
 *         description: Límite de préstamos o libro no disponible
 */
router.post('/', authMiddleware, validate(createLoanSchema), createLoanCtrl);

/**
 * @swagger
 * /api/loans/{id}/return:
 *   put:
 *     summary: Devolver libro
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Libro devuelto correctamente
 *       400:
 *         description: El préstamo ya fue devuelto
 */
router.put('/:id/return', authMiddleware, returnLoanCtrl);

export default router;
