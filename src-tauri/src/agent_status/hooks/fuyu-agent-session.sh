#!/bin/sh
provider=$1
event=$2
case "$provider" in codex|claudeCode) ;; *) exit 0 ;; esac
case "$event" in start|end) ;; *) exit 0 ;; esac

dir=${FOCUSD_AGENT_STATUS_DIR:-$(cd "$(dirname "$0")" && pwd)}/agent-sessions
mkdir -p "$dir" 2>/dev/null || exit 0
input="$dir/.input-$$"
trap 'rm -f "$input"' EXIT
cat > "$input" 2>/dev/null || exit 0

field() {
  value=$(/usr/bin/plutil -extract "$1" raw -o - "$input" 2>/dev/null) || { printf 'null'; return; }
  printf '"%s"' "$(printf '%s' "$value" | tr -d '\000-\037' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')"
}

session=$(/usr/bin/plutil -extract session_id raw -o - "$input" 2>/dev/null)
case "$session" in ""|*[!A-Za-z0-9_-]*) exit 0 ;; esac
[ "${#session}" -le 128 ] || exit 0
path="$dir/$session.json"

now=$(/usr/bin/perl -MTime::HiRes=time -e 'printf("%d", time() * 1000)' 2>/dev/null)
[ -n "$now" ] || now=$(($(date +%s) * 1000))

quoted() {
  value=$(printf '%s' "$1" | tr -d '"\\' | tr -d '\000-\037')
  if [ -n "$value" ]; then printf '"%s"' "$value"; else printf 'null'; fi
}

agent_pid() {
  pid=$$
  depth=0
  while [ "$depth" -lt 6 ]; do
    pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
    case "$pid" in ""|0|1) return ;; esac
    name=$(basename "$(ps -o comm= -p "$pid" 2>/dev/null)")
    case "$name" in
      claude|node) [ "$provider" = claudeCode ] && { printf '%s' "$pid"; return; } ;;
    esac
    case "$name" in
      codex|node) [ "$provider" = codex ] && { printf '%s' "$pid"; return; } ;;
    esac
    depth=$((depth + 1))
  done
}

if [ "$event" = start ]; then
  pid=$(agent_pid)
  [ -n "$pid" ] || pid=null
  record="{\"provider\":\"$provider\",\"sessionId\":\"$session\",\"source\":$(field source),\"cwd\":$(field cwd),\"startedAt\":$now,\"pid\":$pid,\"pidStarted\":null,\"orcaHandle\":$(quoted "$ORCA_TERMINAL_HANDLE"),\"wtSession\":null,\"termProgram\":$(quoted "$TERM_PROGRAM")}"
  find "$dir" -name '*.json' -mtime +7 -delete 2>/dev/null
else
  [ -f "$path" ] || exit 0
  previous=$(cat "$path")
  case "$previous" in *'"endedAt"'*) exit 0 ;; "{"*"}") ;; *) exit 0 ;; esac
  reason=$(field reason)
  record="${previous%\}},\"endedAt\":$now,\"endReason\":$reason}"
fi
printf '%s' "$record" > "$path.tmp" && mv -f "$path.tmp" "$path"
exit 0
