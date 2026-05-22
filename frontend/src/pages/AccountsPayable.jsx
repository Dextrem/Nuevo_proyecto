import { useState, useEffect } from 'react';
import { supplierService, financialReportService } from '../services/api';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { notifyDataUpdate } from '../hooks/useDataSync';

const AccountsPayable = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showGlobalNewDebtModal, setShowGlobalNewDebtModal] = useState(false);
  const [globalSupplierId, setGlobalSupplierId] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [dueFilter, setDueFilter] = useState('all');
  const [agingData, setAgingData] = useState(null);
  const [notificationText, setNotificationText] = useState('');
  const [allSuppliers, setAllSuppliers] = useState([]);
  const { formatCurrency } = useApp();
  const { hasPermission } = useAuth();

  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNumber: '',
    description: '',
    amount: '',
    dueDate: '',
    notes: '',
    document: '',
    documentName: ''
  });

  useEffect(() => {
    loadSuppliers();
    loadAging();
  }, []);

  const generateAgingNotificationText = (suppliersCount, totalAmount) => {
    if (!agingData) return 'No hay datos de CxP disponibles.';

    return `Cuentas por Pagar - Total: ${formatCurrency(totalAmount)}\n` +
      `Proveedores con deuda: ${suppliersCount}\n` +
      `Vencido: ${formatCurrency(agingData.overdue)}\n` +
      `0-30: ${formatCurrency(agingData['1-30'])}\n` +
      `31-60: ${formatCurrency(agingData['31-60'])}\n` +
      `61-90: ${formatCurrency(agingData['61-90'])}\n` +
      `91+: ${formatCurrency(agingData['91+'])}\n` +
      `Por vencer 7d: ${formatCurrency(agingData.dueSoon7)}`;
  };

  const shareViaEmail = (text) => {
    const subject = encodeURIComponent('Alerta CxP - FINANDEX');
    const body = encodeURIComponent(text);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  const shareViaWhatsApp = (text) => {
    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
  };

  const copyNotification = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Texto de notificación copiado al portapapeles');
    } catch (err) {
      console.error('Error copiando texto:', err);
      alert('No se pudo copiar al portapapeles');
    }
  };

  const loadAging = async () => {
    try {
      const response = await financialReportService.getAccountsPayable();
      setAgingData(response.data.aging || null);
    } catch (error) {
      console.error('Error cargando aging CxP:', error);
    }
  };

  const loadSuppliers = async () => {
    try {
      // setLoading(true); // Evitar refresco de pantalla en búsqueda
      const response = await supplierService.getAll({ active: true });
      const suppliersList = response.data?.data || response.data || [];
      const suppliersWithDebt = suppliersList.filter(s => s.balance > 0 || s.totalPending > 0);
      setSuppliers(suppliersWithDebt);
      setAllSuppliers(suppliersList);
    } catch (error) {
      console.error('Error loading suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSupplierDetails = async (supplier) => {
    try {
      setSelectedSupplier(supplier);
      const response = await supplierService.getInvoices(supplier.id);
      const data = response.data?.data || response.data;
      setInvoices(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading invoices:', error);
      setInvoices([]);
    }
  };

  const handleOpenInvoiceModal = (supplier, invoice = null) => {
    if (invoice) {
      setEditingInvoice(invoice);
      setInvoiceForm({
        invoiceNumber: invoice.invoiceNumber || '',
        description: invoice.description,
        amount: invoice.amount.toString(),
        dueDate: invoice.dueDate ? invoice.dueDate.split('T')[0] : '',
        notes: invoice.notes || '',
        document: invoice.document || '',
        documentName: invoice.documentName || ''
      });
    } else {
      setEditingInvoice(null);
      setInvoiceForm({
        invoiceNumber: '',
        description: '',
        amount: '',
        dueDate: '',
        notes: '',
        document: '',
        documentName: ''
      });
    }
    setShowInvoiceModal(true);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('El archivo debe ser menor a 5MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setInvoiceForm({
          ...invoiceForm,
          document: reader.result,
          documentName: file.name
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitInvoice = async (e) => {
    e.preventDefault();
    
    if (!invoiceForm.description || !invoiceForm.amount) {
      alert('Completa los campos requeridos');
      return;
    }

    try {
      if (editingInvoice) {
        await supplierService.updateInvoice(selectedSupplier.id, editingInvoice.id, {
          ...invoiceForm,
          amount: parseFloat(invoiceForm.amount)
        });
        alert('Factura actualizada');
      } else {
        const targetSupplierId = showGlobalNewDebtModal ? globalSupplierId : selectedSupplier.id;
        await supplierService.createInvoice(targetSupplierId, {
          ...invoiceForm,
          amount: parseFloat(invoiceForm.amount)
        });
        alert('Factura agregada y declarada correctamente en CxP');
      }

      setShowInvoiceModal(false);
      setShowGlobalNewDebtModal(false);
      
      if (!showGlobalNewDebtModal && selectedSupplier) {
        loadSupplierDetails(selectedSupplier);
      }
      
      loadSuppliers();
      notifyDataUpdate('accounts_payable');
    } catch (error) {
      alert(error.response?.data?.error || 'Error al guardar factura');
    }
  };

  const handleDeleteInvoice = async (invoice) => {
    if (!confirm('¿Eliminar esta factura?')) return;

    try {
      await supplierService.deleteInvoice(selectedSupplier.id, invoice.id);
      loadSupplierDetails(selectedSupplier);
      loadSuppliers();
      alert('Factura eliminada');
    } catch (error) {
      alert(error.response?.data?.error || 'Error al eliminar');
    }
  };

  const isInvoiceOverdue = (invoice) => {
    if (!invoice.dueDate || invoice.paid) return false;
    const today = new Date();
    const due = new Date(invoice.dueDate);
    const pending = invoice.amount - invoice.paidAmount;
    return pending > 0 && due < today;
  };

  const getFilteredInvoices = () => {
    let filtered = invoices;

    if (statusFilter === 'pending') {
      filtered = filtered.filter((i) => !i.paid);
    } else if (statusFilter === 'paid') {
      filtered = filtered.filter((i) => i.paid);
    }

    if (dueFilter === 'overdue') {
      filtered = filtered.filter((i) => isInvoiceOverdue(i));
    } else if (dueFilter === 'next7') {
      const today = new Date();
      const next7 = new Date();
      next7.setDate(today.getDate() + 7);
      filtered = filtered.filter((i) => {
        if (!i.dueDate || i.paid) return false;
        const due = new Date(i.dueDate);
        return due >= today && due <= next7;
      });
    }

    return filtered;
  };

  const handleOpenPaymentModal = (invoice = null) => {
    setPaymentInvoice(invoice);
    setPaymentAmount(invoice ? (invoice.amount - invoice.paidAmount).toString() : '');
    setShowPaymentModal(true);
  };

  const handlePayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      alert('Ingresa un monto válido');
      return;
    }

    if (!selectedSupplier) {
      alert('Selecciona primero un proveedor');
      return;
    }

    let remainingAmount = parseFloat(paymentAmount);
    const invoicesForPayment = paymentInvoice ? [paymentInvoice] : invoices.filter((i) => !i.paid);

    try {
      for (const invoice of invoicesForPayment) {
        if (remainingAmount <= 0) break;

        const pendingAmount = invoice.amount - invoice.paidAmount;
        const paymentForThisInvoice = Math.min(remainingAmount, pendingAmount);

        await supplierService.recordPayment(selectedSupplier.id, {
          invoiceId: invoice.id,
          amount: paymentForThisInvoice,
        });

        remainingAmount -= paymentForThisInvoice;
      }

      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentInvoice(null);
      loadSupplierDetails(selectedSupplier);
      loadSuppliers();
      notifyDataUpdate('accounts_payable');
      alert('Pago registrado exitosamente');
    } catch (error) {
      alert(error.response?.data?.error || 'Error al registrar pago');
    }
  };


  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.phone?.includes(searchTerm)
  );

  const totalPending = suppliers.reduce((sum, s) => sum + (s.balance || s.totalPending || 0), 0);

  const displayedInvoices = getFilteredInvoices();

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  return (
    <div>
      <div className="view-header">
        <div>
          <h1>Cuentas por Pagar</h1>
          <p>Gestiona las facturas pendientes a proveedores</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditingInvoice(null);
              setGlobalSupplierId('');
              setInvoiceForm({ invoiceNumber: '', description: '', amount: '', dueDate: '', notes: '', document: '', documentName: '' });
              setShowGlobalNewDebtModal(true);
            }}
          >
            <i className="fas fa-plus"></i> Añadir Deuda
          </button>
          <button
            className="btn btn-outline"
            onClick={() => {
              const text = generateAgingNotificationText(suppliers.length, totalPending);
              shareViaEmail(text);
            }}
          >
            <i className="fas fa-envelope"></i> Email
          </button>
          <button
            className="btn btn-outline"
            onClick={() => {
              const text = generateAgingNotificationText(suppliers.length, totalPending);
              shareViaWhatsApp(text);
            }}
          >
            <i className="fab fa-whatsapp"></i> WhatsApp
          </button>
          <button
            className="btn btn-outline"
            onClick={() => {
              const text = generateAgingNotificationText(suppliers.length, totalPending);
              copyNotification(text);
            }}
          >
            <i className="fas fa-copy"></i> Copiar
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: agingData ? '1fr 1fr 1fr 1fr 1fr 1fr' : '1fr', gap: '12px', width: '100%' }}>
          <div className="kpi-card" style={{ background: 'var(--danger)', color: 'white', padding: '16px 20px', borderRadius: '12px' }}>
            <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Total a Pagar</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{formatCurrency(totalPending)}</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{suppliers.length} proveedores con deuda</div>
          </div>
          {agingData && (
            <>
              <div className="kpi-card" style={{ background: 'var(--warning)', color: 'white', padding: '16px 20px', borderRadius: '12px' }}>
                <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Vencido</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{formatCurrency(agingData.overdue)}</div>
              </div>
              <div className="kpi-card" style={{ background: 'var(--info)', color: 'white', padding: '16px 20px', borderRadius: '12px' }}>
                <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>0-30 días</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{formatCurrency(agingData['1-30'])}</div>
              </div>
              <div className="kpi-card" style={{ background: 'var(--primary)', color: 'white', padding: '16px 20px', borderRadius: '12px' }}>
                <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>31-60 días</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{formatCurrency(agingData['31-60'])}</div>
              </div>
              <div className="kpi-card" style={{ background: 'var(--success)', color: 'white', padding: '16px 20px', borderRadius: '12px' }}>
                <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>61-90 días</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{formatCurrency(agingData['61-90'])}</div>
              </div>
              <div className="kpi-card" style={{ background: 'var(--neutral)', color: 'white', padding: '16px 20px', borderRadius: '12px' }}>
                <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>91+ días</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{formatCurrency(agingData['91+'])}</div>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '24px' }}>
        <input
          type="text"
          className="form-control"
          placeholder="Buscar proveedor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedSupplier ? '1fr 1.5fr' : '1fr', gap: '24px' }}>
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Contacto</th>
                <th>Saldo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '40px' }}>
                    No hay proveedores con saldo pendiente
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <tr 
                    key={supplier.id}
                    style={{ 
                      backgroundColor: selectedSupplier?.id === supplier.id ? 'var(--bg-surface-hover)' : 'transparent',
                      cursor: 'pointer'
                    }}
                    onClick={() => loadSupplierDetails(supplier)}
                  >
                    <td>
                      <strong>{supplier.name}</strong>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>
                        {supplier.phone && <div>{supplier.phone}</div>}
                        {supplier.email && <div style={{ color: 'var(--text-muted)' }}>{supplier.email}</div>}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-danger">
                        {formatCurrency(supplier.balance || supplier.totalPending || 0)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          className="btn btn-outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenInvoiceModal(supplier);
                          }}
                          style={{ padding: '4px 8px' }}
                          title="Agregar Factura"
                        >
                          <i className="fas fa-plus"></i>
                        </button>
                        {(supplier.balance > 0 || supplier.totalPending > 0) && (
                          <button
                            className="btn btn-outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSupplier(supplier);
                              loadSupplierDetails(supplier);
                              setShowPaymentModal(true);
                            }}
                            style={{ padding: '4px 8px', color: 'var(--secondary)', borderColor: 'var(--secondary)' }}
                            title="Registrar Pago"
                          >
                            <i className="fas fa-dollar-sign"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {selectedSupplier && (
          <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>{selectedSupplier.name}</h3>
              <button className="btn btn-outline" onClick={() => setSelectedSupplier(null)} style={{ padding: '4px 8px' }}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div style={{ padding: '12px', background: 'var(--bg-surface-hover)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Saldo Pendiente</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--danger)' }}>
                  {formatCurrency(selectedSupplier.balance || 0)}
                </div>
              </div>
              <div style={{ padding: '12px', background: 'var(--bg-surface-hover)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Facturas Pendientes</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>
                  {invoices.filter(i => !i.paid).length}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <h4 style={{ margin: 0 }}>Facturas</h4>
              <button className="btn btn-primary btn-sm" onClick={() => handleOpenInvoiceModal(selectedSupplier)}>
                <i className="fas fa-plus"></i> Nueva Factura
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              <select className="form-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ maxWidth: '180px' }}>
                <option value="all">Todas</option>
                <option value="pending">Pendientes</option>
                <option value="paid">Pagadas</option>
              </select>
              <select className="form-control" value={dueFilter} onChange={(e) => setDueFilter(e.target.value)} style={{ maxWidth: '220px' }}>
                <option value="all">Todos los vencimientos</option>
                <option value="overdue">Vencidos</option>
                <option value="next7">Vence en 7 días</option>
              </select>
            </div>

            <div className="data-table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>No. Factura</th>
                    <th>Descripción</th>
                    <th>Fecha Venc.</th>
                    <th>Total</th>
                    <th>Pagado</th>
                    <th>Estado</th>
                    <th>Doc</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedInvoices.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '20px' }}>
                        No hay facturas registradas
                      </td>
                    </tr>
                  ) : (
                    displayedInvoices.map((invoice) => {
                      const pending = invoice.amount - invoice.paidAmount;
                      const overdue = isInvoiceOverdue(invoice);
                      return (
                        <tr key={invoice.id}>
                          <td><strong>{invoice.invoiceNumber || '-'}</strong></td>
                          <td style={{ fontSize: '0.85rem' }}>{invoice.description}</td>
                          <td>{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '-'}</td>
                          <td>{formatCurrency(invoice.amount)}</td>
                          <td style={{ color: 'var(--secondary)' }}>{formatCurrency(invoice.paidAmount)}</td>
                          <td>
                            <span className={`badge ${invoice.paid ? 'badge-success' : overdue ? 'badge-danger' : 'badge-warning'}`}>
                              {invoice.paid ? 'Pagada' : overdue ? 'Vencida' : formatCurrency(pending)}
                            </span>
                          </td>
                          <td>
                            {invoice.document ? (
                              <a 
                                href={invoice.document} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ color: 'var(--primary)' }}
                                title="Ver documento"
                              >
                                <i className="fas fa-file-pdf"></i>
                              </a>
                            ) : '-'}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '2px' }}>
                              {!invoice.paid && (
                                <button
                                  className="btn btn-outline"
                                  onClick={() => handleOpenPaymentModal(invoice)}
                                  style={{ padding: '2px 6px', color: 'var(--success)', borderColor: 'var(--success)' }}
                                  title="Pagar"
                                >
                                  <i className="fas fa-dollar-sign"></i>
                                </button>
                              )}
                              {!invoice.paid && (
                                <button
                                  className="btn btn-outline"
                                  onClick={() => handleOpenInvoiceModal(selectedSupplier, invoice)}
                                  style={{ padding: '2px 6px' }}
                                  title="Editar"
                                >
                                  <i className="fas fa-edit"></i>
                                </button>
                              )}
                              {!invoice.paid && (
                                <button
                                  className="btn btn-outline"
                                  onClick={() => handleDeleteInvoice(invoice)}
                                  style={{ padding: '2px 6px', color: 'var(--danger)' }}
                                  title="Eliminar"
                                >
                                  <i className="fas fa-trash"></i>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal original para agregar factura a proveedor ya seleccionado */}
      {showInvoiceModal && selectedSupplier && (
        <div className="modal-overlay" onClick={() => setShowInvoiceModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h2>{editingInvoice ? 'Editar Factura' : 'Nueva Factura'}</h2>
            <form onSubmit={handleSubmitInvoice}>
              <div className="form-group">
                <label>Número de Factura</label>
                <input
                  type="text"
                  className="form-control"
                  value={invoiceForm.invoiceNumber}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })}
                  placeholder="Ej: FAC-001"
                />
              </div>
              <div className="form-group">
                <label>Descripción *</label>
                <input
                  type="text"
                  className="form-control"
                  value={invoiceForm.description}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })}
                  placeholder="Ej: Compra de mercancía"
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Monto *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={invoiceForm.amount}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Fecha Vencimiento</label>
                  <input
                    type="date"
                    className="form-control"
                    value={invoiceForm.dueDate}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Documento (opcional)</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                  className="form-control"
                />
                {invoiceForm.documentName && (
                  <small style={{ color: 'var(--secondary)', marginTop: '4px', display: 'block' }}>
                    <i className="fas fa-check"></i> {invoiceForm.documentName}
                  </small>
                )}
              </div>
              <div className="form-group">
                <label>Notas</label>
                <textarea
                  className="form-control"
                  value={invoiceForm.notes}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                  rows="2"
                  placeholder="Notas adicionales..."
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="submit" className="btn btn-primary">
                  {editingInvoice ? 'Actualizar' : 'Guardar'}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setShowInvoiceModal(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal global nuevo para crear deuda con cualquier proveedor */}
      {showGlobalNewDebtModal && (
        <div className="modal-overlay" onClick={() => setShowGlobalNewDebtModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h2>Registrar Nueva Deuda (CxP)</h2>
            <form onSubmit={handleSubmitInvoice}>
              <div className="form-group">
                <label>Proveedor *</label>
                <select 
                  className="form-control" 
                  value={globalSupplierId} 
                  onChange={(e) => setGlobalSupplierId(e.target.value)} 
                  required
                >
                  <option value="">-- Seleccione un Proveedor --</option>
                  {allSuppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} {s.rnc ? `(RNC: ${s.rnc})` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Número de Factura</label>
                <input
                  type="text"
                  className="form-control"
                  value={invoiceForm.invoiceNumber}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })}
                  placeholder="Ej: FAC-001"
                />
              </div>
              <div className="form-group">
                <label>Descripción *</label>
                <input
                  type="text"
                  className="form-control"
                  value={invoiceForm.description}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })}
                  placeholder="Ej: Prestamo o Compra a crédito"
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Monto *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={invoiceForm.amount}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Fecha Vencimiento</label>
                  <input
                    type="date"
                    className="form-control"
                    value={invoiceForm.dueDate}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Documento (opcional)</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                  className="form-control"
                />
                {invoiceForm.documentName && (
                  <small style={{ color: 'var(--secondary)', marginTop: '4px', display: 'block' }}>
                    <i className="fas fa-check"></i> {invoiceForm.documentName}
                  </small>
                )}
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="submit" className="btn btn-primary" disabled={!globalSupplierId}>
                  Registrar Deuda
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setShowGlobalNewDebtModal(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPaymentModal && selectedSupplier && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Registrar Pago a Proveedor</h2>
            <div style={{ padding: '16px', background: 'var(--bg-surface-hover)', borderRadius: '8px', marginBottom: '20px' }}>
              <p style={{ margin: '0 0 8px' }}><strong>Proveedor:</strong> {selectedSupplier.name}</p>
              <p style={{ margin: '0 0 8px' }}><strong>Saldo pendiente:</strong> <span style={{ color: 'var(--danger)' }}>{formatCurrency(selectedSupplier.balance || 0)}</span></p>
              {paymentInvoice && (
                <p style={{ margin: 0 }}><strong>Factura:</strong> {paymentInvoice.invoiceNumber || paymentInvoice.description} (<small>{paymentInvoice.dueDate ? new Date(paymentInvoice.dueDate).toLocaleDateString() : 'Sin fecha'}</small>)</p>
              )}
            </div>
            <div className="form-group">
              <label>Monto a pagar</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
              />
              <small style={{ color: 'var(--text-muted)' }}>
                {paymentInvoice
                  ? 'Monto máximo: ' + formatCurrency(paymentInvoice.amount - paymentInvoice.paidAmount)
                  : 'El pago se aplicará a las facturas más antiguas primero'}
              </small>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button className="btn btn-primary" onClick={handlePayment}>
                Registrar Pago
              </button>
              <button className="btn btn-outline" onClick={() => setShowPaymentModal(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountsPayable;
