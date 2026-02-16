#!/bin/bash
# Demo scenario runner for MCP Middleware Platform
# Usage: ./run-scenario.sh <scenario-name>

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCENARIOS_DIR="$SCRIPT_DIR/scenarios"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

function usage() {
    echo "Usage: $0 <scenario-name>"
    echo ""
    echo "Available scenarios:"
    ls -1 "$SCENARIOS_DIR" | sed 's/.json$//' | while read -r scenario; do
        echo "  - $scenario"
    done
    echo ""
    exit 1
}

# Main
if [ $# -eq 0 ]; then
    usage
fi

SCENARIO_NAME="$1"
SCENARIO_FILE="$SCENARIOS_DIR/${SCENARIO_NAME}.json"

if [ ! -f "$SCENARIO_FILE" ]; then
    echo -e "${RED}Error: Scenario '$SCENARIO_NAME' not found${NC}"
    usage
fi

# Show scenario info
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Scenario: ${YELLOW}$SCENARIO_NAME${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""
jq -r '.description' "$SCENARIO_FILE"
echo ""
echo -e "Expected: ${GREEN}$(jq -r '.expected' "$SCENARIO_FILE")${NC}"
echo ""

# Show policy config
echo -e "${YELLOW}Policy Rules:${NC}"
jq '.' "$SCENARIO_FILE" | head -30
echo ""

# Run the demo
echo -e "${GREEN}Running demo...${NC}"
echo ""
node "$SCRIPT_DIR/demo-client.js" --scenario "$SCENARIO_NAME"
