import { useState, useEffect, useCallback, useRef } from 'react';
import { warrantyService, clientService } from '../services/api';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/Pagination';
import ConfirmModal from '../components/ConfirmModal';
import { generateWarrantyPDF } from '../utils/warrantyPDF';

const WarrantyStatus = {
  ACTIVE: 'active',
  EXPIRING_SOON: 'expiring',
  EXPIRED: 'expired',
};

const getWarrantyStatus = (expiryDate) => {
  const now = new Date();
  const expiry = new Date(expiryDate);
  if (expiry < now) return WarrantyStatus.EXPIRED;
  const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
  if (diffDays <= 30) return WarrantyStatus.EXPIRING_SOON;
  return WarrantyStatus.ACTIVE;
};

const statusLabel = {
  [WarrantyStatus.ACTIVE]: { text: 'Activa', className: 'badge-success' },
  [WarrantyStatus.EXPIRING_SOON]: { text: 'Por vencer', className: 'badge-warning' },
  [WarrantyStatus.EXPIRED]: { text: 'Vencida', className: 'badge-danger' },
};

const Warranties = () => {
  const { formatCurrency, formatDate, showNotification, settings } = useApp();
  const { user } = useAuth();

  // Data state
  const [warranties, setWarranties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [clients, setClients] = useState([]);

  // Filters
  const [filters, setFilters] = useState({
    search: '', status: '', startDate: '', endDate: '', page: 1, limit: 20,
  });

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({
    clientId: '', clientName: '', clientRnc: '', clientPhone: '',
    days: 90, coverage: '', exclusions: '', issueDate: '', expiryDate: '',
  });
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientDropdownRef = useRef(null);
  const clientSearchRef = useRef(null);

  // Delete flow
  const [selectedWarranty, setSelectedWarranty] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [authForm, setAuthForm] = useState({ username: '', password: '' });

  const filterClients = clients.filter(c =>
    !clientSearch || c.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.rnc?.toLowerCase().includes(clientSearch.toLowerCase())
  );

  // KPI
  const kpi = {
    total: pagination.total,
    active: warranties.filter(w => getWarrantyStatus(w.expiryDate) === WarrantyStatus.ACTIVE).length,
    expiring: warranties.filter(w => getWarrantyStatus(w.expiryDate) === WarrantyStatus.EXPIRING_SOON).length,
    expired: warranties.filter(w => getWarrantyStatus(w.expiryDate) === WarrantyStatus.EXPIRED).length,
  };

  const loadWarranties = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: filters.page, limit: 20 };
      if (filters.search) params.search = filters.search;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.status) params.status = filters.status;
      const res = await warrantyService.getAll(params);
      const data = res.data?.data || res.data || [];
      setWarranties(Array.isArray(data) ? data : []);
      if (res.data?.pagination) setPagination(res.data.pagination);
    } catch (error) {
      console.error('Error loading warranties:', error);
      setWarranties([]);
      showNotification('Error al cargar garantías', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters.page, filters.search, filters.startDate, filters.endDate, filters.status, showNotification]);

  const loadClients = useCallback(async () => {
    try {
      const res = await clientService.getAll({ limit: -1 });
      const data = res.data?.data || res.data;
      setClients(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  }, []);

  useEffect(() => { loadWarranties(); }, [loadWarranties]);
  useEffect(() => { if (showCreateModal) loadClients(); }, [showCreateModal, loadClients]);

  // Outside click for client dropdown
  useEffect(() => {
    const handleClick = (e) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target)) {
        setShowClientDropdown(false);
      }
    };
    if (showClientDropdown) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [showClientDropdown]);

  // Filter handlers
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({ search: '', status: '', startDate: '', endDate: '', page: 1, limit: 20 });
  };

  // Create helpers
  const openCreateModal = () => {
    const today = new Date().toISOString().split('T')[0];
    const expiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setForm({ clientId: '', clientName: '', clientRnc: '', clientPhone: '', days: 90, coverage: '', exclusions: '', issueDate: today, expiryDate: expiry });
    setClientSearch('');
    setShowCreateModal(true);
  };

  const handleClientSelect = (client) => {
    setForm(prev => ({ ...prev, clientId: client.id, clientName: client.name || '', clientRnc: client.rnc || '', clientPhone: client.phone || '' }));
    setClientSearch(client.name || '');
    setShowClientDropdown(false);
  };

  const handleCreate = async () => {
    if (!form.clientName.trim()) {
      showNotification('El nombre del cliente es requerido', 'error');
      return;
    }
    if (!form.days || form.days < 1) {
      showNotification('Los días de garantía deben ser mayor a 0', 'error');
      return;
    }
    try {
      await warrantyService.create({
        clientId: form.clientId || null,
        clientName: form.clientName.trim(),
        clientRnc: form.clientRnc.trim() || null,
        clientPhone: form.clientPhone.trim() || null,
        days: form.days,
        coverage: form.coverage.trim() || null,
        exclusions: form.exclusions.trim() || null,
        issueDate: form.issueDate || null,
        expiryDate: form.expiryDate || null,
      });
      showNotification('Garantía creada exitosamente', 'success');
      setShowCreateModal(false);
      setFilters(prev => ({ ...prev, page: 1 }));
    } catch (error) {
      showNotification(error.response?.data?.error || 'Error al crear garantía', 'error');
    }
  };

  // Delete flow
  const openDeleteFlow = (warranty) => {
    setSelectedWarranty(warranty);
    setAuthForm({ username: '', password: '' });
    setShowAuthModal(true);
  };

  const handleAuthSubmit = () => {
    if (!authForm.username || !authForm.password) {
      showNotification('Ingresa usuario y contraseña del supervisor', 'error');
      return;
    }
    setShowAuthModal(false);
    setShowConfirmDelete(true);
  };

  const executeDelete = async () => {
    if (!selectedWarranty) return;
    try {
      setLoading(true);
      await warrantyService.delete(selectedWarranty.id, {
        authorizerUsername: authForm.username,
        authorizerPassword: authForm.password,
      });
      setShowConfirmDelete(false);
      setSelectedWarranty(null);
      showNotification('Garantía eliminada exitosamente', 'success');
      loadWarranties();
    } catch (error) {
      showNotification(error.response?.data?.error || 'Error al eliminar garantía', 'error');
    } finally {
      setLoading(false);
    }
  };

  // PDF
  const downloadPDF = async (warranty) => {
    try {
      let fullWarranty = warranty;
      if (!warranty.createdBy) {
        const res = await warrantyService.getAll({ limit: 1 });
        const warranties = res.data?.data || [];
        fullWarranty = warranties.find(w => w.id === warranty.id) || warranty;
      }
      const doc = generateWarrantyPDF(fullWarranty, settings);
      const certId = fullWarranty.id ? `Garantia_${fullWarranty.id.slice(0, 8).toUpperCase()}` : `Garantia_${Date.now()}`;
      doc.save(`${certId}.pdf`);
    } catch (err) {
      console.error('Error generando PDF:', err);
      showNotification('Error al generar PDF', 'error');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1><i className="fas fa-certificate" style={{ marginRight: '10px', color: '#10B981' }}></i>Garantías</h1>
          <p>Gestión de certificados de garantía</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          <i className="fas fa-plus"></i> Crear Garantía
        </button>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: '24px' }}>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: '#10B981' }}>
            <i className="fas fa-certificate"></i>
          </div>
          <div className="kpi-info">
            <h3>Total</h3>
            <h2>{kpi.total}</h2>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: '#10B981' }}>
            <i className="fas fa-check-circle"></i>
          </div>
          <div className="kpi-info">
            <h3>Activas</h3>
            <h2>{kpi.active}</h2>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}>
            <i className="fas fa-clock"></i>
          </div>
          <div className="kpi-info">
            <h3>Por vencer</h3>
            <h2>{kpi.expiring}</h2>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
            <i className="fas fa-times-circle"></i>
          </div>
          <div className="kpi-info">
            <h3>Vencidas</h3>
            <h2>{kpi.expired}</h2>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text" className="form-control" placeholder="Buscar cliente..."
            style={{ width: '180px' }}
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
          />
          <select
            className="form-control" style={{ width: '140px' }}
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="active">Activas</option>
            <option value="expiring">Por vencer</option>
            <option value="expired">Vencidas</option>
          </select>
          <input
            type="date" className="form-control" style={{ width: '140px' }}
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
          />
          <span style={{ color: 'var(--text-muted)' }}>hasta</span>
          <input
            type="date" className="form-control" style={{ width: '140px' }}
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
          />
          <button className="btn btn-outline" onClick={clearFilters}>
            <i className="fas fa-times"></i> Limpiar
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>RNC</th>
              <th>Emisión</th>
              <th>Vence</th>
              <th>Estado</th>
              <th>Días</th>
              <th>Cobertura</th>
              <th>Creado por</th>
              <th>Venta</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '40px' }}>
                  <div className="spinner"></div>
                  <p style={{ marginTop: '10px', color: 'var(--text-muted)' }}>Cargando garantías...</p>
                </td>
              </tr>
            ) : warranties.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <i className="fas fa-certificate" style={{ fontSize: '2rem', marginBottom: '10px', display: 'block' }}></i>
                  No hay garantías registradas
                </td>
              </tr>
            ) : warranties.map((w) => {
              const st = statusLabel[getWarrantyStatus(w.expiryDate)];
              return (
                <tr key={w.id}>
                  <td><strong>{w.clientName}</strong></td>
                  <td>{w.clientRnc || '-'}</td>
                  <td>{formatDate(w.issueDate)}</td>
                  <td style={{ color: st.className === 'badge-danger' ? '#EF4444' : st.className === 'badge-warning' ? '#F59E0B' : '#10B981', fontWeight: 600 }}>
                    {formatDate(w.expiryDate)}
                  </td>
                  <td><span className={`badge ${st.className}`}>{st.text}</span></td>
                  <td>{w.days}</td>
                  <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={w.coverage || ''}>
                    {w.coverage || '-'}
                  </td>
                  <td>{w.createdBy?.name || w.createdBy?.username || '-'}</td>
                  <td>
                    {w.sale ? (
                      <span className="badge badge-info" title={`Factura #${w.sale.invoiceNumber} - ${formatCurrency(w.sale.total)}`}>
                        <i className="fas fa-file-invoice"></i> {w.sale.invoiceNumber}
                      </span>
                    ) : (
                      <span className="badge" style={{ background: '#F3F4F6', color: '#6B7280' }}>Independiente</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn btn-outline" onClick={() => downloadPDF(w)} style={{ padding: '4px 8px', color: '#10B981', borderColor: 'rgba(16,185,129,0.2)' }} title="Descargar PDF">
                        <i className="fas fa-file-pdf"></i>
                      </button>
                      <button className="btn btn-outline" onClick={() => openDeleteFlow(w)} style={{ padding: '4px 8px', color: '#EF4444', borderColor: 'rgba(239,68,68,0.2)' }} title="Eliminar garantía">
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination pagination={pagination} onPageChange={(p) => setFilters(prev => ({ ...prev, page: p }))} loading={loading} />

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ width: '50px', height: '50px', background: 'rgba(16,185,129,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <i className="fas fa-certificate" style={{ fontSize: '24px', color: '#10B981' }}></i>
              </div>
              <h2 style={{ margin: 0 }}>Crear Garantía</h2>
            </div>

            {/* Client autocomplete */}
            <div className="form-group" ref={clientDropdownRef}>
              <label>Buscar cliente existente</label>
              <div style={{ position: 'relative' }}>
                <input
                  ref={clientSearchRef}
                  type="text" className="form-control"
                  placeholder="Escribe para buscar cliente..."
                  value={clientSearch}
                  onChange={(e) => { setClientSearch(e.target.value); setShowClientDropdown(true); }}
                  onFocus={() => setShowClientDropdown(true)}
                />
                {showClientDropdown && filterClients.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0,
                    background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                    borderRadius: '4px', maxHeight: '180px', overflowY: 'auto',
                    zIndex: 1000, boxShadow: 'var(--shadow-lg)',
                  }}>
                    {filterClients.slice(0, 50).map(c => (
                      <div key={c.id}
                        onClick={() => handleClientSelect(c)}
                        style={{
                          padding: '8px 12px', cursor: 'pointer', fontSize: '0.85rem',
                          borderBottom: '1px solid var(--border-color)',
                          background: form.clientId === c.id ? 'var(--primary)' : 'transparent',
                          color: form.clientId === c.id ? '#fff' : 'inherit',
                        }}>
                        <div style={{ fontWeight: 500 }}>{c.name}</div>
                        {c.rnc && <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>RNC: {c.rnc}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Manual client fields */}
            <div className="form-group">
              <label>Nombre del cliente *</label>
              <input type="text" className="form-control" value={form.clientName}
                onChange={(e) => setForm(prev => ({ ...prev, clientName: e.target.value, clientId: '' }))}
                placeholder="Nombre del cliente" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>RNC</label>
                <input type="text" className="form-control" value={form.clientRnc}
                  onChange={(e) => setForm(prev => ({ ...prev, clientRnc: e.target.value }))} placeholder="RNC" />
              </div>
              <div className="form-group">
                <label>Teléfono</label>
                <input type="text" className="form-control" value={form.clientPhone}
                  onChange={(e) => setForm(prev => ({ ...prev, clientPhone: e.target.value }))} placeholder="Teléfono" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Días de Garantía *</label>
                <input type="number" min="1" max="3650" className="form-control" value={form.days}
                  onChange={(e) => {
                    const days = parseInt(e.target.value) || 0;
                    setForm(prev => ({ ...prev, days, expiryDate: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0] }));
                  }} />
              </div>
              <div className="form-group">
                <label>Fecha de Vencimiento</label>
                <input type="date" className="form-control" value={form.expiryDate}
                  onChange={(e) => setForm(prev => ({ ...prev, expiryDate: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label>Cobertura</label>
              <textarea className="form-control" value={form.coverage}
                onChange={(e) => setForm(prev => ({ ...prev, coverage: e.target.value }))} rows="2"
                placeholder="Defectos de fábrica en materiales y mano de obra" />
            </div>
            <div className="form-group">
              <label>Exclusiones</label>
              <textarea className="form-control" value={form.exclusions}
                onChange={(e) => setForm(prev => ({ ...prev, exclusions: e.target.value }))} rows="2"
                placeholder="Daños por mal uso, golpes, humedad" />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button className="btn btn-primary" onClick={handleCreate} style={{ flex: 1 }}>
                <i className="fas fa-save"></i> Guardar Garantía
              </button>
              <button className="btn btn-outline" onClick={() => setShowCreateModal(false)} style={{ flex: 1 }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal (Billing style) */}
      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h2 style={{ color: '#EF4444', marginBottom: '16px' }}>
              <i className="fas fa-exclamation-triangle"></i> Eliminar Garantía
            </h2>
            <p style={{ marginBottom: '20px', color: 'var(--text-muted)' }}>
              Se requiere autorización de un <strong>Supervisor</strong> o <strong>Administrador</strong> para eliminar la garantía de <strong>{selectedWarranty?.clientName}</strong>.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); handleAuthSubmit(); }}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label>Usuario Supervisor</label>
                <input type="text" className="form-control" placeholder="Usuario Supervisor"
                  value={authForm.username} onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                  required autoFocus />
              </div>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label>Contraseña</label>
                <input type="password" className="form-control" placeholder="Contraseña"
                  value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  required />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, backgroundColor: '#EF4444' }}>
                  Autorizar Eliminación
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setShowAuthModal(false)} style={{ flex: 1 }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        show={showConfirmDelete}
        title="Eliminar Garantía"
        message={`¿Está seguro que desea eliminar la garantía de ${selectedWarranty?.clientName}? Esta acción no se puede deshacer.`}
        icon="fa-trash"
        iconColor="#EF4444"
        confirmText="Sí, eliminar"
        confirmButtonClass="btn btn-primary"
        onConfirm={executeDelete}
        onCancel={() => { setShowConfirmDelete(false); setSelectedWarranty(null); }}
      />
    </div>
  );
};

export default Warranties;
