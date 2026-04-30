#!/usr/bin/env bash
# ─── Clutch API smoke test ────────────────────────────────────────────────────
# Usage: bash scripts/test-api.sh
# Requires: API running on :3001, DB seeded via setup.sh
set -euo pipefail

BASE="http://localhost:3001"
RED='\033[0;31m'
GREEN='\033[0;32m'
DIM='\033[2m'
RESET='\033[0m'

pass() { echo -e "${GREEN}✓${RESET} $1"; }
fail() { echo -e "${RED}✗${RESET} $1"; exit 1; }
dim()  { echo -e "${DIM}  → $1${RESET}"; }

echo "🫙  Clutch API smoke test"
echo ""

# ── Health ──────────────────────────────────────────────────────────────────
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/health")
[ "$STATUS" = "200" ] && pass "GET /health → 200" || fail "GET /health → $STATUS"

# ── Register ────────────────────────────────────────────────────────────────
EMAIL="test-$(date +%s)@clutch.dev"
REG=$(curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"testpass123\"}")

TOKEN=$(echo "$REG" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
USER_ID=$(echo "$REG" | grep -o '"userId":"[^"]*' | cut -d'"' -f4)
POCKET_ID=$(echo "$REG" | grep -o '"pocketId":"[^"]*' | cut -d'"' -f4)

[ -n "$TOKEN" ] && pass "POST /auth/register → token received" || fail "Register failed: $REG"
dim "userId=$USER_ID"
dim "pocketId=$POCKET_ID (auto-created)"

# ── Register duplicate → 409 ───────────────────────────────────────────────
DUP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"testpass123\"}")
[ "$DUP" = "409" ] && pass "POST /auth/register (duplicate) → 409" || fail "Expected 409, got $DUP"

# ── Login ───────────────────────────────────────────────────────────────────
LOGIN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"testpass123\"}")
LOGIN_TOKEN=$(echo "$LOGIN" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
[ -n "$LOGIN_TOKEN" ] && pass "POST /auth/login → token received" || fail "Login failed: $LOGIN"

AUTH="Authorization: Bearer $TOKEN"

# ── List pockets ────────────────────────────────────────────────────────────
POCKETS=$(curl -s "$BASE/pockets" -H "$AUTH")
COUNT=$(echo "$POCKETS" | grep -o '"id"' | wc -l)
[ "$COUNT" -ge 1 ] && pass "GET /pockets → $COUNT pocket(s)" || fail "List pockets failed: $POCKETS"

# ── Get pocket ──────────────────────────────────────────────────────────────
POCKET=$(curl -s "$BASE/pockets/$POCKET_ID" -H "$AUTH")
NAME=$(echo "$POCKET" | grep -o '"name":"[^"]*' | cut -d'"' -f4)
[ "$NAME" = "My Pocket" ] && pass "GET /pockets/:id → name='My Pocket'" || fail "Get pocket failed: $POCKET"

# ── Create second pocket ───────────────────────────────────────────────────
P2=$(curl -s -X POST "$BASE/pockets" -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{"name":"Trading Pocket"}')
P2_ID=$(echo "$P2" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
[ -n "$P2_ID" ] && pass "POST /pockets → created 'Trading Pocket'" || fail "Create pocket failed: $P2"

# ── Add wallet (Solana) ────────────────────────────────────────────────────
W1=$(curl -s -X POST "$BASE/pockets/$POCKET_ID/wallets" -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{"address":"7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV5","chain":"solana","label":"Phantom"}')
W1_ID=$(echo "$W1" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
W1_DEFAULT=$(echo "$W1" | grep -o '"isDefault":true')
[ -n "$W1_ID" ] && pass "POST /pockets/:id/wallets → Solana wallet added" || fail "Add wallet failed: $W1"
[ -n "$W1_DEFAULT" ] && pass "  first wallet is auto-default" || fail "First wallet should be default"

# ── Add wallet (EVM) ───────────────────────────────────────────────────────
W2=$(curl -s -X POST "$BASE/pockets/$POCKET_ID/wallets" -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{"address":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045","chain":"ethereum","label":"MetaMask"}')
W2_ID=$(echo "$W2" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
[ -n "$W2_ID" ] && pass "POST /pockets/:id/wallets → EVM wallet added" || fail "Add EVM wallet failed: $W2"

# ── Invalid address → 400 ──────────────────────────────────────────────────
BAD=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/pockets/$POCKET_ID/wallets" -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{"address":"not-a-real-address","chain":"solana"}')
[ "$BAD" = "400" ] && pass "POST /wallets (bad address) → 400" || fail "Expected 400, got $BAD"

# ── List wallets ────────────────────────────────────────────────────────────
WALLETS=$(curl -s "$BASE/pockets/$POCKET_ID/wallets" -H "$AUTH")
WCOUNT=$(echo "$WALLETS" | grep -o '"id"' | wc -l)
[ "$WCOUNT" -eq 2 ] && pass "GET /pockets/:id/wallets → $WCOUNT wallets" || fail "Expected 2, got $WCOUNT"

# ── Set default ─────────────────────────────────────────────────────────────
DEF=$(curl -s -X PATCH "$BASE/pockets/$POCKET_ID/wallets/$W2_ID/default" -H "$AUTH")
DEF_OK=$(echo "$DEF" | grep -o '"isDefault":true')
[ -n "$DEF_OK" ] && pass "PATCH /wallets/:id/default → MetaMask is now default" || fail "Set default failed: $DEF"

# ── Delete wallet ───────────────────────────────────────────────────────────
DEL=$(curl -s -X DELETE "$BASE/pockets/$POCKET_ID/wallets/$W1_ID" -H "$AUTH")
DEL_OK=$(echo "$DEL" | grep -o '"deleted":true')
[ -n "$DEL_OK" ] && pass "DELETE /wallets/:id → Phantom wallet removed" || fail "Delete wallet failed: $DEL"

# ── Delete pocket ───────────────────────────────────────────────────────────
PDEL=$(curl -s -X DELETE "$BASE/pockets/$P2_ID" -H "$AUTH")
PDEL_OK=$(echo "$PDEL" | grep -o '"deleted":true')
[ -n "$PDEL_OK" ] && pass "DELETE /pockets/:id → Trading Pocket deleted" || fail "Delete pocket failed: $PDEL"

# ── Unauthorized → 401 ─────────────────────────────────────────────────────
NOAUTH=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/pockets")
[ "$NOAUTH" = "401" ] && pass "GET /pockets (no token) → 401" || fail "Expected 401, got $NOAUTH"

echo ""
echo "🫙  All tests passed."
