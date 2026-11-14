#requires -Version 5.1
param(
    [int]$ProcessId,
    [string]$ExecutablePath,
    [ValidateRange(1, 3600)][int]$IntervalSeconds = 60,
    [ValidateRange(0.01, 240)][double]$Hours = 8,
    [string]$Output
)

$ErrorActionPreference = 'Stop'
$repository = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

Add-Type -Namespace FuyuPerf -Name Native -MemberDefinition @'
[DllImport("kernel32.dll", SetLastError = true)]
public static extern IntPtr OpenProcess(uint access, bool inherit, uint processId);
[DllImport("kernel32.dll")]
public static extern bool CloseHandle(IntPtr handle);
[DllImport("user32.dll")]
public static extern uint GetGuiResources(IntPtr process, uint flags);
'@

function Get-GuiCount([uint32]$Id, [uint32]$Flag) {
    $handle = [FuyuPerf.Native]::OpenProcess(0x0400, $false, $Id)
    if ($handle -eq [IntPtr]::Zero) { return -1 }
    try { return [int][FuyuPerf.Native]::GetGuiResources($handle, $Flag) } finally { $null = [FuyuPerf.Native]::CloseHandle($handle) }
}

function Get-Kind($Process, [bool]$IsRoot) {
    if ($IsRoot) { return 'island' }
    $name = $Process.Name.ToLowerInvariant() -replace '\.exe$', ''
    if ($name -ne 'msedgewebview2') { return $name }
    $line = [string]$Process.CommandLine
    if ($line -notmatch '--type=([a-z-]+)') { return 'browser' }
    $type = $Matches[1]
    if ($type -eq 'utility' -and $line -match '--utility-sub-type=([A-Za-z_.]+)') {
        return 'utility:' + (($Matches[1] -split '\.')[0])
    }
    return $type
}

if (-not $ProcessId) {
    $candidates = @(Get-CimInstance Win32_Process -Filter "Name = 'fuyu.exe'")
    if ($ExecutablePath) {
        $wanted = (Resolve-Path -LiteralPath $ExecutablePath).Path
        $candidates = @($candidates | Where-Object { $_.ExecutablePath -eq $wanted })
    }
    if ($candidates.Count -ne 1) { throw "Found $($candidates.Count) fuyu.exe processes; pass -ProcessId or -ExecutablePath." }
    $ProcessId = [int]$candidates[0].ProcessId
}

$root = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId"
if (-not $root) { throw "Process $ProcessId is not running." }
if (-not $Output) {
    $directory = Join-Path $repository 'src-tauri\target\perf'
    $null = New-Item -ItemType Directory -Path $directory -Force
    $Output = Join-Path $directory ((Get-Date -Format 'yyyyMMdd-HHmmss') + "-pid$ProcessId.csv")
}
'time,elapsedSeconds,pid,kind,privateBytes,workingSetBytes,handles,gdi,user' | Set-Content -LiteralPath $Output -Encoding ascii
Write-Host "Sampling $($root.ExecutablePath) (pid $ProcessId) every $IntervalSeconds s for $Hours h -> $Output"

$started = Get-Date
$deadline = $started.AddHours($Hours)
while ((Get-Date) -lt $deadline) {
    $all = @(Get-CimInstance Win32_Process -Property ProcessId, ParentProcessId, Name, CommandLine, PrivatePageCount, WorkingSetSize, HandleCount)
    $byId = @{}
    $children = @{}
    foreach ($process in $all) {
        $byId[[int]$process.ProcessId] = $process
        $parent = [int]$process.ParentProcessId
        if (-not $children.ContainsKey($parent)) { $children[$parent] = [Collections.Generic.List[object]]::new() }
        $children[$parent].Add($process)
    }
    if (-not $byId.ContainsKey($ProcessId) -or $byId[$ProcessId].Name -ne $root.Name) {
        Write-Host 'The island exited; sampling stops.'
        break
    }
    $now = Get-Date
    $elapsed = [int]($now - $started).TotalSeconds
    $stamp = $now.ToString('s')
    $queue = [Collections.Generic.Queue[object]]::new()
    $queue.Enqueue($byId[$ProcessId])
    $seen = @{}
    $lines = [Collections.Generic.List[string]]::new()
    while ($queue.Count -gt 0) {
        $process = $queue.Dequeue()
        $id = [int]$process.ProcessId
        if ($seen.ContainsKey($id)) { continue }
        $seen[$id] = $true
        $kind = Get-Kind $process ($id -eq $ProcessId)
        $lines.Add("$stamp,$elapsed,$id,$kind,$($process.PrivatePageCount),$($process.WorkingSetSize),$($process.HandleCount),$(Get-GuiCount $id 0),$(Get-GuiCount $id 1)")
        if ($children.ContainsKey($id)) { foreach ($child in $children[$id]) { $queue.Enqueue($child) } }
    }
    Add-Content -LiteralPath $Output -Value $lines -Encoding ascii
    Start-Sleep -Seconds $IntervalSeconds
}
Write-Host "Done: $Output"
