@echo off
setlocal enabledelayedexpansion
title Dextremix Finance - Respaldo de Seguridad

:: Colors ANSI
set "V= [92m"  & set "A= [93m"  & set "R= [91m"
set "C= [96m"  & set "M= [95m"  & set "N= [0m"

echo.
echo %M%  ╔══════════════════════════════════════════════╗%N%
echo %M%  ║        GENERANDO RESPALDO DE DATOS           ║%N%
echo %M%  ╚══════════════════════════════════════════════╝%N%
echo.

:: Rutas
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "PG_DUMP=%ROOT%\bin\pgsql\bin\pg_dump.exe"
set "BACKUP_DIR=%ROOT%\backups"

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

:: Generar nombre de archivo con fecha y hora usando PowerShell para evitar bugs de idioma/localizacion
for /f %%a in ('powershell -Command "Get-Date -Format 'yyyyMMdd_HHmmss'"') do set "TIMESTAMP=%%a"
set "FILENAME=respaldo_!TIMESTAMP!.sql"

echo  %A% >>%N% Exportando base de datos finandex...
set "PGPASSWORD=postgres"

"%PG_DUMP%" -U postgres -h 127.0.0.1 -p 5432 finandex > "%BACKUP_DIR%\%FILENAME%"

if %errorlevel% equ 0 (
    echo.
    echo  %V% OK %N% Respaldo completado exitosamente.
    echo  %C% Archivo:%N% %BACKUP_DIR%\%FILENAME%
) else (
    echo.
    echo  %R% ERROR %N% No se pudo generar el respaldo.
    echo  %A% Asegurate de que el sistema este INICIADO antes de respaldar.%N%
)

echo.
if "%~1" neq "--silent" pause
