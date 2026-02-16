#!/bin/bash
# Run all demo scenarios for MCP Middleware Platform

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCENARIOS_DIR="$SCRIPT_DIR/scenarios"

FAILED=0

for scenario_file in "$SCENARIOS_DIR"/*.json; do
  scenario_name="$(basename "$scenario_file" .json)"
  echo ""
  echo "============================================================"
  echo "Running scenario: $scenario_name"
  echo "============================================================"

  if ! "$SCRIPT_DIR/run-scenario.sh" "$scenario_name"; then
    FAILED=$((FAILED + 1))
  fi
done

if [ "$FAILED" -gt 0 ]; then
  echo ""
  echo "$FAILED scenario(s) failed."
  exit 1
fi

echo ""
echo "All scenarios completed successfully."
