@echo off
title GreenThumb Connect
color 0A

echo =============================================
echo    Starting GreenThumb Connect...
echo =============================================
echo.

:: Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Node.js not found! Install from: https://nodejs.org
    pause
    exit /b 1
)

:: Install dependencies if needed
echo Checking dependencies...
cd backend
if not exist "node_modules\" (
    echo Installing backend dependencies...
    call npm install
)
cd ..

:: Install http-server globally if not present
where http-server >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Installing http-server...
    call npm install -g http-server
)

:: Clean up old processes
echo Cleaning up old processes...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do taskkill /F /PID %%a >nul 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8080" ^| find "LISTENING"') do taskkill /F /PID %%a >nul 2>nul

:: Start backend
echo Starting backend...
start "Backend" /MIN cmd /c "cd backend && node server.js"
timeout /t 3 >nul

:: Start frontend
echo Starting frontend...
start "Frontend" /MIN cmd /c "npx http-server -p 8080 -c-1 --cors"
timeout /t 2 >nul

:: Open browser
echo Opening browser...
start http://localhost:8080/index.html

echo.
echo =============================================
echo    ✓ Application is running!
echo =============================================
echo.
echo Frontend: http://localhost:8080/index.html
echo Backend:  http://localhost:3000
echo.
echo Login: gardener1 / demo123
echo.
echo Press any key to STOP servers...
pause >nul

:: Stop servers
taskkill /FI "WindowTitle eq Backend*" /F >nul 2>nul
taskkill /FI "WindowTitle eq Frontend*" /F >nul 2>nul
echo Servers stopped!
timeout /t 2 >nul
