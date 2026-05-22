import { useState, useEffect, useCallback, memo } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement } from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { costService } from '../services/api';
import { useApp } from '../context/AppContext';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement);

const KPICard = memo(({ icon, iconStyle, title, value, subtitle, trend, trendLabel }) => (
  <div className="kpi-card">
    <div className="kpi-icon" style={iconStyle}>
      <i className={`fas fa-${icon}`}></i>
    </div>
    <div className="kpi-info">
      <h3>{title}</h3>
      <h2>{value}</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        {subtitle}
        {trend !== undefined && (
          <span style={{
            marginLeft: '8px',
            color: trend > 0 ? 'var(--secondary)' : trend < 0 ? 'var(--danger)' : 'var(--text-muted)',
            fontWeight: 600
          }}>
            {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend).toFixed(1)}%
            {trendLabel && ` ${trendLabel}`}
          </span>
        )}
      </p>
    </div>
  </div>
));

const formatCurrency = (value, currencySymbol = '$') => {
  return `${currencySymbol}${Number(value).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const PnLRow = ({ label, value, isTotal = false, isNegative = false, indent = false, color }) => (
  <tr>
    <td style={{ padding: '8px 16px', fontWeight: isTotal ? 700 : 400, paddingLeft: indent ? '32px' : '16px' }}>
      {label}
    </td>
    <td style={{
      padding: '8px 16px',
      textAlign: 'right',
      fontWeight: isTotal ? 700 : 400,
      fontSize: isTotal ? '1.1rem' : 'inherit',
      borderTop: isTotal ? '2px solid var(--border-color)' : 'none',
      color: color || (isNegative ? 'var(--danger)' : isTotal ? 'var(--primary)' : 'inherit')
    }}>
      {value}
    </td>
  </tr>
);

const Costs = () => {
  const [data, setData] = useState(null);
  const [pnlData, setPnlData] = useState(null);
  const [categoryData, setCategoryData] = useState(null);
  const [trendData, setTrendData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    categoryId: '',
    view: 'summary',
  });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const { formatCurrency: appFormatCurrency } = useApp();
  const fmt = appFormatCurrency || formatCurrency;

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const params = {};
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.categoryId) params.categoryId = filters.categoryId;

      const [costRes, pnlRes, catRes, trendRes] = await Promise.all([
        costService.getReport(params),
        costService.getProfitLoss(params),
        costService.getByCategory(params),
        costService.getTrend({ months: 12 }),
      ]);
      setData(costRes.data);
      setPnlData(pnlRes.data);
      setCategoryData(catRes.data);
      setTrendData(trendRes.data);
    } catch (err) {
      console.error('Error loading costs:', err);
      setError(err.response?.data?.error || 'Error al cargar datos de costos');
    } finally {
      setLoading(false);
    }
  }, [filters.startDate, filters.endDate, filters.categoryId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleViewProduct = async (productId) => {
    try {
      const response = await costService.getProductAnalysis(productId, { months: 12 });
      setSelectedProduct(response.data);
    } catch (err) {
      console.error('Error loading product analysis:', err);
    }
  };

  if (loading) {
    return (
      <div className="loading-fallback">
        <div className="spinner"></div>
        <p>Cargando análisis de costos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="error-alert">
          <span className="error-alert-icon">⚠️</span>
          <div>
            <strong>Error</strong>
            <p>{error}</p>
          </div>
        </div>
        <button onClick={loadData} className="btn btn-primary">
          Reintentar
        </button>
      </div>
    );
  }

  const chartData = {
    labels: ['Costo de Ventas', 'Gastos Operativos', 'Ganancia Bruta', 'Ganancia Neta'],
    datasets: [
      {
        data: [
          data?.summary?.costOfGoodsSold || 0,
          data?.summary?.totalExpenses || 0,
          data?.summary?.grossProfit || 0,
          data?.summary?.netProfit || 0,
        ],
        backgroundColor: [
          'rgba(239, 68, 68, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(79, 70, 229, 0.8)',
        ],
        borderWidth: 0,
      },
    ],
  };

  const marginChartData = {
    labels: data?.products?.slice(0, 10).map(p => p.name.substring(0, 15)) || [],
    datasets: [
      {
        label: 'Margen de Ganancia Actual (%)',
        data: data?.products?.slice(0, 10).map(p => parseFloat(p.currentMargin)) || [],
        backgroundColor: data?.products?.slice(0, 10).map(p =>
          parseFloat(p.currentMargin) > 30 ? 'rgba(16, 185, 129, 0.8)' :
          parseFloat(p.currentMargin) > 15 ? 'rgba(245, 158, 11, 0.8)' :
          'rgba(239, 68, 68, 0.8)'
        ) || [],
      },
    ],
  };

  const categoryChartData = categoryData ? {
    labels: categoryData.categories.map(c => c.category),
    datasets: [
      {
        label: 'Costo',
        data: categoryData.categories.map(c => c.totalCost),
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
      },
      {
        label: 'Ingreso',
        data: categoryData.categories.map(c => c.totalRevenue),
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
      },
    ],
  } : null;

  const trendChartData = trendData ? {
    labels: trendData.trend.map(m => {
      const parts = m.month.split('-');
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      return `${months[parseInt(parts[1]) - 1]}-${parts[0].slice(2)}`;
    }),
    datasets: [
      {
        label: 'Ingresos',
        data: trendData.trend.map(m => m.revenue),
        borderColor: 'rgba(16, 185, 129, 1)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Costo de Ventas',
        data: trendData.trend.map(m => m.costOfGoodsSold),
        borderColor: 'rgba(239, 68, 68, 1)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Ganancia Neta',
        data: trendData.trend.map(m => m.netProfit),
        borderColor: 'rgba(79, 70, 229, 1)',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  } : null;

  const variance = pnlData?.variance;

  return (
    <div>
      <div className="view-header">
        <div>
          <h1>Centro de Costos</h1>
          <p>Control, análisis y estado de resultados financieros</p>
        </div>
        <button onClick={loadData} className="btn btn-outline">
          <i className="fas fa-sync-alt"></i> Actualizar
        </button>
      </div>

      <div style={{ marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <input
          type="date"
          className="form-control"
          value={filters.startDate}
          onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          style={{ maxWidth: '180px' }}
        />
        <input
          type="date"
          className="form-control"
          value={filters.endDate}
          onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
          style={{ maxWidth: '180px' }}
        />
        <select
          className="form-control"
          value={filters.categoryId}
          onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
          style={{ maxWidth: '200px' }}
        >
          <option value="">Todas las categorías</option>
          {data?.categories?.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { key: 'summary', label: 'Resumen' },
            { key: 'products', label: 'Productos' },
            { key: 'analysis', label: 'Análisis' },
            { key: 'profit-loss', label: 'P&L' },
            { key: 'by-category', label: 'Categorías' },
            { key: 'trend', label: 'Tendencia' },
          ].map(tab => (
            <button
              key={tab.key}
              className={`btn ${filters.view === tab.key ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFilters({ ...filters, view: tab.key })}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="kpi-grid">
        <KPICard
          icon="coins"
          iconStyle={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}
          title="Costo de Ventas"
          value={fmt(data?.summary?.costOfGoodsSold || 0)}
          subtitle="Costo total de productos vendidos"
          trend={variance?.cogsChange}
          trendLabel="vs período anterior"
        />
        <KPICard
          icon="chart-line"
          iconStyle={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--secondary)' }}
          title="Ganancia Bruta"
          value={fmt(data?.summary?.grossProfit || 0)}
          subtitle={`Margen: ${data?.summary?.grossMargin || 0}%`}
          trend={variance?.grossProfitChange}
          trendLabel="vs período anterior"
        />
        <KPICard
          icon="percentage"
          iconStyle={{ backgroundColor: 'rgba(79, 70, 229, 0.1)', color: 'var(--primary)' }}
          title="Ganancia Neta"
          value={fmt(data?.summary?.netProfit || 0)}
          subtitle={`Margen: ${data?.summary?.netMargin || 0}%`}
          trend={variance?.netProfitChange}
          trendLabel="vs período anterior"
        />
        <KPICard
          icon="receipt"
          iconStyle={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent)' }}
          title="Gastos Operativos"
          value={fmt(data?.summary?.totalExpenses || 0)}
          subtitle="Total gastos del período"
          trend={variance?.expensesChange}
          trendLabel="vs período anterior"
        />
      </div>

      {/* Resumen */}
      {filters.view === 'summary' && (
        <>
          <div style={{ marginTop: '32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div className="kpi-card">
              <h3 style={{ marginBottom: '16px' }}>📦 Valor del Inventario</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Costo del Inventario</p>
                  <strong style={{ fontSize: '1.25rem' }}>{fmt(data?.summary?.totalInventoryCost || 0)}</strong>
                </div>
                <div>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Valor de Venta</p>
                  <strong style={{ fontSize: '1.25rem', color: 'var(--secondary)' }}>{fmt(data?.summary?.totalInventoryValue || 0)}</strong>
                </div>
              </div>
              <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-main)', borderRadius: '8px' }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Ganancia Potencial</p>
                <strong style={{ fontSize: '1.5rem', color: 'var(--primary)' }}>{fmt(data?.summary?.potentialProfit || 0)}</strong>
              </div>
            </div>

            <div className="kpi-card">
              <h3 style={{ marginBottom: '16px' }}>📊 Distribución de Costos</h3>
              <div style={{ maxHeight: '200px' }}>
                <Doughnut
                  data={chartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: { boxWidth: 12, padding: 8, font: { size: 10 } },
                      },
                    },
                  }}
                />
              </div>
            </div>
          </div>

          {/* Mini P&L en resumen */}
          {pnlData && (
            <div className="kpi-card" style={{ marginTop: '24px' }}>
              <h3 style={{ marginBottom: '16px' }}>📋 Estado de Resultados (Resumen)</h3>
              <table style={{ width: '100%', maxWidth: '500px' }}>
                <tbody>
                  <PnLRow label="Ingresos por Ventas" value={fmt(pnlData.current.revenue.total)} color="var(--secondary)" />
                  <PnLRow label="Costo de Ventas" value={`(${fmt(pnlData.current.costOfGoodsSold)})`} isNegative indent color="var(--danger)" />
                  <PnLRow label="Utilidad Bruta" value={fmt(pnlData.current.grossProfit)} isTotal color={pnlData.current.grossProfit >= 0 ? 'var(--secondary)' : 'var(--danger)'} />
                  <PnLRow label={`Gastos Operativos (${pnlData.current.expenseRatio.toFixed(1)}% de ingresos)`} value={`(${fmt(pnlData.current.totalExpenses)})`} isNegative indent color="var(--accent)" />
                  <PnLRow label="Utilidad Neta" value={fmt(pnlData.current.netProfit)} isTotal color={pnlData.current.netProfit >= 0 ? 'var(--primary)' : 'var(--danger)'} />
                  <PnLRow label="Margen Neto" value={`${pnlData.current.netMargin.toFixed(2)}%`} isTotal color="var(--primary)" />
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Productos */}
      {filters.view === 'products' && (
        <div style={{ marginTop: '32px' }}>
          <h2 style={{ marginBottom: '16px' }}>💰 Análisis por Producto</h2>
          <div className="data-table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Costo Actual</th>
                  <th>Costo Histórico</th>
                  <th>Precio</th>
                  <th>Margen Actual</th>
                  <th>Margen Histórico</th>
                  <th>Vendidos</th>
                  <th>Ganancia</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data?.products?.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <strong>{product.name}</strong>
                      <br />
                      <small style={{ color: 'var(--text-muted)' }}>SKU: {product.sku}</small>
                    </td>
                    <td>{product.category?.name || '-'}</td>
                    <td>
                      {fmt(product.cost)}
                      {product.historicalCost > 0 && product.cost !== product.historicalCost && (
                        <span style={{
                          marginLeft: '6px',
                          fontSize: '0.75rem',
                          color: product.cost > product.historicalCost ? 'var(--danger)' : 'var(--secondary)'
                        }}>
                          ({product.cost > product.historicalCost ? '↑' : '↓'} {Math.abs(((product.cost - product.historicalCost) / product.historicalCost) * 100).toFixed(0)}%)
                        </span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {product.historicalCost > 0 ? fmt(product.historicalCost) : '-'}
                    </td>
                    <td>{fmt(product.price)}</td>
                    <td>
                      <span className={`badge ${parseFloat(product.currentMargin) > 30 ? 'badge-success' : parseFloat(product.currentMargin) > 15 ? 'badge-warning' : 'badge-danger'}`}>
                        {product.currentMargin}%
                      </span>
                    </td>
                    <td>
                      <span className="badge" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-main)' }}>
                        {product.margin}%
                      </span>
                    </td>
                    <td>{product.totalSold}</td>
                    <td style={{ color: product.profit >= 0 ? 'var(--secondary)' : 'var(--danger)', fontWeight: 600 }}>
                      {fmt(product.profit)}
                    </td>
                    <td>
                      <button
                        className="btn btn-outline"
                        onClick={() => handleViewProduct(product.id)}
                        style={{ padding: '4px 8px' }}
                      >
                        📈 Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Análisis */}
      {filters.view === 'analysis' && (
        <div style={{ marginTop: '32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div className="data-table-container">
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <h3>🏆 Productos más Rentables</h3>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Ganancia</th>
                  <th>Margen</th>
                </tr>
              </thead>
              <tbody>
                {data?.topProfitableProducts?.map((product, index) => (
                  <tr key={product.id}>
                    <td>
                      <span style={{ marginRight: '8px', color: 'var(--text-muted)' }}>#{index + 1}</span>
                      {product.name}
                    </td>
                    <td style={{ color: 'var(--secondary)', fontWeight: 600 }}>
                      {fmt(product.profit)}
                    </td>
                    <td>
                      <span className="badge badge-success">{product.margin}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="data-table-container">
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <h3>⚠️ Productos con Bajo Margen (&lt;20%)</h3>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Costo</th>
                  <th>Precio</th>
                  <th>Margen</th>
                </tr>
              </thead>
              <tbody>
                {data?.lowMarginProducts?.map((product) => (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td>{fmt(product.cost)}</td>
                    <td>{fmt(product.price)}</td>
                    <td>
                      <span className="badge badge-danger">{product.currentMargin}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
            <h3 style={{ marginBottom: '16px' }}>📊 Margen de Ganancia por Producto</h3>
            <div style={{ height: '300px' }}>
              <Bar
                data={marginChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    y: {
                      beginAtZero: true,
                      title: { display: true, text: 'Margen (%)' },
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Estado de Resultados (P&L) */}
      {filters.view === 'profit-loss' && pnlData && (
        <div style={{ marginTop: '32px' }}>
          <h2 style={{ marginBottom: '16px' }}>📋 Estado de Resultados</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div className="kpi-card">
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px 16px', borderBottom: '2px solid var(--border-color)' }}>
                      Concepto
                    </th>
                    <th style={{ textAlign: 'right', padding: '8px 16px', borderBottom: '2px solid var(--border-color)' }}>
                      Valor
                    </th>
                    {variance && (
                      <th style={{ textAlign: 'right', padding: '8px 16px', borderBottom: '2px solid var(--border-color)' }}>
                        vs Anterior
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
<PnLRow label="Ingresos por Ventas" value={fmt(pnlData.current.revenue.total)} color="var(--secondary)" />
<PnLRow label={`Subtotal (${pnlData.current.revenue.salesCount} ventas)`} value={fmt(pnlData.current.revenue.subtotal)} indent />
<PnLRow label="ITBIS" value={fmt(pnlData.current.revenue.tax)} indent />
<PnLRow label="Descuentos" value={`(${fmt(pnlData.current.revenue.discount)})`} indent color="var(--danger)" />
<PnLRow label="Costo de Ventas" value={`(${fmt(pnlData.current.costOfGoodsSold)}) (${pnlData.current.revenue.total > 0 ? ((pnlData.current.costOfGoodsSold / pnlData.current.revenue.total) * 100).toFixed(1) + '%' : '0.0%'})`} isNegative indent color="var(--danger)" />
                  <tr><td colSpan={variance ? 3 : 2} style={{ padding: '0 16px' }}><hr style={{ borderColor: 'var(--border-color)', margin: '4px 0' }} /></td></tr>
                  <PnLRow label="Utilidad Bruta" value={fmt(pnlData.current.grossProfit)} isTotal color={pnlData.current.grossProfit >= 0 ? 'var(--secondary)' : 'var(--danger)'} />
                  <PnLRow label={`Margen Bruto`} value={`${pnlData.current.grossMargin.toFixed(2)}%`} isTotal />
                  <PnLRow label={`Relación Costo/Ingreso (COGS Ratio)`} value={`${pnlData.current.cogsRatio.toFixed(1)}%`} indent />
                  <tr><td colSpan={variance ? 3 : 2} style={{ padding: '0 16px' }}><hr style={{ borderColor: 'var(--border-color)', margin: '4px 0' }} /></td></tr>
                  <PnLRow label="Gastos Operativos" value={`(${fmt(pnlData.current.totalExpenses)})`} isNegative indent color="var(--accent)" />
                  <PnLRow label={`Relación Gasto/Ingreso`} value={`${pnlData.current.expenseRatio.toFixed(1)}%`} indent />
                  <tr><td colSpan={variance ? 3 : 2} style={{ padding: '0 16px' }}><hr style={{ borderColor: 'var(--border-color)', margin: '4px 0' }} /></td></tr>
                  <PnLRow label="Utilidad (Pérdida) Neta" value={fmt(pnlData.current.netProfit)} isTotal color={pnlData.current.netProfit >= 0 ? 'var(--primary)' : 'var(--danger)'} />
                  <PnLRow label="Margen Neto" value={`${pnlData.current.netMargin.toFixed(2)}%`} isTotal color="var(--primary)" />

                  {variance && (
                    <>
                      <tr><td colSpan={3} style={{ padding: '8px 16px' }}><hr style={{ borderColor: 'var(--border-color)', margin: '4px 0' }} /></td></tr>
                      <tr>
                        <td colSpan={3} style={{ padding: '8px 16px', fontWeight: 700 }}>
                          Variación vs Período Anterior
                        </td>
                      </tr>
                      {[
                        { label: 'Ingresos', value: variance.revenueChange },
                        { label: 'Costo de Ventas', value: variance.cogsChange },
                        { label: 'Utilidad Bruta', value: variance.grossProfitChange },
                        { label: 'Gastos', value: variance.expensesChange },
                        { label: 'Utilidad Neta', value: variance.netProfitChange },
                      ].map(item => (
                        <tr key={item.label}>
                          <td style={{ padding: '4px 16px', paddingLeft: '32px' }}>{item.label}</td>
                          <td style={{ padding: '4px 16px', textAlign: 'right' }}></td>
                          <td style={{
                            padding: '4px 16px',
                            textAlign: 'right',
                            fontWeight: 600,
                            color: item.value > 0 ? 'var(--secondary)' : item.value < 0 ? 'var(--danger)' : 'var(--text-muted)'
                          }}>
                            {item.value > 0 ? '↑' : item.value < 0 ? '↓' : '→'} {Math.abs(item.value).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>

            <div>
              <div className="kpi-card">
                <h3 style={{ marginBottom: '12px' }}>📊 Indicadores Clave</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {[
                    { label: 'Margen Bruto', value: `${pnlData.current.grossMargin.toFixed(1)}%`, color: pnlData.current.grossMargin > 30 ? 'var(--secondary)' : pnlData.current.grossMargin > 15 ? 'var(--accent)' : 'var(--danger)' },
                    { label: 'Margen Neto', value: `${pnlData.current.netMargin.toFixed(1)}%`, color: pnlData.current.netMargin > 15 ? 'var(--secondary)' : pnlData.current.netMargin > 5 ? 'var(--accent)' : 'var(--danger)' },
                    { label: 'Costo por Venta', value: `${pnlData.current.cogsRatio.toFixed(1)}%`, color: pnlData.current.cogsRatio < 50 ? 'var(--secondary)' : pnlData.current.cogsRatio < 70 ? 'var(--accent)' : 'var(--danger)' },
                    { label: 'Gastos sobre Ingresos', value: `${pnlData.current.expenseRatio.toFixed(1)}%`, color: pnlData.current.expenseRatio < 20 ? 'var(--secondary)' : pnlData.current.expenseRatio < 35 ? 'var(--accent)' : 'var(--danger)' },
                    { label: 'Ventas en el Período', value: pnlData.current.revenue.salesCount.toString() },
                  ].map(ind => (
                    <div key={ind.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-main)', borderRadius: '8px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{ind.label}</span>
                      <strong style={{ color: ind.color || 'inherit' }}>{ind.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Costos por Categoría */}
      {filters.view === 'by-category' && categoryData && (
        <div style={{ marginTop: '32px' }}>
          <h2 style={{ marginBottom: '16px' }}>📦 Costos por Categoría</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Categoría</th>
                    <th>Costo Total</th>
                    <th>Ingresos</th>
                    <th>Ganancia</th>
                    <th>Margen</th>
                    <th>% del Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryData.categories.map(cat => (
                    <tr key={cat.category}>
                      <td><strong>{cat.category}</strong></td>
                      <td style={{ color: 'var(--danger)' }}>{fmt(cat.totalCost)}</td>
                      <td style={{ color: 'var(--secondary)' }}>{fmt(cat.totalRevenue)}</td>
                      <td style={{ color: cat.profit >= 0 ? 'var(--secondary)' : 'var(--danger)', fontWeight: 600 }}>
                        {fmt(cat.profit)}
                      </td>
                      <td>
                        <span className={`badge ${parseFloat(cat.margin) > 30 ? 'badge-success' : parseFloat(cat.margin) > 15 ? 'badge-warning' : 'badge-danger'}`}>
                          {cat.margin}%
                        </span>
                      </td>
                      <td>{cat.costPercentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>Totales</span>
                  <span style={{ color: 'var(--danger)' }}>{fmt(categoryData.totals.totalCost)}</span>
                  <span style={{ color: 'var(--secondary)' }}>{fmt(categoryData.totals.totalRevenue)}</span>
                  <span style={{ color: categoryData.totals.totalProfit >= 0 ? 'var(--secondary)' : 'var(--danger)' }}>
                    {fmt(categoryData.totals.totalProfit)}
                  </span>
                  <span className="badge badge-success">{categoryData.totals.totalMargin}%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            {categoryChartData && (
              <div className="kpi-card">
                <h3 style={{ marginBottom: '16px' }}>📊 Costo vs Ingreso por Categoría</h3>
                <div style={{ height: '300px' }}>
                  <Bar
                    data={categoryChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { position: 'top' } },
                      scales: {
                        x: { stacked: false },
                        y: {
                          beginAtZero: true,
                          title: { display: true, text: 'Monto ($)' },
                        },
                      },
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tendencia */}
      {filters.view === 'trend' && trendData && (
        <div style={{ marginTop: '32px' }}>
          <h2 style={{ marginBottom: '16px' }}>📈 Tendencia de Costos (12 meses)</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            {[
              { label: 'Ingresos Totales', value: fmt(trendData.totals.revenue), color: 'var(--secondary)' },
              { label: 'Costo de Ventas', value: fmt(trendData.totals.costOfGoodsSold), color: 'var(--danger)' },
              { label: 'Ganancia Neta', value: fmt(trendData.totals.netProfit), color: trendData.totals.netProfit >= 0 ? 'var(--primary)' : 'var(--danger)' },
              { label: 'Margen Neto Prom.', value: `${trendData.totals.netMargin}%`, color: 'var(--primary)' },
            ].map(item => (
              <div key={item.label} className="kpi-card" style={{ padding: '16px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '0.85rem' }}>{item.label}</p>
                <strong style={{ fontSize: '1.25rem', color: item.color }}>{item.value}</strong>
              </div>
            ))}
          </div>

          {trendChartData && (
            <div className="kpi-card" style={{ marginBottom: '24px' }}>
              <h3 style={{ marginBottom: '16px' }}>📈 Evolución Mensual</h3>
              <div style={{ height: '350px' }}>
                <Line
                  data={trendChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: { legend: { position: 'top' } },
                    scales: {
                      y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Monto ($)' },
                      },
                    },
                  }}
                />
              </div>
            </div>
          )}

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Ingresos</th>
                  <th>Costo Ventas</th>
                  <th>Utilidad Bruta</th>
                  <th>Margen Bruto</th>
                  <th>Gastos</th>
                  <th>Utilidad Neta</th>
                  <th>Margen Neto</th>
                </tr>
              </thead>
              <tbody>
                {trendData.trend.map(m => (
                  <tr key={m.month}>
                    <td><strong>{m.month}</strong></td>
                    <td style={{ color: 'var(--secondary)' }}>{fmt(m.revenue)}</td>
                    <td style={{ color: 'var(--danger)' }}>{fmt(m.costOfGoodsSold)}</td>
                    <td style={{ color: m.grossProfit >= 0 ? 'var(--secondary)' : 'var(--danger)' }}>{fmt(m.grossProfit)}</td>
                    <td>{m.grossMargin}%</td>
                    <td style={{ color: 'var(--accent)' }}>{fmt(m.expenses)}</td>
                    <td style={{ color: m.netProfit >= 0 ? 'var(--primary)' : 'var(--danger)', fontWeight: 600 }}>{fmt(m.netProfit)}</td>
                    <td>
                      <span className={`badge ${parseFloat(m.netMargin) > 15 ? 'badge-success' : parseFloat(m.netMargin) > 5 ? 'badge-warning' : 'badge-danger'}`}>
                        {m.netMargin}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de detalle de producto */}
      {selectedProduct && (
        <div className="modal-overlay" onClick={() => setSelectedProduct(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <h2>📈 Análisis: {selectedProduct.product.name}</h2>
            
            <div style={{ marginTop: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ padding: '12px', background: 'var(--bg-main)', borderRadius: '8px', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '0.85rem' }}>Vendidos</p>
                  <strong style={{ fontSize: '1.5rem' }}>{selectedProduct.summary.totalQuantity}</strong>
                </div>
                <div style={{ padding: '12px', background: 'var(--bg-main)', borderRadius: '8px', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '0.85rem' }}>Ingresos</p>
                  <strong style={{ fontSize: '1.25rem', color: 'var(--primary)' }}>{fmt(selectedProduct.summary.totalRevenue)}</strong>
                </div>
                <div style={{ padding: '12px', background: 'var(--bg-main)', borderRadius: '8px', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '0.85rem' }}>Costos</p>
                  <strong style={{ fontSize: '1.25rem', color: 'var(--danger)' }}>{fmt(selectedProduct.summary.totalCost)}</strong>
                </div>
                <div style={{ padding: '12px', background: 'var(--bg-main)', borderRadius: '8px', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '0.85rem' }}>Ganancia</p>
                  <strong style={{ fontSize: '1.25rem', color: 'var(--secondary)' }}>{fmt(selectedProduct.summary.totalProfit)}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Costo actual: </span>
                  <strong>{fmt(selectedProduct.product.cost)}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Costo histórico: </span>
                  <strong>{selectedProduct.product.historicalCost > 0 ? fmt(selectedProduct.product.historicalCost) : '-'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Precio de venta: </span>
                  <strong>{fmt(selectedProduct.product.price)}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Stock actual: </span>
                  <strong>{selectedProduct.product.currentStock}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Margen: </span>
                  <strong className="badge badge-success">{selectedProduct.summary.margin}%</strong>
                </div>
              </div>

              <h4 style={{ marginBottom: '12px' }}>Ventas Recientes</h4>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Factura</th>
                      <th>Cantidad</th>
                      <th>Costo Uni.</th>
                      <th>Ganancia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProduct.recentSales?.map((sale, index) => (
                      <tr key={index}>
                        <td>{new Date(sale.date).toLocaleDateString()}</td>
                        <td>{sale.invoiceNumber}</td>
                        <td>{sale.quantity}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{fmt(sale.unitCost)}</td>
                        <td style={{ color: sale.profit >= 0 ? 'var(--secondary)' : 'var(--danger)' }}>
                          {fmt(sale.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setSelectedProduct(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Costs;
