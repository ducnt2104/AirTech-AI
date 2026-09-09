@echo off
title AIRTECH AI - AI-Powered Air Gesture Teaching Platform
echo ======================================================================
echo           AIRTECH AI - KHOI DONG HE THONG DAY HOC THONG MINH
echo ======================================================================
echo.
echo Dang khoi dong ung dung desktop local-first...

cd /d "%~dp0"

if not exist "dist\index.html" (
  echo Dang build goi ung dung lan dau...
  call npm run build
)

echo Khoi chay giao dien Desktop AIRTECH AI...
call npm run start

if %ERRORLEVEL% NEQ 0 (
  echo Mo bang trinh duyet offline fallback...
  start "" "dist\index.html"
)
