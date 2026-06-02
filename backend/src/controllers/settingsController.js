import prisma from '../config/database.js';
import { logger } from '../utils/logger.js';

export const getSettings = async (req, res) => {
  try {
    let settings = await prisma.settings.findFirst();

    if (!settings) {
      settings = await prisma.settings.create({
        data: {},
      });
    }

    res.json(settings);
  } catch (error) {
    logger.error('Error al obtener configuración:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const updateSettings = async (req, res) => {
  try {
    let settings = await prisma.settings.findFirst();

    if (!settings) {
      settings = await prisma.settings.create({
        data: req.body,
      });
    } else {
      settings = await prisma.settings.update({
        where: { id: settings.id },
        data: req.body,
      });
    }

    res.json({ 
      message: 'Configuración actualizada exitosamente',
      settings 
    });
  } catch (error) {
    logger.error('Error al actualizar configuración:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const resetSettings = async (req, res) => {
  try {
    await prisma.settings.deleteMany();

    const settings = await prisma.settings.create({
      data: {},
    });

    res.json({ 
      message: 'Configuración reiniciada a valores por defecto',
      settings 
    });
  } catch (error) {
    logger.error('Error al reiniciar configuración:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
