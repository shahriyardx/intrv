#!/bin/sh
set -e

echo "  → Running database migrations..."
bunx prisma migrate deploy || {
  echo ""
  echo "  ╔══════════════════════════════════════════════════════╗"
  echo "  ║  Database migration failed                           ║"
  echo "  ╚══════════════════════════════════════════════════════╝"
  echo ""
  echo "  Check that Postgres is reachable and DATABASE_URL is"
  echo "  correct. The server was not started."
  echo ""
  exit 1
}

echo "  → Starting server..."
exec bun server.js
