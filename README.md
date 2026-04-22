# Ejercicio 11 — Deploy & DevOps

API REST de **Biblioteca Digital** (basada en el ejercicio 9, T9) preparada para producción:
**Docker** multi-stage, **docker-compose** para desarrollo, **GitHub Actions** para CI/CD,
configuración para **Railway / Render / Fly.io**, **healthchecks**, logging estructurado
con **Pino** y graceful shutdown.

## Stack

| Capa | Tecnología |
|------|------------|
| Runtime | Node.js 20 (engines: `>=20`) |
| Framework | Express 4 |
| ORM / BD | Prisma + PostgreSQL 16 |
| Auth | JWT |
| Validación | Zod (schemas + variables de entorno) |
| Logging | Pino + pino-pretty |
| Docs | Swagger (swagger-jsdoc + swagger-ui-express) |
| Tests | Jest + Supertest (servicio Postgres en CI) |
| Contenedores | Docker multi-stage + docker compose |
| CI/CD | GitHub Actions (matrix Node 20/22, GHCR) |
| Deploy | Railway · Render · Fly.io |

## Estructura

```
ejercicio11_webII_SGD/
├── .github/workflows/
│   ├── ci.yml              # tests + build/push GHCR
│   └── deploy.yml          # deploy a Railway tras CI verde
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.js
├── src/
│   ├── app.js              # Express, sin listen
│   ├── index.js            # listen + graceful shutdown
│   ├── config/
│   │   ├── env.js          # validación Zod de process.env
│   │   └── prisma.js
│   ├── controllers/
│   ├── middleware/
│   │   ├── auth.middleware.js
│   │   ├── error.middleware.js
│   │   ├── logger.middleware.js
│   │   ├── rol.middleware.js
│   │   └── validate.middleware.js
│   ├── routes/
│   │   ├── health.routes.js   # /api/health, /api/ready
│   │   └── ...
│   ├── schemas/
│   ├── docs/swagger.js
│   └── utils/
│       ├── logger.js          # Pino
│       ├── handleError.js
│       ├── handleJwt.js
│       └── handlePassword.js
├── tests/
├── Dockerfile              # multi-stage, non-root, tini, HEALTHCHECK
├── docker-compose.yml      # api + postgres
├── .dockerignore
├── railway.json            # config Railway
├── render.yaml             # config Render
├── fly.toml                # config Fly.io
├── .env.example
└── README.md
```

## Quickstart local (sin Docker)

```bash
npm install
cp .env.example .env
# Edita .env con tu DATABASE_URL local o de Supabase

npm run db:migrate:dev     # primera vez
npm run dev
```

- API:        http://localhost:3000/api
- Swagger:    http://localhost:3000/api-docs
- Health:     http://localhost:3000/api/health

## Quickstart con Docker Compose

Levanta API + Postgres con un solo comando:

```bash
docker compose up --build
```

El servicio `api` ejecuta `prisma migrate deploy` antes de arrancar, así que la BD
queda lista al primer boot. La salud se puede ver con:

```bash
curl http://localhost:3000/api/health
# { "status": "ok", "database": "connected", "uptime": 12.3, ... }
```

Comandos útiles:

```bash
docker compose logs -f api    # logs en tiempo real
docker compose exec api sh    # shell dentro del contenedor
docker compose down           # parar
docker compose down -v        # parar y borrar volúmenes (resetea BD)
```

## Variables de entorno

Validadas en arranque por `src/config/env.js` (Zod). Si falta o es inválida una
obligatoria, el proceso aborta con mensaje claro.

| Variable | Tipo | Default | Notas |
|----------|------|---------|-------|
| `NODE_ENV` | enum | `development` | `development` \| `production` \| `test` |
| `PORT` | number | `3000` | |
| `HOST` | string | `0.0.0.0` | |
| `DATABASE_URL` | string | — | Obligatoria. URL Postgres |
| `DIRECT_URL` | string | — | Opcional (Supabase) |
| `JWT_SECRET` | string | — | Obligatoria. Mín. 32 caracteres |
| `JWT_EXPIRES_IN` | string | `2h` | |
| `LOG_LEVEL` | enum | `info` | `fatal\|error\|warn\|info\|debug\|trace\|silent` |
| `CORS_ORIGIN` | string | `*` | Lista CSV en producción |

## Health & Readiness

- `GET /api/health`: devuelve 200 si la app responde y la BD acepta `SELECT 1`. En caso contrario, 503.
- `GET /api/ready`: devuelve 200 cuando la app terminó el bootstrap; 503 mientras arranca o se cierra.

Estos endpoints están **excluidos del logging de requests** para evitar ruido y se
usan tanto por el `HEALTHCHECK` del Dockerfile como por las plataformas cloud
(Railway `healthcheckPath`, Render `healthCheckPath`, Fly `http_service.checks`).

## Logging

Pino estructurado en JSON en producción y formateado (pino-pretty) en dev.
Redacta `Authorization` y campos `password` automáticamente.

```js
import logger from './utils/logger.js';

logger.info({ userId, action }, 'usuario hizo X');
logger.error({ err }, 'fallo al hacer Y');
```

`requestLogger` registra cada petición HTTP con método, ruta, status, duración e IP.

## Graceful shutdown

`src/index.js` escucha `SIGINT`/`SIGTERM`, drena el server HTTP, cierra Prisma y
sale con código 0. Si tarda más de 10 s, fuerza la salida con código 1.
El Dockerfile usa `tini` como PID 1 para reenviar correctamente las señales.

## Docker (sin compose)

```bash
# Build
docker build -t biblioteca-api .

# Run (Postgres aparte; pasa .env al contenedor)
docker run --rm -p 3000:3000 --env-file .env biblioteca-api
```

La imagen final:

- Base `node:20-alpine` (multi-stage para no incluir devDependencies)
- Usuario `nodeapp` no-root (uid 1001)
- `HEALTHCHECK` integrado contra `/api/health`
- `tini` como PID 1 para señales POSIX

## CI/CD (GitHub Actions)

Dos workflows:

### `.github/workflows/ci.yml`

Se dispara en `push` y `pull_request` sobre `main` / `develop`.

1. **test** — matrix Node 20 y 22, levanta servicio `postgres:16-alpine`,
   `prisma validate`, `prisma migrate deploy` y `npm test`.
2. **docker** — solo en `push` a `main`: build multi-stage y push a `ghcr.io`
   con tags `latest`, `sha-<commit>` y nombre de rama. Cache de capas vía GHA.

### `.github/workflows/deploy.yml`

Se dispara cuando CI termina OK en `main`. Despliega a Railway con la CLI y
hace smoke test sobre `/api/health` (5 reintentos × 15 s).

Secrets requeridos en *Settings → Secrets and variables → Actions*:

| Secret | Para qué |
|--------|----------|
| `RAILWAY_TOKEN` | Token de despliegue Railway |

## Deploy en Railway

1. Crear cuenta en [railway.app](https://railway.app) y nuevo proyecto desde el repo.
2. *New → Database → PostgreSQL*. Railway inyecta `DATABASE_URL` automáticamente.
3. *Variables*: añadir `JWT_SECRET` (≥32 caracteres) y opcionalmente `JWT_EXPIRES_IN`,
   `LOG_LEVEL`, `CORS_ORIGIN`.
4. Railway detecta el `Dockerfile` y `railway.json`. El `startCommand` aplica
   migraciones (`prisma migrate deploy`) antes de arrancar.
5. *Settings → Networking → Generate Domain* → URL pública.

```bash
curl https://<app>.up.railway.app/api/health
# { "status": "ok", "database": "connected", ... }
```

## Deploy en Render

Con `render.yaml` (Infrastructure as Code) ya definido:

1. Conectar repo en [render.com](https://render.com) → *New → Blueprint*.
2. Render lee `render.yaml`, crea el web service Docker y la BD Postgres free.
3. `JWT_SECRET` se autogenera (`generateValue: true`).
4. `preDeployCommand: npx prisma migrate deploy` corre antes de cada deploy.

## Deploy en Fly.io

```bash
fly auth login
fly launch --no-deploy        # ajusta el nombre si "biblioteca-api" está cogido
fly postgres create --name biblioteca-db --region mad
fly postgres attach biblioteca-db          # inyecta DATABASE_URL
fly secrets set JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
fly deploy
fly status
fly open
```

## Tests

```bash
npm test                  # suite completa (necesita Postgres alcanzable)
npm run test:coverage     # con cobertura
```

En CI los tests usan el servicio `postgres:16-alpine` (ver `ci.yml`); en local
puedes apuntar `DATABASE_URL` a tu Postgres de docker compose (`localhost:5432`).

## Endpoints

### Auth
| Método | Ruta | Descripción | Acceso |
|--------|------|-------------|--------|
| POST | `/api/auth/register` | Registrar usuario (password con complejidad) | Público |
| POST | `/api/auth/login` | Iniciar sesión | Público |
| GET  | `/api/auth/me` | Perfil propio | JWT |

### Books / Loans / Reviews / Stats

Mismos endpoints que el ejercicio 9. Ver Swagger en `/api-docs`.

### Health
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Liveness + ping a BD |
| GET | `/api/ready`  | Readiness probe |

## Cumplimiento del checklist de producción (T11)

- [x] Variables sensibles fuera del código (validadas con Zod)
- [x] HTTPS forzado por la plataforma (Railway/Render/Fly)
- [x] CORS configurable por variable de entorno
- [x] Validación Zod en todos los endpoints (incluida complejidad de password)
- [x] Logs estructurados con Pino (redacción de secretos)
- [x] Health check + readiness probe
- [x] Graceful shutdown (drena HTTP + cierra Prisma)
- [x] `NODE_ENV=production` en Dockerfile y configs cloud
- [x] `package-lock.json` commiteado
- [x] `.env.example` actualizado
- [x] Tests verdes en CI (Postgres real, matrix Node 20/22)
- [x] Dockerfile probado localmente con compose
