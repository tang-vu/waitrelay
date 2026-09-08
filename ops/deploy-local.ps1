$ErrorActionPreference = "Stop"

$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$workspacePrefix = $workspace.TrimEnd('\') + '\'

function Get-WorkspacePath([string]$RelativePath) {
  $resolved = [IO.Path]::GetFullPath((Join-Path $workspace $RelativePath))
  if (-not $resolved.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Deployment path must remain inside the workspace."
  }
  return $resolved
}

function Invoke-Checked {
  param([string]$Command, [string[]]$Arguments)
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Command failed with exit code $LASTEXITCODE" }
}

function Wait-Origin {
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 "http://127.0.0.1:4317/api/health"
      $health = $response.Content | ConvertFrom-Json
      if ($response.StatusCode -eq 200 -and $health.ok -eq $true) { return }
    } catch { }
    Start-Sleep -Seconds 1
  }
  throw "The production origin did not become healthy."
}

$lock = $null
$previousTestBuild = $env:WAITRELAY_TEST_BUILD
$build = Get-WorkspacePath ".next"
$backupRoot = Get-WorkspacePath ".release-backups"
$release = Join-Path $backupRoot (Get-Date -Format "yyyyMMdd-HHmmss-fff")
$backup = Join-Path $release "previous-build"
$failed = Join-Path $release "failed-build"
foreach ($target in @($build, $release, $backup, $failed)) {
  if (-not ([IO.Path]::GetFullPath($target)).StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Unsafe deployment move target."
  }
}
foreach ($directory in @($build, $backupRoot)) {
  if ((Test-Path -LiteralPath $directory) -and
      ((Get-Item -LiteralPath $directory).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw "Deployment directories must not be junctions or symbolic links."
  }
}
$stopped = $false
$backedUp = $false

Push-Location $workspace
try {
  $lock = [IO.File]::Open((Get-WorkspacePath ".deploy.lock"), 'OpenOrCreate', 'ReadWrite', 'None')
  if (-not (Test-Path -LiteralPath (Join-Path $build "BUILD_ID"))) {
    throw "An existing production build is required for rollback."
  }
  $env:WAITRELAY_TEST_BUILD = "0"
  New-Item -ItemType Directory -Path $release | Out-Null
  Write-Host "Keeping the previous production build at $backup"
  Invoke-Checked -Command "pm2" -Arguments @("stop", "waitrelay-web")
  $stopped = $true
  Move-Item -LiteralPath $build -Destination $backup
  $backedUp = $true
  Invoke-Checked -Command "pnpm" -Arguments @("build")
  Invoke-Checked -Command "pm2" -Arguments @("restart", "waitrelay-web", "--update-env")
  Wait-Origin
  & (Join-Path $PSScriptRoot "hosting-preflight.ps1")
  Invoke-Checked -Command "pm2" -Arguments @("save", "--force")
  Write-Host "Production update verified. Previous build retained at $backup"
} catch {
  $failure = $_
  if ($stopped) {
    Write-Warning "Production update failed. Restoring the previous build."
    Invoke-Checked -Command "pm2" -Arguments @("stop", "waitrelay-web")
    if ($backedUp) {
      if (Test-Path -LiteralPath $build) { Move-Item -LiteralPath $build -Destination $failed }
      Move-Item -LiteralPath $backup -Destination $build
    }
    Invoke-Checked -Command "pm2" -Arguments @("restart", "waitrelay-web", "--update-env")
    Wait-Origin
    Write-Host "Previous production build restored and healthy."
  }
  throw $failure
} finally {
  $env:WAITRELAY_TEST_BUILD = $previousTestBuild
  if ($null -ne $lock) { $lock.Dispose() }
  Pop-Location
}
