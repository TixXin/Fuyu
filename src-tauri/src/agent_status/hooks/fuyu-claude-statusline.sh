#!/bin/sh
dir=${FOCUSD_AGENT_STATUS_DIR:-$(cd "$(dirname "$0")" && pwd)}
input=$(cat)

case "$input" in
  *'"rate_limits"'*'"used_percentage"'*)
    tmp="$dir/.claude-statusline-$$"
    if printf '%s' "$input" > "$tmp" 2>/dev/null; then
      mv -f "$tmp" "$dir/claude-statusline.json" 2>/dev/null || rm -f "$tmp"
    fi
    ;;
esac

next="$dir/claude-statusline-next.txt"
[ -s "$next" ] || exit 0
command=$(cat "$next")
case "$command" in *fuyu-claude-statusline*) exit 0 ;; esac
printf '%s' "$input" | exec /bin/sh -c "$command"
