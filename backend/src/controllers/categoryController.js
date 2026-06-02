import prisma from '../config/database.js';
import { logger } from '../utils/logger.js';

export const getAllCategories = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(categories);
  } catch (error) {
    logger.error('Error al obtener categorías:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        products: {
          where: { active: true },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!category) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    res.json(category);
  } catch (error) {
    logger.error('Error al obtener categoría:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    const existingCategory = await prisma.category.findFirst({
      where: { name },
    });

    if (existingCategory) {
      return res.status(400).json({ 
        error: 'Ya existe una categoría con este nombre' 
      });
    }

     const category = await prisma.category.create({
       data: { name, description },
     });

     // Registrar en historial de transacciones
     await prisma.transactionHistory.create({
       data: {
         type: 'CREAR_CATEGORIA',
         description: `Categoría creada: ${category.name}`,
         amount: 0,
         categoryName: 'Categorías',
         userName: req.user.name || req.user.username,
         details: { 
           createdCategoryId: category.id,
           createdCategoryName: category.name,
           description: category.description
         }
       }
     });

     res.status(201).json({ 
       message: 'Categoría creada exitosamente',
       category 
     });
  } catch (error) {
    logger.error('Error al crear categoría:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (name) {
      const existingCategory = await prisma.category.findFirst({
        where: {
          name,
          id: { not: id },
        },
      });

      if (existingCategory) {
        return res.status(400).json({ 
          error: 'Ya existe una categoría con este nombre' 
        });
      }
    }

     const category = await prisma.category.update({
       where: { id },
       data: { name, description },
     });

     // Registrar en historial de transacciones
     await prisma.transactionHistory.create({
       data: {
         type: 'ACTUALIZAR_CATEGORIA',
         description: `Categoría actualizada: ${category.name}`,
         amount: 0,
         categoryName: 'Categorías',
         userName: req.user.name || req.user.username,
         details: { 
           updatedCategoryId: category.id,
           updatedCategoryName: category.name,
           changes: { 
             name: !!name,
             description: !!description
           }
         }
       }
     });

     res.json({ 
       message: 'Categoría actualizada exitosamente',
       category 
     });
  } catch (error) {
    logger.error('Error al actualizar categoría:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const productsWithCategory = await prisma.product.count({
      where: { categoryId: id },
    });

    if (productsWithCategory > 0) {
      return res.status(400).json({ 
        error: 'No se puede eliminar la categoría, tiene productos asociados' 
      });
    }

     await prisma.category.delete({
       where: { id },
     });

     // Registrar en historial de transacciones
     await prisma.transactionHistory.create({
       data: {
         type: 'ELIMINAR_CATEGORIA',
         description: `Categoría eliminada: ${id}`, // We don't have the name after deletion
         amount: 0,
         categoryName: 'Categorías',
         userName: req.user.name || req.user.username,
         details: { 
           deletedCategoryId: id
         }
       }
     });

     res.json({ message: 'Categoría eliminada exitosamente' });
  } catch (error) {
    logger.error('Error al eliminar categoría:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
