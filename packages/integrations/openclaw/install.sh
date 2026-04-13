#!/bin/bash
# One-line installer for Sentro + OpenClaw integration
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/yzzztech/sentro/main/packages/integrations/openclaw/install.sh | bash -s -- "YOUR_DSN"

set -euo pipefail

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

DSN="${1:-${SENTRO_DSN:-}}"

if [ -z "$DSN" ]; then
  echo -e "${RED}Error: SENTRO_DSN is required${NC}"
  echo "Usage: bash install.sh \"http://token@host:port/api/ingest/proj_xxx\""
  exit 1
fi

echo -e "${BLUE}→ Installing Sentro skill for OpenClaw${NC}"

# Install Python SDK
if command -v pip &> /dev/null; then
  pip install -q sentro-sdk
  echo -e "${GREEN}✓ Installed sentro-sdk${NC}"
else
  echo -e "${RED}Error: pip is required${NC}"
  exit 1
fi

# Determine OpenClaw skills directory
SKILLS_DIR=""
for dir in "$HOME/.openclaw/skills" "$HOME/.agents/skills"; do
  if [ -d "$dir" ]; then
    SKILLS_DIR="$dir"
    break
  fi
done

if [ -z "$SKILLS_DIR" ]; then
  SKILLS_DIR="$HOME/.openclaw/skills"
  mkdir -p "$SKILLS_DIR"
  echo -e "${YELLOW}Created $SKILLS_DIR${NC}"
fi

# Download skill
SKILL_DIR="$SKILLS_DIR/sentro-observability"
mkdir -p "$SKILL_DIR"
curl -fsSL "https://raw.githubusercontent.com/yzzztech/sentro/main/packages/integrations/openclaw/SKILL.md" \
  -o "$SKILL_DIR/SKILL.md"
echo -e "${GREEN}✓ Installed Sentro skill to $SKILL_DIR${NC}"

# Add DSN to shell profile
SHELL_NAME=$(basename "$SHELL")
case "$SHELL_NAME" in
  zsh) PROFILE="$HOME/.zshrc" ;;
  bash) PROFILE="$HOME/.bashrc" ;;
  *) PROFILE="$HOME/.profile" ;;
esac

if ! grep -q "SENTRO_DSN" "$PROFILE" 2>/dev/null; then
  echo "" >> "$PROFILE"
  echo "# Sentro observability for OpenClaw" >> "$PROFILE"
  echo "export SENTRO_DSN=\"$DSN\"" >> "$PROFILE"
  echo -e "${GREEN}✓ Added SENTRO_DSN to $PROFILE${NC}"
fi

echo ""
echo -e "${GREEN}✓ Installation complete!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Restart your terminal (or run: source $PROFILE)"
echo "  2. Restart OpenClaw Gateway to pick up the new skill"
echo "  3. Your agent runs will now appear in Sentro"
echo ""
echo -e "${BLUE}Project GitHub:${NC} https://github.com/yzzztech/sentro"
