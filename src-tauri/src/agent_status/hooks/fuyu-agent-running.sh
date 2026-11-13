#!/bin/sh
provider=$1
case "$provider" in
  codex|claudeCode)
    marker="agent-$provider-running.flag"
    hold="agent-$provider-running-hold.flag"
    ;;
  workbuddy) [ "$2" = notification ] || exit 2 ;;
  antigravity) [ "$2" = running ] || [ "$2" = stop ] || exit 2 ;;
  *) exit 2 ;;
esac

dir=${FOCUSD_AGENT_STATUS_DIR:-$(cd "$(dirname "$0")" && pwd)}
mkdir -p "$dir" 2>/dev/null

saved_dir="$dir/agent-notifications"
saved_name=$provider
mode=marker
if [ "$provider" = antigravity ]; then
  saved_dir="$dir/agent-antigravity"
  saved_name=$2
  mode=notification
elif [ "$2" = notification ]; then
  mode=notification
elif [ "$2" = session ]; then
  mode=session
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
esac
exit 0
