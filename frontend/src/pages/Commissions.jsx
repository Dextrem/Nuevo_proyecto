import { useState, useEffect } from 'react';
import { commissionService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/Pagination';

const Commissions = () => {
  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [summary, setSummary] = useState({ pending: 0, approved: 0, paid: 0, totalUsers: 0 });
  const [activeCashiers, setActiveCashiers] = useState([]);
  const [selectedCashiers, setSelectedCashiers] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const { hasPermission } = useAuth();
  const [filters, setFilters] = useState({ status: '' });

  const [formData, setFormData] = useState({
    periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    periodEnd: new Date().toISOString().split('T')[0],
    calculationType: 'BY_SALE'
  });

  useEffect(() => {
    loadCommissions(1);
    loadSummary();
  }, []);

  useEffect(() => {
    if (showModal) {
      loadActiveCashiers();
    }
  }, [showModal, formData.periodStart, formData.periodEnd]);

  const loadActiveCashiers = async () => {
    try {
      const response = await commissionService.getActiveCashiers({
        periodStart: formData.periodStart,
        periodEnd: formData.periodEnd
      });
      setActiveCashiers(response.data || []);
      // Reset selection when cashiers list changes? 
      // Maybe not, but let's keep it for now.
    } catch (error) {
      console.error('Error loading active cashiers:', error);
    }
  };

  const loadCommissions = async (page = 1) => {
    try {
      setLoading(true);
      const response = await commissionService.getAll({ page, limit: pagination.limit, ...filters });
      const data = response.data?.data || response.data;
      const paginationData = response.data?.pagination || { total: data?.length || 0, totalPages: 1 };
      setCommissions(data || []);
      setPagination(prev => ({ ...prev, ...paginationData, page }));
    } catch (error) {
      console.error('Error loading commissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const response = await commissionService.getSummary();
      setSummary(response.data || response);
    } catch (error) {
      console.error('Error loading summary:', error);
    }
  };

  const handleCalculate = async (e) => {
    e.preventDefault();
    try {
      setCalculating(true);
      const payload = { 
        ...formData,
        userIds: selectedCashiers 
      };
      const response = await commissionService.calculate(payload);
      alert(response.data.message || 'Comisiones calculadas exitosamente');
      setShowModal(false);
      setSelectedCashiers([]);
      loadCommissions();
      loadSummary();
    } catch (error) {
      alert(error.response?.data?.error || 'Error al calcular comisiones');
    } finally {
      setCalculating(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await commissionService.updateStatus(id, newStatus);
      loadCommissions(pagination.page);
      loadSummary();
    } catch (error) {
      alert(error.response?.data?.error || 'Error al actualizar estado');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      PENDING: { class: 'badge-warning', label: 'Pendiente' },
      APPROVED: { class: 'badge-info', label: 'Aprobado' },
      PAID: { class: 'badge-success', label: 'Pagado' }
    };
    const badge = badges[status] || badges.PENDING;
    return <span className={`badge ${badge.class}`}>{badge.label}</span>;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(amount || 0);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('es-DO');
  };

  if (loading && commissions.length === 0) {
    return <div>Cargando...</div>;
  }

  return (
    <div>
      <div className="view-header">
        <div>
          <h1>Comisiones</h1>
          <p>Gestiona las comisiones de vendedores</p>
        </div>
        {hasPermission('manage_settings') && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <i className="fas fa-calculator"></i>
            Calcular Comisiones
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card card-stat">
          <div className="stat-label">Pendiente</div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{formatCurrency(summary.pending)}</div>
        </div>
        <div className="card card-stat">
          <div className="stat-label">Aprobado</div>
          <div className="stat-value" style={{ color: 'var(--info)' }}>{formatCurrency(summary.approved)}</div>
        </div>
        <div className="card card-stat">
          <div className="stat-label">Pagado</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{formatCurrency(summary.paid)}</div>
        </div>
        <div className="card card-stat">
          <div className="stat-label">Vendedores</div>
          <div className="stat-value">{summary.totalUsers}</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <select
            className="form-control"
            style={{ width: 'auto', minWidth: '150px' }}
            value={filters.status}
            onChange={(e) => {
              setFilters({ ...filters, status: e.target.value });
              loadCommissions(1);
            }}
          >
            <option value="">Todos los estados</option>
            <option value="PENDING">Pendiente</option>
            <option value="APPROVED">Aprobado</option>
            <option value="PAID">Pagado</option>
          </select>
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Vendedor</th>
                <th>Período</th>
                <th>Ventas Totales</th>
                <th>Tasa</th>
                <th>Comisión</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((comm) => (
                <tr key={comm.id}>
                  <td>
                    <div>
                      <strong>{comm.user?.name}</strong>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        @{comm.user?.username}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.9rem' }}>
                      {formatDate(comm.periodStart)} - {formatDate(comm.periodEnd)}
                    </div>
                  </td>
                  <td>{formatCurrency(comm.totalSales)}</td>
                  <td>{(comm.commissionRate * 100).toFixed(0)}%</td>
                  <td>
                    <strong style={{ color: 'var(--success)' }}>
                      {formatCurrency(comm.commissionAmount)}
                    </strong>
                  </td>
                  <td>{getStatusBadge(comm.status)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {comm.status === 'PENDING' && (
                        <button
                          className="btn btn-outline"
                          style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                          onClick={() => handleStatusChange(comm.id, 'APPROVED')}
                        >
                          Aprobar
                        </button>
                      )}
                      {comm.status === 'APPROVED' && (
                        <button
                          className="btn btn-outline"
                          style={{ padding: '4px 8px', fontSize: '0.8rem', color: 'var(--success)', borderColor: 'var(--success)' }}
                          onClick={() => handleStatusChange(comm.id, 'PAID')}
                        >
                          Marcar Pagado
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {commissions.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px' }}>
                    No hay comisiones calculadas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination pagination={pagination} onPageChange={loadCommissions} loading={loading} />
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <h2>Calcular Comisiones</h2>
            <form onSubmit={handleCalculate}>
              <div className="form-group">
                <label>Fecha Inicio *</label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.periodStart}
                  onChange={(e) => setFormData({ ...formData, periodStart: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Fecha Fin *</label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.periodEnd}
                  onChange={(e) => setFormData({ ...formData, periodEnd: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Tipo de Cálculo</label>
                <select
                  className="form-control"
                  value={formData.calculationType}
                  onChange={(e) => setFormData({ ...formData, calculationType: e.target.value })}
                >
                  <option value="BY_SALE">Por Venta (15% sobre excedente de 4000)</option>
                  <option value="ACCUMULATED">Acumulado (15% sobre total)</option>
                </select>
                <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  {formData.calculationType === 'BY_SALE' 
                    ? 'Aplica 15% sobre el excedente de RD$4,000 por venta'
                    : 'Aplica 15% sobre el total de ventas acumuladas en el período'}
                </small>
              </div>

              <div className="form-group">
                <label>Vendedores / Cajeros (Con ventas en el periodo)</label>
                <div style={{ 
                  maxHeight: '150px', 
                  overflowY: 'auto', 
                  border: '1px solid var(--border-color)', 
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'var(--bg-main)'
                }}>
                  {activeCashiers.length === 0 ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--danger)', textAlign: 'center', padding: '10px' }}>
                      No hay cajeros con ventas en este rango de fechas.
                    </div>
                  ) : (
                    <>
                      <div style={{ marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
                          <input 
                            type="checkbox" 
                            checked={selectedCashiers.length === activeCashiers.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCashiers(activeCashiers.map(u => u.id));
                              } else {
                                setSelectedCashiers([]);
                              }
                            }}
                          />
                          Seleccionar Todos
                        </label>
                      </div>
                      {activeCashiers.map(user => (
                        <label key={user.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={selectedCashiers.includes(user.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCashiers([...selectedCashiers, user.id]);
                              } else {
                                setSelectedCashiers(selectedCashiers.filter(id => id !== user.id));
                              }
                            }}
                          />
                          <span style={{ fontSize: '0.9rem' }}>{user.name} (@{user.username})</span>
                        </label>
                      ))}
                    </>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={calculating || (activeCashiers.length > 0 && selectedCashiers.length === 0)}
                >
                  {calculating ? 'Calculando...' : 'Calcular Comisiones'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setShowModal(false);
                    setSelectedCashiers([]);
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Commissions;
