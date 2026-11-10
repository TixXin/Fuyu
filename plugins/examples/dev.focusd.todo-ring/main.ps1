# Example plugin (API version 2): a webview page (the plugin's own HTML in
# ui/) with a ring showing how many of today's todos are done, and the same
# progress as a small ring on the collapsed bar. The page cannot read todos or
# go online; it asks this process, which reads them with the todos:read
# permission and sends the counts back. The page gets them when it says it is
# ready and whenever todos change while it is open; the bar follows every change.
. "$PSScriptRoot\lib\focusd.ps1"

$script:Visible = $false
# How many of the todos still to do the page lists by title.
$NextShown = 3

function Read-Progress {
    $todos = @((Invoke-FocusdMethod 'todos.list').todos)
    $pending = @($todos | Where-Object { -not $_.completed })
    $next = @($pending | Select-Object -First $NextShown | ForEach-Object { [string]$_.title })
    return @{ type = 'counts'; done = $todos.Count - $pending.Count; total = $todos.Count; next = $next }
}

# The bar item: a ring and "done/total"; nothing on a day without todos.
function Show-Bar($Progress) {
    $params = @{ itemId = 'progress'; text = '' }
    if ($Progress.total -gt 0) {
        $params.text = "$($Progress.done)/$($Progress.total)"
        $params.ring = [double]$Progress.done / $Progress.total
        $params.tone = 'accent'
    }
    [void](Invoke-FocusdMethod 'status.update' $params)
}

function Send-Progress([bool]$ToPage) {
    $progress = Read-Progress
    Show-Bar $progress
    if ($ToPage) { [void](Send-FocusdWebviewMessage 'ring' $progress) }
}

while ($true) {
    $message = Receive-FocusdNotification 60000
    if ($null -eq $message) {
        continue
    }
    try {
        switch ($message.method) {
            'initialize' {
                if (-not (@($message.params.capabilities) -contains 'webview')) {
                    Write-FocusdLog 'this FocuSD Island is too old for this plugin (needs webview pages)'
                }
                [void](Invoke-FocusdMethod 'events.subscribe' @{ events = @('todos.changed') })
                Send-Progress $false
            }
            'view.visible' {
                $script:Visible = [bool]$message.params.visible
            }
            'webview.message' {
                # The page sends { type: "ready" } when it loads and { type: "refresh" } from its button.
                if (@('ready', 'refresh') -contains $message.params.message.type) { Send-Progress $true }
            }
            'event' {
                if ($message.params.name -eq 'todos.changed') { Send-Progress $script:Visible }
            }
            'shutdown' {
                exit 0
            }
        }
    } catch {
        # Keep running: one failed call should not make the island restart the plugin.
        Write-FocusdLog "error: $($_.Exception.Message)"
    }
}
