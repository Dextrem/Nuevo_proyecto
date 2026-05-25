import { useState, useEffect } from 'react';
import { clientService, saleService } from '../services/api';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { notifyDataUpdate } from '../hooks/useDataSync';
import ConfirmModal from '../components/ConfirmModal';

const AccountsReceivable = () => {
  const [accountsReceivable, setAccountsReceivable] = useState([]);
  const [summary, setSummary] = useState({ totalPending: 0, totalSales: 0, countPending: 0, countPartial: 0 });
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    invoiceNumber: '',
    clientId: '',
    status: '',
    saleStartDate: '',
    saleEndDate: '',
  });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [paymentData, setPaymentData] = useState({ amount: '', description: '' });
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedClientForMessage, setSelectedClientForMessage] = useState(null);
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('invoices'); // 'invoices' o 'pending-payments'
  const [pendingPayments, setPendingPayments] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [confirmPayment, setConfirmPayment] = useState({ show: false, id: null, action: '' });
  const { formatCurrency, showNotification } = useApp();
  const { hasPermission } = useAuth();

  useEffect(() => {
    if (activeTab === 'invoices') {
      loadAccountsReceivable();
    } else {
      loadPendingPayments();
    }
    loadClients();
  }, [filters, activeTab]);

  const loadAccountsReceivable = async () => {
    try {
      // setLoading(true); // Evitar refresco de pantalla en búsqueda
      const params = {};
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.invoiceNumber) params.invoiceNumber = filters.invoiceNumber;
      if (filters.clientId) params.clientId = filters.clientId;
      if (filters.status) params.status = filters.status;
      if (filters.saleStartDate) params.saleStartDate = filters.saleStartDate;
      if (filters.saleEndDate) params.saleEndDate = filters.saleEndDate;

      const response = await saleService.getAccountsReceivable(params);
      const salesData = Array.isArray(response.data.sales) ? response.data.sales : [];
      setAccountsReceivable(salesData);
      setSummary(response.data.summary || { totalPending: 0, totalSales: 0, countPending: 0, countPartial: 0 });
    } catch (error) {
      console.error('Error cargando cuentas por cobrar:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingPayments = async () => {
    try {
      setPendingLoading(true);
      const response = await saleService.getPendingPayments();
      setPendingPayments(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error cargando abonos pendientes:', error);
    } finally {
      setPendingLoading(false);
    }
  };

  const handleApprovePayment = (id) => {
    setConfirmPayment({ show: true, id, action: 'approve' });
  };

  const handleRejectPayment = (id) => {
    setConfirmPayment({ show: true, id, action: 'reject' });
  };

  const confirmPaymentAction = async () => {
    const { id, action } = confirmPayment;
    try {
      if (action === 'approve') {
        await saleService.approvePendingPayment(id);
        loadPendingPayments();
        notifyDataUpdate('accounts_receivable');
        showNotification('Abono aprobado exitosamente', 'success');
      } else {
        await saleService.rejectPendingPayment(id);
        loadPendingPayments();
        showNotification('Abono rechazado', 'success');
      }
    } catch (error) {
      showNotification(error.response?.data?.error || 'Error al procesar abono', 'error');
    } finally {
      setConfirmPayment({ show: false, id: null, action: '' });
    }
  };

  const cancelPaymentAction = () => {
    setConfirmPayment({ show: false, id: null, action: '' });
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      invoiceNumber: '',
      clientId: '',
      status: '',
      saleStartDate: '',
      saleEndDate: '',
    });
  };

  const loadClients = async () => {
    try {
      const response = await clientService.getAll({ active: true });
      const clientsData = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      setClients(clientsData);
    } catch (error) {
      console.error('Error loading clients:', error);
      setClients([]);
    }
  };

  const generateReminderMessage = (sale) => {
    const client = sale.client;
    const pending = sale.total - sale.paidAmount;
    const daysUntil = getDaysUntilDue(sale.dueDate);
    const dueDateFormatted = sale.dueDate ? new Date(sale.dueDate).toLocaleDateString('es-ES') : 'sin fecha definida';
    
    let message = `Estimado/a ${client?.name || 'Cliente'},\n\n`;
    message += `Reciba un cordial saludo.\n\n`;
    message += `Le escribo para recordarle sobre su factura pendiente:\n`;
    message += `• Factura: ${sale.invoiceNumber}\n`;
    message += `• Fecha de venta: ${new Date(sale.createdAt).toLocaleDateString('es-ES')}\n`;
    message += `• Fecha límite de pago: ${dueDateFormatted}\n`;
    message += `• Total de la factura: ${formatCurrency(sale.total)}\n`;
    message += `• Monto pendiente: ${formatCurrency(pending)}\n`;
    
    if (daysUntil !== null) {
      if (daysUntil < 0) {
        message += `\nLa factura está ${Math.abs(daysUntil)} días vencida. Le agradeceríamos realizar el pago a la brevedad posible para evitar cargos adicionales.\n`;
      } else if (daysUntil <= 7) {
        message += `\nLe remindamos que la fecha de vencimiento es en ${daysUntil} días. Por favor, programe su pago a tiempo.\n`;
      } else {
        message += `\nLa fecha de vencimiento es en ${daysUntil} días.\n`;
      }
    }
    
    message += `\nSi ya realizó el pago, le agradeceríamos nos informe para actualizar nuestros registros.\n`;
    message += `\nPara cualquier consulta o coordinar el pago, no dude en contactarnos.\n`;
    message += `\nGracias por su atención y preferencia.\n\n`;
    message += `Atentamente,\nSu Equipo de Cobranza`;
    
    return message;
  };

  const openMessageModal = (sale) => {
    setSelectedClientForMessage(sale);
    setGeneratedMessage(generateReminderMessage(sale));
    setCustomNotes('');
    setShowMessageModal(true);
    setCopied(false);
  };

  const getFullMessage = () => {
    const baseMessage = generatedMessage;
    if (customNotes.trim()) {
      return baseMessage + '\n\n--- NOTAS ADICIONALES ---\n' + customNotes;
    }
    return baseMessage;
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
    const client = selectedClientForMessage?.client;
    const phone = client?.phone?.replace(/\D/g, '') || '';
    if (!phone) {
      showNotification('El cliente no tiene número de teléfono registrado', 'warning');
      return;
    }
    const encodedMessage = encodeURIComponent(getFullMessage());
    window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
  };

  const sendViaEmail = () => {
    const client = selectedClientForMessage?.client;
    const email = client?.email;
    if (!email) {
      showNotification('El cliente no tiene correo electrónico registrado', 'warning');
      return;
    }
    const subject = encodeURIComponent(`Recordatorio de pago - Factura ${selectedClientForMessage.invoiceNumber}`);
    const body = encodeURIComponent(getFullMessage());
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  const handlePayment = async () => {
    if (!paymentData.amount || parseFloat(paymentData.amount) <= 0) {
      showNotification('Ingresa un monto válido', 'warning');
      return;
    }

    const pending = selectedSale.total - selectedSale.paidAmount;
    if (parseFloat(paymentData.amount) > pending) {
      showNotification('El monto excede el saldo pendiente', 'warning');
      return;
    }

    try {
      await saleService.updatePayment(selectedSale.id, {
        paidAmount: parseFloat(paymentData.amount),
        description: paymentData.description || 'Pago a cuenta'
      });

      setShowPaymentModal(false);
      setPaymentData({ amount: '', description: '' });
      setSelectedSale(null);
      loadAccountsReceivable();
      notifyDataUpdate('accounts_receivable');
      showNotification('Pago registrado exitosamente', 'success');
    } catch (error) {
      showNotification(error.response?.data?.error || 'Error al registrar pago', 'error');
    }
  };

  const openPaymentModal = (sale) => {
    setSelectedSale(sale);
    setPaymentData({ amount: (sale.total - sale.paidAmount).toString(), description: '' });
    setShowPaymentModal(true);
  };

  const getDaysUntilDue = (dueDate) => {
    if (!dueDate) return null;
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusBadge = (sale) => {
    const pending = sale.total - sale.paidAmount;
    if (pending <= 0) return <span className="badge badge-success">Pagado</span>;
    
    const daysUntil = getDaysUntilDue(sale.dueDate);
    if (daysUntil === null) return <span className="badge badge-warning">Pendiente</span>;
    if (daysUntil < 0) return <span className="badge badge-danger">Vencido</span>;
    if (daysUntil <= 7) return <span className="badge badge-info">Por vencer</span>;
    return <span className="badge badge-warning">Pendiente</span>;
  };

  if (loading && accountsReceivable.length === 0) {
    return <div className="loading">Cargando...</div>;
  }

  return (
    <div>
      <div className="view-header">
        <div>
          <h1>Cuentas por Cobrar</h1>
          <p>Gestiona las facturas a crédito de tus clientes</p>
        </div>
        <div className="kpi-card" style={{ background: 'var(--secondary)', color: 'white', padding: '16px 24px', borderRadius: '12px' }}>
          <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Total Pendiente</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{formatCurrency(summary.totalPending)}</div>
          <div style={{ fontSize: '0.8rem', opacity: '0.8' }}>{summary.countPending + summary.countPartial} facturas</div>
        </div>
      </div>

      <div className="tabs-container" style={{ marginBottom: '20px', display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
        <button 
          className={`btn ${activeTab === 'invoices' ? 'btn-primary' : 'btn-outline'}`} 
          onClick={() => setActiveTab('invoices')}
          style={{ borderRadius: '8px 8px 0 0' }}
        >
          <i className="fas fa-file-invoice-dollar"></i> Facturas Pendientes
        </button>
        <button 
          className={`btn ${activeTab === 'pending-payments' ? 'btn-primary' : 'btn-outline'}`} 
          onClick={() => setActiveTab('pending-payments')}
          style={{ position: 'relative', borderRadius: '8px 8px 0 0' }}
        >
          <i className="fas fa-clock"></i> Abonos por Aprobar
          {pendingPayments.length > 0 && (
            <span style={{ 
              position: 'absolute', 
              top: '-8px', 
              right: '-8px', 
              background: 'var(--danger)', 
              color: 'white', 
              borderRadius: '50%', 
              width: '20px', 
              height: '20px', 
              fontSize: '0.7rem', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontWeight: 'bold',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>
              {pendingPayments.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'invoices' ? (
        <>
          <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fas fa-filter" style={{ color: 'var(--text-muted)' }}></i>
            <span style={{ fontWeight: '600' }}>Filtros:</span>
          </div>
          
          <input
            type="text"
            className="form-control"
            placeholder="No. Factura..."
            style={{ width: '150px' }}
            value={filters.invoiceNumber}
            onChange={(e) => handleFilterChange('invoiceNumber', e.target.value)}
          />

          <select
            className="form-control"
            style={{ width: '180px' }}
            value={filters.clientId}
            onChange={(e) => handleFilterChange('clientId', e.target.value)}
          >
            <option value="">Todos los clientes</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
            <i className="fas fa-shopping-cart" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}></i>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Venta:</span>
          </div>

          <input
            type="date"
            className="form-control"
            style={{ width: '140px' }}
            value={filters.saleStartDate}
            onChange={(e) => handleFilterChange('saleStartDate', e.target.value)}
          />

          <span style={{ color: 'var(--text-muted)' }}>hasta</span>

          <input
            type="date"
            className="form-control"
            style={{ width: '140px' }}
            value={filters.saleEndDate}
            onChange={(e) => handleFilterChange('saleEndDate', e.target.value)}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
            <i className="fas fa-calendar" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}></i>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pago:</span>
          </div>

          <input
            type="date"
            className="form-control"
            style={{ width: '140px' }}
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
          />

          <span style={{ color: 'var(--text-muted)' }}>hasta</span>

          <input
            type="date"
            className="form-control"
            style={{ width: '140px' }}
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
          />

          <select
            className="form-control"
            style={{ width: '140px' }}
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">Todos</option>
            <option value="PENDING">Pendiente</option>
            <option value="PARTIAL">Parcial</option>
            <option value="COMPLETED">Completado</option>
          </select>

          <button className="btn btn-outline" onClick={clearFilters}>
            <i className="fas fa-times"></i> Limpiar
          </button>
        </div>
      </div>

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Factura</th>
              <th>Cliente</th>
              <th>Fecha Venta</th>
              <th>Fecha Pago</th>
              <th>Días Restantes</th>
              <th>Total</th>
              <th>Pagado</th>
              <th>Pendiente</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {accountsReceivable.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '40px' }}>
                  No hay cuentas por cobrar con los filtros seleccionados
                </td>
              </tr>
            ) : (
              accountsReceivable.map((sale) => {
                const pending = sale.total - sale.paidAmount;
                const daysUntil = getDaysUntilDue(sale.dueDate);
                return (
                  <tr key={sale.id} style={daysUntil < 0 ? { backgroundColor: 'rgba(239,68,68,0.1)' } : daysUntil <= 7 ? { backgroundColor: 'rgba(59,130,246,0.1)' } : {}}>
                    <td><strong>{sale.invoiceNumber}</strong></td>
                    <td>{sale.client?.name || 'Sin cliente'}</td>
                    <td>{new Date(sale.createdAt).toLocaleDateString()}</td>
                    <td>{sale.dueDate ? new Date(sale.dueDate).toLocaleDateString() : '-'}</td>
                    <td>
                      {daysUntil !== null && (
                        <span className={`badge ${daysUntil < 0 ? 'badge-danger' : daysUntil <= 7 ? 'badge-info' : 'badge-default'}`}>
                          {daysUntil < 0 ? `${Math.abs(daysUntil)} días vencido` : `${daysUntil} días`}
                        </span>
                      )}
                    </td>
                    <td>{formatCurrency(sale.total)}</td>
                    <td style={{ color: 'var(--secondary)' }}>{formatCurrency(sale.paidAmount)}</td>
                    <td><strong>{formatCurrency(pending)}</strong></td>
                    <td>{getStatusBadge(sale)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          className="btn btn-outline"
                          onClick={() => openMessageModal(sale)}
                          style={{ padding: '4px 8px', color: '#25D366', borderColor: '#25D366' }}
                          title="Enviar recordatorio"
                        >
                          <i className="fas fa-envelope"></i>
                        </button>
                        <button
                          className="btn btn-outline"
                          onClick={() => openPaymentModal(sale)}
                          style={{ padding: '4px 8px', color: 'var(--secondary)', borderColor: 'var(--secondary)' }}
                          title="Registrar Pago"
                          disabled={pending <= 0}
                        >
                          <i className="fas fa-dollar-sign"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha Solicitud</th>
                <th>Cliente</th>
                <th>Monto</th>
                <th>Descripción</th>
                <th>Usuario</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pendingLoading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>Cargando abonos...</td></tr>
              ) : pendingPayments.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>No hay abonos pendientes de aprobación</td></tr>
              ) : (
                pendingPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{new Date(payment.createdAt).toLocaleString()}</td>
                    <td>
                      <strong>{payment.client?.name}</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Balance actual: {formatCurrency(payment.client?.balance)}
                      </div>
                    </td>
                    <td><strong style={{ color: 'var(--secondary)' }}>{formatCurrency(payment.amount)}</strong></td>
                    <td>{payment.description || '-'}</td>
                    <td><i className="fas fa-user" style={{ fontSize: '0.8rem', marginRight: '4px' }}></i> {payment.userId}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className="btn btn-primary" 
                          onClick={() => handleApprovePayment(payment.id)}
                          style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                        >
                          <i className="fas fa-check"></i> Aprobar
                        </button>
                        <button 
                          className="btn btn-outline" 
                          onClick={() => handleRejectPayment(payment.id)}
                          style={{ padding: '6px 12px', fontSize: '0.85rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                        >
                          <i className="fas fa-times"></i> Rechazar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showPaymentModal && selectedSale && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Registrar Pago - {selectedSale.invoiceNumber}</h2>
            <div style={{ padding: '16px', background: 'var(--bg-surface-hover)', borderRadius: '8px', marginBottom: '20px' }}>
              <p style={{ margin: '0 0 8px' }}><strong>Cliente:</strong> {selectedSale.client?.name}</p>
              <p style={{ margin: '0 0 8px' }}><strong>Pendiente:</strong> <span style={{ color: 'var(--danger)' }}>{formatCurrency(selectedSale.total - selectedSale.paidAmount)}</span></p>
              <p style={{ margin: 0 }}><strong>Fecha de pago:</strong> {selectedSale.dueDate ? new Date(selectedSale.dueDate).toLocaleDateString() : 'No definida'}</p>
            </div>
            <div className="form-group">
              <label>Monto a pagar</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                value={paymentData.amount}
                onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label>Descripción</label>
              <input
                type="text"
                className="form-control"
                value={paymentData.description}
                onChange={(e) => setPaymentData({ ...paymentData, description: e.target.value })}
                placeholder="Ej: Pago parcial, Pago total"
              />
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

      {showMessageModal && selectedClientForMessage && (
        <div className="modal-overlay" onClick={() => setShowMessageModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px' }}>
            <h2>
              <i className="fas fa-paper-plane" style={{ marginRight: '10px' }}></i>
              Enviar Recordatorio de Pago
            </h2>
            <div style={{ padding: '16px', background: 'var(--bg-surface-hover)', borderRadius: '8px', marginBottom: '20px' }}>
              <p style={{ margin: '0 0 8px' }}><strong>Cliente:</strong> {selectedClientForMessage.client?.name}</p>
              <p style={{ margin: '0 0 8px' }}><strong>Teléfono:</strong> {selectedClientForMessage.client?.phone || 'No registrado'}</p>
              <p style={{ margin: 0 }}><strong>Correo:</strong> {selectedClientForMessage.client?.email || 'No registrado'}</p>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                <i className="fas fa-edit" style={{ marginRight: '6px' }}></i>
                Mensaje base (editable):
              </label>
              <textarea
                className="form-control"
                value={generatedMessage}
                onChange={(e) => setGeneratedMessage(e.target.value)}
                style={{ height: '200px', resize: 'vertical', fontSize: '0.9rem', lineHeight: '1.5' }}
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
                placeholder="Agrega información específica como: número de cuotas, intereses, datos de cuenta bancaria, etc."
                style={{ height: '100px', resize: 'vertical', fontSize: '0.85rem', borderColor: 'var(--secondary)' }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                className="btn btn-primary"
                onClick={sendViaEmail}
                style={{ background: '#EA4335', borderColor: '#EA4335', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <i className="fas fa-envelope"></i> Enviar por Correo
              </button>
              <button
                className="btn btn-primary"
                onClick={sendViaWhatsApp}
                style={{ background: '#25D366', borderColor: '#25D366', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <i className="fab fa-whatsapp"></i> Enviar por WhatsApp
              </button>
              <button
                className="btn btn-outline"
                onClick={copyToClipboard}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`}></i>
                {copied ? 'Copiado!' : 'Copiar Mensaje'}
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
        show={confirmPayment.show}
        title={confirmPayment.action === 'approve' ? 'Aprobar Abono' : 'Rechazar Abono'}
        message={confirmPayment.action === 'approve'
          ? '&iquest;Est&aacute;s seguro de aprobar este abono? Se registrar&aacute; en contabilidad y afectar&aacute; el balance del cliente.'
          : '&iquest;Est&aacute;s seguro de rechazar este abono?'
        }
        icon={confirmPayment.action === 'approve' ? 'fa-check-circle' : 'fa-times-circle'}
        iconColor={confirmPayment.action === 'approve' ? '#10B981' : '#EF4444'}
        confirmText={confirmPayment.action === 'approve' ? 'S&iacute;, aprobar' : 'S&iacute;, rechazar'}
        confirmButtonClass={confirmPayment.action === 'approve' ? 'btn btn-primary' : 'btn btn-primary'}
        onConfirm={confirmPaymentAction}
        onCancel={cancelPaymentAction}
      />
    </div>
  );
};

export default AccountsReceivable;
