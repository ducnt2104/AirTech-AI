@echo off
title AIRTECH AI - AI-Powered Air Gesture Teaching Platform
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ======================================================================
:: AIRTECH AI - ULTRA FAST & BEAUTIFUL STARTUP LAUNCHER
:: ======================================================================

:: Enable ANSI Colors
for /F "tokens=1,2 delims=#" %%a in ('"prompt #$H#$E# & echo on & for %%b in (1) do rem"') do set "ESC=%%b"
set "C_RESET=%ESC%[0m"
set "C_CYAN=%ESC%[36m"
set "C_GREEN=%ESC%[32m"
set "C_YELLOW=%ESC%[33m"
set "C_RED=%ESC%[31m"
set "C_BOLD=%ESC%[1m"
set "C_GRAY=%ESC%[90m"
set "C_WHITE=%ESC%[97m"

set "APP_DIR=%~dp0"
set "LOG_FILE=%APP_DIR%startup.log"
set "ELECTRON_TIMEOUT=40"

cd /d "%APP_DIR%"

cls
echo %C_CYAN%========================================================================%C_RESET%
echo %C_BOLD%%C_CYAN%  ___  ___ _____ _____ _____ _____  _   _   ___  _____ %C_RESET%
echo %C_BOLD%%C_CYAN% / _ \ ^|  _ \_   _/  ___|_   _/  ___^|^| ^| ^| ^| / _ \^|_   _^|%C_RESET%
echo %C_BOLD%%C_CYAN%/ /_\ \^| ^|_/ /^| ^| \ `--.  ^| ^| \ `--. ^| |_^| |/ /_\ \ ^| ^|  %C_RESET%
echo %C_BOLD%%C_CYAN%^|  _  ^|^|    / ^| ^|  `--. \ ^| ^|  `--. \^|  _  ^|^|  _  ^| ^| ^|  %C_RESET%
echo %C_BOLD%%C_CYAN%^| ^| ^| ^|^| ^|\ \ _| |_/\__/ / ^| ^| /\__/ /^| ^| ^| ^|^| ^| ^| ^|_^| ^|_ %C_RESET%
echo %C_BOLD%%C_CYAN%\_^| ^|_\/\_^| \_|\___/\____/  \_/ \____/ \_| |_/\_| |_/\___/ %C_RESET%
echo.
echo %C_WHITE%  AI-Powered Air Gesture Teaching Platform %C_GRAY%^| Engine Launcher%C_RESET%
echo %C_CYAN%========================================================================%C_RESET%
echo.

:: Reset log file
echo [BOOT] AIRTECH AI STARTUP - %DATE% %TIME% > "%LOG_FILE%"

:: 1. Check Node Environment
if not exist "node_modules\" (
    echo %C_RED%[✗] Error: Thư mục node_modules chưa tồn tại!%C_RESET%
    echo %C_YELLOW%[!] Ca ca hãy chạy 'npm install' trước khi khởi động nhé.%C_RESET%
    echo.
    pause
    exit /b 1
)

:: 2. Check Dist / Build status
if exist "dist\index.html" (
    echo %C_GREEN%[✓] Đã tìm thấy bản build ứng dụng (dist/index.html).%C_RESET%
) else (
    echo %C_YELLOW%[!] Phát hiện lần đầu chạy. Đang biên dịch dự án (Build)...%C_RESET%
    echo %C_GRAY%    Đang chạy: npm run build...%C_RESET%
    
    call npm run build >> "%LOG_FILE%" 2>&1
    if !ERRORLEVEL! NEQ 0 (
        echo %C_RED%[✗] Biên dịch thất bại! Ca ca kiểm tra file startup.log nhé.%C_RESET%
        goto :fallback
    )
    echo %C_GREEN%[✓] Biên dịch thành công!%C_RESET%
)

echo.
echo %C_CYAN%[⚡] Đang khởi chạy AIRTECH AI Desktop Engine...%C_RESET%
echo %C_GRAY%    Đang chờ cửa sổ giao diện phần mềm xuất hiện...%C_RESET%
echo.

:: 3. Launch Electron in Background
start "" /B cmd /c "npm run start > \"%LOG_FILE%.electron\" 2>&1"

:: 4. Monitor Window Handle Loop (Giữ tab CMD cho đến khi cửa sổ UI hiển thị)
set "ELAPSED=0"
set "SPIN_STEP=0"

:MONITOR_LOOP
:: Kiểm tra xem có tiến trình Electron/Node nào đã mở Cửa sổ UI (MainWindowHandle != 0) chưa
powershell -NoProfile -Command "if (Get-Process -Name electron, 'AIRTECH AI', node -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }) { exit 0 } else { exit 1 }" 2>nul

if !ERRORLEVEL! EQU 0 (
    echo.
    echo %C_GREEN%[✓] Giao diện AIRTECH AI đã hiển thị thành công!%C_RESET%
    echo %C_CYAN%[🚀] Đã chuyển sang giao diện phần mềm. Đang đóng trình khởi động...%C_RESET%
    echo [BOOT] Active UI Window detected at !ELAPSED!s >> "%LOG_FILE%"
    timeout /t 2 /nobreak >nul
    exit /b 0
)

:: Kiểm tra Quá thời gian (Timeout)
if !ELAPSED! GEQ %ELECTRON_TIMEOUT% (
    echo.
    echo %C_RED%[✗] Không thể mở cửa sổ Desktop sau %ELECTRON_TIMEOUT% giây.%C_RESET%
    goto :fallback
)

:: Smooth Spinner Animation
set /a "SPIN_STEP=(SPIN_STEP %% 4) + 1"
if !SPIN_STEP! EQU 1 set "SPIN_CHAR=/"
if !SPIN_STEP! EQU 2 set "SPIN_CHAR=-"
if !SPIN_STEP! EQU 3 set "SPIN_CHAR=\"
if !SPIN_STEP! EQU 4 set "SPIN_CHAR=|"

<nul set /p "=%ESC%[1G%C_YELLOW%    [!SPIN_CHAR!] Đang tải giao diện UI... [!ELAPSED!s / %ELECTRON_TIMEOUT%s]%C_RESET%"

timeout /t 1 /nobreak >nul
set /a "ELAPSED+=1"
goto :MONITOR_LOOP

:: 5. Fallback Mode (Mở Web nếu Desktop App lỗi)
:fallback
echo.
echo %C_YELLOW%[!] Chuyển sang chế độ dự phòng (Browser Mode)...%C_RESET%
if exist "dist\index.html" (
    start "" "%APP_DIR%dist\index.html"
    echo %C_GREEN%[✓] Đã mở dist\index.html trên trình duyệt mặc định.%C_RESET%
) else (
    echo %C_RED%[✗] Không tìm thấy dist\index.html để mở trình duyệt.%C_RESET%
)
echo.
echo %C_GRAY%Nhấn phím bất kỳ để đóng cửa sổ này...%C_RESET%
pause >nul
exit /b 1