import * as XLSX from 'xlsx';
import { downloadFile } from './helpers';

const workbookDefaults = {
  creator: 'Finandex',
  date: new Date().toISOString(),
};

export const exportToExcel = ({ filename, sheets }) => {
  const wb = XLSX.utils.book_new();
  wb.Props = workbookDefaults;

  sheets.forEach(({ name, data, columns }) => {
    const headers = columns.map(c => c.header);
    const rows = data.map(row =>
      columns.map(c => {
        const val = c.accessor(row);
        return val !== null && val !== undefined ? val : '';
      })
    );
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Column widths
    ws['!cols'] = columns.map(c => ({ wch: c.width || 15 }));

    XLSX.utils.book_append_sheet(wb, ws, name);
  });

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadFile(wbout, `${filename}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
};

export const exportSalesToExcel = (sales, filename = 'facturas') => {
  exportToExcel({
    filename,
    sheets: [{
      name: 'Facturas',
      data: sales,
      columns: [
        { header: 'Factura', accessor: s => s.invoiceNumber || 'N/A', width: 15 },
        { header: 'Fecha', accessor: s => new Date(s.createdAt).toLocaleDateString('es-ES'), width: 12 },
        { header: 'Cliente', accessor: s => s.client?.name || 'Venta General', width: 25 },
        { header: 'Método', accessor: s => s.paymentMethod === 'CASH' ? 'Efectivo' : s.paymentMethod === 'CARD' ? 'Tarjeta' : 'Crédito', width: 12 },
        { header: 'Subtotal', accessor: s => s.subtotal || 0, width: 12 },
        { header: 'ITBIS', accessor: s => s.tax || 0, width: 10 },
        { header: 'Descuento', accessor: s => s.discount || 0, width: 10 },
        { header: 'Total', accessor: s => s.total || 0, width: 12 },
        { header: 'Pagado', accessor: s => s.paidAmount || 0, width: 12 },
        { header: 'NCF', accessor: s => s.ncf || '', width: 20 },
        { header: 'Estado', accessor: s =>
          s.status === 'COMPLETED' ? 'Pagada' : s.status === 'PENDING' ? 'Pendiente' : s.status === 'PARTIAL' ? 'Parcial' : 'Cancelada',
          width: 12 },
      ],
    }],
  });
};

export const exportARToExcel = (sales, summary, filename = 'cuentas_por_cobrar') => {
  const sorted = [...sales].sort((a, b) => (a.dueDate || '') > (b.dueDate || '') ? 1 : -1);
  exportToExcel({
    filename,
    sheets: [{
      name: 'CxC',
      data: sorted,
      columns: [
        { header: 'Factura', accessor: s => s.invoiceNumber || 'N/A', width: 15 },
        { header: 'Cliente', accessor: s => s.client?.name || 'N/A', width: 25 },
        { header: 'Fecha Venta', accessor: s => new Date(s.createdAt).toLocaleDateString('es-ES'), width: 12 },
        { header: 'Vencimiento', accessor: s => s.dueDate ? new Date(s.dueDate).toLocaleDateString('es-ES') : '-', width: 12 },
        { header: 'Días Rest.', accessor: s => {
          if (!s.dueDate) return '-';
          const d = Math.ceil((new Date(s.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
          return d < 0 ? `Vencido ${Math.abs(d)}` : `${d}`;
        }, width: 12 },
        { header: 'Total', accessor: s => s.total || 0, width: 12 },
        { header: 'Pagado', accessor: s => s.paidAmount || 0, width: 12 },
        { header: 'Pendiente', accessor: s => (s.total - s.paidAmount) || 0, width: 12 },
        { header: 'Estado', accessor: s =>
          (s.total - s.paidAmount) <= 0 ? 'Pagado' :
          s.dueDate && new Date(s.dueDate) < new Date() ? 'Vencido' :
          s.status === 'PARTIAL' ? 'Parcial' : 'Pendiente',
          width: 12 },
      ],
    }, {
      name: 'Resumen',
      data: [summary],
      columns: [
        { header: 'Total Pendiente', accessor: s => s.totalPending || 0, width: 18 },
        { header: 'Total Ventas', accessor: s => s.totalSales || 0, width: 15 },
        { header: 'Fact. Pendientes', accessor: s => s.countPending || 0, width: 18 },
        { header: 'Fact. Parciales', accessor: s => s.countPartial || 0, width: 18 },
      ],
    }],
  });
};

export const exportInventoryToExcel = (products, filename = 'inventario') => {
  exportToExcel({
    filename,
    sheets: [{
      name: 'Inventario',
      data: products,
      columns: [
        { header: 'SKU', accessor: p => p.sku || '', width: 12 },
        { header: 'Producto', accessor: p => p.name, width: 30 },
        { header: 'Categoría', accessor: p => p.category?.name || 'Sin categoría', width: 20 },
        { header: 'Stock', accessor: p => p.stock || 0, width: 8 },
        { header: 'Stock Mínimo', accessor: p => p.minStock || 0, width: 12 },
        { header: 'Costo', accessor: p => p.costPrice || 0, width: 10 },
        { header: 'Precio', accessor: p => p.price || 0, width: 10 },
        { header: 'Estado', accessor: p => p.active !== false ? 'Activo' : 'Inactivo', width: 10 },
      ],
    }],
  });
};

export const exportClientsToExcel = (clients, filename = 'clientes') => {
  exportToExcel({
    filename,
    sheets: [{
      name: 'Clientes',
      data: clients,
      columns: [
        { header: 'Nombre', accessor: c => c.name, width: 25 },
        { header: 'RNC/Cédula', accessor: c => c.rnc || c.documentId || '', width: 15 },
        { header: 'Teléfono', accessor: c => c.phone || '', width: 15 },
        { header: 'Email', accessor: c => c.email || '', width: 25 },
        { header: 'Balance', accessor: c => c.balance || 0, width: 12 },
        { header: 'Límite Crédito', accessor: c => c.creditLimit || 0, width: 14 },
        { header: 'Activo', accessor: c => c.active !== false ? 'Sí' : 'No', width: 8 },
      ],
    }],
  });
};

export const exportAccountMovementsToExcel = (movements, filename = 'movimientos') => {
  exportToExcel({
    filename,
    sheets: [{
      name: 'Movimientos',
      data: movements,
      columns: [
        { header: 'Fecha', accessor: m => new Date(m.createdAt).toLocaleString('es-ES'), width: 18 },
        { header: 'Tipo', accessor: m => m.type === 'INCOME' ? 'Ingreso' : 'Egreso', width: 10 },
        { header: 'Descripción', accessor: m => m.description || '', width: 35 },
        { header: 'Referencia', accessor: m => m.reference || '', width: 15 },
        { header: 'Monto', accessor: m => m.amount || 0, width: 12 },
        { header: 'Usuario', accessor: m => m.user?.name || m.user?.username || '', width: 18 },
      ],
    }],
  });
};
