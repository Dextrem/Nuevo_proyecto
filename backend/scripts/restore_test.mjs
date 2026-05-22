import fs from 'fs';
import path from 'path';
import { restoreBackup } from '../src/services/backupService.js';

async function main() {
  try {
    console.log('Iniciando prueba de restauración (esto modificará la base de datos).');

    const backupFile = path.resolve(process.cwd(), 'backend', 'backups', 'auto_backup_2026-04-22_1776886589405.json');
    if (!fs.existsSync(backupFile)) {
      console.error('Archivo de backup no encontrado:', backupFile);
      process.exit(1);
    }

    const raw = fs.readFileSync(backupFile, 'utf8');
    const backup = JSON.parse(raw);

    const result = await restoreBackup(backup);
    console.log('Resultado de la restauración:', result);
    process.exit(0);
  } catch (err) {
    console.error('Error en prueba de restauración:', err);
    process.exit(1);
  }
}

main();
