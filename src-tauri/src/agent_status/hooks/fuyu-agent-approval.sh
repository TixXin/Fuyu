#!/bin/sh
case "${1:-codex}" in
  codex) route=codex/permission-request ;;
  workbuddy) route=workbuddy/permission-request ;;
  qoder) route=qoder/permission-request ;;
  zcode) route=zcode/permission-request ;;
  codebuddy) route=codebuddy/permission-request ;;
  qwen) route=qwen/permission-request ;;
  copilot) route=copilot/permission-request ;;
  trae) route=trae/pre-tool-use ;;
  traeCn) route=traeCn/pre-tool-use ;;
  antigravity) route=antigravity/pre-tool-use ;;
  droid) route=droid/pre-tool-use ;;
  dsh) route=dsh/pre-tool-use ;;
  *) exit 0 ;;
esac
here=$(cd "$(dirname "$0")" && pwd)
config="$here/agent-approval.json"
[ -f "$config" ] || exit 0
port=$(/usr/bin/plutil -extract port raw -o - "$config" 2>/dev/null)
token=$(/usr/bin/plutil -extract token raw -o - "$config" 2>/dev/null)
case "$port" in ""|*[!0-9]*) exit 0 ;; esac
[ -n "$token" ] || exit 0
answer=$(/usr/bin/curl -s --noproxy '*' --connect-timeout 0.3 -m 140 \
  -H "Authorization: Bearer $token" -H 'Content-Type: application/json' \
  --data-binary @- "http://127.0.0.1:$port/$route" 2>/dev/null) || exit 0
answer=$(printf '%s' "$answer" | tr -d '\r')
[ -n "$answer" ] && [ "$answer" != '{}' ] && printf '%s' "$answer"
exit 0
