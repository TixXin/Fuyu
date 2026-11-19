param(
  [Parameter(Mandatory = $true)][string]$Installer,
  [int]$StartSeconds = 25,
  [int]$HostSeconds = 90,
  [int]$DownloadSeconds = 300
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
node scripts/plugins-v3/release-resources.mjs --verify $dir
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$desktops = @([Environment]::GetFolderPath("Desktop"), [Environment]::GetFolderPath("CommonDesktopDirectory")) | Where-Object { $_ -and (Test-Path $_) }
$shortcutName = "$([char]0x6D6E)$([char]0x5C7F).lnk"
$shortcut = $desktops | ForEach-Object { Join-Path $_ $shortcutName } | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $shortcut) { Fail "No $shortcutName on the desktop" }
$oldShortcut = $desktops | ForEach-Object { Join-Path $_ "Fuyu.lnk" } | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($oldShortcut) { Fail "Old shortcut $oldShortcut exists on the desktop" }

$data = Join-Path $env:USERPROFILE ".fuyu"
foreach ($old in @($data, (Join-Path $env:APPDATA "com.tixxin.fuyu"))) {
  if (Test-Path $old) { Fail "$old exists before the first start; the runner is not clean" }
}
$logs = if ($env:FUYU_SMOKE_LOGS) { $env:FUYU_SMOKE_LOGS } else { Join-Path ([IO.Path]::GetTempPath()) "fuyu-smoke" }
New-Item -ItemType Directory -Force $logs | Out-Null

function Start-Fuyu([string]$Name) {
  $log = Join-Path $logs "$Name.stderr.log"
  Remove-Item $log, "$log.out" -ErrorAction SilentlyContinue
  $started = Start-Process -FilePath $exe -WorkingDirectory $dir -PassThru -RedirectStandardError $log -RedirectStandardOutput "$log.out"
  return @{ Process = $started; Log = $log }
}

function Read-Log([string]$Path) {
  if (-not (Test-Path $Path)) { return "" }
  $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete)
  try { return (New-Object IO.StreamReader($stream)).ReadToEnd() } finally { $stream.Dispose() }
}

function Show-Log([string]$Path, [int]$Lines = 40) {
  $all = (Read-Log $Path) -split "`r?`n"
  Write-Host "----- first $Lines of $($all.Count) lines of fuyu.exe stderr ($Path) -----"
  $all | Select-Object -First $Lines | ForEach-Object { Write-Host $_ }
  Write-Host "----- last $Lines lines -----"
  $all | Select-Object -Last $Lines | ForEach-Object { Write-Host $_ }
  Write-Host "-----"
}

function Stop-Fuyu {
  Get-Process -Name fuyu -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Seconds 2
  Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Seconds 1
}

function Wait-Window($Run) {
  $windows = 0
  for ($i = 0; $i -lt $StartSeconds; $i++) {
    Start-Sleep -Seconds 1
    if ($Run.Process.HasExited) { Show-Log $Run.Log; Fail "fuyu.exe exited $($i + 1)s after starting (code $($Run.Process.ExitCode))" }
    $windows = [SmokeWindows]::Visible([uint32]$Run.Process.Id)
    if ($windows -gt 0 -and $i -ge 9) { break }
  }
  if ($windows -eq 0) { Show-Log $Run.Log; Fail "fuyu.exe ran ${StartSeconds}s without showing a window" }
  return $windows
}

function Wait-PluginHost($Run, [string]$Source, [int]$Seconds) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    $text = Read-Log $Run.Log
    if ($text -match '\[plugins-v3\] no Node for the plugin host: ([^\r\n]*)') { Show-Log $Run.Log; Fail "The plugin host got no Node: $($Matches[1])" }
    if ($text -match '\[plugins-v3\] the plugin host did not start: ([^\r\n]*)') { Show-Log $Run.Log; Fail "The plugin host did not start: $($Matches[1])" }
    $used = [regex]::Match($text, '\[plugins-v3\] using Node (\S+) \(([^)]+)\) at ([^\r\n]*)')
    if ($used.Success -and $used.Groups[2].Value -ne $Source) { Show-Log $Run.Log; Fail "The plugin host used Node $($used.Groups[1].Value) $($used.Groups[2].Value) at $($used.Groups[3].Value), expected one $Source" }
    $ready = [regex]::Match($text, '\[plugins-v3\] host ready \([^)]*\)')
    if ($used.Success -and $ready.Success) {
      $text -split "`r?`n" | Where-Object { $_ -match '^\[plugins-v3\] ' } | ForEach-Object { Write-Host "  $_" }
      return $used.Groups[3].Value
    }
    if ($Run.Process.HasExited) { Show-Log $Run.Log; Fail "fuyu.exe exited (code $($Run.Process.ExitCode)) before the plugin host was ready" }
    Start-Sleep -Seconds 1
  }
  Show-Log $Run.Log
  if ((Read-Log $Run.Log) -notmatch '\[plugins-v3\]') { Fail "fuyu.exe wrote no [plugins-v3] line to stderr in ${Seconds}s; the plugin host never started or its log was not captured" }
  Fail "The plugin host was not ready with Node $Source within ${Seconds}s"
}

function Hide-Node {
  $hidden = @()
  $kept = @()
  foreach ($entry in ($env:PATH -split ';')) {
    if (-not $entry) { continue }
    if (Test-Path (Join-Path $entry "node.exe")) { $hidden += "PATH entry $entry" } else { $kept += $entry }
  }
  $env:PATH = $kept -join ';'
  $env:FUYU_NODE = $null
  $moved = @()
  $places = @((Join-Path $env:ProgramFiles "nodejs"), (Join-Path $env:LOCALAPPDATA "Programs\nodejs"), (Join-Path $env:LOCALAPPDATA "Volta\bin"), (Join-Path $env:APPDATA "fnm\aliases\default"), $env:NVM_SYMLINK)
  foreach ($place in $places) {
    if (-not $place -or -not (Test-Path (Join-Path $place "node.exe"))) { continue }
    $aside = "$place.hidden-by-smoke-test"
    try { Rename-Item -LiteralPath $place -NewName (Split-Path $aside -Leaf) -ErrorAction Stop } catch { Fail "Could not move $place aside to hide its Node: $_" }
    $moved += @{ From = $place; To = $aside }
    $hidden += "folder $place"
  }
  $still = Get-Command node -ErrorAction SilentlyContinue
  if ($still) { Fail "node is still on PATH at $($still.Source) after hiding it" }
  Write-Host "Hid Node from fuyu.exe: $(if ($hidden) { $hidden -join '; ' } else { 'there was none' })"
  return $moved
}

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

$first = Start-Fuyu "with-node"
$windows = Wait-Window $first
$created = if (Test-Path $data) { "data folder created" } else { "no data folder yet" }
if (-not (Test-Path $data)) { Write-Host "::warning::fuyu.exe has not created $data yet" }
Write-Host "fuyu.exe is up with $windows visible window(s); $created"
$systemNode = Wait-PluginHost $first "found on this computer" $HostSeconds
Write-Host "The plugin host is ready with this computer's Node at $systemNode"
Stop-Fuyu

$runtime = Join-Path $data "runtime"
if (Test-Path $runtime) { Fail "$runtime exists before the run without Node; the first run should not have downloaded one" }
$savedPath = $env:PATH
$moved = Hide-Node
$second = Start-Fuyu "without-node"
$windows = Wait-Window $second
Write-Host "fuyu.exe is up again with $windows visible window(s) and no Node on this computer"
$downloaded = Wait-PluginHost $second "downloaded by Fuyu" $DownloadSeconds
$fullRuntime = (Resolve-Path $runtime).Path
$downloaded = $downloaded -replace '^\\\\\?\\', ''
if (-not ([IO.Path]::GetFullPath($downloaded)).StartsWith($fullRuntime, [StringComparison]::OrdinalIgnoreCase)) { Fail "The downloaded Node at $downloaded is not under $runtime" }
Write-Host "The plugin host is ready with the Node Fuyu downloaded to $downloaded"
Stop-Fuyu
$env:PATH = $savedPath
foreach ($move in $moved) { Rename-Item -LiteralPath $move.To -NewName (Split-Path $move.From -Leaf) -ErrorAction SilentlyContinue }

$uninstaller = Join-Path $dir "uninstall.exe"
if (Test-Path $uninstaller) {
  $remove = Start-Process -FilePath $uninstaller -ArgumentList "/S" -Wait -PassThru
  if ($remove.ExitCode -ne 0) { Fail "The uninstaller exited with $($remove.ExitCode)" }
}
Write-Host "Smoke test passed."
