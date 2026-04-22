# syntax=docker/dockerfile:1.7

# Resuelve y compila dependencias en una capa cacheable. Como el proyecto usa
# Prisma, "npm ci" dispara `prisma generate` (postinstall) y deja el cliente
# preparado para la imagen final.
FROM node:20-alpine AS deps

WORKDIR /app

# Necesario para algunos binarios nativos sobre Alpine (musl).
RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci --include=dev


# Solo necesitamos el cliente de Prisma generado y node_modules de producción.
# Reinstalamos sin devDependencies para reducir tamaño final.
FROM node:20-alpine AS build

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci --omit=dev && npm cache clean --force


FROM node:20-alpine AS runner

WORKDIR /app

# OpenSSL es necesario en runtime para el cliente Prisma.
# wget se usa por el HEALTHCHECK.
RUN apk add --no-cache openssl wget tini libc6-compat

# Usuario no-root por seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S -u 1001 -G nodejs nodeapp

COPY --from=build --chown=nodeapp:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodeapp:nodejs /app/prisma ./prisma
COPY --chown=nodeapp:nodejs package*.json ./
COPY --chown=nodeapp:nodejs src ./src

USER nodeapp

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

# Healthcheck integrado de Docker: pega el endpoint /api/health.
# 30s entre intentos, 3 reintentos antes de marcar unhealthy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1

# tini como PID 1 reenvía señales correctamente (importante para SIGTERM
# en Kubernetes / Railway / Fly y el graceful shutdown).
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
