import { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { reportService } from '../services/api';
import { formatCurrency, formatDate } from '../utils/helpers';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const StatCard = memo(({ icon, label, value, subtitle, type, badge, badgeType }) => (
  <div className={`stat-card ${type}`}>
    <div className="stat-icon">
      <i className={`fas fa-${icon}`}></i>
    </div>
    <div className="stat-content">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {subtitle && <div className="stat-subtitle">{subtitle}</div>}
      {badge && (
        <div style={{ marginTop: '8px' }}>
          <span className={`stat-badge ${badgeType}`}>
            <i className={`fas fa-${badgeType === 'danger' ? 'exclamation-triangle' : 'info-circle'}`}></i>
            {badge}
          </span>
        </div>
      )}
    </div>
  </div>
));

StatCard.displayName = 'StatCard';

const SalesChart = memo(({ stats }) => {
  const chartData = useMemo(() => ({
    labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Ventas',
        data: [12000, 19000, 15000, 25000, 22000, stats?.month?.amount || 30000],
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderColor: '#10B981',
        borderWidth: 2,
        borderRadius: 8,
        fill: true,
        tension: 0.4,
      },
    ],
  }), [stats?.month?.amount]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#1E293B',
        titleColor: '#F8FAFC',
        bodyColor: '#F8FAFC',
        padding: 12,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: (context) => formatCurrency(context.raw),
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#94A3B8',
        },
      },
      y: {
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
        },
        ticks: {
          color: '#94A3B8',
          callback: (value) => formatCurrency(value, { notation: 'compact' }),
        },
      },
    },
  };

  return <Bar data={chartData} options={options} />;
});

SalesChart.displayName = 'SalesChart';

const BalanceChart = memo(({ stats }) => {
  const income = stats?.month?.income || 0;
  const expense = stats?.month?.expense || 0;
  const balance = income - expense;

  const chartData = useMemo(() => ({
    labels: ['Ingresos', 'Egresos', 'Balance'],
    datasets: [
      {
        data: [income, expense, Math.abs(balance)],
        backgroundColor: ['#10B981', '#EF4444', balance >= 0 ? '#8B5CF6' : '#F59E0B'],
        borderWidth: 0,
        cutout: '70%',
      },
    ],
  }), [income, expense, balance]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#94A3B8',
          padding: 20,
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      tooltip: {
        backgroundColor: '#1E293B',
        titleColor: '#F8FAFC',
        bodyColor: '#F8FAFC',
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (context) => formatCurrency(context.raw),
        },
      },
    },
  };

  return <Doughnut data={chartData} options={options} />;
});

BalanceChart.displayName = 'BalanceChart';

const AlertsSection = memo(({ stats, formatCurrency }) => {
  const lowStock = stats?.inventory?.lowStock || [];
  const topDebts = stats?.accountsReceivable?.topClients || [];
  const hasAlerts = lowStock.length > 0 || topDebts.length > 0;

  return (
    <div className="alerts-card">
      <div className="alerts-header">
        <h3>
          <i className="fas fa-bell" style={{ color: 'var(--primary)' }}></i>
          Alertas
        </h3>
        {hasAlerts && (
          <span className="badge badge-danger">
            {lowStock.length + topDebts.length}
          </span>
        )}
      </div>

      {hasAlerts ? (
        <div className="alerts-list">
          {lowStock.slice(0, 5).map((product) => (
            <div key={`stock-${product.id}`} className="alert-item stock">
              <div className="alert-icon">
                <i className="fas fa-box"></i>
              </div>
              <div className="alert-content">
                <div className="alert-title">{product.name}</div>
                <div className="alert-subtitle">Stock bajo - Mín: {product.minStock}</div>
              </div>
              <div className="alert-value warning">{product.stock} uds</div>
            </div>
          ))}
          {topDebts.slice(0, 5).map((client) => (
            <div key={`debt-${client.id}`} className="alert-item debt">
              <div className="alert-icon">
                <i className="fas fa-user"></i>
              </div>
              <div className="alert-content">
                <div className="alert-title">{client.name}</div>
                <div className="alert-subtitle">Cuenta por cobrar</div>
              </div>
              <div className="alert-value danger">{formatCurrency(client.balance)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="no-alerts">
          <div className="no-alerts-icon">
            <i className="fas fa-check"></i>
          </div>
          <h4>Todo en orden</h4>
          <p>No hay alertas pendientes</p>
        </div>
      )}
    </div>
  );
});

AlertsSection.displayName = 'AlertsSection';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDashboard = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const response = await reportService.getDashboard();
      const data = response.data?.data || response.data;
      setStats(data || null);
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError(err.response?.data?.error || 'Error al cargar el dashboard');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="loading-fallback">
        <div className="spinner"></div>
        <p>Cargando dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="view-header">
          <div>
            <h1>Dashboard</h1>
            <p>Resumen de tu negocio</p>
          </div>
        </div>
        <div className="error-alert">
          <span className="error-alert-icon">⚠️</span>
          <div>
            <strong>Error</strong>
            <p>{error}</p>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <button onClick={loadDashboard} className="btn btn-primary">
            <i className="fas fa-sync-alt"></i> Reintentar
          </button>
        </div>
      </div>
    );
  }

  const monthIncome = stats?.month?.income || 0;
  const monthExpense = stats?.month?.expense || 0;
  const generalBalance = monthIncome - monthExpense;
  const totalAlerts = (stats?.inventory?.lowStock?.length || 0) + (stats?.accountsReceivable?.topClients?.length || 0);

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p className="dashboard-date">{formatDate(new Date(), 'long')}</p>
        </div>
        <button onClick={loadDashboard} className="btn btn-outline">
          <i className="fas fa-sync-alt"></i> Actualizar
        </button>
      </div>

      <div className="stats-row">
        <StatCard
          icon="shopping-cart"
          label="Ventas del Mes"
          value={formatCurrency(stats?.month?.amount || 0)}
          subtitle={`${stats?.month?.sales || 0} transacciones`}
          type="sales"
        />
        <StatCard
          icon="boxes"
          label="Total Productos"
          value={stats?.inventory?.total || 0}
          subtitle="En inventario"
          type="stock"
        />
        <StatCard
          icon="exclamation-triangle"
          label="Alertas"
          value={totalAlerts}
          badge={totalAlerts > 0 ? `${totalAlerts} pendientes` : 'Sin alertas'}
          badgeType={totalAlerts > 0 ? 'warning' : 'success'}
          type="alerts"
        />
        <StatCard
          icon="wallet"
          label="Balance General"
          value={formatCurrency(generalBalance)}
          subtitle={`Ingresos: ${formatCurrency(monthIncome)} | Egresos: ${formatCurrency(monthExpense)}`}
          type="balance"
        />
      </div>

      <div className="dashboard-chart-section">
        <div className="chart-card">
          <div className="chart-header">
            <h3>
              <i className="fas fa-chart-bar" style={{ marginRight: '10px', color: 'var(--primary)' }}></i>
              Ventas del Año
            </h3>
          </div>
          <div className="chart-container">
            <SalesChart stats={stats} />
          </div>
        </div>

        <AlertsSection stats={stats} formatCurrency={formatCurrency} />
      </div>

      <div className="chart-card">
        <div className="chart-header">
          <h3>
            <i className="fas fa-chart-pie" style={{ marginRight: '10px', color: 'var(--primary)' }}></i>
            Balance Mensual
          </h3>
        </div>
        <div className="chart-container" style={{ height: '250px' }}>
          <BalanceChart stats={stats} />
        </div>
      </div>

      <div className="quick-actions">
        <Link to="/pos" className="quick-action-btn primary">
          <i className="fas fa-cash-register"></i>
          Nueva Venta
        </Link>
        <Link to="/cash-register" className="quick-action-btn secondary">
          <i className="fas fa-wallet"></i>
          Gestión de Caja
        </Link>
        <Link to="/inventory" className="quick-action-btn secondary">
          <i className="fas fa-boxes"></i>
          Inventario
        </Link>
        <Link to="/clients" className="quick-action-btn secondary">
          <i className="fas fa-users"></i>
          Clientes
        </Link>
        <Link to="/reports" className="quick-action-btn secondary">
          <i className="fas fa-chart-line"></i>
          Reportes
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;
