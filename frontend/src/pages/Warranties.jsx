import { useState, useEffect, useCallback } from 'react';
import { warrantyService, clientService } from '../services/api';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/Pagination';
import ConfirmModal from '../components/ConfirmModal';

const Warranties = () => {
  const [warranties, setWarranties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedWarranty, setSelectedWarranty] = useState(null);
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({
    clientId: '', clientName: '', clientRnc: '', clientPhone: '',
    days: 90, coverage: '', exclusions: '', issueDate: new Date().toISOString().split('T')[0], expiryDate: '',
  });

  const { formatCurrency, formatDate, showNotification } = useApp();
  const { user } = useAuth();

  const loadWarranties = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
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
  }, [page, search, startDate, endDate, showNotification]);

  const loadClients = useCallback(async () => {
    try {
      const res = await clientService.getAll({ active: true, limit: -1 });
      const data = res.data?.data || res.data;
      setClients(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  }, []);

  useEffect(() => { loadWarranties(); }, [loadWarranties]);
  useEffect(() => { if (showCreateModal) loadClients(); }, [showCreateModal, loadClients]);

  const openCreateModal = () => {
    const today = new Date().toISOString().split('T')[0];
    const expiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setForm({ clientId: '', clientName: '', clientRnc: '', clientPhone: '', days: 90, coverage: '', exclusions: '', issueDate: today, expiryDate: expiry });
    setShowCreateModal(true);
  };

  const handleClientSelect = (id) => {
    const c = clients.find(cl => cl.id === id);
    if (c) {
      setForm(prev => ({ ...prev, clientId: id, clientName: c.name || '', clientRnc: c.rnc || '', clientPhone: c.phone || '' }));
    }
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
      loadWarranties();
    } catch (error) {
      showNotification(error.response?.data?.error || 'Error al crear garantía', 'error');
    }
  };

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
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedWarranty) return;
    try {
      setLoading(true);
      await warrantyService.delete(selectedWarranty.id, {
        authorizerUsername: authForm.username,
        authorizerPassword: authForm.password,
      });
      setShowDeleteModal(false);
      setSelectedWarranty(null);
      showNotification('Garantía eliminada exitosamente', 'success');
      loadWarranties();
    } catch (error) {
      showNotification(error.response?.data?.error || 'Error al eliminar garantía', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadWarranties();
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

      <div className="card">
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', padding: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: '1', minWidth: '200px', marginBottom: 0 }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Buscar cliente</label>
            <input type="text" className="form-control" placeholder="Nombre o RNC..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: '0 0 180px', marginBottom: 0 }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Desde</label>
            <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: '0 0 180px', marginBottom: 0 }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Hasta</label>
            <input type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px' }}>
            <i className="fas fa-search"></i> Filtrar
          </button>
          {(search || startDate || endDate) && (
            <button type="button" className="btn btn-outline" onClick={() => { setSearch(''); setStartDate(''); setEndDate(''); setPage(1); }} style={{ padding: '10px 24px' }}>
              <i className="fas fa-times"></i> Limpiar
            </button>
          )}
        </form>
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>RNC</th>
                <th>Emisión</th>
                <th>Vence</th>
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
                  <td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="spinner"></div>
                    <p style={{ marginTop: '10px', color: 'var(--text-muted)' }}>Cargando garantías...</p>
                  </td>
                </tr>
              ) : warranties.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <i className="fas fa-certificate" style={{ fontSize: '2rem', marginBottom: '10px', display: 'block' }}></i>
                    No hay garantías registradas
                  </td>
                </tr>
              ) : warranties.map((w) => (
                <tr key={w.id}>
                  <td><strong>{w.clientName}</strong></td>
                  <td>{w.clientRnc || '-'}</td>
                  <td>{w.issueDate ? new Date(w.issueDate).toLocaleDateString() : '-'}</td>
                  <td style={{ color: new Date(w.expiryDate) < new Date() ? '#EF4444' : '#10B981', fontWeight: 600 }}>
                    {new Date(w.expiryDate).toLocaleDateString()}
                  </td>
                  <td>{w.days}</td>
                  <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={w.coverage || ''}>
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
                    <button className="btn btn-sm btn-outline" style={{ color: '#EF4444', borderColor: '#EF4444' }}
                      onClick={() => openDeleteFlow(w)} title="Eliminar garantía">
                      <i className="fas fa-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination pagination={pagination} onPageChange={setPage} loading={loading} />
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ width: '50px', height: '50px', background: 'rgba(16,185,129,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <i className="fas fa-certificate" style={{ fontSize: '24px', color: '#10B981' }}></i>
              </div>
              <h2 style={{ margin: 0 }}>Crear Garantía</h2>
            </div>
            <div className="form-group">
              <label>Cliente</label>
              <select className="form-control" value={form.clientId} onChange={(e) => handleClientSelect(e.target.value)}>
                <option value="">-- Seleccionar cliente existente --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name} {c.rnc ? `(${c.rnc})` : ''}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Nombre del cliente *</label>
              <input type="text" className="form-control" value={form.clientName} onChange={(e) => setForm(prev => ({ ...prev, clientName: e.target.value }))} placeholder="Nombre del cliente" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>RNC</label>
                <input type="text" className="form-control" value={form.clientRnc} onChange={(e) => setForm(prev => ({ ...prev, clientRnc: e.target.value }))} placeholder="RNC" />
              </div>
              <div className="form-group">
                <label>Teléfono</label>
                <input type="text" className="form-control" value={form.clientPhone} onChange={(e) => setForm(prev => ({ ...prev, clientPhone: e.target.value }))} placeholder="Teléfono" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Días de Garantía *</label>
                <input type="number" min="1" max="3650" className="form-control" value={form.days} onChange={(e) => {
                  const days = parseInt(e.target.value) || 0;
                  setForm(prev => ({ ...prev, days, expiryDate: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0] }));
                }} />
              </div>
              <div className="form-group">
                <label>Fecha de Vencimiento</label>
                <input type="date" className="form-control" value={form.expiryDate} onChange={(e) => setForm(prev => ({ ...prev, expiryDate: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label>Cobertura</label>
              <textarea className="form-control" value={form.coverage} onChange={(e) => setForm(prev => ({ ...prev, coverage: e.target.value }))} rows="2" placeholder="Defectos de fábrica en materiales y mano de obra" />
            </div>
            <div className="form-group">
              <label>Exclusiones</label>
              <textarea className="form-control" value={form.exclusions} onChange={(e) => setForm(prev => ({ ...prev, exclusions: e.target.value }))} rows="2" placeholder="Daños por mal uso, golpes, humedad" />
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
                <input type="text" className="form-control" placeholder="Usuario Supervisor" value={authForm.username} onChange={(e) => setAuthForm(prev => ({ ...prev, username: e.target.value }))} required autoFocus />
              </div>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label>Contraseña</label>
                <input type="password" className="form-control" placeholder="Contraseña" value={authForm.password} onChange={(e) => setAuthForm(prev => ({ ...prev, password: e.target.value }))} required />
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
        show={showDeleteModal}
        title="Eliminar Garantía"
        message={`¿Está seguro que desea eliminar la garantía de ${selectedWarranty?.clientName}? Esta acción no se puede deshacer.`}
        icon="fa-trash"
        iconColor="#EF4444"
        confirmText="Sí, eliminar"
        confirmButtonClass="btn btn-primary"
        onConfirm={handleDeleteConfirm}
        onCancel={() => { setShowDeleteModal(false); setSelectedWarranty(null); }}
      />
    </div>
  );
};

export default Warranties;
