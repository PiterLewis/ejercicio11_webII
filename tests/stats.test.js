// tests/stats.test.js — Tests de estadísticas y préstamos vencidos
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';

describe('Stats Endpoints', () => {
  let librarianToken = '';
  let userToken = '';

  beforeAll(async () => {
    const { encrypt } = await import('../src/utils/handlePassword.js');
    const { tokenSign } = await import('../src/utils/handleJwt.js');
    const hashedPass = await encrypt('TestPassword123');

    const librarian = await prisma.user.create({
      data: {
        name: 'Stats Librarian',
        email: `statslib_${Date.now()}@test.com`,
        password: hashedPass,
        role: 'LIBRARIAN'
      }
    });
    librarianToken = tokenSign(librarian);

    const user = await prisma.user.create({
      data: {
        name: 'Stats User',
        email: `statsuser_${Date.now()}@test.com`,
        password: hashedPass,
        role: 'USER'
      }
    });
    userToken = tokenSign(user);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { name: { in: ['Stats Librarian', 'Stats User'] } }
    });
    await prisma.$disconnect();
  });

  describe('GET /api/stats', () => {
    it('debería devolver estadísticas para LIBRARIAN', async () => {
      const res = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${librarianToken}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('totals');
      expect(res.body.data).toHaveProperty('loansByStatus');
      expect(res.body.data).toHaveProperty('mostBorrowed');
      expect(res.body.data).toHaveProperty('bestRated');
      expect(typeof res.body.data.totals.books).toBe('number');
      expect(typeof res.body.data.totals.users).toBe('number');
    });

    it('debería rechazar para rol USER', async () => {
      await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('debería rechazar sin autenticación', async () => {
      await request(app).get('/api/stats').expect(401);
    });
  });

  describe('PUT /api/stats/overdue', () => {
    it('debería marcar préstamos vencidos y devolver la lista', async () => {
      const res = await request(app)
        .put('/api/stats/overdue')
        .set('Authorization', `Bearer ${librarianToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('debería rechazar para rol USER', async () => {
      await request(app)
        .put('/api/stats/overdue')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });
});
