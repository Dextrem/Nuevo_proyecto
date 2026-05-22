#!/bin/bash

# Dextremix Finance - Respaldo de Datos para Linux
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}==================================================${NC}"
echo -e "${CYAN}          GENERANDO RESPALDO (LINUX)              ${NC}"
echo -e "${CYAN}==================================================${NC}"
echo ""

BACKUP_DIR="../backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="respaldo_${TIMESTAMP}.sql"

echo -e "${YELLOW}Exportando base de datos finandex...${NC}"
read -p "Usuario de PostgreSQL [postgres]: " DB_USER
DB_USER=${DB_USER:-postgres}
read -sp "Contraseña de PostgreSQL: " DB_PASS
echo ""

export PGPASSWORD=$DB_PASS
pg_dump -U $DB_USER -h 127.0.0.1 -p 5432 finandex > "${BACKUP_DIR}/${FILENAME}"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}[OK] Respaldo completado exitosamente.${NC}"
    echo -e "Archivo guardado en: ${CYAN}${BACKUP_DIR}/${FILENAME}${NC}"
else
    echo ""
    echo -e "${RED}[ERROR] No se pudo generar el respaldo.${NC}"
    echo -e "${YELLOW}Asegúrate de que la base de datos esté activa y las credenciales sean correctas.${NC}"
fi
