$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$OutputEncoding = [Text.Encoding]::UTF8
$root = $p.root
$main = Join-Path $root "repo"
$locks = Join-Path $root "locks"
$out = Join-Path $root "out"
New-Item -ItemType Directory -Force -Path $root, $locks, $out, (Join-Path $root "wt") | Out-Null

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
  Get-ChildItem -Path $out -Filter *.patch | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-1) } | Remove-Item -Force -ErrorAction SilentlyContinue
}
exit $code
