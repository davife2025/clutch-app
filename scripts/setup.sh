#!/usr/bin/env bash
set -euo pipefail

echo "🫙  Clutch v2 — setup"
echo ""

# ── .env ────────────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✓ Created .env from .env.example"
  echo ""
  echo "⚠  IMPORTANT: Update .env with your Supabase connection strings."
  echo "   Get them from: Supabase Dashboard → Settings → Database"
  echo "   • DATABASE_URL       → Transaction pooler (port 6543)"
  echo "   • DATABASE_URL_DIRECT → Direct connection (port 5432)"
  echo ""
else
  echo "· .env already exists"
fi

# ── Redis (optional, for session 11+) ──────────────────────────────────────
echo "Starting Redis..."
docker compose up -d 2>/dev/null || docker-compose up -d 2>/dev/null || echo "· Docker not available, skipping Redis"

# ── Install ─────────────────────────────────────────────────────────────────
echo ""
echo "Installing dependencies..."
pnpm install

# ── DB schema ───────────────────────────────────────────────────────────────
echo ""
echo "Pushing DB schema to Supabase..."
pnpm db:push
echo "✓ Schema pushed"

echo ""
echo "🫙  Ready. Run: pnpm dev"
