$ErrorActionPreference = "Stop"

function Assert-Condition {
  param(
    [Parameter(Mandatory = $true)][bool]$Condition,
    [Parameter(Mandatory = $true)][string]$Message
  )
  if (-not $Condition) { throw $Message }
  Write-Host "PASS  $Message"
}

$expectedProcesses = @("waitrelay-web", "waitrelay-proxy", "waitrelay-tunnel")
foreach ($name in $expectedProcesses) {
  $processIds = @(& pm2 pid $name) | ForEach-Object {
    $parsedId = 0
    if ([int]::TryParse(([string]$_).Trim(), [ref]$parsedId)) { $parsedId }
  } | Where-Object { $_ -gt 0 }
  Assert-Condition ($processIds.Count -gt 0) "PM2 process $name is online"
}

$localHealth = Invoke-WebRequest -UseBasicParsing -TimeoutSec 10 "http://127.0.0.1:4317/api/health"
Assert-Condition ($localHealth.StatusCode -eq 200) "Local origin health is HTTP 200"
$localPayload = $localHealth.Content | ConvertFrom-Json
Assert-Condition ($localPayload.ok -eq $true) "Local application health reports ready"

$publicHealth = Invoke-WebRequest -UseBasicParsing -TimeoutSec 15 "https://waitrelay.tangvu.dev/api/health"
Assert-Condition ($publicHealth.StatusCode -eq 200) "Public tunnel health is HTTP 200"
$publicPayload = $publicHealth.Content | ConvertFrom-Json
Assert-Condition ($publicPayload.ok -eq $true) "Public application health reports ready"

$hostPage = Invoke-WebRequest -UseBasicParsing -TimeoutSec 15 "https://waitrelay.tangvu.dev/demo?scenario=standard&seed=fork-flight-001"
$hostCsp = [string]$hostPage.Headers["Content-Security-Policy"]
$hostCache = [string]$hostPage.Headers["Cache-Control"]
Assert-Condition ($hostCsp -match "frame-ancestors 'none'") "Host page rejects external framing"
Assert-Condition ($hostCsp -match "frame-src 'self'") "Host page allows only its own flight frame"
Assert-Condition ([string]$hostPage.Headers["Strict-Transport-Security"] -match "max-age=") "Public host sends HSTS"
Assert-Condition ($hostCache -match "no-transform") "HTML disables intermediary transformation"
Assert-Condition ($hostPage.Content -notmatch "cloudflareinsights|beacon\.min\.js") "Host HTML contains no injected analytics beacon"

$flightPage = Invoke-WebRequest -UseBasicParsing -TimeoutSec 15 "https://waitrelay.tangvu.dev/flight"
$flightCsp = [string]$flightPage.Headers["Content-Security-Policy"]
Assert-Condition ($flightCsp -match "connect-src 'none'") "Flight frame cannot make network connections"
Assert-Condition ($flightCsp -match "frame-ancestors 'self'") "Flight frame can be embedded only by WaitRelay"
Assert-Condition ($flightPage.Content -notmatch "cloudflareinsights|beacon\.min\.js") "Flight HTML contains no injected analytics beacon"

Write-Host "WaitRelay hosting preflight passed."
