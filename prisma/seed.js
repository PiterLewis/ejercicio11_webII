// prisma/seed.js — Datos de prueba para la biblioteca
import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Sembrando datos de prueba...');

  // Crear usuario admin
  const adminPassword = await bcryptjs.hash('Admin1234!', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@biblioteca.com' },
    update: {},
    create: {
      email: 'admin@biblioteca.com',
      name: 'Administrador',
      password: adminPassword,
      role: 'ADMIN'
    }
  });

  // Crear bibliotecario
  const librarianPassword = await bcryptjs.hash('Librarian1234!', 10);
  const librarian = await prisma.user.upsert({
    where: { email: 'librarian@biblioteca.com' },
    update: {},
    create: {
      email: 'librarian@biblioteca.com',
      name: 'Bibliotecario',
      password: librarianPassword,
      role: 'LIBRARIAN'
    }
  });

  // Crear usuario normal
  const userPassword = await bcryptjs.hash('User1234!', 10);
  const user = await prisma.user.upsert({
    where: { email: 'user@biblioteca.com' },
    update: {},
    create: {
      email: 'user@biblioteca.com',
      name: 'Usuario Normal',
      password: userPassword,
      role: 'USER'
    }
  });

  // Crear libros de ejemplo
  const books = [
    {
      isbn: '978-0-7432-7356-5',
      title: 'El Señor de los Anillos',
      author: 'J.R.R. Tolkien',
      genre: 'Fantasía',
      description: 'Una épica aventura en la Tierra Media.',
      publishedYear: 1954,
      copies: 5,
      available: 5
    },
    {
      isbn: '978-0-06-112008-4',
      title: 'Matar a un Ruiseñor',
      author: 'Harper Lee',
      genre: 'Ficción',
      description: 'Un clásico de la literatura americana.',
      publishedYear: 1960,
      copies: 3,
      available: 3
    },
    {
      isbn: '978-0-14-028329-7',
      title: '1984',
      author: 'George Orwell',
      genre: 'Distopía',
      description: 'Una novela sobre un estado totalitario.',
      publishedYear: 1949,
      copies: 4,
      available: 4
    }
  ];

  for (const book of books) {
    await prisma.book.upsert({
      where: { isbn: book.isbn },
      update: {},
      create: book
    });
  }

  console.log('Datos de prueba creados correctamente');
  console.log('   Admin: admin@biblioteca.com / Admin1234');
  console.log('   Bibliotecario: librarian@biblioteca.com / Librarian1234');
  console.log('   Usuario: user@biblioteca.com / User1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
