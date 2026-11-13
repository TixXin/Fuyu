@echo off
setlocal

set "PROVIDER=%~1"
if /I "%PROVIDER%"=="codex" (
  set "MARKER=agent-codex-running.flag"
  set "HOLD=agent-codex-running-hold.flag"
) else if /I "%PROVIDER%"=="claudeCode" (
  set "MARKER=agent-claudeCode-running.flag"
  set "HOLD=agent-claudeCode-running-hold.flag"
) else if /I "%PROVIDER%"=="workbuddy" (
  if /I not "%~2"=="notification" exit /b 2
) else (
  exit /b 2
)

set "STATUS_DIR=%~dp0"
set "STATUS_DIR=%STATUS_DIR:~0,-1%"
if defined FOCUSD_AGENT_STATUS_DIR set "STATUS_DIR=%FOCUSD_AGENT_STATUS_DIR%"

if not exist "%STATUS_DIR%" mkdir "%STATUS_DIR%" >nul 2>nul

if /I "%~2"=="notification" goto notification
if /I "%~2"=="session" goto session

break > "%STATUS_DIR%\%MARKER%"
del "%STATUS_DIR%\%HOLD%" >nul 2>nul

exit /b 0

:notification
set "SAVED_DIR=%STATUS_DIR%\agent-notifications"
if not exist "%SAVED_DIR%" mkdir "%SAVED_DIR%" >nul 2>nul
set "STAMP=%DATE%%TIME%"
set "STAMP=%STAMP:/=%"
set "STAMP=%STAMP::=%"
set "STAMP=%STAMP:.=%"
set "STAMP=%STAMP:,=%"
set "STAMP=%STAMP: =%"
set "SAVED=%SAVED_DIR%\%PROVIDER%-%STAMP%-%RANDOM%"
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
