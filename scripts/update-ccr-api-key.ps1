# Ensure script stops on errors
$ErrorActionPreference = "Stop"

################################################################################
# 1. Run the executable 'qwen' for 10 seconds and then kill it
################################################################################
Write-Host "Running qwen for 10 seconds..."
$process = Start-Process "qwen" -ArgumentList "-y", "-p", "hello" -PassThru
# Start-Sleep -Seconds 10
# Stop-Process -Id $process.Id -Force
# Write-Host "Killed qwen process."

################################################################################
# 2–3. Read ~/.qwen/oauth_creds.json and extract the access_token
################################################################################
$credsFile = Join-Path $HOME ".qwen/oauth_creds.json"
$credsJson = Get-Content $credsFile -Raw | ConvertFrom-Json
$accessToken = $credsJson.access_token
Write-Host "Fetched access_token from $credsFile"

################################################################################
# 4–6. Replace the api_key inside the qwen-portal provider block
################################################################################
function Update-ConfigFile {
  param (
    [string]$configFile,
    [string]$newKey
  )

  $jsonText = Get-Content $configFile -Raw
  $jsonObj = $jsonText | ConvertFrom-Json

  $oldKey = $null
  foreach ($provider in $jsonObj.Providers) {
    if ($provider.name -eq "qwen-portal") {
      $oldKey = $provider.api_key
      $provider.api_key = $newKey
      break
    }
  }

  # Save updated config back
  $jsonObj | ConvertTo-Json -Depth 10 | Set-Content $configFile -Encoding UTF8

  Write-Host "Updated $configFile"
  return $oldKey
}


$config1 = Join-Path $HOME ".claude-code-router/config.json"
$config2 = Join-Path $HOME ".custom-claude-code-router/config.json"

# Fungsi untuk memastikan direktori dan file konfigurasi ada
function Ensure-ConfigFile {
  param (
    [string]$configFile
  )
  
  $configDir = Split-Path $configFile -Parent
  
  # Buat direktori jika tidak ada
  if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir | Out-Null
    Write-Host "Created directory: $configDir"
  }
  
  # Salin file konfigurasi dari config.example.json jika tidak ada
  if (-not (Test-Path $configFile)) {
    $exampleConfig = Join-Path (Get-Location) "config.example.json"
    if (Test-Path $exampleConfig) {
      Copy-Item $exampleConfig $configFile
      Write-Host "Copied config from $exampleConfig to $configFile"
    }
    else {
      Write-Host "Warning: $exampleConfig not found. Creating empty config file."
      Set-Content $configFile "{}"
    }
  }
}

# Pastikan file konfigurasi ada sebelum memperbarui
Ensure-ConfigFile -configFile $config1
Ensure-ConfigFile -configFile $config2

$oldKey = Update-ConfigFile -configFile $config1 -newKey $accessToken
$null = Update-ConfigFile -configFile $config2 -newKey $accessToken
################################################################################
# 7. Echo the change
################################################################################
Write-Host "Old api_key : $oldKey"
Write-Host "New api_key : $accessToken"
