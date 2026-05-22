import { useState, useEffect } from 'react';
import { supplierService, purchaseService } from '../services/api';
import { useApp } from '../context/AppContext';

export default function PurchaseModal({ isOpen, onClose, products, onPurchaseComplete }) {
  const { formatCurrency, showNotification } = useApp();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    supplierId: '',
    orderNumber: `PO-${Date.now()}`,
    notes: '',
    items: [],
  });

  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState(0);

  useEffect(() => {
    if (isOpen) {
      loadSuppliers();
      setFormData({
        supplierId: '',
        orderNumber: `PO-${Date.now()}`,
        notes: '',
        items: [],
      });
      setSelectedProduct('');
      setQuantity(1);
      setUnitCost(0);
    }
  }, [isOpen]);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const res = await supplierService.getAll();
      setSuppliers(res.data?.data || res.data || []);
    } catch (error) {
      console.error(error);
      showNotification('Error cargando proveedores', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleProductSelect = (e) => {
    const prodId = e.target.value;
    setSelectedProduct(prodId);
    const prod = products.find(p => p.id === prodId);
    if (prod) {
      setUnitCost(prod.cost || 0);
    }
  };

  const handleAddItem = () => {
    if (!selectedProduct || quantity <= 0 || unitCost < 0) return;
    const prod = products.find(p => p.id === selectedProduct);
    if (!prod) return;

    if (formData.items.some(item => item.productId === prod.id)) {
      showNotification('El producto ya está en la lista', 'warning');
      return;
    }

    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          productId: prod.id,
          name: prod.name,
          quantity: parseInt(quantity),
          unitCost: parseFloat(unitCost),
          total: quantity * unitCost
        }
      ]
    }));

    setSelectedProduct('');
    setQuantity(1);
    setUnitCost(0);
  };

  const handleRemoveItem = (index) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems.splice(index, 1);
      return { ...prev, items: newItems };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.supplierId) {
      return showNotification('Selecciona un proveedor', 'error');
    }
    if (formData.items.length === 0) {
      return showNotification('La orden debe tener al menos un producto', 'error');
    }

    try {
      setSaving(true);
      const dataToSubmit = {
        supplierId: formData.supplierId,
        orderNumber: formData.orderNumber,
        notes: formData.notes,
        items: formData.items.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          unitCost: i.unitCost
        }))
      };
      
      await purchaseService.create(dataToSubmit);
      showNotification('Orden de compra registrada e inventario actualizado', 'success');
      onPurchaseComplete();
    } catch (error) {
      console.error(error);
      showNotification(error.response?.data?.error || 'Error registrando compra', 'error');
    } finally {
      setSaving(false);
    }
  };

  const grandTotal = formData.items.reduce((sum, i) => sum + i.total, 0);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 2000 }}>
      {loading && <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.7)', zIndex: 2001, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cargando datos...</div>}
      <div className="modal-content" style={{ maxWidth: '800px', width: '95%' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}><i className="fas fa-truck-loading" style={{ color: 'var(--primary)', marginRight: '8px' }}></i>Ingreso de Mercancía / Compra</h2>
          <button className="btn btn-outline" style={{ border: 'none', padding: '4px' }} onClick={onClose}><i className="fas fa-times"></i></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: 'var(--bg-main)', padding: '16px', borderRadius: '8px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Proveedor *</label>
              <select className="form-control" value={formData.supplierId} onChange={e => setFormData({...formData, supplierId: e.target.value})} required>
                <option value="">-- Seleccionar --</option>
                {suppliers.map(sup => <option key={sup.id} value={sup.id}>{sup.name}</option>)}
              </select>
            </div>
            
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Número de Orden (Factura / PO)</label>
              <input type="text" className="form-control" value={formData.orderNumber} onChange={e => setFormData({...formData, orderNumber: e.target.value})} required />
            </div>

            <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
              <label>Notas / Observaciones</label>
              <input type="text" className="form-control" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Orden de importación, compra semanal..." />
            </div>
          </div>

          <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
            <h3 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '16px' }}>Productos a Ingresar</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 2fr) 1fr 1fr auto', gap: '8px', alignItems: 'end', marginBottom: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.8rem' }}>Producto</label>
                <select className="form-control" value={selectedProduct} onChange={handleProductSelect}>
                  <option value="">-- Buscar Producto --</option>
                  {products.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.8rem' }}>Costo Unit.</label>
                <input type="number" step="0.01" min="0" className="form-control" value={unitCost} onChange={e => setUnitCost(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.8rem' }}>Cantidad</label>
                <input type="number" min="1" className="form-control" value={quantity} onChange={e => setQuantity(e.target.value)} />
              </div>
              <button type="button" className="btn btn-outline" style={{ height: '42px', padding: '0 16px' }} onClick={handleAddItem} disabled={!selectedProduct}>
                <i className="fas fa-plus"></i> Añadir
              </button>
            </div>

            <div className="data-table-container" style={{ maxHeight: '250px' }}>
              {formData.items.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-main)', borderRadius: '8px' }}>
                  Añade productos a la orden
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th style={{ textAlign: 'right' }}>Costo Unit.</th>
                      <th style={{ textAlign: 'center' }}>Cantidad</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      <th style={{ width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.name}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(item.unitCost)}</td>
                        <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(item.total)}</td>
                        <td>
                          <button type="button" className="btn-icon danger" onClick={() => handleRemoveItem(idx)}><i className="fas fa-trash"></i></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'right', fontWeight: 'bold' }}>Total General:</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--primary)', fontSize: '1.1rem' }}>{formatCurrency(grandTotal)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fas fa-info-circle"></i> Esto creará el adeudo (CxP) y actualizará el inventario automáticamente.
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving || formData.items.length === 0}>
                {saving ? 'Procesando...' : 'Confirmar Compra'}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
