import { useState, useEffect } from 'react';
import { clientService } from '../services/api';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/Pagination';
import ConfirmModal from '../components/ConfirmModal';

const Clients = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });
  const { formatCurrency, showNotification } = useApp();
  const { hasPermission, hasRole } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    rnc: '',
    address: '',
    creditLimit: '0',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [paymentData, setPaymentData] = useState({
    amount: '',
    description: '',
  });

  useEffect(() => {
    loadClients(1);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadClients(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadClients(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadClients = async (page = 1) => {
    try {
      // setLoading(true); // Evitar refresco de pantalla en búsqueda
      const response = await clientService.getAll({ page, limit: pagination.limit, search: searchTerm });
      const data = response.data?.data || response.data;
      const paginationData = response.data?.pagination || { total: Array.isArray(data) ? data.length : 0 };
      setClients(Array.isArray(data) ? data : []);
      setPagination(prev => ({ ...prev, ...paginationData, page }));
    } catch (error) {
      console.error('Error loading clients:', error);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (client = null) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name,
        email: client.email || '',
        phone: client.phone || '',
        rnc: client.rnc || '',
        address: client.address || '',
        creditLimit: client.creditLimit?.toString() || '0',
      });
    } else {
      setEditingClient(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        rnc: '',
        address: '',
        creditLimit: '0',
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const data = {
        ...formData,
        creditLimit: parseFloat(formData.creditLimit) || 0,
      };

      if (editingClient) {
        await clientService.update(editingClient.id, data);
      } else {
        await clientService.create(data);
      }

      setShowModal(false);
      loadClients();
    } catch (error) {
      showNotification(error.response?.data?.error || 'Error al guardar cliente', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id) => {
    setConfirmDeleteId(id);
    setShowConfirmDelete(true);
  };

  const confirmDelete = async () => {
    try {
      await clientService.delete(confirmDeleteId);
      loadClients();
    } catch (error) {
      showNotification(error.response?.data?.error || 'Error al eliminar cliente', 'error');
    } finally {
      setShowConfirmDelete(false);
      setConfirmDeleteId(null);
    }
  };

  const cancelDelete = () => {
    setShowConfirmDelete(false);
    setConfirmDeleteId(null);
  };

  const handlePayment = async () => {
    if (!paymentData.amount || parseFloat(paymentData.amount) <= 0) {
      showNotification('Ingresa un monto válido', 'warning');
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      await clientService.recordPayment(selectedClient.id, {
        amount: parseFloat(paymentData.amount),
        description: paymentData.description,
      });

      setShowPaymentModal(false);
      setPaymentData({ amount: '', description: '' });
      setSelectedClient(null);
      loadClients();
      showNotification('Abono registrado exitosamente. Pendiente de aprobación por administración.', 'success');
    } catch (error) {
      showNotification(error.response?.data?.error || 'Error al registrar pago', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.phone?.includes(searchTerm)
  );

  if (loading) {
    return <div>Cargando...</div>;
  }

  return (
    <div>
      <div className="view-header">
        <div>
          <h1>Clientes</h1>
          <p>Gestiona tus clientes</p>
        </div>
        {hasPermission('manage_clients') && (
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            <i className="fas fa-plus"></i>
            Nuevo Cliente
          </button>
        )}
      </div>

      <div style={{ marginBottom: '24px' }}>
        <input
          type="text"
          className="form-control"
          placeholder="Buscar cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ maxWidth: '300px' }}
        />
      </div>

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Contacto</th>
              <th>RNC</th>
              <th>Crédito Disponible</th>
              <th>En Uso</th>
              <th>Límite</th>
              <th>Estado</th>
              {hasPermission('manage_clients') && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {filteredClients.map((client) => {
              const availableCredit = Math.max(0, client.creditLimit - client.balance);
              const usagePercent = client.creditLimit > 0 ? (client.balance / client.creditLimit) * 100 : 0;
              
              return (
                <tr key={client.id}>
                  <td>
                    <strong>{client.name}</strong>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.9rem' }}>
                      {client.email && <div>{client.email}</div>}
                      {client.phone && <div>{client.phone}</div>}
                    </div>
                  </td>
                  <td>{client.rnc || '-'}</td>
                  <td>
                    <strong style={{ color: availableCredit > 0 ? 'var(--secondary)' : 'var(--danger)' }}>
                      {formatCurrency(availableCredit)}
                    </strong>
                    {client.creditLimit > 0 && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        ({usagePercent.toFixed(0)}% usado)
                      </div>
                    )}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        client.balance > client.creditLimit ? 'badge-danger' : 
                        client.balance > client.creditLimit * 0.8 ? 'badge-warning' : 'badge-success'
                      }`}
                    >
                      {formatCurrency(client.balance)}
                    </span>
                  </td>
                  <td>{formatCurrency(client.creditLimit)}</td>
                  <td>
                    <span
                      className={`badge ${
                        client.active ? 'badge-success' : 'badge-danger'
                      }`}
                    >
                      {client.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  {hasPermission('manage_clients') && (
                    <td>
                      {client.balance > 0 && hasPermission('record_payments') && (
                        <button
                          className="btn btn-outline"
                          onClick={() => {
                            setSelectedClient(client);
                            setShowPaymentModal(true);
                          }}
                          style={{
                            marginRight: '8px',
                            padding: '6px 12px',
                            color: 'var(--secondary)',
                            borderColor: 'var(--secondary)',
                          }}
                          title="Registrar Pago"
                        >
                          <i className="fas fa-dollar-sign"></i>
                        </button>
                      )}
                      <button
                        className="btn btn-outline"
                        onClick={() => handleOpenModal(client)}
                        style={{ marginRight: '8px', padding: '6px 12px' }}
                        title="Editar Cliente"
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      {client.active && hasRole('ADMIN') && (
                        <button
                          className="btn btn-outline"
                          onClick={() => handleDelete(client.id)}
                          style={{
                            padding: '6px 12px',
                            color: 'var(--danger)',
                            borderColor: 'var(--danger)',
                          }}
                          title="Desactivar Cliente"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination pagination={pagination} onPageChange={loadClients} loading={loading} />

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>{editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={() => setShowModal(false)}
                style={{ padding: '4px 8px', border: 'none' }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre *</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Teléfono</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>RNC</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.rnc}
                    onChange={(e) =>
                      setFormData({ ...formData, rnc: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Límite de Crédito</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={formData.creditLimit}
                    onChange={(e) =>
                      setFormData({ ...formData, creditLimit: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Dirección</label>
                <textarea
                  className="form-control"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  rows="2"
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando...' : (editingClient ? 'Actualizar' : 'Crear')}
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

      {showPaymentModal && selectedClient && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Registrar Pago</h2>
            <div style={{ 
              padding: '16px', 
              backgroundColor: 'var(--bg-surface-hover)', 
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <p style={{ margin: '0 0 8px' }}>
                <strong>Cliente:</strong> {selectedClient.name}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Balance pendiente:</span>
                <strong style={{ color: 'var(--danger)' }}>{formatCurrency(selectedClient.balance)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Límite de crédito:</span>
                <strong>{formatCurrency(selectedClient.creditLimit)}</strong>
              </div>
            </div>
            <div className="form-group">
              <label>
                Monto a pagar *
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {' '}(máximo: {formatCurrency(selectedClient.balance)})
                </span>
              </label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                value={paymentData.amount}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  if (value <= selectedClient.balance) {
                    setPaymentData({ ...paymentData, amount: e.target.value });
                  } else {
                    setPaymentData({ ...paymentData, amount: selectedClient.balance.toString() });
                  }
                }}
                max={selectedClient.balance}
                min="0"
                required
              />
            </div>
            <div className="form-group">
              <label>Descripción</label>
              <input
                type="text"
                className="form-control"
                value={paymentData.description}
                onChange={(e) =>
                  setPaymentData({
                    ...paymentData,
                    description: e.target.value,
                  })
                }
                placeholder="Ej: Pago parcial, Pago total"
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button className="btn btn-primary" onClick={handlePayment} disabled={isSubmitting}>
                {isSubmitting ? 'Registrando...' : 'Registrar Pago'}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowPaymentModal(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        show={showConfirmDelete}
        title="Desactivar Cliente"
        message="&iquest;Est&aacute;s seguro de desactivar este cliente? No podr&aacute; realizar nuevas compras a menos que lo reactives."
        icon="fa-user-slash"
        iconColor="#EF4444"
        confirmText="S&iacute;, desactivar"
        confirmButtonClass="btn btn-primary"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
};

export default Clients;
