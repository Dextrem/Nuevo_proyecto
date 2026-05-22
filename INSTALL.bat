@echo off
setlocal enabledelayedexpansion

echo ========================================
echo  FINANDEX - Instalador del Sistema
echo ========================================
echo.

set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

echo [1/7] Verificando requisitos del sistema...
echo.

REM Verificar Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js no esta instalado
    echo.
    echo Por favor instala Node.js desde:
    echo   https://nodejs.org (version 18 o superior)
    echo.
    echo Una vez instalado, ejecuta este script nuevamente.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo   [OK] Node.js: !NODE_VERSION!

REM Verificar PostgreSQL
where psql >nul 2>&1
if errorlevel 1 (
    echo [ERROR] PostgreSQL no esta instalado
    echo.
    echo Por favor instala PostgreSQL desde:
    echo   https://www.postgresql.org/download/windows/
    echo.
    echo Durante la instalacion, asegurate de:
    echo   - Instalar el servidor PostgreSQL
    echo   - Establecer una contrasena para el usuario 'postgres'
    echo   - Asegurar que el servicio este ejecutandose
    echo.
    pause
    exit /b 1
)

echo   [OK] PostgreSQL instalado
echo.

echo [2/7] Configurando base de datos PostgreSQL...
echo.

echo   Ingresa los datos de conexion a PostgreSQL:
echo   (Presiona Enter para usar valores por defecto)
echo.

set /p DB_HOST="Host (localhost): "
if "!DB_HOST!"=="" set DB_HOST=localhost

set /p DB_PORT="Puerto (5432): "
if "!DB_PORT!"=="" set DB_PORT=5432

set /p DB_USER="Usuario (postgres): "
if "!DB_USER!"=="" set DB_USER=postgres

set /p DB_PASS="Contrasena de postgres: "
if "!DB_PASS!"=="" (
    echo [ERROR] La contrasena no puede estar vacia
    pause
    exit /b 1
)

set /p DB_NAME="Nombre BD (finandex): "
if "!DB_NAME!"=="" set DB_NAME=finandex

echo.
echo   Verificando conexion a PostgreSQL...
set PGPASSWORD=!DB_PASS!
psql -h !DB_HOST! -p !DB_PORT! -U !DB_USER! -c "SELECT version();" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] No se pudo conectar a PostgreSQL
    echo Verifica que el servicio este ejecutandose
    echo y que las credenciales sean correctas
    pause
    exit /b 1
)
echo   [OK] Conexion exitosa

echo.
echo   Creando base de datos "!DB_NAME!"...
psql -h !DB_HOST! -p !DB_PORT! -U !DB_USER! -tc "SELECT 1 FROM pg_database WHERE datname = '!DB_NAME!'" | findstr /C:"1" >nul
if errorlevel 1 (
    psql -h !DB_HOST! -p !DB_PORT! -U !DB_USER! -c "CREATE DATABASE !DB_NAME!;"
    echo   [OK] Base de datos creada
) else (
    echo   [OK] La base de datos ya existe
)

echo.
echo [3/7] Configurando archivo .env del backend...

set "JWT_SECRET=finandex_!RANDOM!!RANDOM!!RANDOM!"
set "JWT_REFRESH_SECRET=finandex_refresh_!RANDOM!!RANDOM!!RANDOM!"

(
    echo PORT=80
    echo NODE_ENV=development
    echo.
    echo DATABASE_URL="postgresql://!DB_USER!:!DB_PASS!@!DB_HOST!:!DB_PORT!/!DB_NAME!"
    echo.
    echo JWT_SECRET=!JWT_SECRET!
    echo JWT_REFRESH_SECRET=!JWT_REFRESH_SECRET!
    echo JWT_EXPIRES_IN=15m
    echo JWT_REFRESH_EXPIRES_IN=7d
    echo.
    echo CORS_ORIGIN=http://dextremix.local,http://localhost
    echo.
    echo SMTP_HOST=smtp.example.com
    echo SMTP_PORT=587
    echo SMTP_USER=user@example.com
    echo SMTP_PASS=supersecret
    echo SMTP_FROM="Finandex ^<noreply@example.com^>"
    echo NOTIFICATION_EMAILS=finance@example.com
    echo.
    echo RATE_LIMIT_WINDOW_MS=900000
    echo RATE_LIMIT_MAX_REQUESTS=1000
    echo RATE_LIMIT_LOGIN_MAX=5
) > "%PROJECT_DIR%backend\.env"

echo   [OK] Archivo .env creado

echo.
echo [4/7] Instalando dependencias del backend...
echo.

cd "%PROJECT_DIR%backend"
call npm install 2>&1
if errorlevel 1 (
    echo [ERROR] Error al instalar dependencias del backend
    pause
    exit /b 1
)
echo   [OK] Dependencias instaladas
cd ..

echo.
echo [5/7] Configurando base de datos...
echo.

cd "%PROJECT_DIR%backend"
echo   Generando cliente Prisma...
call npx prisma generate 2>&1
if errorlevel 1 (
    echo [ERROR] Error al generar cliente Prisma
    pause
    exit /b 1
)
echo   [OK] Cliente Prisma generado

echo   Creando tablas...
call npx prisma db push 2>&1
if errorlevel 1 (
    echo [ERROR] Error al crear tablas
    pause
    exit /b 1
)
echo   [OK] Tablas creadas

echo   Poblando datos iniciales...
call npm run db:seed 2>&1
if errorlevel 1 (
    echo [ERROR] Error al poblar datos
    pause
    exit /b 1
)
echo   [OK] Datos iniciales creados
cd ..

echo.
echo [6/7] Instalando dependencias del frontend...
echo.

cd "%PROJECT_DIR%frontend"
call npm install 2>&1
if errorlevel 1 (
    echo [ERROR] Error al instalar dependencias del frontend
    pause
    exit /b 1
)
echo   [OK] Dependencias instaladas
cd ..

echo.
echo [7/7] Compilando frontend...
echo.

cd "%PROJECT_DIR%frontend"
call npm run build 2>&1
if errorlevel 1 (
    echo [ERROR] Error al compilar frontend
    pause
    exit /b 1
)
echo   [OK] Frontend compilado
cd ..

echo.
echo ========================================
echo  FINANDEX - Instalacion completada
echo ========================================
echo.
echo   Acceso:   http://dextremix.local
echo.
echo   Usuario: admin
echo   Contrasena: admin123
echo.
echo ========================================
echo.
echo Para iniciar el sistema, ejecuta:
echo   INICIAR.bat
echo.
pause
