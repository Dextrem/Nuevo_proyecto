import { useState, useEffect } from 'react';
import { saleService, clientService, supplierService, productService } from '../services/api';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { ThermalReceipt58, ThermalReceipt80, LetterReceipt } from '../components/POSModals';
import { notifyDataUpdate } from '../hooks/useDataSync';
import ConfirmModal from '../components/ConfirmModal';

const Billing = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('sales');
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    clientId: '',
    supplierId: '',
    paymentMethod: '',
    status: '',
    invoiceNumber: '',
    page: 1,
    limit: 15
  });
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [cancelForm, setCancelForm] = useState({ username: '', password: '' });
  const [pendingInvoiceToPrint, setPendingInvoiceToPrint] = useState(null);
  const [pendingInvoiceToCancel, setPendingInvoiceToCancel] = useState(null);
  const [showConfirmCancelInvoice, setShowConfirmCancelInvoice] = useState(false);
  const [printType, setPrintType] = useState('ticket58');
  const { formatCurrency, settings, showNotification } = useApp();
  const { hasPermission } = useAuth();

  const loadData = async () => {
    try {
      // Remover setLoading(true) para evitar parpadeo al buscar
      const [salesRes, clientsRes, suppliersRes] = await Promise.all([
        saleService.getAll(filters),
        clientService.getAll({}),
        supplierService.getAll({}),
      ]);

      const clientsData = clientsRes.data?.data || (Array.isArray(clientsRes.data) ? clientsRes.data : []);
      const suppliersData = suppliersRes.data?.data || (Array.isArray(suppliersRes.data) ? suppliersRes.data : []);
      
      const salesData = salesRes.data?.data || [];
      const paginationData = salesRes.data?.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 };

      setClients(clientsData);
      setSuppliers(suppliersData);
      setInvoices(salesData);
      setPagination(paginationData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  useEffect(() => {
    const handleDataUpdate = () => loadData();
    window.addEventListener('DATA_UPDATED_EVENT', handleDataUpdate);
    return () => window.removeEventListener('DATA_UPDATED_EVENT', handleDataUpdate);
  }, []);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      clientId: '',
      supplierId: '',
      paymentMethod: '',
      status: '',
      invoiceNumber: '',
      page: 1,
      limit: 15
    });
  };

  const requestPrintAuthorization = (invoice) => {
    setPendingInvoiceToPrint(invoice);
    setShowAuthModal(true);
    setAuthForm({ username: '', password: '' });
  };

  const handleAuthorizePrint = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const authServiceModule = await import('../services/api');
      await authServiceModule.authService.verifyAdmin(authForm.username, authForm.password);
      
      setShowAuthModal(false);
      await openPrintModal(pendingInvoiceToPrint);
    } catch (error) {
      showNotification(error.response?.data?.error || 'No autorizado para reimprimir', 'error');
    } finally {
      setLoading(false);
    }
  };

  const requestCancelAuthorization = (invoice) => {
    setPendingInvoiceToCancel(invoice);
    setShowCancelModal(true);
    setCancelForm({ username: '', password: '' });
  };

  const handleCancelSaleConfirm = () => {
    setShowConfirmCancelInvoice(true);
  };

  const executeCancelSale = async () => {
    if (!pendingInvoiceToCancel) return;

    try {
      setLoading(true);
      await saleService.cancel(pendingInvoiceToCancel.id, {
        authorizerUsername: cancelForm.username,
        authorizerPassword: cancelForm.password
      });
      
      setShowCancelModal(false);
      setShowConfirmCancelInvoice(false);
      showNotification('Venta anulada exitosamente', 'success');
      loadData();
      notifyDataUpdate();
    } catch (error) {
      showNotification(error.response?.data?.error || 'Error al anular la venta', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openPrintModal = async (invoice) => {
    try {
      const response = await saleService.getById(invoice.id);
      setSelectedInvoice(response.data);
      setShowPrintModal(true);
    } catch (error) {
      console.error('Error loading invoice details:', error);
      setSelectedInvoice(invoice);
      setShowPrintModal(true);
    }
  };

  const printInvoice = () => {
    const invoice = selectedInvoice;
    
    let htmlContent = '';
    
    if (printType === 'ticket58') {
      const itemsHTML = invoice.items?.map(item => `
        <div style="margin-bottom:2px;font-size:9px">
          <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.product?.name || 'Producto'}</div>
          <div style="display:flex;justify-content:space-between">
            <span>x${item.quantity}</span><span>${formatCurrency(item.total)}</span>
          </div>
        </div>
      `).join('') || '';
      
      htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Factura ${invoice.invoiceNumber}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: 'Courier New', monospace; font-size: 9px; margin: 0; padding: 0; }
              .thermal-58 { max-width: 50mm; margin: 0 auto; padding: 2mm; }
              .center { text-align: center; }
              .divider { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 3px 0; margin: 5px 0; }
              @page { size: 58mm auto; margin: 3mm; }
            </style>
          </head>
          <body>
            <div class="thermal-58">
              <div class="center">
                <strong style="font-size:12px">${settings.companyName}</strong>
                ${settings.companyRnc ? `<div>RNC: ${settings.companyRnc}</div>` : ''}
                ${settings.companyAddress ? `<div>${settings.companyAddress}</div>` : ''}
                <div class="divider"></div>
              </div>
              <div style="margin-bottom:5px">
                <div>F: ${new Date(invoice.createdAt).toLocaleDateString()}</div>
                <div>#${invoice.invoiceNumber}</div>
              </div>
              <div style="margin-bottom:5px">${itemsHTML}</div>
              <div style="border-top:1px dashed #000;padding-top:3px;margin-top:5px">
                <div style="display:flex;justify-content:space-between"><span>Sub:</span><span>${formatCurrency(invoice.subtotal)}</span></div>
                <div style="display:flex;justify-content:space-between"><span>ITBIS:</span><span>${formatCurrency(invoice.tax)}</span></div>
                ${invoice.discount > 0 ? `<div style="color:red"><span>Des:</span><span>-${formatCurrency(invoice.discount)}</span></div>` : ''}
                <div style="display:flex;justify-content:space-between;font-weight:bold;border-top:1px solid #000;margin-top:3px;padding-top:3px">
                  <span>TOTAL:</span><span>${formatCurrency(invoice.total)}</span>
                </div>
              </div>
              <div class="center" style="margin-top:5px">========================<br />¡GRACIAS!</div>
            </div>
          </body>
        </html>
      `;
    } else if (printType === 'ticket80') {
      const itemsHTML = invoice.items?.map(item => `
        <div style="margin-bottom:2px">
          <div>${item.product?.name || 'Producto'}</div>
          <div style="display:flex;justify-content:space-between">
            <span>x${item.quantity}</span><span>${formatCurrency(item.total)}</span>
          </div>
        </div>
      `).join('') || '';
      
      htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Factura ${invoice.invoiceNumber}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: 'Courier New', monospace; font-size: 10px; margin: 0; padding: 0; }
              .thermal-80 { max-width: 72mm; margin: 0 auto; padding: 3mm; }
              .center { text-align: center; }
              @page { size: 80mm auto; margin: 3mm; }
            </style>
          </head>
          <body>
            <div class="thermal-80">
              <div class="center" style="margin-bottom:8px">
                ${settings.logo ? `<img src="${settings.logo}" style="max-height:40px;max-width:100px" />` : ''}
                <strong style="font-size:14px">${settings.companyName}</strong>
                ${settings.companyRnc ? `<div>RNC: ${settings.companyRnc}</div>` : ''}
                ${settings.companyAddress ? `<div>${settings.companyAddress}</div>` : ''}
                <div style="margin-top:4px">----------------------------</div>
              </div>
              <div style="margin-bottom:8px">
                <div>Fecha: ${new Date(invoice.createdAt).toLocaleString()}</div>
                <div>Cajero: ${invoice.user?.name || 'N/A'}</div>
                ${invoice.client ? `<div>Cliente: ${invoice.client.name}</div>` : ''}
                <div>Factura: ${invoice.invoiceNumber}</div>
              </div>
              <div style="border-top:1px dashed #000;border-bottom:1px dashed #000;padding:4px 0;margin-bottom:8px">
                <div style="display:flex;justify-content:space-between"><span>Producto</span><span>Cant</span><span>Total</span></div>
              </div>
              <div style="margin-bottom:8px">${itemsHTML}</div>
              <div style="border-top:1px dashed #000;padding-top:4px;margin-top:8px">
                <div style="display:flex;justify-content:space-between"><span>Subtotal:</span><span>${formatCurrency(invoice.subtotal)}</span></div>
                <div style="display:flex;justify-content:space-between"><span>ITBIS:</span><span>${formatCurrency(invoice.tax)}</span></div>
                ${invoice.discount > 0 ? `<div style="color:red"><span>Desc:</span><span>-${formatCurrency(invoice.discount)}</span></div>` : ''}
                <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px;border-top:1px solid #000;margin-top:4px;padding-top:4px">
                  <span>TOTAL:</span><span>${formatCurrency(invoice.total)}</span>
                </div>
                <div style="display:flex;justify-content:space-between"><span>Pagado:</span><span>${formatCurrency(invoice.paidAmount)}</span></div>
                ${invoice.change > 0 ? `<div style="color:green"><span>Cambio:</span><span>${formatCurrency(invoice.change)}</span></div>` : ''}
              </div>
              <div class="center" style="margin-top:8px">----------------------------<br />¡Gracias por su compra!</div>
            </div>
          </body>
        </html>
      `;
    } else {
      const itemsHTML = invoice.items?.map(item => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #ddd">${item.product?.name || 'Producto'}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center">${item.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${formatCurrency(item.price)}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${formatCurrency(item.total)}</td>
        </tr>
      `).join('') || '';
      
      htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Factura ${invoice.invoiceNumber}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: Arial, sans-serif; padding: 20px; }
              .header { text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #333; }
              .info-box { background: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
              th { background: #4F46E5; color: white; padding: 10px; text-align: left; }
              .totals { text-align: right; background: #f9fafb; padding: 15px; border-radius: 8px; }
              .total-final { font-size: 18px; font-weight: bold; color: #4F46E5; margin-top: 10px; }
              .footer { text-align: center; margin-top: 30px; color: #666; }
              @page { size: letter; margin: 0.5in; }
            </style>
          </head>
          <body>
            <div class="header">
              ${settings.logo ? `<img src="${settings.logo}" style="max-height:80px;max-width:200px;margin-bottom:10px" />` : ''}
              <h2>${settings.companyName}</h2>
              ${settings.companyRnc ? `<p>RNC: ${settings.companyRnc}</p>` : ''}
              ${settings.companyAddress ? `<p>${settings.companyAddress}</p>` : ''}
              ${settings.companyPhone ? `<p>Tel: ${settings.companyPhone}</p>` : ''}
            </div>
            <div class="info-box">
              <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                <span><strong>Factura:</strong> ${invoice.invoiceNumber}</span>
                <span><strong>Fecha:</strong> ${new Date(invoice.createdAt).toLocaleString()}</span>
              </div>
              <div style="display:flex;justify-content:space-between">
                <span><strong>Cajero:</strong> ${invoice.user?.name || 'N/A'}</span>
                ${invoice.client ? `<span><strong>Cliente:</strong> ${invoice.client.name}</span>` : ''}
              </div>
            </div>
            <table>
              <thead><tr><th>Producto</th><th>Cant</th><th>Precio</th><th>Total</th></tr></thead>
              <tbody>${itemsHTML}</tbody>
            </table>
            <div class="totals">
              <div><strong>Subtotal:</strong> ${formatCurrency(invoice.subtotal)}</div>
              <div><strong>ITBIS:</strong> ${formatCurrency(invoice.tax)}</div>
              ${invoice.discount > 0 ? `<div style="color:red"><strong>Descuento:</strong> -${formatCurrency(invoice.discount)}</div>` : ''}
              <div class="total-final">TOTAL: ${formatCurrency(invoice.total)}</div>
            </div>
            <div class="footer">
              <p>Gracias por su preferencia</p>
              <p>${settings.companyWebsite || 'www.finandex.com'}</p>
            </div>
          </body>
        </html>
      `;
    }

    const printWindow = window.open('', '_blank', printType === 'letter' ? 'width=800,height=600' : 'width=400,height=600');
    if (!printWindow) {
      showNotification('Permite ventanas emergentes para imprimir', 'warning');
      return;
    }
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const stats = {
    total: pagination.total,
    // Note: totalAmount here might be partial if we only fetch one page. 
    // Ideally the backend should return a summary too. 
    // For now we use the current invoices total as a sample.
    totalAmount: invoices.reduce((sum, inv) => sum + inv.total, 0),
    cash: invoices.filter(i => i.paymentMethod === 'CASH').reduce((sum, inv) => sum + inv.total, 0),
    card: invoices.filter(i => i.paymentMethod === 'CARD').reduce((sum, inv) => sum + inv.total, 0),
    credit: invoices.filter(i => i.paymentMethod === 'CREDIT').reduce((sum, inv) => sum + inv.total, 0),
    pending: invoices.filter(i => i.status !== 'COMPLETED').reduce((sum, inv) => sum + (inv.total - inv.paidAmount), 0),
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando facturas...</div>;
  }

  return (
    <div>
      <div className="view-header">
        <div>
          <h1>Facturación</h1>
          <p>Gestiona todas las facturas</p>
        </div>
      </div>

      <div className="kpi-grid" style={{ marginBottom: '24px' }}>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: 'rgba(79,70,229,0.1)', color: 'var(--primary)' }}>
            <i className="fas fa-file-invoice"></i>
          </div>
          <div className="kpi-info">
            <h3>Total Facturas</h3>
            <h2>{stats.total}</h2>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: 'var(--secondary)' }}>
            <i className="fas fa-dollar-sign"></i>
          </div>
          <div className="kpi-info">
            <h3>Total Ingresos</h3>
            <h2>{formatCurrency(stats.totalAmount)}</h2>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: 'rgb(59,130,246)' }}>
            <i className="fas fa-money-bill"></i>
          </div>
          <div className="kpi-info">
            <h3>Efectivo</h3>
            <h2>{formatCurrency(stats.cash)}</h2>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: 'rgb(245,158,11)' }}>
            <i className="fas fa-credit-card"></i>
          </div>
          <div className="kpi-info">
            <h3>Crédito</h3>
            <h2>{formatCurrency(stats.credit)}</h2>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>
            <i className="fas fa-exclamation-triangle"></i>
          </div>
          <div className="kpi-info">
            <h3>Pendiente</h3>
            <h2>{formatCurrency(stats.pending)}</h2>
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Buscar factura..."
            style={{ width: '150px' }}
            value={filters.invoiceNumber}
            onChange={(e) => handleFilterChange('invoiceNumber', e.target.value)}
          />

          <select
            className="form-control"
            style={{ width: '160px' }}
            value={filters.clientId}
            onChange={(e) => handleFilterChange('clientId', e.target.value)}
          >
            <option value="">Todos los clientes</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>

          <select
            className="form-control"
            style={{ width: '130px' }}
            value={filters.paymentMethod}
            onChange={(e) => handleFilterChange('paymentMethod', e.target.value)}
          >
            <option value="">Método</option>
            <option value="CASH">Efectivo</option>
            <option value="CARD">Tarjeta</option>
            <option value="CREDIT">Crédito</option>
          </select>

          <select
            className="form-control"
            style={{ width: '130px' }}
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">Estado</option>
            <option value="COMPLETED">Completada</option>
            <option value="PENDING">Pendiente</option>
            <option value="PARTIAL">Parcial</option>
            <option value="CANCELLED">Cancelada</option>
          </select>

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
              <th>Fecha</th>
              <th>Cajero</th>
              <th>Cliente</th>
              <th>Método</th>
              <th>Subtotal</th>
              <th>ITBIS</th>
              <th>Total</th>
              <th>Pagado</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '40px' }}>
                  No hay facturas registradas
                </td>
              </tr>
            ) : invoices.map(invoice => (
              <tr key={invoice.id}>
                <td><strong>{invoice.invoiceNumber}</strong></td>
                <td>{new Date(invoice.createdAt).toLocaleDateString()}</td>
                <td>{invoice.user?.name || invoice.user?.username || 'N/A'}</td>
                <td>{invoice.client?.name || 'Venta General'}</td>
                <td>
                  <span className={`badge ${
                    invoice.paymentMethod === 'CASH' ? 'badge-success' : 
                    invoice.paymentMethod === 'CARD' ? '' : 'badge-warning'
                  }`}>
                    {invoice.paymentMethod === 'CASH' ? 'Efectivo' : 
                     invoice.paymentMethod === 'CARD' ? 'Tarjeta' : 'Crédito'}
                  </span>
                </td>
                <td>{formatCurrency(invoice.subtotal)}</td>
                <td>{formatCurrency(invoice.tax)}</td>
                <td><strong>{formatCurrency(invoice.total)}</strong></td>
                <td style={{ color: 'var(--secondary)' }}>{formatCurrency(invoice.paidAmount)}</td>
                <td>
                  <span className={`badge ${
                    invoice.status === 'COMPLETED' ? 'badge-success' : 
                    invoice.status === 'PENDING' ? 'badge-warning' : 'badge-danger'
                  }`}>
                    {invoice.status === 'COMPLETED' ? 'Pagada' : 
                     invoice.status === 'PENDING' ? 'Pendiente' : 
                     invoice.status === 'PARTIAL' ? 'Parcial' : 'Cancelada'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      className="btn btn-outline"
                      onClick={() => requestPrintAuthorization(invoice)}
                      style={{ padding: '4px 8px' }}
                      title="Imprimir"
                    >
                      <i className="fas fa-print"></i>
                    </button>
                    {invoice.status !== 'CANCELLED' && (
                      <button
                        className="btn btn-outline"
                        onClick={() => requestCancelAuthorization(invoice)}
                        style={{ padding: '4px 8px', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.2)' }}
                        title="Anular Factura"
                      >
                        <i className="fas fa-ban"></i>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Mostrando {invoices.length} de {pagination.total} facturas
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

      {showPrintModal && selectedInvoice && (
        <div className="modal-overlay" onClick={() => setShowPrintModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h2>Imprimir Factura</h2>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Tipo de impresión:</label>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="printType"
                    value="ticket58"
                    checked={printType === 'ticket58'}
                    onChange={(e) => setPrintType(e.target.value)}
                  />
                  <i className="fas fa-receipt"></i> Ticket (58mm)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="printType"
                    value="ticket80"
                    checked={printType === 'ticket80'}
                    onChange={(e) => setPrintType(e.target.value)}
                  />
                  <i className="fas fa-receipt"></i> Ticket (80mm)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="printType"
                    value="letter"
                    checked={printType === 'letter'}
                    onChange={(e) => setPrintType(e.target.value)}
                  />
                  <i className="fas fa-file-alt"></i> Carta
                </label>
              </div>
            </div>

            <div style={{ 
              background: '#f5f5f5', 
              border: '1px solid #ddd', 
              padding: '20px', 
              borderRadius: '8px',
              marginBottom: '16px',
              maxHeight: '400px',
              overflow: 'auto',
              display: 'flex',
              justifyContent: 'center'
            }}>
              {printType === 'ticket58' && (
                <div style={{ 
                  background: '#fff', 
                  width: '220px', 
                  padding: '10px',
                  fontFamily: "'Courier New', monospace",
                  fontSize: '9px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <ThermalReceipt58 sale={selectedInvoice} settings={settings} formatCurrency={formatCurrency} />
                </div>
              )}
              {printType === 'ticket80' && (
                <div style={{ 
                  background: '#fff', 
                  width: '280px', 
                  padding: '15px',
                  fontFamily: "'Courier New', monospace",
                  fontSize: '10px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <ThermalReceipt80 sale={selectedInvoice} settings={settings} formatCurrency={formatCurrency} />
                </div>
              )}
              {printType === 'letter' && (
                <div style={{ 
                  background: '#fff', 
                  padding: '30px', 
                  fontSize: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  maxWidth: '700px',
                  width: '100%'
                }}>
                  <LetterReceipt sale={selectedInvoice} settings={settings} formatCurrency={formatCurrency} />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setShowPrintModal(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={printInvoice}>
                <i className="fas fa-print"></i> Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h2 style={{ color: 'var(--accent)', marginBottom: '16px' }}><i className="fas fa-lock"></i> Autorización Requerida</h2>
            <p style={{ marginBottom: '20px', color: 'var(--text-muted)' }}>Para reimprimir esta factura, se necesitan credenciales de un administrador.</p>
            <form onSubmit={handleAuthorizePrint}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label>Usuario</label>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="Usuario Administrador" 
                  value={authForm.username} 
                  onChange={(e) => setAuthForm({...authForm, username: e.target.value})} 
                  required 
                  autoFocus
                />
              </div>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label>Contraseña</label>
                <input 
                  type="password" 
                  className="form-control"
                  placeholder="Contraseña" 
                  value={authForm.password} 
                  onChange={(e) => setAuthForm({...authForm, password: e.target.value})} 
                  required 
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                  {loading ? 'Verificando...' : 'Autorizar'}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setShowAuthModal(false)} style={{ flex: 1 }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="modal-overlay" onClick={() => setShowCancelModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h2 style={{ color: 'var(--danger)', marginBottom: '16px' }}><i className="fas fa-exclamation-triangle"></i> Anular Factura</h2>
            <p style={{ marginBottom: '20px', color: 'var(--text-muted)' }}>
              Se requiere autorización de un <strong>Supervisor</strong> o <strong>Administrador</strong> para anular la factura <strong>{pendingInvoiceToCancel?.invoiceNumber}</strong>.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); handleCancelSaleConfirm(); }}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label>Usuario Supervisor</label>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="Usuario Supervisor" 
                  value={cancelForm.username} 
                  onChange={(e) => setCancelForm({...cancelForm, username: e.target.value})} 
                  required 
                  autoFocus
                />
              </div>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label>Contraseña</label>
                <input 
                  type="password" 
                  className="form-control"
                  placeholder="Contraseña" 
                  value={cancelForm.password} 
                  onChange={(e) => setCancelForm({...cancelForm, password: e.target.value})} 
                  required 
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, backgroundColor: 'var(--danger)' }} disabled={loading}>
                  {loading ? 'Procesando...' : 'Anular Venta'}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setShowCancelModal(false)} style={{ flex: 1 }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        show={showConfirmCancelInvoice}
        title="Anular Factura"
        message={pendingInvoiceToCancel ? `&iquest;Est&aacute; seguro que desea ANULAR la factura ${pendingInvoiceToCancel.invoiceNumber}? Esta acci&oacute;n devolver&aacute; el stock y reversar&aacute; los pagos.` : ''}
        icon="fa-ban"
        iconColor="#EF4444"
        confirmText="S&iacute;, anular"
        confirmButtonClass="btn btn-primary"
        onConfirm={executeCancelSale}
        onCancel={() => setShowConfirmCancelInvoice(false)}
      />
    </div>
  );
};

export default Billing;
