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

$bash = $env:CLAUDE_CODE_GIT_BASH_PATH
if (-not $bash -or -not (Test-Path -LiteralPath $bash)) {
  $git = Get-Command git.exe -ErrorAction SilentlyContinue
  if ($git) {
    $candidate = Join-Path (Split-Path (Split-Path $git.Source)) "bin\bash.exe"
    if (Test-Path -LiteralPath $candidate) { $bash = $candidate }
  }
}

$start = New-Object System.Diagnostics.ProcessStartInfo
$start.EnvironmentVariables["FUYU_STATUSLINE_NEXT"] = $command
if ($bash -and (Test-Path -LiteralPath $bash)) {
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
