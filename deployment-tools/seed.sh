#!/bin/bash
#
# Re-seeds the database from the live upstream sources, behind the app's maintenance flag. This is
# `npm run db:seed:maintenance` wrapped for cron, which is where the bare command fails: cron's
# PATH is /usr/bin:/bin, so it never finds npm (see common.sh). DEPLOY.md, "Scheduled data
# updates", has the crontab line.
#
# Usage, from anywhere:
#   bash deployment-tools/seed.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deployment-tools/common.sh
source "$SCRIPT_DIR/common.sh"

[ -f "$REPO_DIR/.env" ] || fail "Missing $REPO_DIR/.env (see DEPLOY.md, section C)."
require_command npm "Set NODE_BIN_DIR in $ENV_FILE to the folder holding node and npm."

acquire_lock
cd "$REPO_DIR"

log "Seeding from $REPO_DIR with node $(node --version)"
# On failure the seed leaves .maintenance in place on purpose, so the app serves its maintenance
# page rather than a half-rebuilt dataset. The npm output above says so as well.
npm run db:seed:maintenance
log "Seed finished."
