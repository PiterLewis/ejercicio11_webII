// src/schemas/loan.schema.js — Validaciones Zod para préstamos
import { z } from 'zod';

export const createLoanSchema = z.object({
  body: z.object({
    bookId: z.number().int().positive()
  })
});
