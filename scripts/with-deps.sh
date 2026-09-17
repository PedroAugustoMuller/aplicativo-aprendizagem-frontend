#!/bin/sh
# Runs a command after making sure node_modules matches package-lock.json.
# Used as the entry command of the `dev` and `e2e` Compose services, so
# `docker compose up` / `docker compose up e2e` work on a fresh checkout.
#
# npm rewrites node_modules/.package-lock.json on every install, so a lockfile
# newer than it means dependencies changed since the last install.
set -eu

if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  npm install
fi

exec "$@"
