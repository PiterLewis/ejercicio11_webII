// src/controllers/books.controller.js — CRUD de libros con filtros y paginación
import prisma from '../config/prisma.js';
import { handleHttpError } from '../utils/handleError.js';

// GET /api/books — Listar libros con filtros y paginación
export const getBooksCtrl = async (req, res) => {
  try {
    const {
      genre,
      author,
      title,
      available,
      page = 1,
      limit = 10
    } = req.query;

    const where = {};

    if (genre) {
      where.genre = { contains: genre, mode: 'insensitive' };
    }
    if (author) {
      where.author = { contains: author, mode: 'insensitive' };
    }
    if (title) {
      where.title = { contains: title, mode: 'insensitive' };
    }
    if (available === 'true') {
      where.available = { gt: 0 };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [books, total] = await Promise.all([
      prisma.book.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          _count: { select: { reviews: true, loans: true } }
        },
        orderBy: { title: 'asc' }
      }),
      prisma.book.count({ where })
    ]);

    res.json({
      data: books,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch {
    handleHttpError(res, 'ERROR_GET_BOOKS');
  }
};

// GET /api/books/:id — Obtener libro por ID con sus reseñas
export const getBookByIdCtrl = async (req, res) => {
  try {
    const { id } = req.params;

    const book = await prisma.book.findUnique({
      where: { id: parseInt(id) },
      include: {
        reviews: {
          include: {
            user: { select: { id: true, name: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: { select: { loans: true } }
      }
    });

    if (!book) {
      return handleHttpError(res, 'BOOK_NOT_FOUND', 404);
    }

    res.json({ data: book });
  } catch {
    handleHttpError(res, 'ERROR_GET_BOOK');
  }
};

// POST /api/books — Crear libro (Librarian/Admin)
export const createBookCtrl = async (req, res) => {
  try {
    const { isbn, title, author, genre, description, publishedYear, copies } = req.body;

    const book = await prisma.book.create({
      data: {
        isbn,
        title,
        author,
        genre,
        description,
        publishedYear,
        copies,
        available: copies
      }
    });

    res.status(201).json({ data: book });
  } catch (err) {
    if (err.code === 'P2002') {
      return handleHttpError(res, 'ISBN_ALREADY_EXISTS', 409);
    }
    handleHttpError(res, 'ERROR_CREATE_BOOK');
  }
};

// PUT /api/books/:id — Actualizar libro (Librarian/Admin)
export const updateBookCtrl = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, author, genre, description, publishedYear, copies } = req.body;

    const book = await prisma.book.findUnique({ where: { id: parseInt(id) } });
    if (!book) {
      return handleHttpError(res, 'BOOK_NOT_FOUND', 404);
    }

    // Recalcular available si se cambia copies
    const updateData = { title, author, genre, description, publishedYear };
    if (copies !== undefined) {
      const diff = copies - book.copies;
      updateData.copies = copies;
      updateData.available = Math.max(0, book.available + diff);
    }

    const updated = await prisma.book.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    res.json({ data: updated });
  } catch {
    handleHttpError(res, 'ERROR_UPDATE_BOOK');
  }
};

// DELETE /api/books/:id — Eliminar libro (Admin)
export const deleteBookCtrl = async (req, res) => {
  try {
    const { id } = req.params;

    const book = await prisma.book.findUnique({ where: { id: parseInt(id) } });
    if (!book) {
      return handleHttpError(res, 'BOOK_NOT_FOUND', 404);
    }

    await prisma.book.delete({ where: { id: parseInt(id) } });

    res.json({ message: 'Libro eliminado correctamente' });
  } catch {
    handleHttpError(res, 'ERROR_DELETE_BOOK');
  }
};
