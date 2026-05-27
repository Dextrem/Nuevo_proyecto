import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { productService, clientService, saleService, cashRegisterService } from '../services/api';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { ProductGrid, Cart, ClientDropdown, PaymentMethods } from '../components/POSComponents';
import { ReceiptModal, NewClientModal, DueDateModal } from '../components/POSModals';
import { notifyDataUpdate } from '../hooks/useDataSync';

const BarcodeScanner = memo(({ inputRef, value, onChange, onScan, showVisible }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && value.length >= 3) {
        onScan(value);
        if (inputRef.current) {
          inputRef.current.value = '';
        }
        onChange('');
      }
    };

    const handleInput = () => {
      if (inputRef.current && inputRef.current.value.length >= 3) {
        if (inputRef.current.value.endsWith('\n') || inputRef.current.value.endsWith('\r')) {
          const cleanBarcode = inputRef.current.value.replace(/[\n\r]/g, '');
          onScan(cleanBarcode);
          inputRef.current.value = '';
          onChange('');
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [value, onScan, onChange, inputRef]);

  return (
    showVisible ? (
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Ingresar código / lector</label>
        <input
          type="text"
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="form-control"
          placeholder="Escanea o escribe código aquí..."
          inputMode="numeric"
        />
      </div>
    ) : (
      <input
        type="text"
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ position: 'fixed', opacity: 0, height: 1, width: 1, top: 0, left: 0, zIndex: -1 }}
        aria-hidden="true"
        autoFocus
      />
    )
  );
});

BarcodeScanner.displayName = 'BarcodeScanner';

const ScanFeedback = memo(({ show, productName }) => {
  if (!show) return null;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        background: 'rgba(16,185,129,0.1)',
        borderRadius: '8px',
        border: '1px solid var(--secondary)',
        transition: 'all 0.3s',
      }}
    >
      <i className="fas fa-barcode" style={{ color: 'var(--secondary)' }}></i>
      <span style={{ fontSize: '0.85rem', color: 'var(--secondary)' }}>
        ✓ {productName}
      </span>
    </div>
  );
});

ScanFeedback.displayName = 'ScanFeedback';

const CartSummary = memo(({ cart, paymentMethod, selectedClient, paidAmount, setPaidAmount, discountPercent, setDiscountPercent, subtotal, totalTax, discountAmount, total, onProcessSale, formatCurrency, settings, isProcessing }) => {
  const handlePaidAmountChange = (value) => {
    const numValue = parseFloat(value) || 0;
    if (numValue <= total) {
      setPaidAmount(value);
    } else {
      setPaidAmount(total.toString());
    }
  };

  return (
    <div className="cart-summary">
      {paymentMethod === 'CREDIT' && selectedClient && (
        <div className="form-group">
          <label>
            Monto a Cuenta
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {' '}(máx: {formatCurrency(Math.max(0, selectedClient.creditLimit - selectedClient.balance))})
            </span>
          </label>
          <input
            type="number"
            className="form-control"
            value={paidAmount}
            onChange={(e) => handlePaidAmountChange(e.target.value)}
            placeholder="0.00"
            min="0"
            max={total}
            step="0.01"
          />
          <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            El monto no puede exceder el crédito disponible del cliente
          </small>
        </div>
      )}

      {paymentMethod === 'CASH' && (
        <div className="form-group">
          <label>Efectivo recibido</label>
          <input
            type="number"
            className="form-control"
            value={paidAmount}
            onChange={(e) => setPaidAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
          />
          <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            Ingresa el efectivo recibido para calcular el cambio
          </small>
        </div>
      )}

      <div className="summary-line">
        <span>Subtotal</span>
        <span>{formatCurrency(subtotal)}</span>
      </div>
      <div className="summary-line">
        <span>ITBIS ({settings.taxRate * 100}%)</span>
        <span>{formatCurrency(totalTax)}</span>
      </div>
      <div className="form-group" style={{ marginBottom: '12px' }}>
        <label>Descuento (%)</label>
        <input
          type="number"
          className="form-control"
          value={discountPercent}
          onChange={(e) => setDiscountPercent(e.target.value)}
          placeholder="0"
          min="0"
          max="100"
          step="1"
        />
      </div>
      {discountAmount > 0 && (
        <div className="summary-line" style={{ color: 'var(--danger)' }}>
          <span>Descuento ({discountPercent}%)</span>
          <span>-{formatCurrency(discountAmount)}</span>
        </div>
      )}
      <div className="summary-line total">
        <span>Total</span>
        <span>{formatCurrency(total)}</span>
      </div>

      {paymentMethod === 'CREDIT' && paidAmount > 0 && (
        <div className="summary-line" style={{ color: 'var(--secondary)', fontWeight: '600' }}>
          <span>Pendiente</span>
          <span>{formatCurrency(Math.max(0, total - parseFloat(paidAmount || 0)))}</span>
        </div>
      )}

      <button
        className="btn btn-primary btn-block"
        onClick={onProcessSale}
        disabled={cart.length === 0 || isProcessing}
        style={{ marginTop: '20px' }}
      >
        <i className={isProcessing ? 'fas fa-spinner fa-spin' : 'fas fa-check'}></i>
        {isProcessing ? ' Procesando...' : ' Procesar Venta'}
      </button>
    </div>
  );
});

CartSummary.displayName = 'CartSummary';

const POS = () => {
  const [products, setProducts] = useState([]);
  const [clients, setClients] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paidAmount, setPaidAmount] = useState('');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [printType, setPrintType] = useState('thermal-80');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [lastScannedProduct, setLastScannedProduct] = useState(null);
  const [showScanFeedback, setShowScanFeedback] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [verificationRnc, setVerificationRnc] = useState('');
  const [newClientData, setNewClientData] = useState({
    name: '',
    rnc: '',
    email: '',
    phone: '',
    address: '',
    creditLimit: '5000',
  });
  const [dueDate, setDueDate] = useState('');

  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [showDueDateModal, setShowDueDateModal] = useState(false);
  const [showCashConfirm, setShowCashConfirm] = useState(false);
  const [pendingSaleData, setPendingSaleData] = useState(null);
  const [cashChange, setCashChange] = useState(0);
  const [currentCashRegister, setCurrentCashRegister] = useState(null);

  const barcodeInputRef = useRef(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const { formatCurrency, settings, showNotification } = useApp();
  const posContainerRef = useRef(null);

  const loadCashRegister = useCallback(async () => {
    try {
      const response = await cashRegisterService.getCurrent();
      const data = response.data?.data || response.data;
      setCurrentCashRegister(data);
    } catch (error) {
      console.error('Error loading cash register:', error);
      setCurrentCashRegister(null);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [productsRes, clientsRes] = await Promise.all([
        productService.getAll({ active: true, limit: -1 }),
        clientService.getAll({ active: true }),
      ]);
      
      let productsList = Array.isArray(productsRes.data) 
        ? productsRes.data 
        : productsRes.data?.data || [];
      
      let clientsList = Array.isArray(clientsRes.data) 
        ? clientsRes.data 
        : clientsRes.data?.data || [];
      
      setProducts(productsList);
      setClients(clientsList);
      await loadCashRegister();
    } catch (error) {
      console.error('Error loading data:', error);
      showNotification('Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification, loadCashRegister]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (paymentMethod === 'CREDIT' && !dueDate) {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      setDueDate(nextMonth.toISOString().split('T')[0]);
    } else if (paymentMethod !== 'CREDIT') {
      setDueDate('');
    }
  }, [paymentMethod, dueDate]);

  useEffect(() => {
    try {
      const touch = ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
      setIsTouchDevice(!!touch);
    } catch (e) {
      setIsTouchDevice(false);
    }
  }, []);

  // Re-focus hidden barcode input when clicking anywhere in POS (except other inputs)
  const handlePosClick = useCallback((e) => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (barcodeInputRef.current && !isTouchDevice) {
      barcodeInputRef.current.focus();
    }
  }, [isTouchDevice]);

  useEffect(() => {
    if (isTouchDevice) return;
    const el = barcodeInputRef.current;
    if (!el) return;
    const onBlur = () => {
      setTimeout(() => {
        if (document.activeElement && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA' && document.activeElement.tagName !== 'SELECT') {
          el.focus();
        }
      }, 100);
    };
    el.addEventListener('blur', onBlur);
    return () => el.removeEventListener('blur', onBlur);
  }, [isTouchDevice]);

  const addToCart = useCallback((product) => {
    if (!product || product.stock <= 0) {
      if (product) showNotification(`Producto sin stock: ${product.name}`, 'error');
      return;
    }

    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.product.id === product.id);

      if (existingItem) {
        const newQuantity = Math.min(existingItem.quantity + 1, product.stock);
        return prevCart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: newQuantity }
            : item
        );
      }

      return [
        ...prevCart,
        {
          product,
          quantity: 1,
          price: product.price,
          tax: product.price * settings.taxRate,
        },
      ];
    });
  }, [settings.taxRate]);

  const handleBarcodeScan = useCallback((barcode) => {
    if (!barcode || barcode.length < 3) return;

    const trimmedBarcode = barcode.trim();
    const product = products.find(p => 
      (p.barcode?.trim() === trimmedBarcode) ||
      (p.sku?.toLowerCase().trim() === trimmedBarcode.toLowerCase())
    );

    if (product) {
      setLastScannedProduct(product);
      setShowScanFeedback(true);
      setTimeout(() => setShowScanFeedback(false), 1500);
      addToCart(product);
    } else {
      showNotification(`Producto no encontrado: ${trimmedBarcode}`, 'error');
    }
  }, [products, addToCart, showNotification]);

  // ensure visible barcode input triggers scan on Enter for touch
  useEffect(() => {
    const el = barcodeInputRef.current;
    if (!el) return;
    const onKey = (e) => {
      if (e.key === 'Enter' && el.value && el.value.length >= 3) {
        handleBarcodeScan(el.value.trim());
        el.value = '';
        setBarcodeInput('');
      }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [barcodeInputRef, handleBarcodeScan]);

  const updateQuantity = useCallback((productId, newQuantity) => {
    if (newQuantity <= 0) {
      setCart((prev) => prev.filter((item) => item.product.id !== productId));
    } else {
      setCart((prev) =>
        prev.map((item) =>
          item.product.id === productId ? { ...item, quantity: newQuantity } : item
        )
      );
    }
  }, []);

  const removeFromCart = useCallback((productId) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  }, []);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalTax = cart.reduce((sum, item) => sum + item.tax * item.quantity, 0);
  const discountPercentValue = parseFloat(discountPercent) || 0;
  const discountAmount = (subtotal * discountPercentValue) / 100;
  const total = subtotal + totalTax - discountAmount;

  const submitSale = useCallback(async (saleData) => {
    setIsProcessingSale(true);
    try {
      const response = await saleService.create(saleData);
      setLastSale(response.data.sale);
      setShowReceiptModal(true);
      setCart([]);
      setPaidAmount('');
      setDiscountPercent('0');
      setSelectedClient(null);
      setVerificationRnc('');
      setDueDate('');
      setPendingSaleData(null);
      setShowCashConfirm(false);
      loadData();
      notifyDataUpdate('sales');
      showNotification('Venta procesada exitosamente', 'success');
    } catch (error) {
      showNotification(error.response?.data?.error || 'Error al procesar venta', 'error');
    } finally {
      setIsProcessingSale(false);
    }
  }, [loadData, notifyDataUpdate, showNotification]);

  const handleProcessSale = useCallback(async () => {
    if (isProcessingSale) return;
    if (cart.length === 0) {
      showNotification('Agrega productos al carrito', 'error');
      return;
    }

    setIsProcessingSale(true);
    const paidAmountValue = parseFloat(paidAmount) || 0;

    if (paymentMethod === 'CREDIT') {
      if (!selectedClient) {
        showNotification('Selecciona un cliente para venta a crédito', 'error');
        setIsProcessingSale(false);
        return;
      }

      if (!verificationRnc) {
        showNotification('Debes ingresar la Cédula/RNC del cliente para validar el crédito', 'error');
        setIsProcessingSale(false);
        return;
      }

      const clientRnc = selectedClient.rnc?.replace(/[^0-9]/g, '') || '';
      const inputRnc = verificationRnc.replace(/[^0-9]/g, '');

      if (clientRnc !== inputRnc) {
        showNotification('La Cédula/RNC no coincide con el cliente seleccionado', 'error');
        setIsProcessingSale(false);
        return;
      }

      if (!dueDate) {
        showNotification('Selecciona la fecha de pago para venta a crédito', 'error');
        setIsProcessingSale(false);
        return;
      }

      const availableCredit = Math.max(0, selectedClient.creditLimit - (selectedClient.balance || 0));
      const creditToUse = total - paidAmountValue;
      
      if (creditToUse > availableCredit) {
        showNotification(`Límite de crédito excedido. El cliente necesita abonar al menos ${formatCurrency(total - availableCredit)}`, 'error');
        setIsProcessingSale(false);
        return;
      }
    }

    const saleData = {
      clientId: selectedClient?.id || null,
      paymentMethod,
      paidAmount: paymentMethod === 'CREDIT' ? paidAmountValue : total,
      discount: discountAmount,
      dueDate: paymentMethod === 'CREDIT' ? dueDate : null,
      items: cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        price: item.price,
        tax: item.tax,
        total: item.price * item.quantity + item.tax * item.quantity,
      })),
    };

    // For CASH payments, require entering efectivo recibido and show confirmation with change
    if (paymentMethod === 'CASH') {
      const cashReceived = parseFloat(paidAmount) || 0;
      if (cashReceived < total) {
        showNotification('Efectivo recibido insuficiente', 'error');
        setIsProcessingSale(false);
        return;
      }

      const change = +(cashReceived - total).toFixed(2);
      // set pending data and show confirmation overlay
      saleData.paidAmount = cashReceived;
      setPendingSaleData(saleData);
      setCashChange(change);
      setShowCashConfirm(true);
      setIsProcessingSale(false);
      return;
    }

    // Other payment methods: proceed directly
    await submitSale(saleData);
  }, [cart, paymentMethod, selectedClient, paidAmount, dueDate, verificationRnc, total, discountAmount, loadData, showNotification, isProcessingSale, submitSale]);

  const printReceipt = useCallback(() => {
    const printContent = document.getElementById('receipt-preview')?.innerHTML;
    if (!printContent) {
      window.print();
      return;
    }

    const getStyles = () => {
      switch (printType) {
        case 'thermal-80':
          return `<style>
            body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 0; }
            .thermal-80 { max-width: 72mm; margin: 0 auto; padding: 3mm; box-sizing: border-box; }
            .center { text-align: center; }
            @page { size: 80mm auto; margin: 3mm; }
          </style>`;
        case 'thermal-58':
          return `<style>
            body { font-family: 'Courier New', monospace; font-size: 10px; margin: 0; padding: 0; }
            .thermal-58 { max-width: 50mm; margin: 0 auto; padding: 2mm; box-sizing: border-box; }
            .center { text-align: center; }
            @page { size: 58mm auto; margin: 3mm; }
          </style>`;
        case 'letter':
          return `<style>
            body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
            .letter { max-width: 800px; margin: 0 auto; }
            .center { text-align: center; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 8px; border: 1px solid #ddd; text-align: left; }
            @page { size: letter; margin: 0.5in; }
          </style>`;
        default:
          return `<style>
            body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
            .a4 { max-width: 100%; }
            .center { text-align: center; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 8px; border: 1px solid #ddd; text-align: left; }
            @page { size: A4; margin: 10mm; }
          </style>`;
      }
    };

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Imprimiendo...</title>
          ${getStyles()}
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);
    iframeDoc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 500);
  }, [printType]);

  const handleAddNewClient = useCallback(async () => {
    if (!newClientData.name.trim() || !newClientData.rnc.trim() || !newClientData.phone.trim() || !newClientData.address.trim()) {
      showNotification('Por favor completa todos los campos obligatorios (*)', 'error');
      return;
    }

    try {
      const response = await clientService.create({
        name: newClientData.name.trim(),
        rnc: newClientData.rnc.trim(),
        email: newClientData.email.trim() || '',
        phone: newClientData.phone.trim() || '',
        address: newClientData.address.trim(),
        creditLimit: parseFloat(newClientData.creditLimit) || 5000,
      });

      const newClient = {
        id: response.data.client?.id || response.data.id,
        name: response.data.client?.name || response.data.name || 'Sin nombre',
        rnc: response.data.client?.rnc || response.data.rnc || '',
        email: response.data.client?.email || response.data.email || '',
        phone: response.data.client?.phone || response.data.phone || '',
        address: response.data.client?.address || response.data.address || '',
        balance: 0,
        creditLimit: parseFloat(newClientData.creditLimit) || 5000,
        active: true,
      };
      
      setClients((prev) => [...prev, newClient]);
      setSelectedClient(newClient);
      setVerificationRnc(newClient.rnc); // Auto-validar para el nuevo cliente
      setShowNewClientModal(false);
      setNewClientData({ name: '', rnc: '', email: '', phone: '', address: '', creditLimit: '5000' });
      showNotification('Cliente creado exitosamente', 'success');
    } catch (error) {
      showNotification(error.response?.data?.error || 'Error al crear cliente', 'error');
    }
  }, [newClientData, showNotification]);

  if (loading) {
    return (
      <div className="loading-fallback">
        <div className="spinner"></div>
        <p>Cargando punto de venta...</p>
      </div>
    );
  }

  if (!currentCashRegister) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '60px 20px',
        background: 'var(--card-bg)',
        borderRadius: '16px',
        margin: '40px auto',
        maxWidth: '600px',
        boxShadow: 'var(--shadow-lg)',
        textAlign: 'center'
      }}>
        <div style={{ 
          width: '80px', 
          height: '80px', 
          background: 'rgba(239, 68, 68, 0.1)', 
          borderRadius: '50%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          marginBottom: '24px' 
        }}>
          <i className="fas fa-cash-register" style={{ fontSize: '2.5rem', color: 'var(--danger)' }}></i>
        </div>
        <h2 style={{ marginBottom: '16px' }}>Caja Cerrada</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '32px', lineHeight: '1.6' }}>
          Para poder realizar ventas debes de abrir una caja primero. Por favor, ve a la sección de Caja y realiza la apertura correspondiente.
        </p>
        <button 
          className="btn btn-primary" 
          onClick={() => window.location.href = '/cash-register'}
          style={{ padding: '12px 32px', fontSize: '1rem' }}
        >
          Ir a Apertura de Caja
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="view-header">
        <div>
          <h1>Punto de Venta</h1>
          <p>Procesa tus ventas</p>
        </div>
        <ScanFeedback show={showScanFeedback} productName={lastScannedProduct?.name} />
      </div>

      <BarcodeScanner
        inputRef={barcodeInputRef}
        value={barcodeInput}
        onChange={setBarcodeInput}
        onScan={handleBarcodeScan}
        showVisible={isTouchDevice}
      />

      <div className="pos-container" ref={posContainerRef} onClick={handlePosClick}>
        <ProductGrid
          products={products}
          searchTerm={searchTerm}
          onSearch={setSearchTerm}
          onAddToCart={addToCart}
          formatCurrency={formatCurrency}
        />

        <div className="pos-cart">
          <div className="cart-header">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <h3>Carrito de Compras</h3>
              <span className="badge badge-success">{cart.length} items</span>
            </div>

            <PaymentMethods value={paymentMethod} onChange={setPaymentMethod} />

            <ClientDropdown
              clients={clients}
              selectedClient={selectedClient}
              onSelect={setSelectedClient}
              onNewClient={() => setShowNewClientModal(true)}
              formatCurrency={formatCurrency}
            />

            {paymentMethod === 'CREDIT' && selectedClient && (
              <>
                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    Validar Cédula / RNC *
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ingrese documento del cliente..."
                    value={verificationRnc}
                    onChange={(e) => setVerificationRnc(e.target.value)}
                    style={{ 
                      borderColor: verificationRnc && selectedClient.rnc && verificationRnc.replace(/[^0-9]/g, '') === selectedClient.rnc.replace(/[^0-9]/g, '') 
                        ? 'var(--secondary)' 
                        : verificationRnc ? 'var(--danger)' : 'var(--border-color)' 
                    }}
                  />
                  {verificationRnc && selectedClient.rnc && verificationRnc.replace(/[^0-9]/g, '') === selectedClient.rnc.replace(/[^0-9]/g, '') && (
                    <small style={{ color: 'var(--secondary)', display: 'block', marginTop: '4px' }}>
                      <i className="fas fa-check-circle"></i> Documento verificado
                    </small>
                  )}
                </div>

                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                     Fecha de Pago
                  </label>
                  <button 
                    type="button"
                    className="btn btn-outline btn-block"
                    onClick={() => setShowDueDateModal(true)}
                    style={{ justifyContent: 'space-between', padding: '12px' }}
                  >
                    <span>
                      <i className="fas fa-calendar-alt" style={{ marginRight: '8px', color: 'var(--warning)' }}></i>
                      {dueDate ? new Date(dueDate + 'T00:00:00').toLocaleDateString() : 'Seleccionar fecha...'}
                    </span>
                    <i className="fas fa-edit"></i>
                  </button>
                </div>
              </>
            )}
          </div>

          <Cart
            cart={cart}
            onUpdateQuantity={updateQuantity}
            onRemove={removeFromCart}
            formatCurrency={formatCurrency}
          />

          <CartSummary
            cart={cart}
            paymentMethod={paymentMethod}
            selectedClient={selectedClient}
            paidAmount={paidAmount}
            setPaidAmount={setPaidAmount}
            discountPercent={discountPercent}
            setDiscountPercent={setDiscountPercent}
            subtotal={subtotal}
            totalTax={totalTax}
            discountAmount={discountAmount}
            total={total}
            onProcessSale={handleProcessSale}
            formatCurrency={formatCurrency}
            settings={settings}
            isProcessing={isProcessingSale}
          />
        </div>
      </div>

      {showReceiptModal && lastSale && (
        <ReceiptModal
          sale={lastSale}
          settings={settings}
          printType={printType}
          onPrintTypeChange={setPrintType}
          onPrint={printReceipt}
          onClose={() => setShowReceiptModal(false)}
          formatCurrency={formatCurrency}
        />
      )}

      {showCashConfirm && pendingSaleData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 720, width: '90%', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', textAlign: 'center', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ background: '#ECFDF5', borderRadius: 8, padding: '18px 24px', marginBottom: 16, border: '1px solid #10B981' }}>
              <h2 style={{ margin: 0, color: '#065F46', fontSize: '2.6rem' }}>{formatCurrency(cashChange)}</h2>
              <div style={{ color: '#065F46', fontWeight: 600 }}>Cambio a devolver</div>
            </div>

            <div style={{ textAlign: 'left', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <strong>Total:</strong>
                <span>{formatCurrency(pendingSaleData.items.reduce((s, it) => s + it.total, 0) + pendingSaleData.discount * 0 + 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <strong>Efectivo recibido:</strong>
                <span>{formatCurrency(pendingSaleData.paidAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <strong>Cambio:</strong>
                <span>{formatCurrency(cashChange)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 18 }}>
              <button className="btn btn-primary" onClick={() => submitSale(pendingSaleData)} disabled={isProcessingSale}>
                {isProcessingSale ? 'Procesando...' : 'Confirmar y Guardar e Imprimir'}
              </button>
              <button className="btn btn-outline" onClick={() => setShowCashConfirm(false)} disabled={isProcessingSale}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <NewClientModal
        isOpen={showNewClientModal}
        onClose={() => setShowNewClientModal(false)}
        onSubmit={handleAddNewClient}
        newClientData={newClientData}
        setNewClientData={setNewClientData}
      />

      <DueDateModal
        isOpen={showDueDateModal}
        onClose={() => setShowDueDateModal(false)}
        dueDate={dueDate}
        setDueDate={setDueDate}
        total={total}
        formatCurrency={formatCurrency}
      />
    </div>
  );
};

export default POS;
