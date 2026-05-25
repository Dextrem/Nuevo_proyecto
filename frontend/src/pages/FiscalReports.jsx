import { useState, useEffect, useCallback } from 'react';
import { fiscalService, settingsService } from '../services/api';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/ConfirmModal';

const NCF_TYPE_LABELS = {
  '01': 'Crédito Fiscal', '02': 'Consumo', '03': 'Débito',
  '04': 'Gastos Menores', '11': 'Regímenes Especiales',
  '14': 'Gubernamental', '15': 'Gastos del Exterior',
};

const FiscalReports = () => {
  const [activeTab, setActiveTab] = useState('status');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [salesReport, setSalesReport] = useState(null);
  const [purchasesReport, setPurchasesReport] = useState(null);
  const [reportPeriod, setReportPeriod] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    ncfType: '',
  });
  const [sequences, setSequences] = useState([]);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [showSequenceModal, setShowSequenceModal] = useState(false);
  const [editingSequence, setEditingSequence] = useState(null);
  const [sequenceForm, setSequenceForm] = useState({
    type: '02', name: '', prefix: 'B', current: 1, limit: 100000, active: true,
  });
  const { formatCurrency } = useApp();
  const { hasPermission } = useAuth();

  const loadStatus = useCallback(async () => {
    try {
      const res = await fiscalService.getStatus();
      setStatus(res.data);
      setSequences(res.data.sequences || []);
    } catch (e) {
      console.error('Error loading fiscal status:', e);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const loadSalesReport = async () => {
    setLoading(true);
    try {
      const res = await fiscalService.getSalesReport(reportPeriod);
      setSalesReport(res.data);
    } catch (e) {
      console.error('Error loading sales report:', e);
    } finally { setLoading(false); }
  };

  const loadPurchasesReport = async () => {
    setLoading(true);
    try {
      const res = await fiscalService.getPurchasesReport({ startDate: reportPeriod.startDate, endDate: reportPeriod.endDate });
      setPurchasesReport(res.data);
    } catch (e) {
      console.error('Error loading purchases report:', e);
    } finally { setLoading(false); }
  };

  const handleOpenSequenceModal = (seq = null) => {
    if (seq) {
      setEditingSequence(seq);
      setSequenceForm({ type: seq.type, name: seq.name, prefix: seq.prefix, current: seq.current, limit: seq.limit, active: seq.active });
    } else {
      setEditingSequence(null);
      setSequenceForm({ type: '02', name: '', prefix: 'B', current: 1, limit: 100000, active: true });
    }
    setShowSequenceModal(true);
  };

  const handleSaveSequence = async (e) => {
    e.preventDefault();
    try {
      if (editingSequence) {
        await fiscalService.updateSequence(editingSequence.id, sequenceForm);
      } else {
        await fiscalService.createSequence(sequenceForm);
      }
      setShowSequenceModal(false);
      loadStatus();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al guardar secuencia');
    }
  };

  const handleDeleteSequence = (id) => {
    setConfirmDeleteId(id);
    setShowConfirmDelete(true);
  };

  const confirmDeleteSequence = async () => {
    try {
      await fiscalService.deleteSequence(confirmDeleteId);
      loadStatus();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar');
    } finally {
      setShowConfirmDelete(false);
      setConfirmDeleteId(null);
    }
  };

  const cancelDeleteSequence = () => {
    setShowConfirmDelete(false);
    setConfirmDeleteId(null);
  };

  const getAlertStyle = (alert) => {
    switch (alert) {
      case 'CRITICAL': return { color: 'var(--danger)', bg: 'rgba(239,68,68,0.1)' };
      case 'WARNING': return { color: 'var(--accent)', bg: 'rgba(245,158,11,0.1)' };
      default: return { color: 'var(--secondary)', bg: 'rgba(16,185,129,0.1)' };
    }
  };

  return (
    <div>
      <div className="view-header">
        <div>
          <h1>Reportes Fiscales (DGII)</h1>
          <p>Gestión de comprobantes fiscales y reportes NCF</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { id: 'status', label: 'Estado NCF', icon: 'fa-chart-bar' },
          { id: 'sales', label: 'Ventas (607)', icon: 'fa-file-invoice' },
          { id: 'purchases', label: 'Compras (606)', icon: 'fa-shopping-cart' },
          { id: 'sequences', label: 'Secuencias', icon: 'fa-list-ol' },
        ].map(tab => (
          <button key={tab.id}
            className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <i className={`fas ${tab.icon}`}></i> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'status' && status && (
        <div>
          <div className="kpi-grid" style={{ marginBottom: '24px' }}>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(79,70,229,0.1)', color: 'var(--primary)' }}>
                <i className="fas fa-file-invoice"></i></div>
              <div className="kpi-info">
                <h3>Ventas con NCF</h3>
                <h2>{status.salesWithNCF || 0}</h2>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--accent)' }}>
                <i className="fas fa-exclamation-triangle"></i></div>
              <div className="kpi-info">
                <h3>Ventas sin NCF</h3>
                <h2>{status.salesWithoutNCF || 0}</h2>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--secondary)' }}>
                <i className="fas fa-toggle-on"></i></div>
              <div className="kpi-info">
                <h3>Fact. Fiscal</h3>
                <h2>{status.fiscalEnabled ? 'Activada' : 'Desactivada'}</h2>
              </div>
            </div>
          </div>

          <div className="data-table-container">
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <h3>Estado de Secuencias NCF</h3>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tipo</th><th>Nombre</th><th>Prefijo</th><th>Actual</th>
                  <th>Límite</th><th>Restantes</th><th>Uso</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {sequences.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No hay secuencias NCF configuradas</td></tr>
                ) : sequences.map(s => {
                  const alertStyle = getAlertStyle(s.alert);
                  return (
                    <tr key={s.id}>
                      <td><strong>{s.type}</strong></td>
                      <td>{s.name}</td>
                      <td>{s.prefix}</td>
                      <td>{s.current.toLocaleString()}</td>
                      <td>{s.limit.toLocaleString()}</td>
                      <td style={{ color: s.remaining < 100 ? 'var(--danger)' : 'inherit', fontWeight: s.remaining < 500 ? 'bold' : 'normal' }}>
                        {s.remaining.toLocaleString()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: '8px', background: 'var(--bg-surface-hover)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${Math.min(s.usagePercent, 100)}%`, height: '100%',
                              background: s.alert === 'CRITICAL' ? 'var(--danger)' : s.alert === 'WARNING' ? 'var(--accent)' : 'var(--secondary)',
                              borderRadius: '4px', transition: 'width 0.3s',
                            }}></div>
                          </div>
                          <span style={{ fontSize: '0.8rem', minWidth: '40px' }}>{s.usagePercent}%</span>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem',
                          color: alertStyle.color, background: alertStyle.bg,
                        }}>
                          <i className={`fas fa-${s.alert === 'CRITICAL' ? 'times-circle' : s.alert === 'WARNING' ? 'exclamation-circle' : 'check-circle'}`}></i>
                          {s.alert === 'CRITICAL' ? 'CRÍTICO' : s.alert === 'WARNING' ? 'PRÓXIMO A AGOTAR' : 'OK'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'sales' && (
        <div>
          <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Desde</label>
                <input type="date" className="form-control" value={reportPeriod.startDate}
                  onChange={e => setReportPeriod(p => ({ ...p, startDate: e.target.value }))} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Hasta</label>
                <input type="date" className="form-control" value={reportPeriod.endDate}
                  onChange={e => setReportPeriod(p => ({ ...p, endDate: e.target.value }))} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Tipo NCF</label>
                <select className="form-control" value={reportPeriod.ncfType}
                  onChange={e => setReportPeriod(p => ({ ...p, ncfType: e.target.value }))}>
                  <option value="">Todos</option>
                  {Object.entries(NCF_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{k} - {v}</option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary" onClick={loadSalesReport} disabled={loading}>
                <i className="fas fa-search"></i> Generar Reporte
              </button>
            </div>
          </div>

          {salesReport && (
            <div>
              <div className="kpi-grid" style={{ marginBottom: '24px' }}>
                <div className="kpi-card">
                  <div className="kpi-info"><h3>Total Facturas</h3>
                    <h2>{salesReport.salesCount || 0}</h2></div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-info"><h3>Monto Total</h3>
                    <h2>{formatCurrency(salesReport.totals?.totalAmount || 0)}</h2></div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-info"><h3>ITBIS Total</h3>
                    <h2>{formatCurrency(salesReport.totals?.totalItbis || 0)}</h2></div>
                </div>
              </div>

              {salesReport.byType?.map(group => (
                <div key={group.ncfType} className="data-table-container" style={{ marginBottom: '16px' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0 }}>Tipo {group.ncfType} - {group.ncfTypeName}</h4>
                    <span style={{ color: 'var(--text-muted)' }}>{group.count} facturas | {formatCurrency(group.totalAmount)}</span>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>NCF</th><th>Factura</th><th>Fecha</th><th>Cliente</th><th>RNC</th><th style={{ textAlign: 'right' }}>ITBIS</th><th style={{ textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.sales?.map((s, i) => (
                        <tr key={i}>
                          <td style={{ fontFamily: 'monospace' }}>{s.ncf}</td>
                          <td>{s.invoiceNumber}</td>
                          <td>{new Date(s.date).toLocaleDateString()}</td>
                          <td>{s.clientName}</td>
                          <td>{s.clientRnc}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(s.itbis)}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(s.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

              {salesReport.byType?.length > 0 && (
                <div style={{ textAlign: 'right', marginTop: '8px' }}>
                  <button className="btn btn-outline" onClick={() => {
                    const text = JSON.stringify(salesReport, null, 2);
                    const blob = new Blob([text], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = `reporte-607-${reportPeriod.startDate}-${reportPeriod.endDate}.json`;
                    a.click(); URL.revokeObjectURL(url);
                  }}>
                    <i className="fas fa-download"></i> Exportar JSON
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'purchases' && (
        <div>
          <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Desde</label>
                <input type="date" className="form-control" value={reportPeriod.startDate}
                  onChange={e => setReportPeriod(p => ({ ...p, startDate: e.target.value }))} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Hasta</label>
                <input type="date" className="form-control" value={reportPeriod.endDate}
                  onChange={e => setReportPeriod(p => ({ ...p, endDate: e.target.value }))} />
              </div>
              <button className="btn btn-primary" onClick={loadPurchasesReport} disabled={loading}>
                <i className="fas fa-search"></i> Generar Reporte
              </button>
            </div>
          </div>

          {purchasesReport && (
            <div>
              <div className="kpi-grid" style={{ marginBottom: '24px' }}>
                <div className="kpi-card">
                  <div className="kpi-info"><h3>Total Compras</h3>
                    <h2>{purchasesReport.totals?.count || 0}</h2></div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-info"><h3>Monto Total</h3>
                    <h2>{formatCurrency(purchasesReport.totals?.totalAmount || 0)}</h2></div>
                </div>
              </div>

              {purchasesReport.bySupplier?.map(group => (
                <div key={group.supplierRnc} className="data-table-container" style={{ marginBottom: '16px' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                    <h4 style={{ margin: 0 }}>{group.supplierName}</h4>
                    <span style={{ color: 'var(--text-muted)' }}>RNC: {group.supplierRnc} | {group.count} facturas | {formatCurrency(group.totalAmount)}</span>
                  </div>
                  <table className="data-table">
                    <thead><tr><th>Factura</th><th>Fecha</th><th style={{ textAlign: 'right' }}>Monto</th></tr></thead>
                    <tbody>
                      {group.invoices?.map((inv, i) => (
                        <tr key={i}>
                          <td>{inv.invoiceNumber || 'N/A'}</td>
                          <td>{inv.date ? new Date(inv.date).toLocaleDateString() : 'N/A'}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(inv.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'sequences' && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            {hasPermission('manage_settings') && (
              <button className="btn btn-primary" onClick={() => handleOpenSequenceModal()}>
                <i className="fas fa-plus"></i> Nueva Secuencia
              </button>
            )}
          </div>

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr><th>Tipo</th><th>Nombre</th><th>Prefijo</th><th>Actual</th><th>Límite</th><th>Restantes</th><th>Activa</th>
                  {hasPermission('manage_settings') && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {sequences.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Sin secuencias configuradas</td></tr>
                ) : sequences.map(s => (
                  <tr key={s.id}>
                    <td><strong>{s.type}</strong></td>
                    <td>{s.name}</td>
                    <td style={{ fontFamily: 'monospace' }}>{s.prefix}</td>
                    <td>{s.current.toLocaleString()}</td>
                    <td>{s.limit.toLocaleString()}</td>
                    <td style={{ color: s.remaining < 100 ? 'var(--danger)' : s.remaining < 500 ? 'var(--accent)' : 'inherit' }}>
                      {s.remaining.toLocaleString()}
                    </td>
                    <td>{s.active ? <span style={{ color: 'var(--secondary)' }}>Sí</span> : 'No'}</td>
                    {hasPermission('manage_settings') && (
                      <td>
                        <button className="btn btn-outline" onClick={() => handleOpenSequenceModal(s)} style={{ padding: '4px 8px', marginRight: '4px' }}>
                          <i className="fas fa-edit"></i>
                        </button>
                        <button className="btn btn-outline" onClick={() => handleDeleteSequence(s.id)} style={{ padding: '4px 8px', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.2)' }}>
                          <i className="fas fa-trash"></i>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showSequenceModal && (
        <div className="modal-overlay" onClick={() => setShowSequenceModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h2>{editingSequence ? 'Editar Secuencia' : 'Nueva Secuencia NCF'}</h2>
            <form onSubmit={handleSaveSequence}>
              <div className="form-group">
                <label>Tipo NCF *</label>
                <select className="form-control" value={sequenceForm.type}
                  onChange={e => setSequenceForm(f => ({ ...f, type: e.target.value }))} required>
                  {Object.entries(NCF_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{k} - {v}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Nombre</label>
                <input type="text" className="form-control" value={sequenceForm.name}
                  onChange={e => setSequenceForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={NCF_TYPE_LABELS[sequenceForm.type] || ''} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Prefijo</label>
                  <input type="text" className="form-control" value={sequenceForm.prefix}
                    onChange={e => setSequenceForm(f => ({ ...f, prefix: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label>Inicio</label>
                  <input type="number" className="form-control" value={sequenceForm.current}
                    onChange={e => setSequenceForm(f => ({ ...f, current: parseInt(e.target.value) || 1 }))} min="1" />
                </div>
                <div className="form-group">
                  <label>Límite</label>
                  <input type="number" className="form-control" value={sequenceForm.limit}
                    onChange={e => setSequenceForm(f => ({ ...f, limit: parseInt(e.target.value) || 100000 }))} min="1" />
                </div>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" checked={sequenceForm.active}
                    onChange={e => setSequenceForm(f => ({ ...f, active: e.target.checked }))} />
                  Secuencia activa
                </label>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="submit" className="btn btn-primary">{editingSequence ? 'Actualizar' : 'Crear'}</button>
                <button type="button" className="btn btn-outline" onClick={() => setShowSequenceModal(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        show={showConfirmDelete}
        title="Eliminar Secuencia Fiscal"
        message="&iquest;Eliminar esta secuencia fiscal definitivamente? Esta acci&oacute;n no se puede deshacer."
        icon="fa-trash-alt"
        iconColor="#EF4444"
        confirmText="S&iacute;, eliminar"
        confirmButtonClass="btn btn-primary"
        onConfirm={confirmDeleteSequence}
        onCancel={cancelDeleteSequence}
      />
    </div>
  );
};

export default FiscalReports;
