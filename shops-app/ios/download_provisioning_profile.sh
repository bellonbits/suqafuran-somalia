#!/bin/bash
set -e

# Download provisioning profile using App Store Connect API
# Requires: APP_STORE_CONNECT_API_KEY_ID, APP_STORE_CONNECT_ISSUER_ID, APP_STORE_CONNECT_API_KEY

BUNDLE_ID="com.suqafuran.app"
PROFILE_NAME="Suqafuran App Store"
TEAM_ID="2969422VU2"
PROFILES_DIR="$HOME/Library/MobileDevice/Provisioning Profiles"

echo "Downloading provisioning profile for $BUNDLE_ID..."

# Create profiles directory if it doesn't exist
mkdir -p "$PROFILES_DIR"

# Create temporary API key JSON file
API_KEY_FILE=$(mktemp)
cat > "$API_KEY_FILE" <<EOF
{
  "key_id": "$APP_STORE_CONNECT_API_KEY_ID",
  "issuer_id": "$APP_STORE_CONNECT_ISSUER_ID",
  "key": "$APP_STORE_CONNECT_API_KEY"
}
EOF

# Download using fastlane's sigh with readonly mode
cd "$(dirname "$0")"
fastlane sigh \
  --app_identifier "$BUNDLE_ID" \
  --team_id "$TEAM_ID" \
  --provisioning_name "$PROFILE_NAME" \
  --readonly \
  --api_key_path "$API_KEY_FILE"

# Clean up
rm -f "$API_KEY_FILE"

echo "Provisioning profile installed successfully"
