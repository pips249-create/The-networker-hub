#!/usr/bin/env bash
# Create or update a hub login via setup-admin (requires ADMIN_SETUP_SECRET from Vercel).
# Usage:
#   export ADMIN_SETUP_SECRET='your-secret-from-vercel'
#   ./scripts/create-hub-user.sh rosie@the-networker.co.uk 'HerPassword' 'Rosie McGilvray' client
#
# Roles: admin | client  (default: client)

set -euo pipefail

EMAIL="${1:-}"
PASSWORD="${2:-}"
NAME="${3:-}"
ROLE="${4:-client}"
SITE="${SITE_URL:-https://the-networker-hub.vercel.app}"

if [ -z "$EMAIL" ] || [ -z "$PASSWORD" ]; then
  echo "Usage: ADMIN_SETUP_SECRET=... $0 <email> <password> [name] [role]" >&2
  exit 1
fi

if [ -z "${ADMIN_SETUP_SECRET:-}" ]; then
  echo "Error: set ADMIN_SETUP_SECRET (Vercel → Environment Variables)." >&2
  exit 1
fi

if [ "${#PASSWORD}" -lt 8 ]; then
  echo "Error: password must be at least 8 characters." >&2
  exit 1
fi

BODY=$(node -e "
console.log(JSON.stringify({
  secret: process.env.ADMIN_SETUP_SECRET,
  email: process.argv[1],
  password: process.argv[2],
  name: process.argv[3] || '',
  role: process.argv[4] || 'client'
}));
" "$EMAIL" "$PASSWORD" "$NAME" "$ROLE")

curl -sS -X POST "$SITE/api/auth/setup-admin" \
  -H "Content-Type: application/json" \
  -d "$BODY" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log(JSON.stringify(j,null,2));process.exit(j.ok?0:1)})"
