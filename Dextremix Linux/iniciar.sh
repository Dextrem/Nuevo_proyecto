#!/bin/bash

# Dextremix Finance - Iniciador para Linux
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}==================================================${NC}"
echo -e "${CYAN}       INICIANDO SISTEMA - DEXTREMIX FINANCE      ${NC}"
echo -e "${CYAN}==================================================${NC}"
echo ""

# Leer puerto desde .env
ENV_PORT=80
if [ -f ../backend/.env ]; then
    ENV_PORT=$(grep -E "^PORT=" ../backend/.env | cut -d= -f2)
fi
ENV_PORT=${ENV_PORT:-80}

# Detener ejecuciones previas de Node en ese puerto
if [ "$ENV_PORT" != "80" ]; then
    PID=$(lsof -t -i:$ENV_PORT)
    if [ -n "$PID" ]; then
        echo -e "${YELLOW}Deteniendo proceso anterior en puerto $ENV_PORT...${NC}"
        kill -9 $PID
    fi
fi

# Arrancar backend
echo -e "${YELLOW}Iniciando servidor web...${NC}"
cd ../backend

# Si el puerto es 80, requiere sudo para ejecutarse
if [ "$ENV_PORT" -eq 80 ]; then
    echo -e "${CYAN}Nota: El puerto 80 requiere privilegios de root (sudo)${NC}"
    sudo -E node src/server.js > ../logs/app.log 2>&1 &
    BACKEND_PID=$!
else
    node src/server.js > ../logs/app.log 2>&1 &
    BACKEND_PID=$!
fi

# Guardar PID
echo $BACKEND_PID > /tmp/finandex_backend.pid

# Health check
READY=0
echo -e "${YELLOW}Verificando estado del servidor...${NC}"
for i in {1..12}; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:$ENV_PORT/api/health)
    if [ "$STATUS" -eq 200 ]; then
        READY=1
        break
    fi
    sleep 2
done

if [ $READY -eq 1 ]; then
    echo -e "${GREEN}[OK] Servidor listo.${NC}"
    echo ""
    echo -e "${GREEN}==================================================${NC}"
    echo -e "${GREEN}        SISTEMA LISTO - DEXTREMIX FINANCE         ${NC}"
    echo -e "${GREEN}==================================================${NC}"
    echo -e " Acceso:   ${CYAN}http://dextremix.local${NC}"
    echo -e " Usuario:  admin"
    echo -e " Clave:    admin"
    echo ""
    
    # Intentar abrir el navegador (según interfaz gráfica disponible)
    if command -v xdg-open &> /dev/null; then
        xdg-open "http://dextremix.local" &> /dev/null &
    elif command -v open &> /dev/null; then
        open "http://dextremix.local" &> /dev/null &
    fi
else
    echo -e "${RED}[ERROR] El servidor no respondió a tiempo.${NC}"
    echo "Revisa el archivo de logs en: logs/app.log"
    exit 1
fi

echo -e "${YELLOW}Presiona CTRL+C para detener el sistema.${NC}"

# Manejar apagado ordenado al presionar CTRL+C
cleanup() {
    echo ""
    echo -e "${YELLOW}Apagando servidor web...${NC}"
    if [ -f /tmp/finandex_backend.pid ]; then
        PID=$(cat /tmp/finandex_backend.pid)
        # Si se usó sudo, matar con sudo
        if [ "$ENV_PORT" -eq 80 ]; then
            sudo kill -9 $PID &> /dev/null
        else
            kill -9 $PID &> /dev/null
        fi
        rm /tmp/finandex_backend.pid
    fi
    echo -e "${GREEN}[OK] Servidor detenido.${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Mantener corriendo para capturar señal de apagado
while true; do
    sleep 1
done
