// src/controllers/stats.controller.js — Estadísticas de la biblioteca
import prisma from '../config/prisma.js';
import { handleHttpError } from '../utils/handleError.js';

// GET /api/stats — Estadísticas generales (Admin/Librarian)
export const getStatsCtrl = async (req, res) => {
  try {
    // Conteos generales en paralelo
    const [totalBooks, totalUsers, totalLoans, totalReviews] = await Promise.all([
      prisma.book.count(),
      prisma.user.count(),
      prisma.loan.count(),
      prisma.review.count()
    ]);

    // Préstamos por estado
    const loansByStatus = await prisma.loan.groupBy({
      by: ['status'],
      _count: { id: true }
    });

    // Top 5 libros más prestados
    const mostBorrowed = await prisma.book.findMany({
      take: 5,
      orderBy: {
        loans: { _count: 'desc' }
      },
      select: {
        id: true,
        title: true,
        author: true,
        genre: true,
        available: true,
        copies: true,
        _count: { select: { loans: true } }
      }
    });

    // Top 5 libros mejor valorados (con al menos 1 reseña)
    const bestRated = await prisma.book.findMany({
      where: {
        reviews: { some: {} }
      },
      include: {
        reviews: { select: { rating: true } }
      }
    });

    const bestRatedWithAvg = bestRated
      .map((book) => {
        const avgRating =
          book.reviews.reduce((sum, r) => sum + r.rating, 0) / book.reviews.length;
        return {
          id: book.id,
          title: book.title,
          author: book.author,
          genre: book.genre,
          totalReviews: book.reviews.length,
          averageRating: Math.round(avgRating * 10) / 10
        };
      })
      .sort((a, b) => b.averageRating - a.averageRating)
      .slice(0, 5);

    res.json({
      data: {
        totals: {
          books: totalBooks,
          users: totalUsers,
          loans: totalLoans,
          reviews: totalReviews
        },
        loansByStatus: loansByStatus.reduce((acc, item) => {
          acc[item.status] = item._count.id;
          return acc;
        }, {}),
        mostBorrowed,
        bestRated: bestRatedWithAvg
      }
    });
  } catch {
    handleHttpError(res, 'ERROR_GET_STATS');
  }
};

// PUT /api/loans/overdue — Marcar préstamos vencidos (Librarian/Admin)
export const markOverdueLoansCtrl = async (req, res) => {
  try {
    const now = new Date();

    const result = await prisma.loan.updateMany({
      where: {
        status: 'ACTIVE',
        dueDate: { lt: now }
      },
      data: { status: 'OVERDUE' }
    });

    // Devolver los préstamos ahora marcados como vencidos
    const overdueLoans = await prisma.loan.findMany({
      where: { status: 'OVERDUE' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        book: { select: { id: true, title: true, isbn: true } }
      },
      orderBy: { dueDate: 'asc' }
    });

    res.json({
      message: `${result.count} préstamos marcados como vencidos`,
      data: overdueLoans
    });
  } catch {
    handleHttpError(res, 'ERROR_MARK_OVERDUE');
  }
};
