@echo off
setlocal enabledelayedexpansion
title Configurar Inicio Automático - Dextremix Finance

:: Colors ANSI
set "V=[92m"  & set "A=[93m"  & set "R=[91m"
set "C=[96m"  & set "M=[95m"  & set "N=[0m"
set "B=[1m"

:menu
cls
echo.
echo %M%  ╔══════════════════════════════════════════════╗%N%
echo %M%  ║        INICIO AUTOMÁTICO CON WINDOWS         ║%N%
echo %M%  ╚══════════════════════════════════════════════╝%N%
echo.
echo  Configura el sistema para que se encienda solo en segundo plano
echo  cuando prenda la computadora (sin mostrar ventanas molestas).
echo.
echo  %C%[1]%N% Activar inicio automático (Modo Silencioso)
echo  %C%[2]%N% Desactivar inicio automático
echo  %C%[3]%N% Salir
echo.
set /p opcion="Selecciona una opción [1-3]: "

set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "VBS_FILE=%STARTUP_DIR%\dextremix_startup.vbs"
set "ROOT_DIR=%~dp0"

if "%opcion%"=="1" goto :activar
if "%opcion%"=="2" goto :desactivar
if "%opcion%"=="3" exit /b
goto :menu

:activar
echo.
echo  %A% Configurando inicio automático...%N%

(
echo Set WshShell = CreateObject^("WScript.Shell"^)
echo WshShell.Run "cmd.exe /c """ ^& "%ROOT_DIR%INICIAR.bat" ^& """", 0, False
) > "%VBS_FILE%"

if exist "%VBS_FILE%" (
    echo.
    echo  %V%[ÉXITO] %N% El sistema se iniciará automáticamente en segundo plano
    echo  la próxima vez que enciendas tu computadora e inicies sesión.
    echo.
    echo  %C%Nota:%N% Para apagar el sistema cuando esté corriendo en segundo plano,
    echo  utiliza el archivo %B%DETENER.bat%N% que acabo de crear en la carpeta.
) else (
    echo.
    echo  %R%[ERROR] %N% No se pudo configurar el inicio automático.
    echo  Verifica que tengas permisos de escritura en tu perfil de usuario.
)
echo.
pause
goto :menu

:desactivar
echo.
echo  %A% Removiendo inicio automático...%N%
if exist "%VBS_FILE%" (
    del "%VBS_FILE%" >nul 2>&1
    echo.
    echo  %V%[ÉXITO] %N% Inicio automático desactivado correctamente.
) else (
    echo.
    echo  %A%[AVISO] %N% El inicio automático no estaba activado.
)
echo.
pause
goto :menu
