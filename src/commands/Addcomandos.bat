@echo off
title Discord Commands Sync

echo ===============================
echo  LIMPIANDO comandos del guild
echo ===============================
node clear-commands.js

if %errorlevel% neq 0 (
  echo.
  echo ❌ Error limpiando comandos.
  pause
  exit /b 1
)

echo.
echo ===============================
echo  REGISTRANDO comandos del guild
echo ===============================
node register-commands.js

if %errorlevel% neq 0 (
  echo.
  echo ❌ Error registrando comandos.
  pause
  exit /b 1
)

echo.
echo ===============================
echo  ✔ COMANDOS SINCRONIZADOS
echo ===============================
pause
