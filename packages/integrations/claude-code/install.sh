#!/bin/bash
# One-line installer for Sentro + Claude Code integration
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/yzzztech/sentro/main/packages/integrations/claude-code/install.sh | bash -s -- "YOUR_DSN"
#
# Or if you already have SENTRO_DSN set:
#   curl -fsSL https://raw.githubusercontent.com/yzzztech/sentro/main/packages/integrations/claude-code/install.sh | bash

set -euo pipefail

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

DSN="${1:-${SENTRO_DSN:-}}"

if [ -z "$DSN" ]; then
  echo -e "${RED}Error: SENTRO_DSN is required${NC}"
  echo ""
  echo "Usage: bash install.sh \"http://token@host:port/api/ingest/proj_xxx\""
  echo "Or set SENTRO_DSN environment variable before running"
  exit 1
fi

echo -e "${BLUE}→ Installing Sentro hook for Claude Code${NC}"

# Check dependencies
if ! command -v jq &> /dev/null; then
  echo -e "${YELLOW}Warning: jq is not installed. Install with: brew install jq${NC}"
fi

if ! command -v curl &> /dev/null; then
  echo -e "${RED}Error: curl is required but not installed${NC}"
  exit 1
fi

# Create hooks directory
HOOKS_DIR="$HOME/.claude/hooks"
mkdir -p "$HOOKS_DIR"

# Download hook script
HOOK_URL="https://raw.githubusercontent.com/yzzztech/sentro/main/packages/integrations/claude-code/sentro-hook.sh"
HOOK_PATH="$HOOKS_DIR/sentro-hook.sh"

echo -e "${BLUE}→ Downloading hook script${NC}"
curl -fsSL "$HOOK_URL" -o "$HOOK_PATH"
chmod +x "$HOOK_PATH"

# Add DSN to shell profile
SHELL_NAME=$(basename "$SHELL")
case "$SHELL_NAME" in
  zsh) PROFILE="$HOME/.zshrc" ;;
  bash) PROFILE="$HOME/.bashrc" ;;
  *) PROFILE="$HOME/.profile" ;;
esac

if ! grep -q "SENTRO_DSN" "$PROFILE" 2>/dev/null; then
  echo "" >> "$PROFILE"
  echo "# Sentro observability for Claude Code" >> "$PROFILE"
  echo "export SENTRO_DSN=\"$DSN\"" >> "$PROFILE"
  echo -e "${GREEN}✓ Added SENTRO_DSN to $PROFILE${NC}"
else
  echo -e "${YELLOW}SENTRO_DSN already in $PROFILE — update manually if needed${NC}"
fi

# Update Claude Code settings.json
SETTINGS="$HOME/.claude/settings.json"

if [ ! -f "$SETTINGS" ]; then
  echo '{"hooks":{}}' > "$SETTINGS"
fi

# Use jq to merge Sentro hooks into existing settings
SENTRO_HOOK_CMD="bash $HOOK_PATH"

if command -v jq &> /dev/null; then
  TMP=$(mktemp)
  jq --arg cmd "$SENTRO_HOOK_CMD" '
    .hooks = (.hooks // {}) |
    .hooks.SessionStart = (.hooks.SessionStart // []) |
    .hooks.PreToolUse = (.hooks.PreToolUse // []) |
    .hooks.PostToolUse = (.hooks.PostToolUse // []) |
    .hooks.PostToolUseFailure = (.hooks.PostToolUseFailure // []) |
    .hooks.Stop = (.hooks.Stop // []) |
    (.hooks.SessionStart |= (if any(.[]?; .hooks[]?.command == $cmd) then . else . + [{"matcher":"startup","hooks":[{"type":"command","command":$cmd,"timeout":5}]}] end)) |
    (.hooks.PreToolUse |= (if any(.[]?; .hooks[]?.command == $cmd) then . else . + [{"matcher":"*","hooks":[{"type":"command","command":$cmd,"timeout":5}]}] end)) |
    (.hooks.PostToolUse |= (if any(.[]?; .hooks[]?.command == $cmd) then . else . + [{"matcher":"*","hooks":[{"type":"command","command":$cmd,"timeout":5}]}] end)) |
    (.hooks.PostToolUseFailure |= (if any(.[]?; .hooks[]?.command == $cmd) then . else . + [{"matcher":"*","hooks":[{"type":"command","command":$cmd,"timeout":5}]}] end)) |
    (.hooks.Stop |= (if any(.[]?; .hooks[]?.command == $cmd) then . else . + [{"matcher":"*","hooks":[{"type":"command","command":$cmd,"timeout":5}]}] end))
  ' "$SETTINGS" > "$TMP" && mv "$TMP" "$SETTINGS"
  echo -e "${GREEN}✓ Updated $SETTINGS${NC}"
else
  echo -e "${YELLOW}jq not installed — manually add hooks to $SETTINGS${NC}"
  echo -e "${YELLOW}See: https://github.com/yzzztech/sentro/tree/main/packages/integrations/claude-code${NC}"
fi

echo ""
echo -e "${GREEN}✓ Installation complete!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Restart your terminal (or run: source $PROFILE)"
echo "  2. Start a new Claude Code session — traces will appear in Sentro"
echo "  3. View your dashboard to see agent runs and tool calls"
echo ""
echo -e "${BLUE}Project GitHub:${NC} https://github.com/yzzztech/sentro"
