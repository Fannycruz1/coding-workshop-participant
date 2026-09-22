#!/usr/bin/env bash
# Integration smoke test: the full incident lifecycle through proxy-server.js
# and the real Lambda Function URLs. Run ./bin/start-dev.sh first.
# Helpers are duplicated from auth-service's copy on purpose — same rule as the
# shared .py files, each service folder stands alone.
set -u

API="${SMOKE_API:-http://localhost:3001/api}"
SVC=auth-service
EMAIL="smoke-inc-$(date +%s)-$$@acme.inc"
PASS="smoke-password-123"
SEEDED_PASS="Password123!"
fails=0

call() { # method path [json] [token]
    local args=(-s -o /tmp/smoke-inc.$$ -w '%{http_code}' -X "$1" "$API/$SVC$2"
                -H 'content-type: application/json')
    [ -n "${4:-}" ] && args+=(-H "authorization: Bearer $4")
    [ -n "${3:-}" ] && args+=(-d "$3")
    code=$(curl "${args[@]}")
    body=$(cat /tmp/smoke-inc.$$ 2>/dev/null); rm -f /tmp/smoke-inc.$$
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

field() { echo "$body" | sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\{0,1\}\([^,\"}]*\).*/\1/p" | head -1; }

login() { # email password -> echoes token
    call POST /login "{\"email\":\"$1\",\"password\":\"$2\"}"
    echo "$body" | sed -n 's/.*"token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p'
}

echo "Incidents smoke test against $API/incidents-service"

# --- three personas -------------------------------------------------------
call POST /register "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"full_name\":\"Smoke Reporter\",\"role\":\"employee\"}"
check "register reporter -> 201" 201 "$code"

REPORTER=$(login "$EMAIL" "$PASS")
ENGINEER=$(login "sofia.reyes@acme.inc" "$SEEDED_PASS")
ADMIN=$(login "admin@acme.inc" "$SEEDED_PASS")
check "three tokens minted" "3 3 3" \
    "$(echo "$REPORTER" | awk -F. '{print NF}') $(echo "$ENGINEER" | awk -F. '{print NF}') $(echo "$ADMIN" | awk -F. '{print NF}')"

SVC=incidents-service

# --- create and read ------------------------------------------------------
call POST /incidents '{"title":"Smoke test incident","description":"aircon down","category":"HVAC","priority":"Low","building_id":1,"floor_id":1}' "$REPORTER"
check "employee creates incident -> 201" 201 "$code"
ID=$(field id)

call GET /incidents "" "$REPORTER"
check "reporter lists own incidents -> 200" 200 "$code"

call GET "/incidents/$ID" "" "$ENGINEER"
check "engineer reads unassigned incident -> 200" 200 "$code"

call GET /incidents "" ""
check "listing without a token -> 401" 401 "$code"

# --- assign and work it ---------------------------------------------------
call POST "/incidents/$ID/assign" '{}' "$ENGINEER"
check "engineer self-assigns -> 200" 200 "$code"

call PATCH "/incidents/$ID/status" '{"to_status":"In Progress"}' "$ENGINEER"
check "status Open -> In Progress -> 200" 200 "$code"

call PATCH "/incidents/$ID/status" '{"to_status":"Closed"}' "$ENGINEER"
check "illegal In Progress -> Closed -> 409" 409 "$code"

call POST "/incidents/$ID/notes" '{"body":"any update?"}' "$REPORTER"
check "reporter adds a note -> 201" 201 "$code"

call POST "/incidents/$ID/notes" '{"body":"on it"}' "$ENGINEER"
check "assigned engineer adds a note -> 201" 201 "$code"

# --- escalate and decide --------------------------------------------------
call POST "/incidents/$ID/escalate" '{"requested_priority":"Critical","reason":"whole floor affected"}' "$ENGINEER"
check "engineer cannot escalate -> 403" 403 "$code"

call POST "/incidents/$ID/escalate" '{"requested_priority":"Critical","reason":"whole floor affected"}' "$REPORTER"
check "reporter escalates -> 201" 201 "$code"
ESC=$(field id)

call GET "/escalations?status=Pending" "" "$REPORTER"
check "non-admin cannot see the queue -> 403" 403 "$code"

call GET "/escalations?status=Pending" "" "$ADMIN"
check "admin sees the pending queue -> 200" 200 "$code"

call POST "/escalations/$ESC/decide" '{"decision":"approve"}' "$ADMIN"
check "admin approves -> 200" 200 "$code"

call GET "/incidents/$ID" "" "$ADMIN"
check "priority actually bumped to Critical" Critical "$(field priority)"

# --- delete ---------------------------------------------------------------
call DELETE "/incidents/$ID" "" "$ENGINEER"
check "engineer cannot delete -> 403" 403 "$code"

call DELETE "/incidents/$ID" "" "$ADMIN"
check "admin deletes -> 200" 200 "$code"

call GET "/incidents/$ID" "" "$ADMIN"
check "deleted incident is gone -> 404" 404 "$code"

echo
[ "$fails" -eq 0 ] && { echo "All incidents smoke checks passed."; exit 0; }
echo "$fails check(s) failed."; exit 1
