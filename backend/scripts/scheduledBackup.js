import { createBackup } from '../src/services/backupService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backupDir = path.join(__dirname, '../backups');

async function runScheduledBackup() {
  try {
    console.log('Iniciando backup automático...');

    try {
      await fs.promises.access(backupDir);
    } catch {
      await fs.promises.mkdir(backupDir, { recursive: true });
    }

    const backup = await createBackup();
    const filename = `auto_backup_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;
    const filepath = path.join(backupDir, filename);

    await fs.promises.writeFile(filepath, JSON.stringify(backup, null, 2));
    console.log(`✓ Backup creado: ${filename}`);

    const files = await fs.promises.readdir(backupDir);
    const backupFiles = files
      .filter(f => f.startsWith('auto_backup_'))
      .sort()
      .reverse();

    const maxBackups = 30;
    if (backupFiles.length > maxBackups) {
      const toDelete = backupFiles.slice(maxBackups);
      for (const file of toDelete) {
        await fs.promises.unlink(path.join(backupDir, file));
        console.log(`  - Eliminado backup antiguo: ${file}`);
      }
    }

    console.log(`✓ Backup automático completado`);
    console.log(`  Total de backups: ${backupFiles.length}`);
    console.log(`  Backups保存在: ${backupDir}`);
  } catch (error) {
    console.error('Error en backup automático:', error);
    process.exit(1);
  }
}

runScheduledBackup();
