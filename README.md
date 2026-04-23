# Ejercicio 11 — Despliegue y DevOps

API REST de **Biblioteca Digital** (basada en el ejercicio 9, T9) preparada para producción:
**Docker** multi-stage, **docker-compose** para desarrollo, **GitHub Actions** para CI/CD,
configuración para **Railway / Render / Fly.io**, *healthchecks*, registro de logs estructurado
con **Pino** y apagado controlado (*graceful shutdown*).

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
| CI/CD | GitHub Actions (matriz Node 20/22, GHCR) |
| Despliegue | Railway · Render · Fly.io |

## Estructura

```
ejercicio11_webII_SGD/
├── .github/workflows/
│   ├── ci.yml              # tests + construir/publicar imagen en GHCR
│   └── deploy.yml          # despliegue a Railway tras CI verde
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

## Inicio rápido local (sin Docker)

```bash
npm install
cp .env.example .env
# Edita .env con tu DATABASE_URL y DIRECT_URL (Supabase o Postgres local)

npm run db:migrate:dev     # primera vez
npm run dev
```

- API:        http://localhost:3000/api
- Swagger:    http://localhost:3000/api-docs
- Health:     http://localhost:3000/api/health

> **Supabase (proveedor de BD del curso, T9):** en *Settings → Database* tienes
> dos cadenas de conexión. Usa el puerto **5432** para `DATABASE_URL` (conexión
> directa) y el puerto **6543** para `DIRECT_URL` (Supavisor / pooling). Prisma
> necesita ambas: `directUrl` se usa al aplicar migraciones porque el pooler no
> soporta *prepared statements*.

## Inicio rápido con Docker Compose

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
| `DATABASE_URL` | string | — | Obligatoria. Postgres runtime (Supavisor 6543 en Supabase) |
| `DIRECT_URL` | string | — | Obligatoria para `prisma migrate` (puerto 5432 en Supabase) |
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

## Apagado controlado (graceful shutdown)

`src/index.js` escucha `SIGINT`/`SIGTERM`, drena el server HTTP, cierra Prisma y
sale con código 0. Si tarda más de 10 s, fuerza la salida con código 1.
El Dockerfile usa `tini` como PID 1 para reenviar correctamente las señales.

## Docker (sin compose)

```bash
# Construir
docker build -t biblioteca-api .

# Ejecutar (Postgres aparte; pasa .env al contenedor)
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

Se dispara cuando CI termina OK en `main`. **El despliegue en sí lo realiza
la integración nativa de Railway con GitHub**: al detectar el push a `main`,
Railway rebuilda la imagen y redespliega automáticamente. Este workflow se
limita a esperar ~60 s y hacer smoke test contra la URL pública en
`/api/health` (8 reintentos × 15 s).

No se necesitan secrets adicionales de Railway para este flujo (el Project
Token no está disponible en el plan Trial). La autenticación con GitHub la
gestiona Railway en su propia integración.

## Base de datos en producción: Supabase

El curso (T9) usa **Supabase** como proveedor de PostgreSQL gestionado. Pasos:

1. Crear proyecto en [supabase.com](https://supabase.com) (región `eu-west` o cercana).
2. En *Settings → Database → Connection string* hay dos cadenas:
   - `URI` con puerto 5432 es la conexión directa. Se pone en `DATABASE_URL`.
   - `Pooling` con puerto 6543 es Supavisor. Se pone en `DIRECT_URL`.
   El pooler no soporta *prepared statements*, por eso Prisma reserva
   `directUrl` para `prisma migrate`.
3. Inyectar `DATABASE_URL`, `DIRECT_URL` y `JWT_SECRET` en la plataforma de despliegue
   (ver secciones de Railway, Render o Fly.io más abajo).

## Despliegue en Railway

1. Crear cuenta en [railway.app](https://railway.app) y nuevo proyecto desde el repo.
2. *Variables*: añadir `DATABASE_URL` y `DIRECT_URL` (de Supabase), `JWT_SECRET`
   (≥32 caracteres) y opcionalmente `JWT_EXPIRES_IN`, `LOG_LEVEL`, `CORS_ORIGIN`.
3. Railway detecta el `Dockerfile` y `railway.json`. El `startCommand` aplica
   migraciones (`prisma migrate deploy`) antes de arrancar.
4. *Settings → Networking → Generate Domain* → URL pública.

> Railway también puede crear su propio Postgres (*New → Database → PostgreSQL*)
> si prefieres no usar Supabase; en ese caso apunta `DATABASE_URL` y `DIRECT_URL`
> a la misma URL que inyecta Railway (no hay pooler separado).

```bash
curl https://<app>.up.railway.app/api/health
# { "status": "ok", "database": "connected", ... }
```

## Despliegue en Render

Con `render.yaml` (Infrastructure as Code) ya definido:

1. Conectar repo en [render.com](https://render.com) → *New → Blueprint*.
2. Render lee `render.yaml` y crea el web service Docker.
3. Añadir manualmente `DATABASE_URL` y `DIRECT_URL` (de Supabase) como secrets
   en *Environment* antes del primer deploy.
4. `JWT_SECRET` se autogenera (`generateValue: true`).
5. `preDeployCommand: npx prisma migrate deploy` corre antes de cada deploy
   (usa `DIRECT_URL`, así que debe apuntar al puerto 5432 de Supabase).

## Despliegue en Fly.io

```bash
fly auth login
fly launch --no-deploy        # ajusta el nombre si "biblioteca-api" está cogido

# Inyectar URLs de Supabase y JWT_SECRET como secrets
fly secrets set \
  DATABASE_URL="postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres" \
  DIRECT_URL="postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:6543/postgres" \
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")

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
