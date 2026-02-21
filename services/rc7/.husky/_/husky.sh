#!/bin/sh
if [ -z "$husky_skip_init" ]; then
  debug () {
    [ "$HUSKY_DEBUG" = "1" ] && echo "husky (debug) - $1"
  }
  readonly hook_name="$(basename -- "$0")"
  debug "running $hook_name"
  if [ -f /dev/stdin ]; then
    read -r user_message
    readonly user_message="$user_message"
  fi
  export husky_skip_init=1
  sh -e "$0" "$@"
  exitCode=$?

  if [ $exitCode = 127 ]; then
    echo "husky - $hook_name hook not found (code $exitCode)" >&2
  fi
  exit $exitCode
fi
