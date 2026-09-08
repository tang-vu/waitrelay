param([Parameter(Mandatory = $true)][string]$WorkDirectory)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Speech
$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $voice.SelectVoice("Microsoft Zira Desktop")
  $voice.Rate = 1
  $segments = Get-Content -LiteralPath (Join-Path $WorkDirectory "narration.json") -Raw -Encoding UTF8 | ConvertFrom-Json
  for ($index = 0; $index -lt $segments.Count; $index++) {
    $voice.SetOutputToWaveFile((Join-Path $WorkDirectory "voice-$index.wav"))
    $voice.Speak($segments[$index].text)
  }
} finally { $voice.Dispose() }
