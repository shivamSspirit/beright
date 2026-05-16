#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_CONFIG="$SCRIPT_DIR/../openclaw/openclaw.example.json5"
TARGET_DIR="${HOME}/.openclaw"
TARGET_CONFIG="${TARGET_DIR}/openclaw.json"

mkdir -p "$TARGET_DIR"

if [[ -f "$TARGET_CONFIG" ]]; then
  BACKUP_PATH="${TARGET_CONFIG}.bak.$(date +%Y%m%d%H%M%S)"
  cp "$TARGET_CONFIG" "$BACKUP_PATH"
  echo "Backed up existing OpenClaw config to $BACKUP_PATH"
fi

cp "$SOURCE_CONFIG" "$TARGET_CONFIG"
echo "Installed BeRight OpenClaw config to $TARGET_CONFIG"
echo "Review TELEGRAM_BOT_TOKEN and any model/provider settings before running openclaw gateway."
