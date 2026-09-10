@echo off
title AIRTECH AI - AI-Powered Air Gesture Teaching Platform
chcp 65001 >nul

setlocal enabledelayedexpansion

:: ======================================================================
:: AIRTECH AI - OPTIMIZED STARTUP SCRIPT
:: Features:
::   - Build with timeout
::   - Dev server port polling (Test-NetConnection)
::   - Electron window detection
::   - Proper logging to startup.log
::   - Fallback to browser mode
:: ======================================================================

set "APP_DIR=%~dp0"
set "LOG_FILE=%APP_DIR%startup.log"
set "MAX_STARTUP_SEC=90"
set "BUILD_TIMEOUT=180"
set "PORT_POLL_TIMEOUT=60"
set "DEV_SERVER_PORT=1420"

cd /d "%APP_DIR%"

:: Initialize log
echo [BOOT] ============================================================ > "%LOG_FILE%"
echo [BOOT] AIRTECH AI STARTUP - %DATE% %TIME% >> "%LOG_FILE%"
echo [BOOT] Working directory: %APP_DIR% >> "%LOG_FILE%"
echo [BOOT] Max startup time: %MAX_STARTUP_SEC% seconds >> "%LOG_FILE%"
echo [BOOT] ============================================================ >> "%LOG_FILE%"

call :log "[BOOT] Starting AIRTECH AI..."

:: Check if dist exists (built app)
if exist "dist\index.html" (
    call :log "[BOOT] Built application found. Skipping build."
) else (
    call :log "[BOOT] First run detected. Building application (timeout: %BUILD_TIMEOUT%s)..."
    echo.
    echo [BUILD] Building application for first run...
    echo [BUILD] This may take 60-180 seconds. Please wait...
    echo.
    
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

:: Start Electron in a new window (proper stdin handling)
call :log "[BOOT] Starting Electron with dev server on port %DEV_SERVER_PORT%..."
echo.
echo [START] Launching AIRTECH AI Desktop...
echo [START] Waiting for dev server to be ready (max %PORT_POLL_TIMEOUT%s)...
echo.

:: Use start with explicit title to launch in new console window
:: This ensures proper stdin/TTY for Electron/Vite
start "AIRTECH AI Electron" cmd /c "npx electron ."

:: Give Electron time to start Vite dev server
timeout /t 5 /nobreak >nul

:: Poll for dev server readiness on port
call :log "[BOOT] Polling dev server at http://localhost:%DEV_SERVER_PORT%..."
call :waitForPort %DEV_SERVER_PORT% %PORT_POLL_TIMEOUT%
if !ERRORLEVEL! NEQ 0 (
    call :log "[BOOT] ERROR: Dev server did not respond on port %DEV_SERVER_PORT% within %PORT_POLL_TIMEOUT% seconds"
    echo.
    echo [ERROR] Dev server failed to start. Check startup.log for details.
    goto :fallback
)

call :log "[BOOT] Dev server is responding on port %DEV_SERVER_PORT%"

:: Wait for Electron window to be fully ready
call :log "[BOOT] Waiting for Electron window to be ready..."
timeout /t 3 /nobreak >nul

:: Monitor Electron window creation
call :monitorElectronWindow %MAX_STARTUP_SEC%

:: Final check - is Electron running with our app title?
tasklist /FI "IMAGENAME eq electron.exe" /FI "WINDOWTITLE eq AIRTECH AI*" 2>nul | find "electron.exe" >nul
if %ERRORLEVEL% EQU 0 (
    call :log "[BOOT] Electron started successfully"
    echo.
    echo [SUCCESS] AIRTECH AI is running!
    echo [SUCCESS] Startup completed in !ELAPSED! seconds.
    echo [SUCCESS] Dashboard is ready at http://localhost:%DEV_SERVER_PORT%
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
     if (-not $proc.HasExited) { ^
         Stop-Process -Id $proc.Id -Force; ^
         Write-Output 'TIMEOUT'; ^
         exit 1 ^
     } ^
     exit $proc.ExitCode" 2>&1 | findstr /v "TIMEOUT" >nul

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

:waitForPort
set "PORT=%1"
set "MAX_WAIT=%2"
set "ELAPSED=0"
set "DOTS="

call :log "[PORT] Waiting for port %PORT% to be ready (max %MAX_WAIT%s)..."

:port_loop
timeout /t 1 /nobreak >nul
set /a "ELAPSED+=1"

:: Show progress
set "DOTS=!DOTS!."
if "!DOTS!"=="....." set "DOTS="
title AIRTECH AI - Waiting for dev server... [!ELAPSED!/%MAX_WAIT%s] !DOTS!

:: Test-NetConnection with explicit boolean exit code
powershell -NoProfile -Command "if ((Test-NetConnection -ComputerName localhost -Port %PORT% -InformationLevel Quiet)) { exit 0 } else { exit 1 }" 2>nul

if %ERRORLEVEL% EQU 0 (
    call :log "[PORT] Port %PORT% is now accepting connections at %ELAPSED% seconds"
    goto :port_done
)

if %ELAPSED% GEQ %MAX_WAIT% (
    call :log "[PORT] TIMEOUT: Port %PORT% not ready after %MAX_WAIT% seconds"
    exit /b 1
)

goto :port_loop

:port_done
title AIRTECH AI - AI-Powered Air Gesture Teaching Platform
exit /b 0

:monitorElectronWindow
set "MAX_WAIT=%1"
set "ELAPSED=0"
set "DOTS="

call :log "[BOOT] Monitoring Electron window (max %MAX_WAIT%s)..."

:monitor_loop
timeout /t 1 /nobreak >nul
set /a "ELAPSED+=1"

:: Show progress
set "DOTS=!DOTS!."
if "!DOTS!"=="....." set "DOTS="
title AIRTECH AI - Starting Electron... [!ELAPSED!/%MAX_WAIT%s] !DOTS!

:: Check Electron process and window title
tasklist /FI "IMAGENAME eq electron.exe" 2>nul | find "electron.exe" >nul
if %ERRORLEVEL% EQU 0 (
    powershell -NoProfile -Command "$ws = Get-Process electron -ErrorAction SilentlyContinue; if ($ws) { $ws | Where-Object { $_.MainWindowTitle -like 'AIRTECH AI*' -or $_.MainWindowTitle -like '*AirTech*' } }" 2>nul | find "electron" >nul
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
exit /b 0