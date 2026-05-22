import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react';

const ProductGrid = memo(({ products, searchTerm, onSearch, onAddToCart, formatCurrency }) => {
  const filteredProducts = useMemo(() => products.filter(
    (product) =>
      product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
  ), [products, searchTerm]);

  const lowStockCount = filteredProducts.filter(p => p.stock <= (p.minStock || 0)).length;

  const handleKeyDown = (e, product) => {
    if (e.key === 'Enter') {
      onAddToCart(product);
    }
  };

  return (
    <div className="pos-products">
      <div style={{ marginBottom: '10px', position: 'relative' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '0 12px',
        }}>
          <i className="fas fa-search" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}></i>
          <input
            type="text"
            className="form-control"
            placeholder="Buscar producto por nombre, SKU o código..."
            value={searchTerm}
            onChange={(e) => onSearch(e.target.value)}
            autoComplete="off"
            style={{ 
              border: 'none', 
              padding: '10px 8px',
              fontSize: '0.85rem',
              boxShadow: 'none',
            }}
          />
          {searchTerm && (
            <button 
              onClick={() => onSearch('')}
              type="button"
              style={{ 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: '8px',
                touchAction: 'manipulation'
              }}
            >
              <i className="fas fa-times" style={{ fontSize: '0.8rem' }}></i>
            </button>
          )}
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <h3>No se encontraron productos</h3>
          <p>Intenta con otro término de búsqueda</p>
        </div>
      ) : (
        <>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '8px',
            padding: '6px 10px',
            background: 'rgba(79,70,229,0.05)',
            borderRadius: '6px',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
          }}>
            <span><i className="fas fa-box" style={{ marginRight: '4px' }}></i> {filteredProducts.length} productos</span>
            <span>Stock bajo: <strong style={{ color: lowStockCount > 0 ? 'var(--accent)' : 'inherit' }}>{lowStockCount}</strong></span>
          </div>
          <div className="product-list">
          {filteredProducts.map((product, index) => (
            <div
              key={product.id}
              className={`product-list-item ${product.stock === 0 ? 'out-of-stock' : product.stock <= product.minStock ? 'low-stock' : ''}`}
              onClick={() => product.stock > 0 && onAddToCart(product)}
              onPointerDown={() => { /* enable pointer capture responsiveness on touch devices */ }}
              onKeyDown={(e) => handleKeyDown(e, product)}
              tabIndex={0}
              role="button"
              aria-label={`Agregar ${product.name} al carrito`}
              style={{
                opacity: product.stock === 0 ? 0.5 : 1,
                cursor: product.stock === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ 
                  width: '56px', 
                  height: '56px', 
                  borderRadius: '8px', 
                  background: index % 2 === 0 ? 'rgba(79,70,229,0.1)' : 'rgba(16,185,129,0.1)',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: index % 2 === 0 ? 'var(--primary)' : 'var(--secondary)',
                  overflow: 'hidden'
                }}>
                  {product.imageUrl || product.image ? (
                    <img src={product.imageUrl || product.image} alt={product.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  ) : (
                    <i className="fas fa-box" style={{ fontSize: '1.2rem' }}></i>
                  )}
                </div>
                    <div className="info">
                  <div className="name">{product.name}</div>
                  <div className="sku">{product.sku}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="stock" style={{ 
                  color: product.stock === 0 ? 'var(--danger)' : product.stock <= product.minStock ? 'var(--accent)' : 'var(--text-muted)',
                  fontWeight: product.stock <= product.minStock ? 600 : 400,
                }}>
                  {product.stock === 0 ? 'Sin stock' : `Stock: ${product.stock}`}
                </div>
                <div className="price">{formatCurrency(product.price)}</div>
              </div>
            </div>
          ))}
          </div>
        </>
      )}
    </div>
  );
});

ProductGrid.displayName = 'ProductGrid';

const CartItem = memo(({ item, onUpdateQuantity, onRemove, formatCurrency }) => (
  <div className="cart-item">
    <div style={{ 
      width: '32px', 
      height: '32px', 
      borderRadius: '4px', 
      overflow: 'hidden', 
      backgroundColor: 'var(--bg-surface-hover)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: '10px',
      flexShrink: 0,
      border: '1px solid var(--border-color)'
    }}>
      {item.product.imageUrl ? (
        <img src={item.product.imageUrl} alt={item.product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <i className="fas fa-box" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}></i>
      )}
    </div>
    <div className="item-info">
      <div className="item-name">{item.product.name}</div>
      <div className="item-price">{formatCurrency(item.price)} c/u</div>
    </div>
      <div className="item-quantity">
      <button
        className="qty-btn"
        onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
        aria-label="Disminuir cantidad"
        type="button"
        style={{ touchAction: 'manipulation', padding: '8px 10px' }}
      >
        <i className="fas fa-minus" style={{ fontSize: '0.7rem' }}></i>
      </button>
      <span className="qty-value">{item.quantity}</span>
      <button
        className="qty-btn"
        onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
        aria-label="Aumentar cantidad"
        type="button"
        style={{ touchAction: 'manipulation', padding: '8px 10px' }}
      >
        <i className="fas fa-plus" style={{ fontSize: '0.7rem' }}></i>
      </button>
    </div>
    <div className="item-total">
      {formatCurrency(item.price * item.quantity)}
    </div>
    <button
      className="remove-btn"
      onClick={() => onRemove(item.product.id)}
      aria-label="Eliminar producto"
      type="button"
      style={{ touchAction: 'manipulation', padding: '8px' }}
    >
      <i className="fas fa-times"></i>
    </button>
  </div>
));

CartItem.displayName = 'CartItem';

const Cart = memo(({ cart, onUpdateQuantity, onRemove, formatCurrency }) => (
  <div className="cart-list-inner">
    {cart.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
        <div style={{ 
          width: '60px', 
          height: '60px', 
          borderRadius: '50%', 
          background: 'rgba(79,70,229,0.1)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <i className="fas fa-shopping-cart" style={{ fontSize: '1.5rem', color: 'var(--primary)' }}></i>
        </div>
        <p style={{ fontWeight: 500 }}>Carrito vacío</p>
        <p style={{ fontSize: '0.8rem' }}>Haz clic en los productos para agregarlos</p>
      </div>
    ) : (
      <>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          padding: '8px 0', 
          borderBottom: '2px solid var(--primary)',
          marginBottom: '8px',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          <span style={{ flex: 1 }}>Producto</span>
          <span style={{ width: '70px', textAlign: 'center' }}>Cant</span>
          <span style={{ width: '70px', textAlign: 'right' }}>Total</span>
          <span style={{ width: '30px' }}></span>
        </div>
        {cart.map((item) => (
          <CartItem
            key={item.product.id}
            item={item}
            onUpdateQuantity={onUpdateQuantity}
            onRemove={onRemove}
            formatCurrency={formatCurrency}
          />
        ))}
      </>
    )}
  </div>
));

Cart.displayName = 'Cart';

const ClientDropdown = memo(({ clients, selectedClient, onSelect, onNewClient, formatCurrency }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      const target = e.target || (e.touches && e.touches[0] && e.touches[0].target);
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener('pointerdown', handleClickOutside);
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('pointerdown', handleClickOutside);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showDropdown]);

  return (
    <div style={{ marginTop: '10px', border: selectedClient ? '2px solid var(--primary)' : '1px solid var(--border-color)', padding: '10px', borderRadius: '6px' }}>
      <div ref={dropdownRef} style={{ display: 'flex', gap: '6px', marginBottom: '6px', position: 'relative' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            style={{
              width: '100%',
              padding: '6px 10px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.85rem',
            }}
          >
            <span>{selectedClient?.name || '-- Cliente --'}</span>
            <i className={`fas fa-chevron-${showDropdown ? 'up' : 'down'}`} style={{ fontSize: '0.7rem' }}></i>
          </button>

          {showDropdown && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                marginTop: '2px',
                maxHeight: '150px',
                overflowY: 'auto',
                zIndex: 1000,
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              {clients.length === 0 ? (
                <div style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No hay clientes
                </div>
              ) : (
                clients.map((client) => (
                  <div
                    key={client.id}
                    onClick={() => {
                      onSelect(client);
                      setShowDropdown(false);
                    }}
                    style={{
                      padding: '8px 10px',
                      cursor: 'pointer',
                      backgroundColor: selectedClient?.id === client.id ? 'var(--primary)' : 'transparent',
                      color: selectedClient?.id === client.id ? '#fff' : 'inherit',
                      borderBottom: '1px solid var(--border-color)',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>{client.name}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <button
          className="btn btn-outline"
          onClick={onNewClient}
          title="Agregar cliente"
          style={{ padding: '6px 10px', fontSize: '0.8rem' }}
        >
          <i className="fas fa-user-plus"></i>
        </button>
      </div>
      {selectedClient && (
        <ClientCreditInfo selectedClient={selectedClient} formatCurrency={formatCurrency} />
      )}
    </div>
  );
});

ClientDropdown.displayName = 'ClientDropdown';

const ClientCreditInfo = memo(({ selectedClient, formatCurrency }) => {
  if (!selectedClient) return null;
  
  const creditLimit = selectedClient.creditLimit || 0;
  const balance = selectedClient.balance || 0;
  const available = Math.max(0, creditLimit - balance);
  
  return (
    <div style={{
      marginTop: '8px',
      padding: '8px 12px',
      backgroundColor: 'rgba(79, 70, 229, 0.1)',
      borderRadius: '6px',
      fontSize: '0.85rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span>Límite de Crédito:</span>
        <strong>{formatCurrency(creditLimit)}</strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span>En Uso:</span>
        <strong style={{ color: balance > creditLimit * 0.8 ? 'var(--danger)' : 'inherit' }}>
          {formatCurrency(balance)}
        </strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', paddingTop: '4px' }}>
        <span>Disponible:</span>
        <strong style={{ color: 'var(--secondary)' }}>
          {formatCurrency(available)}
        </strong>
      </div>
    </div>
  );
});

ClientCreditInfo.displayName = 'ClientCreditInfo';

const PaymentMethods = memo(({ value, onChange }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginTop: '10px', marginBottom: '10px' }}>
    {[
      { key: 'CASH', icon: 'money-bill-wave', label: 'Efectivo', color: '#10B981', gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' },
      { key: 'CARD', icon: 'credit-card', label: 'Tarjeta', color: '#3B82F6', gradient: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' },
      { key: 'CREDIT', icon: 'hand-holding-usd', label: 'Crédito', color: '#F59E0B', gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' },
      { key: 'TRANSFER', icon: 'university', label: 'Transf.', color: '#8B5CF6', gradient: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)' },
    ].map(({ key, icon, label, color, gradient }) => (
      <button
        key={key}
        onClick={() => onChange(key)}
        type="button"
        style={{ 
          padding: '6px 4px', 
          fontSize: '0.8rem',
          border: value === key ? 'none' : `1px solid ${color}40`,
          borderRadius: '8px',
          background: value === key ? gradient : 'var(--bg-surface)',
          color: value === key ? '#FFF' : color,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          boxShadow: value === key ? `0 2px 8px ${color}30` : 'none',
          minHeight: '40px',
          touchAction: 'manipulation',
        }}
      >
        <i className={`fas fa-${icon}`} style={{ fontSize: '0.9rem' }}></i>
        {label}
      </button>
    ))}
  </div>
));

PaymentMethods.displayName = 'PaymentMethods';

export { ProductGrid, Cart, ClientDropdown, PaymentMethods, ClientCreditInfo };
