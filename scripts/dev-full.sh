#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  if [[ -n "${API_PID:-}" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

node server.mjs &
API_PID=$!

npm run dev
