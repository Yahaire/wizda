#!/bin/bash
#
# Shared setup for the scripts in this folder. Sourced by deploy.sh and seed.sh, never run on its
# own. It expects the sourcing script to have set SCRIPT_DIR and to run under `set -euo pipefail`.
#
# Both scripts run from environments that do not load the login profile -- cPanel's deploy task and
# cron -- so nothing in them may rely on the PATH, HOME or anything else an interactive shell sets
# up. That is the reason this file exists: a `npm: command not found` from cron is invisible unless
# someone reads the account's local mail.

REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

log() {
    echo "[$(basename "$0" .sh) $(date '+%F %T')] $*"
}

fail() {
    log "ERROR: $*"
    exit 1
}

# cron sets HOME and so should the deploy task, but pm2 depends on it (PM2_HOME defaults to
# $HOME/.pm2): without it pm2 would start a second daemon that never sees the live processes.
if [ -z "${HOME:-}" ]; then
    HOME="$(getent passwd "$(id -un)" | cut -d: -f6)"
    export HOME
fi

# This server's settings, all optional (see env.example).
if [ -f "$ENV_FILE" ]; then
    # shellcheck source=/dev/null
    source "$ENV_FILE"
fi

NODE_BIN_DIR="${NODE_BIN_DIR:-/opt/cpanel/ea-nodejs22/bin}"
LOCK_FILE="${LOCK_FILE:-$HOME/.wizda-tasks.lock}"
LOCK_TIMEOUT="${LOCK_TIMEOUT:-1800}"

# Neither cron nor the deploy task loads the login profile, so the ea-nodejs bin folder -- and
# /usr/local/bin, where DEPLOY.md's optional symlinks live -- are not necessarily on PATH.
export PATH="$NODE_BIN_DIR:/usr/local/bin:$PATH"
export PM2_HOME="${PM2_HOME:-$HOME/.pm2}"
export NEXT_TELEMETRY_DISABLED=1

require_command() {
    command -v "$1" > /dev/null || fail "$1 not found on PATH ($PATH). $2"
}

# A deploy and a seed each rewrite things the other depends on (the database, node_modules), so
# they take turns: whoever comes second waits up to LOCK_TIMEOUT seconds for the first to finish.
acquire_lock() {
    if ! command -v flock > /dev/null; then
        log "WARNING: flock not found; running without a lock against concurrent deploys/seeds."
        return 0
    fi
    exec 9> "$LOCK_FILE"
    flock -w "$LOCK_TIMEOUT" 9 || fail "Another deploy or seed has held $LOCK_FILE for over $LOCK_TIMEOUT seconds."
}
