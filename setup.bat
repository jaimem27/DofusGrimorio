@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ===============================================
echo   DofusGrimorio - Setup
echo   Root: %cd%
echo ===============================================

where node >nul 2>&1 || (echo [ERROR] Node no instalado. & pause & exit /b 1)
where npm  >nul 2>&1 || (echo [ERROR] NPM no disponible. & pause & exit /b 1)

echo [1/3] Instalando dependencias Node...
if exist package-lock.json (
  call npm ci
) else (
  call npm install
)
if errorlevel 1 (echo [ERROR] npm install/ci fallo. & pause & exit /b 1)

echo [2/3] Verificando paquetes...
call node -e "require('discord.js'); console.log('OK discord.js')"
if errorlevel 1 (echo [ERROR] Falta discord.js & pause & exit /b 1)

call node -e "require('mysql2/promise'); console.log('OK mysql2')"
if errorlevel 1 (echo [ERROR] Falta mysql2 & pause & exit /b 1)

call node -e "require('dotenv'); console.log('OK dotenv')"
if errorlevel 1 (echo [ERROR] Falta dotenv & pause & exit /b 1)

echo [3/3] Sincronizando comandos (solo primera vez)...
set FLAG_FILE=.commands_synced

REM Si pasas --force-commands, fuerza la sincronizacion
set FORCE=0
if /I "%~1"=="--force-commands" set FORCE=1

if exist "%FLAG_FILE%" (
  if "%FORCE%"=="1" (
    echo [INFO] Forzando sincronizacion de comandos...
    call "src\commands\Addcomandos.bat"
    if errorlevel 1 (echo [ERROR] Fallo sincronizando comandos. & pause & exit /b 1)
    echo ok> "%FLAG_FILE%"
  ) else (
    echo [INFO] Comandos ya sincronizados. (Usa: setup.bat --force-commands)
  )
) else (
  call "src\commands\Addcomandos.bat"
  if errorlevel 1 (echo [ERROR] Fallo sincronizando comandos. & pause & exit /b 1)
  echo ok> "%FLAG_FILE%"
)

echo.
echo ===============================================
echo  Setup completado.
echo  Ahora ejecuta: start.cmd
echo ===============================================
echo.
pause
endlocal
exit /b 0
