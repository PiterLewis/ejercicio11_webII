// src/schemas/auth.schema.js — Validaciones Zod para autenticación
import { z } from 'zod';

const passwordComplexity = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(64, 'La contraseña no puede superar 64 caracteres')
  .refine((value) => /[a-z]/.test(value), {
    message: 'Debe contener al menos una letra minúscula'
  })
  .refine((value) => /[A-Z]/.test(value), {
    message: 'Debe contener al menos una letra mayúscula'
  })
  .refine((value) => /[0-9]/.test(value), {
    message: 'Debe contener al menos un número'
  })
  .refine((value) => /[^A-Za-z0-9]/.test(value), {
    message: 'Debe contener al menos un carácter especial'
  });

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100).trim(),
    email: z.string().email().toLowerCase().trim(),
    password: passwordComplexity
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email().toLowerCase().trim(),
    password: z.string().min(1)
  })
});
