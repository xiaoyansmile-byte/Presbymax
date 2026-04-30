#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
ROOT_DIR="$(cd "$ROOT_DIR" && pwd)"

EXPORT_ZIP=""
BUNDLE_ZIP=""
TARGET_DIR="${SETUP_TARGET_DIR:-$SCRIPT_DIR/restored-workspace}"
SKIP_DEV=0

SETUP_DB_BACKEND=""

usage() {
  cat <<'EOF'
Usage:
  ./scripts/setup.sh
  ./scripts/setup.sh --bundle path/to/project.zip
  ./scripts/setup.sh --export path/to/project.zip
  ./scripts/setup.sh --target path/to/restore-dir

Options:
  --bundle <zip>   Restore the workspace from a zip archive if the code is missing.
  --export <zip>   Package the current workspace into a zip archive.
  --target <dir>   Restore target directory when using --bundle.
  --skip-dev       Finish after setup without starting the dev server.
  -h, --help       Show this help message.
EOF
}

info() {
  printf '[setup] %s\n' "$*"
}

warn() {
  printf '[setup] %s\n' "$*" >&2
}

has_tty() {
  [[ -t 0 && -t 1 ]]
}

prompt_yes_no() {
  local prompt="$1"
  local default_answer="${2:-y}"
  local answer=""

  if ! has_tty; then
    [[ "$default_answer" == "y" || "$default_answer" == "Y" ]]
    return
  fi

  while true; do
    printf '%s [%s/%s]: ' "$prompt" "$(echo "$default_answer" | tr '[:lower:]' '[:upper:]')" "$( [[ "$default_answer" == "y" ]] && echo n || echo y )"
    read -r answer
    answer="${answer:-$default_answer}"
    case "${answer,,}" in
      y|yes) return 0 ;;
      n|no) return 1 ;;
      *) warn "Please answer y or n." ;;
    esac
  done
}

prompt_value() {
  local prompt="$1"
  local default_value="${2:-}"
  local value=""

  if ! has_tty; then
    printf '%s' "$default_value"
    return
  fi

  if [[ -n "$default_value" ]]; then
    printf '%s [%s]: ' "$prompt" "$default_value"
  else
    printf '%s: ' "$prompt"
  fi
  read -r value
  printf '%s' "${value:-$default_value}"
}

repo_is_present() {
  [[ -f "$ROOT_DIR/package.json" && -f "$ROOT_DIR/apps/web/package.json" ]]
}

require_command() {
  local command_name="$1"
  local install_hint="$2"

  if command -v "$command_name" >/dev/null 2>&1; then
    return 0
  fi

  warn "$command_name was not found."
  if prompt_yes_no "Do you want to install $command_name now?" "y"; then
    case "$command_name" in
      node) install_node ;;
      pnpm) install_pnpm ;;
      zip|unzip)
        install_archiver_tools "$command_name"
        ;;
      *)
        warn "$install_hint"
        exit 1
        ;;
    esac
  else
    warn "$install_hint"
    exit 1
  fi
}

install_node() {
  local platform
  platform="$(uname -s)"

  case "$platform" in
    Darwin)
      if command -v brew >/dev/null 2>&1; then
        info "Installing Node.js with Homebrew..."
        brew install node
      else
        warn "Homebrew is not installed."
        warn "Install Node.js manually from https://nodejs.org/ or install Homebrew first."
        exit 1
      fi
      ;;
    Linux)
      if command -v apt-get >/dev/null 2>&1; then
        info "Installing Node.js with apt-get..."
        sudo apt-get update
        sudo apt-get install -y nodejs npm
      else
        warn "Automatic Node.js installation is not configured for this Linux environment."
        warn "Install Node.js manually from https://nodejs.org/."
        exit 1
      fi
      ;;
    *)
      warn "Automatic Node.js installation is not configured for this platform."
      warn "Install Node.js manually from https://nodejs.org/."
      exit 1
      ;;
  esac
}

install_pnpm() {
  if command -v corepack >/dev/null 2>&1; then
    info "Enabling pnpm through corepack..."
    corepack enable
    corepack prepare pnpm@10.9.0 --activate
    return 0
  fi

  warn "corepack is not available."
  warn "Install pnpm manually or use a newer Node.js release with corepack."
  exit 1
}

install_archiver_tools() {
  local tool_name="$1"
  local platform
  platform="$(uname -s)"

  case "$platform" in
    Darwin)
      if command -v brew >/dev/null 2>&1; then
        info "Installing $tool_name support with Homebrew..."
        brew install "$tool_name"
      else
        warn "Homebrew is not installed."
        warn "Install $tool_name manually or install Homebrew first."
        exit 1
      fi
      ;;
    Linux)
      if command -v apt-get >/dev/null 2>&1; then
        info "Installing $tool_name support with apt-get..."
        sudo apt-get update
        sudo apt-get install -y zip unzip
      else
        warn "Automatic $tool_name installation is not configured for this Linux environment."
        warn "Install $tool_name manually."
        exit 1
      fi
      ;;
    *)
      warn "Automatic $tool_name installation is not configured for this platform."
      warn "Install $tool_name manually."
      exit 1
      ;;
  esac
}

ensure_env_file() {
  local env_file="$ROOT_DIR/apps/web/.env.local"
  if [[ ! -f "$env_file" ]]; then
    info "Creating apps/web/.env.local from the example template..."
    mkdir -p "$ROOT_DIR/apps/web"
    if [[ -f "$ROOT_DIR/apps/web/.env.example" ]]; then
      cp "$ROOT_DIR/apps/web/.env.example" "$env_file"
    elif [[ -f "$ROOT_DIR/.env.example" ]]; then
      cp "$ROOT_DIR/.env.example" "$env_file"
    else
      cat >"$env_file" <<'EOF'
# Local development overrides
EOF
    fi
  fi
}

ensure_data_dir() {
  mkdir -p "$ROOT_DIR/apps/web/data"
}

workspace_zip_excludes=(
  ".git/*"
  ".DS_Store"
  ".pnpm-store/*"
  "node_modules/*"
  "apps/web/node_modules/*"
  "apps/web/.next/*"
  "apps/web/data/persistent-store.sqlite"
  "apps/web/data/persistent-store.sqlite-*"
  "apps/web/data/persistent-store.json"
  "*.zip"
)

export_bundle() {
  local output_zip="$1"
  local output_dir
  output_dir="$(dirname "$output_zip")"
  mkdir -p "$output_dir"

  info "Creating bundle at $output_zip..."
  (
    cd "$ROOT_DIR"
    local zip_args=()
    for pattern in "${workspace_zip_excludes[@]}"; do
      zip_args+=(-x "$pattern")
    done
    zip -rq "$output_zip" . "${zip_args[@]}"
  )
  info "Bundle created."
}

restore_bundle() {
  local bundle_path="$1"
  local restore_dir="$2"

  if repo_is_present; then
    return 0
  fi

  if [[ ! -f "$bundle_path" ]]; then
    warn "Bundle not found: $bundle_path"
    exit 1
  fi

  require_command unzip "unzip is required to restore the bundle."

  mkdir -p "$restore_dir"
  info "Restoring workspace into $restore_dir..."
  unzip -q "$bundle_path" -d "$restore_dir"

  if [[ ! -f "$restore_dir/package.json" || ! -f "$restore_dir/apps/web/package.json" ]]; then
    warn "The archive did not unpack into a valid workspace layout."
    exit 1
  fi

  ROOT_DIR="$(cd "$restore_dir" && pwd)"
  info "Workspace restored to $ROOT_DIR"
}

ensure_workspace_dependencies() {
  if [[ -d "$ROOT_DIR/node_modules" && -d "$ROOT_DIR/apps/web/node_modules" ]]; then
    return 0
  fi

  info "Workspace dependencies are missing."
  if prompt_yes_no "Do you want to install dependencies now?" "y"; then
    info "Installing dependencies with pnpm..."
    (cd "$ROOT_DIR" && pnpm install)
    return 0
  fi

  warn "Dependencies are required before running the app."
  exit 1
}

choose_port() {
  local default_port="${PORT:-3001}"
  local chosen_port="$default_port"

  if has_tty; then
    while true; do
      chosen_port="$(prompt_value "Enter port to use" "$default_port")"
      if [[ "$chosen_port" =~ ^[0-9]+$ ]]; then
        if command -v lsof >/dev/null 2>&1 && lsof -i ":$chosen_port" -n -P >/dev/null 2>&1; then
          warn "Port $chosen_port is already in use. Please choose another one."
          continue
        fi
        break
      fi
      warn "Please enter a valid numeric port."
    done
  fi

  printf '%s' "$chosen_port"
}

run_db_init() {
  local db_choice="${PROSBYMAX_DB_BACKEND:-}"
  if [[ -z "$db_choice" ]]; then
    if has_tty; then
      info "Choose a database backend:"
      printf '  1) SQLite (local file, recommended for most setups)\n'
      printf '  2) Postgres (enter a DATABASE_URL)\n'
      db_choice="$(prompt_value "Select 1 or 2" "1")"
    else
      db_choice="1"
    fi
  fi

  case "$db_choice" in
    2|postgres|Postgres)
      if [[ -z "${DATABASE_URL:-}" ]] && has_tty; then
        DATABASE_URL="$(prompt_value "Enter DATABASE_URL" "")"
      fi

      if [[ -z "${DATABASE_URL:-}" ]]; then
        warn "DATABASE_URL is required for Postgres."
        exit 1
      fi

      export DATABASE_URL
      info "Initializing Postgres schema..."
      (cd "$ROOT_DIR" && pnpm db:init:postgres)
      ;;
    *)
      info "Initializing local SQLite database..."
      (cd "$ROOT_DIR" && pnpm db:init)
      db_choice="1"
      ;;
  esac

  SETUP_DB_BACKEND="$db_choice"
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --bundle)
        BUNDLE_ZIP="${2:-}"
        shift 2
        ;;
      --export)
        EXPORT_ZIP="${2:-}"
        shift 2
        ;;
      --target)
        TARGET_DIR="${2:-}"
        shift 2
        ;;
      --skip-dev)
        SKIP_DEV=1
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        warn "Unknown argument: $1"
        usage
        exit 1
        ;;
    esac
  done
}

main() {
  parse_args "$@"

  require_command node "Node.js is required. Please install it and rerun this script."
  require_command pnpm "pnpm is required. This script can enable it through corepack if available."

  if [[ -n "$EXPORT_ZIP" ]]; then
    require_command zip "zip is required to create bundles."
    export_bundle "$EXPORT_ZIP"
    exit 0
  fi

  if ! repo_is_present; then
    if [[ -z "$BUNDLE_ZIP" ]]; then
      warn "Workspace files were not found in $ROOT_DIR."
      warn "Provide --bundle /path/to/project.zip to restore the code archive."
      exit 1
    fi
    require_command unzip "unzip is required to restore the bundle."
    restore_bundle "$BUNDLE_ZIP" "$TARGET_DIR"
  fi

  cd "$ROOT_DIR"

  info "Node: $(node -v)"
  info "pnpm: $(pnpm -v)"

  ensure_workspace_dependencies
  ensure_env_file
  ensure_data_dir

  local_port="$(choose_port)"
  export PORT="$local_port"

  run_db_init
  export PROSBYMAX_DB_BACKEND="$SETUP_DB_BACKEND"

  info "Environment is ready."
  if [[ "$SKIP_DEV" -eq 1 ]]; then
    info "Skipping dev server launch as requested."
    exit 0
  fi

  if prompt_yes_no "Do you want to start the development server now?" "y"; then
    exec "$ROOT_DIR/scripts/dev.sh"
  fi

  info "You can start the app later with: ./scripts/dev.sh"
}

main "$@"
