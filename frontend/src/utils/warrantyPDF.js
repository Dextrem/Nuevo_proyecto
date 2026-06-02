import jsPDF from 'jspdf';

const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const generateWarrantyPDF = (warranty, settings) => {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  const primary = settings.primaryColor || '#10B981';

  // Watermark
  doc.saveGraphicsState();
  doc.setGState(new doc.GState({ opacity: 0.12 }));
  doc.setTextColor(180, 180, 180);
  doc.setFontSize(50);
  doc.setFont('Helvetica', 'bold');
  doc.text('GARANT\u00cdA', pageW / 2, doc.internal.pageSize.getHeight() / 2, { angle: -45, align: 'center' });
  doc.restoreGraphicsState();

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

  // Certificate bar
  doc.setFillColor(primary);
  doc.roundedRect(margin, 45, contentW, 8, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('Helvetica', 'bold');
  const certId = warranty.id ? `GAR-${warranty.id.slice(0, 8).toUpperCase()}` : 'N/A';
  doc.text(`CERTIFICADO: ${certId}`, margin + 3, 51);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Emisi\u00f3n: ${formatDate(warranty.issueDate)}`, pageW - margin - 50, 51, { align: 'right' });
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`Vence: ${formatDate(warranty.expiryDate)}`, pageW - margin - 3, 51, { align: 'right' });

  y = 62;

  // Title
  doc.setFillColor(236, 253, 245);
  doc.roundedRect(margin, y, contentW, 12, 2, 2, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(16, 185, 129);
  doc.text('CERTIFICADO DE GARANT\u00cdA', pageW / 2, y + 8, { align: 'center' });
  y += 18;

  // Client info
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(margin, y, contentW, 20, 2, 2, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  doc.text('Cliente:', margin + 3, y + 6);
  doc.setFont('Helvetica', 'normal');
  doc.text(warranty.clientName || '', margin + 15, y + 6);
  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  if (warranty.clientRnc) doc.text(`RNC: ${warranty.clientRnc}`, margin + 3, y + 14);
  if (warranty.clientPhone) doc.text(`Tel: ${warranty.clientPhone}`, margin + 60, y + 14);
  y += 26;

  // Warranty period
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(margin, y, contentW, 16, 2, 2, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 64, 175);
  doc.text('Per\u00edodo de Garant\u00eda', margin + 3, y + 6);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);
  doc.text(`Emisi\u00f3n: ${formatDate(warranty.issueDate)}`, margin + 3, y + 12);
  doc.text(`Vence: ${formatDate(warranty.expiryDate)}`, margin + 55, y + 12);
  doc.text(`D\u00edas: ${warranty.days}`, margin + 108, y + 12);

  // Sale reference if linked (right-aligned to avoid overflow)
  if (warranty.sale) {
    doc.text(`Factura: #${warranty.sale.invoiceNumber}`, margin + contentW - 3, y + 12, { align: 'right' });
  }
  y += 22;

  // Coverage section
  const pageH = doc.internal.pageSize.getHeight();
  if (y > pageH - 70) { doc.addPage(); y = margin; }
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  doc.text('Cobertura:', margin, y);
  y += 6;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  if (warranty.coverage) {
    const coverageLines = doc.splitTextToSize(warranty.coverage, contentW);
    if (y + coverageLines.length * 5 > pageH - 40) { doc.addPage(); y = margin; }
    doc.text(coverageLines, margin, y);
    y += coverageLines.length * 5 + 4;
  } else {
    doc.text('No especificada', margin, y);
    y += 8;
  }

  // Exclusions section
  if (y > pageH - 70) { doc.addPage(); y = margin; }
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  doc.text('Exclusiones:', margin, y);
  y += 6;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  if (warranty.exclusions) {
    const exclusionLines = doc.splitTextToSize(warranty.exclusions, contentW);
    if (y + exclusionLines.length * 5 > pageH - 40) { doc.addPage(); y = margin; }
    doc.text(exclusionLines, margin, y);
    y += exclusionLines.length * 5 + 4;
  } else {
    doc.text('No especificadas', margin, y);
    y += 8;
  }

  // Created by
  if (y + 10 > pageH - 20) { doc.addPage(); y = margin; }
  y = Math.max(y + 6, pageH - 35);
  doc.setFontSize(8);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(130, 130, 130);
  const creadoPor = warranty.createdBy?.name || warranty.createdBy?.username || 'N/A';
  doc.text(`Emitido por: ${creadoPor}`, margin, y);
  doc.text(`Fecha de creaci\u00f3n: ${formatDate(warranty.createdAt)}`, margin, y + 4);

  // Footer
  y = doc.internal.pageSize.getHeight() - 20;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.text(`Generado el ${new Date().toLocaleString('es-ES')}`, margin, y + 5);
  doc.text('Documento v\u00e1lido como certificado de garant\u00eda', pageW - margin, y + 5, { align: 'right' });

  return doc;
};
