import * as XLSX from 'xlsx';

const TEMPLATE_HEADERS = [
  { header: 'name', label: 'Nombre del Producto', required: true, example: 'Camisa Manga Larga' },
  { header: 'sku', label: 'SKU/Código', required: true, example: 'CAM-001' },
  { header: 'price', label: 'Precio', required: true, example: '29.99' },
  { header: 'stock', label: 'Stock Inicial', required: true, example: '50' },
  { header: 'description', label: 'Descripción', required: false, example: 'Camisa de algodón manga larga' },
  { header: 'barcode', label: 'Código de Barras', required: false, example: '7501234567890' },
  { header: 'cost', label: 'Costo', required: false, example: '15.00' },
  { header: 'minStock', label: 'Stock Mínimo', required: false, example: '10' },
];

export const generateProductTemplate = () => {
  const wsData = [
    TEMPLATE_HEADERS.map(h => h.label),
    ['Camisa Manga Larga', 'CAM-001', '29.99', '50', 'Camisa de algodón', '7501234567890', '15.00', '10'],
    ['Pantalón Jean', 'PAN-002', '45.00', '30', 'Pantalón denim', '', '25.00', '5'],
    ['Zapatos Casuales', 'ZAP-003', '65.00', '20', 'Zapatos de cuero', '7509876543210', '40.00', '5'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  ws['!cols'] = [
    { wch: 30 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
    { wch: 40 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Productos');

  XLSX.writeFile(wb, 'finandex_plantilla_productos.xlsx');
};

export const exportProductsToExcel = (products, filename = 'productos') => {
  const wsData = [
    ['Nombre', 'SKU', 'Precio', 'Stock', 'Stock Mínimo', 'Costo', 'Descripción', 'Código de Barras', 'Categoría', 'Activo'],
    ...products.map(p => [
      p.name,
      p.sku,
      p.price,
      p.stock,
      p.minStock,
      p.cost,
      p.description,
      p.barcode,
      p.category?.name || '',
      p.active ? 'Sí' : 'No',
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [
    { wch: 30 },
    { wch: 15 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 40 },
    { wch: 15 },
    { wch: 20 },
    { wch: 8 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Productos');

  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const exportToCSV = (data, headers, filename) => {
  const ws = XLSX.utils.json_to_sheet(data, { header: headers });
  const csv = XLSX.utils.sheet_to_csv(ws);
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

export { TEMPLATE_HEADERS };
