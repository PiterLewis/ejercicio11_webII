// src/controllers/loans.controller.js — Sistema de préstamos con reglas de negocio
import prisma from '../config/prisma.js';
import { handleHttpError } from '../utils/handleError.js';

const MAX_ACTIVE_LOANS = 3;
const LOAN_DURATION_DAYS = 14;

// GET /api/loans — Mis préstamos (usuario autenticado)
export const getMyLoansCtrl = async (req, res) => {
  try {
    const userId = req.user.id;

    const loans = await prisma.loan.findMany({
      where: { userId },
      include: {
        book: {
          select: { id: true, title: true, author: true, isbn: true }
        }
      },
      orderBy: { loanDate: 'desc' }
    });

    res.json({ data: loans });
  } catch {
    handleHttpError(res, 'ERROR_GET_LOANS');
  }
};

// GET /api/loans/all — Todos los préstamos (Librarian/Admin)
export const getAllLoansCtrl = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const where = {};
    if (status) where.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [loans, total] = await Promise.all([
      prisma.loan.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          user: { select: { id: true, name: true, email: true } },
          book: { select: { id: true, title: true, author: true, isbn: true } }
        },
        orderBy: { loanDate: 'desc' }
      }),
      prisma.loan.count({ where })
    ]);

    res.json({
      data: loans,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch {
    handleHttpError(res, 'ERROR_GET_ALL_LOANS');
  }
};

// POST /api/loans — Solicitar préstamo
export const createLoanCtrl = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bookId } = req.body;

    // Verificar que el libro existe
    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book) {
      return handleHttpError(res, 'BOOK_NOT_FOUND', 404);
    }

    // Verificar disponibilidad
    if (book.available <= 0) {
      return handleHttpError(res, 'BOOK_NOT_AVAILABLE', 400);
    }

    // Verificar límite de préstamos activos
    const activeLoans = await prisma.loan.count({
      where: { userId, status: 'ACTIVE' }
    });

    if (activeLoans >= MAX_ACTIVE_LOANS) {
      return handleHttpError(res, 'MAX_LOANS_REACHED', 400);
    }

    // Verificar que no tiene ya este libro prestado
    const existing = await prisma.loan.findFirst({
      where: { userId, bookId, status: 'ACTIVE' }
    });

    if (existing) {
      return handleHttpError(res, 'BOOK_ALREADY_LOANED', 400);
    }

    // Calcular fecha de vencimiento
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + LOAN_DURATION_DAYS);

    // Crear préstamo y decrementar disponibilidad (transacción)
    const loan = await prisma.$transaction(async (tx) => {
      const newLoan = await tx.loan.create({
        data: { userId, bookId, dueDate },
        include: {
          book: { select: { id: true, title: true, author: true } }
        }
      });

      await tx.book.update({
        where: { id: bookId },
        data: { available: { decrement: 1 } }
      });

      return newLoan;
    });

    res.status(201).json({ data: loan });
  } catch {
    handleHttpError(res, 'ERROR_CREATE_LOAN');
  }
};

// PUT /api/loans/:id/return — Devolver libro
export const returnLoanCtrl = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const loan = await prisma.loan.findUnique({ where: { id: parseInt(id) } });

    if (!loan) {
      return handleHttpError(res, 'LOAN_NOT_FOUND', 404);
    }

    // Solo el propietario puede devolver (o admin)
    if (loan.userId !== userId && req.user.role !== 'ADMIN') {
      return handleHttpError(res, 'NOT_ALLOWED', 403);
    }

    if (loan.status === 'RETURNED') {
      return handleHttpError(res, 'LOAN_ALREADY_RETURNED', 400);
    }

    // Actualizar préstamo e incrementar disponibilidad (transacción)
    const updated = await prisma.$transaction(async (tx) => {
      const updatedLoan = await tx.loan.update({
        where: { id: parseInt(id) },
        data: {
          status: 'RETURNED',
          returnDate: new Date()
        },
        include: {
          book: { select: { id: true, title: true, author: true } }
        }
      });

      await tx.book.update({
        where: { id: loan.bookId },
        data: { available: { increment: 1 } }
      });

      return updatedLoan;
    });

    res.json({ data: updated });
  } catch {
    handleHttpError(res, 'ERROR_RETURN_LOAN');
  }
};
