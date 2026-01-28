@echo off
setlocal EnableExtensions EnableDelayedExpansion
title DofusGrimorio - Start

REM Ir a la carpeta donde está este .bat
cd /d "%~dp0"

echo.
echo ==========================================
echo   DofusGrimorio - Iniciando...
echo   Ruta: %cd%
echo ==========================================
echo.

REM Opcional: log a archivo para revisar luego
set LOG=logs\start_%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%.log
set LOG=%LOG: =0%
if not exist logs mkdir logs

echo [INFO] Ejecutando npm start...
echo [INFO] Log: %LOG%
echo.

call npm start 1>> "%LOG%" 2>>&1

echo.
echo ==========================================
echo   El proceso ha terminado con exit code: %errorlevel%
echo   Revisa el log si no viste el motivo.
echo ==========================================
echo.
pause
