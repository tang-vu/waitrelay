$ErrorActionPreference = "Stop"
$sourceScript = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "../../ops/deploy-local.ps1"))
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ("waitrelay-deploy-test-" + [Guid]::NewGuid().ToString("N"))
$originalTestBuild = $env:WAITRELAY_TEST_BUILD
$originalExitCode = $global:LASTEXITCODE
$testState = @{ commands = [Collections.Generic.List[string]]::new(); scenario = "success" }

# These scoped functions replace all external commands invoked by the copied
# deployment script. No real PM2 process, build, or network request is touched.
function pm2 {
  $testState.commands.Add(($args -join " "))
  $global:LASTEXITCODE = 0
}
function pnpm {
  if (($args -join " ") -ne "build") { throw "Unexpected pnpm invocation" }
  if ($env:WAITRELAY_TEST_BUILD -ne "0") { throw "Production build flag was not selected" }
  New-Item -ItemType Directory -Path ".next" | Out-Null
  Set-Content -LiteralPath ".next/BUILD_ID" -Value "new-build"
  $global:LASTEXITCODE = if ($testState.scenario -eq "build-failure") { 1 } else { 0 }
}
function Invoke-WebRequest {
  return [pscustomobject]@{ StatusCode = 200; Content = '{"ok":true}' }
}

try {
  foreach ($scenario in @("success", "build-failure", "preflight-failure")) {
    $testState.scenario = $scenario
    $testState.commands.Clear()
    $workspace = Join-Path $testRoot $scenario
    $ops = Join-Path $workspace "ops"
    New-Item -ItemType Directory -Path $ops | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $workspace ".next") | Out-Null
    Set-Content -LiteralPath (Join-Path $workspace ".next/BUILD_ID") -Value "previous-build"
    Copy-Item -LiteralPath $sourceScript -Destination (Join-Path $ops "deploy-local.ps1")
    $preflight = if ($scenario -eq "preflight-failure") { 'throw "Simulated preflight failure"' } else { 'Write-Host "Simulated preflight passed"' }
    Set-Content -LiteralPath (Join-Path $ops "hosting-preflight.ps1") -Value $preflight
    $env:WAITRELAY_TEST_BUILD = "1"
    $failed = $false
    try { & (Join-Path $ops "deploy-local.ps1") } catch { $failed = $true }
    $expectedFailure = $scenario -ne "success"
    if ($failed -ne $expectedFailure) { throw "Unexpected result for $scenario" }
    $expectedBuild = if ($expectedFailure) { "previous-build" } else { "new-build" }
    if ((Get-Content -LiteralPath (Join-Path $workspace ".next/BUILD_ID")).Trim() -ne $expectedBuild) {
      throw "Wrong active build after $scenario"
    }
    if ($env:WAITRELAY_TEST_BUILD -ne "1") { throw "Caller environment was not restored" }
    $expectedCommands = if ($expectedFailure) {
      if ($scenario -eq "build-failure") {
        @("stop waitrelay-web", "stop waitrelay-web", "restart waitrelay-web --update-env")
      } else {
        @("stop waitrelay-web", "restart waitrelay-web --update-env", "stop waitrelay-web", "restart waitrelay-web --update-env")
      }
    } else { @("stop waitrelay-web", "restart waitrelay-web --update-env", "save --force") }
    if (($testState.commands -join '|') -ne ($expectedCommands -join '|')) { throw "Unexpected process operations: $($testState.commands -join ', ')" }
    # An exclusive reopen proves the deployment lock was released on both paths.
    $lock = [IO.File]::Open((Join-Path $workspace ".deploy.lock"), 'Open', 'ReadWrite', 'None')
    $lock.Dispose()
    Write-Host "PASS deployment $scenario"
  }
} finally {
  $env:WAITRELAY_TEST_BUILD = $originalTestBuild
  $global:LASTEXITCODE = $originalExitCode
  $resolved = [IO.Path]::GetFullPath($testRoot)
  $expectedPrefix = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\waitrelay-deploy-test-'
  if (-not $resolved.StartsWith($expectedPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw "Unsafe test cleanup path" }
  if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
}
