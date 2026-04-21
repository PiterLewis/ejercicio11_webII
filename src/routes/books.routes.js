// src/routes/books.routes.js
import { Router } from 'express';
import {
  getBooksCtrl,
  getBookByIdCtrl,
  createBookCtrl,
  updateBookCtrl,
  deleteBookCtrl
} from '../controllers/books.controller.js';
import {
  getBookReviewsCtrl,
  createReviewCtrl
} from '../controllers/reviews.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import checkRol from '../middleware/rol.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createBookSchema, updateBookSchema } from '../schemas/book.schema.js';
import { createReviewSchema } from '../schemas/review.schema.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Books
 *   description: Gestión del catálogo de libros
 */

/**
 * @swagger
 * /api/books:
 *   get:
 *     summary: Listar libros (con filtros y paginación)
 *     tags: [Books]
 *     parameters:
 *       - in: query
 *         name: genre
 *         schema: { type: string }
 *       - in: query
 *         name: author
 *         schema: { type: string }
 *       - in: query
 *         name: available
 *         schema: { type: boolean }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Lista paginada de libros
 */
router.get('/', getBooksCtrl);

/**
 * @swagger
 * /api/books/{id}:
 *   get:
 *     summary: Obtener libro por ID
 *     tags: [Books]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Datos del libro con reseñas
 *       404:
 *         description: Libro no encontrado
 */
router.get('/:id', getBookByIdCtrl);

/**
 * @swagger
 * /api/books:
 *   post:
 *     summary: Crear libro (Librarian/Admin)
 *     tags: [Books]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BookInput'
 *     responses:
 *       201:
 *         description: Libro creado
 *       403:
 *         description: Sin permisos
 */
router.post(
  '/',
  authMiddleware,
  checkRol(['LIBRARIAN', 'ADMIN']),
  validate(createBookSchema),
  createBookCtrl
);

/**
 * @swagger
 * /api/books/{id}:
 *   put:
 *     summary: Actualizar libro (Librarian/Admin)
 *     tags: [Books]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Libro actualizado
 */
router.put(
  '/:id',
  authMiddleware,
  checkRol(['LIBRARIAN', 'ADMIN']),
  validate(updateBookSchema),
  updateBookCtrl
);

/**
 * @swagger
 * /api/books/{id}:
 *   delete:
 *     summary: Eliminar libro (Admin)
 *     tags: [Books]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Libro eliminado
 *       403:
 *         description: Sin permisos (solo Admin)
 */
router.delete(
  '/:id',
  authMiddleware,
  checkRol(['ADMIN']),
  deleteBookCtrl
);

/**
 * @swagger
 * /api/books/{id}/reviews:
 *   get:
 *     summary: Reseñas de un libro (público)
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista de reseñas con rating promedio
 */
router.get('/:id/reviews', getBookReviewsCtrl);

/**
 * @swagger
 * /api/books/{id}/reviews:
 *   post:
 *     summary: Crear reseña (solo usuarios que devolvieron el libro)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 5
 *               comment:
 *                 type: string
 *                 example: Excelente libro
 *     responses:
 *       201:
 *         description: Reseña creada
 *       403:
 *         description: Debes devolver el libro primero
 */
router.post(
  '/:id/reviews',
  authMiddleware,
  validate(createReviewSchema),
  createReviewCtrl
);

export default router;
