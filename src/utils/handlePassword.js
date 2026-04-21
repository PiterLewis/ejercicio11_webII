// src/utils/handlePassword.js — Utilidades para hash y comparación de contraseñas
import bcryptjs from 'bcryptjs';

export const encrypt = async (clearPassword) => {
  return bcryptjs.hash(clearPassword, 10);
};

export const compare = async (clearPassword, hashedPassword) => {
  return bcryptjs.compare(clearPassword, hashedPassword);
};
