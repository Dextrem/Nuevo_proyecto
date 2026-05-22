#!/bin/bash

# FINANDEX - Script de Backup Automático Diario
# Agregar al crontab (Linux/Mac):
# 0 2 * * * /path/to/financial_app/backend/scripts/run_backup.sh
# 
# Para Windows, usar el Task Scheduler con:
# node scripts/scheduledBackup.js

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "=========================================="
echo "FINANDEX - Backup Automático"
echo "Fecha: $(date)"
echo "=========================================="

node scripts/scheduledBackup.js

if [ $? -eq 0 ]; then
    echo "✓ Backup completado exitosamente"
else
    echo "✗ Error en backup"
    exit 1
fi
