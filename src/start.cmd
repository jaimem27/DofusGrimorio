@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo === START %date% %time% ===> start.log
echo CWD: %cd%>> start.log
echo Node: >> start.log
where node >> start.log 2>&1
node -v >> start.log 2>&1

node index.js >> start.log 2>&1

echo === EXITCODE !errorlevel! %date% %time% ===>> start.log
echo.>> start.log

pause
endlocal
