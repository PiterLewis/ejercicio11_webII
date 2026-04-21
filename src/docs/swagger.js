// src/docs/swagger.js — Configuración de Swagger/OpenAPI
import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'API Biblioteca Digital',
      version: '1.0.0',
      description: 'API REST para gestión de biblioteca digital con Supabase + Prisma. Incluye sistema de préstamos, reseñas y control de inventario.',
      license: {
        name: 'MIT',
        url: 'https://spdx.org/licenses/MIT.html'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Servidor de desarrollo'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        RegisterInput: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: { type: 'string', example: 'María García' },
            email: { type: 'string', format: 'email', example: 'maria@ejemplo.com' },
            password: { type: 'string', format: 'password', example: 'MiPassword123' }
          }
        },
        LoginInput: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'maria@ejemplo.com' },
            password: { type: 'string', format: 'password', example: 'MiPassword123' }
          }
        },
        BookInput: {
          type: 'object',
          required: ['isbn', 'title', 'author', 'genre', 'publishedYear', 'copies'],
          properties: {
            isbn: { type: 'string', example: '978-0-7432-7356-5' },
            title: { type: 'string', example: 'El Señor de los Anillos' },
            author: { type: 'string', example: 'J.R.R. Tolkien' },
            genre: { type: 'string', example: 'Fantasía' },
            description: { type: 'string', example: 'Una épica aventura...' },
            publishedYear: { type: 'integer', example: 1954 },
            copies: { type: 'integer', example: 5 }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Error message' }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.js', './src/routes/**/*.js']
};

export default swaggerJsdoc(options);
