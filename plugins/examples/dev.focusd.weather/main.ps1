. "$PSScriptRoot\lib\fuyu.ps1"

[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
$Invariant = [Globalization.CultureInfo]::InvariantCulture
$Strings = [IO.File]::ReadAllText("$PSScriptRoot\ui\strings.json", (New-Object System.Text.UTF8Encoding $false)) | ConvertFrom-Json
$RainMm = 0.1
$RainQuietHours = 3
$GeoBase = 'https://geocoding-api.open-meteo.com'
$ForecastBase = 'https://api.open-meteo.com'
if ($env:FUYU_WEATHER_API) { $GeoBase = $env:FUYU_WEATHER_API; $ForecastBase = $env:FUYU_WEATHER_API }

$script:Settings = $null
$script:Locale = 'en'
$script:Cache = $null
$script:Problem = $null
$script:Visible = $false
$script:KeepAlive = $false

function Get-Text([string]$Key, [hashtable]$Values = @{}) {
    $text = [string]$Strings.text.($script:Locale).$Key
    foreach ($name in $Values.Keys) { $text = $text.Replace("{$name}", [string]$Values[$name]) }
    return $text
}

function Get-BothTexts([string]$Key) {
    return (New-FuyuText ([string]$Strings.text.'zh-CN'.$Key) ([string]$Strings.text.en.$Key))
}

function Get-Condition($Code, [int]$Index) {
    $entry = $Strings.codes.([string]$Code)
    if ($null -eq $entry) { return (Get-Text 'unknown') }
    return [string]@($entry.($script:Locale))[$Index]
}

function Get-Setting([string]$Key) {
    if ($null -eq $script:Settings) { return $null }
    return $script:Settings.$Key
}

function Get-City { return ([string](Get-Setting 'city')).Trim() }

function Get-Units {
    if ((Get-Setting 'units') -eq 'fahrenheit') { return 'fahrenheit' }
    return 'celsius'
}

function Format-Temp($Value) {
    if ($null -eq $Value) { return '-' }
    return ([string][math]::Round([double]$Value)) + [char]0x00B0
}

function Read-Locale {
    $saved = $null
    try { $saved = Get-FuyuStorage 'locale' } catch { }
    if ($saved -eq 'zh-CN' -or $saved -eq 'en') { $script:Locale = $saved; return }
    if ([Globalization.CultureInfo]::CurrentUICulture.Name -like 'zh*') { $script:Locale = 'zh-CN' }
}

function Invoke-Json([string]$Url) {
    $request = [Net.HttpWebRequest]::Create($Url)
    $request.Timeout = 15000
    $request.ReadWriteTimeout = 15000
    $request.UserAgent = 'Fuyu-Weather-Plugin/1.0'
    $response = $request.GetResponse()
    try {
        $reader = New-Object System.IO.StreamReader -ArgumentList $response.GetResponseStream(), ([Text.Encoding]::UTF8)
        return ($reader.ReadToEnd() | ConvertFrom-Json)
    } finally {
        $response.Close()
    }
}

function Find-Place([string]$City, [string]$Language) {
    $parts = $City -split '[,\uFF0C]', 2
    $name = $parts[0].Trim()
    $hint = $null
    if ($parts.Count -gt 1) { $hint = $parts[1].Trim().ToLowerInvariant() }
    $url = $GeoBase + '/v1/search?count=10&format=json&language=' + $Language + '&name=' + [Uri]::EscapeDataString($name)
    $results = @((Invoke-Json $url).results | Where-Object { $null -ne $_ })
    if ($results.Count -eq 0) { return $null }
    $match = $results[0]
    if ($hint) {
        foreach ($result in $results) {
            $fields = @($result.admin1, $result.admin2, $result.country, $result.country_code) | Where-Object { $_ }
            if (@($fields | Where-Object { ([string]$_).ToLowerInvariant().Contains($hint) }).Count -gt 0) { $match = $result; break }
        }
    }
    return @{
        name = [string]$match.name
        region = [string]$match.admin1
        country = [string]$match.country
        latitude = [double]$match.latitude
        longitude = [double]$match.longitude
    }
}

function Get-Place([string]$City) {
    $language = 'en'
    if ($script:Locale -eq 'zh-CN') { $language = 'zh' }
    $key = "$language|$City"
    $saved = $null
    try { $saved = Get-FuyuStorage 'place' } catch { }
    if ($null -ne $saved -and $saved.key -eq $key) { return $saved.place }
    $place = Find-Place $City $language
    if ($null -ne $place) { Set-FuyuStorage 'place' @{ key = $key; place = $place } }
    return $place
}

function Select-After($Times, [string]$From) {
    for ($i = 0; $i -lt $Times.Count; $i++) {
        if ([string]$Times[$i] -ge $From) { return $i }
    }
    return $Times.Count
}

function Get-Forecast($Place, [string]$Units) {
    $url = $ForecastBase + '/v1/forecast?timezone=auto&forecast_days=7&forecast_minutely_15=8' +
        '&latitude=' + $Place.latitude.ToString($Invariant) + '&longitude=' + $Place.longitude.ToString($Invariant) +
        '&temperature_unit=' + $Units + '&wind_speed_unit=kmh' +
        '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m,precipitation' +
        '&hourly=temperature_2m,precipitation_probability,weather_code,is_day' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
        '&minutely_15=precipitation'
    $raw = Invoke-Json $url
    $now = [string]$raw.current.time
    $hourStart = $now.Substring(0, 13) + ':00'
    $hourly = @()
    $first = Select-After $raw.hourly.time $hourStart
    for ($i = $first; $i -lt [math]::Min($first + 24, $raw.hourly.time.Count); $i++) {
        $hourly += , @{
            time = [string]$raw.hourly.time[$i]
            temp = $raw.hourly.temperature_2m[$i]
            pop = $raw.hourly.precipitation_probability[$i]
            code = $raw.hourly.weather_code[$i]
            day = [int]$raw.hourly.is_day[$i]
        }
    }
    $daily = @()
    for ($i = 0; $i -lt $raw.daily.time.Count; $i++) {
        $daily += , @{
            date = [string]$raw.daily.time[$i]
            code = $raw.daily.weather_code[$i]
            max = $raw.daily.temperature_2m_max[$i]
            min = $raw.daily.temperature_2m_min[$i]
            pop = $raw.daily.precipitation_probability_max[$i]
        }
    }
    $soon = @()
    $first = Select-After $raw.minutely_15.time $now
    for ($i = $first; $i -lt [math]::Min($first + 4, $raw.minutely_15.time.Count); $i++) {
        $soon += , @{ time = [string]$raw.minutely_15.time[$i]; mm = $raw.minutely_15.precipitation[$i] }
    }
    return @{
        now = $now
        current = @{
            temp = $raw.current.temperature_2m
            feels = $raw.current.apparent_temperature
            humidity = $raw.current.relative_humidity_2m
            wind = $raw.current.wind_speed_10m
            code = $raw.current.weather_code
            day = [int]$raw.current.is_day
            mm = $raw.current.precipitation
        }
        hourly = $hourly
        daily = $daily
        soon = $soon
    }
}

function Test-Fresh {
    if ($null -eq $script:Cache) { return $false }
    if ($script:Cache.city -ne (Get-City) -or $script:Cache.units -ne (Get-Units) -or $script:Cache.locale -ne $script:Locale) { return $false }
    $minutes = [int](Get-Setting 'refreshMinutes')
    if ($minutes -lt 30) { $minutes = 30 }
    if (Get-Setting 'rainAlert') { $minutes = 30 }
    $age = [DateTime]::UtcNow - [DateTime]::Parse([string]$script:Cache.fetchedAt, $Invariant, [Globalization.DateTimeStyles]::RoundtripKind)
    return $age.TotalMinutes -lt ($minutes - 1)
}

function Update-Weather([bool]$Force) {
    $city = Get-City
    if (-not $city) {
        $script:Problem = $null
        return
    }
    if (-not $Force -and (Test-Fresh)) { return }
    try {
        $place = Get-Place $city
        if ($null -eq $place) {
            $script:Problem = Get-Text 'noPlace' @{ city = $city }
            return
        }
        $forecast = Get-Forecast $place (Get-Units)
        $script:Cache = @{
            city = $city
            units = Get-Units
            locale = $script:Locale
            fetchedAt = [DateTime]::UtcNow.ToString('o')
            place = $place
            forecast = $forecast
        }
        $script:Problem = $null
        Set-FuyuStorage 'cache' $script:Cache
    } catch {
        $script:Problem = Get-Text 'offline' @{ error = $_.Exception.Message }
        Write-FuyuLog "refresh failed: $($_.Exception.Message)"
    }
}

function Get-PlaceName {
    if ($null -eq $script:Cache) { return '' }
    return [string]$script:Cache.place.name
}

function Test-CacheMatches {
    return ($null -ne $script:Cache -and $script:Cache.city -eq (Get-City) -and $script:Cache.units -eq (Get-Units))
}

function Show-Bar {
    if (-not (Get-Setting 'showOnBar') -or -not (Get-City) -or -not (Test-CacheMatches)) {
        Clear-FuyuStatus 'now'
        return
    }
    $current = $script:Cache.forecast.current
    $short = Get-Condition $current.code 0
    $temp = Format-Temp $current.temp
    $tooltip = Get-Text 'tooltip' @{ place = (Get-PlaceName); condition = (Get-Condition $current.code 1); temp = $temp; feels = (Format-Temp $current.feels) }
    if ($script:Problem) { $tooltip += "`n" + $script:Problem }
    Update-FuyuStatus 'now' "$short $temp" -Tooltip $tooltip -Cells @(@{ label = $short; value = $temp })
}

function Show-Info {
    $items = @()
    if (Test-CacheMatches) {
        $place = $script:Cache.place
        $where = (@($place.name, $place.region, $place.country) | Where-Object { $_ }) -join ', '
        $where += ' (' + ([double]$place.latitude).ToString('0.00', $Invariant) + ', ' + ([double]$place.longitude).ToString('0.00', $Invariant) + ')'
        $updated = [DateTime]::Parse([string]$script:Cache.fetchedAt, $Invariant, [Globalization.DateTimeStyles]::RoundtripKind).ToLocalTime().ToString('yyyy-MM-dd HH:mm')
        $items += , @{ label = (Get-BothTexts 'infoPlace'); value = $where }
        $items += , @{ label = (Get-BothTexts 'infoUpdated'); value = $updated }
    }
    $items += , @{ label = (Get-BothTexts 'infoSource'); value = 'Open-Meteo (open-meteo.com), CC BY 4.0' }
    [void](Invoke-FuyuMethod 'ui.setInfo' @{ items = $items })
}

function Send-Page {
    if (-not $script:Visible) { return }
    $message = @{ type = 'weather'; city = (Get-City); problem = $script:Problem; units = (Get-Units) }
    if ((Get-City) -and (Test-CacheMatches)) {
        $message.place = $script:Cache.place
        $message.fetchedAt = $script:Cache.fetchedAt
        $message.forecast = $script:Cache.forecast
    }
    [void](Send-FuyuWebviewMessage 'weather' $message)
}

function Test-Rain {
    if (-not (Get-Setting 'rainAlert') -or -not (Test-CacheMatches)) { return }
    $forecast = $script:Cache.forecast
    $quietUntil = $null
    try { $quietUntil = Get-FuyuStorage 'rainQuietUntil' } catch { }
    $nowUtc = [DateTime]::UtcNow
    if ([double]$forecast.current.mm -ge $RainMm) {
        Set-FuyuStorage 'rainQuietUntil' $nowUtc.AddHours(1).ToString('o')
        return
    }
    if ($quietUntil -and [DateTime]::Parse([string]$quietUntil, $Invariant, [Globalization.DateTimeStyles]::RoundtripKind) -gt $nowUtc) { return }
    $wet = @($forecast.soon | Where-Object { [double]$_.mm -ge $RainMm } | Select-Object -First 1)
    if ($wet.Count -eq 0) { return }
    $time = ([string]$wet[0].time).Substring(11, 5)
    Show-FuyuNotification (Get-Text 'rainTitle') (Get-Text 'rainBody' @{ place = (Get-PlaceName); time = $time }) -DurationMs 10000
    Set-FuyuStorage 'rainQuietUntil' $nowUtc.AddHours($RainQuietHours).ToString('o')
}

function Set-Running {
    $want = [bool]((Get-Setting 'showOnBar') -and (Get-City))
    if ($want -eq $script:KeepAlive) { return }
    if ($want) { Set-FuyuKeepAlive (Get-Text 'keepAlive') } else { Set-FuyuKeepAlive $null }
    $script:KeepAlive = $want
}

function Test-Wanted {
    return [bool]((Get-City) -and ($script:Visible -or (Get-Setting 'showOnBar') -or (Get-Setting 'rainAlert')))
}

function Invoke-Refresh([bool]$Force) {
    if ($Force -or (Test-Wanted)) { Update-Weather $Force }
    Show-Bar
    Send-Page
    Show-Info
    Test-Rain
    Set-Running
}

while ($true) {
    $message = Receive-FuyuNotification 60000
    try {
        if ($null -eq $message) {
            if ($script:KeepAlive -and -not (Test-Fresh)) { Invoke-Refresh $false }
            continue
        }
        switch ($message.method) {
            'initialize' {
                $script:Settings = $message.params.settings
                Read-Locale
                try { $script:Cache = Get-FuyuStorage 'cache' } catch { $script:Cache = $null }
                Invoke-Refresh $false
            }
            'settings.changed' {
                $script:Settings = $message.params.settings
                Invoke-Refresh $false
            }
            'view.visible' {
                $script:Visible = [bool]$message.params.visible
            }
            'webview.message' {
                $body = $message.params.message
                if ($body.type -eq 'ready') {
                    $script:Visible = $true
                    if (($body.locale -eq 'zh-CN' -or $body.locale -eq 'en') -and $body.locale -ne $script:Locale) {
                        $script:Locale = [string]$body.locale
                        Set-FuyuStorage 'locale' $script:Locale
                    }
                    Send-Page
                    Invoke-Refresh $false
                } elseif ($body.type -eq 'refresh') {
                    Invoke-Refresh $true
                }
            }
            'command' {
                if ($message.params.id -eq 'refresh') {
                    Invoke-Refresh $true
                    try { Open-FuyuView 'weather' } catch { }
                }
            }
            'shutdown' {
                exit 0
            }
        }
    } catch {
        Write-FuyuLog "error: $($_.Exception.Message)"
    }
}
