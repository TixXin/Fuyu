param(
  [string] $Video = "",
  [Parameter(Mandatory)] [double[]] $Times,
  [string] $Tag = "zh",
  [string] $From = "",
  [int] $Columns = 3,
  [int] $Width = 0,
  [string] $Out = ""
)

$ErrorActionPreference = "Stop"
$videoDir = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..\video")).Path
$tmp = Join-Path $videoDir ".tmp"
New-Item -ItemType Directory -Force $tmp | Out-Null

$cells = @()
if ($From) {
  $source = (Resolve-Path $From).Path
  $index = 0
  foreach ($time in $Times) {
    $cell = Join-Path $tmp ("sheet-cell-{0}.png" -f $index)
    ffmpeg -y -loglevel error -ss $time -i $source -frames:v 1 $cell
    $cells += $cell
    $index++
  }
  $name = [IO.Path]::GetFileNameWithoutExtension($source)
} else {
  if (-not $Video) { throw "give -Video <id> for stills, or -From <mp4>" }
  foreach ($time in $Times) {
    $cells += Join-Path $videoDir ("out\{0}\still-{1}-{2:000.00}.png" -f $Video, $Tag, $time)
  }
  $name = "$Video-$Tag"
}

$missing = @($cells | Where-Object { -not (Test-Path $_) })
if ($missing.Count -gt 0) { throw "missing: $($missing -join ', ')" }

$size = (ffprobe -v error -select_streams v -show_entries stream=width,height -of csv=p=0 $cells[0]) -split ","
$sourceWidth = [int]$size[0]
$sourceHeight = [int]$size[1]
$cellWidth = if ($Width -gt 0) { $Width } elseif ($sourceHeight -gt $sourceWidth) { 406 } else { 854 }
$cellHeight = [int]([math]::Round($cellWidth * $sourceHeight / $sourceWidth / 2) * 2)
if (-not $Out) { $Out = Join-Path $tmp "sheet-$name.png" }

$count = $cells.Count
$inputs = @()
foreach ($cell in $cells) { $inputs += "-i"; $inputs += $cell }
if ($count -eq 1) {
  ffmpeg -y -loglevel error @inputs -vf "scale=${cellWidth}:${cellHeight}" $Out
} else {
  $scaled = (0..($count - 1) | ForEach-Object { "[$($_):v]scale=${cellWidth}:${cellHeight}[s$_]" }) -join ";"
  $refs = (0..($count - 1) | ForEach-Object { "[s$_]" }) -join ""
  $layout = (0..($count - 1) | ForEach-Object { "$(($_ % $Columns) * $cellWidth)_$([math]::Floor($_ / $Columns) * $cellHeight)" }) -join "|"
  ffmpeg -y -loglevel error @inputs -filter_complex "$scaled;${refs}xstack=inputs=${count}:layout=${layout}:fill=black" $Out
}
Write-Output $Out
