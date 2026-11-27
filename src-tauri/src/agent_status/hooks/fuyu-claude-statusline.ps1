$ErrorActionPreference = "SilentlyContinue"
$utf8 = New-Object System.Text.UTF8Encoding $false
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8

$directory = if ($env:FOCUSD_AGENT_STATUS_DIR) { $env:FOCUSD_AGENT_STATUS_DIR } else { $PSScriptRoot }
$text = [Console]::In.ReadToEnd()

if ($text -match '"rate_limits"' -and $text -match '"used_percentage"') {
  $target = Join-Path $directory "claude-statusline.json"
  $temporary = Join-Path $directory ".claude-statusline-$PID"
  try {
    [System.IO.File]::WriteAllText($temporary, $text, $utf8)
    Move-Item -LiteralPath $temporary -Destination $target -Force
  } catch {
    Remove-Item -LiteralPath $temporary -Force
  }
}

$nextPath = Join-Path $directory "claude-statusline-next.txt"
if (-not (Test-Path -LiteralPath $nextPath)) { exit 0 }
$command = ([System.IO.File]::ReadAllText($nextPath, $utf8)).Trim()
if (-not $command -or $command -like "*fuyu-claude-statusline*") { exit 0 }

function Find-GitBash([string]$git) {
  $candidates = @($env:CLAUDE_CODE_GIT_BASH_PATH)
  if ($env:EXEPATH) { $candidates += @((Join-Path $env:EXEPATH "bin\bash.exe"), (Join-Path $env:EXEPATH "bash.exe")) }
  $directory = if ($git) { Split-Path $git } else { "" }
  for ($level = 0; $directory -and $level -lt 4; $level++) {
    $candidates += Join-Path $directory "bin\bash.exe"
    $directory = Split-Path $directory
  }
  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) { return $candidate }
  }
}

$git = Get-Command git.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
$bash = Find-GitBash $(if ($git) { $git.Source } else { "" })

$start = New-Object System.Diagnostics.ProcessStartInfo
$start.EnvironmentVariables["FUYU_STATUSLINE_NEXT"] = $command
if ($bash) {
  $start.FileName = $bash
  $start.Arguments = '-c "eval \"$FUYU_STATUSLINE_NEXT\""'
} else {
  $start.FileName = "cmd.exe"
  $start.Arguments = '/d /s /c "%FUYU_STATUSLINE_NEXT%"'
}
$start.UseShellExecute = $false
$start.RedirectStandardInput = $true
$start.RedirectStandardOutput = $true
$start.StandardOutputEncoding = $utf8
$start.CreateNoWindow = $true
$process = [System.Diagnostics.Process]::Start($start)
$writer = New-Object System.IO.StreamWriter($process.StandardInput.BaseStream, $utf8)
$writer.Write($text)
$writer.Close()
$output = $process.StandardOutput.ReadToEnd()
$process.WaitForExit()
[Console]::Out.Write($output)
