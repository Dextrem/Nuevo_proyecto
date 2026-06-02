import { createBackup, restoreBackup } from '../services/backupService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const exportBackup = async (req, res) => {
  try {
    const backup = await createBackup();
    
    const filename = `dextremix_backup_${new Date().toISOString().split('T')[0]}.json`;
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    res.json(backup);
  } catch (error) {
    logger.error('Error exporting backup:', { error });
    res.status(500).json({ error: 'Error al exportar backup' });
  }
};

export const importBackup = async (req, res) => {
  try {
    const backupData = req.body;
    
    if (!backupData || !backupData.data) {
      return res.status(400).json({ error: 'Archivo de backup inválido' });
    }

    if (backupData.version !== '1.0') {
      return res.status(400).json({ 
        error: 'Versión de backup no compatible' 
      });
    }

    await restoreBackup(backupData);
    
    res.json({ 
      success: true, 
      message: 'Backup restaurado exitosamente. Por favor, inicia sesión nuevamente.' 
    });
  } catch (error) {
    logger.error('Error importing backup:', { error });
    res.status(500).json({ 
      error: error.message || 'Error al importar backup' 
    });
  }
};

export const scheduleBackup = async (req, res) => {
  try {
    const settings = await import('../config/database.js').then(m => m.default);
    const fsPromises = fs.promises;
    const backupDir = path.join(__dirname, '../../backups');
    
    try {
      await fsPromises.access(backupDir);
    } catch {
      await fsPromises.mkdir(backupDir, { recursive: true });
    }

    const backup = await createBackup();
    const filename = `auto_backup_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;
    const filepath = path.join(backupDir, filename);
    
    await fsPromises.writeFile(filepath, JSON.stringify(backup, null, 2));
    
    const files = await fsPromises.readdir(backupDir);
    const backupFiles = files
      .filter(f => f.startsWith('auto_backup_'))
      .sort()
      .reverse();
    
    const maxBackups = 30;
    if (backupFiles.length > maxBackups) {
      const toDelete = backupFiles.slice(maxBackups);
      for (const file of toDelete) {
        await fsPromises.unlink(path.join(backupDir, file));
      }
    }
    
    res.json({ 
      success: true, 
      message: 'Backup automático completado',
      filename 
    });
  } catch (error) {
    logger.error('Error in scheduled backup:', { error });
    res.status(500).json({ error: 'Error en backup automático' });
  }
};
