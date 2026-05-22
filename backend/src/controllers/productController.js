import prisma from '../config/database.js';
import { parsePaginationParams } from '../utils/pagination.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get the current file URL and convert to path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define upload directory
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'products');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export const getAllProducts = async (req, res) => {
  try {
    const { search, categoryId, active, minStock, startDate, endDate } = req.query;
    const { page, limit, skip } = parsePaginationParams(req.query);

    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (active !== undefined) {
      where.active = active === 'true';
    } else {
      where.active = true;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const start = new Date(`${startDate}T00:00:00`);
        if (!Number.isNaN(start.getTime())) {
          where.createdAt.gte = start;
        }
      }
      if (endDate) {
        const end = new Date(`${endDate}T23:59:59`);
        if (!Number.isNaN(end.getTime())) {
          where.createdAt.lte = end;
        }
      }
      if (Object.keys(where.createdAt).length === 0) {
        delete where.createdAt;
      }
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: {
            select: { id: true, name: true },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(product);
  } catch (error) {
    console.error('Error al obtener producto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const createProduct = async (req, res) => {
  try {
    const productData = req.body;

    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') {
      return res.status(403).json({ error: 'No tienes permisos para crear productos' });
    }

    if (!productData.sku || productData.sku === 'AUTO' || productData.sku === '') {
      const lastProduct = await prisma.product.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { sku: true },
      });
      
      let newNumber = 1;
      if (lastProduct?.sku && lastProduct.sku.startsWith('COD')) {
        const numPart = lastProduct.sku.replace('COD', '');
        newNumber = parseInt(numPart, 10) + 1;
      }
      
      productData.sku = `COD${String(newNumber).padStart(8, '0')}`;
    }

    if (productData.barcode === '') {
      delete productData.barcode;
    }

    const existingProduct = await prisma.product.findFirst({
      where: {
        OR: [
          { sku: productData.sku },
          ...(productData.barcode ? [{ barcode: productData.barcode }] : []),
        ],
      },
    });

    if (existingProduct) {
      return res.status(400).json({ 
        error: 'Ya existe un producto con este SKU o código de barras' 
      });
    }

     const product = await prisma.product.create({
        data: productData,
        include: {
          category: {
            select: { id: true, name: true },
          },
        },
      });

     // Registrar movimiento de inventario inicial si el producto tiene stock
     if (product.stock > 0) {
       await prisma.inventoryMovement.create({
         data: {
           productId: product.id,
           type: 'IN',
           quantity: product.stock,
           previousStock: 0,
           newStock: product.stock,
           reference: 'CREACION',
           description: 'Inventario inicial por creación de producto',
           userId: req.user.id,
         }
       });
     }

     // Registrar en historial de transacciones
     await prisma.transactionHistory.create({
        data: {
          type: 'CREAR_PRODUCTO',
          description: `Producto creado: ${product.name}`,
          amount: 0,
          categoryName: 'Productos',
          userName: req.user.name || req.user.username,
          details: { 
            createdProductId: product.id,
            createdProductName: product.name,
            sku: product.sku,
            categoryId: product.categoryId,
            categoryName: product.category?.name,
            price: product.price,
            cost: product.cost,
            stock: product.stock
          }
        }
      });

     res.status(201).json({ 
        message: 'Producto creado exitosamente',
        product 
      });
  } catch (error) {
    console.error('Error al crear producto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const productData = req.body;

    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') {
      return res.status(403).json({ error: 'No tienes permisos para modificar productos' });
    }

    if (productData.sku === null) {
      delete productData.sku;
    }

    if (productData.sku || productData.barcode) {
      const existingProduct = await prisma.product.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                productData.sku ? { sku: productData.sku } : {},
                productData.barcode ? { barcode: productData.barcode } : {},
              ],
            },
          ],
        },
      });

      if (existingProduct) {
        return res.status(400).json({ 
          error: 'Ya existe un producto con este SKU o código de barras' 
        });
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: productData,
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    });

    // Registrar en historial de transacciones
    await prisma.transactionHistory.create({
      data: {
        type: 'ACTUALIZAR_PRODUCTO',
        description: `Producto actualizado: ${product.name}`,
        amount: 0,
        categoryName: 'Productos',
        userName: req.user.name || req.user.username,
        details: { 
          updatedProductId: product.id,
          updatedProductName: product.name,
          changes: Object.keys(productData)
        }
      }
    });

    res.json({ 
      message: 'Producto actualizado exitosamente',
      product 
    });
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') {
      return res.status(403).json({ error: 'No tienes permisos para eliminar productos' });
    }

    const product = await prisma.product.update({
      where: { id },
      data: { active: false },
    });

    // Registrar en historial de transacciones
    await prisma.transactionHistory.create({
      data: {
        type: 'ELIMINAR_PRODUCTO',
        description: `Producto desactivado: ${product.name}`,
        amount: 0,
        categoryName: 'Productos',
        userName: req.user.name || req.user.username,
        details: { 
          deactivatedProductId: id,
          deactivatedProductName: product.name
        }
      }
    });

    res.json({ message: 'Producto desactivado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, operation, unitCost, description } = req.body;

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    let newStock;
    const parsedQuantity = parseInt(quantity, 10);
    
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
        return res.status(400).json({ error: 'La cantidad debe ser un número válido mayor a 0' });
    }

    if (operation === 'add') {
      newStock = product.stock + parsedQuantity;
    } else if (operation === 'subtract') {
      newStock = product.stock - parsedQuantity;
      if (newStock < 0) {
        return res.status(400).json({ 
          error: 'Stock insuficiente' 
        });
      }
    } else {
      return res.status(400).json({ 
        error: 'Operación no válida' 
      });
    }

    const updateData = { stock: newStock };

    // Si es una entrada y se proporciona unitCost, recalcular costo promedio ponderado
    if (operation === 'add' && unitCost !== undefined && unitCost !== null) {
      const parsedCost = parseFloat(unitCost);
      if (!isNaN(parsedCost) && parsedCost >= 0) {
        const weightedAvgCost = product.stock > 0
          ? ((product.stock * product.cost) + (parsedQuantity * parsedCost)) / newStock
          : parsedCost;
        updateData.cost = Math.round(weightedAvgCost * 100) / 100;
      }
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: updateData,
    });

    // Registrar movimiento de inventario (kárdex)
    await prisma.inventoryMovement.create({
      data: {
        productId: id,
        type: operation === 'add' ? 'IN' : 'OUT',
        quantity: parsedQuantity,
        previousStock: product.stock,
        newStock: newStock,
        reference: 'AJUSTE',
        description: description || `Ajuste de stock (${operation === 'add' ? 'Entrada' : 'Salida'})`,
        userId: req.user.id
      }
    });

    // Registrar en historial de transacciones
    await prisma.transactionHistory.create({
      data: {
        type: 'AJUSTE_STOCK',
        description: `Ajuste de stock (${operation === 'add' ? 'Entrada' : 'Salida'}): ${product.name}${updateData.cost ? ` - Nuevo costo: $${updateData.cost}` : ''}`,
        amount: 0,
        categoryName: 'Productos',
        userName: req.user.name || req.user.username,
        details: { 
          productId: id,
          productName: product.name,
          operation,
          quantity,
          unitCost: unitCost || null,
          previousStock: product.stock,
          newStock,
          previousCost: product.cost,
          newCost: updateData.cost || product.cost,
        }
      }
    });

    res.json({ 
      message: 'Stock actualizado exitosamente',
      product: updatedProduct 
    });
  } catch (error) {
    console.error('Error al actualizar stock:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getProductSummary = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { active: true },
      select: {
        stock: true,
        minStock: true,
        price: true,
      }
    });

    const totalProducts = products.length;
    let totalValue = 0;
    let lowStockCount = 0;

    products.forEach(p => {
      totalValue += (p.stock * p.price);
      if (p.stock <= p.minStock) {
        lowStockCount++;
      }
    });

    res.json({
      totalProducts,
      totalValue,
      lowStockCount
    });
  } catch (error) {
    console.error('Error al obtener el resumen de inventario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getKardex = async (req, res) => {
  try {
    const { id } = req.params;
    const movements = await prisma.inventoryMovement.findMany({
      where: { productId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true } }
      }
    });
    res.json(movements);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor obteniendo kárdex' });
  }
};

// Upload product image
export const uploadImage = async (req, res) => {
  try {
    // Check if user has permission
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') {
      return res.status(403).json({ error: 'No tienes permisos para subir imágenes' });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha subido ninguna imagen' });
    }

    const { id } = req.params;
    
    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id }
    });

    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    // Delete old image if exists
    if (product.imagePath) {
      // Remove leading slash if present for path.join
      const normalizedPath = product.imagePath.startsWith('/') ? product.imagePath.substring(1) : product.imagePath;
      const oldImagePath = path.join(process.cwd(), normalizedPath);
      if (fs.existsSync(oldImagePath)) {
        try {
          fs.unlinkSync(oldImagePath);
        } catch (unlinkError) {
          console.error('Error al eliminar imagen antigua:', unlinkError);
        }
      }
    }

    // Prepare image data
    const filename = req.file.filename;
    const imagePath = `/uploads/products/${filename}`;
    // Use relative URL for portability
    const imageUrl = imagePath;

    // Update product with image information
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        imageUrl: imageUrl,
        imagePath: imagePath
      }
    });

    res.json({
      message: 'Imagen subida exitosamente',
      product: updatedProduct
    });
  } catch (error) {
    console.error('Error al subir imagen:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
