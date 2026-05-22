import { useState, useEffect } from 'react';
import api from '../services/api';
import { saleService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import './CashRegister.css';

const CashRegister = () => {
  const { user: currentUser } = useAuth();
  const { showNotification } = useApp();
  const [registers, setRegisters] = useState([]);
  const [openRegisters, setOpenRegisters] = useState([]);
  const [selectedRegister, setSelectedRegister] = useState(null);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creditSalesDate, setCreditSalesDate] = useState(new Date().toISOString().split('T')[0]);
  const [creditSalesData, setCreditSalesData] = useState(null);
  const [loadingCreditSales, setLoadingCreditSales] = useState(false);

  // Form states
  const [openForm, setOpenForm] = useState({ name: 'Caja General', openingAmount: '', authorizerUsername: '', authorizerPassword: '' });
  const [transactionForm, setTransactionForm] = useState({
    type: 'INCOME',
    amount: '',
    description: '',
    reference: ''
  });
  const [closeForm, setCloseForm] = useState({ closingAmount: '', notes: '', authorizerUsername: '', authorizerPassword: '' });
  const [closeDifference, setCloseDifference] = useState(0);

  useEffect(() => {
    loadRegisters();
    loadOpenRegisters();
    loadCreditSales(creditSalesDate);
  }, [creditSalesDate]);

  const loadCreditSales = async (date) => {
    setLoadingCreditSales(true);
    try {
      const response = await saleService.getCreditSalesSummary({ date });
      const data = response.data?.data || response.data;
      setCreditSalesData(data || null);
    } catch (error) {
      console.error('Error loading credit sales:', error);
      setCreditSalesData(null);
    } finally {
      setLoadingCreditSales(false);
    }
  };

  const loadRegisters = async () => {
    try {
      const response = await api.get('/cash-registers');
      const data = response.data?.data || response.data;
      setRegisters(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading registers:', error);
      setRegisters([]);
    }
  };

  const loadOpenRegisters = async () => {
    try {
      const response = await api.get('/cash-registers/open');
      const data = response.data?.data || response.data;
      setOpenRegisters(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading open registers:', error);
      setOpenRegisters([]);
    }
  };

  const handleOpenRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const openingAmount = parseFloat(openForm.openingAmount);
      if (openingAmount < 0) {
        showNotification('El monto de apertura no puede ser negativo', 'error');
        return;
      }
      const payload = { 
        name: openForm.name || 'Caja General', 
        openingAmount: openingAmount || 0,
        authorizerUsername: openForm.authorizerUsername,
        authorizerPassword: openForm.authorizerPassword
      };
      await api.post('/cash-registers/open', payload);
      showNotification('Caja abierta exitosamente', 'success');
      setShowOpenModal(false);
      setOpenForm({ name: 'Caja General', openingAmount: '', authorizerUsername: '', authorizerPassword: '' });
      loadRegisters();
      loadOpenRegisters();
    } catch (error) {
      showNotification(error.response?.data?.error || 'Error al abrir la caja', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!selectedRegister) return;

    setLoading(true);
    try {
      await api.post('/cash-registers/transaction', {
        ...transactionForm,
        amount: parseFloat(transactionForm.amount) || 0,
        registerId: selectedRegister.id
      });
      setShowTransactionModal(false);
      setTransactionForm({ type: 'INCOME', amount: '', description: '', reference: '' });
      loadOpenRegisters();
    } catch (error) {
      showNotification(error.response?.data?.error || 'Error al agregar la transacción', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseRegister = async (e) => {
    e.preventDefault();
    if (!selectedRegister) return;

    setLoading(true);
    try {
      const payload = {
        closingAmount: parseFloat(closeForm.closingAmount) || 0,
        notes: closeForm.notes,
        authorizerUsername: closeForm.authorizerUsername,
        authorizerPassword: closeForm.authorizerPassword
      };
      const response = await api.put(`/cash-registers/${selectedRegister.id}/close`, payload);
      const diff = response.data.difference;
      const diffMsg = diff === 0 ? ' (caja cuadrada)' : diff > 0 ? ` (sobrante: ${diff})` : ` (faltante: ${Math.abs(diff)})`;
      showNotification(`Caja cerrada. Esperado: ${response.data.expectedAmount} | Real: ${response.data.actualAmount}${diffMsg}`, diff === 0 ? 'success' : 'error');
      setShowCloseModal(false);
      setCloseForm({ closingAmount: '', notes: '', authorizerUsername: '', authorizerPassword: '' });
      loadRegisters();
      loadOpenRegisters();
      setSelectedRegister(null);
    } catch (error) {
      showNotification(error.response?.data?.error || 'Error al cerrar la caja', 'error');
    } finally {
      setLoading(false);
    }
  };

  const calculateExpectedAmount = (register) => {
    // Expected cash = apertura + sum of all transfer transactions (income - expense)
    const opening = parseFloat(register.openingAmount) || 0;
    const income = (register.transactions || [])
      .filter((t) => t.type === 'INCOME')
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const expense = (register.transactions || [])
      .filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    return opening + income - expense;
  };

  const handleClosingAmountChange = (e) => {
    const rawVal = e.target.value;
    setCloseForm({ ...closeForm, closingAmount: rawVal });
    const expected = calculateExpectedAmount(selectedRegister);
    setCloseDifference((parseFloat(rawVal) || 0) - expected);
  };

  return (
    <div className="cash-register">
      <div className="header">
        <h1>Caja General</h1>
        <button
          className="btn-primary"
          onClick={() => setShowOpenModal(true)}
        >
          Abrir Nueva Caja
        </button>
      </div>

      <div style={{ marginBottom: '32px', padding: '20px', background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ margin: 0 }}>Ventas a Crédito del Día</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Fecha:</label>
            <input
              type="date"
              className="form-control"
              value={creditSalesDate}
              onChange={(e) => setCreditSalesDate(e.target.value)}
              style={{ width: '150px' }}
            />
          </div>
        </div>

        {loadingCreditSales ? (
          <p>Cargando...</p>
        ) : creditSalesData && creditSalesData.sales.length > 0 ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div style={{ padding: '16px', background: 'rgba(59,130,246,0.1)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.85rem', color: 'rgb(59,130,246)' }}>Total Ventas Crédito</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>${creditSalesData.summary.totalSales.toFixed(2)}</div>
              </div>
              <div style={{ padding: '16px', background: 'rgba(16,185,129,0.1)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--secondary)' }}>Cobrado</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>${creditSalesData.summary.totalPaid.toFixed(2)}</div>
              </div>
              <div style={{ padding: '16px', background: 'rgba(245,158,11,0.1)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.85rem', color: 'rgb(245,158,11)' }}>Pendiente</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>${creditSalesData.summary.totalPending.toFixed(2)}</div>
              </div>
              <div style={{ padding: '16px', background: 'rgba(107,114,128,0.1)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.85rem', color: 'rgb(107,114,128)' }}>Cantidad</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{creditSalesData.summary.countSales}</div>
              </div>
            </div>

            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Factura</th>
                    <th>Cliente</th>
                    <th>Total</th>
                    <th>Pagado</th>
                    <th>Pendiente</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {creditSalesData.sales.map((sale) => (
                    <tr key={sale.id}>
                      <td>{sale.invoiceNumber}</td>
                      <td>{sale.client?.name || 'Sin cliente'}</td>
                      <td>${sale.total.toFixed(2)}</td>
                      <td>${sale.paidAmount.toFixed(2)}</td>
                      <td>${(sale.total - sale.paidAmount).toFixed(2)}</td>
                      <td>
                        <span className={`badge ${sale.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
                          {sale.status === 'COMPLETED' ? 'Pagado' : 'Pendiente'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>No hay ventas a crédito para esta fecha</p>
        )}
      </div>

      <div className="registers-section">
        <div className="open-registers">
          <h2>Cajas Abiertas</h2>
          {openRegisters.length === 0 ? (
            <p>No hay cajas abiertas</p>
          ) : (
            <div className="registers-grid">
              {openRegisters.map(register => (
                <div key={register.id} className="register-card open">
                  <h3>{register.name}</h3>
                  <p>Apertura: ${register.openingAmount.toFixed(2)}</p>
                  <p>Actual: ${register.currentAmount.toFixed(2)}</p>
                  <p>Ventas del día: ${(register.salesTotal || 0).toFixed(2)}</p>
                  <p>Abonos: ${(register.abonosTotal || 0).toFixed(2)}</p>
                  <p>Total Esperado: ${calculateExpectedAmount(register).toFixed(2)}</p>
                  <p>Usuario: {register.openedByUser.name}</p>
                  <div className="card-actions">
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        setSelectedRegister(register);
                        setShowTransactionModal(true);
                      }}
                    >
                      Agregar Transacción
                    </button>
                    <button
                      className="btn-danger"
                      onClick={() => {
                        setSelectedRegister(register);
                        setShowCloseModal(true);
                        // Reset close form and difference for a clean start
                        setCloseForm({ closingAmount: '', notes: '', authorizerUsername: '', authorizerPassword: '' });
                        setCloseDifference(0);
                      }}
                    >
                      Cerrar Caja
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="all-registers">
          <h2>Historial de Cajas</h2>
          <div className="registers-list">
            {registers.map(register => (
              <div key={register.id} className={`register-item ${register.isOpen ? 'open' : 'closed'}`}>
                <div className="register-info">
                  <h4>{register.name}</h4>
                  <p>Estado: {register.isOpen ? 'Abierta' : 'Cerrada'}</p>
                  <p>Apertura: ${register.openingAmount.toFixed(2)}</p>
                  {!register.isOpen && register.closingAmount && (
                    <p>Cierre: ${register.closingAmount.toFixed(2)}</p>
                  )}
                  <p>Usuario: {register.openedByUser.name}</p>
                  {register.closedByUser && (
                    <p>Cerrado por: {register.closedByUser.name}</p>
                  )}
                </div>
                <div className="register-transactions">
                  <p>{register.transactions.length} transacciones</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Open Register Modal */}
      {showOpenModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>Abrir Nueva Caja</h2>
            {currentUser && (
              <div style={{ padding: '12px', background: 'rgba(79, 70, 229, 0.1)', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                  {currentUser.name?.charAt(0).toUpperCase() || currentUser.username?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Cajero</div>
                  <div style={{ fontWeight: '600' }}>{currentUser.name || currentUser.username}</div>
                </div>
              </div>
            )}
            <form onSubmit={handleOpenRegister}>
              <div className="form-group">
                <label>Nombre de la Caja:</label>
                <input
                  type="text"
                  value={openForm.name}
                  onChange={(e) => setOpenForm({...openForm, name: e.target.value})}
                  placeholder="Caja General"
                  required
                />
              </div>
              <div className="form-group">
                <label>Monto de Apertura:</label>
                <input
                  type="number"
                  step="0.01"
                  value={openForm.openingAmount}
                  onChange={(e) => setOpenForm({...openForm, openingAmount: e.target.value})}
                  required
                />
              </div>

              <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--accent)' }}><i className="fas fa-user-shield"></i> Autorización de Administrador</h4>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <input type="text" placeholder="Usuario Administrador" value={openForm.authorizerUsername} onChange={(e) => setOpenForm({...openForm, authorizerUsername: e.target.value})} required />
                </div>
                <div className="form-group" style={{ marginBottom: '0' }}>
                  <input type="password" placeholder="Contraseña de Administrador" value={openForm.authorizerPassword} onChange={(e) => setOpenForm({...openForm, authorizerPassword: e.target.value})} required />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setShowOpenModal(false)}>Cancelar</button>
                <button type="submit" disabled={loading}>
                  {loading ? 'Abriendo...' : 'Abrir Caja'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {showTransactionModal && selectedRegister && (
        <div className="modal">
          <div className="modal-content">
            <h2>Agregar Transacción - {selectedRegister.name}</h2>
            <form onSubmit={handleAddTransaction}>
              <div className="form-group">
                <label>Tipo:</label>
                <select
                  value={transactionForm.type}
                  onChange={(e) => setTransactionForm({...transactionForm, type: e.target.value})}
                >
                  <option value="INCOME">Ingreso</option>
                  <option value="EXPENSE">Egreso</option>
                </select>
              </div>
              <div className="form-group">
                <label>Monto:</label>
                <input
                  type="number"
                  step="0.01"
                  value={transactionForm.amount}
                  onChange={(e) => setTransactionForm({...transactionForm, amount: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Descripción:</label>
                <input
                  type="text"
                  value={transactionForm.description}
                  onChange={(e) => setTransactionForm({...transactionForm, description: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Referencia (opcional):</label>
                <input
                  type="text"
                  value={transactionForm.reference}
                  onChange={(e) => setTransactionForm({...transactionForm, reference: e.target.value})}
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowTransactionModal(false)}>Cancelar</button>
                <button type="submit" disabled={loading}>
                  {loading ? 'Agregando...' : 'Agregar Transacción'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Register Modal */}
      {showCloseModal && selectedRegister && (
        <div className="modal">
          <div className="modal-content">
            <form onSubmit={handleCloseRegister}>
              <h2>Cerrar Caja - {selectedRegister.name}</h2>
            <div className="close-summary">
              <div className="summary-row">
                <span>Monto de apertura:</span>
                <strong>${selectedRegister.openingAmount.toFixed(2)}</strong>
              </div>
              <div className="summary-row">
                <span>Total Ingresos:</span>
                <strong>${selectedRegister.transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0).toFixed(2)}</strong>
              </div>
              <div className="summary-row">
                <span>Total Egresos:</span>
                <strong>${selectedRegister.transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0).toFixed(2)}</strong>
              </div>
              {selectedRegister.sales && selectedRegister.sales.length > 0 && (
                <div className="summary-row">
                  <span>Ventas en efectivo ({selectedRegister.sales.length}):</span>
                  <strong>${selectedRegister.sales.reduce((s, t) => s + (t.paidAmount || 0), 0).toFixed(2)}</strong>
                </div>
              )}
              {selectedRegister.abonos && selectedRegister.abonos.length > 0 && (
                <div className="summary-row">
                  <span>Abonos a crédito ({selectedRegister.abonos.length}):</span>
                  <strong>${selectedRegister.abonos.reduce((s, t) => s + (t.amount || 0), 0).toFixed(2)}</strong>
                </div>
              )}
              <div className="summary-row highlight">
                <span>Monto Esperado:</span>
                <strong style={{ color: 'var(--primary)' }}>${calculateExpectedAmount(selectedRegister).toFixed(2)}</strong>
              </div>
            </div>
            
            <div className="form-group">
              <label>Monto de cierre real (dinero en caja):</label>
              <input
                type="number"
                step="0.01"
                value={closeForm.closingAmount}
                onChange={handleClosingAmountChange}
                placeholder="Ingrese el monto real en caja"
                required
                style={{ 
                  fontSize: '1.2rem', 
                  padding: '12px',
                  borderColor: closeDifference < 0 ? 'var(--danger)' : closeDifference > 0 ? 'var(--secondary)' : 'var(--border-color)'
                }}
              />
            </div>

            {closeForm.closingAmount > 0 && (
              <div className={`difference-display ${closeDifference < 0 ? 'missing' : closeDifference > 0 ? 'surplus' : 'balanced'}`}>
                {closeDifference < 0 ? (
                  <div className="difference-warning">
                    <i className="fa-solid fa-triangle-exclamation"></i>
                    <div>
                      <strong>FALTANTE: ${Math.abs(closeDifference).toFixed(2)}</strong>
                      <p>El cajero debe proporcionar esta cantidad de su bolsillo</p>
                    </div>
                  </div>
                ) : closeDifference > 0 ? (
                  <div className="difference-success">
                    <i className="fa-solid fa-check-circle"></i>
                    <div>
                      <strong>SOBRANTE: ${closeDifference.toFixed(2)}</strong>
                      <p>Exceso de dinero en caja</p>
                    </div>
                  </div>
                ) : (
                  <div className="difference-balanced">
                    <i className="fa-solid fa-check"></i>
                    <div>
                      <strong>Caja cuadra correctamente</strong>
                      <p>El monto coincide con lo esperado</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="form-group">
              <label>Notas (opcional):</label>
              <textarea
                value={closeForm.notes}
                onChange={(e) => setCloseForm({...closeForm, notes: e.target.value})}
                rows="3"
                placeholder="Observaciones del cierre de caja..."
              />
            </div>

            <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--accent)' }}><i className="fas fa-user-shield"></i> Autorización de Administrador</h4>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <input 
                  type="text" 
                  placeholder="Usuario Administrador" 
                  value={closeForm.authorizerUsername} 
                  onChange={(e) => setCloseForm(prev => ({ ...prev, authorizerUsername: e.target.value }))} 
                  required 
                />
              </div>
              <div className="form-group" style={{ marginBottom: '0' }}>
                <input 
                  type="password" 
                  placeholder="Contraseña de Administrador" 
                  value={closeForm.authorizerPassword} 
                  onChange={(e) => setCloseForm(prev => ({ ...prev, authorizerPassword: e.target.value }))} 
                  required 
                />
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" onClick={() => {
                setShowCloseModal(false);
                setCloseDifference(0);
              }}>Cancelar</button>
              <button 
                type="submit" 
                disabled={loading} 
                className={closeDifference < 0 ? 'btn-danger' : closeDifference > 0 ? 'btn-warning' : ''}
                style={closeDifference < 0 ? { background: 'var(--danger)', color: 'white' } : {}}
              >
                {loading ? 'Cerrando...' : closeDifference < 0 ? 'Confirmar Faltante' : 'Cerrar Caja'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
  </div>
  );
};

export default CashRegister;