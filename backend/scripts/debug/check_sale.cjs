const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const sale = await p.sale.findFirst({ orderBy: { createdAt: 'desc' }, select: { id: true, invoiceNumber: true, hasWarranty: true, warrantyData: true, paymentMethod: true, clientId: true } });
  console.log(JSON.stringify(sale));
  await p.$disconnect();
}
main().catch(e => { p.$disconnect(); });
