import { useState, useEffect } from 'react';
import { userService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/Pagination';

const AVAILABLE_PERMISSIONS = [
  { key: 'manage_users', label: 'Gestionar Usuarios', description: 'Crear, editar y eliminar usuarios' },
  { key: 'manage_products', label: 'Gestionar Productos', description: 'Agregar y modificar productos' },
  { key: 'manage_categories', label: 'Gestionar Categorías', description: 'Crear y editar categorías' },
  { key: 'manage_clients', label: 'Gestionar Clientes', description: 'Agregar y modificar clientes' },
  { key: 'manage_suppliers', label: 'Gestionar Proveedores', description: 'Agregar y modificar proveedores' },
  { key: 'manage_accounting', label: 'Contabilidad', description: 'Registrar ingresos y gastos contables' },
  { key: 'manage_inventory', label: 'Inventario', description: 'Ajustar stock de productos' },
  { key: 'process_sales', label: 'Realizar Ventas (POS)', description: 'Realizar ventas en punto de venta' },
  { key: 'manage_billing', label: 'Facturación / Facturas', description: 'Consultar y descargar facturas emitidas' },
  { key: 'manage_quotations', label: 'Cotizaciones', description: 'Crear, editar y convertir cotizaciones' },
  { key: 'manage_accounts_receivable', label: 'Cuentas x Cobrar (CXC)', description: 'Gestionar deudas de clientes' },
  { key: 'manage_accounts_payable', label: 'Cuentas x Pagar (CXP)', description: 'Gestionar deudas a proveedores' },
  { key: 'manage_cash_registers', label: 'Caja General', description: 'Gestionar cierres de caja y movimientos de efectivo' },
  { key: 'manage_monthly_closing', label: 'Cierre Mensual', description: 'Realizar cierre contable mensual' },
  { key: 'view_reports', label: 'Ver Reportes Estadísticos', description: 'Acceder a reportes de ventas y desempeño' },
  { key: 'view_costs', label: 'Ver Costos y Utilidad', description: 'Ver reportes de costos y beneficios netos' },
  { key: 'manage_budget', label: 'Presupuesto', description: 'Gestionar presupuestos de la empresa' },
  { key: 'manage_settings', label: 'Configuración de Sistema', description: 'Modificar ajustes globales del sistema' },
  { key: 'manage_commissions', label: 'Gestionar Comisiones', description: 'Configurar y ver comisiones de vendedores' },
  { key: 'view_history', label: 'Ver Historial General', description: 'Consultar el registro histórico de transacciones' },
];

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });
  const { hasPermission } = useAuth();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    name: '',
    role: 'CASHIER',
    permissions: {},
    passwordExpirationDays: 90,
    passwordNeverExpires: false,
  });

  useEffect(() => {
    loadUsers(1);
  }, []);

  const loadUsers = async (page = 1) => {
    try {
      setLoading(true);
      const response = await userService.getAll({ page, limit: pagination.limit });
      const data = response.data?.data || response.data;
      const paginationData = response.data?.pagination || { total: Array.isArray(data) ? data.length : 0 };
      setUsers(Array.isArray(data) ? data : []);
      setPagination(prev => ({ ...prev, ...paginationData, page }));
    } catch (error) {
      console.error('Error loading users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        email: user.email,
        password: '',
        name: user.name,
        role: user.role,
        permissions: user.permissions || {},
        passwordExpirationDays: user.passwordExpirationDays || 90,
        passwordNeverExpires: user.passwordNeverExpires || false,
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        email: '',
        password: '',
        name: '',
        role: 'CASHIER',
        permissions: {},
        passwordExpirationDays: 90,
        passwordNeverExpires: false,
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...formData };
      if (!data.password) {
        delete data.password;
      }

      if (editingUser) {
        await userService.update(editingUser.id, data);
      } else {
        await userService.create(data);
      }

      setShowModal(false);
      loadUsers();
    } catch (error) {
      alert(error.response?.data?.message || error.response?.data?.error || 'Error al guardar usuario');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return;

    try {
      await userService.delete(id);
      loadUsers();
    } catch (error) {
      alert(error.response?.data?.message || error.response?.data?.error || 'Error al eliminar usuario');
    }
  };

  const handlePermissionChange = (key, checked) => {
    setFormData({
      ...formData,
      permissions: {
        ...formData.permissions,
        [key]: checked,
      },
    });
  };

  const getRoleLabel = (role) => {
    const roles = {
      ADMIN: 'Administrador',
      MANAGER: 'Gerente',
      CASHIER: 'Cajero',
      VIEWER: 'Visor',
    };
    return roles[role] || role;
  };

  if (loading) {
    return <div>Cargando...</div>;
  }

  return (
    <div>
      <div className="view-header">
        <div>
          <h1>Usuarios</h1>
          <p>Gestiona los usuarios del sistema</p>
        </div>
        {hasPermission('manage_users') && (
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            <i className="fas fa-plus"></i>
            Nuevo Usuario
          </button>
        )}
      </div>

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Permisos</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <div>
                    <strong>{user.name}</strong>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      @{user.username}
                    </div>
                  </div>
                </td>
                <td>{user.email}</td>
                <td>
                  <span className="badge badge-success">
                    {getRoleLabel(user.role)}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {user.role === 'ADMIN' ? (
                      <span className="badge badge-success">Todos</span>
                    ) : (
                      Object.entries(user.permissions || {})
                        .filter(([_, value]) => value === true)
                        .map(([key]) => {
                          const perm = AVAILABLE_PERMISSIONS.find(p => p.key === key);
                          return (
                            <span key={key} className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                              {perm?.label.split(' ')[0] || key}
                            </span>
                          );
                        })
                    )}
                  </div>
                </td>
                <td>
                  <span
                    className={`badge ${
                      user.active ? 'badge-success' : 'badge-danger'
                    }`}
                  >
                    {user.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <button
                    className="btn btn-outline"
                    onClick={() => handleOpenModal(user)}
                    style={{ marginRight: '8px', padding: '6px 12px' }}
                  >
                    <i className="fas fa-edit"></i>
                  </button>
                  {user.active && (
                    <button
                      className="btn btn-outline"
                      onClick={() => handleDelete(user.id)}
                      style={{
                        padding: '6px 12px',
                        color: 'var(--danger)',
                        borderColor: 'var(--danger)',
                      }}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination pagination={pagination} onPageChange={loadUsers} loading={loading} />

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h2>{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
                <div className="form-group">
                  <label>Usuario *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  className="form-control"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>{editingUser ? 'Nueva Contraseña' : 'Contraseña *'}</label>
                <input
                  type="password"
                  className="form-control"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required={!editingUser}
                  placeholder={editingUser ? 'Dejar en blanco para no cambiar' : ''}
                />
              </div>

              <div className="form-group">
                <label>Rol *</label>
                <select
                  className="form-control"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  required
                >
                  <option value="ADMIN">Administrador</option>
                  <option value="MANAGER">Gerente</option>
                  <option value="CASHIER">Cajero</option>
                  <option value="VIEWER">Visor</option>
                </select>
                {formData.role !== 'ADMIN' && (
                  <small style={{ color: 'var(--text-muted)' }}>
                    Los permisos personalizados solo aplican para roles diferentes a Administrador
                  </small>
                )}
              </div>

              <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '0.95rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fas fa-key" style={{ color: 'var(--primary)' }}></i>
                  Seguridad y Expiración (Tipo Active Directory)
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'center' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Días de duración de clave</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.passwordExpirationDays}
                      onChange={(e) => setFormData({ ...formData, passwordExpirationDays: e.target.value })}
                      disabled={formData.passwordNeverExpires}
                      min="1"
                      max="365"
                    />
                  </div>
                  
                  <div className="form-group" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '8px', marginTop: '20px' }}>
                    <input
                      type="checkbox"
                      id="passwordNeverExpires"
                      checked={formData.passwordNeverExpires}
                      onChange={(e) => setFormData({ ...formData, passwordNeverExpires: e.target.checked })}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <label htmlFor="passwordNeverExpires" style={{ marginBottom: 0, cursor: 'pointer' }}>La clave nunca expira</label>
                  </div>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '12px' }}>
                  <i className="fas fa-info-circle"></i> Al cambiar la contraseña, la fecha de expiración se reiniciará automáticamente.
                </p>
              </div>

              {formData.role !== 'ADMIN' && (
                <div className="form-group">
                  <label>Permisos Personalizados</label>
                  <div style={{ 
                    maxHeight: '300px', 
                    overflowY: 'auto',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '12px'
                  }}>
                    {AVAILABLE_PERMISSIONS.map((perm) => (
                      <div
                        key={perm.key}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          padding: '8px 0',
                          borderBottom: '1px solid var(--border-color)',
                        }}
                      >
                        <input
                          type="checkbox"
                          id={`perm-${perm.key}`}
                          checked={formData.permissions[perm.key] === true}
                          onChange={(e) => handlePermissionChange(perm.key, e.target.checked)}
                          style={{ marginRight: '12px', marginTop: '4px', width: '18px', height: '18px' }}
                        />
                        <div style={{ flex: 1 }}>
                          <label
                            htmlFor={`perm-${perm.key}`}
                            style={{ fontWeight: '500', cursor: 'pointer' }}
                          >
                            {perm.label}
                          </label>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {perm.description}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="submit" className="btn btn-primary">
                  {editingUser ? 'Actualizar' : 'Crear'}
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
    </div>
  );
};

export default Users;
