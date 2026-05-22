# FINANDEX - Backup Automático para Windows
# Ejecutar con Task Scheduler:
# 1. Abrir "Programador de Tareas" (Task Scheduler)
# 2. Crear tarea básica
# 3. Nombre: FINANDEX Daily Backup
# 4. Disparador: Diariamente a las 2:00 AM
# 5. Acción: Iniciar un programa
# 6. Programa: node
# 7. Argumentos: scripts/scheduledBackup.js
# 8. Iniciar en: ruta_completa_al_proyecto/backend

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir

Write-Host "=========================================="
Write-Host "FINANDEX - Backup Automático"
Write-Host "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "=========================================="

Set-Location $ProjectDir

try {
    node scripts/scheduledBackup.js
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Backup completado exitosamente"
        exit 0
    } else {
        Write-Host "✗ Error en backup"
        exit 1
    }
} catch {
    Write-Host "✗ Error: $_"
    exit 1
}
