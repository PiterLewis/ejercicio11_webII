// src/routes/index.js — Router principal de la API
import { Router } from 'express';
import authRoutes from './auth.routes.js';
import booksRoutes from './books.routes.js';
import loansRoutes from './loans.routes.js';
import reviewsRoutes from './reviews.routes.js';
import statsRoutes from './stats.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/books', booksRoutes);
router.use('/loans', loansRoutes);
router.use('/reviews', reviewsRoutes);
router.use('/stats', statsRoutes);

export default router;
