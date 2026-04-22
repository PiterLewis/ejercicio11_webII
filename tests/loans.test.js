// tests/loans.test.js — Tests del sistema de préstamos
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';

describe('Loans Endpoints', () => {
  let userToken = '';
  let librarianToken = '';
  let testBookId = null;
  let loanId = null;

  beforeAll(async () => {
    const { encrypt } = await import('../src/utils/handlePassword.js');
    const { tokenSign } = await import('../src/utils/handleJwt.js');
    const hashedPass = await encrypt('TestPassword123');

    const user = await prisma.user.create({
      data: {
        name: 'Loan User Test',
        email: `loanuser_${Date.now()}@test.com`,
        password: hashedPass,
        role: 'USER'
      }
    });
    userToken = tokenSign(user);

    const librarian = await prisma.user.create({
      data: {
        name: 'Loan Librarian Test',
        email: `loanlib_${Date.now()}@test.com`,
        password: hashedPass,
        role: 'LIBRARIAN'
      }
    });
    librarianToken = tokenSign(librarian);

    // Crear libro para préstamos
    const book = await prisma.book.create({
      data: {
        isbn: `978-LOAN-${Date.now()}`,
        title: 'Libro para Préstamos',
        author: 'Autor',
        genre: 'Test',
        publishedYear: 2023,
        copies: 2,
        available: 2
      }
    });
    testBookId = book.id;
  });

  afterAll(async () => {
    if (testBookId) {
      await prisma.loan.deleteMany({ where: { bookId: testBookId } });
      await prisma.book.deleteMany({ where: { id: testBookId } });
    }
    await prisma.user.deleteMany({ where: { name: { in: ['Loan User Test', 'Loan Librarian Test'] } } });
    await prisma.$disconnect();
  });

  describe('POST /api/loans', () => {
    it('debería rechazar sin autenticación', async () => {
      await request(app)
        .post('/api/loans')
        .send({ bookId: testBookId })
        .expect(401);
    });

    it('debería crear un préstamo', async () => {
      const res = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ bookId: testBookId })
        .expect(201);

      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.bookId).toBe(testBookId);
      loanId = res.body.data.id;
    });

    it('debería rechazar préstamo duplicado del mismo libro', async () => {
      const res = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ bookId: testBookId })
        .expect(400);

      expect(res.body.error).toBe(true);
    });
  });

  describe('GET /api/loans', () => {
    it('debería obtener mis préstamos', async () => {
      const res = await request(app)
        .get('/api/loans')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('debería rechazar sin autenticación', async () => {
      await request(app).get('/api/loans').expect(401);
    });
  });

  describe('GET /api/loans/all', () => {
    it('debería obtener todos los préstamos con rol LIBRARIAN', async () => {
      const res = await request(app)
        .get('/api/loans/all')
        .set('Authorization', `Bearer ${librarianToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
    });

    it('debería rechazar para rol USER', async () => {
      await request(app)
        .get('/api/loans/all')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('PUT /api/loans/:id/return', () => {
    it('debería devolver el libro', async () => {
      const res = await request(app)
        .put(`/api/loans/${loanId}/return`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data.status).toBe('RETURNED');
      expect(res.body.data.returnDate).not.toBeNull();
    });

    it('debería rechazar devolución duplicada', async () => {
      const res = await request(app)
        .put(`/api/loans/${loanId}/return`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(res.body.error).toBe(true);
    });
  });
});
