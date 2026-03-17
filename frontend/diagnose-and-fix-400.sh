#!/bin/bash
# Run ON THE SERVER (10.28.30.56) when https://10.28.30.56/_next/static/* returns 400.
# It was working before = something reverted. This script checks state and re-applies the fix.
#
# Usage: sudo bash diagnose-and-fix-400.sh

set -e
TARGET="10.28.30.56"
NEXT_PORT="${NEXT_PORT:-3000}"

echo "=============================================="
echo "  Diagnose & fix 400 on https://${TARGET}/_next/static/*"
echo "=============================================="
echo ""

# 1) Who returns 400?
echo "1) Testing who returns 400..."
echo "   Request to Next.js directly (no nginx):"
STATUS_DIRECT=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: ${TARGET}" "http://127.0.0.1:${NEXT_PORT}/_next/static/chunks/webpack-28419d8740fc3718.js" 2>/dev/null || echo "fail")
echo "   -> HTTP $STATUS_DIRECT (200/404 = OK; 400 = Next is rejecting)"

echo "   Request via HTTPS (through nginx):"
STATUS_HTTPS=$(curl -sk -o /dev/null -w "%{http_code}" -H "Host: ${TARGET}" "https://${TARGET}/_next/static/chunks/webpack-28419d8740fc3718.js" 2>/dev/null || echo "fail")
echo "   -> HTTP $STATUS_HTTPS (200/404 = OK; 400 = nginx is rejecting)"
echo ""

# 2) Current nginx server_name for 443
echo "2) Current nginx config (server_name for 443)..."
for dir in /etc/nginx/sites-enabled /etc/nginx/conf.d; do
  [ -d "$dir" ] || continue
  for f in "$dir"/*; do
    [ -f "$f" ] || continue
    if grep -q "listen.*443" "$f" 2>/dev/null; then
      echo "   File: $f"
      grep -n "server_name" "$f" 2>/dev/null | head -5
      if grep -q "server_name" "$f" && ! grep "server_name" "$f" | grep -q "10.28.30.56"; then
        echo "   >>> MISSING 10.28.30.56 in server_name - this causes 400!"
      fi
      echo ""
    fi
  done
done
echo ""

# 3) Fix: add 10.28.30.56 to server_name in every 443 block
echo "3) Applying fix: add ${TARGET} to server_name in HTTPS server blocks..."
FIXED=0
for dir in /etc/nginx/sites-enabled /etc/nginx/conf.d; do
  [ -d "$dir" ] || continue
  for f in "$dir"/*; do
    [ -f "$f" ] || continue
    if grep -q "listen.*443" "$f" && grep -q "server_name" "$f" && ! grep "server_name" "$f" | grep -q "10.28.30.56"; then
      echo "   Patching: $f"
      # Add 10.28.30.56 to each server_name line that doesn't already contain it
      sed -i.bak "/server_name/{
        /10\.28\.30\.56/!s/server_name[[:space:]]/server_name ${TARGET} /
      }" "$f"
      FIXED=1
      echo "   -> Done. Backup: ${f}.bak"
    fi
  done
done

if [ "$FIXED" -eq 1 ]; then
  echo ""
  echo "   Testing nginx config..."
  if nginx -t 2>/dev/null; then
    systemctl reload nginx 2>/dev/null || service nginx reload 2>/dev/null || true
    echo "   Nginx reloaded."
  else
    echo "   Nginx test failed! Restore backups: cp $f.bak $f"
    exit 1
  fi
else
  echo "   No file needed patching (10.28.30.56 already in server_name or no 443 block found)."
  echo "   If you still get 400, ensure the server block that handles https://${TARGET} has:"
  echo "   server_name 10.28.30.56 localhost;"
fi

echo ""
echo "4) Verify: request again via HTTPS..."
STATUS_AFTER=$(curl -sk -o /dev/null -w "%{http_code}" -H "Host: ${TARGET}" "https://${TARGET}/_next/static/chunks/webpack-28419d8740fc3718.js" 2>/dev/null || echo "fail")
echo "   -> HTTP $STATUS_AFTER"
echo ""
if [ "$STATUS_AFTER" = "400" ]; then
  echo "   Still 400. Ensure: (1) You edited the config that nginx actually uses for 443."
  echo "   (2) Run: sudo nginx -T | grep -A2 'listen.*443' to see which server block handles 443."
else
  echo "   Open https://${TARGET} in the browser and hard refresh (Ctrl+Shift+R)."
fi
echo ""
