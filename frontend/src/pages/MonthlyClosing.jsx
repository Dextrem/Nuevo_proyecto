import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { monthlyClosingService } from '../services/api';

const MonthlyClosing = () => {
  const [closings, setClosings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [monthStatus, setMonthStatus] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [activeSection, setActiveSection] = useState('resumen');
  const [companyStatus, setCompanyStatus] = useState(null);
  const [openingBalances, setOpeningBalances] = useState(null);
  const [showStatusPanel, setShowStatusPanel] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [error, setError] = useState(null);
  const [listFilters, setListFilters] = useState({ year: '', status: '' });
  const { hasPermission } = useAuth();
  const { formatCurrency } = useApp();

  useEffect(() => {
    loadClosings();
    loadCompanyStatus();
  }, [listFilters]);

  const loadCompanyStatus = async () => {
    try {
      setStatusLoading(true);
      const data = await monthlyClosingService.getCompanyStatus();
      setCompanyStatus(data);
    } catch (err) {
      console.error('Error loading company status:', err);
      setError(err.response?.data?.error || 'Error al cargar estado de la empresa');
    } finally {
      setStatusLoading(false);
    }
  };

  const loadOpeningBalances = async (year, month) => {
    try {
      const data = await monthlyClosingService.getOpeningBalances(year, month);
      setOpeningBalances(data);
      return data;
    } catch (error) {
      console.error('Error loading opening balances:', error);
      return null;
    }
  };

  const loadClosings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await monthlyClosingService.getAll(listFilters);
      const data = response?.data || response;
      setClosings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading closings:', err);
      setError(err.response?.data?.error || 'Error al cargar los cierres');
      setClosings([]);
    } finally {
      setLoading(false);
    }
  };

  const checkMonthStatus = async () => {
    try {
      setLoading(true);
      const year = parseInt(selectedYear);
      const month = parseInt(selectedMonth);
      const data = await monthlyClosingService.getStatus(year, month);
      setMonthStatus(data);
    } catch (err) {
      console.error('Error checking status:', err);
      setError(err.response?.data?.error || 'Error al verificar estado del mes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showModal) {
      checkMonthStatus();
      loadOpeningBalances(parseInt(selectedYear), parseInt(selectedMonth));
    }
  }, [showModal, selectedYear, selectedMonth]);

  const handleCreateClosing = async () => {
    const confirmMsg = `¿Estás seguro de crear el cierre para ${selectedYear}-${String(selectedMonth).padStart(2, '0')}? Esta acción no se puede deshacer.`;
    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      setCreating(true);
      const data = await monthlyClosingService.create({
        year: parseInt(selectedYear),
        month: parseInt(selectedMonth),
        notes: notes
      });
      
      alert(data.message || 'Cierre creado exitosamente');
      setShowModal(false);
      setNotes('');
      loadClosings();
      loadCompanyStatus();
    } catch (err) {
      console.error('Error creating closing:', err);
      alert(err.response?.data?.error || 'Error al crear cierre');
    } finally {
      setCreating(false);
    }
  };

  const handleViewReport = async (year, month) => {
    try {
      setLoading(true);
      const data = await monthlyClosingService.getReport(year, month);
      setReportData(data);
      setShowReportModal(true);
    } catch (err) {
      console.error('Error loading report:', err);
      alert(err.response?.data?.error || 'Error al cargar el reporte');
    } finally {
      setLoading(false);
    }
  };

  const getMonthName = (month) => {
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return months[month - 1];
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'SALUDABLE': return 'var(--secondary)';
      case 'PRECAUCIÓN': return '#f59e0b';
      case 'ATENCIÓN': return 'var(--danger)';
      default: return '#666';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SALUDABLE': return 'badge-success';
      case 'PRECAUCIÓN': return 'badge-warning';
      case 'ATENCIÓN': return 'badge-danger';
      default: return 'badge-info';
    }
  };

  var lastClosing = closings.length > 0 ? closings[0] : null;

  const renderReportContent = () => {
    if (!reportData?.closing) return <div>No hay datos disponibles</div>;

    const c = reportData.closing;
    const details = reportData.details || {};
    
    const safeParse = (val) => {
      if (typeof val === 'string') {
        try { return JSON.parse(val); } catch (e) { return {}; }
      }
      return val || {};
    };

    const arDetails = safeParse(c.accountsReceivableDetails);
    const apDetails = safeParse(c.accountsPayableDetails);
    const incomeDetails = safeParse(c.incomeDetails);
    const expenseDetails = safeParse(c.expenseDetails);
    const bankRecon = safeParse(c.bankReconciliation);
    const indicators = safeParse(c.financialIndicators);
    const summary = safeParse(c.executiveSummary);
    const validations = safeParse(c.closingValidations);

  if (loading) {
    return (
      <div className="loading-fallback">
        <div className="spinner"></div>
        <p>Cargando cierres mensuales...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="view-header">
          <div>
            <h1>Cierre Contable Mensual</h1>
            <p>Gestiona los cierres mensuales y observa el estado de tu empresa</p>
          </div>
          {hasPermission('manage_monthly_closing') && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <i className="fas fa-lock"></i>
              Nuevo Cierre Mensual
            </button>
          )}
        </div>
        <div className="error-alert">
          <span className="error-alert-icon"><i className="fas fa-exclamation-triangle"></i></span>
          <div>
            <strong>Error</strong>
            <p>{error}</p>
          </div>
        </div>
        <button onClick={() => { setError(null); loadClosings(); loadCompanyStatus(); }} className="btn btn-primary">
          Reintentar
        </button>
      </div>
    );
  }

  return (
      <div id="report-content">
        <h1 style={{ textAlign: 'center' }}>Cierre Contable Mensual</h1>
        <h2 style={{ textAlign: 'center', color: '#666' }}>
          {getMonthName(c.month)} {c.year}
        </h2>

        {/* Navigation Tabs */}
        <div className="report-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
          {[
            { id: 'resumen', label: '📊 Resumen' },
            { id: 'cxc', label: '📋 CxC' },
            { id: 'cxp', label: '📄 CxP' },
            { id: 'contabilidad', label: '📒 Contabilidad' },
            { id: 'bancos', label: '🏦 Bancos' },
            { id: 'ingresos', label: '💰 Ingresos' },
            { id: 'egresos', label: '💸 Egresos' },
            { id: 'indicadores', label: '📈 Indicadores' },
            { id: 'validaciones', label: '✅ Validaciones' },
            { id: 'informe', label: '📝 Informe Final' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                background: activeSection === tab.id ? 'var(--primary)' : '#f3f4f6',
                color: activeSection === tab.id ? '#fff' : '#374151',
                cursor: 'pointer',
                fontWeight: activeSection === tab.id ? 'bold' : 'normal',
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Section: Resumen */}
        {activeSection === 'resumen' && (
          <div className="report-section">
            <div className="kpi" style={{ display: 'flex', justifyContent: 'space-around', margin: '20px 0', flexWrap: 'wrap', gap: '10px' }}>
              <div className="kpi-item">
                <div className="kpi-value positive">{formatCurrency(c.totalIncome || 0)}</div>
                <div className="kpi-label">Total Ingresos</div>
              </div>
              <div className="kpi-item">
                <div className="kpi-value negative">{formatCurrency(c.totalExpense || 0)}</div>
                <div className="kpi-label">Total Gastos</div>
              </div>
              <div className="kpi-item">
                <div className={'kpi-value ' + (c.netBalance >= 0 ? 'positive' : 'negative')}>
                  {formatCurrency(c.netBalance || 0)}
                </div>
                <div className="kpi-label">Balance Neto</div>
              </div>
            </div>

            <div style={{ textAlign: 'center', margin: '20px 0', padding: '15px', background: '#f8f9fa', borderRadius: '10px' }}>
              <h3 style={{ margin: '0 0 10px 0' }}>Estado General de la Empresa</h3>
              <span 
                className={`badge ${getStatusBadge(summary?.generalStatus)}`}
                style={{ fontSize: '18px', padding: '10px 20px' }}
              >
                {summary?.generalStatus || 'N/A'}
              </span>
            </div>

            <h3>Resumen del Período</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
              <tbody>
                <tr><td><strong>Ventas Totales</strong></td><td style={{ textAlign: 'right' }}>{formatCurrency(c.totalSales || 0)}</td></tr>
                <tr><td><strong>Compras</strong></td><td style={{ textAlign: 'right' }}>{formatCurrency(c.totalPurchases || 0)}</td></tr>
                <tr><td><strong>Cuentas por Cobrar</strong></td><td style={{ textAlign: 'right' }}>{formatCurrency(c.totalAccountsReceivable || 0)}</td></tr>
                <tr><td><strong>Cuentas por Pagar</strong></td><td style={{ textAlign: 'right' }}>{formatCurrency(c.totalAccountsPayable || 0)}</td></tr>
                <tr><td><strong>Efectivo en Caja</strong></td><td style={{ textAlign: 'right' }}>{formatCurrency(c.cashInRegister || 0)}</td></tr>
                <tr><td><strong>Productos Vendidos</strong></td><td style={{ textAlign: 'right' }}>{c.totalProductsSold || 0}</td></tr>
                <tr><td><strong>Transacciones</strong></td><td style={{ textAlign: 'right' }}>{c.transactionCount || 0}</td></tr>
                <tr><td><strong>Facturas</strong></td><td style={{ textAlign: 'right' }}>{c.salesCount || 0}</td></tr>
              </tbody>
            </table>

            {c.notes && (
              <div style={{ marginTop: '20px', padding: '15px', background: '#fff3cd', borderRadius: '8px' }}>
                <strong>Notas:</strong>
                <p>{c.notes}</p>
              </div>
            )}

            <div style={{ marginTop: '30px', textAlign: 'center', color: '#999' }}>
              <p>Cerrado el: {new Date(c.closedAt).toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* Section: CxC - Cuentas por Cobrar */}
        {activeSection === 'cxc' && (
          <div className="report-section">
            <h3>📋 Cuentas por Cobrar (CxC)</h3>
            
            <div className="kpi" style={{ display: 'flex', justifyContent: 'space-around', margin: '20px 0', flexWrap: 'wrap', gap: '10px' }}>
              <div className="kpi-item">
                <div className="kpi-value">{formatCurrency(arDetails?.total || c.totalAccountsReceivable || 0)}</div>
                <div className="kpi-label">Total CxC</div>
              </div>
              <div className="kpi-item">
                <div className="kpi-value">{formatCurrency(arDetails?.provision || 0)}</div>
                <div className="kpi-label">Provisión</div>
              </div>
              <div className="kpi-item">
                <div className="kpi-value">{arDetails?.collectionRate || 0}%</div>
                <div className="kpi-label">Tasa Recuperación</div>
              </div>
            </div>

            <h4>Clasificación por Antigüedad</h4>
            <table>
              <thead>
                <tr>
                  <th>Rango</th>
                  <th style={{ textAlign: 'right' }}>Monto</th>
                  <th style={{ textAlign: 'right' }}>%</th>
                </tr>
              </thead>
              <tbody>
                {(arDetails?.agingDistribution || []).map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.range}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(item.amount)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {arDetails?.total > 0 ? ((item.amount / arDetails.total) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h4 style={{ marginTop: '20px' }}>Detalle de Cartera</h4>
            <ul>
              <li><strong>Total Clientes:</strong> {arDetails?.clientCount || 0}</li>
              <li><strong>Cartera Corriente:</strong> {formatCurrency(arDetails?.current || 0)}</li>
              <li><strong>Cartera Vencida (+90):</strong> {formatCurrency(arDetails?.overdue || 0)}</li>
              <li><strong>Provisión para Incobrables:</strong> {formatCurrency(arDetails?.provision || 0)}</li>
            </ul>
          </div>
        )}

        {/* Section: CxP - Cuentas por Pagar */}
        {activeSection === 'cxp' && (
          <div className="report-section">
            <h3>📄 Cuentas por Pagar (CxP)</h3>
            
            <div className="kpi" style={{ display: 'flex', justifyContent: 'space-around', margin: '20px 0', flexWrap: 'wrap', gap: '10px' }}>
              <div className="kpi-item">
                <div className="kpi-value">{formatCurrency(apDetails?.total || c.totalAccountsPayable || 0)}</div>
                <div className="kpi-label">Total CxP</div>
              </div>
              <div className="kpi-item">
                <div className="kpi-value">{formatCurrency(apDetails?.overdue || 0)}</div>
                <div className="kpi-label">Vencido</div>
              </div>
              <div className="kpi-item">
                <div className="kpi-value">{apDetails?.supplierCount || 0}</div>
                <div className="kpi-label">Proveedores</div>
              </div>
            </div>

            <h4>Clasificación por Tipo</h4>
            <table>
              <thead>
                <tr>
                  <th>Tipo de Obligación</th>
                  <th style={{ textAlign: 'right' }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Proveedores</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(apDetails?.suppliers || 0)}</td>
                </tr>
                <tr>
                  <td>Acreedores Financieros</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(apDetails?.financial || 0)}</td>
                </tr>
                <tr>
                  <td>Gastos Acumulados</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(apDetails?.accrued || 0)}</td>
                </tr>
                <tr>
                  <td><strong>Vencido</strong></td>
                  <td style={{ textAlign: 'right' }}><strong>{formatCurrency(apDetails?.overdue || 0)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Section: Contabilidad General */}
        {activeSection === 'contabilidad' && (
          <div className="report-section">
            <h3>📒 Contabilidad General</h3>
            
            <h4>Balance de Comprobación</h4>
            <table>
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th style={{ textAlign: 'right' }}>Debe</th>
                  <th style={{ textAlign: 'right' }}>Haber</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Ingresos del Mes</td>
                  <td style={{ textAlign: 'right' }}>-</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(c.totalIncome || 0)}</td>
                </tr>
                <tr>
                  <td>Gastos del Mes</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(c.totalExpense || 0)}</td>
                  <td style={{ textAlign: 'right' }}>-</td>
                </tr>
                <tr>
                  <td>Ventas Acumuladas</td>
                  <td style={{ textAlign: 'right' }}>-</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(c.totalSales || 0)}</td>
                </tr>
                <tr>
                  <td>Cuentas por Cobrar</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(c.totalAccountsReceivable || 0)}</td>
                  <td style={{ textAlign: 'right' }}>-</td>
                </tr>
                <tr>
                  <td>Cuentas por Pagar</td>
                  <td style={{ textAlign: 'right' }}>-</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(c.totalAccountsPayable || 0)}</td>
                </tr>
                <tr>
                  <td>Efectivo en Caja/Bancos</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(c.cashInRegister || 0)}</td>
                  <td style={{ textAlign: 'right' }}>-</td>
                </tr>
              </tbody>
            </table>

            <h4 style={{ marginTop: '20px' }}>Movimientos Contables</h4>
            <ul>
              <li><strong>Entradas de Ingreso:</strong> {details?.accountingEntries?.incomeEntries || 0}</li>
              <li><strong>Entradas de Gasto:</strong> {details?.accountingEntries?.expenseEntries || 0}</li>
              <li><strong>Total Transacciones:</strong> {c.transactionCount || 0}</li>
              <li><strong>Facturas Emitidas:</strong> {c.salesCount || 0}</li>
            </ul>
          </div>
        )}

        {/* Section: Bancos - Movimientos Financieros */}
        {activeSection === 'bancos' && (
          <div className="report-section">
            <h3>🏦 Movimientos Financieros / Bancos</h3>
            
            <div className="kpi" style={{ display: 'flex', justifyContent: 'space-around', margin: '20px 0', flexWrap: 'wrap', gap: '10px' }}>
              <div className="kpi-item">
                <div className="kpi-value">{formatCurrency(bankRecon?.totalDeposits || 0)}</div>
                <div className="kpi-label">Total Depósitos</div>
              </div>
              <div className="kpi-item">
                <div className="kpi-value">{formatCurrency(bankRecon?.totalWithdrawals || 0)}</div>
                <div className="kpi-label">Total Retiros</div>
              </div>
              <div className="kpi-item">
                <div className="kpi-value">{formatCurrency(bankRecon?.netMovement || 0)}</div>
                <div className="kpi-label">Movimiento Neto</div>
              </div>
            </div>

            <h4>Conciliación Bancaria</h4>
            <table>
              <tbody>
                <tr>
                  <td>Saldo Inicial</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(bankRecon?.openingBalance || 0)}</td>
                </tr>
                <tr>
                  <td>Depósitos</td>
                  <td style={{ textAlign: 'right' }}>+ {formatCurrency(bankRecon?.totalDeposits || 0)}</td>
                </tr>
                <tr>
                  <td>Retiros</td>
                  <td style={{ textAlign: 'right' }}>- {formatCurrency(bankRecon?.totalWithdrawals || 0)}</td>
                </tr>
                <tr>
                  <td><strong>Saldo Final</strong></td>
                  <td style={{ textAlign: 'right' }}><strong>{formatCurrency(bankRecon?.closingBalance || 0)}</strong></td>
                </tr>
              </tbody>
            </table>

            <h4 style={{ marginTop: '20px' }}>Flujo de Efectivo</h4>
            <table>
              <tbody>
                <tr>
                  <td>Operaciones</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(bankRecon?.cashFlow?.operating || c.netBalance || 0)}</td>
                </tr>
                <tr>
                  <td>Inversión</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(bankRecon?.cashFlow?.investing || 0)}</td>
                </tr>
                <tr>
                  <td>Financiamiento</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(bankRecon?.cashFlow?.financing || 0)}</td>
                </tr>
                <tr>
                  <td><strong>Cambio Neto en Efectivo</strong></td>
                  <td style={{ textAlign: 'right' }}><strong>{formatCurrency(bankRecon?.cashFlow?.netChange || 0)}</strong></td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginTop: '15px', padding: '10px', background: bankRecon?.reconciled ? '#d1fae5' : '#fee2e2', borderRadius: '6px' }}>
              <strong>Estado de Conciliación:</strong> {bankRecon?.reconciled ? '✅ Conciliado' : '⚠️ Pendiente'}
            </div>
          </div>
        )}

        {/* Section: Ingresos */}
        {activeSection === 'ingresos' && (
          <div className="report-section">
            <h3>💰 Ventas / Ingresos</h3>
            
            <div className="kpi" style={{ display: 'flex', justifyContent: 'space-around', margin: '20px 0', flexWrap: 'wrap', gap: '10px' }}>
              <div className="kpi-item">
                <div className="kpi-value positive">{formatCurrency(c.totalIncome || 0)}</div>
                <div className="kpi-label">Total Ingresos</div>
              </div>
              <div className="kpi-item">
                <div className="kpi-value">{formatCurrency(c.totalSales || 0)}</div>
                <div className="kpi-label">Ventas</div>
              </div>
            </div>

            <h4>Desglose de Ingresos</h4>
            <table>
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th style={{ textAlign: 'right' }}>Monto</th>
                  <th style={{ textAlign: 'right' }}>%</th>
                </tr>
              </thead>
              <tbody>
                {(incomeDetails?.breakdown || []).map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.category}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(item.amount)}</td>
                    <td style={{ textAlign: 'right' }}>{item.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h4 style={{ marginTop: '20px' }}>Comparación con Ventas</h4>
            <ul>
              <li><strong>Ventas del Período:</strong> {formatCurrency(c.totalSales || 0)}</li>
              <li><strong>Total Transacciones:</strong> {c.salesCount || 0}</li>
              <li><strong>Productos Vendidos:</strong> {c.totalProductsSold || 0} unidades</li>
            </ul>
          </div>
        )}

        {/* Section: Egresos */}
        {activeSection === 'egresos' && (
          <div className="report-section">
            <h3>💸 Egresos y Costos</h3>
            
            <div className="kpi" style={{ display: 'flex', justifyContent: 'space-around', margin: '20px 0', flexWrap: 'wrap', gap: '10px' }}>
              <div className="kpi-item">
                <div className="kpi-value negative">{formatCurrency(c.totalExpense || 0)}</div>
                <div className="kpi-label">Total Gastos</div>
              </div>
              <div className="kpi-item">
                <div className="kpi-value">{formatCurrency(c.totalPurchases || 0)}</div>
                <div className="kpi-label">Compras</div>
              </div>
            </div>

            <h4>Clasificación de Gastos</h4>
            <table>
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th style={{ textAlign: 'right' }}>Monto</th>
                  <th style={{ textAlign: 'right' }}>%</th>
                </tr>
              </thead>
              <tbody>
                {(expenseDetails?.breakdown || []).map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.category}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(item.amount)}</td>
                    <td style={{ textAlign: 'right' }}>{item.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h4 style={{ marginTop: '20px' }}>Análisis Costos vs Ingresos</h4>
            <ul>
              <li><strong>Total Gastos:</strong> {formatCurrency(c.totalExpense || 0)}</li>
              <li><strong>Total Ingresos:</strong> {formatCurrency(c.totalIncome || 0)}</li>
              <li><strong>Ratio Gastos/Ingresos:</strong> {
                c.totalIncome > 0 ? ((c.totalExpense / c.totalIncome) * 100).toFixed(1) : 0
              }%</li>
            </ul>
          </div>
        )}

        {/* Section: Indicadores Financieros */}
        {activeSection === 'indicadores' && (
          <div className="report-section">
            <h3>📈 Estados Financieros / Indicadores</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', margin: '20px 0' }}>
              <div style={{ background: '#f0f9ff', padding: '15px', borderRadius: '10px' }}>
                <h4 style={{ color: '#0369a1' }}>📊 Rentabilidad</h4>
                <table style={{ width: '100%' }}>
                  <tbody>
                    <tr><td>Margen Neto</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>{indicators?.profitability?.netMargin || 0}%</td></tr>
                    <tr><td>Margen Bruto</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>{indicators?.profitability?.grossMargin || 0}%</td></tr>
                  </tbody>
                </table>
              </div>

              <div style={{ background: '#f0fdf4', padding: '15px', borderRadius: '10px' }}>
                <h4 style={{ color: '#15803d' }}>💧 Liquidez</h4>
                <table style={{ width: '100%' }}>
                  <tbody>
                    <tr><td>Ratio Corriente</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>{indicators?.liquidity?.currentRatio || 0}</td></tr>
                    <tr><td>Ratio Rápido</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>{indicators?.liquidity?.quickRatio || 0}</td></tr>
                    <tr><td>Ratio Efectivo</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>{indicators?.liquidity?.cashRatio || 0}</td></tr>
                    <tr><td>Capital Trabajo</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(indicators?.liquidity?.workingCapital || 0)}</td></tr>
                  </tbody>
                </table>
              </div>

              <div style={{ background: '#fff7ed', padding: '15px', borderRadius: '10px' }}>
                <h4 style={{ color: '#c2410c' }}>⚖️ Endeudamiento</h4>
                <table style={{ width: '100%' }}>
                  <tbody>
                    <tr><td>Ratio Deuda</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>{indicators?.leverage?.debtRatio || 0}%</td></tr>
                    <tr><td>Cobertura Intereses</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>{indicators?.leverage?.interestCoverage || 0}</td></tr>
                  </tbody>
                </table>
              </div>

              <div style={{ background: '#fef2f2', padding: '15px', borderRadius: '10px' }}>
                <h4 style={{ color: '#b91c1c' }}>📁 Calidad de Cartera</h4>
                <table style={{ width: '100%' }}>
                  <tbody>
                    <tr><td>Tasa Morosidad</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>{indicators?.portfolioQuality?.overdueRate || 0}%</td></tr>
                    <tr><td>Tasa Provisión</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>{indicators?.portfolioQuality?.provisionRate || 0}%</td></tr>
                    <tr><td>Eficiencia Cobro</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>{indicators?.portfolioQuality?.collectionEfficiency || 0}%</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <h4>Estado de Resultados</h4>
            <table>
              <tbody>
                <tr><td><strong>Ingresos Totales</strong></td><td style={{ textAlign: 'right' }}><strong>{formatCurrency(c.totalIncome || 0)}</strong></td></tr>
                <tr><td style={{ paddingLeft: '20px' }}>- Costo de Ventas</td><td style={{ textAlign: 'right' }}>({formatCurrency(c.totalPurchases || 0)})</td></tr>
                <tr><td><strong>Margen Bruto</strong></td><td style={{ textAlign: 'right' }}><strong>{formatCurrency((c.totalIncome || 0) - (c.totalPurchases || 0))}</strong></td></tr>
                <tr><td style={{ paddingLeft: '20px' }}>- Gastos Operativos</td><td style={{ textAlign: 'right' }}>({formatCurrency(expenseDetails?.operational || 0)})</td></tr>
                <tr><td style={{ paddingLeft: '20px' }}>- Gastos Administrativos</td><td style={{ textAlign: 'right' }}>({formatCurrency(expenseDetails?.administrative || 0)})</td></tr>
                <tr><td style={{ paddingLeft: '20px' }}>- Gastos Financieros</td><td style={{ textAlign: 'right' }}>({formatCurrency(expenseDetails?.financial || 0)})</td></tr>
                <tr><td><strong>Utilidad Neta</strong></td><td style={{ textAlign: 'right' }}><strong style={{ color: c.netBalance >= 0 ? 'green' : 'red' }}>{formatCurrency(c.netBalance || 0)}</strong></td></tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Section: Validaciones */}
        {activeSection === 'validaciones' && (
          <div className="report-section">
            <h3>✅ Control Interno y Validaciones</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', margin: '20px 0' }}>
              <div style={{ 
                padding: '15px', 
                borderRadius: '10px',
                background: validations?.cxcMatch ? '#d1fae5' : '#fee2e2'
              }}>
                <h4>✓ CxC vs Ingresos</h4>
                <p style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {validations?.cxcMatch ? '✅ Consistente' : '⚠️ Validar'}
                </p>
              </div>
              
              <div style={{ 
                padding: '15px', 
                borderRadius: '10px',
                background: validations?.cxpMatch ? '#d1fae5' : '#fee2e2'
              }}>
                <h4>✓ CxP vs Egresos</h4>
                <p style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {validations?.cxpMatch ? '✅ Consistente' : '⚠️ Validar'}
                </p>
              </div>
              
              <div style={{ 
                padding: '15px', 
                borderRadius: '10px',
                background: validations?.bankMatch ? '#d1fae5' : '#fee2e2'
              }}>
                <h4>✓ Conciliación Bancaria</h4>
                <p style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {validations?.bankMatch ? '✅ Conciliado' : '⚠️ Diferencias'}
                </p>
              </div>
              
              <div style={{ 
                padding: '15px', 
                borderRadius: '10px',
                background: validations?.balancesConsistent ? '#d1fae5' : '#fee2e2'
              }}>
                <h4>✓ Balance Consistente</h4>
                <p style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {validations?.balancesConsistent ? '✅ OK' : '⚠️ Error'}
                </p>
              </div>
            </div>

            <div style={{ 
              padding: '20px', 
              borderRadius: '10px',
              background: validations?.allValid ? '#d1fae5' : '#fef3c7',
              textAlign: 'center'
            }}>
              <h3 style={{ margin: 0 }}>
                {validations?.allValid ? '🎉 Cierre Validado Exitosamente' : '⚠️ Revisar Inconsistencias'}
              </h3>
            </div>
          </div>
        )}

        {/* Section: Informe Final */}
        {activeSection === 'informe' && (
          <div className="report-section">
            <h3>📝 Informe Final</h3>
            
            <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '10px', marginBottom: '20px' }}>
              <h4 style={{ color: getStatusColor(summary?.generalStatus) }}>
                Estado General: {summary?.generalStatus || 'N/A'}
              </h4>
              <p>Fecha de análisis: {new Date(summary?.summaryDate || c.closedAt).toLocaleDateString()}</p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4>🔍 Principales Hallazgos</h4>
              <ul>
                {(summary?.keyFindings || []).map((finding, idx) => (
                  <li key={idx}>{finding}</li>
                ))}
                {(!summary?.keyFindings || summary.keyFindings.length === 0) && (
                  <li>No hay hallazgos significativos</li>
                )}
              </ul>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4>⚠️ Riesgos Financieros Detectados</h4>
              <ul>
                {(summary?.risks || []).map((risk, idx) => (
                  <li key={idx} style={{ color: 'var(--danger)' }}>{risk}</li>
                ))}
                {(!summary?.risks || summary.risks.length === 0) && (
                  <li style={{ color: 'var(--secondary)' }}>No se detectaron riesgos críticos</li>
                )}
              </ul>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4>💡 Recomendaciones Estratégicas</h4>
              <ul>
                {(summary?.recommendations || []).map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
                {(!summary?.recommendations || summary.recommendations.length === 0) && (
                  <li>Continuar con las prácticas actuales</li>
                )}
              </ul>
            </div>

            <div style={{ 
              marginTop: '30px', 
              padding: '20px', 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
              borderRadius: '10px',
              color: 'white',
              textAlign: 'center'
            }}>
              <h3 style={{ margin: '0 0 10px 0' }}>FINANDEX</h3>
              <p style={{ margin: 0 }}>Sistema de Gestión Financiera</p>
              <p style={{ fontSize: '12px', opacity: 0.8, marginTop: '10px' }}>
                Reporte generado el {new Date().toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="view-header">
        <div>
          <h1>Cierre Contable Mensual</h1>
          <p>Gestiona los cierres mensuales y observa el estado de tu empresa</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-outline" onClick={() => { setError(null); loadClosings(); loadCompanyStatus(); }} disabled={loading || statusLoading}>
            <i className="fas fa-sync-alt"></i> Actualizar
          </button>
          {hasPermission('manage_monthly_closing') && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <i className="fas fa-lock"></i>
              Nuevo Cierre Mensual
            </button>
          )}
        </div>
      </div>

      {companyStatus && !error && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0 }}>Estado Actual de la Empresa</h2>
            <span className={`badge ${companyStatus.status === 'CLOSED' ? 'badge-success' : 'badge-warning'}`}>
              {companyStatus.status === 'CLOSED' ? 'Mes Cerrado' : 'Mes en Curso'}
            </span>
          </div>
          
          {companyStatus.lastClosedPeriod && (
            <div style={{ padding: '12px 16px', background: '#f0f9ff', borderRadius: '8px', marginBottom: '16px', borderLeft: '4px solid #0ea5e9' }}>
              <strong>Último período cerrado:</strong> {getMonthName(companyStatus.lastClosedPeriod.month)} {companyStatus.lastClosedPeriod.year}
            </div>
          )}

          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-icon" style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: 'var(--secondary)' }}>
                <i className="fas fa-calendar-alt"></i>
              </div>
              <div className="kpi-info">
                <h3>Período Actual</h3>
                <h2 style={{ fontSize: '18px' }}>{companyStatus.currentMonth?.period}</h2>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon" style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: 'rgb(34,197,94)' }}>
                <i className="fas fa-arrow-up"></i>
              </div>
              <div className="kpi-info">
                <h3>Ingresos del Mes</h3>
                <h2>{formatCurrency(companyStatus.currentMonth?.income || 0)}</h2>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>
                <i className="fas fa-arrow-down"></i>
              </div>
              <div className="kpi-info">
                <h3>Gastos del Mes</h3>
                <h2>{formatCurrency(companyStatus.currentMonth?.expense || 0)}</h2>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon" style={{ backgroundColor: companyStatus.currentMonth?.netBalance >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: companyStatus.currentMonth?.netBalance >= 0 ? 'var(--secondary)' : 'var(--danger)' }}>
                <i className="fas fa-wallet"></i>
              </div>
              <div className="kpi-info">
                <h3>Balance del Mes</h3>
                <h2 style={{ color: companyStatus.currentMonth?.netBalance >= 0 ? 'var(--secondary)' : 'var(--danger)' }}>
                  {formatCurrency(companyStatus.currentMonth?.netBalance || 0)}
                </h2>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon" style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: 'rgb(59,130,246)' }}>
                <i className="fas fa-hand-holding-usd"></i>
              </div>
              <div className="kpi-info">
                <h3>CxC (Por Cobrar)</h3>
                <h2>{formatCurrency(companyStatus.currentMonth?.accountsReceivable || 0)}</h2>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon" style={{ backgroundColor: 'rgba(249,115,22,0.1)', color: '#f97316' }}>
                <i className="fas fa-file-invoice-dollar"></i>
              </div>
              <div className="kpi-info">
                <h3>CxP (Por Pagar)</h3>
                <h2>{formatCurrency(companyStatus.currentMonth?.accountsPayable || 0)}</h2>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon" style={{ backgroundColor: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}>
                <i className="fas fa-cash-register"></i>
              </div>
              <div className="kpi-info">
                <h3>Efectivo en Caja</h3>
                <h2>{formatCurrency(companyStatus.currentMonth?.cashInRegister || 0)}</h2>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon" style={{ backgroundColor: 'rgba(236,72,153,0.1)', color: '#ec4899' }}>
                <i className="fas fa-chart-pie"></i>
              </div>
              <div className="kpi-info">
                <h3>Capital de Trabajo</h3>
                <h2>{formatCurrency(companyStatus.totals?.workingCapital || 0)}</h2>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '16px' }}>
            <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: companyStatus.totals?.currentRatio >= 1 ? 'var(--secondary)' : 'var(--danger)' }}>
                {companyStatus.totals?.currentRatio}
              </div>
              <div style={{ color: '#666', fontSize: '14px' }}>Ratio Corriente</div>
              <div style={{ fontSize: '12px', color: '#999' }}>Meta: &gt; 1.0</div>
            </div>
            <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: companyStatus.totals?.quickRatio >= 0.5 ? 'var(--secondary)' : 'var(--danger)' }}>
                {companyStatus.totals?.quickRatio}
              </div>
              <div style={{ color: '#666', fontSize: '14px' }}>Ratio Rápido</div>
              <div style={{ fontSize: '12px', color: '#999' }}>Meta: &gt; 0.5</div>
            </div>
            <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{companyStatus.totals?.products}</div>
              <div style={{ color: '#666', fontSize: '14px' }}>Productos Activos</div>
            </div>
            <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{companyStatus.totals?.clients}</div>
              <div style={{ color: '#666', fontSize: '14px' }}>Clientes</div>
            </div>
            <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{companyStatus.totals?.suppliers}</div>
              <div style={{ color: '#666', fontSize: '14px' }}>Proveedores</div>
            </div>
            <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--secondary)' }}>{companyStatus.yearToDate?.salesCount || 0}</div>
              <div style={{ color: '#666', fontSize: '14px' }}>Ventas Año</div>
            </div>
          </div>
        </div>
      )}

      <h3 style={{ marginBottom: '16px' }}>Historial de Cierres</h3>
      
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Año:</label>
          <select 
            className="form-control" 
            style={{ width: 'auto', minWidth: '120px' }}
            value={listFilters.year}
            onChange={(e) => setListFilters({ ...listFilters, year: e.target.value })}
          >
            <option value="">Todos</option>
            {[2024, 2025, 2026, 2027, 2028].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Estado:</label>
          <select 
            className="form-control" 
            style={{ width: 'auto', minWidth: '150px' }}
            value={listFilters.status}
            onChange={(e) => setListFilters({ ...listFilters, status: e.target.value })}
          >
            <option value="">Cualquier estado</option>
            <option value="CLOSED">Cerrado</option>
            <option value="OPEN">Abierto</option>
          </select>
        </div>

        {(listFilters.year || listFilters.status) && (
          <button 
            className="btn btn-outline" 
            style={{ padding: '4px 12px', fontSize: '0.85rem' }}
            onClick={() => setListFilters({ year: '', status: '' })}
          >
            <i className="fas fa-times"></i> Limpiar Filtros
          </button>
        )}
      </div>

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Período</th>
              <th>Ingresos</th>
              <th>Gastos</th>
              <th>Balance</th>
              <th>Ventas</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" style={{ textAlign: 'center' }}>Cargando...</td></tr>
            ) : closings.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center' }}>No hay cierres registrados</td></tr>
            ) : (
              closings.map((closing) => (
                <tr key={closing.id}>
                  <td>
                    <strong>{getMonthName(closing.month)} {closing.year}</strong>
                  </td>
                  <td style={{ color: 'var(--secondary)' }}>{formatCurrency(closing.totalIncome)}</td>
                  <td style={{ color: 'var(--danger)' }}>{formatCurrency(closing.totalExpense)}</td>
                  <td>
                    <strong style={{ color: closing.netBalance >= 0 ? 'var(--secondary)' : 'var(--danger)' }}>
                      {formatCurrency(closing.netBalance)}
                    </strong>
                  </td>
                  <td>{formatCurrency(closing.totalSales)}</td>
                  <td>
                    <span className="badge badge-success">{closing.status}</span>
                  </td>
                  <td>
                    <button
                      className="btn btn-outline"
                      onClick={() => handleViewReport(closing.year, closing.month)}
                      style={{ marginRight: '8px', padding: '6px 12px' }}
                    >
                      <i className="fas fa-print"></i> Ver Reporte
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h2>Nuevo Cierre Mensual</h2>
            
            <div className="form-group">
              <label>Año *</label>
              <select
                className="form-control"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                required
              >
                {[2024, 2025, 2026, 2027, 2028].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Mes *</label>
              <select
                className="form-control"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                required
              >
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(month => (
                  <option key={month} value={month}>{getMonthName(month)}</option>
                ))}
              </select>
            </div>

            {monthStatus && (
              <div style={{ margin: '20px 0', padding: '15px', background: monthStatus.isClosed ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', borderRadius: '8px' }}>
                {monthStatus.isClosed ? (
                  <div>
                    <p style={{ color: 'var(--danger)', fontWeight: 'bold' }}>⚠️ Este mes ya está cerrado</p>
                    <p>Balance: {formatCurrency(monthStatus.closing ? monthStatus.closing.netBalance : 0)}</p>
                  </div>
                ) : (
                  <div>
                    <p style={{ color: 'var(--secondary)', fontWeight: 'bold' }}>✓ Mes activo - puede proceder al cierre</p>
                    <p>Ingresos actuales: {formatCurrency(monthStatus.currentData ? monthStatus.currentData.totalIncome : 0)}</p>
                    <p>Gastos actuales: {formatCurrency(monthStatus.currentData ? monthStatus.currentData.totalExpense : 0)}</p>
                    <p>Balance: {formatCurrency(monthStatus.currentData ? monthStatus.currentData.netBalance : 0)}</p>
                    <p>Ventas: {monthStatus.currentData ? monthStatus.currentData.salesCount : 0}</p>
                    <p>CxC: {formatCurrency(monthStatus.currentData ? monthStatus.currentData.totalAccountsReceivable : 0)}</p>
                    <p>CxP: {formatCurrency(monthStatus.currentData ? monthStatus.currentData.totalAccountsPayable : 0)}</p>
                  </div>
                )}
              </div>
            )}

            {openingBalances && !monthStatus?.isClosed && (
              <div style={{ margin: '20px 0', padding: '15px', background: '#f0fdf4', borderRadius: '8px', borderLeft: '4px solid var(--secondary)' }}>
                <h4 style={{ margin: '0 0 12px 0', color: 'var(--secondary)' }}>
                  📊 Balances de Cierre del Período Anterior
                </h4>
                {openingBalances.isFirstMonth ? (
                  <p style={{ color: '#666' }}>Es el primer mes de operación. Los saldos se inicializan en cero.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div><strong>Período Anterior:</strong></div>
                    <div>{openingBalances.previousPeriod?.monthName} {openingBalances.previousPeriod?.year}</div>
                    
                    <div>Balance Anterior:</div>
                    <div style={{ fontWeight: 'bold', color: openingBalances.openingBalances?.netBalance >= 0 ? 'var(--secondary)' : 'var(--danger)' }}>
                      {formatCurrency(openingBalances.openingBalances?.netBalance || 0)}
                    </div>
                    
                    <div>CxC (Cartera):</div>
                    <div>{formatCurrency(openingBalances.openingBalances?.totalAccountsReceivable || 0)}</div>
                    
                    <div>CxP (Proveedores):</div>
                    <div>{formatCurrency(openingBalances.openingBalances?.totalAccountsPayable || 0)}</div>
                    
                    <div>Efectivo en Caja:</div>
                    <div>{formatCurrency(openingBalances.openingBalances?.cashInRegister || 0)}</div>
                    
                    <div>Ventas Acumuladas:</div>
                    <div>{formatCurrency(openingBalances.openingBalances?.totalSales || 0)}</div>
                  </div>
                )}
                {openingBalances.currentData && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #ddd' }}>
                    <p style={{ margin: '4px 0', fontSize: '13px' }}>
                      <strong>⚡ Movimiento del mes actual:</strong> Ingresos: {formatCurrency(openingBalances.currentData.income)} | Gastos: {formatCurrency(openingBalances.currentData.expense)}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="form-group">
              <label>Notas</label>
              <textarea
                className="form-control"
                rows="3"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observaciones del cierre..."
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button 
                className="btn btn-primary" 
                onClick={handleCreateClosing}
                disabled={monthStatus?.isClosed || creating}
              >
                {creating ? 'Creando...' : 'Confirmar Cierre'}
              </button>
              <button 
                className="btn btn-outline" 
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showReportModal && reportData && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}>
            {renderReportContent()}

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'center', position: 'sticky', bottom: '0', background: '#fff', padding: '15px', borderTop: '1px solid #eee' }}>
              <button className="btn btn-primary" onClick={() => window.print()}>
                <i className="fas fa-print"></i> Imprimir Reporte
              </button>
              <button className="btn btn-outline" onClick={() => setShowReportModal(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyClosing;