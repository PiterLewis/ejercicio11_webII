// tests/books.test.js — Tests de libros
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';

describe('Books Endpoints', () => {
  let userToken = '';
  let librarianToken = '';
  let adminToken = '';
  let bookId = null;

  const testBook = {
    isbn: `978-TEST-${Date.now()}`,
    title: 'Libro de Prueba',
    author: 'Autor Test',
    genre: 'Test',
    publishedYear: 2023,
    copies: 3
  };

  beforeAll(async () => {
    // Registrar usuarios con distintos roles
    const userRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'User Test',
        email: `user_${Date.now()}@test.com`,
        password: 'TestPassword123!'
      });
    userToken = userRes.body.token;

    // Crear librarian directamente en DB
    const { encrypt } = await import('../src/utils/handlePassword.js');
    const { tokenSign } = await import('../src/utils/handleJwt.js');

    const hashedPass = await encrypt('TestPassword123!');

    const librarian = await prisma.user.create({
      data: {
        name: 'Librarian Test',
        email: `librarian_${Date.now()}@test.com`,
        password: hashedPass,
        role: 'LIBRARIAN'
      }
    });
    librarianToken = tokenSign(librarian);

    const admin = await prisma.user.create({
      data: {
        name: 'Admin Test',
        email: `admin_${Date.now()}@test.com`,
        password: hashedPass,
        role: 'ADMIN'
      }
    });
    adminToken = tokenSign(admin);
  });

  afterAll(async () => {
    if (bookId) {
      await prisma.book.deleteMany({ where: { id: bookId } });
    }
    await prisma.user.deleteMany({ where: { name: { in: ['User Test', 'Librarian Test', 'Admin Test'] } } });
    await prisma.$disconnect();
  });

  describe('GET /api/books', () => {
    it('debería listar libros sin autenticación', async () => {
      const res = await request(app)
        .get('/api/books')
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('pagination');
    });

    it('debería aceptar filtros de género y título', async () => {
      const res = await request(app)
        .get('/api/books?genre=Test&title=Prueba&available=true')
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
    });
  });

  describe('POST /api/books', () => {
    it('debería rechazar creación sin autenticación', async () => {
      await request(app)
        .post('/api/books')
        .send(testBook)
        .expect(401);
    });

    it('debería rechazar creación para rol USER', async () => {
      await request(app)
        .post('/api/books')
        .set('Authorization', `Bearer ${userToken}`)
        .send(testBook)
        .expect(403);
    });

    it('debería crear libro con rol LIBRARIAN', async () => {
      const res = await request(app)
        .post('/api/books')
        .set('Authorization', `Bearer ${librarianToken}`)
        .send(testBook)
        .expect(201);

      expect(res.body.data.title).toBe(testBook.title);
      expect(res.body.data.available).toBe(testBook.copies);
      bookId = res.body.data.id;
    });
  });

  describe('GET /api/books/:id', () => {
    it('debería obtener libro por ID', async () => {
      const res = await request(app)
        .get(`/api/books/${bookId}`)
        .expect(200);

      expect(res.body.data.id).toBe(bookId);
    });

    it('debería devolver 404 para ID inexistente', async () => {
      await request(app)
        .get('/api/books/999999')
        .expect(404);
    });
  });

  describe('PUT /api/books/:id', () => {
    it('debería actualizar libro con rol LIBRARIAN', async () => {
      const res = await request(app)
        .put(`/api/books/${bookId}`)
        .set('Authorization', `Bearer ${librarianToken}`)
        .send({ title: 'Libro Actualizado' })
        .expect(200);

      expect(res.body.data.title).toBe('Libro Actualizado');
    });
  });

  describe('DELETE /api/books/:id', () => {
    it('debería rechazar eliminación para rol LIBRARIAN', async () => {
      await request(app)
        .delete(`/api/books/${bookId}`)
        .set('Authorization', `Bearer ${librarianToken}`)
        .expect(403);
    });

    it('debería eliminar libro con rol ADMIN', async () => {
      await request(app)
        .delete(`/api/books/${bookId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      bookId = null;
    });
  });
});
