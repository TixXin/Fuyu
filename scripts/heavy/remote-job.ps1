$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$OutputEncoding = [Text.Encoding]::UTF8
$root = $p.root
$main = Join-Path $root "repo"
$locks = Join-Path $root "locks"
$out = Join-Path $root "out"
$job = if ($p.id) { Join-Path $out $p.id } else { $null }
New-Item -ItemType Directory -Force -Path $root, $locks, $out, (Join-Path $root "wt") | Out-Null

function Get-JobPid {
  $owner = Get-Content -Path "$job.pid" -ErrorAction SilentlyContinue
  if ($owner) { return [int]$owner }
  return $null
}

if ($p.step -eq "follow") {
  $offset = [long]$p.offset
  $stdout = [Console]::OpenStandardOutput()
  $buffer = New-Object byte[] 65536
  $since = Get-Date
  while ($true) {
    $done = Test-Path "$job.exit"
    if (Test-Path "$job.log") {
      $stream = [IO.File]::Open("$job.log", [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete)
      try {
        [void]$stream.Seek($offset, [IO.SeekOrigin]::Begin)
        while (($read = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
          $stdout.Write($buffer, 0, $read)
          $stdout.Flush()
          $offset += $read
        }
      } finally { $stream.Dispose() }
    }
    if ($done) { exit 0 }
    $owner = Get-JobPid
    $gone = if ($owner) { -not (Get-Process -Id $owner -ErrorAction SilentlyContinue) } else { ((Get-Date) - $since).TotalSeconds -gt 60 }
    if ($gone -and -not (Test-Path "$job.exit")) { exit 3 }
    Start-Sleep -Milliseconds 400
  }
}

if ($p.step -eq "status") {
  $owner = Get-JobPid
  $code = Get-Content -Path "$job.exit" -ErrorAction SilentlyContinue
  [pscustomobject]@{
    done = $null -ne $code
    code = if ($null -ne $code) { [int]$code } else { $null }
    started = $null -ne $owner
    alive = [bool]($owner -and (Get-Process -Id $owner -ErrorAction SilentlyContinue))
  } | ConvertTo-Json -Compress
  exit 0
}

if ($p.step -eq "cancel") {
  $owner = Get-JobPid
  if ($owner) {
    & taskkill /PID $owner /T /F 2>&1 | Out-Null
    Get-ChildItem -Path $locks -Directory | Where-Object { (Get-Content -Path (Join-Path $_.FullName "pid") -ErrorAction SilentlyContinue) -eq "$owner" } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
  }
  if (-not (Test-Path "$job.exit")) { Set-Content -Path "$job.exit" -Value 130 }
  exit 0
}

if ($p.step -eq "start") {
  Set-Content -Path "$job.path" -Value $env:Path
  $pwsh = (Get-Command pwsh).Source
  $line = "cmd /d /c `"`"$pwsh`" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$job.ps1`" > `"$job.log`" 2>&1`""
  $made = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $line; CurrentDirectory = $root }
  if ($made.ReturnValue -ne 0) { throw "Win32_Process.Create returned $($made.ReturnValue)" }
  exit 0
}

if ($p.step -eq "run") {
  Set-Content -Path "$job.pid" -Value $PID
  $savedPath = Get-Content -Path "$job.path" -ErrorAction SilentlyContinue
  if ($savedPath) { $env:Path = $savedPath }
}

function Invoke-Git {
  & git @args
  if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') failed ($LASTEXITCODE)" }
}

if (-not (Test-Path (Join-Path $main ".git"))) {
  Write-Host "[heavy:remote] first run: cloning $($p.origin) into $main"
  Invoke-Git clone --quiet --no-checkout $p.origin $main
}
$exclude = Join-Path $main ".git\info\exclude"
New-Item -ItemType Directory -Force -Path (Split-Path $exclude) | Out-Null
if (-not (Select-String -Path $exclude -SimpleMatch -Pattern "src-tauri/target" -Quiet -ErrorAction SilentlyContinue)) {
  Add-Content -Path $exclude -Value "src-tauri/target"
}
if ($p.step -eq "prepare") { exit 0 }

$slot = $null
$noted = $false
while (-not $slot) {
  foreach ($n in 1..$p.worktrees) {
    $lock = Join-Path $locks "wt-$n"
    try {
      New-Item -ItemType Directory -Path $lock -ErrorAction Stop | Out-Null
      Set-Content -Path (Join-Path $lock "pid") -Value $PID
      $slot = $n
      break
    } catch {
      $owner = Get-Content -Path (Join-Path $lock "pid") -ErrorAction SilentlyContinue
      if ($owner -and -not (Get-Process -Id $owner -ErrorAction SilentlyContinue)) {
        Remove-Item -Recurse -Force -Path $lock -ErrorAction SilentlyContinue
      }
    }
  }
  if (-not $slot) {
    if (-not $noted) { Write-Host "[heavy:remote] all $($p.worktrees) remote checkouts are busy; waiting"; $noted = $true }
    Start-Sleep -Seconds 3
  }
}

$code = 1
try {
  $wt = Join-Path (Join-Path $root "wt") $slot
  Remove-Item -Force -Path (Join-Path $main ".git\worktrees\$slot\index.lock") -ErrorAction SilentlyContinue
  if (-not (Test-Path (Join-Path $wt ".git"))) {
    Invoke-Git -C $main worktree prune
    Invoke-Git -C $main worktree add --quiet --detach $wt $p.sha
  }
  Invoke-Git -C $wt checkout --quiet --force --detach $p.sha
  Invoke-Git -C $wt clean -fdq
  $marker = Join-Path $root "wt\$slot.lockhash"
  $lockHash = (Get-FileHash -Path (Join-Path $wt "pnpm-lock.yaml")).Hash
  if ((Get-Content -Path $marker -ErrorAction SilentlyContinue) -ne $lockHash -or -not (Test-Path (Join-Path $wt "node_modules"))) {
    Write-Host "[heavy:remote] installing dependencies in checkout $slot"
    Push-Location $wt
    try { & pnpm install --frozen-lockfile --prefer-offline --reporter=silent } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { throw "pnpm install failed ($LASTEXITCODE)" }
    Set-Content -Path $marker -Value $lockHash
  }
  $sharedTarget = Join-Path $main "src-tauri\target"
  $target = Join-Path $wt "src-tauri\target"
  New-Item -ItemType Directory -Force -Path $sharedTarget | Out-Null
  if (-not (Test-Path $target)) { New-Item -ItemType Junction -Path $target -Target $sharedTarget | Out-Null }
  foreach ($name in $p.env.PSObject.Properties.Name) { Set-Item -Path "Env:$name" -Value $p.env.$name }
  $env:FUYU_HEAVY_REMOTE = "off"
  Write-Host "[heavy:remote] $env:COMPUTERNAME checkout $slot at $($p.sha.Substring(0, 9)): $($p.argv -join ' ')"
  $at = if ($p.subdir) { Join-Path $wt $p.subdir } else { $wt }
  Push-Location $at
  try {
    & node (Join-Path $wt "scripts\heavy\heavy.mjs") @($p.argv)
    $code = $LASTEXITCODE
  } finally { Pop-Location }
  & git -C $wt add -A 2>$null
  $patch = Join-Path $out "$($p.id).patch"
  & git -C $wt diff --cached --binary "--output=$patch" $p.sha
  & git -C $wt reset --quiet 2>$null
} catch {
  Write-Host "[heavy:remote] $($_.Exception.Message)"
  $code = 1
} finally {
  Remove-Item -Recurse -Force -Path (Join-Path $locks "wt-$slot") -ErrorAction SilentlyContinue
  $old = & git -C $main for-each-ref --sort=-committerdate --format="%(refname)" refs/fuyu-jobs/ | Select-Object -Skip 40
  foreach ($ref in $old) { & git -C $main update-ref -d $ref }
  Get-ChildItem -Path $out -File | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-1) } | Remove-Item -Force -ErrorAction SilentlyContinue
  Set-Content -Path "$job.exit" -Value $code
}
exit $code
