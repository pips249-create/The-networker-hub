#!/usr/bin/env bash
# Generates values for Vercel auth env vars (run locally — do not commit output).
set -euo pipefail

echo "=== The Networker Hub — Auth environment variables ==="
echo ""
echo "Copy each KEY and VALUE into Vercel → your project → Settings → Environment Variables"
echo "Enable Production (and Preview if you use preview URLs). Then Redeploy."
echo ""
echo "--- Generated secrets (save these somewhere safe) ---"
echo ""
SESSION_SECRET=$(openssl rand -hex 32)
ADMIN_SETUP_SECRET=$(openssl rand -hex 24)
echo "SESSION_SECRET"
echo "$SESSION_SECRET"
echo ""
echo "ADMIN_SETUP_SECRET"
echo "$ADMIN_SETUP_SECRET"
echo ""
echo "--- Fixed / you choose ---"
echo ""
echo "ADMIN_EMAIL"
echo "pips249@gmail.com"
echo ""
echo "AIRTABLE_USERS_TABLE"
echo "Users"
echo ""
echo "SITE_URL"
echo "https://the-networker-hub.vercel.app"
echo ""
read -r -s -p "ADMIN_INITIAL_PASSWORD (min 8 chars, hidden): " ADMIN_PASSWORD
echo ""
if [ "${#ADMIN_PASSWORD}" -lt 8 ]; then
  echo "Error: password must be at least 8 characters." >&2
  exit 1
fi
echo ""
echo "--- After Redeploy, run this once to create your admin user ---"
echo ""
cat <<EOF
curl -X POST https://the-networker-hub.vercel.app/api/auth/setup-admin \\
  -H "Content-Type: application/json" \\
  -d '{
    "secret": "$ADMIN_SETUP_SECRET",
    "email": "pips249@gmail.com",
    "password": "YOUR_PASSWORD_HERE",
    "name": "Pip"
  }'
EOF
echo ""
echo "(Replace YOUR_PASSWORD_HERE with the password you entered above.)"
echo ""
echo "--- Verify ---"
echo "Open: https://the-networker-hub.vercel.app/api/auth/config-check"
echo "Sign in: https://the-networker-hub.vercel.app/login.html"
