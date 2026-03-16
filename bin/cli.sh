#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_DIR="$SCRIPT_DIR/../commands/sd"
TARGET_DIR="$HOME/.claude/commands/sd"

case "${1:-}" in
  install)
    mkdir -p "$TARGET_DIR"
    cp "$SOURCE_DIR"/*.md "$TARGET_DIR/"
    echo ""
    echo "cc-slightly-dangerous installed!"
    echo ""
    echo "Available commands in Claude Code:"
    echo "  /sd:enable          — auto-approve local ops, deny git"
    echo "  /sd:enable-with-git — auto-approve local ops + git"
    echo "  /sd:disable         — reset to default permissions"
    echo ""
    ;;
  uninstall)
    if [ -d "$TARGET_DIR" ]; then
      rm -rf "$TARGET_DIR"
      echo "cc-slightly-dangerous uninstalled. Removed $TARGET_DIR"
    else
      echo "cc-slightly-dangerous: nothing to clean up"
    fi
    ;;
  *)
    echo "Usage: cc-slightly-dangerous <install|uninstall>"
    echo ""
    echo "  install    Copy slash commands to ~/.claude/commands/sd/"
    echo "  uninstall  Remove slash commands from ~/.claude/commands/sd/"
    exit 1
    ;;
esac
