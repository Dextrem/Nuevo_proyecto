@echo off
setlocal enabledelayedexpansion

title Dextremix Finance - Sistema de Gestion Financiera

:: Colors ANSI
set "V=[92m"  & set "A=[93m"  & set "R=[91m"
set "C=[96m"  & set "M=[95m"  & set "N=[0m"
set "B=[1m"   & set "GRAY=[90m"

:: ─── LOGO ─────────────────────────────────
cls
echo.
echo %M%  ██████╗ ███████╗██╗  ██╗████████╗██████╗ ███████╗███╗   ███╗██╗██╗  ██╗%N%
echo %M%  ██╔══██╗██╔════╝╚██╗██╔╝╚══██╔══╝██╔══██╗██╔════╝████╗ ████║██║╚██╗██╔╝%N%
echo %M%  ██║  ██║█████╗   ╚███╔╝    ██║   ██████╔╝█████╗  ██╔████╔██║██║ ╚███╔╝ %N%
echo %M%  ██║  ██║██╔══╝   ██╔██╗    ██║   ██╔══██╗██╔══╝  ██║╚██╔╝██║██║ ██╔██╗ %N%
echo %M%  ██████╔╝███████╗██╔╝ ██╗   ██║   ██║  ██║███████╗██║ ╚═╝ ██║██║██╔╝ ██╗%N%
echo %M%  ╚═════╝ ╚══════╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝╚═╝╚═╝  ╚═╝%N%
echo %M%                    DEXTREMIX FINANCE - PREMIUM%N%%N%
echo.

:: ─── RUTAS ────────────────────────────────
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
cd /d "%ROOT%"
set "BIN_DIR=%ROOT%\bin"
set "PG_DIR=%BIN_DIR%\pgsql\bin"
set "DATA_DIR=%ROOT%\data\pg_data"
set "BACKEND_DIR=%ROOT%\backend"
set "NODE=%BIN_DIR%\node.exe"
set "APP_LOG=%ROOT%\logs\app.log"
set "PG_LOG=%ROOT%\logs\postgres.log"

if not exist "%ROOT%\logs" mkdir "%ROOT%\logs" >nul 2>&1

:: ─── VERIFICAR ────────────────────────────
if not exist "%BACKEND_DIR%\node_modules" (
    echo %R%  ERROR: Faltan dependencias del backend.%N%
    echo %A%  Ejecute INSTALAR.bat primero.%N%
    echo. & pause & exit /b 1
)
if not exist "%ROOT%\frontend\dist" (
    echo %R%  ERROR: Frontend no compilado.%N%
    echo %A%  Ejecute INSTALAR.bat primero.%N%
    echo. & pause & exit /b 1
)

:: ─── INICIAR POSTGRESQL ───────────────────
echo %C%  ═══════════════════════════════════════════%N%
echo %C%        INICIANDO DEXTREMIX FINANCE%N%
echo %C%  ═══════════════════════════════════════════%N%
echo.

:: Detectar PostgreSQL disponible
"%PG_DIR%\pg_isready.exe" -h 127.0.0.1 -p 5432 >nul 2>&1
if errorlevel 1 (
    :: Verificar si PostgreSQL del sistema esta disponible
    where psql >nul 2>&1
    if not errorlevel 1 (
        "%PG_DIR%\pg_isready.exe" -h 127.0.0.1 -p 5432 >nul 2>&1 || (
            echo  %A% PostgreSQL del sistema detectado, intentando arrancar...%N%
            net start postgresql-x64-16 >nul 2>&1 || net start postgresql-x64-15 >nul 2>&1 || net start postgresql-x64-14 >nul 2>&1 || net start postgresql-x64-13 >nul 2>&1
            "%PG_DIR%\pg_isready.exe" -h 127.0.0.1 -p 5432 >nul 2>&1
        )
    )
)

:: Si aun no hay conexion, intentar con bundled
"%PG_DIR%\pg_isready.exe" -h 127.0.0.1 -p 5432 >nul 2>&1
if errorlevel 1 (
    :: Intentar con el bundled
    echo  %A% Iniciando PostgreSQL portatil...%N%
    if not exist "%DATA_DIR%\PG_VERSION" (
        echo %R%  ERROR: Base de datos no inicializada.%N%
        echo %A%  Ejecute INSTALAR.bat primero.%N%
        echo. & pause & exit /b 1
    )
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5432" ^| findstr "LISTENING"') do (
        taskkill /f /pid %%a >nul 2>&1
    )
    start "PG_Finandex" /B "%PG_DIR%\postgres.exe" -D "%DATA_DIR%" -p 5432 >"%PG_LOG%" 2>&1

    set "READY="
    for /l %%i in (1,1,12) do (
        "%PG_DIR%\pg_isready.exe" -h 127.0.0.1 -p 5432 >nul 2>&1
        if not errorlevel 1 set "READY=1" & goto :pg_ok
        ping -n 2 127.0.0.1 >nul
    )
    :pg_ok
    if not defined READY (
        echo %R%  ERROR: PostgreSQL no arranco%N%
        echo %A%  Revise: %PG_LOG%%N%
        echo. & pause & exit /b 1
    )
    echo  %V% OK %N% PostgreSQL portatil iniciado
) else (
    echo  %V% OK %N% PostgreSQL detectado en puerto 5432
)

:: Matar proceso zombie del backend de ejecucion anterior por PID
if exist "%TEMP%\finandex_backend.pid" (
    set /p BACKEND_PID=<"%TEMP%\finandex_backend.pid"
    if defined BACKEND_PID (
        taskkill /f /pid !BACKEND_PID! >nul 2>&1
    )
    del "%TEMP%\finandex_backend.pid" >nul 2>&1
)

:: Limpiar archivos temporales y logs de ejecuciones previas
del "%TEMP%\finandex_port.txt" >nul 2>&1
if exist "%APP_LOG%" del "%APP_LOG%" >nul 2>&1
ping -n 2 127.0.0.1 >nul

:: Leer puerto desde .env (default 80)
set "ENV_PORT=80"
if exist "%BACKEND_DIR%\.env" (
    for /f "usebackq tokens=2 delims==" %%a in (`findstr /I "^PORT=" "%BACKEND_DIR%\.env"`) do (
        set "ENV_PORT=%%a"
    )
)

:: Matar procesos en el puerto configurado (evitar si es el puerto 80)
if "!ENV_PORT!" neq "80" (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":!ENV_PORT!" ^| findstr "LISTENING"') do (
        taskkill /f /pid %%a >nul 2>&1
    )
)

:: El PID y puerto los escribe server.js automaticamente al iniciar
cd /d "%BACKEND_DIR%"
start "DextremixApp" /B "%NODE%" src/server.js >"%APP_LOG%" 2>&1

:: Esperar a que server.js escriba el puerto en el archivo temporal
set "ACTUAL_PORT=!ENV_PORT!"
set "PORT_FILE=%TEMP%\finandex_port.txt"
for /l %%i in (1,1,15) do (
    if exist "!PORT_FILE!" (
        set /p ACTUAL_PORT=<"!PORT_FILE!"
        goto :port_found
    )
    ping -n 2 127.0.0.1 >nul
)
:port_found

:: Health check en el puerto real
set "READY="
for /l %%i in (1,1,12) do (
    "%NODE%" -e "var h=require('http');h.get('http://127.0.0.1:!ACTUAL_PORT!/api/health',function(r){var d='';r.on('data',function(c){d+=c});r.on('end',function(){process.exit(d.indexOf('OK')>=0?0:1)})}).on('error',function(){process.exit(1)})" >nul 2>&1
    if not errorlevel 1 set "READY=1" & goto :app_ok
    ping -n 2 127.0.0.1 >nul
)
:app_ok

if defined READY (
    if "!ACTUAL_PORT!"=="80" (
        echo  %V% OK %N% Servidor listo en http://dextremix.local
    ) else (
        echo  %V% OK %N% Servidor listo en http://dextremix.local:!ACTUAL_PORT!
    )
) else (
    echo  %R% FAIL %N% Servidor no responde
    if !ACTUAL_PORT! neq !ENV_PORT! echo  %A%  (Puerto detectado: !ACTUAL_PORT!)
    echo  %A% Revise: %APP_LOG%%N%
)

:: ─── LISTO ────────────────────────────────
echo.
echo %V%  ╔══════════════════════════════════════════════╗%N%
echo %V%  ║       SISTEMA LISTO - DEXTREMIX FINANCE      ║%N%
echo %V%  ╚══════════════════════════════════════════════╝%N%
echo.
if "!ACTUAL_PORT!"=="80" (
    echo  %C% Acceso local:%N%   http://dextremix.local
    echo  %C% Acceso red/móvil:%N% http://%COMPUTERNAME%.local
    for /f "usebackq tokens=*" %%i in (`powershell -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object IPAddress -notlike '127.*' | Where-Object IPAddress -notlike '169.254.*').IPAddress" 2^>nul`) do (
        echo  %C% Acceso móvil (IP):%N% http://%%i
    )
) else (
    echo  %C% Acceso local:%N%   http://dextremix.local:!ACTUAL_PORT!
    echo  %C% Acceso red/móvil:%N% http://%COMPUTERNAME%.local:!ACTUAL_PORT!
    for /f "usebackq tokens=*" %%i in (`powershell -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object IPAddress -notlike '127.*' | Where-Object IPAddress -notlike '169.254.*').IPAddress" 2^>nul`) do (
        echo  %C% Acceso móvil (IP):%N% http://%%i:!ACTUAL_PORT!
    )
)
echo  %A% Abriendo navegador...%N%

ping -n 4 127.0.0.1 >nul
if "!ACTUAL_PORT!"=="80" (
    start http://dextremix.local
) else (
    start http://dextremix.local:!ACTUAL_PORT!
)

:: ─── MANTENER / APAGAR ────────────────────
echo.
echo %M%  ╔══════════════════════════════════════════════════╗%N%
echo %M%  ║  Presione cualquier tecla para APAGAR el sistema  ║%N%
echo %M%  ╚══════════════════════════════════════════════════╝%N%
echo.
echo %GRAY%  Cerrar esta ventana tambien detiene el sistema.%N%
echo.

pause >nul

:: ─── APAGAR ───────────────────────────────
echo.
echo  %A% Apagando servidor web...
if exist "%TEMP%\finandex_backend.pid" (
    set /p BACKEND_PID=<"%TEMP%\finandex_backend.pid"
    if defined BACKEND_PID (
        taskkill /f /pid !BACKEND_PID! >nul 2>&1
    )
    del "%TEMP%\finandex_backend.pid" >nul 2>&1
)
del "%TEMP%\finandex_port.txt" >nul 2>&1
echo  %V% OK %N% Servidor detenido

echo  %A% Apagando PostgreSQL...
"%PG_DIR%\pg_ctl.exe" -D "%DATA_DIR%" stop >nul 2>&1
echo  %V% OK %N% PostgreSQL detenido

echo.
echo  %V% Sistema apagado correctamente.%N%
timeout /t 3 /nobreak >nul
