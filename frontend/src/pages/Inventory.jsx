import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { productService, categoryService } from '../services/api';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { notifyDataUpdate } from '../hooks/useDataSync';

const Inventory = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBarcodeWarning, setShowBarcodeWarning] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const { formatCurrency } = useApp();
  const { hasPermission } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',
    barcode: '',
    price: '',
    cost: '',
    stock: '',
    minStock: '',
    categoryId: '',
    active: true,
  });

  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    loadData();
  }, [searchTerm, selectedCategory, startDate, endDate]);

  const loadData = async () => {
    try {
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (selectedCategory) params.categoryId = selectedCategory;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      params.active = true;

      const [productsRes, categoriesRes] = await Promise.all([
        productService.getAll(params),
        categoryService.getAll(),
      ]);

      // handle paginated or plain array responses
      let productsList = [];
      if (Array.isArray(productsRes.data)) {
        productsList = productsRes.data;
      } else if (productsRes.data && Array.isArray(productsRes.data.data)) {
        productsList = productsRes.data.data;
      } else if (productsRes.data && Array.isArray(productsRes.data.items)) {
        productsList = productsRes.data.items;
      }

      setProducts(productsList);
      setCategories(Array.isArray(categoriesRes.data) ? categoriesRes.data : (categoriesRes.data?.data || []));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    const data = products.map(p => ({
      'Nombre': p.name,
      'SKU': p.sku,
      'Código Barras': p.barcode || '',
      'Categoría': p.category?.name || 'Sin categoría',
      'Precio': p.price,
      'Costo': p.cost,
      'Stock': p.stock,
      'Stock Mínimo': p.minStock,
      'Activo': p.active ? 'Sí' : 'No',
      'Descripción': p.description || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
    XLSX.writeFile(wb, `inventario_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const downloadTemplate = () => {
    const template = [
      {
        'Nombre': 'Ejemplo Producto',
        'SKU': 'SKU-EJEMPLO',
        'Código Barras': '1234567890123',
        'Categoría': 'Categoría 1',
        'Precio': 100,
        'Costo': 50,
        'Stock': 10,
        'Stock Mínimo': 5,
        'Descripción': 'Descripción del producto'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
    XLSX.writeFile(wb, 'plantilla_inventario.xlsx');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        if (jsonData.length === 0) {
          alert('El archivo está vacío');
          return;
        }

        const preview = jsonData.slice(0, 5).map(row => ({
          name: row['Nombre'] || row['name'] || '',
          sku: row['SKU'] || row['sku'] || '',
          barcode: row['Código Barras'] || row['barcode'] || '',
          category: row['Categoría'] || row['category'] || '',
          price: parseFloat(row['Precio'] || row['price'] || 0),
          cost: parseFloat(row['Costo'] || row['cost'] || 0),
          stock: parseInt(row['Stock'] || row['stock'] || 0),
          minStock: parseInt(row['Stock Mínimo'] || row['minStock'] || 0),
          description: row['Descripción'] || row['description'] || ''
        }));

        setImportPreview({ data: jsonData, rows: preview });
        setShowImportModal(true);
      } catch (error) {
        console.error('Error parsing file:', error);
        alert('Error al leer el archivo. Asegúrate de que sea un archivo Excel válido.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processImport = async () => {
    if (!importPreview || !importPreview.data) {
      alert('No hay datos para importar');
      return;
    }
    
    const data = importPreview.data;
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        let categoryId = null;
        const categoryName = row['Categoría'] || row['category'] || '';
        
        if (categoryName) {
          const existingCategory = categories.find(c => 
            c.name.toLowerCase() === categoryName.toLowerCase()
          );
          
          if (existingCategory) {
            categoryId = existingCategory.id;
          } else {
            const catRes = await categoryService.create({ name: categoryName });
            categoryId = catRes.data.client?.id || catRes.data.category?.id;
            const newCat = await categoryService.getAll();
            setCategories(newCat.data);
          }
        }

        const sku = row['SKU'] || row['sku'] || `SKU-${Date.now().toString(36).toUpperCase()}`;
        
        const existingProduct = products.find(p => 
          p.sku === sku || (row['Código Barras'] && p.barcode === (row['Código Barras'] || row['barcode']))
        );

        const productData = {
          name: row['Nombre'] || row['name'],
          sku: sku,
          barcode: row['Código Barras'] || row['barcode'] || null,
          categoryId: categoryId,
          price: parseFloat(row['Precio'] || row['price'] || 0),
          cost: parseFloat(row['Costo'] || row['cost'] || 0),
          stock: parseInt(row['Stock'] || row['stock'] || 0),
          minStock: parseInt(row['Stock Mínimo'] || row['minStock'] || 0),
          description: row['Descripción'] || row['description'] || '',
          active: true
        };

        if (existingProduct) {
          await productService.update(existingProduct.id, productData);
        } else {
          await productService.create(productData);
        }

        successCount++;
      } catch (error) {
        errorCount++;
        errors.push(`Fila ${i + 2}: ${error.response?.data?.error || error.message}`);
      }
    }

    setImportResults({ success: successCount, errors: errorCount, details: errors });
    loadData();
    notifyDataUpdate('inventory');
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('La imagen es demasiado grande. El límite es 5MB.');
        return;
      }
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOpenModal = (product = null) => {
    setSelectedImage(null);
    setPreviewUrl(null);
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        description: product.description || '',
        sku: product.sku,
        barcode: product.barcode || '',
        price: product.price.toString(),
        cost: product.cost?.toString() || '0',
        stock: product.stock.toString(),
        minStock: product.minStock?.toString() || '0',
        categoryId: product.categoryId || '',
        active: product.active,
      });
      if (product.imageUrl) {
        setPreviewUrl(product.imageUrl);
      }
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        description: '',
        sku: 'AUTO',
        barcode: '',
        price: '',
        cost: '',
        stock: '',
        minStock: '',
        categoryId: '',
        active: true,
      });
    }
    setShowModal(true);
  };

  const generateSKU = () => {
    return 'SKU-' + Date.now().toString(36).toUpperCase();
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    setSelectedImage(null);
    setPreviewUrl(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!editingProduct && !formData.barcode) {
      setShowBarcodeWarning(true);
      return;
    }

    await saveProduct();
  };

  const saveProduct = async () => {
    setIsSubmitting(true);
    try {
      const data = {
        ...formData,
        price: parseFloat(formData.price),
        cost: parseFloat(formData.cost) || 0,
        stock: parseInt(formData.stock) || 0,
        minStock: parseInt(formData.minStock) || 0,
      };

      let product;
      if (editingProduct) {
        const res = await productService.update(editingProduct.id, data);
        product = res.data.product || res.data;
      } else {
        const res = await productService.create(data);
        product = res.data.product || res.data;
      }

      // Upload image if selected
      if (selectedImage && product && product.id) {
        await productService.uploadImage(product.id, selectedImage);
      }

      handleCloseModal();
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Error al guardar producto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBarcodeConfirm = async () => {
    setShowBarcodeWarning(false);
    await saveProduct();
  };

  const handleBarcodeCancel = () => {
    setShowBarcodeWarning(false);
  };

  const handleDelete = (id) => {
    setDeleteTarget(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      await productService.delete(deleteTarget);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Error al eliminar producto');
    } finally {
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  const handleOpenCategoryModal = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setCategoryFormData({
        name: category.name,
        description: category.description || '',
      });
    } else {
      setEditingCategory(null);
      setCategoryFormData({
        name: '',
        description: '',
      });
    }
    setShowCategoryModal(true);
  };

  const handleCloseCategoryModal = () => {
    setShowCategoryModal(false);
    setEditingCategory(null);
    setCategoryFormData({ name: '', description: '' });
  };

  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (editingCategory) {
        await categoryService.update(editingCategory.id, categoryFormData);
      } else {
        await categoryService.create(categoryFormData);
      }
      handleCloseCategoryModal();
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Error al guardar categoría');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!confirm('¿Estás seguro de eliminar esta categoría?')) return;

    try {
      await categoryService.delete(id);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Error al eliminar categoría');
    }
  };

  const filteredProducts = products.filter((product) => {
    const name = (product.name || '').toString();
    const sku = (product.sku || '').toString();
    const barcode = (product.barcode || '').toString();
    const categoryName = (product.category?.name || '').toString();

    const term = searchTerm.toLowerCase();
    const matchesSearch =
      name.toLowerCase().includes(term) ||
      sku.toLowerCase().includes(term) ||
      barcode.toLowerCase().includes(term) ||
      categoryName.toLowerCase().includes(term);

    const matchesCategory = !selectedCategory || product.categoryId === selectedCategory;

    // date filtering (createdAt) if provided
    let matchesDate = true;
    if (startDate || endDate) {
      const created = product.createdAt ? new Date(product.createdAt) : null;
      if (created) {
        if (startDate) {
          const s = new Date(startDate + 'T00:00:00');
          if (created < s) matchesDate = false;
        }
        if (endDate) {
          const e = new Date(endDate + 'T23:59:59');
          if (created > e) matchesDate = false;
        }
      }
    }

    return matchesSearch && matchesCategory && matchesDate;
  });

  if (loading) {
    return <div>Cargando...</div>;
  }

  return (
    <div>
      <div className="view-header">
        <div>
          <h1>Inventario</h1>
          <p>Gestiona tus productos</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-outline" onClick={exportToExcel} title="Exportar a Excel">
            <i className="fas fa-file-excel"></i> Exportar
          </button>
          <button className="btn btn-outline" onClick={() => fileInputRef.current?.click()} title="Importar desde Excel">
            <i className="fas fa-file-import"></i> Importar
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
          />
          <button className="btn btn-secondary" onClick={downloadTemplate} title="Descargar plantilla">
            <i className="fas fa-download"></i> Plantilla
          </button>
          {hasPermission('manage_products') && (
            <button className="btn btn-primary" onClick={() => handleOpenModal()}>
              <i className="fas fa-plus"></i>
              Nuevo
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '24px',
          flexWrap: 'wrap',
        }}
      >
        <input
          type="text"
          className="form-control"
          placeholder="Buscar producto..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ maxWidth: '300px' }}
        />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginRight: 6 }}>Desde</label>
          <input
            type="date"
            className="form-control"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ maxWidth: '160px' }}
          />
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: 8, marginRight: 6 }}>Hasta</label>
          <input
            type="date"
            className="form-control"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ maxWidth: '160px' }}
          />
          <button className="btn btn-outline" onClick={() => { setStartDate(''); setEndDate(''); }} title="Limpiar fechas">Limpiar</button>
        </div>
        <select
          className="form-control"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{ maxWidth: '200px' }}
        >
          <option value="">Todas las categorías</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        {hasPermission('manage_categories') && (
          <button
            className="btn btn-outline"
            onClick={() => handleOpenCategoryModal()}
            style={{ marginLeft: 'auto' }}
          >
            <i className="fas fa-tags"></i>
            Gestionar Categorías
          </button>
        )}
      </div>

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '60px' }}>Imagen</th>
              <th>Producto</th>
              <th>SKU</th>
              <th>Categoría</th>
              <th>Precio</th>
              <th>Stock</th>
              <th>Estado</th>
              {hasPermission('manage_products') && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => (
              <tr key={product.id}>
                <td>
                  <div style={{ 
                    width: '40px', 
                    height: '40px', 
                    borderRadius: '4px', 
                    backgroundColor: 'var(--bg-surface-hover)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    border: '1px solid var(--border-color)'
                  }}>
                    {product.imageUrl ? (
                      <img 
                        src={product.imageUrl} 
                        alt={product.name} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        onError={(e) => {
                          e.target.onerror = null; 
                          e.target.src = 'https://via.placeholder.com/40?text=📦';
                        }}
                      />
                    ) : (
                      <i className="fas fa-box" style={{ color: 'var(--text-muted)' }}></i>
                    )}
                  </div>
                </td>
                <td>
                  <div>
                    <strong>{product.name}</strong>
                    {product.description && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {product.description}
                      </div>
                    )}
                  </div>
                </td>
                <td>{product.sku}</td>
                <td>{product.category?.name || '-'}</td>
                <td>{formatCurrency(product.price)}</td>
                <td>
                  <span
                    className={`badge ${
                      product.stock <= product.minStock
                        ? 'badge-danger'
                        : 'badge-success'
                    }`}
                  >
                    {product.stock}
                  </span>
                </td>
                <td>
                  <span
                    className={`badge ${
                      product.active ? 'badge-success' : 'badge-danger'
                    }`}
                  >
                    {product.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                {hasPermission('manage_products') && (
                  <td>
                    <button
                      className="btn btn-outline"
                      onClick={() => handleOpenModal(product)}
                      style={{ marginRight: '8px', padding: '6px 12px' }}
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    <button
                      className="btn btn-outline"
                      onClick={() => handleDelete(product.id)}
                      style={{
                        padding: '6px 12px',
                        color: 'var(--danger)',
                        borderColor: 'var(--danger)',
                      }}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h2>
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={handleCloseModal}
                style={{ padding: '4px 8px', border: 'none' }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                <div style={{ flex: '0 0 120px' }}>
                  <label>Imagen</label>
                  <div 
                    onClick={() => imageInputRef.current?.click()}
                    style={{ 
                      width: '120px', 
                      height: '120px', 
                      borderRadius: '8px', 
                      border: '2px dashed var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      backgroundColor: 'var(--bg-surface-hover)',
                      position: 'relative'
                    }}
                  >
                    {previewUrl ? (
                      <img src={previewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <>
                        <i className="fas fa-camera" style={{ fontSize: '1.5rem', color: 'var(--text-muted)', marginBottom: '8px' }}></i>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Subir foto</span>
                      </>
                    )}
                    <input 
                      type="file" 
                      ref={imageInputRef} 
                      onChange={handleImageChange} 
                      accept="image/*" 
                      style={{ display: 'none' }} 
                    />
                  </div>
                </div>
                <div style={{ flex: '1' }}>
                  <div className="form-group">
                    <label>Nombre *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />
                  </div>
    
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Descripción</label>
                    <textarea
                      className="form-control"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      rows="2"
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>SKU *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.sku}
                    onChange={(e) =>
                      setFormData({ ...formData, sku: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Código de Barras</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.barcode}
                    onChange={(e) =>
                      setFormData({ ...formData, barcode: e.target.value })
                    }
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Precio *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Costo</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={formData.cost}
                    onChange={(e) =>
                      setFormData({ ...formData, cost: e.target.value })
                    }
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Stock</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.stock}
                    onChange={(e) =>
                      setFormData({ ...formData, stock: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Stock Mínimo</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.minStock}
                    onChange={(e) =>
                      setFormData({ ...formData, minStock: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Categoría</label>
                  <select
                    className="form-control"
                    value={formData.categoryId}
                    onChange={(e) =>
                      setFormData({ ...formData, categoryId: e.target.value })
                    }
                  >
                    <option value="">Sin categoría</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando...' : (editingProduct ? 'Actualizar' : 'Crear')}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleCloseModal}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBarcodeWarning && (
        <div className="modal-overlay" onClick={handleBarcodeCancel}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px', color: '#F59E0B' }}>
                <i className="fas fa-exclamation-triangle"></i>
              </div>
              <h3 style={{ margin: '0 0 12px 0', color: '#F59E0B' }}>Advertencia</h3>
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, margin: 0, fontSize: '0.95rem' }}>
                El art&iacute;culo no tiene c&oacute;digo de barras. Esto podr&iacute;a dificultar la b&uacute;squeda en ventas futuras con lector.
              </p>
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, margin: '12px 0 0 0', fontWeight: 600 }}>
                &iquest;Desea guardarlo de todas formas?
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={handleBarcodeConfirm}>
                <i className="fas fa-check"></i> S&iacute;, guardar
              </button>
              <button className="btn btn-outline" onClick={handleBarcodeCancel}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={cancelDelete}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px', color: '#EF4444' }}>
                <i className="fas fa-trash-alt"></i>
              </div>
              <h3 style={{ margin: '0 0 12px 0', color: '#EF4444' }}>Confirmar Eliminaci&oacute;n</h3>
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, margin: 0, fontSize: '0.95rem' }}>
                &iquest;Est&aacute;s seguro de eliminar este producto? Esta acci&oacute;n no se puede deshacer.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={confirmDelete} style={{ backgroundColor: '#EF4444', borderColor: '#EF4444' }}>
                <i className="fas fa-trash"></i> S&iacute;, eliminar
              </button>
              <button className="btn btn-outline" onClick={cancelDelete}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showCategoryModal && (
        <div className="modal-overlay" onClick={handleCloseCategoryModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0 }}>Gestionar Categorías</h2>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleCloseCategoryModal}
                style={{ padding: '8px 16px' }}
              >
                <i className="fas fa-times"></i> Cerrar
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {/* Formulario */}
              <div style={{ padding: '20px', backgroundColor: 'var(--bg-surface-hover)', borderRadius: '8px' }}>
                <h3 style={{ marginBottom: '16px', marginTop: 0 }}>
                  {editingCategory ? '✏️ Editar Categoría' : '➕ Nueva Categoría'}
                </h3>
                <form onSubmit={handleCategorySubmit}>
                  <div className="form-group">
                    <label>Nombre *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ej: Electrónica"
                      value={categoryFormData.name}
                      onChange={(e) =>
                        setCategoryFormData({ ...categoryFormData, name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Descripción</label>
                    <textarea
                      className="form-control"
                      placeholder="Detalla esta categoría..."
                      value={categoryFormData.description}
                      onChange={(e) =>
                        setCategoryFormData({ ...categoryFormData, description: e.target.value })
                      }
                      rows="3"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={isSubmitting}>
                      {isSubmitting ? 'Guardando...' : (editingCategory ? '💾 Actualizar' : '✅ Crear Categoría')}
                    </button>
                    {editingCategory && (
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => {
                          setEditingCategory(null);
                          setCategoryFormData({ name: '', description: '' });
                        }}
                        style={{ width: '100%' }}
                      >
                        ↺ Limpiar Formulario
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Lista de categorías */}
              <div>
                <h3 style={{ marginTop: 0, marginBottom: '16px' }}>
                  📋 Categorías ({categories.length})
                  <button
                    className="btn btn-primary"
                    onClick={() => handleOpenCategoryModal()}
                    style={{ padding: '6px 12px', marginLeft: '12px', fontSize: '0.9rem' }}
                  >
                    <i className="fas fa-plus"></i> Añadir
                  </button>
                </h3>
                
                <div className="data-table-container" style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  {categories.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                      <i className="fas fa-inbox" style={{ fontSize: '2rem', marginBottom: '12px', display: 'block' }}></i>
                      Sin categorías creadas aún
                    </div>
                  ) : (
                    <table className="data-table" style={{ marginBottom: 0 }}>
                      <thead>
                        <tr>
                          <th>Nombre</th>
                          <th style={{ width: '60px', textAlign: 'center' }}>Productos</th>
                          <th style={{ width: '100px', textAlign: 'center' }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categories.map((category) => (
                          <tr key={category.id} style={{ backgroundColor: editingCategory?.id === category.id ? 'var(--bg-selected)' : 'transparent' }}>
                            <td>
                              <div>
                                <strong>{category.name}</strong>
                                {category.description && (
                                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    {category.description.substring(0, 50)}{category.description.length > 50 ? '...' : ''}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="badge badge-success">
                                {category._count?.products || 0}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                className="btn btn-outline"
                                onClick={() => handleOpenCategoryModal(category)}
                                title="Editar"
                                style={{ marginRight: '6px', padding: '6px 10px' }}
                              >
                                <i className="fas fa-edit"></i>
                              </button>
                              <button
                                className="btn btn-outline"
                                onClick={() => {
                                  if (confirm(`¿Eliminar categoría "${category.name}"?`)) {
                                    handleDeleteCategory(category.id);
                                  }
                                }}
                                title="Eliminar"
                                style={{
                                  padding: '6px 10px',
                                  color: 'var(--danger)',
                                  borderColor: 'var(--danger)',
                                }}
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="modal-overlay" onClick={() => { setShowImportModal(false); setImportPreview(null); setImportResults(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <h2>Importar Inventario</h2>
            
            {!importResults && importPreview ? (
              <>
                <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Se encontraron {importPreview.data?.length || 0} productos para importar.
                </p>
                
                <div style={{ marginBottom: '16px', maxHeight: '300px', overflowY: 'auto' }}>
                  <table className="data-table" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>Nombre</th><th>SKU</th><th>Categoría</th><th>Precio</th><th>Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.rows?.map((row, i) => (
                        <tr key={i}>
                          <td>{row.name}</td>
                          <td>{row.sku}</td>
                          <td>{row.category}</td>
                          <td>{formatCurrency(row.price)}</td>
                          <td>{row.stock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button className="btn btn-outline" onClick={() => { setShowImportModal(false); setImportPreview(null); }}>
                    Cancelar
                  </button>
                  <button className="btn btn-primary" onClick={processImport}>
                    <i className="fas fa-upload"></i> Importar {importPreview.data?.length} productos
                  </button>
                </div>
              </>
            ) : importResults ? (
              <>
                <div style={{ padding: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem', color: importResults.errors === 0 ? 'var(--secondary)' : 'var(--accent)', marginBottom: '16px' }}>
                    <i className={`fas ${importResults.errors === 0 ? 'fa-check-circle' : 'fa-exclamation-triangle'}`}></i>
                  </div>
                  <h3 style={{ marginBottom: '16px' }}>
                    Importación completada
                  </h3>
                  <p><strong style={{ color: 'var(--secondary)' }}>{importResults.success}</strong> productos importados exitosamente</p>
                  {importResults.errors > 0 && (
                    <p><strong style={{ color: 'var(--danger)' }}>{importResults.errors}</strong> errores</p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button className="btn btn-primary" onClick={() => { setShowImportModal(false); setImportPreview(null); setImportResults(null); }}>
                    Cerrar
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
