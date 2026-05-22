import { useState, useEffect, useCallback } from 'react';
import transactionHistoryService from '../services/transactionHistoryService';
import { transactionService, categoryService, clientService, supplierService } from '../services/api';
import { useApp } from '../context/AppContext';
import { formatDate } from '../utils/helpers';

const INCOME_TYPES = new Set(['INCOME', 'VENTA', 'VENTA_CREDITO', 'SALE', 'PAGO_CXC', 'PAGO_CXC_APROBADO', 'INGRESO']);
const EXPENSE_TYPES = new Set(['EXPENSE', 'GASTO', 'COMPRA', 'PAGO_CXP', 'CXP', 'CXP_NUEVA', 'SALE_CANCEL', 'PAGO_CXC_RECHAZADO', 'PAGO_PROVEEDOR']);

const isIncome = (type) => INCOME_TYPES.has(type?.toUpperCase());
const isExpense = (type) => EXPENSE_TYPES.has(type?.toUpperCase());
const isFinancial = (type) => isIncome(type) || isExpense(type);

const UserHistory = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    type: '',
    category: '',
    search: '',
  });
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const { formatCurrency } = useApp();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.type) params.type = filters.type;
      if (filters.category) params.category = filters.category;
      if (filters.search) params.search = filters.search;
      
      let data = [];
      
      try {
        const response = await transactionHistoryService.getAll(params);
        data = response.data?.data || response.data || [];
      } catch (apiError) {
        console.warn('API no disponible, usando localStorage');
        const localResponse = await transactionHistoryService.getAll(params);
        data = localResponse.data || [];
      }
      
      setTransactions(data);
      
      const totalIncome = data.filter(t => isIncome(t.type)).reduce((sum, t) => sum + t.amount, 0);
      const totalExpense = data.filter(t => isExpense(t.type)).reduce((sum, t) => sum + t.amount, 0);
      setStats({ totalIncome, totalExpense, count: data.length });
    } catch (error) {
      console.error('Error loading history:', error);
      setTransactions([]);
      setStats({ totalIncome: 0, totalExpense: 0, count: 0 });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const [cats, clients, suppliers] = await Promise.all([
          categoryService.getAll(),
          clientService.getAll(),
          supplierService.getAll(),
        ]);
        setCategories([
          ...(Array.isArray(cats.data) ? cats.data : cats.data?.data || []).map(c => ({ id: `cat_${c.id}`, name: c.name, type: 'category' })),
          ...(Array.isArray(clients.data) ? clients.data : clients.data?.data || []).map(c => ({ id: `client_${c.id}`, name: c.name, type: 'client' })),
          ...(Array.isArray(suppliers.data) ? suppliers.data : suppliers.data?.data || []).map(s => ({ id: `supplier_${s.id}`, name: s.name, type: 'supplier' })),
        ]);
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    };
    loadCategories();
  }, []);

  const handleExportCSV = useCallback(() => {
    const headers = ['Fecha', 'Tipo', 'Descripción', 'Monto', 'Categoría', 'Referencia', 'Usuario'];
    const rows = transactions.map(t => [
      t.date,
      t.type === 'income' ? 'Ingreso' : 'Gasto',
      t.description || '',
      t.amount,
      t.categoryName || '',
      t.reference || '',
      t.user?.name || t.userName || '',
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historial_${filters.startDate || 'todo'}_${filters.endDate || 'todo'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [transactions, filters]);

  const handleExportJSON = useCallback(() => {
    const exportData = transactions.map(t => ({
      fecha: t.date,
      tipo: t.type,
      descripcion: t.description,
      monto: t.amount,
      categoria: t.categoryName,
      referencia: t.reference,
      usuario: t.user?.name || t.userName,
      detalles: t.details,
    }));
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historial_${filters.startDate || 'todo'}_${filters.endDate || 'todo'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [transactions, filters]);

  const getTypeBadge = (type) => {
    const normalizedType = type?.toUpperCase();
    
    if (normalizedType === 'VENTA_CREDITO') {
      return { class: 'badge-warning', label: 'Crédito' };
    }
    
    // Ingresos y Gastos Financieros
    if (isIncome(normalizedType)) {
      return { class: 'badge-success', label: 'Ingreso' };
    }
    if (isExpense(normalizedType)) {
      return { class: 'badge-danger', label: 'Gasto' };
    }
    
    // Usuarios y Sistema
    if (normalizedType.includes('USUARIO')) {
      return { class: 'badge-primary', label: 'Usuario' };
    }
    
    // Clientes y Proveedores
    if (normalizedType.includes('CLIENTE')) {
      return { class: 'badge-info', label: 'Cliente' };
    }
    if (normalizedType.includes('PROVEEDOR')) {
      return { class: 'badge-info', label: 'Proveedor' };
    }
    
    // Inventario
    if (normalizedType.includes('PRODUCTO') || normalizedType.includes('CATEGORIA') || normalizedType === 'AJUSTE_STOCK') {
      return { class: 'badge-warning', label: 'Inventario' };
    }
    
    // Caja
    if (normalizedType.includes('CAJA')) {
      return { class: 'badge-dark', label: 'Caja' };
    }

    return { class: 'badge-dark', label: type };
  };

  const clearFilters = () => {
    setFilters({ startDate: '', endDate: '', type: '', category: '', search: '' });
  };

  const currentYear = new Date().getFullYear();
  const months = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' }, { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' }, { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' },
  ];

  return (
    <div>
      <div className="view-header">
        <div>
          <h1>Historial</h1>
          <p>Registro de todas las transacciones</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-outline" onClick={handleExportCSV} title="Exportar a CSV">
            <i className="fas fa-file-csv"></i> CSV
          </button>
          <button className="btn btn-outline" onClick={handleExportJSON} title="Exportar a JSON">
            <i className="fas fa-file-code"></i> JSON
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--secondary)' }}>
          <div className="kpi-info">
            <h3>Total Ingresos</h3>
            <h2>{formatCurrency(stats?.totalIncome || 0)}</h2>
          </div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="kpi-info">
            <h3>Total Gastos</h3>
            <h2>{formatCurrency(stats?.totalExpense || 0)}</h2>
          </div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="kpi-info">
            <h3>Balance</h3>
            <h2>{formatCurrency((stats?.totalIncome || 0) - (stats?.totalExpense || 0))}</h2>
          </div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--accent)' }}>
          <div className="kpi-info">
            <h3>Transacciones</h3>
            <h2>{stats?.count || 0}</h2>
          </div>
        </div>
      </div>

      <div className="data-table-container">
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Buscar..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            style={{ maxWidth: '200px' }}
          />
          <input
            type="date"
            className="form-control"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            style={{ maxWidth: '150px' }}
          />
          <input
            type="date"
            className="form-control"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            style={{ maxWidth: '150px' }}
          />
          <select
            className="form-control"
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            style={{ maxWidth: '150px' }}
          >
            <option value="">Todos los tipos</option>
            <optgroup label="Financiero">
              <option value="INCOME">Ingresos (Directos)</option>
              <option value="EXPENSE">Gastos (Directos)</option>
              <option value="VENTA">Ventas</option>
              <option value="COMPRA">Compras</option>
              <option value="PAGO_CXC">Cobros (CxC)</option>
              <option value="PAGO_CXP">Pagos (CxP)</option>
            </optgroup>
            <optgroup label="Administración">
              <option value="CREAR_USUARIO">Creación de Usuario</option>
              <option value="ACTUALIZAR_USUARIO">Actualización de Usuario</option>
              <option value="ELIMINAR_USUARIO">Eliminación de Usuario</option>
            </optgroup>
            <optgroup label="CRM">
              <option value="CREAR_CLIENTE">Nuevo Cliente</option>
              <option value="CREAR_PROVEEDOR">Nuevo Proveedor</option>
            </optgroup>
            <optgroup label="Inventario">
              <option value="CREAR_PRODUCTO">Nuevo Producto</option>
              <option value="AJUSTE_STOCK">Ajuste de Stock</option>
              <option value="CREAR_CATEGORIA">Nueva Categoría</option>
            </optgroup>
            <optgroup label="Caja">
              <option value="APERTURA_CAJA">Apertura de Caja</option>
              <option value="CIERRE_CAJA">Cierre de Caja</option>
            </optgroup>
          </select>
          <select
            className="form-control"
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            style={{ maxWidth: '150px' }}
          >
            <option value="">Todas las categorías</option>
            <option value="Ventas">Ventas</option>
            <option value="Compras">Compras</option>
            <option value="Clientes">Clientes</option>
            <option value="Proveedores">Proveedores</option>
            <option value="Usuarios">Usuarios</option>
            <option value="Productos">Productos</option>
            <option value="Categorías">Categorías</option>
            <option value="Caja">Caja</option>
            <option value="Cobros">Cobros (CxC)</option>
          </select>
          <button className="btn btn-outline" onClick={clearFilters}>
            <i className="fas fa-times"></i> Limpiar
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div className="spinner"></div>
            <p>Cargando historial...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3>Sin transacciones</h3>
            <p>No se encontraron transacciones con los filtros aplicados</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Descripción</th>
                <th>Categoría</th>
                <th style={{ textAlign: 'right' }}>Monto</th>
                 <th>Referencia</th>
                <th>Usuario</th>
                <th style={{ textAlign: 'center' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction, index) => {
                const badge = getTypeBadge(transaction.type);
                return (
                  <tr key={transaction.id || index}>
                    <td>{formatDate(transaction.date, 'time')}</td>
                    <td>
                      <span className={`badge ${badge.class}`}>{badge.label}</span>
                    </td>
                    <td>
                      <div>
                        <strong>{transaction.description || 'Sin descripción'}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Tipo técnico: {transaction.type}
                        </div>
                        {transaction.clientName && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Cliente: {transaction.clientName}
                          </div>
                        )}
                        {transaction.supplierName && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Proveedor: {transaction.supplierName}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>{transaction.categoryName || '-'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: transaction.type?.toUpperCase() === 'VENTA_CREDITO' ? '#f59e0b' : isIncome(transaction.type) ? 'var(--secondary)' : isExpense(transaction.type) ? 'var(--danger)' : 'var(--text-muted)' }}>
                      {isFinancial(transaction.type) ? (
                        <>
                          {isIncome(transaction.type) ? '+' : '-'}
                          {formatCurrency(transaction.amount)}
                        </>
                      ) : (
                        <span style={{ opacity: 0.5 }}>{transaction.amount > 0 ? formatCurrency(transaction.amount) : '-'}</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {transaction.reference || '-'}
                    </td>
                    <td>{transaction.user?.name || transaction.user?.username || transaction.userName || '-'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        className="btn btn-outline" 
                        style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                        onClick={() => {
                          setSelectedTransaction(transaction);
                          setShowDetails(true);
                        }}
                      >
                        <i className="fas fa-eye"></i> Detalles
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showDetails && selectedTransaction && (
        <div className="modal-overlay" onClick={() => setShowDetails(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifySpaceBetween: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>Detalles del Movimiento</h2>
              <button className="btn btn-outline" onClick={() => setShowDetails(false)} style={{ marginLeft: 'auto' }}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="details-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="detail-item">
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID Transacción</label>
                <div>{selectedTransaction.id}</div>
              </div>
              <div className="detail-item">
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fecha y Hora</label>
                <div>{formatDate(selectedTransaction.date, 'full')}</div>
              </div>
              <div className="detail-item">
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tipo</label>
                <div><span className={`badge ${getTypeBadge(selectedTransaction.type).class}`}>{selectedTransaction.type}</span></div>
              </div>
              <div className="detail-item">
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Monto</label>
                <div style={{ fontWeight: 600 }}>{formatCurrency(selectedTransaction.amount)}</div>
              </div>
              <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Descripción</label>
                <div>{selectedTransaction.description}</div>
              </div>
              <div className="detail-item">
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Categoría</label>
                <div>{selectedTransaction.categoryName || 'N/A'}</div>
              </div>
              <div className="detail-item">
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Usuario</label>
                <div>{selectedTransaction.userName || selectedTransaction.user?.name}</div>
              </div>
            </div>

            {selectedTransaction.details && (
              <div style={{ marginTop: '20px' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Información Adicional</h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  {selectedTransaction.details.authorizedBy && (
                    <div className="detail-item">
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Autorizado por</label>
                      <div style={{ fontWeight: 600, color: 'var(--primary)' }}>
                        <i className="fas fa-user-shield" style={{ marginRight: '6px' }}></i>
                        {selectedTransaction.details.authorizedBy}
                      </div>
                    </div>
                  )}
                  {selectedTransaction.details.performedBy && (
                    <div className="detail-item">
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Realizado por</label>
                      <div>
                        <i className="fas fa-user" style={{ marginRight: '6px' }}></i>
                        {selectedTransaction.details.performedBy}
                      </div>
                    </div>
                  )}
                  {selectedTransaction.details.openedBy && (
                    <div className="detail-item">
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Abierto originalmente por</label>
                      <div>{selectedTransaction.details.openedBy}</div>
                    </div>
                  )}
                </div>

                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Datos técnicos (JSON)</label>
                <pre style={{ 
                  background: 'var(--bg-main)', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  fontSize: '0.8rem', 
                  overflowX: 'auto',
                  border: '1px solid var(--border-color)'
                }}>
                  {JSON.stringify(selectedTransaction.details, null, 2)}
                </pre>
              </div>
            )}

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setShowDetails(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserHistory;
