// src/schemas/book.schema.js — Validaciones Zod para libros
import { z } from 'zod';

export const createBookSchema = z.object({
  body: z.object({
    isbn: z.string().min(1).trim(),
    title: z.string().min(1).max(255).trim(),
    author: z.string().min(1).max(255).trim(),
    genre: z.string().min(1).max(100).trim(),
    description: z.string().optional(),
    publishedYear: z.number().int().min(1000).max(new Date().getFullYear()),
    copies: z.number().int().min(1)
  })
});

export const updateBookSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(255).trim().optional(),
    author: z.string().min(1).max(255).trim().optional(),
    genre: z.string().min(1).max(100).trim().optional(),
    description: z.string().optional(),
    publishedYear: z.number().int().min(1000).max(new Date().getFullYear()).optional(),
    copies: z.number().int().min(1).optional()
  })
});
