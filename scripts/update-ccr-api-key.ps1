# update-ccr-api-key.ps1
# This script updates the Claude Code Router API key for qwen-portal.

# Equivalent to 'set -euo pipefail' in bash
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Define variables

Write-Host "Starting API key update process..."

# 1. Run the executable 'qwen' for 10 seconds and then kill it
Write-Host "Running qwen and waiting for it to exit..."
$qwenProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c qwen -y -p hello" -PassThru -NoNewWindow
$qwenProcess.WaitForExit()

################################################################################
# 2–3. Read ~/.qwen/oauth_creds.json and extract the access_token
################################################################################
$CREDS_FILE = Join-Path $HOME ".qwen/oauth_creds.json"
Write-Host "Reading credentials from $CREDS_FILE"
$CREDS_CONTENT = Get-Content -Path $CREDS_FILE -Raw | ConvertFrom-Json
$ACCESS_TOKEN = $CREDS_CONTENT.access_token
Write-Host "Fetched access_token from $CREDS_FILE"

################################################################################
# 4–6. Replace the api_key inside the qwen-portal provider block for ~/.claude-code-router/config.json
################################################################################
$CONFIG_FILE = Join-Path $HOME ".claude-code-router/config.json"
$TMP_FILE = "${CONFIG_FILE}.tmp"

if (-not (Test-Path $CONFIG_FILE)) {
    Write-Warning "Configuration file not found: $CONFIG_FILE - Skipping update."
} else {
    Write-Host "Updating $CONFIG_FILE"
    $CONFIG_CONTENT = Get-Content -Path $CONFIG_FILE -Raw | ConvertFrom-Json

    # Pull the old value for logging
    $oldKey1 = $null
    foreach ($provider in $CONFIG_CONTENT.Providers) {
        if ($provider.name -eq "qwen-portal") {
            $oldKey1 = $provider.api_key
            break
        }
    }

    # ----- in-place key replacement -----
    # We only update the first provider whose name is "qwen-portal"
    foreach ($provider in $CONFIG_CONTENT.Providers) {
        if ($provider.name -eq "qwen-portal") {
            $provider.api_key = $ACCESS_TOKEN
            break
        }
    }

    $CONFIG_CONTENT | ConvertTo-Json -Depth 100 | Set-Content -Path $TMP_FILE -Force
    Move-Item -Path $TMP_FILE -Destination $CONFIG_FILE -Force
    Write-Host "Updated $CONFIG_FILE"
}

################################################################################
# 4–6. Replace the api_key inside the qwen-portal provider block for ~/.custom-claude-code-router/config.json
################################################################################
$CONFIG_FILE = Join-Path $HOME ".custom-claude-code-router/config.json"
$TMP_FILE = "${CONFIG_FILE}.tmp"

if (-not (Test-Path $CONFIG_FILE)) {
    Write-Warning "Configuration file not found: $CONFIG_FILE - Skipping update."
} else {
    Write-Host "Updating $CONFIG_FILE"
    $CONFIG_CONTENT = Get-Content -Path $CONFIG_FILE -Raw | ConvertFrom-Json

    # Pull the old value for logging
    $oldKey2 = $null
    foreach ($provider in $CONFIG_CONTENT.Providers) {
        if ($provider.name -eq "qwen-portal") {
            $oldKey2 = $provider.api_key
            break
        }
    }

    # ----- in-place key replacement -----
    # We only update the first provider whose name is "qwen-portal"
    foreach ($provider in $CONFIG_CONTENT.Providers) {
        if ($provider.name -eq "qwen-portal") {
            $provider.api_key = $ACCESS_TOKEN
            break
        }
    }

    $CONFIG_CONTENT | ConvertTo-Json -Depth 100 | Set-Content -Path $TMP_FILE -Force
    Move-Item -Path $TMP_FILE -Destination $CONFIG_FILE -Force
    Write-Host "Updated $CONFIG_FILE"
}

################################################################################
# 7. Echo the change
################################################################################
Write-Host "Old api_key (for first config) : $oldKey1"
Write-Host "Old api_key (for second config) : $oldKey2"
Write-Host "New api_key : $ACCESS_TOKEN"
