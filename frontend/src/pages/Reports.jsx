import { useState, useEffect, useRef, useMemo, memo } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler } from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { 
  reportService, 
  saleService, 
  transactionService, 
  productService,
  financialReportService,
  cashRegisterService,
  clientService
} from '../services/api';
import { useApp } from '../context/AppContext';
import { DATA_UPDATED_EVENT } from '../hooks/useDataSync';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler);

const StatCard = memo(({ icon, label, value, subValue, type, color }) => (
  <div className="general-stat-card">
    <div className={`general-stat-icon ${type}`}>
      <i className={`fas fa-${icon}`}></i>
    </div>
    <div className="general-stat-content">
      <div className="general-stat-label">{label}</div>
      <div className="general-stat-value">{value}</div>
      {subValue && <div className="general-stat-sub">{subValue}</div>}
    </div>
  </div>
));

StatCard.displayName = 'StatCard';

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    clientId: '',
  });
  const [clients, setClients] = useState([]);
  const { formatCurrency } = useApp();
  const dateRangeRef = useRef(dateRange);

  const [summaryData, setSummaryData] = useState(null);
  const [salesData, setSalesData] = useState(null);
  const [salesDetail, setSalesDetail] = useState([]);
  const [financialData, setFinancialData] = useState(null);
  const [transactionsDetail, setTransactionsDetail] = useState([]);
  const [productsDetail, setProductsDetail] = useState([]);
  const [receivableData, setReceivableData] = useState(null);
  const [payableData, setPayableData] = useState(null);
  const [companyStatus, setCompanyStatus] = useState(null);
  const [accountingData, setAccountingData] = useState(null);
  const [creditSalesData, setCreditSalesData] = useState(null);
  const [cashRegistersData, setCashRegistersData] = useState(null);
  const [dailySalesData, setDailySalesData] = useState(null);
  const [printType, setPrintType] = useState('letter');

  useEffect(() => {
    dateRangeRef.current = dateRange;
  }, [dateRange]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      
      const dateParams = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        clientId: dateRange.clientId
      };
      
      console.log('Loading reports with date range:', dateParams);
      
      // Cargar datos uno por uno para mejor manejo de errores
      let salesRes, financialRes, inventoryRes, salesList, transactionsList, productsList,
          receivableRes, payableRes, companyRes, accountingRes, creditSalesRes, cashRegRes, dailySalesRes;
      
      try {
        salesRes = await reportService.getSalesReport(dateParams);
        console.log('Sales report:', salesRes.data);
      } catch (e) { console.error('Error salesRes:', e); salesRes = { data: null }; }
      
      try {
        financialRes = await reportService.getFinancialReport(dateParams);
        console.log('Financial report:', financialRes.data);
      } catch (e) { console.error('Error financialRes:', e); financialRes = { data: null }; }
      
      try {
        inventoryRes = await reportService.getInventoryReport();
        console.log('Inventory report:', inventoryRes.data);
      } catch (e) { console.error('Error inventoryRes:', e); inventoryRes = { data: null }; }
      
      try {
        salesList = await saleService.getAll(dateParams);
        console.log('Sales list:', salesList.data);
      } catch (e) { console.error('Error salesList:', e); salesList = { data: [] }; }
      
      try {
        transactionsList = await transactionService.getAll(dateParams);
        console.log('Transactions list:', transactionsList.data);
      } catch (e) { console.error('Error transactionsList:', e); transactionsList = { data: [] }; }
      
      try {
        productsList = await productService.getAll();
        console.log('Products list:', productsList.data);
      } catch (e) { console.error('Error productsList:', e); productsList = { data: [] }; }
      
      try {
        receivableRes = await financialReportService.getAccountsReceivable();
        console.log('Receivable:', receivableRes.data);
      } catch (e) { console.error('Error receivableRes:', e); receivableRes = { data: null }; }
      
      try {
        payableRes = await financialReportService.getAccountsPayable();
        console.log('Payable:', payableRes.data);
      } catch (e) { console.error('Error payableRes:', e); payableRes = { data: null }; }
      
      try {
        companyRes = await financialReportService.getCompanyStatus();
        console.log('Company status:', companyRes.data);
      } catch (e) { console.error('Error companyRes:', e); companyRes = { data: null }; }
      
      try {
        accountingRes = await financialReportService.getAccounting(dateParams);
        console.log('Accounting:', accountingRes.data);
      } catch (e) { console.error('Error accountingRes:', e); accountingRes = { data: null }; }
      
      try {
        creditSalesRes = await saleService.getCreditSalesSummary({ date: today });
        console.log('Credit sales:', creditSalesRes.data);
      } catch (e) { console.error('Error creditSalesRes:', e); creditSalesRes = { data: null }; }
      
      try {
        cashRegRes = await cashRegisterService.getAll();
        console.log('Cash registers:', cashRegRes.data);
      } catch (e) { console.error('Error cashRegRes:', e); cashRegRes = { data: [] }; }
      
      try {
        dailySalesRes = await saleService.getDaily();
        console.log('Daily sales:', dailySalesRes.data);
      } catch (e) { console.error('Error dailySalesRes:', e); dailySalesRes = { data: null }; }

      setSalesData(salesRes.data);
      setFinancialData(financialRes.data);
      setSalesDetail(salesList.data?.data || salesList.data || []);
      setTransactionsDetail(transactionsList.data?.data || transactionsList.data || []);
      setProductsDetail(productsList.data?.data || productsList.data || []);
      setReceivableData(receivableRes.data);
      setPayableData(payableRes.data);
      setCompanyStatus(companyRes.data);
      setAccountingData(accountingRes.data);
      setCreditSalesData(creditSalesRes.data);
      setCashRegistersData(cashRegRes.data);
      setDailySalesData(dailySalesRes.data);

      setSummaryData({
        sales: salesRes.data,
        financial: financialRes.data,
        receivable: receivableRes.data,
        payable: payableRes.data,
        inventory: inventoryRes.data,
        company: companyRes.data,
        creditSales: creditSalesRes.data,
        cashRegister: cashRegRes.data,
      });
      
      console.log('All data loaded successfully!');
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      const response = await clientService.getAll({ active: true });
      setClients(response.data?.data || response.data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  useEffect(() => {
    loadReports();
    loadClients();
  }, []);

  useEffect(() => {
    const handleDataUpdate = () => loadReports();
    window.addEventListener(DATA_UPDATED_EVENT, handleDataUpdate);
    return () => window.removeEventListener(DATA_UPDATED_EVENT, handleDataUpdate);
  }, []);

  const exportToExcel = (type) => {
    let data = [];
    let title = '';
    let ws, wb;

    switch (type) {
      case 'sales':
        title = 'Reporte de Ventas';
        data.push(['Fecha', 'N° Factura', 'Cliente', 'Método', 'Subtotal', 'ITBIS', 'Descuento', 'Total', 'Estado']);
        salesDetail.forEach(sale => {
          data.push([
            new Date(sale.createdAt).toLocaleDateString(),
            sale.invoiceNumber,
            sale.client?.name || 'General',
            sale.paymentMethod === 'CASH' ? 'Efectivo' : sale.paymentMethod === 'CARD' ? 'Tarjeta' : 'Crédito',
            { t: 'n', v: sale.subtotal || 0, z: '"RD$"#,##0.00' },
            { t: 'n', v: sale.tax || 0, z: '"RD$"#,##0.00' },
            { t: 'n', v: sale.discount || 0, z: '"RD$"#,##0.00' },
            { t: 'n', v: sale.total || 0, z: '"RD$"#,##0.00' },
            sale.status === 'COMPLETED' ? 'Completada' : sale.status
          ]);
        });
        if (salesDetail.length > 0) {
          const total = salesDetail.reduce((sum, s) => sum + (s.total || 0), 0);
          data.push(['', '', '', 'TOTAL', '', '', '', { t: 'n', v: total, z: '"RD$"#,##0.00' }, '']);
        }
        break;

      case 'credit':
        title = 'Ventas a Crédito';
        data.push(['Factura', 'Cliente', 'Fecha', 'Total', 'Pagado', 'Pendiente', 'Estado']);
        (creditSalesData?.sales || []).forEach(sale => {
          data.push([
            sale.invoiceNumber,
            sale.client?.name || 'Sin cliente',
            sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : '-',
            { t: 'n', v: sale.total || 0, z: '"RD$"#,##0.00' },
            { t: 'n', v: sale.paidAmount || 0, z: '"RD$"#,##0.00' },
            { t: 'n', v: Math.max(0, (sale.total || 0) - (sale.paidAmount || 0)), z: '"RD$"#,##0.00' },
            (sale.status === 'COMPLETED' || sale.paidAmount >= sale.total - 0.01) ? 'Pagado' : 'Pendiente'
          ]);
        });
        break;

      case 'daily':
        title = 'Ventas Diarias';
        data.push(['Factura', 'Cliente', 'Productos', 'Total', 'Método', 'Estado']);
        (dailySalesData?.sales || []).forEach(sale => {
          data.push([
            sale.invoiceNumber,
            sale.client?.name || 'General',
            sale.items?.length || 0,
            { t: 'n', v: sale.total || 0, z: '"RD$"#,##0.00' },
            sale.paymentMethod === 'CASH' ? 'Efectivo' : sale.paymentMethod === 'CARD' ? 'Tarjeta' : 'Crédito',
            sale.status
          ]);
        });
        break;

      case 'receivable':
        title = 'Cuentas por Cobrar';
        data.push(['Cliente', 'Teléfono', 'Email', 'Saldo', 'Límite Crédito', 'Disponible', 'N° Facturas']);
        (receivableData?.clients || []).forEach(client => {
          data.push([
            client.name,
            client.phone || '-',
            client.email || '-',
            { t: 'n', v: client.balance || 0, z: '"RD$"#,##0.00' },
            { t: 'n', v: client.creditLimit || 0, z: '"RD$"#,##0.00' },
            { t: 'n', v: client.availableCredit || 0, z: '"RD$"#,##0.00' },
            client.sales?.length || 0
          ]);
        });
        if (receivableData?.totalReceivable) {
          data.push(['TOTAL', '', '', { t: 'n', v: receivableData.totalReceivable, z: '"RD$"#,##0.00' }, '', '', receivableData.clientCount || 0]);
        }
        break;

      case 'payable':
        title = 'Cuentas por Pagar';
        data.push(['Proveedor', 'Teléfono', 'Email', 'Saldo', 'Facturas Pendientes']);
        (payableData?.suppliers || []).forEach(supplier => {
          const pendingCount = supplier.invoices?.filter(i => !i.paid).length || 0;
          data.push([
            supplier.name,
            supplier.phone || '-',
            supplier.email || '-',
            { t: 'n', v: supplier.balance || 0, z: '"RD$"#,##0.00' },
            pendingCount
          ]);
        });
        if (payableData?.totalPayable) {
          data.push(['TOTAL', '', '', { t: 'n', v: payableData.totalPayable, z: '"RD$"#,##0.00' }, payableData.supplierCount || 0]);
        }
        break;

      case 'accounting':
        title = 'Transacciones Contables';
        data.push(['Fecha', 'Tipo', 'Descripción', 'Referencia', 'Monto', 'Usuario']);
        (accountingData?.transactions || []).forEach(trans => {
          data.push([
            new Date(trans.date).toLocaleDateString(),
            trans.type === 'INCOME' ? 'Ingreso' : 'Gasto',
            trans.description || '-',
            trans.reference || '-',
            { t: 'n', v: trans.amount || 0, z: '"RD$"#,##0.00' },
            trans.user?.name || '-'
          ]);
        });
        if (accountingData?.summary) {
          data.push(['', '', '', 'TOTAL INGRESOS', { t: 'n', v: accountingData.summary.totalIncome || 0, z: '"RD$"#,##0.00' }, '']);
          data.push(['', '', '', 'TOTAL GASTOS', { t: 'n', v: accountingData.summary.totalExpenses || 0, z: '"RD$"#,##0.00' }, '']);
          data.push(['', '', '', 'BALANCE', { t: 'n', v: accountingData.summary.netBalance || 0, z: '"RD$"#,##0.00' }, '']);
        }
        break;

      case 'cashregister':
        title = 'Historial de Cajas';
        data.push(['Caja', 'Estado', 'Fecha Apertura', 'Fecha Cierre', 'Monto Apertura', 'Monto Cierre', 'Usuario']);
        (cashRegistersData || []).forEach(reg => {
          data.push([
            reg.name,
            reg.isOpen ? 'Abierta' : 'Cerrada',
            reg.openedAt ? new Date(reg.openedAt).toLocaleString() : '-',
            reg.closedAt ? new Date(reg.closedAt).toLocaleString() : '-',
            { t: 'n', v: reg.openingAmount || 0, z: '"RD$"#,##0.00' },
            { t: 'n', v: reg.closingAmount || 0, z: '"RD$"#,##0.00' },
            reg.openedByUser?.name || '-'
          ]);
        });
        break;

      case 'inventory':
        title = 'Inventario';
        data.push(['Producto', 'SKU', 'Categoría', 'Precio', 'Costo', 'Stock', 'Valor', 'Estado']);
        (productsDetail || []).forEach(prod => {
          const value = (prod.price || 0) * (prod.stock || 0);
          const status = prod.stock === 0 ? 'Sin Stock' : prod.stock <= (prod.minStock || 0) ? 'Stock Bajo' : 'Normal';
          data.push([
            prod.name,
            prod.sku || '-',
            prod.category?.name || 'Sin Categoría',
            { t: 'n', v: prod.price || 0, z: '"RD$"#,##0.00' },
            { t: 'n', v: prod.cost || 0, z: '"RD$"#,##0.00' },
            prod.stock || 0,
            { t: 'n', v: value, z: '"RD$"#,##0.00' },
            status
          ]);
        });
        break;

      case 'company':
        title = 'Estado de la Empresa';
        data.push(['CONCEPTO', 'DETALLE', 'MONTO']);
        data.push(['VENTAS', 'Hoy', { t: 'n', v: companyStatus?.sales?.today?.amount || 0, z: '"RD$"#,##0.00' }]);
        data.push(['', 'Mes', { t: 'n', v: companyStatus?.sales?.month?.amount || 0, z: '"RD$"#,##0.00' }]);
        data.push(['', 'Año', { t: 'n', v: companyStatus?.sales?.year?.amount || 0, z: '"RD$"#,##0.00' }]);
        data.push([]);
        data.push(['CONTABILIDAD', 'Ingresos del Mes', { t: 'n', v: companyStatus?.accounting?.monthIncome || 0, z: '"RD$"#,##0.00' }]);
        data.push(['', 'Gastos del Mes', { t: 'n', v: companyStatus?.accounting?.monthExpenses || 0, z: '"RD$"#,##0.00' }]);
        data.push(['', 'Balance Neto', { t: 'n', v: companyStatus?.accounting?.netBalance || 0, z: '"RD$"#,##0.00' }]);
        data.push([]);
        data.push(['CUENTAS', 'Por Cobrar', { t: 'n', v: companyStatus?.accounts?.receivable || 0, z: '"RD$"#,##0.00' }]);
        data.push(['', 'Por Pagar', { t: 'n', v: companyStatus?.accounts?.payable || 0, z: '"RD$"#,##0.00' }]);
        data.push(['', 'Posición Neta', { t: 'n', v: companyStatus?.accounts?.netPosition || 0, z: '"RD$"#,##0.00' }]);
        data.push([]);
        data.push(['INVENTARIO', 'Valor Total', { t: 'n', v: companyStatus?.inventory?.value || 0, z: '"RD$"#,##0.00' }]);
        data.push(['', 'Costo Total', { t: 'n', v: companyStatus?.inventory?.cost || 0, z: '"RD$"#,##0.00' }]);
        data.push(['', 'Ganancia Potencial', { t: 'n', v: companyStatus?.inventory?.profit || 0, z: '"RD$"#,##0.00' }]);
        break;

      case 'general':
        title = 'Reporte General';
        data.push(['RESUMEN FINANCIERO']);
        data.push(['Fecha', new Date().toLocaleDateString()]);
        data.push(['Período', `${dateRange.startDate} al ${dateRange.endDate}`]);
        data.push([]);
        data.push(['CONCEPTO', 'MONTO']);
        data.push(['Ventas del Período', { t: 'n', v: totalSales, z: '"RD$"#,##0.00' }]);
        data.push(['Crédito Pendiente', { t: 'n', v: creditSalesData?.summary?.totalPending || 0, z: '"RD$"#,##0.00' }]);
        data.push(['Cuentas por Cobrar', { t: 'n', v: receivableData?.totalReceivable || 0, z: '"RD$"#,##0.00' }]);
        data.push(['Cuentas por Pagar', { t: 'n', v: payableData?.totalPayable || 0, z: '"RD$"#,##0.00' }]);
        data.push(['Ingresos', { t: 'n', v: totalIncome, z: '"RD$"#,##0.00' }]);
        data.push(['Egresos', { t: 'n', v: totalExpenses, z: '"RD$"#,##0.00' }]);
        data.push(['Balance Neto', { t: 'n', v: netBalance, z: '"RD$"#,##0.00' }]);
        data.push(['Valor Inventario', { t: 'n', v: companyStatus?.inventory?.value || 0, z: '"RD$"#,##0.00' }]);
        break;

      default:
        return;
    }

    if (data.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    ws = XLSX.utils.aoa_to_sheet(data);
    wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title.substring(0, 31));
    XLSX.writeFile(wb, `${title}_${dateRange.startDate}_${dateRange.endDate}.xlsx`);
  };

  const printReport = () => {
    const content = document.getElementById('report-preview');
    if (!content) { window.print(); return; }
    const printContent = content.innerHTML;
    if (!printContent.trim()) { window.print(); return; }

    const tabName = tabs.find(t => t.id === activeTab)?.label || 'Reporte';

    const getStyles = () => {
      switch (printType) {
        case 'ticket58':
          return `<style>
            body { font-family: 'Courier New', Courier, monospace; font-size: 10px; margin: 0; padding: 5px; color: #000; }
            .ticket58 { max-width: 54mm; margin: 0 auto; }
            .center { text-align: center; }
            table { width: 100%; border-collapse: collapse; margin: 5px 0; }
            th, td { padding: 2px; border: none; border-bottom: 1px dashed #000; text-align: left; font-size: 9px; }
            th { font-weight: bold; border-top: 1px dashed #000; border-bottom: 1px dashed #000; background: transparent; }
            h2, h3, h4 { margin: 4px 0; font-size: 12px; }
            @page { size: 58mm auto; margin: 0; }
            .no-print { display: none !important; }
            canvas { display: none !important; }
            .general-stats-grid { display: block; margin: 5px 0; }
            .general-stat-card { border: none; border-bottom: 1px dashed #ccc; padding: 4px 0; border-radius: 0; min-width: auto; }
            .general-stat-value { font-size: 12px; font-weight: bold; margin-top: 2px; }
            .general-stat-label { font-size: 10px; color: #000; }
            .general-stat-icon { display: none; }
            .general-stat-sub { font-size: 9px; color: #333; }
            .reports-tabs, .reports-date-range, .btn, button, .reports-header { display: none !important; }
            .reports-container { padding: 0 !important; }
            .general-charts-grid { display: none !important; }
          </style>`;
        case 'ticket80':
          return `<style>
            body { font-family: 'Courier New', Courier, monospace; font-size: 12px; margin: 0; padding: 8px; color: #000; }
            .ticket80 { max-width: 76mm; margin: 0 auto; }
            .center { text-align: center; }
            table { width: 100%; border-collapse: collapse; margin: 8px 0; }
            th, td { padding: 3px; border: none; border-bottom: 1px dashed #000; text-align: left; font-size: 10px; }
            th { font-weight: bold; border-top: 1px dashed #000; border-bottom: 1px dashed #000; background: transparent; }
            h2, h3, h4 { margin: 6px 0; font-size: 14px; }
            @page { size: 80mm auto; margin: 0; }
            .no-print { display: none !important; }
            canvas { display: none !important; }
            .general-stats-grid { display: block; margin: 8px 0; }
            .general-stat-card { border: none; border-bottom: 1px dashed #ccc; padding: 6px 0; border-radius: 0; min-width: auto; }
            .general-stat-value { font-size: 14px; font-weight: bold; margin-top: 2px; }
            .general-stat-label { font-size: 11px; color: #000; }
            .general-stat-icon { display: none; }
            .general-stat-sub { font-size: 10px; color: #333; }
            .reports-tabs, .reports-date-range, .btn, button, .reports-header { display: none !important; }
            .reports-container { padding: 0 !important; }
            .general-charts-grid { display: none !important; }
          </style>`;
        case 'a4':
          return `<style>
            body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color: #000; }
            .a4 { max-width: 100%; }
            .center { text-align: center; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th, td { padding: 6px 8px; border: 1px solid #000; text-align: left; font-size: 11px; }
            th { background: #f0f0f0; font-weight: bold; }
            h2, h3, h4 { margin: 8px 0; }
            @page { size: A4; margin: 10mm; }
            .no-print { display: none !important; }
            canvas { display: none !important; }
            .general-stats-grid { display: flex; flex-wrap: wrap; gap: 12px; margin: 12px 0; }
            .general-stat-card { border: 1px solid #ccc; padding: 10px; border-radius: 4px; min-width: 180px; flex: 1; }
            .general-stat-value { font-size: 18px; font-weight: bold; margin-top: 4px; }
            .general-stat-label { font-size: 11px; color: #666; }
            .general-stat-icon { display: none; }
            .general-stat-sub { font-size: 10px; color: #999; }
            .reports-tabs, .reports-date-range, .btn, button, .reports-header { display: none !important; }
            .reports-container { padding: 0 !important; }
          </style>`;
        case 'letter':
        default:
          return `<style>
            body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color: #000; }
            .letter { max-width: 800px; margin: 0 auto; }
            .center { text-align: center; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th, td { padding: 6px 8px; border: 1px solid #000; text-align: left; font-size: 11px; }
            th { background: #f0f0f0; font-weight: bold; }
            h2, h3, h4 { margin: 8px 0; }
            @page { size: letter; margin: 0.5in; }
            .no-print { display: none !important; }
            canvas { display: none !important; }
            .general-stats-grid { display: flex; flex-wrap: wrap; gap: 12px; margin: 12px 0; }
            .general-stat-card { border: 1px solid #ccc; padding: 10px; border-radius: 4px; min-width: 180px; flex: 1; }
            .general-stat-value { font-size: 18px; font-weight: bold; margin-top: 4px; }
            .general-stat-label { font-size: 11px; color: #666; }
            .general-stat-icon { display: none; }
            .general-stat-sub { font-size: 10px; color: #999; }
            .reports-tabs, .reports-date-range, .btn, button, .reports-header { display: none !important; }
            .reports-container { padding: 0 !important; }
          </style>`;
      }
    };

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html><html>
        <head><title>${tabName}</title>${getStyles()}</head>
        <body>
          <div class="${printType}" style="padding:10px">
            <h2 style="text-align:center;margin-bottom:4px">${tabName}</h2>
            <p style="text-align:center;font-size:11px;color:#666;margin-top:0">
              ${dateRange.startDate} al ${dateRange.endDate}
            </p>
            <hr style="border:1px dashed #ccc" />
            ${printContent}
          </div>
          <script>
            window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); };
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const totalSales = useMemo(() => salesDetail.reduce((s, v) => s + (v.total || 0), 0), [salesDetail]);
  const totalIncome = accountingData?.summary?.totalIncome || 0;
  const totalExpenses = accountingData?.summary?.totalExpenses || 0;
  const netBalance = totalIncome - totalExpenses;

  const salesChartData = useMemo(() => ({
    labels: salesData?.groupedData?.map((d) => d.period) || [],
    datasets: [{
      label: 'Ventas',
      data: salesData?.groupedData?.map((d) => d.totalAmount) || [],
      backgroundColor: 'rgba(16, 185, 129, 0.3)',
      borderColor: '#10B981',
      borderWidth: 2,
      borderRadius: 8,
      fill: true,
      tension: 0.4,
    }],
  }), [salesData]);

  const paymentMethodData = useMemo(() => ({
    labels: financialData?.salesByPaymentMethod?.map((d) => 
      d.method === 'CASH' ? 'Efectivo' : d.method === 'CARD' ? 'Tarjeta' : 'Crédito') || [],
    datasets: [{
      data: financialData?.salesByPaymentMethod?.map((d) => d.total) || [],
      backgroundColor: ['#10B981', '#4F46E5', '#F59E0B'],
      borderWidth: 0,
      cutout: '65%',
    }],
  }), [financialData]);

  const accountingChartData = useMemo(() => ({
    labels: ['Ingresos', 'Egresos', 'Balance'],
    datasets: [{
      data: [totalIncome, totalExpenses, Math.abs(netBalance)],
      backgroundColor: ['#10B981', '#EF4444', netBalance >= 0 ? '#8B5CF6' : '#F59E0B'],
      borderWidth: 0,
      cutout: '65%',
    }],
  }), [totalIncome, totalExpenses, netBalance]);

  const inventoryChartData = useMemo(() => {
    const categoryData = {};
    productsDetail.forEach(p => {
      const cat = p.category?.name || 'Sin categoría';
      if (!categoryData[cat]) categoryData[cat] = 0;
      categoryData[cat] += p.price * p.stock;
    });
    return {
      labels: Object.keys(categoryData),
      datasets: [{
        data: Object.values(categoryData),
        backgroundColor: ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#3B82F6'],
        borderWidth: 0,
      }],
    };
  }, [productsDetail]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#94A3B8', padding: 15, usePointStyle: true }
      }
    }
  };

  const barOptions = {
    ...chartOptions,
    scales: {
      x: { grid: { display: false }, ticks: { color: '#94A3B8' } },
      y: { grid: { color: 'rgba(148, 163, 184, 0.1)' }, ticks: { color: '#94A3B8', callback: (v) => formatCurrency(v, { notation: 'compact' }) } }
    }
  };

  if (loading) {
    return (
      <div className="loading-fallback">
        <div className="spinner"></div>
        <p>Cargando reportes...</p>
      </div>
    );
  }

  const tabs = [
    { id: 'general', label: 'General', icon: 'chart-pie' },
    { id: 'sales', label: 'Ventas', icon: 'shopping-cart' },
    { id: 'credit', label: 'Crédito', icon: 'credit-card' },
    { id: 'daily', label: 'Diario', icon: 'calendar-day' },
    { id: 'receivable', label: 'CxC', icon: 'hand-holding-usd' },
    { id: 'payable', label: 'CxP', icon: 'file-invoice-dollar' },
    { id: 'accounting', label: 'Contabilidad', icon: 'calculator' },
    { id: 'cashregister', label: 'Caja', icon: 'cash-register' },
    { id: 'inventory', label: 'Inventario', icon: 'boxes' },
    { id: 'company', label: 'Empresa', icon: 'building' },
  ];

  return (
    <div className="reports-container">
      <div className="reports-header">
        <div>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '4px' }}>Reportes</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Análisis completo de tu negocio</p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
        <div className="reports-date-range">
          <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginRight: '8px' }}>Desde:</label>
          <input type="date" className="form-control" value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })} />
          <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: '0 8px' }}>Hasta:</label>
          <input type="date" className="form-control" value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })} />
          
          <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: '0 8px' }}>Cliente:</label>
          <select 
            className="form-control" 
            value={dateRange.clientId}
            onChange={(e) => setDateRange({ ...dateRange, clientId: e.target.value })}
            style={{ minWidth: '180px' }}
          >
            <option value="">Todos los Clientes</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={loadReports}
          disabled={loading}
          style={{ minWidth: '160px' }}
        >
          {loading ? (
            <>
              <i className="fas fa-circle-notch fa-spin"></i> Cargando...
            </>
          ) : (
            <>
              <i className="fas fa-download"></i> Cargar Datos
            </>
          )}
        </button>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <select
            className="form-control"
            value={printType}
            onChange={(e) => setPrintType(e.target.value)}
            style={{ width: '130px', padding: '6px 8px' }}
          >
            <option value="letter">Carta</option>
            <option value="a4">A4</option>
            <option value="ticket58">Térmica 58mm</option>
            <option value="ticket80">Térmica 80mm</option>
          </select>
          <button className="btn btn-outline" onClick={printReport}>
            <i className="fas fa-print"></i> Imprimir
          </button>
        </div>
      </div>

      <div className="reports-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`reports-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <i className={`fas fa-${tab.icon}`}></i>
            {tab.label}
          </button>
        ))}
      </div>

      <div id="report-preview">
      {activeTab === 'general' && (
        <div className="general-report">
          <div className="general-report-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3><i className="fas fa-chart-line"></i> Resumen Financiero</h3>
            <button className="btn btn-outline" onClick={() => exportToExcel('general')}><i className="fas fa-file-excel"></i> Exportar Todo</button>
          </div>
          <div className="general-report-section">
            <div className="general-stats-grid">
              <StatCard icon="shopping-cart" label="Ventas del Período" value={formatCurrency(totalSales)} subValue={`${salesDetail.length} transacciones`} type="sales" />
              <StatCard icon="credit-card" label="Crédito Pendiente" value={formatCurrency(creditSalesData?.summary?.totalPending || 0)} subValue={`${creditSalesData?.summary?.countPending || 0} facturas`} type="credit" />
              <StatCard icon="hand-holding-usd" label="Cuentas por Cobrar" value={formatCurrency(receivableData?.totalReceivable || 0)} subValue={`${receivableData?.clientCount || 0} clientes`} type="receivable" />
              <StatCard icon="file-invoice-dollar" label="Cuentas por Pagar" value={formatCurrency(payableData?.totalPayable || 0)} subValue={`${payableData?.supplierCount || 0} proveedores`} type="payable" />
            </div>
            <div className="general-stats-grid">
              <StatCard icon="arrow-up" label="Ingresos" value={formatCurrency(totalIncome)} type="accounting" />
              <StatCard icon="arrow-down" label="Egresos" value={formatCurrency(totalExpenses)} type="payable" />
              <StatCard icon="wallet" label="Balance Neto" value={formatCurrency(netBalance)} type="balance" />
              <StatCard icon="boxes" label="Valor Inventario" value={formatCurrency(companyStatus?.inventory?.value || 0)} type="inventory" />
            </div>
          </div>

          <div className="general-charts-grid">
            <div className="general-chart-card">
              <h4><i className="fas fa-chart-bar"></i> Ventas por Período</h4>
              <div className="general-chart-container">
                <Bar data={salesChartData} options={barOptions} />
              </div>
            </div>
            <div className="general-chart-card">
              <h4><i className="fas fa-chart-pie"></i> Métodos de Pago</h4>
              <div className="general-chart-container">
                <Doughnut data={paymentMethodData} options={chartOptions} />
              </div>
            </div>
            <div className="general-chart-card">
              <h4><i className="fas fa-calculator"></i> Balance Contable</h4>
              <div className="general-chart-container">
                <Doughnut data={accountingChartData} options={chartOptions} />
              </div>
            </div>
            <div className="general-chart-card">
              <h4><i className="fas fa-boxes"></i> Inventario por Categoría</h4>
              <div className="general-chart-container">
                <Doughnut data={inventoryChartData} options={chartOptions} />
              </div>
            </div>
          </div>

          <div className="general-report-section">
            <h3><i className="fas fa-info-circle"></i> Datos Adicionales</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div style={{ padding: '16px', background: 'var(--bg-main)', borderRadius: '12px' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Cajas Registradas</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{cashRegistersData?.length || 0}</div>
              </div>
              <div style={{ padding: '16px', background: 'var(--bg-main)', borderRadius: '12px' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Productos en Stock</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{productsDetail.length}</div>
              </div>
              <div style={{ padding: '16px', background: 'var(--bg-main)', borderRadius: '12px' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Transacciones Contables</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{accountingData?.transactions?.length || 0}</div>
              </div>
              <div style={{ padding: '16px', background: 'var(--bg-main)', borderRadius: '12px' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Ventas a Crédito</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{creditSalesData?.sales?.length || 0}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sales' && (
        <div className="data-table-container">
          <div className="report-table-header">
            <div className="report-table-title">
              <h3>Reporte de Ventas</h3>
              <span className="badge badge-success">{salesDetail.length}</span>
            </div>
            <div className="report-table-actions">
              <button className="btn btn-outline" onClick={() => exportToExcel('sales')}><i className="fas fa-file-excel"></i> Excel</button>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr><th>Fecha</th><th>Factura</th><th>Cliente</th><th>Método</th><th>Subtotal</th><th>ITBIS</th><th>Total</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {salesDetail.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>No hay ventas en este período</td></tr>
              ) : salesDetail.map(sale => (
                <tr key={sale.id}>
                  <td>{new Date(sale.createdAt).toLocaleDateString()}</td>
                  <td><strong>{sale.invoiceNumber}</strong></td>
                  <td>{sale.client?.name || 'General'}</td>
                  <td><span className="badge badge-success">{sale.paymentMethod === 'CASH' ? 'Efectivo' : sale.paymentMethod === 'CARD' ? 'Tarjeta' : 'Crédito'}</span></td>
                  <td>{formatCurrency(sale.subtotal)}</td>
                  <td>{formatCurrency(sale.tax)}</td>
                  <td><strong>{formatCurrency(sale.total)}</strong></td>
                  <td><span className={`badge ${sale.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>{sale.status}</span></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--bg-surface-hover)', fontWeight: '700' }}>
                <td colSpan="6" style={{ textAlign: 'right' }}>TOTAL:</td>
                <td>{formatCurrency(totalSales)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {activeTab === 'credit' && (
        <div className="data-table-container">
          <div className="report-table-header">
            <div className="report-table-title">
              <h3>Ventas a Crédito</h3>
              <span className="badge badge-warning">{creditSalesData?.sales?.length || 0}</span>
            </div>
            <div className="report-table-actions">
              <button className="btn btn-outline" onClick={() => exportToExcel('credit')}><i className="fas fa-file-excel"></i> Excel</button>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr><th>Factura</th><th>Cliente</th><th>Fecha</th><th>Total</th><th>Pagado</th><th>Pendiente</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {(!creditSalesData?.sales || creditSalesData.sales.length === 0) ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>No hay ventas a crédito</td></tr>
              ) : creditSalesData.sales.map(sale => (
                <tr key={sale.id}>
                  <td><strong>{sale.invoiceNumber}</strong></td>
                  <td>{sale.client?.name || 'Sin cliente'}</td>
                  <td>{sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : '-'}</td>
                  <td>{formatCurrency(sale.total)}</td>
                  <td style={{ color: 'var(--secondary)' }}>{formatCurrency(sale.paidAmount)}</td>
                  <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{formatCurrency(Math.max(0, sale.total - sale.paidAmount))}</td>
                  <td><span className={`badge ${(sale.status === 'COMPLETED' || sale.paidAmount >= sale.total - 0.01) ? 'badge-success' : 'badge-warning'}`}>{(sale.status === 'COMPLETED' || sale.paidAmount >= sale.total - 0.01) ? 'Pagado' : 'Pendiente'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'daily' && (
        <div>
          <div className="general-stats-grid" style={{ marginBottom: '24px' }}>
            <StatCard icon="shopping-cart" label="Ventas del Día" value={dailySalesData?.totalSales || 0} type="sales" />
            <StatCard icon="dollar-sign" label="Total del Día" value={formatCurrency(dailySalesData?.totalAmount || 0)} type="balance" />
            <StatCard icon="box" label="Items Vendidos" value={dailySalesData?.totalItems || 0} type="inventory" />
          </div>
          <div className="data-table-container">
            <div className="report-table-header">
              <div className="report-table-title">
                <h3>Detalle de Ventas</h3>
              </div>
              <div className="report-table-actions">
                <button className="btn btn-outline" onClick={() => exportToExcel('daily')}><i className="fas fa-file-excel"></i> Excel</button>
              </div>
            </div>
            <table className="data-table">
              <thead>
                <tr><th>Factura</th><th>Productos</th><th>Total</th><th>Método</th></tr>
              </thead>
              <tbody>
                {(!dailySalesData?.sales || dailySalesData.sales.length === 0) ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '40px' }}>No hay ventas hoy</td></tr>
                ) : dailySalesData.sales.map(sale => (
                  <tr key={sale.id}>
                    <td><strong>{sale.invoiceNumber}</strong></td>
                    <td>{sale.items?.length || 0} items</td>
                    <td><strong>{formatCurrency(sale.total)}</strong></td>
                    <td><span className="badge badge-success">{sale.paymentMethod === 'CASH' ? 'Efectivo' : sale.paymentMethod === 'CARD' ? 'Tarjeta' : 'Crédito'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'receivable' && (
        <div className="data-table-container">
          <div className="report-table-header">
            <div className="report-table-title">
              <h3>Cuentas por Cobrar</h3>
              <span className="badge badge-success">{formatCurrency(receivableData?.totalReceivable || 0)}</span>
            </div>
            <div className="report-table-actions">
              <button className="btn btn-outline" onClick={() => exportToExcel('receivable')}><i className="fas fa-file-excel"></i> Excel</button>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr><th>Cliente</th><th>Contacto</th><th>Saldo</th><th>Límite</th><th>Disponible</th><th>Facturas</th></tr>
            </thead>
            <tbody>
              {receivableData?.clients?.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>No hay cuentas por cobrar</td></tr>
              ) : receivableData?.clients?.map(client => (
                <tr key={client.id}>
                  <td><strong>{client.name}</strong></td>
                  <td>{client.phone || client.email || '-'}</td>
                  <td><span className="badge badge-warning">{formatCurrency(client.balance)}</span></td>
                  <td>{formatCurrency(client.creditLimit)}</td>
                  <td style={{ color: 'var(--secondary)' }}>{formatCurrency(client.availableCredit)}</td>
                  <td>{client.sales?.length || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'payable' && (
        <div className="data-table-container">
          <div className="report-table-header">
            <div className="report-table-title">
              <h3>Cuentas por Pagar</h3>
              <span className="badge badge-danger">{formatCurrency(payableData?.totalPayable || 0)}</span>
            </div>
            <div className="report-table-actions">
              <button className="btn btn-outline" onClick={() => exportToExcel('payable')}><i className="fas fa-file-excel"></i> Excel</button>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr><th>Proveedor</th><th>Contacto</th><th>Saldo</th><th>Facturas Pendientes</th></tr>
            </thead>
            <tbody>
              {payableData?.suppliers?.length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '40px' }}>No hay cuentas por pagar</td></tr>
              ) : payableData?.suppliers?.map(supplier => (
                <tr key={supplier.id}>
                  <td><strong>{supplier.name}</strong></td>
                  <td>{supplier.phone || supplier.email || '-'}</td>
                  <td><span className="badge badge-danger">{formatCurrency(supplier.balance)}</span></td>
                  <td>{supplier.invoices?.filter(i => !i.paid).length || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'accounting' && (
        <div>
          <div className="general-stats-grid" style={{ marginBottom: '24px' }}>
            <StatCard icon="arrow-up" label="Ingresos" value={formatCurrency(totalIncome)} type="sales" />
            <StatCard icon="arrow-down" label="Egresos" value={formatCurrency(totalExpenses)} type="payable" />
            <StatCard icon="wallet" label="Balance Neto" value={formatCurrency(netBalance)} type="balance" />
          </div>
          <div className="data-table-container">
            <div className="report-table-header">
              <div className="report-table-title">
                <h3>Transacciones Contables</h3>
              </div>
              <div className="report-table-actions">
                <button className="btn btn-outline" onClick={() => exportToExcel('accounting')}><i className="fas fa-file-excel"></i> Excel</button>
              </div>
            </div>
            <table className="data-table">
              <thead>
                <tr><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Referencia</th><th>Monto</th><th>Usuario</th></tr>
              </thead>
              <tbody>
                {accountingData?.transactions?.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>No hay transacciones</td></tr>
                ) : accountingData?.transactions?.map(trans => (
                  <tr key={trans.id}>
                    <td>{new Date(trans.date).toLocaleDateString()}</td>
                    <td><span className={`badge ${trans.type === 'INCOME' ? 'badge-success' : 'badge-danger'}`}>{trans.type === 'INCOME' ? 'Ingreso' : 'Gasto'}</span></td>
                    <td>{trans.description}</td>
                    <td>{trans.reference || '-'}</td>
                    <td style={{ color: trans.type === 'INCOME' ? 'var(--secondary)' : 'var(--danger)' }}>
                      <strong>{trans.type === 'INCOME' ? '+' : '-'}{formatCurrency(trans.amount)}</strong>
                    </td>
                    <td>{trans.user?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'cashregister' && (
        <div className="data-table-container">
          <div className="report-table-header">
            <div className="report-table-title">
              <h3>Historial de Cajas</h3>
              <span className="badge">{cashRegistersData?.length || 0}</span>
            </div>
            <div className="report-table-actions">
              <button className="btn btn-outline" onClick={() => exportToExcel('cashregister')}><i className="fas fa-file-excel"></i> Excel</button>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr><th>Caja</th><th>Estado</th><th>Apertura</th><th>Cierre</th><th>Monto Apertura</th><th>Monto Cierre</th><th>Usuario</th></tr>
            </thead>
            <tbody>
              {(!cashRegistersData || cashRegistersData.length === 0) ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>No hay cajas registradas</td></tr>
              ) : cashRegistersData.map(reg => (
                <tr key={reg.id}>
                  <td><strong>{reg.name}</strong></td>
                  <td><span className={`badge ${reg.isOpen ? 'badge-success' : 'badge-default'}`}>{reg.isOpen ? 'Abierta' : 'Cerrada'}</span></td>
                  <td>{reg.openedAt ? new Date(reg.openedAt).toLocaleString() : '-'}</td>
                  <td>{reg.closedAt ? new Date(reg.closedAt).toLocaleString() : '-'}</td>
                  <td>{formatCurrency(reg.openingAmount)}</td>
                  <td>{reg.closingAmount ? formatCurrency(reg.closingAmount) : '-'}</td>
                  <td>{reg.openedByUser?.name || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="data-table-container">
          <div className="report-table-header">
            <div className="report-table-title">
              <h3>Inventario</h3>
              <span className="badge">{productsDetail.length} productos</span>
            </div>
            <div className="report-table-actions">
              <button className="btn btn-outline" onClick={() => exportToExcel('inventory')}><i className="fas fa-file-excel"></i> Excel</button>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr><th>Producto</th><th>SKU</th><th>Categoría</th><th>Precio</th><th>Costo</th><th>Stock</th><th>Valor</th></tr>
            </thead>
            <tbody>
              {productsDetail.map(prod => (
                <tr key={prod.id}>
                  <td><strong>{prod.name}</strong></td>
                  <td>{prod.sku}</td>
                  <td>{prod.category?.name || '-'}</td>
                  <td>{formatCurrency(prod.price)}</td>
                  <td>{formatCurrency(prod.cost)}</td>
                  <td><span className={`badge ${prod.stock <= prod.minStock ? 'badge-danger' : prod.stock <= prod.minStock * 2 ? 'badge-warning' : 'badge-success'}`}>{prod.stock}</span></td>
                  <td>{formatCurrency(prod.price * prod.stock)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'company' && (
        <div className="general-report">
          <div className="general-report-section" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
            <button className="btn btn-outline" onClick={() => exportToExcel('company')}><i className="fas fa-file-excel"></i> Excel</button>
          </div>
          <div className="general-report-section">
            <h3><i className="fas fa-building"></i> Estado de la Empresa</h3>
            <div className="general-stats-grid">
              <StatCard icon="shopping-cart" label="Ventas del Mes" value={formatCurrency(companyStatus?.sales?.month?.amount || 0)} subValue={`${companyStatus?.sales?.month?.count || 0} transacciones`} type="sales" />
              <StatCard icon="hand-holding-usd" label="CxC Total" value={formatCurrency(companyStatus?.accounts?.receivable || 0)} subValue={`${companyStatus?.clientsWithDebt || 0} clientes`} type="receivable" />
              <StatCard icon="file-invoice-dollar" label="CxP Total" value={formatCurrency(companyStatus?.accounts?.payable || 0)} subValue={`${companyStatus?.suppliersWithDebt || 0} proveedores`} type="payable" />
              <StatCard icon="boxes" label="Inventario" value={formatCurrency(companyStatus?.inventory?.value || 0)} subValue={`${companyStatus?.inventory?.totalProducts || 0} productos`} type="inventory" />
            </div>
          </div>
          <div className="general-charts-grid">
            <div className="general-chart-card">
              <h4><i className="fas fa-calculator"></i> Resumen del Mes</h4>
              <div style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span>Ingresos del Mes:</span>
                  <strong style={{ color: 'var(--secondary)' }}>{formatCurrency(companyStatus?.accounting?.monthIncome || 0)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span>Gastos del Mes:</span>
                  <strong style={{ color: 'var(--danger)' }}>{formatCurrency(companyStatus?.accounting?.monthExpenses || 0)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', background: 'var(--bg-surface-hover)', borderRadius: '8px', marginTop: '8px' }}>
                  <span><strong>Balance Neto:</strong></span>
                  <strong style={{ color: companyStatus?.accounting?.netBalance >= 0 ? 'var(--secondary)' : 'var(--danger)', fontSize: '1.2rem' }}>
                    {formatCurrency(companyStatus?.accounting?.netBalance || 0)}
                  </strong>
                </div>
              </div>
            </div>
            <div className="general-chart-card">
              <h4><i className="fas fa-hand-holding-usd"></i> Posición de Cuentas</h4>
              <div style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span>Cuentas por Cobrar:</span>
                  <strong style={{ color: 'var(--secondary)' }}>{formatCurrency(companyStatus?.accounts?.receivable || 0)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span>Cuentas por Pagar:</span>
                  <strong style={{ color: 'var(--danger)' }}>{formatCurrency(companyStatus?.accounts?.payable || 0)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', background: 'var(--bg-surface-hover)', borderRadius: '8px', marginTop: '8px' }}>
                  <span><strong>Posición Neta:</strong></span>
                  <strong style={{ color: companyStatus?.accounts?.netPosition >= 0 ? 'var(--secondary)' : 'var(--danger)', fontSize: '1.2rem' }}>
                    {formatCurrency(companyStatus?.accounts?.netPosition || 0)}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default Reports;
