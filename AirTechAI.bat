@echo off
title AIRTECH AI - AI-Powered Air Gesture Teaching Platform
chcp 65001 >nul

setlocal enabledelayedexpansion

:: ======================================================================
:: AIRTECH AI - OPTIMIZED STARTUP SCRIPT
:: Features: Timeout, Progress, Parallel Init, Offline Fallback, Logging
:: ======================================================================

set "APP_DIR=%~dp0"
set "LOG_FILE=%APP_DIR%startup.log"
set "START_TIME=%TIME%"
set "MAX_STARTUP_SEC=60"
set "BUILD_TIMEOUT=120"
set "ELECTRON_TIMEOUT=30"

cd /d "%APP_DIR%"

:: Initialize log
echo [BOOT] ============================================================ > "%LOG_FILE%"
echo [BOOT] AIRTECH AI STARTUP - %DATE% %TIME% >> "%LOG_FILE%"
echo [BOOT] Working directory: %APP_DIR% >> "%LOG_FILE%"
echo [BOOT] Max startup time: %MAX_STARTUP_SEC% seconds >> "%LOG_FILE%"
echo [BOOT] ============================================================ >> "%LOG_FILE%"

:: Function to log with timestamp
call :log "[BOOT] Starting AIRTECH AI..."

:: Check if dist exists (built app)
if exist "dist\index.html" (
    call :log "[BOOT] Built application found. Skipping build."
) else (
    call :log "[BOOT] First run detected. Building application (timeout: %BUILD_TIMEOUT%s)..."
    echo.
    echo [BUILD] Building application for first run...
    echo [BUILD] This may take 30-120 seconds. Please wait...
    echo.
    
    :: Run build with timeout
    timeout /t 3 /nobreak >nul
    call :runWithTimeout %BUILD_TIMEOUT% "npm run build" "BUILD"
    if !ERRORLEVEL! NEQ 0 (
        call :log "[BOOT] ERROR: Build failed or timed out after %BUILD_TIMEOUT% seconds"
        echo.
        echo [ERROR] Build failed. Trying fallback...
        echo [ERROR] Check startup.log for details.
        goto :fallback
    )
    call :log "[BOOT] Build completed successfully"
)

:: Start Electron with timeout and monitoring
call :log "[BOOT] Starting Electron (timeout: %ELECTRON_TIMEOUT%s)..."
echo.
echo [START] Launching AIRTECH AI Desktop...
echo [START] UI will appear within %ELECTRON_TIMEOUT% seconds.
echo.

:: Start Electron in background, capture PID
start "" /B cmd /c "npm run start > \"%LOG_FILE%.electron\" 2>&1"
set "ELECTRON_PID=%ERRORLEVEL%"

:: Monitor startup with progress
call :monitorStartup %MAX_STARTUP_SEC%

:: Check if Electron is running
tasklist /FI "IMAGENAME eq electron.exe" /FI "WINDOWTITLE eq AIRTECH AI*" 2>nul | find "electron.exe" >nul
if %ERRORLEVEL% EQU 0 (
    call :log "[BOOT] Electron started successfully"
    echo.
    echo [SUCCESS] AIRTECH AI is running!
    echo [SUCCESS] Startup completed in !ELAPSED! seconds.
    goto :end
)

:: Fallback: Open in browser
:fallback
call :log "[BOOT] Electron failed. Falling back to browser mode..."
echo.
echo [FALLBACK] Desktop app unavailable. Opening in browser...
start "" "dist\index.html"
call :log "[BOOT] Fallback: Opened dist/index.html in default browser"

:end
call :log "[BOOT] Startup script completed"
echo.
echo ============================================================
echo Startup log saved to: %LOG_FILE%
echo ============================================================
timeout /t 5 /nobreak >nul
exit /b 0

:: ======================================================================
:: HELPER FUNCTIONS
:: ======================================================================

:log
set "MSG=%~1"
echo %MSG%
echo %MSG% >> "%LOG_FILE%"
goto :eof

:runWithTimeout
set "TIMEOUT_SEC=%1"
set "CMD=%~2"
set "LABEL=%~3"

call :log "[%LABEL%] Running: %CMD% (timeout: %TIMEOUT_SEC%s)"

:: Use PowerShell for proper timeout handling
powershell -NoProfile -Command ^
    "$proc = Start-Process cmd -ArgumentList '/c %CMD%' -PassThru -WindowStyle Hidden; ^
     $proc.WaitForExit(%TIMEOUT_SEC% * 1000); ^
     if (-not \$proc.HasExited) { ^
         Stop-Process -Id \$proc.Id -Force; ^
         Write-Output 'TIMEOUT'; ^
         exit 1 ^
     } ^
     exit \$proc.ExitCode" 2>&1 | findstr /v "TIMEOUT" >nul

set "EXIT_CODE=%ERRORLEVEL%"
if %EXIT_CODE% EQU 1 (
    call :log "[%LABEL%] TIMEOUT after %TIMEOUT_SEC% seconds"
    exit /b 1
) else if %EXIT_CODE% NEQ 0 (
    call :log "[%LABEL%] FAILED with exit code %EXIT_CODE%"
    exit /b %EXIT_CODE%
)

call :log "[%LABEL%] Completed successfully"
exit /b 0

:monitorStartup
set "MAX_WAIT=%1"
set "ELAPSED=0"
set "DOTS="

call :log "[BOOT] Monitoring startup (max %MAX_WAIT%s)..."

:monitor_loop
timeout /t 1 /nobreak >nul
set /a "ELAPSED+=1"

:: Show progress
set "DOTS=!DOTS!."
if "!DOTS!"=="....." set "DOTS="
title AIRTECH AI - Starting... [!ELAPSED!/%MAX_WAIT%s] !DOTS!

:: Check if Electron window is visible
tasklist /FI "IMAGENAME eq electron.exe" 2>nul | find "electron.exe" >nul
if %ERRORLEVEL% EQU 0 (
    :: Check if window is created (not just process)
    powershell -NoProfile -Command ^
        "$ws = Get-Process electron -ErrorAction SilentlyContinue; ^
         if (\$ws) { \$ws | Where-Object { \$_.MainWindowTitle -like 'AIRTECH AI*' } }" 2>nul | find "electron" >nul
    if %ERRORLEVEL% EQU 0 (
        call :log "[BOOT] Electron window detected at %ELAPSED% seconds"
        goto :monitor_done
    )
)

if %ELAPSED% GEQ %MAX_WAIT% (
    call :log "[BOOT] STARTUP TIMEOUT after %MAX_WAIT% seconds"
    goto :monitor_done
)

goto :monitor_loop

:monitor_done
title AIRTECH AI - AI-Powered Air Gesture Teaching Platform
goto :eof