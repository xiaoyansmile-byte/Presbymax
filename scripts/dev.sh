#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required but was not found on PATH." >&2
  exit 1
fi

db_choice="${PROSBYMAX_DB_BACKEND:-}"
if [[ -z "$db_choice" ]]; then
  if [[ -t 0 ]]; then
    echo "[dev] Choose a database backend:"
    echo "  1) SQLite (local file, recommended for day-to-day work)"
    echo "  2) Postgres (enter a DATABASE_URL)"
    printf "[dev] Select 1 or 2 [1]: "
    read -r db_choice
    db_choice="${db_choice:-1}"
  else
    db_choice="1"
  fi
fi

port="${PORT:-}"
if [[ -z "$port" ]]; then
  port="3001"
fi

host="${HOST:-0.0.0.0}"

if [[ -t 0 ]]; then
  while true; do
    printf "[dev] Enter port to open [%s]: " "$port"
    read -r chosen_port
    chosen_port="${chosen_port:-$port}"
    if [[ "$chosen_port" =~ ^[0-9]+$ ]]; then
      if command -v lsof >/dev/null 2>&1 && lsof -i ":$chosen_port" -n -P >/dev/null 2>&1; then
        echo "[dev] Port $chosen_port is already in use. Please choose another one."
        continue
      fi
      port="$chosen_port"
      break
    fi
    echo "[dev] Please enter a valid numeric port."
  done
fi

case "$db_choice" in
  2|postgres|Postgres)
    if [[ -z "${DATABASE_URL:-}" ]]; then
      if [[ -t 0 ]]; then
        printf "[dev] Enter DATABASE_URL: "
        read -r DATABASE_URL
      fi
    fi

    if [[ -z "${DATABASE_URL:-}" ]]; then
      echo "[dev] DATABASE_URL is required for Postgres." >&2
      exit 1
    fi

    export DATABASE_URL
    echo "[dev] Initializing Postgres schema..."
    pnpm db:init:postgres
    ;;
  *)
    echo "[dev] Initializing local SQLite database..."
    pnpm db:init
    ;;
esac

echo "[dev] Starting web app on the configured port..."
export HOST="$host"
export PORT="$port"
echo "[dev] Listening on ${HOST}:${PORT}"

lan_ip=""
case "$(uname -s)" in
  Darwin)
    for iface in en0 en1 en2; do
      if command -v ipconfig >/dev/null 2>&1; then
        lan_ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
        if [[ -n "$lan_ip" ]]; then
          break
        fi
      fi
    done
    ;;
  Linux)
    if command -v hostname >/dev/null 2>&1; then
      lan_ip="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
    fi
    ;;
esac

echo "[dev] Open http://127.0.0.1:${PORT}"
if [[ -n "$lan_ip" ]]; then
  echo "[dev] Open http://${lan_ip}:${PORT}"
fi
exec pnpm dev
