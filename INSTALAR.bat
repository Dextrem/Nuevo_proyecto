@echo off
setlocal enabledelayedexpansion

title Dextremix Finance - Instalador

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
echo %M%                    DEXTREMIX FINANCE - INSTALLER%N%%N%
echo.
echo %B%%A%              INSTALADOR DEL SISTEMA%N%
echo %A%           ═══════════════════════════════%N%
echo.

:: ─── RUTAS ────────────────────────────────
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "BIN_DIR=%ROOT%\bin"
set "PG_DIR=%BIN_DIR%\pgsql\bin"
set "DATA_DIR=%ROOT%\data\pg_data"
set "BACKEND_DIR=%ROOT%\backend"
set "FRONTEND_DIR=%ROOT%\frontend"
set "NODE=%BIN_DIR%\node.exe"
set "NPM=%BIN_DIR%\npm.cmd"
set "PRISMA=%BACKEND_DIR%\node_modules\.bin\prisma.cmd"
set "PATH=%BIN_DIR%;%PATH%"

:: ─── PASO 1: REQUISITOS ───────────────────
echo.
echo %B%%A%  [1/7] Verificando requisitos%N%

if not exist "%NODE%"   ( echo %R%  ERROR: Node.js no encontrado%N% & pause & exit /b 1 )
if not exist "%PG_DIR%\postgres.exe" ( echo %R%  ERROR: PostgreSQL no encontrado%N% & pause & exit /b 1 )

for /f "tokens=*" %%v in ('"%NODE%" -v') do set "NV=%%v"
echo  %V% OK %N% Node.js %NV%
echo  %V% OK %N% PostgreSQL %B%%GRAY%(portable)%N%

:: ─── SOLICITAR CONTRASEÑA DE POSTGRESQL ─────
echo.
echo %B%%A%  [1.5/7] Configurando contraseña de PostgreSQL%N%
set /p "PG_PASSWORD=Ingrese la contraseña para el usuario 'postgres': "
if "%PG_PASSWORD%"=="" (
    echo %R%  ERROR: La contraseña no puede estar vacía%N%
    pause & exit /b 1
)

:: ─── PASO 2-4: POSTGRESQL ─────────────────
echo.
echo %B%%A%  [2/4] Configurando PostgreSQL%N%

:: Verificar si ya hay PostgreSQL disponible
set "PG_READY="
"%PG_DIR%\pg_isready.exe" -h 127.0.0.1 -p 5432 >nul 2>&1
if not errorlevel 1 set "PG_READY=1"

if not defined PG_READY (
    :: Intentar arrancar PostgreSQL del sistema
    where psql >nul 2>&1
    if not errorlevel 1 (
        net start postgresql-x64-16 >nul 2>&1 || net start postgresql-x64-15 >nul 2>&1
        "%PG_DIR%\pg_isready.exe" -h 127.0.0.1 -p 5432 >nul 2>&1
        if not errorlevel 1 set "PG_READY=1"
    )
)

if defined PG_READY (
    echo  %V% OK %N% PostgreSQL ya disponible en puerto 5432
    goto :pg_create_db
)

:: No hay PostgreSQL del sistema, usar bundled
echo  %A% >>%N% PostgreSQL portatil...

:: Inicializar datos
if not exist "%DATA_DIR%\PG_VERSION" (
    if not exist "%ROOT%\data" mkdir "%ROOT%\data" >nul
    echo  %A% >>%N% Inicializando cluster de datos...
    "%PG_DIR%\initdb.exe" -D "%DATA_DIR%" --username=postgres --auth=scram-sha-256 >nul 2>&1
    if errorlevel 1 ( echo %R%  ERROR al inicializar%N% & pause & exit /b 1 )
)

:: Configurar listen_addresses
if exist "%DATA_DIR%\postgresql.conf" (
    findstr /B "listen_addresses" "%DATA_DIR%\postgresql.conf" >nul
    if errorlevel 1 (
        echo.>>"%DATA_DIR%\postgresql.conf"
        echo listen_addresses = '*'>>"%DATA_DIR%\postgresql.conf"
        echo port = 5432>>"%DATA_DIR%\postgresql.conf"
    )
)

:: Matar procesos en puerto 5432
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5432" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)

:: Arrancar bundled PostgreSQL
start "PG_Finandex" /B "%PG_DIR%\postgres.exe" -D "%DATA_DIR%" -p 5432 >nul 2>&1

set "READY="
for /l %%i in (1,1,15) do (
    "%PG_DIR%\pg_isready.exe" -h 127.0.0.1 -p 5432 >nul 2>&1
    if not errorlevel 1 set "READY=1" & goto :pg_started
    ping -n 2 127.0.0.1 >nul
)
:pg_started
if not defined READY (
    echo %R%  ERROR: PostgreSQL no arranco%N% & pause & exit /b 1
)
echo  %V% OK %N% PostgreSQL portatil iniciado en puerto 5432

:pg_create_db
echo.
echo %B%%A%  [3/4] Creando base de datos%N%

set "PGPASSWORD=%PG_PASSWORD%"
"%PG_DIR%\psql.exe" -U postgres -h 127.0.0.1 -tc "SELECT 1 FROM pg_database WHERE datname='finandex'" | findstr "1" >nul 2>&1
if errorlevel 1 (
    "%PG_DIR%\psql.exe" -U postgres -h 127.0.0.1 -c "CREATE DATABASE finandex;" >nul 2>&1
    if errorlevel 1 ( echo %R%  ERROR al crear BD%N% & pause & exit /b 1 )
    "%PG_DIR%\psql.exe" -U postgres -h 127.0.0.1 -c "ALTER USER postgres WITH PASSWORD '%PG_PASSWORD%';" >nul 2>&1
    echo  %V% OK %N% Base de datos finandex creada
) else (
    echo  %V% OK %N% La BD finandex ya existe
)

:: ─── PASO 4: .ENV ─────────────────────────
echo.
echo %B%%A%  [4/7] Generando .env%N%

:: Generar JWT secrets con Node.js (crypto.randomBytes)
set "JWT_GEN=%TEMP%\finandex_gen_jwt.js"
echo const crypto = require('crypto'); console.log(crypto.randomBytes(32).toString('hex') + ' ' + crypto.randomBytes(32).toString('hex')); > "%JWT_GEN%"
for /f "tokens=1,2" %%a in ('"%NODE%" "%JWT_GEN%"') do (set "JWT1=%%a" & set "JWT2=%%b")
del "%JWT_GEN%" >nul 2>&1

pushd "%BACKEND_DIR%"
(
  echo PORT=3000
  echo NODE_ENV=production
  echo.
  echo DATABASE_URL="postgresql://postgres:%PG_PASSWORD%@127.0.0.1:5432/finandex?schema=public"
  echo.
  echo JWT_SECRET=%JWT1%
  echo JWT_REFRESH_SECRET=%JWT2%
  echo JWT_EXPIRES_IN=4h
  echo JWT_REFRESH_EXPIRES_IN=30d
  echo.
  echo CORS_ORIGIN=http://dextremix.local,http://localhost
  echo.
  echo SMTP_HOST=smtp.example.com
  echo SMTP_PORT=587
  echo SMTP_USER=correo@ejemplo.com
  echo SMTP_PASS=password
  echo SMTP_FROM="Finandex ^<noreply@finandex.local^>"
  echo NOTIFICATION_EMAILS=admin@finandex.local
  echo.
  echo RATE_LIMIT_WINDOW_MS=900000
  echo RATE_LIMIT_MAX_REQUESTS=1000
  echo RATE_LIMIT_LOGIN_MAX=5
) > .env
popd

echo  %V% OK %N% Archivo .env creado

:: Configurar archivo hosts
echo  %A% >>%N% Configurando dominio local dextremix.local...
findstr /I "dextremix.local" "%windir%\System32\drivers\etc\hosts" >nul 2>&1
if errorlevel 1 (
    echo.>>"%windir%\System32\drivers\etc\hosts" 2>nul
    echo 127.0.0.1 dextremix.local>>"%windir%\System32\drivers\etc\hosts" 2>nul
    if errorlevel 1 (
        echo  %R%  ADVERTENCIA: No se pudo escribir en el archivo hosts (permisos insuficientes).%N%
        echo  %A%  Para acceder usando dextremix.local, debe abrir Bloc de Notas como Administrador%N%
        echo  %A%  y agregar la siguiente linea al final de C:\Windows\System32\drivers\etc\hosts:%N%
        echo  %V%  127.0.0.1 dextremix.local%N%
    ) else (
        echo  %V% OK %N% Dominio local dextremix.local configurado correctamente
    )
) else (
    echo  %V% OK %N% El dominio local ya esta configurado
)

:: ─── PASO 5: BACKEND ──────────────────────
echo.
echo %B%%A%  [5/7] Instalando backend%N%

if not exist "%ROOT%\logs" mkdir "%ROOT%\logs" >nul 2>&1
if not exist "%BACKEND_DIR%\uploads" mkdir "%BACKEND_DIR%\uploads" >nul 2>&1

cd /d "%BACKEND_DIR%"

if not exist "node_modules" (
    call "%NPM%" install >nul 2>&1
    if errorlevel 1 ( echo %R%  ERROR instalando dependencias%N% & pause & exit /b 1 )
)
echo  %V% OK %N% Dependencias del backend

call "%PRISMA%" generate >nul 2>&1
echo  %V% OK %N% Cliente Prisma generado

call "%PRISMA%" db push >nul 2>&1
if errorlevel 1 ( echo %R%  ERROR creando tablas%N% & pause & exit /b 1 )
echo  %V% OK %N% Tablas creadas en la BD

call "%NPM%" run db:seed >nul 2>&1
if errorlevel 1 (
    echo  %A% AVISO %N% Seed fallo - admin se crea al iniciar
) else (
    echo  %V% OK %N% Datos iniciales cargados
)

:: ─── PASO 6: FRONTEND ─────────────────────
echo.
echo %B%%A%  [6/7] Instalando frontend%N%

cd /d "%FRONTEND_DIR%"

if not exist "node_modules" (
    call "%NPM%" install >nul 2>&1
    if errorlevel 1 ( echo %R%  ERROR instalando frontend%N% & pause & exit /b 1 )
)
echo  %V% OK %N% Dependencias del frontend

call "%NPM%" run build >nul 2>&1
if errorlevel 1 ( echo %R%  ERROR compilando frontend%N% & pause & exit /b 1 )
echo  %V% OK %N% Frontend compilado para produccion

:: ─── PASO 7: ACCESO DIRECTO ───────────────
echo.
echo %B%%A%  [7/7] Creando acceso en escritorio%N%

set "SHORTCUT=%USERPROFILE%\Desktop\Dextremix Finance.lnk"

if not exist "%SHORTCUT%" (
    if exist "%ROOT%\icon.ico" (
        powershell -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%SHORTCUT%');$s.TargetPath='%ROOT%\INICIAR.bat';$s.WorkingDirectory='%ROOT%';$s.Description='Finandex - Sistema de Gestion Financiera';$s.IconLocation='%ROOT%\icon.ico';$s.Save()" >nul 2>&1
    ) else (
        powershell -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%SHORTCUT%');$s.TargetPath='%ROOT%\INICIAR.bat';$s.WorkingDirectory='%ROOT%';$s.Description='Finandex - Sistema de Gestion Financiera';$s.Save()" >nul 2>&1
    )
    echo  %V% OK %N% Acceso directo creado en el escritorio
) else (
    echo  %V% OK %N% El acceso ya existe
)

:: ─── FIN ──────────────────────────────────
echo.
echo %V%  ╔══════════════════════════════════════════════╗%N%
echo %V%  ║         INSTALACION COMPLETADA              ║%N%
echo %V%  ╚══════════════════════════════════════════════╝%N%
echo.
echo  %C%  Backend:%N%  http://localhost:3000
echo  %C%  Usuario:%N%  admin
echo  %C%  Clave:%N%    admin
echo  %R%  ⚠  DEBE CAMBIAR LA CONTRASEÑA EN EL PRIMER INICIO%N%
echo.
echo  %A%  IMPORTANTE:%N%
echo  %A%  Use INICIAR.bat o el acceso directo del escritorio%N%
echo  %A%  para arrancar el sistema cada vez.%N%
echo.
pause
