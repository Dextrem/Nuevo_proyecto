@echo off
setlocal enabledelayedexpansion
title Detener Dextremix Finance

:: Colors ANSI
set "V=[92m"  & set "A=[93m"  & set "R=[91m"
set "C=[96m"  & set "M=[95m"  & set "N=[0m"

echo.
echo %M%  ╔══════════════════════════════════════════════╗%N%
echo %M%  ║        DETENIENDO DEXTREMIX FINANCE          ║%N%
echo %M%  ╚══════════════════════════════════════════════╝%N%
echo.

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "PG_DIR=%ROOT%\bin\pgsql\bin"
set "DATA_DIR=%ROOT%\data\pg_data"

echo  %A% Deteniendo servidor web...%N%
if exist "%TEMP%\finandex_backend.pid" (
    set /p BACKEND_PID=<"%TEMP%\finandex_backend.pid"
    if defined BACKEND_PID (
        taskkill /f /pid !BACKEND_PID! >nul 2>&1
    )
    del "%TEMP%\finandex_backend.pid" >nul 2>&1
)
del "%TEMP%\finandex_port.txt" >nul 2>&1
echo  %V% OK %N% Servidor detenido.

echo.
echo  %A% Deteniendo PostgreSQL...%N%
"%PG_DIR%\pg_ctl.exe" -D "%DATA_DIR%" stop >nul 2>&1
echo  %V% OK %N% PostgreSQL detenido.

echo.
echo  %V% Sistema apagado correctamente.%N%
timeout /t 3 /nobreak >nul
