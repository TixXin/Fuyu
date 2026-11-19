#!/bin/sh
provider=$1
case "$provider" in
  codex|claudeCode|workbuddy|dsh|qoder|codebuddy|qwen|zcode|kimiCode|grok|copilot|droid|pi|cursor) ;;
  antigravity) case "$2" in start|running|stop) ;; *) exit 1 ;; esac ;;
  trae|traeCn) case "$2" in running|stop|notification) ;; *) exit 1 ;; esac ;;
  updatedAt|statusPath|others|"") exit 1 ;;
  [A-Za-z]*)
    case "$provider" in *[!A-Za-z0-9_-]*) exit 1 ;; esac
    [ "${#provider}" -le 32 ] || exit 1
    ;;
  *) exit 1 ;;
esac
[ "$provider" = claudeCode ] && [ -n "$CURSOR_VERSION" ] && exit 0
marker="agent-$provider-running.flag"
hold="agent-$provider-running-hold.flag"

dir=${FOCUSD_AGENT_STATUS_DIR:-$(cd "$(dirname "$0")" && pwd)}
mkdir -p "$dir" 2>/dev/null

saved_dir="$dir/agent-notifications"
saved_name=$provider
mode=marker
if [ "$provider" = antigravity ]; then
  saved_dir="$dir/agent-antigravity"
  saved_name=$2
  [ "$2" = start ] && saved_name=running
  mode=notification
  if [ "$2" = running ]; then
    : > "$dir/$marker"
    rm -f "$dir/$hold"
  fi
elif { [ "$provider" = trae ] || [ "$provider" = traeCn ]; } && [ "$2" != notification ]; then
  saved_dir="$dir/agent-$provider"
  saved_name=$2
  mode=notification
  if [ "$2" = running ]; then
    : > "$dir/$marker"
    rm -f "$dir/$hold"
  fi
elif [ "$2" = notification ]; then
  mode=notification
elif [ "$2" = session ]; then
  mode=session
elif [ "$2" = activity ]; then
  mode=activity
fi

case "$mode" in
  marker)
    : > "$dir/$marker"
    rm -f "$dir/$hold"
    ;;
  notification)
    mkdir -p "$saved_dir" 2>/dev/null
    saved="$saved_dir/$saved_name-$(date +%Y%m%d%H%M%S)-$$"
    cat > "$saved.tmp" 2>/dev/null && mv -f "$saved.tmp" "$saved.json"
    ;;
  session)
    [ -n "$ORCA_TERMINAL_HANDLE" ] || exit 0
    case "$ORCA_TERMINAL_HANDLE" in *[!A-Za-z0-9_.-]*) exit 0 ;; esac
    terminals="$dir/agent-terminals"
    mkdir -p "$terminals" 2>/dev/null
    cat > "$terminals/$ORCA_TERMINAL_HANDLE.tmp" 2>/dev/null && mv -f "$terminals/$ORCA_TERMINAL_HANDLE.tmp" "$terminals/$ORCA_TERMINAL_HANDLE.json"
    ;;
  activity)
    /usr/bin/curl -s -o /dev/null --connect-timeout 1 -m 5 -H "Authorization: Bearer $4" -H "Content-Type: application/json" -H "X-Fuyu-Hook: fuyu-agent-activity" --data-binary @- "$3" >/dev/null 2>&1
    ;;
esac
exit 0
