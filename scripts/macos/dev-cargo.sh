#!/bin/sh
script="$(dirname "$0")/dev-cargo.mjs"
if [ "$1" = run ]; then
  node "$script" --prepare "$@" || exit $?
  exec cargo "$@"
fi
exec node "$script" "$@"
