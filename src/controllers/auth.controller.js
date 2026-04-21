// src/controllers/auth.controller.js — Autenticación: registro, login, perfil
import prisma from '../config/prisma.js';
import { encrypt, compare } from '../utils/handlePassword.js';
import { tokenSign } from '../utils/handleJwt.js';
import { handleHttpError } from '../utils/handleError.js';

// POST /api/auth/register
export const registerCtrl = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return handleHttpError(res, 'EMAIL_ALREADY_EXISTS', 409);
    }

    const hashedPassword = await encrypt(password);
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });

    res.status(201).json({
      token: tokenSign(user),
      user
    });
  } catch (err) {
    handleHttpError(res, 'ERROR_REGISTER_USER');
  }
};

// POST /api/auth/login
export const loginCtrl = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return handleHttpError(res, 'USER_NOT_EXISTS', 404);
    }

    const isValid = await compare(password, user.password);
    if (!isValid) {
      return handleHttpError(res, 'INVALID_PASSWORD', 401);
    }

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      token: tokenSign(user),
      user: userWithoutPassword
    });
  } catch {
    handleHttpError(res, 'ERROR_LOGIN_USER');
  }
};

// GET /api/auth/me
export const getMeCtrl = async (req, res) => {
  try {
    const { password: _, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  } catch {
    handleHttpError(res, 'ERROR_GET_ME');
  }
};
