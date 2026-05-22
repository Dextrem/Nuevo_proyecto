@echo off
setlocal enabledelayedexpansion
title Dextremix Finance - Restauracion de Datos

:: Colors ANSI
set "V= [92m"  & set "A= [93m"  & set "R= [91m"
set "C= [96m"  & set "M= [95m"  & set "N= [0m"
set "B= [1m"

echo.
echo %R%  ╔══════════════════════════════════════════════╗%N%
echo %R%  ║        RESTAURACION DE BASE DE DATOS         ║%N%
echo %R%  ╚══════════════════════════════════════════════╝%N%
echo.
echo  %A% ADVERTENCIA:%N% Este proceso borrara los datos actuales y los
echo  reemplazara con el contenido del respaldo seleccionado.
echo.

:: Rutas
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "PG_RESTORE=%ROOT%\bin\pgsql\bin\psql.exe"
set "BACKUP_DIR=%ROOT%\backups"

if not exist "%BACKUP_DIR%" (
    echo  %R% ERROR %N% No se encontro la carpeta de respaldos.
    pause & exit /b 1
)

:: Listar respaldos
echo  %C% Respaldos disponibles en /backups:%N%
echo.
set /a count=0
for %%f in ("%BACKUP_DIR%\*.sql") do (
    set /a count+=1
    set "file!count!=%%~nxf"
    echo    [!count!] %%~nxf
)

if %count% equ 0 (
    echo  %A% No hay archivos .sql en la carpeta /backups.%N%
    pause & exit /b 1
)

echo.
set /p choice="Selecciona el numero del respaldo a restaurar (o 'q' para salir): "

if "%choice%"=="q" exit /b
if "%choice%"=="" exit /b

set "SELECTED_FILE=!file%choice%!"

if not defined SELECTED_FILE (
    echo  %R% Seleccion invalida.%N%
    pause & exit /b 1
)

echo.
echo  Has seleccionado: %B%%SELECTED_FILE%%N%
set /p confirm="¿ESTAS SEGURO? Escribe 'SI' para confirmar: "

if /i "%confirm%" neq "SI" (
    echo  %A% Restauracion cancelada.%N%
    pause & exit /b 1
)

echo.
echo  %A% >>%N% Limpiando base de datos actual y restaurando...
set "PGPASSWORD=postgres"

:: Borrar y recrear para asegurar limpieza total
"%ROOT%\bin\pgsql\bin\psql.exe" -U postgres -h 127.0.0.1 -p 5432 -c "DROP DATABASE IF EXISTS finandex WITH (FORCE);" >nul 2>&1
"%ROOT%\bin\pgsql\bin\psql.exe" -U postgres -h 127.0.0.1 -p 5432 -c "CREATE DATABASE finandex;" >nul 2>&1

:: Restaurar
"%PG_RESTORE%" -U postgres -h 127.0.0.1 -p 5432 finandex < "%BACKUP_DIR%\%SELECTED_FILE%"

if %errorlevel% equ 0 (
    echo.
    echo  %V% OK %N% Datos restaurados exitosamente.
    echo  %A% Por favor, reinicia el sistema para aplicar los cambios.%N%
) else (
    echo.
    echo  %R% ERROR %N% Hubo un fallo durante la restauracion.
    echo  %A% Revisa que el sistema este INICIADO antes de restaurar.%N%
)

echo.
pause
