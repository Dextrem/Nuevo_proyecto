@echo off
title Finandex - Actualizacion Automatica
setlocal enabledelayedexpansion

:: Colores
set "V=[92m"
set "R=[91m"
set "A=[93m"
set "B=[96m"
set "N=[0m"

:: ========================================
:: VERIFICAR REQUISITOS BASICOS
:: ========================================
echo.
echo %B%============================================%N%
echo %B%   FINANDEX - ACTUALIZACION AUTOMATICA%N%
echo %B%============================================%N%
echo.
echo %A%Verificando requisitos...%N%

:: 1. Verificar Node.js (portable primero, luego sistema)
set "PORTABLE_NODE=%~dp0bin\node.exe"
set "PORTABLE_NPM=%~dp0bin\npm.cmd"
set "PORTABLE_NPX=%~dp0bin\npx.cmd"

if exist "%PORTABLE_NODE%" (
    set "NODE_CMD=%PORTABLE_NODE%"
    set "NPM_CMD=%PORTABLE_NPM%"
    set "NPX_CMD=%PORTABLE_NPX%"
    for /f "tokens=1,2 delims=v" %%a in ('"%PORTABLE_NODE%" -v') do set "NODE_VER=%%a"
    echo %V%  [OK] Node.js portatil !NODE_VER!%N%
) else (
    where node >nul 2>&1
    if %errorlevel% neq 0 (
        echo %R%[ERROR] Node.js no encontrado (ni portable ni en PATH)%N%
        echo %A%Por favor ejecute INSTALAR.bat primero%N%
        pause
        exit /b 1
    )
    set "NODE_CMD=node"
    set "NPM_CMD=npm"
    set "NPX_CMD=npx"
    for /f "tokens=1,2 delims=v" %%a in ('node -v') do set "NODE_VER=%%a"
    echo %V%  [OK] Node.js del sistema !NODE_VER!%N%
)

:: 2. Verificar conexion a Internet
echo %A%  Verificando conexion a Internet...%N%
ping -n 1 -w 5000 github.com >nul 2>&1
if %errorlevel% neq 0 (
    echo %R%[ERROR] No hay conexion a Internet%N%
    echo %A%Verifique su conexion e intente nuevamente%N%
    pause
    exit /b 1
)
echo %V%  [OK] Conexion a Internet detectada%N%

:: 3. Verificar que estamos en el directorio correcto
if not exist "backend\package.json" (
    echo %R%[ERROR] No se encuentra backend\package.json%N%
    echo %A%Asegurese de ejecutar este script desde la carpeta raiz de Finandex%N%
    pause
    exit /b 1
)

:: ========================================
:: CONFIGURACION
:: ========================================
set "BACKEND_DIR=%~dp0backend"
set "FRONTEND_DIR=%~dp0frontend"
set "ENV_BACKUP=%~dp0backend\.env.update_backup"

echo.
echo %B%============================================%N%
echo %B%   CONFIGURACION DE ACTUALIZACION%N%
echo %B%============================================%N%
echo.
echo Origen: GitHub (Dextrem/Nuevo_proyecto)
echo Destino: %~dp0
echo.

:: ========================================
:: CONFIRMAR ACTUALIZACION
:: ========================================
echo %A%Esta accion descargara la ultima version del codigo desde GitHub.%N%
echo %A%Los siguientes datos NO se modificaran:%N%
echo %V%  - data/ (base de datos)%N%
echo %V%  - bin/ (Node.js y PostgreSQL)%N%
echo %V%  - backend\.env (configuracion local)%N%
echo %V%  - backups/ (respaldos existentes)%N%
echo %V%  - logs/ (historial de errores)%N%
echo %V%  - uploads/ (imagenes de productos)%N%
echo.
set /p "CONFIRM=Desea continuar? (S/N): "
if /i not "!CONFIRM!"=="S" (
    echo %A%Actualizacion cancelada por el usuario.%N%
    pause
    exit /b 0
)

:: ========================================
:: RESPALDAR .env
:: ========================================
echo.
echo %A%Resguardando configuracion local (.env)...%N%
if exist "%BACKEND_DIR%\.env" (
    copy /Y "%BACKEND_DIR%\.env" "%ENV_BACKUP%" >nul 2>&1
    if !errorlevel! equ 0 (
        echo %V%  [OK] .env respaldado en %ENV_BACKUP%%N%
    ) else (
        echo %A%  [AVISO] No se pudo respaldar .env, continuando...%N%
    )
) else (
    echo %A%  [AVISO] No se encontro .env para respaldar%N%
)

:: ========================================
:: ACTUALIZAR CODIGO CON GIT
:: ========================================
echo.
echo %A%Actualizando codigo desde GitHub...%N%

:: Verificar git
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo %R%[ERROR] Git no esta instalado%N%
    echo %A%Instale git desde https://git-scm.com/ o actualice manualmente%N%
    pause
    exit /b 1
)

:: Verificar que es un repo git
if not exist ".git" (
    echo %R%[ERROR] No es un repositorio Git%N%
    echo %A%Ejecute: git init ^&^& git remote add origin https://github.com/Dextrem/Nuevo_proyecto.git%N%
    echo %A%Luego vuelva a ejecutar este actualizador%N%
    pause
    exit /b 1
)

:: Fetch ultimos cambios
echo %A%  Descargando cambios...%N%
git fetch origin main >nul 2>&1
if !errorlevel! neq 0 (
    echo %R%[ERROR] No se pudo conectar con GitHub%N%
    echo %A%Verifique conexion a Internet y credenciales de git%N%
    pause
    exit /b 1
)

:: Aplicar cambios (preserva .gitignore, node_modules, .env, data/)
echo %A%  Aplicando cambios...%N%
git reset --hard origin/main >nul 2>&1
if !errorlevel! neq 0 (
    echo %R%[ERROR] No se pudo aplicar la actualizacion%N%
    pause
    exit /b 1
)
echo %V%  [OK] Codigo actualizado a la ultima version%N%

:: ========================================
:: RESTAURAR .env
:: ========================================
echo.
echo %A%Restaurando configuracion local (.env)...%N%
if exist "%ENV_BACKUP%" (
    copy /Y "%ENV_BACKUP%" "%BACKEND_DIR%\.env" >nul 2>&1
    del "%ENV_BACKUP%" >nul 2>&1
    echo %V%  [OK] .env restaurado%N%
)

:: Verificar que el .env existe
if not exist "%BACKEND_DIR%\.env" (
    echo %R%[ERROR] .env no encontrado despues de restaurar%N%
    echo %A%Ejecute INSTALAR.bat para generar uno nuevo%N%
    pause
    exit /b 1
)

:: ========================================
:: INSTALAR DEPENDENCIAS
:: ========================================
echo.
echo %A%Instalando dependencias del backend...%N%
pushd "%BACKEND_DIR%"
call "%NPM_CMD%" install --production --no-fund --no-audit --loglevel=error
if !errorlevel! neq 0 (
    echo %R%  [ERROR] npm install fallo en backend%N%
    popd
    pause
    exit /b 1
)
echo %V%  [OK] Dependencias del backend instaladas%N%
popd

echo %A%Instalando dependencias del frontend...%N%
pushd "%FRONTEND_DIR%"
call "%NPM_CMD%" install --no-fund --no-audit --loglevel=error
if !errorlevel! neq 0 (
    echo %R%  [ERROR] npm install fallo en frontend%N%
    popd
    pause
    exit /b 1
)
echo %V%  [OK] Dependencias del frontend instaladas%N%
popd

:: ========================================
:: RESPALDAR BASE DE DATOS
:: ========================================
echo.
echo %A%Creando backup de base de datos antes de migrar...%N%
set "PG_DUMP=%~dp0bin\pgsql\bin\pg_dump.exe"
set "BACKUP_DIR=%~dp0backups"
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
for /f %%a in ('powershell -Command "Get-Date -Format 'yyyyMMdd_HHmmss'"') do set "TS=%%a"
set "PGPASSWORD=postgres"
"%PG_DUMP%" -U postgres -h 127.0.0.1 -p 5432 finandex > "%BACKUP_DIR%\pre_update_%TS%.sql" 2>nul
if !errorlevel! equ 0 (
    echo %V%  [OK] Backup creado: pre_update_%TS%.sql
) else (
    echo %A%  [AVISO] No se pudo crear backup (BD puede no estar corriendo)
)
set "PGPASSWORD="

:: ========================================
:: MIGRAR BASE DE DATOS
:: ========================================
echo.
echo %A%Migrando base de datos (Prisma)...%N%
pushd "%BACKEND_DIR%"
call "%NPX_CMD%" prisma generate --no-hints --no-color >nul 2>&1
if !errorlevel! neq 0 (
    echo %R%  [ERROR] prisma generate fallo%N%
    popd
    pause
    exit /b 1
)
echo %V%  [OK] Prisma client generado%N%

call "%NPX_CMD%" prisma db push --accept-data-loss --no-color >nul 2>&1
if !errorlevel! neq 0 (
    echo %R%  [ERROR] prisma db push fallo%N%
    popd
    pause
    exit /b 1
)
echo %V%  [OK] Base de datos migrada%N%
echo %A%  [NOTA] Usuario admin conserva su clave actual (no se resetea)%N%
popd

:: ========================================
:: COMPILAR FRONTEND
:: ========================================
echo.
echo %A%Compilando frontend...%N%
pushd "%FRONTEND_DIR%"
call "%NPX_CMD%" vite build --no-color 2>&1
if !errorlevel! neq 0 (
    echo %R%  [ERROR] Compilacion del frontend fallo%N%
    popd
    pause
    exit /b 1
)
echo %V%  [OK] Frontend compilado%N%
popd

:: ========================================
:: COMPLETADO
:: ========================================

:: ========================================
:: RESUMEN FINAL
:: ========================================
echo.
echo %B%============================================%N%
echo %B%   ACTUALIZACION COMPLETADA EXITOSAMENTE%N%
echo %B%============================================%N%
echo.
echo %V%  LO QUE SE ACTUALIZO:%N%
echo %V%  - Codigo del backend (nuevas features, correcciones)%N%
echo %V%  - Codigo del frontend (nuevas features, correcciones)%N%
echo %V%  - Scripts batch (INICIAR.bat, INSTALAR.bat, etc.)%N%
echo %V%  - Documentacion (GUIAs, README)%N%
echo.
echo %A%  LO QUE SE PRESERVO:%N%
echo %A%  - data/ (base de datos local)%N%
echo %A%  - bin/ (Node.js y PostgreSQL portable)%N%
echo %A%  - backend\.env (configuracion local)%N%
echo %A%  - backups/ (respaldos existentes)%N%
echo %A%  - logs/ (historial de errores)%N%
echo %A%  - uploads/ (imagenes de productos)%N%
echo.
echo %B%  IMPORTANTE: Cierre el sistema si esta abierto%N%
echo %B%  y ejecute INICIAR.bat para aplicar los cambios.%N%
echo.
pause
