param(
  [Parameter(Mandatory = $true)][string]$Installer,
  [int]$StartSeconds = 25
)
$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  Write-Host "::error::$Message"
  exit 1
}

if (-not (Test-Path $Installer)) { Fail "No installer at $Installer" }
$hash = (Get-FileHash $Installer -Algorithm SHA256).Hash.ToLower()
Write-Host "Installer: $(Split-Path $Installer -Leaf) sha256 $hash"

$install = Start-Process -FilePath $Installer -ArgumentList "/S" -Wait -PassThru
if ($install.ExitCode -ne 0) { Fail "The installer exited with $($install.ExitCode)" }

$key = @(
  "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Fuyu",
  "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Fuyu"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $key) { Fail "The installer left no uninstall entry" }
$entry = Get-ItemProperty $key
$dir = $entry.InstallLocation.Trim('"')
$exe = Join-Path $dir "fuyu.exe"
if (-not (Test-Path $exe)) { Fail "No fuyu.exe in $dir" }
Write-Host "Installed $($entry.DisplayVersion) to $dir"

$data = Join-Path $env:USERPROFILE ".fuyu"
foreach ($old in @($data, (Join-Path $env:APPDATA "com.tixxin.fuyu"))) {
  if (Test-Path $old) { Fail "$old exists before the first start; the runner is not clean" }
}
$app = Start-Process -FilePath $exe -WorkingDirectory $dir -PassThru

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class SmokeWindows {
  delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc proc, IntPtr lParam);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hWnd);
  public static int Visible(uint pid) {
    int count = 0;
    EnumWindows((h, l) => { uint owner; GetWindowThreadProcessId(h, out owner); if (owner == pid && IsWindowVisible(h)) count++; return true; }, IntPtr.Zero);
    return count;
  }
}
"@

$windows = 0
for ($i = 0; $i -lt $StartSeconds; $i++) {
  Start-Sleep -Seconds 1
  if ($app.HasExited) { Fail "fuyu.exe exited $($i + 1)s after starting (code $($app.ExitCode))" }
  $windows = [SmokeWindows]::Visible([uint32]$app.Id)
  if ($windows -gt 0 -and $i -ge 9) { break }
}
if ($windows -eq 0) { Fail "fuyu.exe ran ${StartSeconds}s without showing a window" }
$created = if (Test-Path $data) { "data folder created" } else { "no data folder yet" }
if (-not (Test-Path $data)) { Write-Host "::warning::fuyu.exe has not created $data yet" }
Write-Host "fuyu.exe is up with $windows visible window(s); $created"

Get-Process -Name fuyu -ErrorAction SilentlyContinue | Stop-Process -Force
$uninstaller = Join-Path $dir "uninstall.exe"
if (Test-Path $uninstaller) {
  $remove = Start-Process -FilePath $uninstaller -ArgumentList "/S" -Wait -PassThru
  if ($remove.ExitCode -ne 0) { Fail "The uninstaller exited with $($remove.ExitCode)" }
}
Write-Host "Smoke test passed."
