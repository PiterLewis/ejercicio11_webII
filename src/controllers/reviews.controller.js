// src/controllers/reviews.controller.js — Reseñas de libros con validaciones
import prisma from '../config/prisma.js';
import { handleHttpError } from '../utils/handleError.js';

// GET /api/books/:id/reviews — Reseñas de un libro (público)
export const getBookReviewsCtrl = async (req, res) => {
  try {
    const { id } = req.params;

    const book = await prisma.book.findUnique({ where: { id: parseInt(id) } });
    if (!book) {
      return handleHttpError(res, 'BOOK_NOT_FOUND', 404);
    }

    const reviews = await prisma.review.findMany({
      where: { bookId: parseInt(id) },
      include: {
        user: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calcular rating promedio
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;

    res.json({
      data: reviews,
      meta: {
        total: reviews.length,
        averageRating: avgRating ? Math.round(avgRating * 10) / 10 : null
      }
    });
  } catch {
    handleHttpError(res, 'ERROR_GET_REVIEWS');
  }
};

// POST /api/books/:id/reviews — Crear reseña (solo si ha devuelto el libro)
export const createReviewCtrl = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: bookId } = req.params;
    const { rating, comment } = req.body;

    // Verificar que el libro existe
    const book = await prisma.book.findUnique({ where: { id: parseInt(bookId) } });
    if (!book) {
      return handleHttpError(res, 'BOOK_NOT_FOUND', 404);
    }

    // Solo puede reseñar si tiene préstamo devuelto
    const returnedLoan = await prisma.loan.findFirst({
      where: {
        userId,
        bookId: parseInt(bookId),
        status: 'RETURNED'
      }
    });

    if (!returnedLoan) {
      return handleHttpError(res, 'MUST_RETURN_BOOK_FIRST', 403);
    }

    // Verificar reseña duplicada
    const existing = await prisma.review.findUnique({
      where: { userId_bookId: { userId, bookId: parseInt(bookId) } }
    });

    if (existing) {
      return handleHttpError(res, 'REVIEW_ALREADY_EXISTS', 409);
    }

    const review = await prisma.review.create({
      data: {
        userId,
        bookId: parseInt(bookId),
        rating,
        comment
      },
      include: {
        user: { select: { id: true, name: true } },
        book: { select: { id: true, title: true } }
      }
    });

    res.status(201).json({ data: review });
  } catch (err) {
    if (err.code === 'P2002') {
      return handleHttpError(res, 'REVIEW_ALREADY_EXISTS', 409);
    }
    handleHttpError(res, 'ERROR_CREATE_REVIEW');
  }
};

// DELETE /api/reviews/:id — Eliminar mi reseña
export const deleteReviewCtrl = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const review = await prisma.review.findUnique({ where: { id: parseInt(id) } });

    if (!review) {
      return handleHttpError(res, 'REVIEW_NOT_FOUND', 404);
    }

    // Solo el autor o admin puede eliminar
    if (review.userId !== userId && req.user.role !== 'ADMIN') {
      return handleHttpError(res, 'NOT_ALLOWED', 403);
    }

    await prisma.review.delete({ where: { id: parseInt(id) } });

    res.json({ message: 'Reseña eliminada correctamente' });
  } catch {
    handleHttpError(res, 'ERROR_DELETE_REVIEW');
  }
};
