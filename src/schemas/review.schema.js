// src/schemas/review.schema.js — Validaciones Zod para reseñas
import { z } from 'zod';

export const createReviewSchema = z.object({
  body: z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(1000).optional()
  })
});
