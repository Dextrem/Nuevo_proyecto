import { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { productService, clientService, saleService, cashRegisterService } from '../services/api';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Cart, ClientDropdown, PaymentMethods } from '../components/POSComponents';
import { ReceiptModal, NewClientModal } from '../components/POSModals';
import { notifyDataUpdate } from '../hooks/useDataSync';

const BarcodeScanner = memo(({ inputRef, value, onChange, onScan }) => {
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

  useEffect(() => {
    const el = inputRef.current;
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
  }, [inputRef]);

  return (
    <input
      type="text"
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ position: 'fixed', opacity: 0, height: 1, width: 1, top: 0, left: 0, zIndex: -1 }}
      autoFocus
    />
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
        padding: '12px 20px',
        background: 'rgba(16,185,129,0.15)',
        borderRadius: '12px',
        border: '2px solid #10B981',
        animation: 'slideIn 0.3s ease-out',
      }}
    >
      <i className="fas fa-check-circle" style={{ color: '#10B981', fontSize: '1.2rem' }}></i>
      <span style={{ fontSize: '1rem', color: '#10B981', fontWeight: 600 }}>
        ✓ {productName}
      </span>
    </div>
  );
});

ScanFeedback.displayName = 'ScanFeedback';

const CartSummary = memo(({ cart, paymentMethod, selectedClient, paidAmount, setPaidAmount, discountPercent, setDiscountPercent, shippingCost, setShippingCost, subtotal, totalTax, discountAmount, total, onProcessSale, formatCurrency, settings, isProcessing }) => {
  const availableCredit = useMemo(() => {
    if (!selectedClient) return 0;
    const balance = selectedClient.balance ?? selectedClient.currentBalance ?? 0;
    return Math.max(0, (selectedClient.creditLimit || 0) - balance);
  }, [selectedClient?.creditLimit, selectedClient?.balance, selectedClient?.currentBalance]);

  const handlePaidAmountChange = (value) => {
    const numValue = parseFloat(value) || 0;
    if (numValue <= total) {
      setPaidAmount(value);
    } else {
      setPaidAmount(total.toString());
    }
  };

  return (
    <div className="cart-summary" style={{ padding: '20px' }}>
      {paymentMethod === 'CREDIT' && selectedClient && (
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '0.9rem', color: '#6B7280', display: 'block', marginBottom: '6px' }}>
            Monto a Cuenta
            <span style={{ color: '#10B981' }}> (Disponible: {formatCurrency(availableCredit)})</span>
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
            style={{ padding: '12px', fontSize: '1rem', borderRadius: '8px' }}
          />
        </div>
      )}

      <div style={{ background: 'rgba(79,70,229,0.05)', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
        <div className="summary-line" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ color: '#6B7280' }}>Subtotal</span>
          <span style={{ fontWeight: 600 }}>{formatCurrency(subtotal)}</span>
        </div>
        <div className="summary-line" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#6B7280' }}>ITBIS ({settings.taxRate * 100}%)</span>
          <span style={{ fontWeight: 600 }}>{formatCurrency(totalTax)}</span>
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '0.85rem', color: '#6B7280', display: 'block', marginBottom: '6px' }}>Descuento %</label>
        <input
          type="number"
          className="form-control"
          value={discountPercent}
          onChange={(e) => setDiscountPercent(e.target.value)}
          placeholder="0"
          min="0"
          max="100"
          step="1"
          style={{ padding: '10px', fontSize: '0.95rem', borderRadius: '8px' }}
        />
      </div>
      {discountAmount > 0 && (
        <div className="summary-line" style={{ display: 'flex', justifyContent: 'space-between', color: '#EF4444', marginBottom: '12px' }}>
          <span>Descuento ({discountPercent}%)</span>
          <span>-{formatCurrency(discountAmount)}</span>
        </div>
      )}
      <div className="form-group" style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '0.85rem', color: '#6B7280', display: 'block', marginBottom: '6px' }}>Envío</label>
        <input
          type="number"
          className="form-control"
          value={shippingCost}
          onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
          placeholder="0.00"
          min="0"
          step="0.01"
          style={{ padding: '10px', fontSize: '0.95rem', borderRadius: '8px' }}
        />
      </div>
      {shippingCost > 0 && (
        <div className="summary-line" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--info)', marginBottom: '12px' }}>
          <span>Envío</span>
          <span>{formatCurrency(shippingCost)}</span>
        </div>
      )}
      <div className="summary-line total" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)', 
        color: '#fff',
        padding: '20px',
        borderRadius: '12px',
        marginTop: '16px',
      }}>
        <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>Total</span>
        <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatCurrency(total)}</span>
      </div>

      {paymentMethod === 'CREDIT' && paidAmount > 0 && (
        <div className="summary-line" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          color: '#F59E0B', 
          fontWeight: 600,
          background: 'rgba(245,158,11,0.1)',
          padding: '12px',
          borderRadius: '8px',
          marginTop: '12px',
        }}>
          <span>Pendiente</span>
          <span>{formatCurrency(Math.max(0, total - parseFloat(paidAmount || 0)))}</span>
        </div>
      )}

      <button
        className="btn btn-primary btn-block"
        onClick={onProcessSale}
        disabled={cart.length === 0 || isProcessing}
        style={{ 
          marginTop: '20px',
          padding: '18px',
          fontSize: '1.1rem',
          fontWeight: 600,
          background: (cart.length > 0 && !isProcessing) ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' : '#E5E7EB',
          border: 'none',
          borderRadius: '12px',
          boxShadow: (cart.length > 0 && !isProcessing) ? '0 4px 12px rgba(16,185,129,0.3)' : 'none',
          cursor: (cart.length > 0 && !isProcessing) ? 'pointer' : 'not-allowed',
        }}
      >
        <i className={isProcessing ? "fas fa-spinner fa-spin" : "fas fa-check-circle"} style={{ marginRight: '10px' }}></i>
        {isProcessing ? 'Procesando...' : 'Procesar Venta'}
      </button>
    </div>
  );
});

CartSummary.displayName = 'CartSummary';

const POSQR = () => {
  const [products, setProducts] = useState([]);
  const [clients, setClients] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paidAmount, setPaidAmount] = useState('');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [shippingCost, setShippingCost] = useState(0);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [printType, setPrintType] = useState('thermal-80');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [lastScannedProduct, setLastScannedProduct] = useState(null);
  const [showScanFeedback, setShowScanFeedback] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientData, setNewClientData] = useState({
    name: '',
    email: '',
    phone: '',
    creditLimit: '5000',
  });
  const [dueDate, setDueDate] = useState('');
  const [currentCashRegister, setCurrentCashRegister] = useState(null);
  const [isProcessingSale, setIsProcessingSale] = useState(false);

  const barcodeInputRef = useRef(null);
  const { formatCurrency, settings, showNotification } = useApp();

  const loadData = useCallback(async () => {
    try {
      const [productsRes, clientsRes] = await Promise.all([
        productService.getAll({ active: true }),
        clientService.getAll({ active: true }),
      ]);
      
      const productsData = productsRes.data?.data || productsRes.data;
      const clientsData = clientsRes.data?.data || clientsRes.data;
      
      const productsList = Array.isArray(productsData) ? productsData : [];
      const clientsList = Array.isArray(clientsData) ? clientsData : [];
      
      setProducts(productsList);
      setClients(clientsList);
    } catch (error) {
      console.error('Error loading data:', error);
      showNotification('Error al cargar datos', 'error');
      setProducts([]);
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

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

  useEffect(() => {
    loadData();
    loadCashRegister();
  }, [loadData, loadCashRegister]);

  useEffect(() => {
    if (paymentMethod === 'CREDIT' && !dueDate) {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      setDueDate(nextMonth.toISOString().split('T')[0]);
    } else if (paymentMethod !== 'CREDIT') {
      setDueDate('');
      setSelectedClient(null);
    }
  }, [paymentMethod, dueDate]);

  const addToCart = useCallback((product) => {
    if (!product || product.stock <= 0) return;

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
      setTimeout(() => setShowScanFeedback(false), 2000);
      addToCart(product);
    } else {
      showNotification(`Producto no encontrado: ${trimmedBarcode}`, 'error');
    }
  }, [products, addToCart, showNotification]);

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

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const totalTax = useMemo(() => cart.reduce((sum, item) => sum + item.tax * item.quantity, 0), [cart]);
  const discountPercentValue = parseFloat(discountPercent) || 0;
  const discountAmount = useMemo(() => (subtotal * discountPercentValue) / 100, [subtotal, discountPercentValue]);
  const total = subtotal + totalTax - discountAmount + shippingCost;

  const handleProcessSale = useCallback(async () => {
    if (isProcessingSale) return;
    if (cart.length === 0) {
      showNotification('Agrega productos al carrito', 'error');
      return;
    }

    if (paymentMethod === 'CREDIT' && !selectedClient) {
      showNotification('Selecciona un cliente para venta a crédito', 'error');
      return;
    }

    const paidAmountValue = parseFloat(paidAmount) || 0;

    if (paymentMethod === 'CREDIT' && selectedClient) {
      const clientBalance = selectedClient.balance ?? selectedClient.currentBalance ?? 0;
      const creditAvailable = Math.max(0, selectedClient.creditLimit - clientBalance);
      const creditToUse = total - paidAmountValue;
      
      if (creditToUse > creditAvailable) {
        showNotification(`Límite de crédito excedido. El cliente necesita abonar al menos ${formatCurrency(total - creditAvailable)}`, 'error');
        return;
      }

      if (!dueDate) {
        showNotification('Selecciona la fecha de pago para venta a crédito', 'error');
        return;
      }

      const selectedDate = new Date(dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 30);
      
      if (selectedDate < today) {
        showNotification('La fecha de pago no puede ser menor a hoy', 'error');
        return;
      }
      
      if (selectedDate > maxDate) {
        showNotification('La fecha de pago no puede ser mayor a 30 días', 'error');
        return;
      }
    }

    setIsProcessingSale(true);

    try {
      const saleData = {
        clientId: selectedClient?.id || null,
        paymentMethod,
        paidAmount: paymentMethod === 'CREDIT' ? paidAmountValue : total,
        discount: discountAmount,
        shippingCost,
        dueDate: paymentMethod === 'CREDIT' ? dueDate : null,
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          price: item.price,
          tax: item.tax,
          total: item.price * item.quantity + item.tax * item.quantity,
        })),
      };

      // Validate locally if a fiscal comprobante that requires RNC is selected
      if (saleData.ncfType === '01') {
        if (!selectedClient || !selectedClient.rnc) {
          showNotification('Para Cr\u00e9dito Fiscal (Comprobante Fiscal 01) debe seleccionar un cliente con RNC v\u00e1lido', 'error');
          setIsProcessingSale(false);
          return;
        }
      }

      // Short delay to ensure UI state has settled
      await new Promise((resolve) => setTimeout(resolve, 200));

      const response = await saleService.create(saleData);
      const sale = response.data.sale || response.data;
      setLastSale(sale);
      setShowReceiptModal(true);
      setCart([]);
      setPaidAmount('');
      setDiscountPercent('0');
      setShippingCost(0);
      setSelectedClient(null);
      setDueDate('');
      loadData();
      loadCashRegister();
      notifyDataUpdate('sales');
      showNotification('Venta procesada exitosamente', 'success');
    } catch (error) {
      showNotification(error.response?.data?.error || 'Error al procesar venta', 'error');
    } finally {
      setIsProcessingSale(false);
    }
  }, [cart, paymentMethod, selectedClient, paidAmount, total, discountAmount, dueDate, loadData, loadCashRegister, showNotification, isProcessingSale]);

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
    if (!newClientData.name.trim()) {
      showNotification('Por favor ingresa el nombre del cliente', 'error');
      return;
    }

    try {
      const response = await clientService.create({
        name: newClientData.name.trim(),
        email: newClientData.email.trim() || '',
        phone: newClientData.phone.trim() || '',
        creditLimit: parseFloat(newClientData.creditLimit) || 5000,
      });

      const newClient = {
        id: response.data.client?.id || response.data.id,
        name: response.data.client?.name || response.data.name || 'Sin nombre',
        email: response.data.client?.email || response.data.email || '',
        phone: response.data.client?.phone || response.data.phone || '',
        balance: 0,
        creditLimit: parseFloat(newClientData.creditLimit) || 5000,
        active: true,
      };
      
      setClients((prev) => [...prev, newClient]);
      setSelectedClient(newClient);
      setShowNewClientModal(false);
      setNewClientData({ name: '', email: '', phone: '', creditLimit: '5000' });
      showNotification('Cliente creado exitosamente', 'success');
    } catch (error) {
      showNotification(error.response?.data?.error || 'Error al crear cliente', 'error');
    }
  }, [newClientData, showNotification]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: '#fff',
      }}>
        <div className="spinner" style={{ 
          width: '50px', 
          height: '50px', 
          border: '4px solid rgba(255,255,255,0.3)', 
          borderTopColor: '#fff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}></div>
        <p style={{ marginTop: '20px', fontSize: '1.1rem' }}>Cargando punto de venta...</p>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideIn { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .pos-qr-fullscreen { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; max-width: 1400px; margin: 0 auto; }
        .pos-qr-left { background: rgba(255,255,255,0.95); border-radius: 20px; padding: 30px; text-align: center; }
        .pos-qr-right { background: rgba(255,255,255,0.95); border-radius: 20px; display: flex; flex-direction: column; overflow: hidden; }
        .qr-scanner-icon { width: 150px; height: 150px; border-radius: 50%; background: linear-gradient(135deg, #4F46E5 0%, #8B5CF6 100%); display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; box-shadow: 0 10px 40px rgba(79,70,229,0.3); }
        .qr-scanner-icon i { font-size: 4rem; color: #fff; }
        .pos-qr-left h2 { font-size: 1.8rem; margin-bottom: 12px; color: #1F2937; }
        .pos-qr-left p { color: #6B7280; font-size: 1.1rem; }
        .pos-qr-right .cart-header { padding: 20px; border-bottom: 1px solid #E5E7EB; }
        .pos-qr-right .cart-items { flex: 1; overflow-y: auto; padding: 20px; }
        .pos-qr-right .cart-summary { border-top: 1px solid #E5E7EB; }
        .scanner-hint { margin-top: 30px; padding: 16px; background: rgba(79,70,229,0.1); border-radius: 12px; display: flex; align-items: center; justify-content: center; gap: 10px; color: #4F46E5; }
      `}</style>

      <BarcodeScanner
        inputRef={barcodeInputRef}
        value={barcodeInput}
        onChange={setBarcodeInput}
        onScan={handleBarcodeScan}
      />

      {!currentCashRegister ? (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: '60px 20px',
          background: 'rgba(255,255,255,0.95)',
          borderRadius: '20px',
          margin: '40px auto',
          maxWidth: '600px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          textAlign: 'center'
        }}>
          <div style={{ 
            width: '100px', 
            height: '100px', 
            background: 'rgba(239, 68, 68, 0.1)', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            marginBottom: '24px' 
          }}>
            <i className="fas fa-lock" style={{ fontSize: '3rem', color: '#EF4444' }}></i>
          </div>
          <h2 style={{ marginBottom: '16px', color: '#1F2937' }}>Caja Cerrada</h2>
          <p style={{ color: '#6B7280', fontSize: '1.2rem', marginBottom: '32px', lineHeight: '1.6' }}>
            Para poder realizar ventas en modo QR debes de abrir una caja primero.
          </p>
          <button 
            className="btn btn-primary" 
            onClick={() => window.location.href = '/cash-register'}
            style={{ 
              padding: '14px 40px', 
              fontSize: '1.1rem',
              background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)',
              border: 'none',
              borderRadius: '12px',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(79,70,229,0.4)'
            }}
          >
            Ir a Apertura de Caja
          </button>
        </div>
      ) : (
        <div className="pos-qr-fullscreen">
          <div className="pos-qr-left">
            <div className="qr-scanner-icon">
              <i className="fas fa-qrcode"></i>
            </div>
            <h2>Modo Lector QR/Barcode</h2>
            <p>Escanea el código del producto con tu lector para agregarlo al carrito</p>
            
            {lastScannedProduct && showScanFeedback && (
              <ScanFeedback show={showScanFeedback} productName={lastScannedProduct?.name} />
            )}

            <div className="scanner-hint">
              <i className="fas fa-keyboard"></i>
              <span>O escribe el código y presiona Enter</span>
            </div>

            {currentCashRegister && (
              <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(16,185,129,0.1)', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.3)' }}>
                <div style={{ fontSize: '0.85rem', color: '#6B7280' }}>Caja Activa</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#10B981' }}>
                  {currentCashRegister.name} - {formatCurrency(currentCashRegister.currentAmount)}
                </div>
              </div>
            )}
          </div>

          <div className="pos-qr-right">
            <div className="cart-header">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                    <i className="fas fa-shopping-cart"></i>
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Carrito de Ventas</h3>
                </div>
                <span style={{ background: cart.length > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(107,114,128,0.1)', color: cart.length > 0 ? '#10B981' : '#6B7280', padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600 }}>
                  {cart.length} {cart.length === 1 ? 'item' : 'items'}
                </span>
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
                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label style={{ fontSize: '0.9rem', display: 'block', marginBottom: '6px' }}>
                    <i className="fas fa-calendar"></i> Fecha de Pago
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    max={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                    style={{ padding: '10px', fontSize: '0.95rem', borderRadius: '8px' }}
                  />
                </div>
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
            shippingCost={shippingCost}
            setShippingCost={setShippingCost}
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
      )}

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

      <NewClientModal
        isOpen={showNewClientModal}
        onClose={() => setShowNewClientModal(false)}
        onSubmit={handleAddNewClient}
        newClientData={newClientData}
        setNewClientData={setNewClientData}
      />
    </div>
  );
};

export default POSQR;
