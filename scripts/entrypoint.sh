#!/bin/sh
# Entrypoint de producción: aplica migraciones pendientes y arranca la API.
# Se usa "exec" para que Node reemplace al shell y tini (PID 1) reenvíe
# correctamente SIGTERM/SIGINT al proceso Node durante el graceful shutdown.
set -e

echo "Aplicando migraciones de Prisma..."
npx prisma migrate deploy

echo "Arrancando servidor Node..."
exec node src/index.js
