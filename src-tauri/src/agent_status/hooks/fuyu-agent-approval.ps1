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
    dsh = 'dsh/pre-tool-use'
}
$agent = if ($args.Count -gt 0) { [string]$args[0] } else { 'codex' }
$route = $routes[$agent]
if (-not $route) { exit 0 }
try {
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    $body = (New-Object System.IO.StreamReader([Console]::OpenStandardInput(), $utf8)).ReadToEnd()
    $config = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot 'agent-approval.json') | ConvertFrom-Json
    $port = [int]$config.port

    $probe = New-Object System.Net.Sockets.TcpClient
    $connected = $probe.ConnectAsync('127.0.0.1', $port).Wait(300)
    $probe.Close()
    if (-not $connected) { exit 0 }

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

    $response = $request.GetResponse()
    $answer = (New-Object System.IO.StreamReader($response.GetResponseStream(), $utf8)).ReadToEnd().Trim()
    $response.Close()
    if ($answer -and $answer -ne '{}') {
        $out = [Console]::OpenStandardOutput()
        $data = $utf8.GetBytes($answer)
        $out.Write($data, 0, $data.Length)
        $out.Flush()
    }
} catch {
}
exit 0
