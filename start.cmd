@echo off
setlocal
cd /d "%~dp0"

if not exist logs mkdir logs
set "LOGFILE=logs\start.log"

> "%LOGFILE%" echo ===============================================
>>"%LOGFILE%" echo DofusGrimorio - Start log
>>"%LOGFILE%" echo Running from: %cd%
>>"%LOGFILE%" echo ===============================================

>>"%LOGFILE%" echo [1] node -v
node -v >>"%LOGFILE%" 2>&1

>>"%LOGFILE%" echo [2] npm -v
npm -v >>"%LOGFILE%" 2>&1

if not exist node_modules (
  >>"%LOGFILE%" echo [3] node_modules not found - running npm install
  call npm install >>"%LOGFILE%" 2>&1
  if errorlevel 1 (
    >>"%LOGFILE%" echo ERROR: npm install failed
    echo ERROR: npm install failed. Check logs\start.log
    pause
    exit /b 1
  )
) else (
  >>"%LOGFILE%" echo [3] node_modules found - skipping npm install
)

>>"%LOGFILE%" echo [4] starting bot
call node src\index.js >>"%LOGFILE%" 2>&1

echo.
echo Bot stopped. Check logs\start.log
pause
