@echo off
title Finandex - Primera Actualizacion
setlocal enabledelayedexpansion

:: Compatibilidad UTF-8 en consola
chcp 65001 >nul 2>&1

:: Colores ANSI
set "V=[92m"
set "R=[91m"
set "A=[93m"
set "B=[96m"
set "N=[0m"

:: ========================================
:: INICIO
:: ========================================
echo.
echo %B%============================================%N%
echo %B%  FINANDEX - PRIMERA ACTUALIZACION%N%
echo %B%============================================%N%
echo.
echo %A%Este script descarga e instala el sistema de%N%
echo %A%actualizacion automatica en esta PC.%N%
echo.
echo %A%No requiere claves, tokens ni Git.%N%
echo %A%Solo conexion a Internet.%N%
echo.

:: ========================================
:: VERIFICACION DE DIRECTORIO
:: ========================================
if exist "backend\package.json" (
    echo %V%  [OK] Directorio raiz detectado: %CD%%N%
) else (
    echo %R%[ERROR] No se encuentra backend\package.json%N%
    echo %A%Asegurese de ejecutar este script desde la carpeta raiz de Finandex%N%
    echo %A%Ejemplo: cd "C:\Programa de Finanzas\financial_app"%N%
    pause
    exit /b 1
)

:: ========================================
:: VERIFICAR CONEXION A INTERNET
:: ========================================
echo.
echo %A%Verificando conexion a Internet...%N%
ping -n 1 -w 5000 github.com >nul 2>&1
if %errorlevel% neq 0 (
    ping -n 1 -w 5000 google.com >nul 2>&1
    if !errorlevel! neq 0 (
        echo %R%[ERROR] No hay conexion a Internet%N%
        echo %A%Verifique su conexion e intente nuevamente%N%
        pause
        exit /b 1
    )
)
echo %V%  [OK] Conexion a Internet detectada%N%

:: ========================================
:: PREGUNTAR CONFIRMACION
:: ========================================
echo.
echo %A%Se descargaran los siguientes archivos nuevos:%N%
echo %V%  - ACTUALIZAR.bat%N%
echo %V%  - GUIA_ACTUALIZACION_PC_REMOTA.txt%N%
echo %V%  - .gitignore%N%
echo.
echo %A%Y se actualizaran los scripts existentes:%N%
echo %V%  - INICIAR.bat%N%
echo %V%  - INSTALAR.bat%N%
echo %V%  - DETENER.bat%N%
echo %V%  - CONFIGURA_ARRANQUE_AUTOMATICO.bat%N%
echo.
echo %A%NO se modificaran:%N%
echo %A%  - data/ (base de datos local)%N%
echo %A%  - bin/ (Node.js y PostgreSQL)%N%
echo %A%  - backend\.env (configuracion local)%N%
echo %A%  - backups/ (respaldos existentes)%N%
echo %A%  - logs/ (historial de errores)%N%
echo %A%  - uploads/ (imagenes de productos)%N%
echo.
set /p "CONFIRM=Desea continuar? (S/N): "
if /i not "!CONFIRM!"=="S" (
    echo %A%Actualizacion cancelada por el usuario.%N%
    pause
    exit /b 0
)

:: ========================================
:: CONFIGURACION
:: ========================================
set "REPO_URL=https://github.com/Dextrem/Nuevo_proyecto/archive/refs/heads/main.zip"
set "ZIP_FILE=%TEMP%\finandex_first_update.zip"
set "EXTRACT_DIR=%TEMP%\finandex_first_update"
set "ENV_BACKUP=%CD%\backend\.env.update_backup"

:: ========================================
:: RESPALDAR .env
:: ========================================
echo.
echo %A%Resguardando configuracion local (.env)...%N%
if exist "%CD%\backend\.env" (
    copy /Y "%CD%\backend\.env" "%ENV_BACKUP%" >nul 2>&1
    if !errorlevel! equ 0 (
        echo %V%  [OK] .env respaldado%N%
    ) else (
        echo %R%[ERROR] No se pudo respaldar .env%N%
        pause
        exit /b 1
    )
)

:: ========================================
:: DESCARGAR ZIP
:: ========================================
echo.
echo %A%Descargando codigo desde GitHub...%N%

:: Metodo 1: PowerShell (Win 8/10/11)
echo %A%  Metodo 1: PowerShell%N%
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $wc = New-Object System.Net.WebClient; $wc.DownloadFile('%REPO_URL%', '%ZIP_FILE%'); Write-Host 'OK' } catch { Write-Host 'ERROR'; exit 1 }" > "%TEMP%\finandex_dl.txt" 2>&1
set /p "DL_OK=" < "%TEMP%\finandex_dl.txt"

if "!DL_OK!"=="OK" (
    echo %V%    [OK] Descarga completada%N%
    goto :DOWNLOAD_OK
)

:: Metodo 2: certutil (Win 7/8/10)
echo %A%  Metodo 2: certutil%N%
certutil -urlcache -split -f "%REPO_URL%" "%ZIP_FILE%" >nul 2>&1
if !errorlevel! equ 0 (
    echo %V%    [OK] Descarga completada (certutil)%N%
    goto :DOWNLOAD_OK
)

:: Metodo 3: bitsadmin (Win 7/8/10)
echo %A%  Metodo 3: bitsadmin%N%
bitsadmin /transfer "FinandexUpdate" /download /priority high "%REPO_URL%" "%ZIP_FILE%" >nul 2>&1
if !errorlevel! equ 0 (
    echo %V%    [OK] Descarga completada (bitsadmin)%N%
    goto :DOWNLOAD_OK
)

echo %R%[ERROR] No se pudo descargar el archivo%N%
echo %A%Intente descargar manualmente desde:%N%
echo %A%%REPO_URL%%N%
echo %A%Luego extraiga los archivos a %CD%%N%
del "%TEMP%\finandex_dl.txt" >nul 2>&1
if exist "%ZIP_FILE%" del "%ZIP_FILE%" >nul 2>&1
pause
exit /b 1

:DOWNLOAD_OK
del "%TEMP%\finandex_dl.txt" >nul 2>&1

:: Verificar tamaño del ZIP
for %%A in ("%ZIP_FILE%") do set "ZIP_SIZE=%%~zA"
if !ZIP_SIZE! lss 1000 (
    echo %R%[ERROR] Archivo ZIP corrupto o demasiado pequeno (!ZIP_SIZE! bytes)%N%
    del "%ZIP_FILE%" >nul 2>&1
    pause
    exit /b 1
)
echo %V%  Tamanio: !ZIP_SIZE! bytes%N%

:: ========================================
:: EXTRAER ZIP
:: ========================================
echo.
echo %A%Extrayendo archivos...%N%

if exist "%EXTRACT_DIR%" rmdir /s /q "%EXTRACT_DIR%" >nul 2>&1
mkdir "%EXTRACT_DIR%" >nul 2>&1

:: Metodo 1: Expand-Archive (PowerShell 5+)
echo %A%  Metodo 1: PowerShell Expand-Archive%N%
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Expand-Archive -Path '%ZIP_FILE%' -DestinationPath '%EXTRACT_DIR%' -Force; Write-Host 'OK' } catch { Write-Host 'ERROR' }" > "%TEMP%\finandex_extract.txt" 2>&1
set /p "EX_OK=" < "%TEMP%\finandex_extract.txt"
del "%TEMP%\finandex_extract.txt" >nul 2>&1

if not "!EX_OK!"=="OK" (
    :: Metodo 2: tar (Windows 10+ build 17063)
    echo %A%  Metodo 2: tar%N%
    where tar >nul 2>&1
    if !errorlevel! equ 0 (
        tar -xf "%ZIP_FILE%" -C "%EXTRACT_DIR%" >nul 2>&1
        if !errorlevel! neq 0 (
            echo %R%[ERROR] No se pudo extraer el archivo ZIP%N%
            del "%ZIP_FILE%" >nul 2>&1
            rmdir /s /q "%EXTRACT_DIR%" >nul 2>&1
            pause
            exit /b 1
        )
        echo %V%    [OK] Extraccion completada (tar)%N%
    ) else (
        echo %R%[ERROR] No se pudo extraer el archivo ZIP%N%
        echo %A%Extraiga manualmente %ZIP_FILE% en %CD%%N%
        pause
        exit /b 1
    )
) else (
    echo %V%    [OK] Extraccion completada (PowerShell)%N%
)

:: Encontrar carpeta raiz del proyecto extraido
set "EXTRACTED_ROOT=%EXTRACT_DIR%"
for /d %%D in ("%EXTRACT_DIR%\*") do (
    if exist "%%D\backend\package.json" (
        set "EXTRACTED_ROOT=%%D"
        goto :FOUND_ROOT
    )
)
:FOUND_ROOT
echo %V%  Raiz del paquete: !EXTRACTED_ROOT!%N%

:: ========================================
:: COPIAR ARCHIVOS NUEVOS
:: ========================================
echo.
echo %A%Instalando archivos nuevos...%N%

:: ACTUALIZAR.bat (nuevo)
if not exist "%CD%\ACTUALIZAR.bat" (
    if exist "!EXTRACTED_ROOT!\ACTUALIZAR.bat" (
        copy /Y "!EXTRACTED_ROOT!\ACTUALIZAR.bat" "%CD%\ACTUALIZAR.bat" >nul 2>&1
        echo %V%  [OK] ACTUALIZAR.bat creado%N%
    )
) else (
    echo %A%  [AVISO] ACTUALIZAR.bat ya existe, no se sobrescribe%N%
)

:: GUIA_ACTUALIZACION_PC_REMOTA.txt (nuevo)
if not exist "%CD%\GUIA_ACTUALIZACION_PC_REMOTA.txt" (
    if exist "!EXTRACTED_ROOT!\GUIA_ACTUALIZACION_PC_REMOTA.txt" (
        copy /Y "!EXTRACTED_ROOT!\GUIA_ACTUALIZACION_PC_REMOTA.txt" "%CD%\GUIA_ACTUALIZACION_PC_REMOTA.txt" >nul 2>&1
        echo %V%  [OK] GUIA_ACTUALIZACION_PC_REMOTA.txt creado%N%
    )
)

:: .gitignore (nuevo)
if not exist "%CD%\.gitignore" (
    if exist "!EXTRACTED_ROOT!\.gitignore" (
        copy /Y "!EXTRACTED_ROOT!\.gitignore" "%CD%\.gitignore" >nul 2>&1
        echo %V%  [OK] .gitignore creado%N%
    )
)

:: ========================================
:: ACTUALIZAR SCRIPTS EXISTENTES
:: ========================================
echo.
echo %A%Actualizando scripts batch...%N%
for %%S in (INICIAR.bat INSTALAR.bat DETENER.bat CONFIGURA_ARRANQUE_AUTOMATICO.bat CREA_BACKUP.bat RESTAURAR_BACKUP.bat PROGRAMAR_RESPALDO_DIARIO.bat REPARAR_RED.bat) do (
    if exist "!EXTRACTED_ROOT!\%%S" (
        copy /Y "!EXTRACTED_ROOT!\%%S" "%CD%\%%S" >nul 2>&1
        echo %V%  [OK] %%S actualizado%N%
    )
)

:: ========================================
:: ACTUALIZAR DOCUMENTACION
:: ========================================
echo.
echo %A%Actualizando documentacion...%N%
for %%D in (GUIA_CAMBIOS_Y_MANUAL_INSTALACION.txt GUIA_DE_INSTALACION_Y_USO.txt GUIA_ACTUALIZACION_PC_REMOTA.txt README.md) do (
    if exist "!EXTRACTED_ROOT!\%%D" (
        copy /Y "!EXTRACTED_ROOT!\%%D" "%CD%\%%D" >nul 2>&1
        echo %V%  [OK] %%D actualizado%N%
    )
)

:: ========================================
:: RESTAURAR .env
:: ========================================
echo.
echo %A%Restaurando configuracion local (.env)...%N%
if exist "%ENV_BACKUP%" (
    copy /Y "%ENV_BACKUP%" "%CD%\backend\.env" >nul 2>&1
    del "%ENV_BACKUP%" >nul 2>&1
    echo %V%  [OK] .env restaurado%N%
)

:: ========================================
:: LIMPIEZA
:: ========================================
echo.
echo %A%Limpiando archivos temporales...%N%
del "%ZIP_FILE%" >nul 2>&1
rmdir /s /q "%EXTRACT_DIR%" >nul 2>&1
echo %V%  [OK] Archivos temporales eliminados%N%

:: ========================================
:: RESUMEN FINAL
:: ========================================
echo.
echo %B%============================================%N%
echo %B%  ACTUALIZACION INICIAL COMPLETADA%N%
echo %B%============================================%N%
echo.
echo %V%  Archivos creados:%N%
echo %V%    - ACTUALIZAR.bat%N%
echo %V%    - GUIA_ACTUALIZACION_PC_REMOTA.txt%N%
echo %V%    - .gitignore%N%
echo.
echo %V%  Scripts actualizados:%N%
echo %V%    - INICIAR.bat, INSTALAR.bat, DETENER.bat,%N%
echo %V%    - CONFIGURA_ARRANQUE_AUTOMATICO.bat, etc.%N%
echo.
echo %V%  Documentacion actualizada:%N%
echo.
echo %B%  PARA FUTURAS ACTUALIZACIONES:%N%
echo %B%  Solo ejecute ACTUALIZAR.bat%N%
echo %B%  (no necesita este script otra vez)%N%
echo.
pause
