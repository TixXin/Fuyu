#!/bin/sh
here=$(cd "$(dirname "$0")" && pwd)
config="$here/agent-approval.json"
[ -f "$config" ] || exit 0
port=$(/usr/bin/plutil -extract port raw -o - "$config" 2>/dev/null)
token=$(/usr/bin/plutil -extract token raw -o - "$config" 2>/dev/null)
case "$port" in ""|*[!0-9]*) exit 0 ;; esac
[ -n "$token" ] || exit 0
answer=$(/usr/bin/curl -s --noproxy '*' --connect-timeout 0.3 -m 140 \
  -H "Authorization: Bearer $token" -H 'Content-Type: application/json' \
  --data-binary @- "http://127.0.0.1:$port/codex/permission-request" 2>/dev/null) || exit 0
answer=$(printf '%s' "$answer" | tr -d '\r')
[ -n "$answer" ] && [ "$answer" != '{}' ] && printf '%s' "$answer"
exit 0
