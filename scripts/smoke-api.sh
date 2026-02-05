#!/bin/sh

# POSIX smoke checks for demo-critical API routes.
set -u

BASE_URL="${BASE_URL:-http://localhost:3000}"
DEMO_USER_ID="${DEMO_USER_ID:-11111111-1111-4111-8111-111111111111}"
DEMO_TEAM_ID="${DEMO_TEAM_ID:-10000000-0000-4000-8000-000000000001}"
QUIPX_SESSION_ID="${QUIPX_SESSION_ID:-60000000-0000-4000-8000-000000000001}"
WOI_GAME_ID="${WOI_GAME_ID:-50000000-0000-4000-8000-000000000001}"

failures=0

is_expected_status() {
  status="$1"
  expected_list="$2"

  for expected in $expected_list; do
    if [ "$status" = "$expected" ]; then
      return 0
    fi
  done

  return 1
}

preview_body() {
  body_file="$1"
  # Keep output readable in terminals/logs.
  tr '\n' ' ' < "$body_file" | cut -c 1-240
}

hit_endpoint() {
  name="$1"
  method="$2"
  path="$3"
  expected_statuses="$4"
  json_body="${5:-}"
  use_actor_header="${6:-1}"

  url="${BASE_URL%/}${path}"
  body_file="$(mktemp)"

  if [ "$method" = "GET" ]; then
    if [ "$use_actor_header" = "1" ]; then
      status="$(curl -sS -o "$body_file" -w "%{http_code}" -X GET \
        -H "Accept: application/json" \
        -H "x-demo-user-id: $DEMO_USER_ID" \
        "$url")"
    else
      status="$(curl -sS -o "$body_file" -w "%{http_code}" -X GET \
        -H "Accept: application/json" \
        "$url")"
    fi
  else
    if [ "$use_actor_header" = "1" ]; then
      status="$(curl -sS -o "$body_file" -w "%{http_code}" -X "$method" \
        -H "Accept: application/json" \
        -H "Content-Type: application/json" \
        -H "x-demo-user-id: $DEMO_USER_ID" \
        --data "$json_body" \
        "$url")"
    else
      status="$(curl -sS -o "$body_file" -w "%{http_code}" -X "$method" \
        -H "Accept: application/json" \
        -H "Content-Type: application/json" \
        --data "$json_body" \
        "$url")"
    fi
  fi

  if is_expected_status "$status" "$expected_statuses"; then
    printf '[PASS] %s %s -> %s\n' "$method" "$path" "$status"
  else
    failures=$((failures + 1))
    printf '[FAIL] %s %s -> %s (expected: %s)\n' "$method" "$path" "$status" "$expected_statuses"
    printf '       body: %s\n' "$(preview_body "$body_file")"
  fi

  rm -f "$body_file"
}

printf 'Base URL: %s\n' "$BASE_URL"
printf 'Demo user: %s\n' "$DEMO_USER_ID"

hit_endpoint "health" "GET" "/api/health" "200" "" "0"

hit_endpoint "quipx list" "GET" "/api/quipx/sessions?teamId=${DEMO_TEAM_ID}&limit=1" "200" "" "1"
hit_endpoint "quipx detail" "GET" "/api/quipx/sessions/${QUIPX_SESSION_ID}" "200 404" "" "1"

hit_endpoint "woi list" "GET" "/api/woi/games?teamId=${DEMO_TEAM_ID}" "200" "" "1"
hit_endpoint "woi detail" "GET" "/api/woi/games/${WOI_GAME_ID}" "200 403 404" "" "1"

hit_endpoint "public games" "GET" "/api/library/public-games?limit=5" "200" "" "0"

hit_endpoint "ai template" "POST" "/api/ai/template" "200" '{"goal":"Create a concise demo brief for reliability checks","audience":"internal demo reviewers","tone":"neutral","format":"checklist","constraints":["max 7 bullets"],"include_sections":["Objective","Checks","Fallback"]}' "1"

if [ "$failures" -gt 0 ]; then
  printf '\nSmoke checks finished with %s failure(s).\n' "$failures"
  exit 1
fi

printf '\nSmoke checks passed.\n'
