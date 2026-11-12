$ErrorActionPreference = 'Stop'
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
    $request = [System.Net.HttpWebRequest]::Create("http://127.0.0.1:$port/codex/permission-request")
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
