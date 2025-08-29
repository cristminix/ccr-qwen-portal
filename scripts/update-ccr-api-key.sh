#!/usr/bin/env bash
set -euo pipefail
################################################################################
# 1. Run the executable 'qwen' for 10 seconds and then kill it
################################################################################
qwen -y -p hello 
################################################################################
# 2–3. Read ~/.qwen/oauth_creds.json and extract the access_token
################################################################################
CREDS_FILE="$HOME/.qwen/oauth_creds.json"
ACCESS_TOKEN=$(jq -r '.access_token' "$CREDS_FILE")
echo "Fetched access_token from $CREDS_FILE"
################################################################################
# 4–6. Replace the api_key inside the qwen-portal provider block
################################################################################
CONFIG_FILE="$HOME/.claude-code-router/config.json"
TMP_FILE="${CONFIG_FILE}.tmp"
# Pull the old value for logging
OLD_KEY=$(jq -r '.Providers[] | select(.name == "qwen-portal").api_key' "$CONFIG_FILE")
# ----- in-place key replacement -----
# We only update the first provider whose name is "qwen-portal"
jq --arg new_key "$ACCESS_TOKEN" \
  '(.Providers[] | select(.name == "qwen-portal")).api_key |= $new_key' \
  "$CONFIG_FILE" > "$TMP_FILE"
mv "$TMP_FILE" "$CONFIG_FILE"
echo "Updated $CONFIG_FILE"
################################################################################
# 4–6. Replace the api_key inside the qwen-portal provider block
################################################################################
CONFIG_FILE="$HOME/.custom-claude-code-router/config.json"
TMP_FILE="${CONFIG_FILE}.tmp"
# Pull the old value for logging
OLD_KEY=$(jq -r '.Providers[] | select(.name == "qwen-portal").api_key' "$CONFIG_FILE")
# ----- in-place key replacement -----
# We only update the first provider whose name is "qwen-portal"
jq --arg new_key "$ACCESS_TOKEN" \
  '(.Providers[] | select(.name == "qwen-portal")).api_key |= $new_key' \
  "$CONFIG_FILE" > "$TMP_FILE"
mv "$TMP_FILE" "$CONFIG_FILE"
echo "Updated $CONFIG_FILE"
################################################################################
# 7. Echo the change
################################################################################
echo "Old api_key : $OLD_KEY"
echo "New api_key : $ACCESS_TOKEN"