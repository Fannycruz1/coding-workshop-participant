#!/usr/bin/env bash
# Integration smoke test: register -> login -> /me, through proxy-server.js
# and the real Lambda Function URL. Run ./bin/start-dev.sh first.
set -u

BASE="${SMOKE_BASE:-http://localhost:3001/api/auth-service}"
EMAIL="smoke-$(date +%s)-$$@acme.inc"
PASS="smoke-password-123"
fails=0

# Prints the body, sets $code to the HTTP status.
call() { # method path [json] [token]
    local args=(-s -o /tmp/smoke-body.$$ -w '%{http_code}' -X "$1" "$BASE$2"
                -H 'content-type: application/json')
    [ -n "${4:-}" ] && args+=(-H "authorization: Bearer $4")
    [ -n "${3:-}" ] && args+=(-d "$3")
    code=$(curl "${args[@]}")
    body=$(cat /tmp/smoke-body.$$ 2>/dev/null); rm -f /tmp/smoke-body.$$
}

check() { # label expected actual
    if [ "$2" = "$3" ]; then
        echo "  ok   $1"
    else
        echo "  FAIL $1: expected $2, got $3"
        echo "       body: $body"
        fails=$((fails + 1))
    fi
}

echo "Smoke test against $BASE"

call POST /register "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"full_name\":\"Smoke Test\",\"role\":\"employee\"}"
check "register new user -> 201" 201 "$code"

call POST /register "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"full_name\":\"Smoke Test\",\"role\":\"employee\"}"
check "register duplicate -> 409" 409 "$code"

call POST /login "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}"
check "login -> 200" 200 "$code"
TOKEN=$(echo "$body" | sed -n 's/.*"token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
# header.payload.signature — proves a real JWT came back, not an empty string.
check "token has 3 JWT parts" 3 "$(echo "$TOKEN" | awk -F. '{print NF}')"

call POST /login "{\"email\":\"$EMAIL\",\"password\":\"wrong\"}"
check "login wrong password -> 401" 401 "$code"

call GET /me "" "$TOKEN"
check "me with token -> 200" 200 "$code"
# The proxy used to drop the Authorization header; this is what catches that.
check "me returns our email" "$EMAIL" "$(echo "$body" | sed -n 's/.*"email"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"

call GET /me
check "me without token -> 401" 401 "$code"

echo
[ "$fails" -eq 0 ] && { echo "All smoke checks passed."; exit 0; }
echo "$fails check(s) failed."; exit 1
