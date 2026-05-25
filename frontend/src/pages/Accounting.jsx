import { useState, useEffect } from 'react';
import { transactionService } from '../services/api';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { notifyDataUpdate } from '../hooks/useDataSync';
import Pagination from '../components/Pagination';
import ConfirmModal from '../components/ConfirmModal';

const Accounting = () => {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [budgets, setBudgets] = useState([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    reference: '',
  });
  const { formatCurrency, showNotification } = useApp();
  const { hasPermission } = useAuth();
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [showBudgetWarning, setShowBudgetWarning] = useState(false);
  const [budgetWarningMsg, setBudgetWarningMsg] = useState('');
  const [pendingSubmit, setPendingSubmit] = useState(null);

  const [formData, setFormData] = useState({
    type: 'INCOME',
    amount: '',
    description: '',
    reference: '',
    category: '',
  });

  const BUDGET_CATEGORIES = [
    { id: 'ventas', name: 'Ventas', type: 'INCOME' },
    { id: 'servicios', name: 'Servicios', type: 'INCOME' },
    { id: 'otros_ingresos', name: 'Otros Ingresos', type: 'INCOME' },
    { id: 'sueldos', name: 'Sueldos y Salarios', type: 'EXPENSE' },
    { id: 'alquiler', name: 'Alquiler', type: 'EXPENSE' },
    { id: 'servicios_pub', name: 'Servicios Públicos', type: 'EXPENSE' },
    { id: 'materiales', name: 'Materiales e Insumos', type: 'EXPENSE' },
    { id: 'transporte', name: 'Transporte', type: 'EXPENSE' },
    { id: 'marketing', name: 'Marketing y Publicidad', type: 'EXPENSE' },
    { id: 'mantenimiento', name: 'Mantenimiento', type: 'EXPENSE' },
    { id: 'impuestos', name: 'Impuestos', type: 'EXPENSE' },
    { id: 'otros_gastos', name: 'Otros Gastos', type: 'EXPENSE' },
  ];

  useEffect(() => {
    loadData(1);
  }, [typeFilter, filters]);

  const loadData = async (page = 1) => {
    try {
      // setLoading(true); // Evitar refresco de pantalla en búsqueda
      const params = { page, limit: pagination.limit };
      if (typeFilter) params.type = typeFilter;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.reference) params.reference = filters.reference;

      const [transactionsRes, summaryRes] = await Promise.all([
        transactionService.getAll(params),
        transactionService.getSummary(params),
      ]);
      const transactionsData = transactionsRes.data?.data || transactionsRes.data;
      const paginationData = transactionsRes.data?.pagination || { total: Array.isArray(transactionsData) ? transactionsData.length : 0 };
      const summaryData = summaryRes.data?.data || summaryRes.data;
      setTransactions(Array.isArray(transactionsData) ? transactionsData : []);
      setSummary(summaryData || {});
      setPagination(prev => ({ ...prev, ...paginationData, page }));
    } catch (error) {
      console.error('Error loading data:', error);
      setTransactions([]);
      setSummary({});
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      reference: '',
    });
  };

  const handleOpenModal = (transaction = null) => {
    if (transaction) {
      setEditingTransaction(transaction);
      setFormData({
        type: transaction.type,
        amount: transaction.amount.toString(),
        description: transaction.description,
        reference: transaction.reference || '',
      });
    } else {
      setEditingTransaction(null);
      setFormData({
        type: 'INCOME',
        description: '',
        reference: '',
        category: '',
      });
    }
    setShowModal(true);
  };

  const checkBudgetLimit = async (amount, category, type) => {
    if (type !== 'EXPENSE' || !category) return { allowed: true };
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      
      const [budgetsRes, executionRes] = await Promise.all([
        import('../services/budgetService').then(m => m.default.getAll({ year, month })),
        import('../services/budgetService').then(m => m.getBudgetExecution(year, month))
      ]);

      const budget = budgetsRes.data.find(b => b.category === category);
      if (!budget) return { allowed: true };

      const currentActual = executionRes.data.expenseByCategory[category] || 0;
      const totalAfter = currentActual + parseFloat(amount);

      if (totalAfter > budget.plannedAmount) {
        const msg = `Este gasto de ${formatCurrency(amount)} har&aacute; que la categor&iacute;a '${category}' exceda el presupuesto mensual (${formatCurrency(budget.plannedAmount)}).`;
        return { allowed: false, warning: msg };
      }
      return { allowed: true };
    } catch (e) {
      console.error('Error al verificar presupuesto:', e);
      return { allowed: true };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const amount = parseFloat(formData.amount);
      const result = await checkBudgetLimit(amount, formData.category, formData.type);
      if (!result.allowed) {
        setBudgetWarningMsg(result.warning);
        setShowBudgetWarning(true);
        setPendingSubmit(formData);
        return;
      }

      await saveTransaction(formData, amount);

      setShowModal(false);
      loadData();
      notifyDataUpdate('transactions');
    } catch (error) {
      showNotification(error.response?.data?.error || 'Error al guardar transacción', 'error');
    }
  };

  const confirmSubmitWithBudgetWarning = async () => {
    const amount = parseFloat(pendingSubmit.amount);
    await saveTransaction(pendingSubmit, amount);
    setShowBudgetWarning(false);
    setPendingSubmit(null);
    setShowModal(false);
    loadData();
    notifyDataUpdate('transactions');
  };

  const cancelBudgetWarning = () => {
    setShowBudgetWarning(false);
    setPendingSubmit(null);
  };

  const saveTransaction = async (data, amount) => {
    const payload = { ...data, amount };
    if (editingTransaction) {
      await transactionService.update(editingTransaction.id, payload);
    } else {
      await transactionService.create(payload);
    }
  };

  const handleDelete = (id) => {
    setDeleteTargetId(id);
    setShowConfirmDelete(true);
  };

  const confirmDeleteTransaction = async () => {
    try {
      await transactionService.delete(deleteTargetId);
      loadData();
      notifyDataUpdate('transactions');
    } catch (error) {
      showNotification(error.response?.data?.error || 'Error al eliminar transacción', 'error');
    } finally {
      setShowConfirmDelete(false);
      setDeleteTargetId(null);
    }
  };

  const cancelDeleteTransaction = () => {
    setShowConfirmDelete(false);
    setDeleteTargetId(null);
  };

  if (loading) {
    return <div>Cargando...</div>;
  }

  return (
    <div>
      <div className="view-header">
        <div>
          <h1>Contabilidad</h1>
          <p>Registra ingresos y gastos</p>
        </div>
        {hasPermission('manage_accounting') && (
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            <i className="fas fa-plus"></i>
            Nueva Transacción
          </button>
        )}
      </div>

      <div className="kpi-grid" style={{ marginBottom: '32px' }}>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: 'var(--secondary)' }}>
            <i className="fas fa-arrow-up"></i>
          </div>
          <div className="kpi-info">
            <h3>Total Ingresos</h3>
            <h2>{formatCurrency(summary?.totalIncome || 0)}</h2>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: 'rgb(34,197,94)' }}>
            <i className="fas fa-money-bill-wave"></i>
          </div>
          <div className="kpi-info">
            <h3>Efectivo</h3>
            <h2>{formatCurrency(summary?.cashIncome || 0)}</h2>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: 'rgb(59,130,246)' }}>
            <i className="fas fa-credit-card"></i>
          </div>
          <div className="kpi-info">
            <h3>Crédito</h3>
            <h2>{formatCurrency(summary?.creditSales || 0)}</h2>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>
            <i className="fas fa-arrow-down"></i>
          </div>
          <div className="kpi-info">
            <h3>Total Gastos</h3>
            <h2>{formatCurrency(summary?.totalExpense || 0)}</h2>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon">
            <i className="fas fa-balance-scale"></i>
          </div>
          <div className="kpi-info">
            <h3>Balance</h3>
            <h2>{formatCurrency(summary?.balance || 0)}</h2>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          className="form-control"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{ maxWidth: '200px' }}
        >
          <option value="">Todos los tipos</option>
          <option value="INCOME">Ingresos</option>
          <option value="EXPENSE">Gastos</option>
        </select>

        <input
          type="text"
          className="form-control"
          placeholder="Buscar referencia..."
          style={{ width: '180px' }}
          value={filters.reference}
          onChange={(e) => handleFilterChange('reference', e.target.value)}
        />

        <input
          type="date"
          className="form-control"
          style={{ width: '150px' }}
          value={filters.startDate}
          onChange={(e) => handleFilterChange('startDate', e.target.value)}
        />

        <span style={{ color: 'var(--text-muted)' }}>hasta</span>

        <input
          type="date"
          className="form-control"
          style={{ width: '150px' }}
          value={filters.endDate}
          onChange={(e) => handleFilterChange('endDate', e.target.value)}
        />

        <button className="btn btn-outline" onClick={clearFilters}>
          <i className="fas fa-times"></i> Limpiar
        </button>
      </div>

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Usuario</th>
              <th>Tipo</th>
              <th>Descripción</th>
              <th>Referencia</th>
              <th>Monto</th>
              {hasPermission('manage_accounting') && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr key={transaction.id}>
                <td>{new Date(transaction.date).toLocaleDateString()}</td>
                <td>{transaction.user?.name || transaction.user?.username || '-'}</td>
                <td>
                  <span
                    className={`badge ${
                      transaction.type === 'INCOME'
                        ? (transaction.description?.includes('Abono') ? 'badge-warning' : 'badge-success')
                        : 'badge-danger'
                    }`}
                  >
                    {transaction.type === 'INCOME' ? (transaction.description?.includes('Abono') ? 'Abono' : 'Ingreso') : 'Gasto'}
                  </span>
                </td>
                <td>{transaction.description}</td>
                <td>{transaction.reference || '-'}</td>
                <td>
                  <strong
                    style={{
                      color:
                        transaction.type === 'INCOME'
                          ? (transaction.description?.includes('Abono') ? '#f59e0b' : 'var(--secondary)')
                          : 'var(--danger)',
                    }}
                  >
                    {transaction.type === 'INCOME' ? '+' : '-'}
                    {formatCurrency(transaction.amount)}
                  </strong>
                </td>
                {hasPermission('manage_accounting') && (
                  <td>
                    <button
                      className="btn btn-outline"
                      onClick={() => handleOpenModal(transaction)}
                      style={{ marginRight: '8px', padding: '6px 12px' }}
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    <button
                      className="btn btn-outline"
                      onClick={() => handleDelete(transaction.id)}
                      style={{
                        padding: '6px 12px',
                        color: 'var(--danger)',
                        borderColor: 'var(--danger)',
                      }}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination pagination={pagination} onPageChange={loadData} loading={loading} />

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>
              {editingTransaction ? 'Editar Transacción' : 'Nueva Transacción'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Tipo *</label>
                <select
                  className="form-control"
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value })
                  }
                  required
                >
                  <option value="INCOME">Ingreso</option>
                  <option value="EXPENSE">Gasto</option>
                </select>
              </div>
              <div className="form-group">
                <label>Monto *</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label>Descripción *</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label>Referencia</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.reference}
                  onChange={(e) =>
                    setFormData({ ...formData, reference: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label>Categoría (Presupuesto) *</label>
                <select
                  className="form-control"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                >
                  <option value="">Seleccionar categoría...</option>
                  {BUDGET_CATEGORIES.filter(c => c.type === formData.type).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="submit" className="btn btn-primary">
                  {editingTransaction ? 'Actualizar' : 'Crear'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        show={showBudgetWarning}
        title="Advertencia de Presupuesto"
        message={budgetWarningMsg}
        icon="fa-exclamation-triangle"
        iconColor="#F59E0B"
        confirmText="S&iacute;, continuar"
        confirmButtonClass="btn btn-primary"
        onConfirm={confirmSubmitWithBudgetWarning}
        onCancel={cancelBudgetWarning}
      />

      <ConfirmModal
        show={showConfirmDelete}
        title="Eliminar Transacci&oacute;n"
        message="&iquest;Est&aacute;s seguro de eliminar esta transacci&oacute;n?"
        icon="fa-trash-alt"
        iconColor="#EF4444"
        confirmText="S&iacute;, eliminar"
        confirmButtonClass="btn btn-primary"
        onConfirm={confirmDeleteTransaction}
        onCancel={cancelDeleteTransaction}
      />
    </div>
  );
};

export default Accounting;
