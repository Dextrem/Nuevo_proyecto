import { useState, useEffect } from 'react';
import { supplierService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import Pagination from '../components/Pagination';
import ConfirmModal from '../components/ConfirmModal';

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const { hasPermission, hasRole } = useAuth();
  const { showNotification } = useApp();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    rnc: '',
    address: '',
    contact: '',
  });

  useEffect(() => {
    loadSuppliers(1);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSuppliers(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadSuppliers = async (page = 1) => {
    try {
      // setLoading(true); // Evitar refresco de pantalla en búsqueda
      const response = await supplierService.getAll({ page, limit: pagination.limit, search: searchTerm });
      const data = response.data?.data || response.data;
      const paginationData = response.data?.pagination || { total: Array.isArray(data) ? data.length : 0 };
      setSuppliers(Array.isArray(data) ? data : []);
      setPagination(prev => ({ ...prev, ...paginationData, page }));
    } catch (error) {
      console.error('Error loading suppliers:', error);
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (supplier = null) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name,
        email: supplier.email || '',
        phone: supplier.phone || '',
        rnc: supplier.rnc || '',
        address: supplier.address || '',
        contact: supplier.contact || '',
      });
    } else {
      setEditingSupplier(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        rnc: '',
        address: '',
        contact: '',
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSupplier) {
        await supplierService.update(editingSupplier.id, formData);
      } else {
        await supplierService.create(formData);
      }
      setShowModal(false);
      loadSuppliers();
    } catch (error) {
      showNotification(error.response?.data?.error || 'Error al guardar proveedor', 'error');
    }
  };

  const handleDelete = (id) => {
    setConfirmDeleteId(id);
    setShowConfirmDelete(true);
  };

  const confirmDelete = async () => {
    try {
      await supplierService.delete(confirmDeleteId);
      loadSuppliers();
    } catch (error) {
      showNotification(error.response?.data?.error || 'Error al eliminar proveedor', 'error');
    } finally {
      setShowConfirmDelete(false);
      setConfirmDeleteId(null);
    }
  };

  const cancelDelete = () => {
    setShowConfirmDelete(false);
    setConfirmDeleteId(null);
  };

  const filteredSuppliers = suppliers.filter(
    (supplier) =>
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div>Cargando...</div>;
  }

  return (
    <div>
      <div className="view-header">
        <div>
          <h1>Proveedores</h1>
          <p>Gestiona tus proveedores</p>
        </div>
        {hasPermission('manage_suppliers') && (
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            <i className="fas fa-plus"></i>
            Nuevo Proveedor
          </button>
        )}
      </div>

      <div style={{ marginBottom: '24px' }}>
        <input
          type="text"
          className="form-control"
          placeholder="Buscar proveedor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ maxWidth: '300px' }}
        />
      </div>

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Contacto</th>
              <th>RNC</th>
              <th>Estado</th>
              {hasPermission('manage_suppliers') && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {filteredSuppliers.map((supplier) => (
              <tr key={supplier.id}>
                <td>
                  <strong>{supplier.name}</strong>
                  {supplier.contact && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Contacto: {supplier.contact}
                    </div>
                  )}
                </td>
                <td>
                  <div style={{ fontSize: '0.9rem' }}>
                    {supplier.email && <div>{supplier.email}</div>}
                    {supplier.phone && <div>{supplier.phone}</div>}
                  </div>
                </td>
                <td>{supplier.rnc || '-'}</td>
                <td>
                  <span
                    className={`badge ${
                      supplier.active ? 'badge-success' : 'badge-danger'
                    }`}
                  >
                    {supplier.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                {hasPermission('manage_suppliers') && (
                  <td>
                    <button
                      className="btn btn-outline"
                      onClick={() => handleOpenModal(supplier)}
                      style={{ marginRight: '8px', padding: '6px 12px' }}
                      title="Editar Proveedor"
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    {supplier.active && hasRole('ADMIN') && (
                      <button
                        className="btn btn-outline"
                        onClick={() => handleDelete(supplier.id)}
                        style={{
                          padding: '6px 12px',
                          color: 'var(--danger)',
                          borderColor: 'var(--danger)',
                        }}
                        title="Desactivar Proveedor"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination pagination={pagination} onPageChange={loadSuppliers} loading={loading} />

      {showModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h2>
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
                  <label>Persona de Contacto</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.contact}
                    onChange={(e) =>
                      setFormData({ ...formData, contact: e.target.value })
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
                <button type="submit" className="btn btn-primary">
                  {editingSupplier ? 'Actualizar' : 'Crear'}
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
        show={showConfirmDelete}
        title="Desactivar Proveedor"
        message="&iquest;Est&aacute;s seguro de desactivar este proveedor? No podr&aacute; gestionar facturas hasta que lo reactive."
        icon="fa-truck"
        iconColor="#EF4444"
        confirmText="S&iacute;, desactivar"
        confirmButtonClass="btn btn-primary"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
};

export default Suppliers;
