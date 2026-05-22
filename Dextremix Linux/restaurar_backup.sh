#!/bin/bash

# Dextremix Finance - Restauración de Datos para Linux
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${RED}==================================================${NC}"
echo -e "${RED}         RESTAURACIÓN DE RESPALDO (LINUX)         ${NC}"
echo -e "${RED}==================================================${NC}"
echo ""
echo -e "${YELLOW}ADVERTENCIA:${NC} Este proceso borrará los datos actuales y los"
echo -e "reemplazará con el contenido del respaldo seleccionado."
echo ""

BACKUP_DIR="../backups"

if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${RED}[ERROR] No se encontró la carpeta de respaldos en $BACKUP_DIR.${NC}"
    exit 1
fi

# Listar respaldos
echo -e "${CYAN}Respaldos disponibles en /backups:${NC}"
echo ""

declare -A files
count=0
for f in "$BACKUP_DIR"/*.sql; do
    [ -e "$f" ] || continue
    count=$((count+1))
    filename=$(basename "$f")
    files[$count]=$filename
    echo "  [$count] $filename"
done

if [ $count -eq 0 ]; then
    echo -e "${YELLOW}No hay archivos .sql en la carpeta /backups.${NC}"
    exit 1
fi

echo ""
read -p "Selecciona el número del respaldo a restaurar (o 'q' para salir): " choice

if [ "$choice" = "q" ] || [ -z "$choice" ]; then
    exit 0
fi

SELECTED_FILE=${files[$choice]}

if [ -z "$SELECTED_FILE" ]; then
    echo -e "${RED}[ERROR] Selección inválida.${NC}"
    exit 1
fi

echo ""
echo -e "Has seleccionado: ${CYAN}$SELECTED_FILE${NC}"
read -p "¿ESTÁS SEGURO? Escribe 'SI' para confirmar: " confirm

if [ "$confirm" != "SI" ]; then
    echo -e "${YELLOW}Restauración cancelada.${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}Limpiando y restaurando base de datos...${NC}"
read -p "Usuario de PostgreSQL [postgres]: " DB_USER
DB_USER=${DB_USER:-postgres}
read -sp "Contraseña de PostgreSQL: " DB_PASS
echo ""

export PGPASSWORD=$DB_PASS

# Borrar y recrear BD
psql -U $DB_USER -h 127.0.0.1 -p 5432 -c "DROP DATABASE IF EXISTS finandex WITH (FORCE);"
psql -U $DB_USER -h 127.0.0.1 -p 5432 -c "CREATE DATABASE finandex;"

# Restaurar
psql -U $DB_USER -h 127.0.0.1 -p 5432 finandex < "${BACKUP_DIR}/${SELECTED_FILE}"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}[OK] Datos restaurados exitosamente.${NC}"
    echo -e "${YELLOW}Reinicia el sistema para aplicar los cambios.${NC}"
else
    echo ""
    echo -e "${RED}[ERROR] Hubo un fallo durante la restauración.${NC}"
fi
