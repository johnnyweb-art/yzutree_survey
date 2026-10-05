$ErrorActionPreference='Stop'
$tutorialRoot=Split-Path -Parent $PSScriptRoot
$tutorialOutput=Join-Path $tutorialRoot '.test-output/narration'
New-Item -ItemType Directory -Force -Path $tutorialOutput | Out-Null
Add-Type -AssemblyName System.Speech
$tutorialSpeaker=New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $tutorialSpeaker.SelectVoice('Microsoft Hanhan Desktop')
  $tutorialSpeaker.Rate=0
  $tutorialLines=Get-Content -Raw -Encoding utf8 (Join-Path $tutorialRoot 'media/narration.json') | ConvertFrom-Json
  for($tutorialIndex=0;$tutorialIndex -lt $tutorialLines.Count;$tutorialIndex++) {
    $tutorialWave=Join-Path $tutorialOutput ('{0:D2}.wav' -f $tutorialIndex)
    $tutorialSpeaker.SetOutputToWaveFile($tutorialWave)
    $tutorialSpeaker.Speak($tutorialLines[$tutorialIndex])
    $tutorialSpeaker.SetOutputToNull()
  }
} finally { $tutorialSpeaker.Dispose() }
