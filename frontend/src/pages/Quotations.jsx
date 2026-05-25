import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { quotationService, clientService, productService, saleService } from '../services/api';
import { useApp } from '../context/AppContext';
import { QuotationReceipt80, QuotationReceipt58, QuotationLetterReceipt } from '../components/POSModals';
import ConfirmModal from '../components/ConfirmModal';

const QuotationModal = ({ products, clients, onSave, onClose, editingQuotation, formatCurrency, onCreateClient }) => {
  const [formData, setFormData] = useState({
    clientId: '',
    clientName: '',
    clientRnc: '',
    clientPhone: '',
    clientAddress: '',
    clientEmail: '',
    notes: '',
    validityDays: 30,
    paymentMethod: 'CASH',
    deliveryTime: '',
    warranty: '',
    items: [],
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewClientOption, setShowNewClientOption] = useState(false);
  const [isCreatingClient, setIsCreatingClient] = useState(false);

  useEffect(() => {
    if (editingQuotation) {
      setFormData({
        clientId: editingQuotation.clientId || '',
        clientName: editingQuotation.clientName || '',
        clientRnc: editingQuotation.clientRnc || '',
        clientPhone: editingQuotation.clientPhone || '',
        clientAddress: editingQuotation.clientAddress || '',
        clientEmail: editingQuotation.clientEmail || '',
        notes: editingQuotation.notes || '',
        validityDays: editingQuotation.validityDays || 30,
        paymentMethod: editingQuotation.paymentMethod || 'CASH',
        deliveryTime: editingQuotation.deliveryTime || '',
        warranty: editingQuotation.warranty || '',
        items: editingQuotation.items.map(item => ({
          productId: item.productId,
          product: item.product,
          quantity: item.quantity,
          price: item.price,
          tax: item.tax,
          discount: item.discount || 0,
        })),
      });
    }
  }, [editingQuotation]);

  const handleClientChange = (clientId) => {
    if (clientId === '__new__') {
      setShowNewClientOption(true);
      setFormData({
        ...formData,
        clientId: '',
        clientName: '',
        clientRnc: '',
        clientPhone: '',
        clientAddress: '',
        clientEmail: '',
      });
      return;
    }
    setShowNewClientOption(false);
    const client = clients.find(c => c.id === clientId);
    setFormData({
      ...formData,
      clientId,
      clientName: client?.name || '',
      clientRnc: client?.rnc || '',
      clientPhone: client?.phone || '',
      clientAddress: client?.address || '',
      clientEmail: client?.email || '',
    });
  };

  const handleCreateNewClient = async () => {
    if (!formData.clientName?.trim()) {
      showNotification('Ingresa el nombre del cliente', 'warning');
      return;
    }
    setIsCreatingClient(true);
    try {
      const newClient = await onCreateClient({
        name: formData.clientName,
        rnc: formData.clientRnc,
        phone: formData.clientPhone,
        address: formData.clientAddress,
        email: formData.clientEmail,
      });
      setFormData({
        ...formData,
        clientId: newClient.id,
        clientName: newClient.name,
      });
      setShowNewClientOption(false);
      showNotification('Cliente creado exitosamente: ' + newClient.name, 'success');
    } catch (error) {
      showNotification(error.message || 'Error al crear cliente', 'error');
    } finally {
      setIsCreatingClient(false);
    }
  };

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products.slice(0, 20);
    return products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 20);
  }, [products, searchTerm]);

  const addItem = (product) => {
    const existing = formData.items.find(i => i.productId === product.id);
    if (existing) {
      setFormData({
        ...formData,
        items: formData.items.map(i => 
          i.productId === product.id 
            ? { ...i, quantity: i.quantity + 1 }
            : i
        ),
      });
    } else {
      setFormData({
        ...formData,
        items: [...formData.items, {
          productId: product.id,
          product,
          quantity: 1,
          price: product.price,
          tax: product.taxRate ? product.price * product.taxRate : 0,
          discount: 0,
        }],
      });
    }
  };

  const updateItem = (productId, field, value) => {
    setFormData({
      ...formData,
      items: formData.items.map(i => 
        i.productId === productId ? { ...i, [field]: value } : i
      ),
    });
  };

  const removeItem = (productId) => {
    setFormData({
      ...formData,
      items: formData.items.filter(i => i.productId !== productId),
    });
  };

  const subtotal = formData.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const totalTax = formData.items.reduce((sum, i) => sum + (i.tax * i.quantity), 0);
  const totalDiscount = formData.items.reduce((sum, i) => sum + ((i.discount || 0) * i.quantity), 0);
  const total = subtotal + totalTax - totalDiscount;

  const handleSubmit = () => {
    if (formData.items.length === 0) {
      showNotification('Agrega al menos un producto', 'warning');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}>
        <h2>{editingQuotation ? 'Editar Cotización' : 'Nueva Cotización'}</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div className="form-group">
            <label>Cliente</label>
            <select 
              className="form-control"
              value={formData.clientId}
              onChange={e => handleClientChange(e.target.value)}
            >
              <option value="">Seleccionar cliente...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value="__new__">+ Crear nuevo cliente</option>
            </select>
          </div>
          <div className="form-group">
            <label>Validez (días)</label>
            <input 
              type="number" 
              className="form-control"
              value={formData.validityDays}
              onChange={e => setFormData({ ...formData, validityDays: parseInt(e.target.value) })}
              min={1}
              max={90}
            />
          </div>
        </div>

        {(showNewClientOption || !formData.clientId) && (
        <div style={{ 
          background: 'rgba(16,185,129,0.1)', 
          padding: '15px', 
          borderRadius: '8px', 
          marginBottom: '20px',
          border: '1px solid var(--secondary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
            <i className="fas fa-user-plus" style={{ color: 'var(--secondary)' }}></i>
            <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--secondary)' }}>
              {showNewClientOption ? 'Crear Nuevo Cliente' : 'Datos del Cliente (Opcional)'}
            </h4>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div className="form-group">
              <label style={{ fontSize: '12px' }}>Nombre del Cliente</label>
              <input 
                type="text" 
                className="form-control"
                value={formData.clientName}
                onChange={e => setFormData({ ...formData, clientName: e.target.value })}
                placeholder="Nombre completo o razón social"
              />
            </div>
            <div className="form-group">
              <label style={{ fontSize: '12px' }}>RNC / Cédula</label>
              <input 
                type="text" 
                className="form-control"
                value={formData.clientRnc}
                onChange={e => setFormData({ ...formData, clientRnc: e.target.value })}
                placeholder="RNC o cédula de identidad"
              />
            </div>
            <div className="form-group">
              <label style={{ fontSize: '12px' }}>Teléfono</label>
              <input 
                type="tel" 
                className="form-control"
                value={formData.clientPhone}
                onChange={e => setFormData({ ...formData, clientPhone: e.target.value })}
                placeholder="809-000-0000"
              />
            </div>
            <div className="form-group">
              <label style={{ fontSize: '12px' }}>Correo Electrónico</label>
              <input 
                type="email" 
                className="form-control"
                value={formData.clientEmail}
                onChange={e => setFormData({ ...formData, clientEmail: e.target.value })}
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '12px' }}>Dirección</label>
              <input 
                type="text" 
                className="form-control"
                value={formData.clientAddress}
                onChange={e => setFormData({ ...formData, clientAddress: e.target.value })}
                placeholder="Dirección completa"
              />
            </div>
            {showNewClientOption && (
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  className="btn btn-primary"
                  onClick={handleCreateNewClient}
                  disabled={isCreatingClient}
                  style={{ flex: 1 }}
                >
                  <i className="fas fa-user-plus"></i> {isCreatingClient ? 'Creando...' : 'Crear Cliente y Continuar'}
                </button>
                <button 
                  className="btn btn-outline"
                  onClick={() => setShowNewClientOption(false)}
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>
        )}

        <div style={{ 
          background: 'var(--bg-surface-hover)', 
          padding: '15px', 
          borderRadius: '8px', 
          marginBottom: '20px',
          border: '1px solid var(--border-color)'
        }}>
          <h4 style={{ margin: '0 0 15px', fontSize: '13px', color: 'var(--primary)' }}>
            <i className="fas fa-file-contract"></i> Condiciones (Opcionales)
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
            <div className="form-group">
              <label style={{ fontSize: '12px' }}>Forma de Pago</label>
              <select 
                className="form-control"
                value={formData.paymentMethod}
                onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}
              >
                <option value="CASH">Efectivo</option>
                <option value="TRANSFER">Transferencia</option>
                <option value="CARD">Tarjeta</option>
                <option value="CREDIT">Crédito</option>
                <option value="MIXED">Mixto</option>
              </select>
            </div>
            <div className="form-group">
              <label style={{ fontSize: '12px' }}>Tiempo de Entrega</label>
              <input 
                type="text" 
                className="form-control"
                value={formData.deliveryTime}
                onChange={e => setFormData({ ...formData, deliveryTime: e.target.value })}
                placeholder="Ej: 3-5 días hábiles"
              />
            </div>
            <div className="form-group">
              <label style={{ fontSize: '12px' }}>Garantía</label>
              <input 
                type="text" 
                className="form-control"
                value={formData.warranty}
                onChange={e => setFormData({ ...formData, warranty: e.target.value })}
                placeholder="Ej: 12 meses"
              />
            </div>
          </div>
        </div>

        <div className="form-group">
          <label>Notas</label>
          <textarea 
            className="form-control"
            value={formData.notes}
            onChange={e => setFormData({ ...formData, notes: e.target.value })}
            rows={2}
            placeholder="Notas adicionales..."
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
          <div>
            <h4 style={{ marginBottom: '10px' }}>Buscar Productos</h4>
            <input 
              type="text" 
              className="form-control"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <div style={{ maxHeight: '200px', overflow: 'auto', marginTop: '10px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              {filteredProducts.map(p => (
                <div 
                  key={p.id}
                  onClick={() => addItem(p)}
                  style={{ 
                    padding: '8px 12px', 
                    borderBottom: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{p.name}</span>
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{formatCurrency(p.price)}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 style={{ marginBottom: '10px' }}>Productos Cotizados</h4>
            {formData.items.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Sin productos
              </div>
            ) : (
              <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                {formData.items.map((item, idx) => (
                  <div key={idx} style={{ 
                    padding: '10px', 
                    marginBottom: '8px',
                    background: 'var(--bg-surface-hover)',
                    borderRadius: '8px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <strong style={{ flex: 1 }}>{item.product?.name}</strong>
                      <button 
                        onClick={() => removeItem(item.productId)}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <button onClick={() => updateItem(item.productId, 'quantity', Math.max(1, item.quantity - 1))} style={{ padding: '2px 8px' }}>-</button>
                        <span>{item.quantity}</span>
                        <button onClick={() => updateItem(item.productId, 'quantity', item.quantity + 1)} style={{ padding: '2px 8px' }}>+</button>
                      </div>
                      <input 
                        type="number" 
                        value={item.price}
                        onChange={e => updateItem(item.productId, 'price', parseFloat(e.target.value))}
                        style={{ width: '80px', padding: '4px' }}
                      />
                      <span>{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          background: 'linear-gradient(135deg, var(--primary) 0%, #6366F1 100%)',
          color: '#fff',
          borderRadius: '12px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span>Subtotal:</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span>ITBIS:</span>
            <span>{formatCurrency(totalTax)}</span>
          </div>
          {totalDiscount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', color: '#fca5a5' }}>
              <span>Descuento:</span>
              <span>-{formatCurrency(totalDiscount)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.3rem', fontWeight: 'bold', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '10px', marginTop: '10px' }}>
            <span>Total:</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit}>
            <i className="fas fa-save"></i> {editingQuotation ? 'Actualizar' : 'Crear'} Cotización
          </button>
        </div>
      </div>
    </div>
  );
};

const ConvertModal = ({ quotation, clients, onSave, onClose, formatCurrency }) => {
  const [formData, setFormData] = useState({
    paymentMethod: 'CASH',
    paidAmount: quotation?.total || 0,
    dueDate: '',
  });

  const handleSubmit = () => {
    const dataToSend = { ...formData };
    if (dataToSend.paymentMethod === 'CREDIT') {
      dataToSend.paidAmount = 0;
    }
    onSave(dataToSend);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
        <h2>Convertir a Venta</h2>
        
        <div style={{ padding: '15px', background: 'var(--bg-surface-hover)', borderRadius: '8px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span>Cotización:</span>
            <strong>{quotation?.quotationNumber}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary)' }}>
            <span>Total:</span>
            <span>{formatCurrency(quotation?.total || 0)}</span>
          </div>
        </div>

        <div className="form-group">
          <label>Método de Pago</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            {['CASH', 'CARD', 'CREDIT'].map(method => (
              <button
                key={method}
                onClick={() => setFormData({ ...formData, paymentMethod: method })}
                style={{ 
                  flex: 1,
                  padding: '10px',
                  border: formData.paymentMethod === method ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  borderRadius: '8px',
                  background: formData.paymentMethod === method ? 'rgba(79,70,229,0.1)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                {method === 'CASH' && '💵 Efectivo'}
                {method === 'CARD' && '💳 Tarjeta'}
                {method === 'CREDIT' && '📋 Crédito'}
              </button>
            ))}
          </div>
        </div>

        {formData.paymentMethod === 'CREDIT' && (
          <div className="form-group">
            <label>Fecha de Pago</label>
            <input 
              type="date"
              className="form-control"
              value={formData.dueDate}
              onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
        )}

        {formData.paymentMethod !== 'CREDIT' && (
          <div className="form-group">
            <label>Monto Recibido</label>
            <input 
              type="number"
              className="form-control"
              value={formData.paidAmount}
              onChange={e => setFormData({ ...formData, paidAmount: parseFloat(e.target.value) })}
              min={0}
              step="0.01"
            />
            {formData.paidAmount > quotation?.total && (
              <div style={{ color: 'var(--secondary)', marginTop: '5px' }}>
                Cambio: {formatCurrency(formData.paidAmount - quotation?.total)}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit}>
            <i className="fas fa-check"></i> Confirmar Venta
          </button>
        </div>
      </div>
    </div>
  );
};

const Quotations = () => {
  const [loading, setLoading] = useState(true);
  const [quotations, setQuotations] = useState([]);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: '', page: 1, limit: 15 });
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [showModal, setShowModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState(null);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [printType, setPrintType] = useState('thermal-58');
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [copied, setCopied] = useState(false);
  const pdfPreviewRef = useRef(null);
  const [showPdfLoading, setShowPdfLoading] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const { formatCurrency, settings, showNotification } = useApp();

  const loadData = async () => {
    try {
      const [quotRes, clientsRes, productsRes] = await Promise.all([
        quotationService.getAll(filters),
        clientService.getAll({}),
        productService.getAll({ active: true }),
      ]);
      const quotData = quotRes.data?.data || (Array.isArray(quotRes.data) ? quotRes.data : []);
      const paginationData = quotRes.data?.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 };
      
      setQuotations(quotData);
      setPagination(paginationData);
      setClients(Array.isArray(clientsRes.data) ? clientsRes.data : (clientsRes.data?.data || []));
      setProducts(Array.isArray(productsRes.data) ? productsRes.data : (productsRes.data?.data || []));
    } catch (error) {
      console.error('Error loading:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value, page: 1 }));
  };

  useEffect(() => { loadData(); }, [filters]);

  const handleSave = async (formData) => {
    try {
      if (editingQuotation) {
        await quotationService.update(editingQuotation.id, formData);
      } else {
        await quotationService.create(formData);
      }
      setShowModal(false);
      setEditingQuotation(null);
      loadData();
    } catch (error) {
      showNotification(error.response?.data?.error || 'Error al guardar', 'error');
    }
  };

  const handleConvert = async (formData) => {
    try {
      const res = await quotationService.convertToSale(selectedQuotation.id, formData);
      showNotification('Cotización convertida a venta: ' + res.data.sale.invoiceNumber, 'success');
      setShowConvertModal(false);
      setSelectedQuotation(null);
      loadData();
    } catch (error) {
      showNotification(error.response?.data?.error || 'Error al convertir', 'error');
    }
  };

  const handleDelete = (id) => {
    setConfirmDeleteId(id);
    setShowConfirmDelete(true);
  };

  const confirmDelete = async () => {
    try {
      await quotationService.delete(confirmDeleteId);
      loadData();
    } catch (error) {
      showNotification(error.response?.data?.error || 'Error al eliminar', 'error');
    } finally {
      setShowConfirmDelete(false);
      setConfirmDeleteId(null);
    }
  };

  const cancelDelete = () => {
    setShowConfirmDelete(false);
    setConfirmDeleteId(null);
  };

  const handleCreateClient = async (clientData) => {
    try {
      const response = await clientService.create(clientData);
      const newClient = response.data.client || response.data;
      setClients(prev => [...prev, newClient]);
      return newClient;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Error al crear cliente');
    }
  };


  const generateQuotationMessage = (quotation) => {
    const clientName = quotation.clientName || quotation.client?.name || 'Cliente';
    const validity = quotation.validityDays || 30;
    
    let message = `Estimado/a ${clientName},\n\n`;
    message += `Es un placer saludarle. Adjuntamos la cotización solicitada:\n\n`;
    message += `• Cotización: ${quotation.quotationNumber}\n`;
    message += `• Fecha: ${new Date(quotation.createdAt).toLocaleDateString('es-ES')}\n`;
    message += `• Validez: ${validity} días\n`;
    message += `• Total: ${formatCurrency(quotation.total)}\n\n`;
    
    if (quotation.items && quotation.items.length > 0) {
      message += `Detalle de productos:\n`;
      quotation.items.forEach(item => {
        message += `- ${item.product?.name || 'Producto'}: ${item.quantity} x ${formatCurrency(item.price)}\n`;
      });
      message += `\n`;
    }

    message += `Quedamos a su entera disposición para cualquier duda o comentario.\n\n`;
    message += `Gracias por preferirnos.\n\n`;
    message += `Atentamente,\n${settings?.businessName || 'Su Equipo de Ventas'}`;
    
    return message;
  };

  const openMessageModal = (quotation) => {
    setSelectedQuotation(quotation);
    setGeneratedMessage(generateQuotationMessage(quotation));
    setCustomNotes('');
    setShowMessageModal(true);
    setCopied(false);
  };

  const getFullMessage = () => {
    if (customNotes.trim()) {
      return generatedMessage + '\n\n--- NOTAS ADICIONALES ---\n' + customNotes;
    }
    return generatedMessage;
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(getFullMessage());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error al copiar:', error);
    }
  };

  const sendViaWhatsApp = () => {
    const phone = selectedQuotation.clientPhone || selectedQuotation.client?.phone || '';
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) {
      showNotification('El cliente no tiene un número de teléfono válido', 'warning');
      return;
    }
    const encodedMessage = encodeURIComponent(getFullMessage());
    window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, '_blank');
  };

  const sendViaEmail = () => {
    const email = selectedQuotation.clientEmail || selectedQuotation.client?.email || '';
    if (!email) {
      showNotification('El cliente no tiene un correo electrónico registrado', 'warning');
      return;
    }
    const subject = encodeURIComponent(`Cotización ${selectedQuotation.quotationNumber}`);
    const body = encodeURIComponent(getFullMessage());
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  const downloadPDF = async () => {
    setShowPdfLoading(true);
    try {
      const { jsPDF } = await import('jspdf');
      const q = selectedQuotation;
      if (!q) return;

      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'letter' });
      const pw = pdf.internal.pageSize.getWidth();
      const ml = 20, mr = 20;
      const contentW = pw - ml - mr;
      let y = 25;
      const clr = { primary: [79, 70, 229], dark: [26, 26, 26], gray: [102, 102, 102], light: [245, 245, 245], red: [220, 38, 38] };

      const bold = (size) => { pdf.setFont('helvetica', 'bold'); pdf.setFontSize(size); };
      const normal = (size) => { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(size); };
      const color = (c) => pdf.setTextColor(c[0], c[1], c[2]);
      const line = (yPos) => { pdf.setDrawColor(220, 220, 220); pdf.line(ml, yPos, pw - mr, yPos); };

      // ── HEADER ──
      bold(22); color(clr.primary);
      pdf.text(settings.companyName || 'Nombre de la Empresa', ml, y);
      y += 7;
      normal(9); color(clr.gray);
      if (settings.companyRnc) { pdf.text(`RNC: ${settings.companyRnc}`, ml, y); y += 4.5; }
      if (settings.companyAddress) { pdf.text(settings.companyAddress, ml, y); y += 4.5; }
      let phoneEmail = '';
      if (settings.companyPhone) phoneEmail += `Tel: ${settings.companyPhone}`;
      if (settings.companyPhone && settings.companyEmail) phoneEmail += ' | ';
      if (settings.companyEmail) phoneEmail += settings.companyEmail;
      if (phoneEmail) { pdf.text(phoneEmail, ml, y); y += 4.5; }

      // ── TITLE ──
      pdf.setFillColor(clr.primary[0], clr.primary[1], clr.primary[2]);
      pdf.rect(pw - mr - 60, 20, 60, 22, 'F');
      bold(16); pdf.setTextColor(255, 255, 255);
      pdf.text('COTIZACIÓN', pw - mr - 30, 32, { align: 'center' });
      normal(8); pdf.setTextColor(220, 220, 220);
      pdf.text(`No. ${q.quotationNumber || 'COT-000'}`, pw - mr - 30, 39, { align: 'center' });

      y = Math.max(y + 5, 52);
      line(y); y += 6;

      // ── INFO BOX ──
      pdf.setFillColor(clr.light[0], clr.light[1], clr.light[2]);
      pdf.rect(ml, y, contentW, 28, 'F');
      const infoX = ml + 5;
      bold(9); color(clr.dark);
      pdf.text('CLIENTE', infoX, y + 5);
      normal(9);
      const cName = q.client?.name || q.clientName || 'Público General';
      const cRnc = q.client?.rnc || q.clientRnc || 'N/A';
      const cPhone = q.client?.phone || q.clientPhone || 'N/A';
      const cAddr = q.client?.address || q.clientAddress || 'N/A';
      const cEmail = q.client?.email || q.clientEmail || 'N/A';
      pdf.text(cName, infoX, y + 11);
      pdf.text(`RNC/Céd: ${cRnc}`, infoX, y + 16);
      pdf.text(`Tel: ${cPhone}`, infoX + 80, y + 11);
      pdf.text(cAddr.length > 35 ? cAddr.substring(0, 34) + '...' : cAddr, infoX + 80, y + 16);
      pdf.text(cEmail.length > 28 ? cEmail.substring(0, 27) + '...' : cEmail, infoX, y + 21);

      const issueDate = q.createdAt ? new Date(q.createdAt) : new Date();
      const expiryDate = new Date(issueDate);
      expiryDate.setDate(expiryDate.getDate() + (q.validityDays || 30));
      normal(8);
      pdf.text(`Fecha: ${issueDate.toLocaleDateString('es-DO')}`, infoX + 155, y + 11);
      bold(9); color(clr.red);
      pdf.text(`Válida hasta: ${expiryDate.toLocaleDateString('es-DO')}`, infoX + 155, y + 18);

      y += 34;

      // ── ITEMS TABLE ──
      const colX = [ml, ml + 8, ml + 30, ml + 95, ml + 115, ml + 143];
      const colW = [8, 22, 65, 20, 28, 32];
      const headerH = 8;
      const rowH = 6.5;

      pdf.setFillColor(clr.primary[0], clr.primary[1], clr.primary[2]);
      pdf.setTextColor(255, 255, 255);
      bold(8);
      const headers = ['#', 'Código', 'Descripción', 'Cant.', 'P. Unit.', 'Total'];
      for (let i = 0; i < headers.length; i++) {
        pdf.text(headers[i], colX[i] + (i >= 3 ? colW[i] - 3 : 2), y + 5.5, { align: i >= 3 ? 'right' : 'left' });
        pdf.rect(colX[i], y, colW[i], headerH, 'F');
      }

      y += headerH;
      const items = q.items || [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const sku = item.product?.sku || item.sku || '-';
        const name = item.product?.name || item.productName || 'Producto';
        const qty = item.quantity;
        const price = item.price || item.total || 0;
        const total = price * qty;

        if (y + rowH > 270) {
          pdf.addPage();
          y = 25;
        }

        normal(8); color(clr.dark);
        if (i % 2 === 1) {
          pdf.setFillColor(249, 250, 251);
          pdf.rect(ml, y, contentW, rowH, 'F');
        }
        pdf.text(String(i + 1), colX[0] + 3, y + 4.5);
        pdf.text(sku, colX[1] + 2, y + 4.5);
        pdf.text(name.length > 35 ? name.substring(0, 34) + '...' : name, colX[2] + 2, y + 4.5);
        pdf.text(String(qty), colX[3] + colW[3] - 3, y + 4.5, { align: 'right' });
        pdf.text(formatCurrency(price), colX[4] + colW[4] - 3, y + 4.5, { align: 'right' });
        bold(8);
        pdf.text(formatCurrency(total), colX[5] + colW[5] - 3, y + 4.5, { align: 'right' });
        line(y + rowH - 0.5);
        y += rowH;
      }

      y += 5;

      // ── TOTALS ──
      const taxRate = settings.taxRate || 0.18;
      const sub = q.subtotal || 0;
      const tax = q.tax || 0;
      const disc = q.discount || 0;
      const totalQ = q.total || 0;
      const totalX = pw - mr - 85;

      if (y + 35 > 270) { pdf.addPage(); y = 25; }

      pdf.setFillColor(clr.light[0], clr.light[1], clr.light[2]);
      pdf.rect(totalX, y, 85, 32, 'F');
      normal(9); color(clr.gray);
      pdf.text('Subtotal:', totalX + 8, y + 7);
      pdf.text(formatCurrency(sub), totalX + 77, y + 7, { align: 'right' });
      pdf.text(`ITBIS (${(taxRate * 100).toFixed(0)}%):`, totalX + 8, y + 13.5);
      pdf.text(formatCurrency(tax), totalX + 77, y + 13.5, { align: 'right' });
      if (disc > 0) {
        color(clr.red);
        pdf.text('Descuento:', totalX + 8, y + 20);
        pdf.text(`-${formatCurrency(disc)}`, totalX + 77, y + 20, { align: 'right' });
      }
      pdf.setFillColor(clr.primary[0], clr.primary[1], clr.primary[2]);
      pdf.rect(totalX, y + (disc > 0 ? 22 : 20), 85, 10, 'F');
      bold(11); pdf.setTextColor(255, 255, 255);
      pdf.text('TOTAL:', totalX + 8, y + (disc > 0 ? 29 : 27));
      pdf.text(formatCurrency(totalQ), totalX + 77, y + (disc > 0 ? 29 : 27), { align: 'right' });

      y += disc > 0 ? 40 : 36;

      // ── CONDITIONS ──
      if (y + 45 > 270) { pdf.addPage(); y = 25; }

      pdf.setFillColor(255, 251, 230);
      pdf.rect(ml, y, contentW, 38, 'F');
      bold(9); color(clr.dark);
      pdf.text('CONDICIONES', ml + 5, y + 6);
      normal(9); color(clr.gray);
      let condY = y + 12;
      const pmLabels = { CASH: 'Efectivo', TRANSFER: 'Transferencia', CARD: 'Tarjeta', CREDIT: 'Crédito', MIXED: 'Mixto' };
      const pm = pmLabels[q.paymentMethod] || 'Efectivo, Transferencia, Tarjeta';
      pdf.text(`Forma de Pago: ${pm}`, ml + 5, condY); condY += 5.5;
      pdf.text(`Validez: ${q.validityDays || 30} días`, ml + 5, condY); condY += 5.5;
      if (q.deliveryTime) { pdf.text(`Tiempo de Entrega: ${q.deliveryTime}`, ml + 5, condY); condY += 5.5; }
      if (q.warranty) { pdf.text(`Garantía: ${q.warranty}`, ml + 5, condY); condY += 5.5; }
      if (q.notes) {
        const noteLines = pdf.splitTextToSize(`Notas: ${q.notes}`, contentW - 10);
        const noteHeight = noteLines.length * 4.5;
        if (condY + noteHeight > y + 38) {
          pdf.rect(ml, y, contentW, condY + noteHeight - y + 6, 'F');
        }
        condY = Math.max(condY + 2, y + 28);
        line(condY - 0.5);
        pdf.text(noteLines, ml + 5, condY + 1);
        condY += noteHeight;
      }

      y = Math.max(y + 45, condY + 8) + 5;

      // ── SIGNATURES ──
      if (y + 30 > 270) { pdf.addPage(); y = 25; }
      pdf.setDrawColor(38, 38, 38);
      pdf.setLineWidth(0.5);
      pdf.line(ml, y, ml + 80, y);
      pdf.line(pw - mr - 80, y, pw - mr, y);
      normal(9); color(clr.gray);
      pdf.text(settings.companyName || 'Representante', ml, y + 5);
      pdf.text('Firma', pw - mr, y + 5, { align: 'right' });

      // ── FOOTER ──
      y = 275;
      pdf.setFillColor(249, 249, 249);
      pdf.rect(ml, y, contentW, 10, 'F');
      normal(7); color(clr.gray);
      pdf.text('Esta cotización es confidencial. Los precios pueden variar sin previo aviso.', pw / 2, y + 4, { align: 'center' });
      normal(6);
      pdf.text(`Generado el ${new Date().toLocaleString('es-DO')}`, pw / 2, y + 8, { align: 'center' });

      pdf.save(`Cotizacion_${q.quotationNumber || 'COT'}.pdf`);
    } catch (error) {
      console.error('Error generando PDF:', error);
      showNotification('Error al generar el PDF. Verifica que los módulos estén instalados.', 'error');
    } finally {
      setShowPdfLoading(false);
    }
  };

  const handlePrint = async (quotation) => {
    try {
      setSelectedQuotation(quotation);
      setShowPrintModal(true);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const printQuotation = useCallback(() => {
    const printContent = document.getElementById('quotation-preview')?.innerHTML;
    if (!printContent) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (!printWindow) {
      showNotification('Permite ventanas emergentes para imprimir', 'warning');
      window.print();
      return;
    }

    const getStyles = () => {
      switch (printType) {
        case 'thermal-58':
          return `<style>
            body { font-family: 'Courier New', monospace; font-size: 10px; margin: 0; padding: 0; }
            .thermal-58 { max-width: 50mm; margin: 0 auto; padding: 2mm; box-sizing: border-box; }
            .center { text-align: center; }
            @page { size: 58mm auto; margin: 3mm; }
          </style>`;
        case 'thermal-80':
          return `<style>
            body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 0; }
            .thermal-80 { max-width: 72mm; margin: 0 auto; padding: 3mm; box-sizing: border-box; }
            .center { text-align: center; }
            @page { size: 80mm auto; margin: 3mm; }
          </style>`;
        case 'letter':
        default:
          return `<style>
            body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
            .letter { max-width: 800px; margin: 0 auto; }
            .center { text-align: center; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 8px; border: 1px solid #ddd; text-align: left; }
            @page { size: letter; margin: 0.5in; }
          </style>`;
      }
    };

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cotización ${selectedQuotation?.quotationNumber}</title>
          ${getStyles()}
        </head>
        <body>
          ${printContent}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [printType, selectedQuotation]);

  const stats = useMemo(() => ({
    total: quotations.length,
    pending: quotations.filter(q => q.status === 'PENDING').length,
    converted: quotations.filter(q => q.status === 'CONVERTED').length,
    totalValue: quotations.reduce((sum, q) => sum + q.total, 0),
  }), [quotations]);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando...</div>;

  return (
    <div>
      <div className="view-header">
        <div>
          <h1>Cotizaciones</h1>
          <p>Gestiona tus cotizaciones</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditingQuotation(null); setShowModal(true); }}>
          <i className="fas fa-plus"></i> Nueva Cotización
        </button>
      </div>

      <div className="kpi-grid" style={{ marginBottom: '24px' }}>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: 'rgba(79,70,229,0.1)', color: 'var(--primary)' }}>
            <i className="fas fa-file-alt"></i>
          </div>
          <div className="kpi-info">
            <h3>Total</h3>
            <h2>{stats.total}</h2>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: 'rgb(245,158,11)' }}>
            <i className="fas fa-clock"></i>
          </div>
          <div className="kpi-info">
            <h3>Pendientes</h3>
            <h2>{stats.pending}</h2>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: 'var(--secondary)' }}>
            <i className="fas fa-check-circle"></i>
          </div>
          <div className="kpi-info">
            <h3>Convertidas</h3>
            <h2>{stats.converted}</h2>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: 'rgb(59,130,246)' }}>
            <i className="fas fa-dollar-sign"></i>
          </div>
          <div className="kpi-info">
            <h3>Valor Total</h3>
            <h2>{formatCurrency(stats.totalValue)}</h2>
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Buscar..."
            style={{ width: '250px' }}
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
          />
          <select
            className="form-control"
            style={{ width: '180px' }}
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="PENDING">Pendiente</option>
            <option value="SENT">Enviada</option>
            <option value="ACCEPTED">Aceptada</option>
            <option value="REJECTED">Rechazada</option>
            <option value="EXPIRED">Vencida</option>
            <option value="CONVERTED">Convertida</option>
          </select>
        </div>
      </div>

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Número</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Validez</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {quotations.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>No hay cotizaciones</td></tr>
            ) : quotations.map(q => (
              <tr key={q.id}>
                <td><strong>{q.quotationNumber}</strong></td>
                <td>{new Date(q.createdAt).toLocaleDateString()}</td>
                <td>{q.client?.name || 'Sin cliente'}</td>
                <td>{q.validityDays} días</td>
                <td><strong>{formatCurrency(q.total)}</strong></td>
                <td>
                  <span className={`badge ${
                    q.status === 'PENDING' ? 'badge-warning' : 
                    q.status === 'CONVERTED' ? 'badge-success' : 'badge-danger'
                  }`}>
                    {q.status === 'PENDING' ? 'Pendiente' : q.status === 'CONVERTED' ? 'Convertida' : 'Expirada'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button className="btn btn-outline" onClick={() => handlePrint(q)} title="Imprimir" style={{ padding: '4px 8px' }}>
                      <i className="fas fa-print"></i>
                    </button>
                    <button 
                      className="btn btn-outline" 
                      onClick={() => openMessageModal(q)} 
                      title="Compartir" 
                      style={{ padding: '4px 8px', color: '#25D366', borderColor: '#25D366' }}
                    >
                      <i className="fas fa-share-alt"></i>
                    </button>
                    {q.status === 'PENDING' && (
                      <>
                        <button className="btn btn-outline" onClick={() => { setEditingQuotation(q); setShowModal(true); }} title="Editar" style={{ padding: '4px 8px' }}>
                          <i className="fas fa-edit"></i>
                        </button>
                        <button className="btn btn-outline" onClick={() => { setSelectedQuotation(q); setShowConvertModal(true); }} title="Convertir" style={{ padding: '4px 8px', color: 'var(--secondary)', borderColor: 'var(--secondary)' }}>
                          <i className="fas fa-exchange-alt"></i>
                        </button>
                      </>
                    )}
                    <button className="btn btn-outline" onClick={() => handleDelete(q.id)} title="Eliminar" style={{ padding: '4px 8px', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Mostrando {quotations.length} de {pagination.total} cotizaciones
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="btn btn-outline" 
            disabled={pagination.page === 1}
            onClick={() => handlePageChange(pagination.page - 1)}
          >
            Anterior
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            Página <strong>{pagination.page}</strong> de {pagination.totalPages}
          </div>
          <button 
            className="btn btn-outline" 
            disabled={pagination.page === pagination.totalPages}
            onClick={() => handlePageChange(pagination.page + 1)}
          >
            Siguiente
          </button>
        </div>
      </div>

      {showModal && (
        <QuotationModal
          products={products}
          clients={clients}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingQuotation(null); }}
          editingQuotation={editingQuotation}
          formatCurrency={formatCurrency}
          onCreateClient={handleCreateClient}
        />
      )}

      {showConvertModal && selectedQuotation && (
        <ConvertModal
          quotation={selectedQuotation}
          onSave={handleConvert}
          onClose={() => { setShowConvertModal(false); setSelectedQuotation(null); }}
          formatCurrency={formatCurrency}
        />
      )}

      {showPrintModal && selectedQuotation && (
        <div className="modal-overlay" onClick={() => setShowPrintModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0 }}>Vista Previa de Cotización</h2>
              <button 
                onClick={() => setShowPrintModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ×
              </button>
            </div>
            
            <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {['thermal-58', 'thermal-80', 'letter'].map(type => (
                <label 
                  key={type} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    cursor: 'pointer',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: printType === type ? 'rgba(79,70,229,0.1)' : 'transparent',
                    border: printType === type ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  }}
                >
                  <input 
                    type="radio" 
                    name="pt" 
                    checked={printType === type} 
                    onChange={() => setPrintType(type)} 
                    style={{ display: 'none' }}
                  />
                  {type === 'thermal-58' && <><i className="fas fa-receipt"></i> 58mm</>}
                  {type === 'thermal-80' && <><i className="fas fa-print"></i> 80mm</>}
                  {type === 'letter' && <><i className="fas fa-file-alt"></i> Carta</>}
                </label>
              ))}
            </div>
            
            <div 
              id="quotation-preview"
              style={{ 
                background: '#f5f5f5', 
                padding: '20px', 
                borderRadius: '8px', 
                maxHeight: '450px', 
                overflow: 'auto', 
                display: 'flex', 
                justifyContent: 'center' 
              }}
            >
              {printType === 'thermal-58' && (
                <div style={{ background: '#fff', width: '220px', padding: '10px', fontSize: '9px', fontFamily: 'monospace', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                  <QuotationReceipt58 sale={selectedQuotation} settings={settings} formatCurrency={formatCurrency} />
                </div>
              )}
              {printType === 'thermal-80' && (
                <div style={{ background: '#fff', width: '280px', padding: '15px', fontSize: '10px', fontFamily: 'monospace', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                  <QuotationReceipt80 sale={selectedQuotation} settings={settings} formatCurrency={formatCurrency} />
                </div>
              )}
              {printType === 'letter' && (
                <div style={{ background: '#fff', padding: '30px', maxWidth: '700px', width: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                  <QuotationLetterReceipt sale={selectedQuotation} settings={settings} formatCurrency={formatCurrency} />
                </div>
              )}
            </div>
            
            <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setShowPrintModal(false)}>
                <i className="fas fa-times"></i> Cerrar
              </button>
              <button className="btn btn-primary" onClick={printQuotation} style={{ background: 'var(--secondary)' }}>
                <i className="fas fa-print"></i> Imprimir Cotización
              </button>
            </div>
          </div>
        </div>
      )}

      {showMessageModal && selectedQuotation && (
        <div className="modal-overlay" onClick={() => setShowMessageModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <h2>
              <i className="fas fa-share-alt" style={{ marginRight: '10px' }}></i>
              Compartir Cotización
            </h2>
            <div style={{ padding: '16px', background: 'var(--bg-surface-hover)', borderRadius: '8px', marginBottom: '20px' }}>
              <p style={{ margin: '0 0 8px' }}><strong>Cliente:</strong> {selectedQuotation.clientName || selectedQuotation.client?.name || 'Cliente'}</p>
              <p style={{ margin: '0 0 8px' }}><strong>Teléfono:</strong> {selectedQuotation.clientPhone || selectedQuotation.client?.phone || 'No registrado'}</p>
              <p style={{ margin: 0 }}><strong>Correo:</strong> {selectedQuotation.clientEmail || selectedQuotation.client?.email || 'No registrado'}</p>
            </div>

            <div style={{ marginBottom: '16px', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', background: 'var(--bg-surface-hover)', borderBottom: '1px solid var(--border-color)', fontWeight: 600, fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><i className="fas fa-file-pdf" style={{ color: '#dc2626', marginRight: '6px' }}></i>Vista previa PDF</span>
                <button
                  className="btn btn-primary"
                  onClick={downloadPDF}
                  disabled={showPdfLoading}
                  style={{ padding: '6px 16px', fontSize: '0.85rem', background: '#dc2626', borderColor: '#dc2626' }}
                >
                  <i className={`fas ${showPdfLoading ? 'fa-spinner fa-spin' : 'fa-file-pdf'}`}></i>
                  {showPdfLoading ? 'Generando...' : 'Descargar PDF'}
                </button>
              </div>
              <div style={{ padding: '20px', maxHeight: '350px', overflow: 'auto', background: '#f5f5f5' }}>
                <div ref={pdfPreviewRef} style={{ background: '#fff', padding: '30px', maxWidth: '700px', margin: '0 auto', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', fontFamily: 'Arial, sans-serif', fontSize: '12px' }}>
                  <QuotationLetterReceipt sale={selectedQuotation} settings={settings} formatCurrency={formatCurrency} />
                </div>
              </div>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                <i className="fas fa-edit" style={{ marginRight: '6px' }}></i>
                Mensaje (editable):
              </label>
              <textarea
                className="form-control"
                value={generatedMessage}
                onChange={(e) => setGeneratedMessage(e.target.value)}
                style={{ height: '150px', resize: 'vertical', fontSize: '0.9rem', lineHeight: '1.5' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontWeight: '600', marginBottom: '8px', display: 'block', color: 'var(--secondary)' }}>
                <i className="fas fa-plus-circle" style={{ marginRight: '6px' }}></i>
                Notas adicionales (opcional):
              </label>
              <textarea
                className="form-control"
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="Agrega información específica: bancos, condiciones especiales, etc."
                style={{ height: '60px', resize: 'vertical', fontSize: '0.85rem', borderColor: 'var(--secondary)' }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                className="btn btn-primary"
                onClick={sendViaWhatsApp}
                style={{ background: '#25D366', borderColor: '#25D366', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <i className="fab fa-whatsapp"></i> WhatsApp
              </button>
              <button
                className="btn btn-primary"
                onClick={sendViaEmail}
                style={{ background: '#EA4335', borderColor: '#EA4335', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <i className="fas fa-envelope"></i> Correo
              </button>
              <button
                className="btn btn-outline"
                onClick={copyToClipboard}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`}></i>
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setShowMessageModal(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        show={showConfirmDelete}
        title="Eliminar Cotizaci&oacute;n"
        message="&iquest;Eliminar esta cotizaci&oacute;n? Esta acci&oacute;n no se puede deshacer."
        icon="fa-trash-alt"
        iconColor="#EF4444"
        confirmText="S&iacute;, eliminar"
        confirmButtonClass="btn btn-primary"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
};

export default Quotations;
