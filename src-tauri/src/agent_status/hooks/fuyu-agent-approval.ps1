$ErrorActionPreference = 'Stop'
$routes = @{
    codex = 'codex/permission-request'
    workbuddy = 'workbuddy/permission-request'
    qoder = 'qoder/permission-request'
    zcode = 'zcode/permission-request'
    codebuddy = 'codebuddy/permission-request'
    qwen = 'qwen/permission-request'
    copilot = 'copilot/permission-request'
    trae = 'trae/pre-tool-use'
    traeCn = 'traeCn/pre-tool-use'
    antigravity = 'antigravity/pre-tool-use'
    droid = 'droid/pre-tool-use'
    dsh = 'dsh/pre-tool-use'
    cursor = 'cursor/permission'
}
$agent = if ($args.Count -gt 0) { [string]$args[0] } else { 'codex' }
$route = $routes[$agent]
if ($agent -eq 'claudeCode') {
    if ($env:CURSOR_VERSION) { exit 0 }
    $mode = if ($args.Count -gt 1) { [string]$args[1] } else { '' }
    $route = switch ($mode) { 'question' { 'claude/ask-user-question' } 'activity' { 'claude/activity' } default { 'claude/permission-request' } }
}
if (-not $route) { exit 0 }
function Write-CursorAsk {
  if ($agent -ne 'cursor') { return }
  $encoding = New-Object System.Text.UTF8Encoding($false)
  $output = [Console]::OpenStandardOutput()
  $payload = $encoding.GetBytes('{"permission":"ask"}')
  $output.Write($payload, 0, $payload.Length)
  $output.Flush()
}
function Send-Approval($config, $body, $utf8) {
    $port = [int]$config.port
    $probe = New-Object System.Net.Sockets.TcpClient
    try {
        $connected = $probe.ConnectAsync('127.0.0.1', $port).Wait(300)
    } catch {
        $connected = $false
    }
    $probe.Close()
    if (-not $connected) { return $null }

    [System.Net.ServicePointManager]::Expect100Continue = $false
    $request = [System.Net.HttpWebRequest]::Create("http://127.0.0.1:$port/$route")
    $request.Method = 'POST'
    $request.Proxy = $null
    $request.ContentType = 'application/json'
    $request.Headers.Add('Authorization', "Bearer $($config.token)")
    $request.Timeout = 140000
    $request.ReadWriteTimeout = 140000
    $bytes = $utf8.GetBytes($body)
    $request.ContentLength = $bytes.Length
    $stream = $request.GetRequestStream()
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Close()

    try {
        $response = $request.GetResponse()
    } catch [System.Net.WebException] {
        if ($_.Exception.Status -eq [System.Net.WebExceptionStatus]::ProtocolError) { return $null }
        throw
    }
    $answer = (New-Object System.IO.StreamReader($response.GetResponseStream(), $utf8)).ReadToEnd().Trim()
    $response.Close()
    return [string]$answer
}
try {
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    $body = (New-Object System.IO.StreamReader([Console]::OpenStandardInput(), $utf8)).ReadToEnd()
    $files = @(Join-Path $PSScriptRoot 'agent-approval.json') + @(Get-ChildItem -LiteralPath $PSScriptRoot -Filter 'agent-approval.lane-*.json' -File -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })
    foreach ($file in $files) {
        if (-not (Test-Path -LiteralPath $file)) { continue }
        try {
            $config = Get-Content -Raw -Encoding UTF8 -LiteralPath $file | ConvertFrom-Json
        } catch {
            continue
        }
        if (-not $config.port -or -not $config.token) { continue }
        $answer = Send-Approval $config $body $utf8
        if ($null -eq $answer) { continue }
        if ($answer -and $answer -ne '{}') {
            $out = [Console]::OpenStandardOutput()
            $data = $utf8.GetBytes($answer)
            $out.Write($data, 0, $data.Length)
            $out.Flush()
            exit 0
        }
        break
    }
    Write-CursorAsk
} catch {
    Write-CursorAsk
}
exit 0
