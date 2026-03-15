# Install tstudio CLI — TerraStudio headless CLI
# Usage: irm https://raw.githubusercontent.com/afroze9/terrastudio/master/scripts/install.ps1 | iex
[CmdletBinding()]
param(
  [string]$InstallDir = "$env:LOCALAPPDATA\Programs\tstudio"
)

$ErrorActionPreference = 'Stop'
$Repo = "afroze9/terrastudio"

# Get latest release version
Write-Host "Fetching latest tstudio release..."
$release = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest"
$tagName = $release.tag_name  # e.g. apps/desktop-v0.40.0
$version = $tagName -replace '^apps/desktop-v', ''

Write-Host "Installing tstudio v$version (win-x64)..."

$fileName = "tstudio-$version-win-x64.exe"
$url = "https://github.com/$Repo/releases/download/$tagName/$fileName"
$tmpFile = Join-Path $env:TEMP $fileName

Invoke-WebRequest -Uri $url -OutFile $tmpFile -UseBasicParsing

# Create install dir and move binary
if (-not (Test-Path $InstallDir)) {
  New-Item -ItemType Directory -Path $InstallDir | Out-Null
}
$dest = Join-Path $InstallDir "tstudio.exe"
Move-Item -Force $tmpFile $dest

# Add to PATH if not already present
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($userPath -notlike "*$InstallDir*") {
  [Environment]::SetEnvironmentVariable('Path', "$userPath;$InstallDir", 'User')
  Write-Host "Added $InstallDir to your PATH (restart terminal to take effect)"
}

Write-Host ""
Write-Host "tstudio v$version installed to $dest"
Write-Host "Run: tstudio --help"
