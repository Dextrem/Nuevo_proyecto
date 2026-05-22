const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sequences = [
    { type: '01', name: 'Factura de Crédito Fiscal', prefix: 'B01', limit: 99999999 },
    { type: '02', name: 'Factura de Consumo', prefix: 'B02', limit: 99999999 },
    { type: '14', name: 'Comprobante Regímenes Especiales', prefix: 'B14', limit: 99999999 },
    { type: '15', name: 'Comprobante Gubernamental', prefix: 'B15', limit: 99999999 }
  ];

  for (const seq of sequences) {
    await prisma.fiscalSequence.upsert({
      where: { type: seq.type },
      update: {},
      create: {
        type: seq.type,
        name: seq.name,
        prefix: seq.prefix,
        limit: seq.limit,
        current: 1,
        active: true
      }
    });
  }
  console.log('Secuencias fiscales inicializadas');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
