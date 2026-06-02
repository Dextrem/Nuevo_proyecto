import { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, hasPermission } = useAuth();
  const { settings } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  // Cerrar sidebar al cambiar de ruta (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Bloquear scroll del body cuando el sidebar mobile está abierto
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  // Cerrar sidebar con tecla Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen]);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const openSidebar  = useCallback(() => setSidebarOpen(true),  []);

  const menuItems = [
    { path: '/',                    icon: 'fa-home',             label: 'Dashboard',         permission: null },
    { path: '/pos',                 icon: 'fa-cash-register',    label: 'Punto de Venta',    permission: 'process_sales' },
    { path: '/billing',             icon: 'fa-file-invoice',     label: 'Facturación',       permission: 'manage_billing' },
    { path: '/quotations',          icon: 'fa-file-signature',   label: 'Cotizaciones',      permission: 'manage_quotations' },
    { path: '/inventory',           icon: 'fa-box',              label: 'Inventario',         permission: 'manage_products' },
    { path: '/clients',             icon: 'fa-users',            label: 'Clientes',           permission: 'manage_clients' },
    { path: '/accounts-receivable', icon: 'fa-hand-holding-usd', label: 'Cuentas x Cobrar', permission: 'manage_accounts_receivable' },
    { path: '/suppliers',           icon: 'fa-truck',            label: 'Proveedores',        permission: 'manage_suppliers' },
  { path: '/accounts-payable',    icon: 'fa-money-bill-wave',  label: 'Cuentas x Pagar',  permission: 'manage_accounts_payable' },
  { path: '/warranties',          icon: 'fa-certificate',      label: 'Garantías',          permission: null },
  { path: '/cash-register',       icon: 'fa-lock',             label: 'Caja General',       permission: 'manage_cash_registers' },
    { path: '/accounting',          icon: 'fa-calculator',       label: 'Contabilidad',       permission: 'manage_accounting' },
    { path: '/monthly-closing',     icon: 'fa-calendar-alt',     label: 'Cierre Mensual',    permission: 'manage_monthly_closing' },
    { path: '/costs',               icon: 'fa-chart-pie',        label: 'Costos',             permission: 'view_costs' },
    { path: '/budget',              icon: 'fa-piggy-bank',       label: 'Presupuesto',        permission: 'manage_budget' },
    { path: '/history',             icon: 'fa-history',          label: 'Historial',          permission: 'view_history' },
    { path: '/reports',             icon: 'fa-chart-bar',        label: 'Reportes',           permission: 'view_reports' },
    { path: '/fiscal',              icon: 'fa-file-invoice',     label: 'Reportes Fiscales',  permission: 'manage_settings' },
    { path: '/users',               icon: 'fa-user-cog',         label: 'Usuarios',           permission: 'manage_users' },
    { path: '/settings',            icon: 'fa-cog',              label: 'Configuración',      permission: 'manage_settings' },
    { path: '/commissions',         icon: 'fa-percentage',       label: 'Comisiones',         permission: 'manage_commissions' },
  ];

  const filteredMenuItems = menuItems.filter(
    (item) => !item.permission || hasPermission(item.permission)
  );

  const getInitials = (name) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isPOS = location.pathname === '/pos' || location.pathname === '/pos-qr';

  return (
    <div className={`app-container ${isPOS ? 'pos-mode' : ''}`}>
      {/* Overlay: cierra el sidebar al tocar fuera */}
      <div
        className={`mobile-overlay ${sidebarOpen ? 'show' : ''}`}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      <aside
        className={`sidebar ${sidebarOpen ? 'show' : ''}`}
        aria-label="Menú de navegación"
      >
        <div className={`sidebar-header ${(isPOS && !sidebarOpen) ? 'sidebar-hidden-content' : ''}`}>
          {settings.logo ? (
            <img
              src={settings.logo}
              alt="Logo"
              style={{
                height: '35px',
                width: 'auto',
                marginRight: '12px',
                borderRadius: '4px',
                objectFit: 'contain',
              }}
            />
          ) : (
            <i className="fas fa-chart-line logo-icon" style={{ fontSize: '1.5rem', marginRight: '12px' }}></i>
          )}
          <h2>{settings.companyName}</h2>
        </div>

        <nav className="sidebar-nav">
          {filteredMenuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
            >
              <i className={`fas ${item.icon}`}></i>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className={`user-profile ${(isPOS && !sidebarOpen) ? 'sidebar-hidden-content' : ''}`}>
          <div className="avatar">{getInitials(user?.name || 'U')}</div>
          <div className="user-info">
            <div className="user-name">{user?.name}</div>
            <div className="user-role">{user?.role}</div>
          </div>
          <button
            className="action-btn"
            onClick={handleLogout}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <i className="fas fa-sign-out-alt"></i>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-header">
          <button
            className="menu-toggle-btn"
            onClick={openSidebar}
            aria-label="Abrir menú"
            aria-expanded={sidebarOpen}
          >
            <i className="fas fa-bars"></i>
          </button>
        </header>

        <div className="content-body">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
