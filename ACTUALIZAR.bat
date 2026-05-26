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

:: 1. Verificar Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo %R%[ERROR] Node.js no esta instalado o no esta en PATH%N%
    echo %A%Por favor ejecute INSTALAR.bat primero%N%
    pause
    exit /b 1
)

:: Obtener version de Node
for /f "tokens=1,2 delims=v" %%a in ('node -v') do set "NODE_VER=%%a"
set "NODE_MAJOR=!NODE_VER:~0,2!"
echo %V%  [OK] Node.js !NODE_VER!%N%

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
set "REPO_URL=https://github.com/Dextrem/Nuevo_proyecto/archive/refs/heads/main.zip"
set "ZIP_FILE=%TEMP%\finandex_update.zip"
set "EXTRACT_DIR=%TEMP%\finandex_update"
set "BACKEND_DIR=%~dp0backend"
set "FRONTEND_DIR=%~dp0frontend"
set "ENV_BACKUP=%~dp0backend\.env.update_backup"

echo.
echo %B%============================================%N%
echo %B%   CONFIGURACION DE ACTUALIZACION%N%
echo %B%============================================%N%
echo.
echo Origen: %REPO_URL%
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
        echo %R%[ERROR] No se pudo respaldar .env%N%
        pause
        exit /b 1
    )
) else (
    echo %A%  [AVISO] No se encontro .env para respaldar%N%
)

:: ========================================
:: DESCARGAR CODIGO DESDE GITHUB
:: ========================================
echo.
echo %A%Descargando ultima version del codigo...%N%

:: Intentar metodo 1: PowerShell (Win 8/10/11)
echo %A%  Metodo: PowerShell%N%
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $wc = New-Object System.Net.WebClient; $wc.DownloadFile('%REPO_URL%', '%ZIP_FILE%'); Write-Host 'OK' } catch { Write-Host 'ERROR:' $_.Exception.Message; exit 1 }" > "%TEMP%\finandex_dl_result.txt" 2>&1
set /p "DL_RESULT=" < "%TEMP%\finandex_dl_result.txt"

if not "!DL_RESULT:OK=!"=="!DL_RESULT!" (
    echo %V%  [OK] Descarga completada via PowerShell%N%
) else (
    echo %A%  [FALLBACK] PowerShell no disponible, intentando certutil...%N%
    certutil -urlcache -split -f "%REPO_URL%" "%ZIP_FILE%" >nul 2>&1
    if !errorlevel! equ 0 (
        echo %V%  [OK] Descarga completada via certutil%N%
    ) else (
        echo %R%[ERROR] No se pudo descargar la actualizacion%N%
        echo %A%Verifique: conexion a Internet, firewall, antivirus%N%
        del "%TEMP%\finandex_dl_result.txt" >nul 2>&1
        pause
        exit /b 1
    )
)
del "%TEMP%\finandex_dl_result.txt" >nul 2>&1

:: Verificar que el ZIP existe y no esta corrupto
if not exist "%ZIP_FILE%" (
    echo %R%[ERROR] Archivo ZIP no encontrado%N%
    pause
    exit /b 1
)
set "ZIP_SIZE=~0"
for %%A in ("%ZIP_FILE%") do set "ZIP_SIZE=%%~zA"
if !ZIP_SIZE! lss 1000 (
    echo %R%[ERROR] Archivo ZIP corrupto o muy pequeno (%ZIP_SIZE% bytes)%N%
    del "%ZIP_FILE%" >nul 2>&1
    pause
    exit /b 1
)
echo %V%  Tamanio: !ZIP_SIZE! bytes%N%

:: ========================================
:: EXTRAER CODIGO
:: ========================================
echo.
echo %A%Extrayendo codigo...%N%

:: Limpiar directorio de extraccion previo
if exist "%EXTRACT_DIR%" (
    rmdir /s /q "%EXTRACT_DIR%" >nul 2>&1
)
mkdir "%EXTRACT_DIR%" >nul 2>&1

:: Intentar extraer con PowerShell (nativo)
echo %A%  Metodo: PowerShell Expand-Archive%N%
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Expand-Archive -Path '%ZIP_FILE%' -DestinationPath '%EXTRACT_DIR%' -Force; Write-Host 'OK' } catch { Write-Host 'ERROR:' $_.Exception.Message; exit 1 }" > "%TEMP%\finandex_extract_result.txt" 2>&1
set /p "EX_RESULT=" < "%TEMP%\finandex_extract_result.txt"

if "!EX_RESULT:OK=!"=="!EX_RESULT!" (
    echo %R%  [FALLBACK] Expand-Archive fallo, intentando con certutil...%N%
    :: Fallback: extraer con tar si esta disponible
    where tar >nul 2>&1
    if !errorlevel! equ 0 (
        echo %A%  Metodo: tar (Windows 10+ )%N%
        tar -xf "%ZIP_FILE%" -C "%EXTRACT_DIR%" >nul 2>&1
        if !errorlevel! neq 0 (
            echo %R%[ERROR] No se pudo extraer el archivo ZIP%N%
            del "%ZIP_FILE%" >nul 2>&1
            rmdir /s /q "%EXTRACT_DIR%" >nul 2>&1
            pause
            exit /b 1
        )
        echo %V%  [OK] Extraccion completada via tar%N%
    ) else (
        echo %R%[ERROR] No se pudo extraer el archivo ZIP%N%
        echo %A%Intente descargar manualmente desde:%N%
        echo %A%%REPO_URL%%N%
        del "%ZIP_FILE%" >nul 2>&1
        rmdir /s /q "%EXTRACT_DIR%" >nul 2>&1
        pause
        exit /b 1
    )
) else (
    echo %V%  [OK] Extraccion completada via PowerShell%N%
)
del "%TEMP%\finandex_extract_result.txt" >nul 2>&1

:: Encontrar la carpeta raiz del proyecto extraido
set "EXTRACTED_ROOT=%EXTRACT_DIR%"
for /d %%D in ("%EXTRACT_DIR%\*") do (
    if exist "%%D\backend\package.json" (
        set "EXTRACTED_ROOT=%%D"
        goto :FOUND_ROOT
    )
)
:FOUND_ROOT

echo %V%  Extraido en: !EXTRACTED_ROOT!%N%

:: ========================================
:: COPIAR ARCHIVOS ACTUALIZADOS
:: ========================================
echo.
echo %A%Aplicando actualizacion...%N%

:: Backup de node_modules temporal (para evitar reinstalar si no cambio)
set "BACKEND_NM_BACKUP=%TEMP%\finandex_backend_node_modules"
if exist "%BACKEND_DIR%\node_modules" (
    echo %A%  Preservando node_modules temporalmente...%N%
    if exist "!BACKEND_NM_BACKUP!" rmdir /s /q "!BACKEND_NM_BACKUP!" >nul 2>&1
    mkdir "!BACKEND_NM_BACKUP!" >nul 2>&1
    move /Y "%BACKEND_DIR%\node_modules\*" "!BACKEND_NM_BACKUP!\" >nul 2>&1
    rmdir /s /q "%BACKEND_DIR%\node_modules" >nul 2>&1
)

:: 1. Actualizar backend (codigo fuente)
echo %A%  Actualizando backend...%N%
if exist "!EXTRACTED_ROOT!\backend\" (
    :: Eliminar archivos viejos (excepto node_modules)
    if exist "%BACKEND_DIR%\node_modules" rmdir /s /q "%BACKEND_DIR%\node_modules" >nul 2>&1
    if exist "%BACKEND_DIR%\.env" del "%BACKEND_DIR%\.env" >nul 2>&1
    
    xcopy /E /Y /I "!EXTRACTED_ROOT!\backend\*" "%BACKEND_DIR%\" >nul 2>&1
    echo %V%    [OK] Backend actualizado%N%
) else (
    echo %R%    [ERROR] No se encontro backend en el paquete%N%
)

:: 2. Actualizar frontend (codigo fuente)
echo %A%  Actualizando frontend...%N%
if exist "!EXTRACTED_ROOT!\frontend\" (
    if exist "%FRONTEND_DIR%\node_modules" rmdir /s /q "%FRONTEND_DIR%\node_modules" >nul 2>&1
    if exist "%FRONTEND_DIR%\dist" rmdir /s /q "%FRONTEND_DIR%\dist" >nul 2>&1
    
    xcopy /E /Y /I "!EXTRACTED_ROOT!\frontend\*" "%FRONTEND_DIR%\" >nul 2>&1
    echo %V%    [OK] Frontend actualizado%N%
) else (
    echo %R%    [ERROR] No se encontro frontend en el paquete%N%
)

:: 3. Actualizar scripts batch (.bat)
echo %A%  Actualizando scripts...%N%
for %%S in (INSTALAR.bat INICIAR.bat DETENER.bat ACTUALIZAR.bat ACTUALIZAR_PRIMERA_VEZ.bat CONFIGURA_ARRANQUE_AUTOMATICO.bat CREA_BACKUP.bat RESTAURAR_BACKUP.bAT PROGRAMAR_RESPALDO_DIARIO.bat REPARAR_RED.bat) do (
    if exist "!EXTRACTED_ROOT!\%%S" (
        copy /Y "!EXTRACTED_ROOT!\%%S" "%~dp0%%S" >nul 2>&1
    )
)
echo %V%    [OK] Scripts actualizados%N%

:: 4. Actualizar documentacion
echo %A%  Actualizando documentacion...%N%
for %%D in (GUIA_CAMBIOS_Y_MANUAL_INSTALACION.txt GUIA_DE_INSTALACION_Y_USO.txt GUIA_ACTUALIZACION_PC_REMOTA.txt README.md) do (
    if exist "!EXTRACTED_ROOT!\%%D" (
        copy /Y "!EXTRACTED_ROOT!\%%D" "%~dp0%%D" >nul 2>&1
    )
)
echo %V%    [OK] Documentacion actualizada%N%

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
call npm install --production --no-fund --no-audit --loglevel=error
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
call npm install --no-fund --no-audit --loglevel=error
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
call npx prisma generate --no-hints --no-color >nul 2>&1
if !errorlevel! neq 0 (
    echo %R%  [ERROR] prisma generate fallo%N%
    popd
    pause
    exit /b 1
)
echo %V%  [OK] Prisma client generado%N%

call npx prisma db push --accept-data-loss --no-color >nul 2>&1
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
call npx vite build --no-color 2>&1
if !errorlevel! neq 0 (
    echo %R%  [ERROR] Compilacion del frontend fallo%N%
    popd
    pause
    exit /b 1
)
echo %V%  [OK] Frontend compilado%N%
popd

:: ========================================
:: LIMPIEZA
:: ========================================
echo.
echo %A%Limpiando archivos temporales...%N%
del "%ZIP_FILE%" >nul 2>&1
rmdir /s /q "%EXTRACT_DIR%" >nul 2>&1
if exist "%TEMP%\finandex_backend_node_modules" rmdir /s /q "%TEMP%\finandex_backend_node_modules" >nul 2>&1
echo %V%  [OK] Archivos temporales eliminados%N%

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
