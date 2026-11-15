#!/bin/sh
provider=$1
phase=$2
task=$(printf '%s' "${3:-}" | tr -cd 'A-Za-z0-9_.:-')
minimum_visible_ms=800

providers="codex claudeCode workbuddy antigravity dsh qoder codebuddy qwen trae traeCn zcode kimiCode grok copilot droid"
case " $providers " in *" $provider "*) ;; *) exit 2 ;; esac
case "$phase" in idle|running|completed|failed) ;; *) exit 2 ;; esac

status=${FOCUSD_AGENT_STATUS_PATH:-$(cd "$(dirname "$0")" && pwd)/agent-status.json}
dir=$(dirname "$status")
mkdir -p "$dir" || exit 1

lock="$status.lock"
tries=0
until mkdir "$lock" 2>/dev/null; do
  tries=$((tries + 1))
  if [ "$tries" -ge 50 ]; then
    rmdir "$lock" 2>/dev/null
    mkdir "$lock" 2>/dev/null
    break
  fi
  sleep 0.1
done
trap 'rmdir "$lock" 2>/dev/null' EXIT

now=$(/usr/bin/perl -MTime::HiRes=time -e 'printf("%d", time() * 1000)' 2>/dev/null)
[ -n "$now" ] || now=$(($(date +%s) * 1000))

marker="$dir/agent-$provider-running.flag"
hold="$dir/agent-$provider-running-hold.flag"
if [ "$phase" = running ]; then
  : > "$marker"
  rm -f "$hold"
else
  visible_until=0
  if [ -f "$marker" ]; then
    marked=$(($(stat -f %m "$marker") * 1000))
    elapsed=$((now - marked))
    [ "$elapsed" -lt 0 ] && elapsed=0
    remaining=$((minimum_visible_ms - elapsed))
    [ "$remaining" -gt 0 ] && visible_until=$((now + remaining))
  fi
  rm -f "$marker"
  if [ "$visible_until" -gt "$now" ]; then
    printf '%s' "$visible_until" > "$hold"
  else
    rm -f "$hold"
  fi
fi

idle='{"phase":"idle","updatedAt":0}'
if [ -n "$task" ]; then
  next="{\"phase\":\"$phase\",\"updatedAt\":$now,\"taskId\":\"$task\"}"
else
  next="{\"phase\":\"$phase\",\"updatedAt\":$now}"
fi
json="{"
for name in $providers; do
  if [ "$name" = "$provider" ]; then
    entry=$next
  else
    entry=$idle
    if [ -f "$status" ]; then
      entry=$(/usr/bin/plutil -extract "$name" json -o - "$status" 2>/dev/null)
      case "$entry" in "{"*"}") ;; *) entry=$idle ;; esac
    fi
  fi
  json="$json\"$name\":$entry,"
done
json="$json\"updatedAt\":$now}"
printf '%s\n' "$json" > "$status.tmp" && mv -f "$status.tmp" "$status"
exit 0
