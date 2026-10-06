#!/bin/bash
#
# Deploy step for the server's git clone. Run by cPanel's "Deploy HEAD Commit" (see .cpanel.yml)
# after "Update from Remote", and the same thing over SSH. See DEPLOY.md for the one-time setup it
# expects.
#
#   1. Installs dependencies (npm ci), skipped when package-lock.json has not changed.
#   2. Builds the checked-out commit (npm run build: shared, prisma generate, API, web).
#   3. Applies pending database migrations (prisma migrate deploy).
#   4. Restarts the two pm2 processes, starting them if they do not exist yet, and saves the
#      process list so a reboot brings them back.
#   5. Waits for both to answer on their ports.
#
# The build comes before the migrations so that a failed build leaves the database at the version
# the running code expects. The apps are built in place, so between the start of step 2 and the end
# of step 4 the live site may answer some requests with errors; the window is the build's length.
#
# Usage:
#   bash deployment-tools/deploy.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deployment-tools/common.sh
source "$SCRIPT_DIR/common.sh"

API_PROCESS_NAME="${API_PROCESS_NAME:-wizda-api}"
WEB_PROCESS_NAME="${WEB_PROCESS_NAME:-wizda-web}"
WEB_PORT="${WEB_PORT:-4000}"
WEB_HOST="${WEB_HOST:-127.0.0.1}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-60}"
MIN_VM_LIMIT_GB="${MIN_VM_LIMIT_GB:-}"

APP_ENV_FILE="$REPO_DIR/.env"
API_ENTRY="packages/backend-api/dist/backend-api/src/index.js"
WEB_DIR="packages/web-client"
NEXT_BIN="node_modules/next/dist/bin/next"

[ -f "$APP_ENV_FILE" ] || fail "Missing $APP_ENV_FILE (see DEPLOY.md, section C)."
require_command npm "Set NODE_BIN_DIR in $ENV_FILE to the folder holding node and npm."
require_command pm2 "Install it with 'npm install -g pm2' (see DEPLOY.md, section E)."

# The API's port lives in the app's .env (PORT=...), quoted or not; only the digits matter.
if [ -z "${API_PORT:-}" ]; then
    API_PORT="$(grep -E '^[[:space:]]*PORT=' "$APP_ENV_FILE" | tail -n 1 | tr -dc '0-9' || true)"
fi
API_PORT="${API_PORT:-3001}"

case "$WEB_PORT$API_PORT" in
    *[!0-9]*) fail "WEB_PORT and API_PORT must be numbers, got '$WEB_PORT' and '$API_PORT'." ;;
esac
case "$MIN_VM_LIMIT_GB" in
    *[!0-9]*) fail "MIN_VM_LIMIT_GB must be a number or unset, got '$MIN_VM_LIMIT_GB'." ;;
esac

# cPanel's "Max cPanel process memory" caps the deploy task's virtual address space (ulimit -v),
# which is not the memory it uses: Node reserves far more address space than it touches, and both
# the Prisma CLI and Next's compiler run WebAssembly, which reserves still more. Under a too-tight
# cap the build does not fail cleanly but thrashes the garbage collector for minutes before V8
# aborts, so lift the soft cap to the hard one in case cPanel leaves room, log it, and refuse to
# start below MIN_VM_LIMIT_GB when that is set.
ulimit -S -v "$(ulimit -H -v)" 2> /dev/null || true
vm_limit_kb="$(ulimit -v)"
log "Virtual memory limit (ulimit -v, KB): $vm_limit_kb (hard: $(ulimit -H -v))"
if [ -n "$MIN_VM_LIMIT_GB" ] && [ "$vm_limit_kb" != unlimited ]; then
    min_vm_limit_kb=$((MIN_VM_LIMIT_GB * 1024 * 1024))
    if [ "$vm_limit_kb" -lt "$min_vm_limit_kb" ]; then
        fail "The virtual memory limit is $((vm_limit_kb / 1024 / 1024)) GB but MIN_VM_LIMIT_GB is $MIN_VM_LIMIT_GB. Raise WHM > Tweak Settings > 'Max cPanel process memory' (see DEPLOY.md, 'Things to know')."
    fi
fi

# Without the trap handler, V8 reserves only what each WebAssembly instance actually uses instead
# of a ~10 GB virtual cage per instance, which keeps the build within the limit above. Requires
# Node.js 22.2 or later. Build-time only: the pm2 processes are started without it (see below).
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--disable-wasm-trap-handler"

acquire_lock
cd "$REPO_DIR"
commit="$(git rev-parse --short HEAD)"
log "Deploying $commit with node $(node --version), from $REPO_DIR"

if [ -f "$REPO_DIR/.maintenance" ]; then
    log "WARNING: .maintenance exists, so the API is answering 503. A previous seed failed; re-run 'bash deployment-tools/seed.sh' after this deploy and it clears on success."
fi

# npm ci wipes and reinstalls node_modules. Skip it when the dependencies have not changed since
# the last successful install: npm writes this marker at the end of every install, and git only
# rewrites package-lock.json (bumping its modification time) when a pulled commit changes it.
# To force a clean install, delete node_modules/.
install_marker="node_modules/.package-lock.json"
if [ -f "$install_marker" ] && [ "$install_marker" -nt package-lock.json ]; then
    log "package-lock.json unchanged since the last install; reusing node_modules"
else
    log "Installing dependencies (npm ci)"
    # --include=dev: the build needs devDependencies (typescript, tsc-alias), which npm would skip
    # if NODE_ENV=production happened to be set in this environment.
    npm ci --include=dev --no-audit --no-fund
fi

log "Building (npm run build)"
npm run build

[ -f "$API_ENTRY" ] || fail "The build did not produce $API_ENTRY."
[ -f "$WEB_DIR/.next/BUILD_ID" ] || fail "The build did not produce $WEB_DIR/.next/BUILD_ID."

log "Applying database migrations (prisma migrate deploy)"
npx prisma migrate deploy

# pm2 restart keeps the environment the process was first started with, so NODE_OPTIONS above
# never reaches the apps that way; a first start would inherit it, hence the explicit unset.
#
# Usage: pm2_start_or_restart <name> <script> [-- <script args>...]
pm2_start_or_restart() {
    local name="$1" script="$2"
    shift 2
    if pm2 id "$name" | grep -q '[0-9]'; then
        log "Restarting $name"
        pm2 restart "$name"
    else
        log "Starting $name (no pm2 process with that name yet)"
        # pm2's own options must precede the `--`; everything after it goes to the script.
        env -u NODE_OPTIONS pm2 start "$script" --name "$name" "$@"
    fi
}

pm2_start_or_restart "$API_PROCESS_NAME" "$API_ENTRY"
pm2_start_or_restart "$WEB_PROCESS_NAME" "$NEXT_BIN" -- start "$WEB_DIR" -p "$WEB_PORT" -H "$WEB_HOST"
# Keeps the list pm2 resurrects on boot in step with what is running.
pm2 save > /dev/null

# Any HTTP answer counts, including the API's 503 while .maintenance exists: the question is
# whether the new process came up, not whether the data is there.
wait_for_http() {
    local url="$1" elapsed=0
    until curl -s -o /dev/null --max-time 5 "$url"; do
        [ "$elapsed" -lt "$HEALTH_TIMEOUT" ] || return 1
        sleep 2
        elapsed=$((elapsed + 2))
    done
}

log "Waiting for the API on 127.0.0.1:$API_PORT and the web app on $WEB_HOST:$WEB_PORT"
wait_for_http "http://127.0.0.1:$API_PORT/" || fail "The API did not answer on port $API_PORT within $HEALTH_TIMEOUT seconds. Check 'pm2 logs $API_PROCESS_NAME'."
wait_for_http "http://$WEB_HOST:$WEB_PORT/en" || fail "The web app did not answer on port $WEB_PORT within $HEALTH_TIMEOUT seconds. Check 'pm2 logs $WEB_PROCESS_NAME'."

pm2 ls
log "Deploy of $commit finished."
