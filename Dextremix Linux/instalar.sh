#!/bin/bash

# Dextremix Finance - Instalador para Linux
# Asegurar colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}==================================================${NC}"
echo -e "${CYAN}        DEXTREMIX FINANCE - INSTALADOR LINUX      ${NC}"
echo -e "${CYAN}==================================================${NC}"
echo ""

# 1. Verificar Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR] Node.js no está instalado.${NC}"
    echo -e "${YELLOW}Por favor, instálalo con: sudo apt install nodejs npm (en Debian/Ubuntu)${NC}"
    exit 1
fi
echo -e "${GREEN}[OK] Node.js detectado: $(node -v)${NC}"

# 2. Verificar PostgreSQL
if ! command -v psql &> /dev/null; then
    echo -e "${RED}[ERROR] PostgreSQL no está instalado.${NC}"
    echo -e "${YELLOW}Por favor, instálalo con: sudo apt install postgresql postgresql-contrib${NC}"
    exit 1
fi
echo -e "${GREEN}[OK] PostgreSQL detectado.${NC}"

# 3. Crear base de datos
echo -e "${YELLOW}Configurando base de datos PostgreSQL...${NC}"
read -p "Usuario de PostgreSQL [postgres]: " DB_USER
DB_USER=${DB_USER:-postgres}
read -sp "Contraseña de PostgreSQL: " DB_PASS
echo ""
read -p "Host de PostgreSQL [127.0.0.1]: " DB_HOST
DB_HOST=${DB_HOST:-127.0.0.1}
read -p "Puerto de PostgreSQL [5432]: " DB_PORT
DB_PORT=${DB_PORT:-5432}
read -p "Nombre de la Base de Datos [finandex]: " DB_NAME
DB_NAME=${DB_NAME:-finandex}

export PGPASSWORD=$DB_PASS
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "SELECT 1;" &> /dev/null
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] No se pudo conectar a PostgreSQL. Revisa tus credenciales.${NC}"
    exit 1
fi

# Crear base de datos si no existe
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1
if [ $? -ne 0 ]; then
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "CREATE DATABASE $DB_NAME;"
    echo -e "${GREEN}[OK] Base de datos '$DB_NAME' creada.${NC}"
else
    echo -e "${GREEN}[OK] La base de datos '$DB_NAME' ya existe.${NC}"
fi

# 4. Generar .env del backend
echo -e "${YELLOW}Generando archivo .env...${NC}"
JWT1=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT2=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

cat <<EOF > ../backend/.env
PORT=80
NODE_ENV=production

DATABASE_URL="postgresql://$DB_USER:$DB_PASS@$DB_HOST:$DB_PORT/$DB_NAME?schema=public"

JWT_SECRET=$JWT1
JWT_REFRESH_SECRET=$JWT2
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

CORS_ORIGIN=http://dextremix.local,http://localhost

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=correo@ejemplo.com
SMTP_PASS=password
SMTP_FROM="Finandex <noreply@finandex.local>"
NOTIFICATION_EMAILS=admin@finandex.local

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
RATE_LIMIT_LOGIN_MAX=5
EOF

echo -e "${GREEN}[OK] Archivo .env generado.${NC}"

# 5. Instalar dependencias del Backend y generar Prisma
echo -e "${YELLOW}Instalando dependencias del Backend...${NC}"
cd ../backend
npm install
npx prisma generate
npx prisma db push
npm run db:seed

# 6. Instalar dependencias del Frontend y compilar
echo -e "${YELLOW}Instalando dependencias del Frontend y compilando...${NC}"
cd ../frontend
npm install
npm run build

# 7. Configurar hosts local
echo ""
echo -e "${YELLOW}Configurando dominio local dextremix.local en /etc/hosts...${NC}"
if grep -q "dextremix.local" /etc/hosts; then
    echo -e "${GREEN}[OK] El dominio dextremix.local ya está configurado.${NC}"
else
    echo -e "${CYAN}Se requieren permisos de superusuario (sudo) para modificar /etc/hosts:${NC}"
    echo "127.0.0.1 dextremix.local" | sudo tee -a /etc/hosts > /dev/null
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}[OK] Dominio dextremix.local configurado correctamente.${NC}"
    else
        echo -e "${RED}[ADVERTENCIA] No se pudo escribir en /etc/hosts. Agrégalo manualmente:${NC}"
        echo "127.0.0.1 dextremix.local"
    fi
fi

echo ""
echo -e "${GREEN}==================================================${NC}"
echo -e "${GREEN}      INSTALACIÓN COMPLETADA CON ÉXITO EN LINUX    ${NC}"
echo -e "${GREEN}==================================================${NC}"
echo "Para iniciar el sistema ejecuta: ./iniciar.sh"
