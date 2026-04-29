#!/usr/bin/env bash
set -euo pipefail

echo "🫙  Clutch v2 — setup"
echo ""

# ── .env ────────────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✓ Created .env from .env.example"
else
  echo "· .env already exists"
fi

# ── Docker ──────────────────────────────────────────────────────────────────
echo ""
echo "Starting PostgreSQL + Redis..."
docker compose up -d 2>/dev/null || docker-compose up -d 2>/dev/null

echo "Waiting for Postgres to be ready..."
until docker exec clutch-db pg_isready -U clutch > /dev/null 2>&1; do
  sleep 1
done
echo "✓ PostgreSQL is ready"

# ── DB schema ───────────────────────────────────────────────────────────────
echo ""
echo "Pushing DB schema..."
pnpm --filter @clutch/api db:push
echo "✓ Schema pushed"

echo ""
echo "🫙  Ready. Run: pnpm dev"
