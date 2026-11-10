@{
    RootModule = 'Fuyu.Plugin.psm1'
    ModuleVersion = '0.1.0'
    GUID = '6180e14e-88a5-4497-8ed0-4bbbb5c4954d'
    Author = 'TixXin'
    CompanyName = 'TixXin'
    Copyright = '(c) 2026 flyl1u and contributors. MIT License.'
    Description = 'Helpers for Fuyu plugins written in Windows PowerShell 5.1: JSON-RPC over stdio, events, island messages, views, status texts, storage and secrets.'
    PowerShellVersion = '5.1'
    CompatiblePSEditions = @('Desktop', 'Core')
    FunctionsToExport = @(
        'Send-FuyuMessage', 'Write-FuyuLog', 'Read-FuyuLine', 'Invoke-FuyuMethod',
        'Receive-FuyuNotification', 'Invoke-FuyuLoop', 'New-FuyuText', 'ConvertFrom-FuyuEscape',
        'Register-FuyuEvent', 'Unregister-FuyuEvent', 'Show-FuyuNotification',
        'Update-FuyuView', 'Update-FuyuViewItems', 'Send-FuyuWebviewMessage', 'Update-FuyuStatus', 'Clear-FuyuStatus',
        'Get-FuyuStorage', 'Set-FuyuStorage', 'Remove-FuyuStorage',
        'Get-FuyuSecret', 'Set-FuyuSecret', 'Remove-FuyuSecret', 'Set-FuyuKeepAlive', 'Request-FuyuPermission', 'Open-FuyuView', 'Set-FuyuSetting'
    )
    CmdletsToExport = @()
    VariablesToExport = @()
    # The function names before the rename (D17).
    AliasesToExport = @(
        'Send-FocusdMessage', 'Write-FocusdLog', 'Read-FocusdLine', 'Invoke-FocusdMethod',
        'Receive-FocusdNotification', 'Invoke-FocusdLoop', 'New-FocusdText', 'ConvertFrom-FocusdEscape',
        'Register-FocusdEvent', 'Unregister-FocusdEvent', 'Show-FocusdNotification',
        'Update-FocusdView', 'Update-FocusdViewItems', 'Send-FocusdWebviewMessage', 'Update-FocusdStatus', 'Clear-FocusdStatus',
        'Get-FocusdStorage', 'Set-FocusdStorage', 'Remove-FocusdStorage',
        'Get-FocusdSecret', 'Set-FocusdSecret', 'Remove-FocusdSecret', 'Set-FocusdKeepAlive', 'Request-FocusdPermission', 'Open-FocusdView', 'Set-FocusdSetting'
    )
    PrivateData = @{
        PSData = @{
            Tags = @('Fuyu', 'plugin', 'Windows')
            LicenseUri = 'https://github.com/TixXin/fly-island/blob/main/packages/powershell/LICENSE'
            ProjectUri = 'https://github.com/TixXin/fly-island/tree/main/packages/powershell/Fuyu.Plugin'
        }
    }
}
