import jsPDF from 'jspdf';

const formatCurrency = (amount, symbol = 'RD$') => {
  if (amount === null || amount === undefined || isNaN(amount)) return `${symbol} 0.00`;
  return `${symbol} ${Number(amount).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const generateInvoicePDF = (invoice, settings) => {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  const primary = settings.primaryColor || '#4F46E5';

  // Watermark for warranty
  if (invoice.hasWarranty) {
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.12 }));
    doc.setTextColor(180, 180, 180);
    doc.setFontSize(50);
    doc.setFont('Helvetica', 'bold');
    doc.text('CON GARANTÍA', pageW / 2, doc.internal.pageSize.getHeight() / 2, { angle: -45, align: 'center' });
    doc.restoreGraphicsState();
  }

  // Header background
  doc.setFillColor(247, 250, 252);
  doc.rect(0, 0, pageW, 55, 'F');

  // Company info
  doc.setTextColor(30, 30, 30);
  if (settings.logo) {
    try { doc.addImage(settings.logo, 'PNG', margin, 8, 35, 25); } catch {}
  }
  doc.setFontSize(18);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text(settings.companyName || 'Finandex', margin + 45, 18);

  doc.setFontSize(8);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(130, 130, 130);
  if (settings.companyRnc) doc.text(`RNC: ${settings.companyRnc}`, margin + 45, 25);
  if (settings.companyAddress) doc.text(settings.companyAddress, margin + 45, 30);
  if (settings.companyPhone) doc.text(`Tel: ${settings.companyPhone}`, margin + 45, 35);
  if (settings.companyWebsite) doc.text(settings.companyWebsite, margin + 45, 40);

  // Invoice number & status
  doc.setFillColor(primary);
  doc.roundedRect(margin, 45, contentW, 8, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('Helvetica', 'bold');
  doc.text(`FACTURA: ${invoice.invoiceNumber || 'N/A'}`, margin + 3, 51);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Fecha: ${formatDate(invoice.createdAt)}`, margin + 3, 51);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(invoice.ncf ? `NCF: ${invoice.ncf}` : 'Sin NCF', pageW - margin - 40, 51, { align: 'right' });

  y = 62;

  // Client info
  if (invoice.client) {
    doc.setFillColor(243, 244, 246);
    doc.roundedRect(margin, y, contentW, 18, 2, 2, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text('Cliente:', margin + 3, y + 6);
    doc.setFont('Helvetica', 'normal');
    doc.text(invoice.client.name || '', margin + 15, y + 6);
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    if (invoice.client.rnc) doc.text(`RNC: ${invoice.client.rnc}`, margin + 3, y + 14);
    if (invoice.client.phone) doc.text(`Tel: ${invoice.client.phone}`, margin + 60, y + 14);
    y += 24;
  }

  // Items table header (columna Total ampliada para que quepan montos grandes)
  const colX = [margin, margin + 65, margin + 105, margin + 135, margin + 160];

  doc.setFillColor(primary);
  doc.roundedRect(margin, y, contentW, 7, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('Helvetica', 'bold');
  doc.text('Producto', colX[0] + 2, y + 5);
  doc.text('Cantidad', colX[1] + 2, y + 5);
  doc.text('Precio', colX[2] + 2, y + 5);
  doc.text('ITBIS', colX[3] + 2, y + 5);
  doc.text('Total', colX[4] + 2, y + 5);
  y += 10;

  // Items
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);
  const items = invoice.items || [];
  items.forEach((item, i) => {
    if (y > 260) {
      doc.addPage();
      y = margin;
    }
    if (i % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, y - 2, contentW, 7, 'F');
    }
    doc.text(item.product?.name || 'Producto', colX[0] + 2, y + 3);
    doc.text(String(item.quantity), colX[1] + 2, y + 3);
    doc.text(formatCurrency(item.price), colX[2] + 2, y + 3);
    doc.text(formatCurrency(item.tax || 0), colX[3] + 2, y + 3);
    doc.text(formatCurrency(item.total), colX[4] + 2, y + 3);
    y += 7;
  });

  y += 4;

  // Totals (caja de 120mm para evitar desbordamiento con montos grandes)
  const totalsWidth = 120;
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(margin + contentW - totalsWidth, y, totalsWidth, 40, 2, 2, 'F');
  let ty = y + 8;
  doc.setFontSize(9);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(50, 50, 50);

  doc.setFont('Helvetica', 'normal');
  doc.text('Subtotal:', margin + contentW - totalsWidth + 5, ty);
  doc.text(formatCurrency(invoice.subtotal), margin + contentW - 5, ty, { align: 'right' });
  ty += 7;
  doc.text('ITBIS:', margin + contentW - totalsWidth + 5, ty);
  doc.text(formatCurrency(invoice.tax), margin + contentW - 5, ty, { align: 'right' });
  ty += 7;
  if (invoice.discount > 0) {
    doc.setTextColor(220, 38, 38);
    doc.text('Descuento:', margin + contentW - totalsWidth + 5, ty);
    doc.text(`-${formatCurrency(invoice.discount)}`, margin + contentW - 5, ty, { align: 'right' });
    ty += 7;
    doc.setTextColor(50, 50, 50);
  }

  if (invoice.shippingCost > 0) {
    doc.text('Envío:', margin + contentW - totalsWidth + 5, ty);
    doc.text(formatCurrency(invoice.shippingCost), margin + contentW - 5, ty, { align: 'right' });
    ty += 7;
  }

  // Total line
  doc.setDrawColor(primary);
  doc.setLineWidth(0.5);
  doc.line(margin + contentW - totalsWidth + 5, ty, margin + contentW - 5, ty);
  ty += 5;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(primary);
  doc.text('TOTAL:', margin + contentW - totalsWidth + 5, ty);
  doc.text(formatCurrency(invoice.total), margin + contentW - 5, ty, { align: 'right' });

  y += 50;

  // Payment info
  if (invoice.paymentMethod) {
    doc.setFontSize(8);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(130, 130, 130);
    doc.text(`Método de pago: ${invoice.paymentMethod === 'CASH' ? 'Efectivo' : invoice.paymentMethod === 'CARD' ? 'Tarjeta' : 'Crédito'}`, margin, y);
    doc.text(`Pagado: ${formatCurrency(invoice.paidAmount)}`, margin, y + 4);
    if (invoice.change > 0) doc.text(`Cambio: ${formatCurrency(invoice.change)}`, margin + 60, y + 4);
    if (invoice.status === 'PENDING' || invoice.status === 'PARTIAL') {
      doc.text(`Pendiente: ${formatCurrency(invoice.total - invoice.paidAmount)}`, margin, y + 8);
    }
  }

  // Warranty section
  if (invoice.hasWarranty && invoice.warrantyData) {
    const wd = invoice.warrantyData;
    y = Math.max(y + 10, 185);
    doc.setFillColor(243, 244, 246);
    doc.roundedRect(margin, y, contentW, 32, 2, 2, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    doc.text('CERTIFICADO DE GARANTÍA', margin + 3, y + 6);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(`Vigencia: ${wd.days} días (vence ${new Date(wd.expiryDate).toLocaleDateString('es-DO')})`, margin + 3, y + 13);
    if (wd.coverage) doc.text(`Cobertura: ${wd.coverage}`, margin + 3, y + 19);
    if (wd.exclusions) doc.text(`Excluye: ${wd.exclusions}`, margin + 3, y + 25);
    y += 38;
  }

  // Footer
  y = doc.internal.pageSize.getHeight() - 20;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.text(`Generado el ${new Date().toLocaleString('es-ES')}`, margin, y + 5);
  doc.text(settings.receiptFooterMessage || 'Gracias por su preferencia', pageW - margin, y + 5, { align: 'right' });

  return doc;
};

export const generateARReportPDF = (sales, summary, companyName, currencySymbol) => {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  const primary = '#4F46E5';

  // Header
  doc.setFillColor(247, 250, 252);
  doc.rect(0, 0, pageW, 40, 'F');
  doc.setFontSize(16);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text('Reporte de Cuentas por Cobrar', margin, 18);
  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(130, 130, 130);
  doc.text(`${companyName || 'Finandex'} | Generado: ${new Date().toLocaleString('es-ES')}`, margin, 25);

  // Summary cards
  doc.setFillColor(primary);
  doc.roundedRect(margin, 32, contentW / 3 - 4, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text('Total Pendiente', margin + 4, 37);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(formatCurrency(summary.totalPending, currencySymbol), margin + 4, 42);
  doc.setFont('Helvetica', 'normal');

  doc.setFillColor(245, 158, 11);
  doc.roundedRect(margin + contentW / 3 + 2, 32, contentW / 3 - 4, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text('Facturas Pendientes', margin + contentW / 3 + 6, 37);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(String(summary.countPending), margin + contentW / 3 + 6, 42);
  doc.setFont('Helvetica', 'normal');

  doc.setFillColor(16, 185, 129);
  doc.roundedRect(margin + 2 * contentW / 3 + 4, 32, contentW / 3 - 4, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text('Facturas Parciales', margin + 2 * contentW / 3 + 8, 37);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(String(summary.countPartial), margin + 2 * contentW / 3 + 8, 42);
  doc.setFont('Helvetica', 'normal');

  y = 52;

  // Table header
  const colX = [margin, margin + 40, margin + 85, margin + 120, margin + 148, margin + 175];
  doc.setFillColor(primary);
  doc.roundedRect(margin, y, contentW, 7, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('Helvetica', 'bold');
  doc.text('Factura', colX[0] + 2, y + 5);
  doc.text('Cliente', colX[1] + 2, y + 5);
  doc.text('Vencimiento', colX[2] + 2, y + 5);
  doc.text('Total', colX[3] + 2, y + 5);
  doc.text('Pagado', colX[4] + 2, y + 5);
  doc.text('Pendiente', colX[5] + 2, y + 5);
  y += 10;

  // Items
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);
  (sales || []).forEach((sale, i) => {
    if (y > 252) {
      doc.addPage();
      y = margin;
    }
    const pending = sale.total - sale.paidAmount;
    if (i % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, y - 2, contentW, 7, 'F');
    }
    const daysUntil = sale.dueDate ? Math.ceil((new Date(sale.dueDate) - new Date()) / (1000 * 60 * 60 * 24)) : null;
    if (daysUntil !== null && daysUntil < 0) {
      doc.setTextColor(220, 38, 38);
    } else {
      doc.setTextColor(50, 50, 50);
    }
    doc.text(sale.invoiceNumber || 'N/A', colX[0] + 2, y + 3);
    doc.text(sale.client?.name || 'N/A', colX[1] + 2, y + 3);
    doc.text(sale.dueDate ? formatDate(sale.dueDate) : '-', colX[2] + 2, y + 3);
    doc.text(formatCurrency(sale.total, currencySymbol), colX[3] + 2, y + 3);
    doc.text(formatCurrency(sale.paidAmount, currencySymbol), colX[4] + 2, y + 3);
    doc.setFont('Helvetica', 'bold');
    doc.text(formatCurrency(pending, currencySymbol), colX[5] + 2, y + 3);
    doc.setFont('Helvetica', 'normal');
    y += 7;
  });

  // Footer total
  y = Math.max(y + 8, 252);
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(margin + contentW - 100, y, 100, 10, 2, 2, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(primary);
  doc.text(`TOTAL PENDIENTE: ${formatCurrency(summary.totalPending, currencySymbol)}`, margin + contentW - 95, y + 7);

  return doc;
};

export const generateReminderPDF = (sale, message, companyName) => {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const margin = 20;
  const pageW = doc.internal.pageSize.getWidth();
  let y = margin;

  // Header
  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, pageW, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('Helvetica', 'bold');
  doc.text('RECORDATORIO DE PAGO', pageW / 2, 8, { align: 'center' });

  y = 25;
  if (companyName) {
    doc.setFontSize(14);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text(companyName, margin, y);
    y += 10;
  }

  doc.setFontSize(8);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(130, 130, 130);
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, margin, y);
  y += 6;
  doc.text(`Factura: ${sale.invoiceNumber || 'N/A'}`, margin, y);
  y += 10;

  // Message content
  const lines = (message || '').split('\n');
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  lines.forEach(line => {
    if (y > 255) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += 5;
  });

  return doc;
};
