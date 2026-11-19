@echo off
setlocal

set "PROVIDER=%~1"
if /I "%PROVIDER%"=="codex" goto known
if /I "%PROVIDER%"=="claudeCode" goto known
if /I "%PROVIDER%"=="workbuddy" goto known
if /I "%PROVIDER%"=="dsh" goto known
if /I "%PROVIDER%"=="qoder" goto known
if /I "%PROVIDER%"=="zcode" goto known
if /I "%PROVIDER%"=="kimiCode" goto known
if /I "%PROVIDER%"=="grok" goto known
if /I "%PROVIDER%"=="copilot" goto known
if /I "%PROVIDER%"=="droid" goto known
if /I "%PROVIDER%"=="pi" goto known
if /I "%PROVIDER%"=="cursor" goto known
if /I "%PROVIDER%"=="codebuddy" goto known
if /I "%PROVIDER%"=="qwen" goto known
if /I "%PROVIDER%"=="antigravity" (
  if /I not "%~2"=="start" if /I not "%~2"=="running" if /I not "%~2"=="stop" exit /b 1
  goto known
)
if /I "%PROVIDER%"=="trae" goto trae
if /I "%PROVIDER%"=="traeCn" goto trae
if /I "%PROVIDER%"=="" exit /b 1
if /I "%PROVIDER%"=="updatedAt" exit /b 1
if /I "%PROVIDER%"=="statusPath" exit /b 1
if /I "%PROVIDER%"=="others" exit /b 1
echo(%PROVIDER%| findstr /R "^[A-Za-z][A-Za-z0-9_-]*$" >nul
if errorlevel 1 exit /b 1
goto known

:trae
if /I not "%~2"=="running" if /I not "%~2"=="stop" if /I not "%~2"=="notification" exit /b 1
goto known

:known
if /I "%PROVIDER%"=="claudeCode" if defined CURSOR_VERSION exit /b 0
if /I "%~2"=="activity" goto activity
set "MARKER=agent-%PROVIDER%-running.flag"
set "HOLD=agent-%PROVIDER%-running-hold.flag"

set "STATUS_DIR=%~dp0"
set "STATUS_DIR=%STATUS_DIR:~0,-1%"
if defined FOCUSD_AGENT_STATUS_DIR set "STATUS_DIR=%FOCUSD_AGENT_STATUS_DIR%"

if not exist "%STATUS_DIR%" mkdir "%STATUS_DIR%" >nul 2>nul

set "SAVED_DIR=%STATUS_DIR%\agent-notifications"
set "SAVED_NAME=%PROVIDER%"
if /I "%PROVIDER%"=="antigravity" (
  set "SAVED_DIR=%STATUS_DIR%\agent-antigravity"
  set "SAVED_NAME=%~2"
  if /I "%~2"=="start" set "SAVED_NAME=running"
  if /I "%~2"=="running" (
    break > "%STATUS_DIR%\%MARKER%"
    del "%STATUS_DIR%\%HOLD%" >nul 2>nul
  )
  goto notification
)
if /I "%~2"=="notification" goto notification
set "IS_TRAE="
if /I "%PROVIDER%"=="trae" set "IS_TRAE=1"
if /I "%PROVIDER%"=="traeCn" set "IS_TRAE=1"
if defined IS_TRAE (
  set "SAVED_DIR=%STATUS_DIR%\agent-%PROVIDER%"
  set "SAVED_NAME=%~2"
  if /I "%~2"=="running" (
    break > "%STATUS_DIR%\%MARKER%"
    del "%STATUS_DIR%\%HOLD%" >nul 2>nul
  )
  goto notification
)
if /I "%~2"=="session" goto session

break > "%STATUS_DIR%\%MARKER%"
del "%STATUS_DIR%\%HOLD%" >nul 2>nul

exit /b 0

:notification
if not exist "%SAVED_DIR%" mkdir "%SAVED_DIR%" >nul 2>nul
set "STAMP=%DATE%%TIME%"
set "STAMP=%STAMP:/=%"
set "STAMP=%STAMP::=%"
set "STAMP=%STAMP:.=%"
set "STAMP=%STAMP:,=%"
set "STAMP=%STAMP: =%"
set "SAVED=%SAVED_DIR%\%SAVED_NAME%-%STAMP%-%RANDOM%"
findstr "^" > "%SAVED%.tmp" 2>nul
move /y "%SAVED%.tmp" "%SAVED%.json" >nul 2>nul
exit /b 0

:session
if not defined ORCA_TERMINAL_HANDLE exit /b 0
set "TERMINALS_DIR=%STATUS_DIR%\agent-terminals"
if not exist "%TERMINALS_DIR%" mkdir "%TERMINALS_DIR%" >nul 2>nul
findstr "^" > "%TERMINALS_DIR%\%ORCA_TERMINAL_HANDLE%.tmp" 2>nul
move /y "%TERMINALS_DIR%\%ORCA_TERMINAL_HANDLE%.tmp" "%TERMINALS_DIR%\%ORCA_TERMINAL_HANDLE%.json" >nul 2>nul
exit /b 0

:activity
curl.exe -s -o NUL --connect-timeout 1 -m 5 -H "Authorization: Bearer %~4" -H "Content-Type: application/json" -H "X-Fuyu-Hook: fuyu-agent-activity" --data-binary @- "%~3" >nul 2>nul
exit /b 0
