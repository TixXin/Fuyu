#!/bin/sh
agent=${1:-codex}
[ "$agent" = claudeCode ] && [ -n "$CURSOR_VERSION" ] && exit 0
case "$agent" in
  claudeCode)
    case "$2" in
      question) route=claude/ask-user-question ;;
      activity) route=claude/activity ;;
      *) route=claude/permission-request ;;
    esac ;;
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
  cursor) route=cursor/permission ;;
  *) exit 0 ;;
esac
finish() {
  if [ "$agent" = cursor ]; then
    printf '%s' '{"permission":"ask"}'
  fi
  exit 0
}
here=$(cd "$(dirname "$0")" && pwd)
body=$(cat)
for config in "$here/agent-approval.json" "$here"/agent-approval.lane-*.json; do
  [ -f "$config" ] || continue
  port=$(/usr/bin/plutil -extract port raw -o - "$config" 2>/dev/null)
  token=$(/usr/bin/plutil -extract token raw -o - "$config" 2>/dev/null)
  case "$port" in ""|*[!0-9]*) continue ;; esac
  [ -n "$token" ] || continue
  answer=$(printf '%s' "$body" | /usr/bin/curl -sf --noproxy '*' --connect-timeout 0.3 -m 140 \
    -H "Authorization: Bearer $token" -H 'Content-Type: application/json' \
    --data-binary @- "http://127.0.0.1:$port/$route" 2>/dev/null)
  case $? in
    0) ;;
    7|22) continue ;;
    *) finish ;;
  esac
  answer=$(printf '%s' "$answer" | tr -d '\r')
  if [ -n "$answer" ] && [ "$answer" != '{}' ]; then
    printf '%s' "$answer"
    exit 0
  fi
  finish
done
finish
