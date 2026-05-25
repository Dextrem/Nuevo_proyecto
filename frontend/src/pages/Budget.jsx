import { useState, useEffect, useCallback } from 'react';
import budgetService, { getBudgetExecution } from '../services/budgetService';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { DATA_UPDATED_EVENT } from '../hooks/useDataSync';
import ConfirmModal from '../components/ConfirmModal';

const BUDGET_CATEGORIES = [
  { id: 'ventas', name: 'Ventas', type: 'income' },
  { id: 'servicios', name: 'Servicios', type: 'income' },
  { id: 'otros_ingresos', name: 'Otros Ingresos', type: 'income' },
  { id: 'sueldos', name: 'Sueldos y Salarios', type: 'expense' },
  { id: 'alquiler', name: 'Alquiler', type: 'expense' },
  { id: 'servicios_pub', name: 'Servicios Públicos', type: 'expense' },
  { id: 'materiales', name: 'Materiales e Insumos', type: 'expense' },
  { id: 'transporte', name: 'Transporte', type: 'expense' },
  { id: 'marketing', name: 'Marketing y Publicidad', type: 'expense' },
  { id: 'mantenimiento', name: 'Mantenimiento', type: 'expense' },
  { id: 'impuestos', name: 'Impuestos', type: 'expense' },
  { id: 'otros_gastos', name: 'Otros Gastos', type: 'expense' },
];

const Budget = () => {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [summary, setSummary] = useState(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const { formatCurrency } = useApp();
  const { hasPermission } = useAuth();

  const [formData, setFormData] = useState({
    category: '',
    type: 'expense',
    plannedAmount: '',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  });

  const loadBudgets = useCallback(async () => {
    try {
      const response = await budgetService.getAll({ year: selectedYear, month: selectedMonth });
      setBudgets(response.data || []);
    } catch (error) {
      console.error('Error loading budgets:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  const loadSummary = useCallback(async () => {
    try {
      const [summaryRes, executionRes] = await Promise.all([
        budgetService.getSummary(selectedYear, selectedMonth),
        getBudgetExecution(selectedYear, selectedMonth)
      ]);
      
      const summaryData = summaryRes.data || {};
      const executionData = executionRes.data || {};
      
      setSummary({
        ...summaryData,
        realIncome: executionData.income || 0,
        realExpense: executionData.expense || 0,
        incomeByCategory: executionData.incomeByCategory || {},
        expenseByCategory: executionData.expenseByCategory || {},
        transactionCount: executionData.transactionCount || 0,
        saleCount: executionData.saleCount || 0,
      });
    } catch (error) {
      console.error('Error loading summary:', error);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    loadBudgets();
    loadSummary();
  }, [loadBudgets, loadSummary]);

  useEffect(() => {
    const handleUpdate = (e) => {
      const type = e.detail?.type;
      if (type === 'transactions' || type === 'all' || type === 'sales') {
        loadSummary();
      }
    };
    window.addEventListener(DATA_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleUpdate);
  }, [loadSummary]);

  const handleOpenModal = (budget = null) => {
    if (budget) {
      setEditingBudget(budget);
      setFormData({
        category: budget.category,
        type: budget.type,
        plannedAmount: budget.plannedAmount.toString(),
        year: budget.year,
        month: budget.month,
      });
    } else {
      setEditingBudget(null);
      setFormData({
        category: '',
        type: 'expense',
        plannedAmount: '',
        year: selectedYear,
        month: selectedMonth,
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingBudget(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!formData.category) {
        alert('Por favor selecciona una categoría');
        return;
      }
      
      const plannedAmount = parseFloat(formData.plannedAmount);
      if (isNaN(plannedAmount) || plannedAmount <= 0) {
        alert('Por favor ingresa un monto válido mayor a 0');
        return;
      }

      const data = {
        category: formData.category,
        type: formData.type,
        plannedAmount: plannedAmount,
        year: parseInt(formData.year),
        month: parseInt(formData.month),
      };

      console.log('Guardando presupuesto:', data);
      
      if (editingBudget) {
        await budgetService.update(editingBudget.id, data);
      } else {
        await budgetService.create(data);
      }

      handleCloseModal();
      loadBudgets();
      loadSummary();
    } catch (error) {
      console.error('Error al guardar:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Error al guardar presupuesto';
      alert(errorMsg);
    }
  };

  const handleDelete = (id) => {
    setConfirmDeleteId(id);
    setShowConfirmDelete(true);
  };

  const confirmDelete = async () => {
    try {
      await budgetService.delete(confirmDeleteId);
      loadBudgets();
      loadSummary();
    } catch (error) {
      alert(error.response?.data?.error || 'Error al eliminar presupuesto');
    } finally {
      setShowConfirmDelete(false);
      setConfirmDeleteId(null);
    }
  };

  const cancelDelete = () => {
    setShowConfirmDelete(false);
    setConfirmDeleteId(null);
  };

  const getBudgetProgress = (category, type) => {
    if (!summary) return { planned: 0, actual: 0, percentage: 0, remaining: 0 };
    
    const key = `${type}_${category}`;
    const planned = summary.budgetByCategory?.[key]?.planned || 0;
    
    let actual = 0;
    if (type === 'income') {
      actual = summary.incomeByCategory?.[category] || 0;
    } else {
      actual = summary.expenseByCategory?.[category] || 0;
    }
    
    const percentage = planned > 0 ? (actual / planned) * 100 : 0;
    const remaining = planned - actual;
    
    return { planned, actual, percentage, remaining };
  };

  const getCategoryName = (categoryId) => {
    return BUDGET_CATEGORIES.find(c => c.id === categoryId)?.name || categoryId;
  };

  const totalPlannedIncome = budgets.filter(b => b.type === 'income').reduce((sum, b) => sum + b.plannedAmount, 0);
  const totalPlannedExpense = budgets.filter(b => b.type === 'expense').reduce((sum, b) => sum + b.plannedAmount, 0);
  const actualIncome = summary?.realIncome || 0;
  const actualExpense = summary?.realExpense || 0;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const months = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' }, { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' }, { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' },
  ];

  if (loading) {
    return (
      <div className="loading-fallback">
        <div className="spinner"></div>
        <p>Cargando presupuestos...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="view-header">
        <div>
          <h1>Presupuesto</h1>
          <p>Controla tus ingresos y gastos planificados</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            className="form-control"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            style={{ width: '120px' }}
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select
            className="form-control"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            style={{ width: '150px' }}
          >
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          {hasPermission('manage_budgets') && (
            <button className="btn btn-primary" onClick={() => handleOpenModal()}>
              <i className="fas fa-plus"></i> Nuevo
            </button>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
          <div className="kpi-card" style={{ borderLeft: '4px solid var(--secondary)' }}>
            <div className="kpi-info">
              <h3>Ingresos Planificados</h3>
              <h2>{formatCurrency(totalPlannedIncome)}</h2>
              <p style={{ color: 'var(--secondary)' }}>Reales: {formatCurrency(actualIncome)}</p>
            </div>
          </div>
          <div className="kpi-card" style={{ borderLeft: '4px solid var(--danger)' }}>
            <div className="kpi-info">
              <h3>Gastos Planificados</h3>
              <h2>{formatCurrency(totalPlannedExpense)}</h2>
              <p style={{ color: 'var(--danger)' }}>Reales: {formatCurrency(actualExpense)}</p>
            </div>
          </div>
          <div className="kpi-card" style={{ borderLeft: '4px solid var(--primary)' }}>
            <div className="kpi-info">
              <h3>Balance Planificado</h3>
              <h2>{formatCurrency(totalPlannedIncome - totalPlannedExpense)}</h2>
              <p style={{ color: actualIncome - actualExpense >= 0 ? 'var(--secondary)' : 'var(--danger)' }}>
                Real: {formatCurrency(actualIncome - actualExpense)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="data-table-container">
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
          <h3>Detalle por Categoría</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Categoría</th>
              <th>Tipo</th>
              <th style={{ textAlign: 'right' }}>Planificado</th>
              <th style={{ textAlign: 'right' }}>Real</th>
              <th style={{ textAlign: 'right' }}>Variación</th>
              <th>Progreso</th>
              {hasPermission('manage_budgets') && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {budgets.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                  <div style={{ color: 'var(--text-muted)' }}>
                    <i className="fas fa-chart-pie" style={{ fontSize: '2rem', marginBottom: '12px', display: 'block' }}></i>
                    No hay presupuestos configurados
                  </div>
                </td>
              </tr>
            ) : (
              budgets.map((budget) => {
                const progress = getBudgetProgress(budget.category, budget.type);
                const isOverBudget = progress.remaining < 0;
                return (
                  <tr key={budget.id}>
                    <td><strong>{getCategoryName(budget.category)}</strong></td>
                    <td>
                      <span className={`badge ${budget.type === 'income' ? 'badge-success' : 'badge-warning'}`}>
                        {budget.type === 'income' ? 'Ingreso' : 'Gasto'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(progress.planned)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(progress.actual)}</td>
                    <td style={{ textAlign: 'right', color: isOverBudget ? 'var(--danger)' : 'var(--secondary)' }}>
                      {isOverBudget ? '-' : ''}{formatCurrency(Math.abs(progress.remaining))}
                    </td>
                    <td style={{ minWidth: '150px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '8px', background: 'var(--bg-surface-hover)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${Math.min(100, progress.percentage)}%`,
                            height: '100%',
                            background: progress.percentage > 100 ? 'var(--danger)' : progress.percentage > 80 ? 'var(--accent)' : 'var(--secondary)',
                            transition: 'width 0.3s ease'
                          }}></div>
                        </div>
                        <span style={{ fontSize: '0.75rem', minWidth: '40px' }}>{progress.percentage.toFixed(0)}%</span>
                      </div>
                    </td>
                    {hasPermission('manage_budgets') && (
                      <td>
                        <button className="btn btn-outline" onClick={() => handleOpenModal(budget)} style={{ marginRight: '6px', padding: '6px 10px' }}>
                          <i className="fas fa-edit"></i>
                        </button>
                        <button className="btn btn-outline" onClick={() => handleDelete(budget.id)} style={{ padding: '6px 10px', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                          <i className="fas fa-trash"></i>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingBudget ? 'Editar Presupuesto' : 'Nuevo Presupuesto'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Categoría *</label>
                <select
                  className="form-control"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                >
                  <option value="">Seleccionar...</option>
                  <optgroup label="Ingresos">
                    {BUDGET_CATEGORIES.filter(c => c.type === 'income').map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Gastos">
                    {BUDGET_CATEGORIES.filter(c => c.type === 'expense').map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="form-group">
                <label>Tipo</label>
                <select
                  className="form-control"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="expense">Gasto</option>
                  <option value="income">Ingreso</option>
                </select>
              </div>

              <div className="form-group">
                <label>Monto Planificado *</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  value={formData.plannedAmount}
                  onChange={(e) => setFormData({ ...formData, plannedAmount: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Año</label>
                  <select
                    className="form-control"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                  >
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Mes</label>
                  <select
                    className="form-control"
                    value={formData.month}
                    onChange={(e) => setFormData({ ...formData, month: parseInt(e.target.value) })}
                  >
                    {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="submit" className="btn btn-primary">
                  {editingBudget ? 'Actualizar' : 'Crear'}
                </button>
                <button type="button" className="btn btn-outline" onClick={handleCloseModal}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        show={showConfirmDelete}
        title="Eliminar Presupuesto"
        message="&iquest;Est&aacute;s seguro de eliminar este presupuesto? Esta acci&oacute;n no se puede deshacer."
        icon="fa-trash-alt"
        iconColor="#EF4444"
        confirmText="S&iacute;, eliminar"
        confirmButtonClass="btn btn-primary"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
};

export default Budget;
