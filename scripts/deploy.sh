#!/bin/bash
set -e

TARGET_NETWORK="${TARGET_NETWORK:-${VITE_NETWORK:-testnet}}"
TARGET_RPC_URL="${VITE_RPC_URL:-}"
MOVE_TOML="$(cd "$(dirname "$0")/../contracts" && pwd)/Move.toml"

if [[ "$TARGET_NETWORK" != "testnet" && "$TARGET_NETWORK" != "mainnet" ]]; then
  echo "Unsupported TARGET_NETWORK=$TARGET_NETWORK. Use testnet or mainnet."
  exit 1
fi

echo "=== PORTUS DEPLOYMENT ==="
echo "Target network: $TARGET_NETWORK"

perl -0pi -e "s/rev = \\\"(testnet|mainnet)\\\"/rev = \\\"$TARGET_NETWORK\\\"/" "$MOVE_TOML"

# 1. Ensure network
iota client switch --env "$TARGET_NETWORK"
echo "Active address: $(iota client active-address)"
iota client gas

# 2. Build
cd "$(dirname "$0")/../contracts"
echo "Building Move contracts..."
iota move build

# 3. Test
echo "Running Move unit tests..."
iota move test

# 4. Publish
echo "Publishing to $TARGET_NETWORK..."
PUBLISH_OUTPUT=$(iota client publish --gas-budget 100000000 --json)
echo "$PUBLISH_OUTPUT"

PACKAGE_ID=$(echo "$PUBLISH_OUTPUT" | jq -r '.objectChanges[] | select(.type == "published") | .packageId')
BL_REGISTRY_ID=$(echo "$PUBLISH_OUTPUT" | jq -r '.objectChanges[] | select(.type == "created" and (.objectType | endswith("::ebl::BLRegistry"))) | .objectId')
CARRIER_REGISTRY_ID=$(echo "$PUBLISH_OUTPUT" | jq -r '.objectChanges[] | select(.type == "created" and (.objectType | endswith("::carrier_registry::GlobalCarrierRegistry"))) | .objectId')
INTEROP_REGISTRY_ID=$(echo "$PUBLISH_OUTPUT" | jq -r '.objectChanges[] | select(.type == "created" and (.objectType | endswith("::interop_control::InteropRegistry"))) | .objectId')

# Also capture shared object IDs (BLRegistry, GlobalCarrierRegistry)
echo "$PUBLISH_OUTPUT" | jq '.objectChanges[] | select(.type == "created")'

echo ""
echo "============================================"
echo "PACKAGE_ID=$PACKAGE_ID"
echo "BL_REGISTRY_ID=$BL_REGISTRY_ID"
echo "CARRIER_REGISTRY_ID=$CARRIER_REGISTRY_ID"
echo "INTEROP_REGISTRY_ID=$INTEROP_REGISTRY_ID"
echo "============================================"
echo "Verify: https://explorer.iota.org/object/$PACKAGE_ID?network=$TARGET_NETWORK"
echo ""
echo "Suggested frontend .env values:"
echo "VITE_NETWORK=$TARGET_NETWORK"
echo "VITE_PACKAGE_ID=$PACKAGE_ID"
echo "VITE_BL_REGISTRY_ID=$BL_REGISTRY_ID"
echo "VITE_CARRIER_REGISTRY_ID=$CARRIER_REGISTRY_ID"
echo "VITE_INTEROP_REGISTRY_ID=$INTEROP_REGISTRY_ID"
if [[ -n "$TARGET_RPC_URL" ]]; then
  echo "VITE_RPC_URL=$TARGET_RPC_URL"
fi
