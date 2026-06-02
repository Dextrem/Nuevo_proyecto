import prisma from '../config/database.js';

export const generateInvoiceNumber = async () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  const prefix = `INV-${year}${month}${day}-`;

  return await prisma.$transaction(async (tx) => {
    const lastSale = await tx.sale.findFirst({
      where: {
        invoiceNumber: {
          startsWith: prefix,
        },
      },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });

    let sequence = 1;
    if (lastSale) {
      const lastSequence = parseInt(lastSale.invoiceNumber.split('-').pop());
      sequence = lastSequence + 1;
    }

    return `${prefix}${String(sequence).padStart(4, '0')}`;
  });
};
