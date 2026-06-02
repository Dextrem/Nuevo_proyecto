const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fix() {
  // Close all duplicate open boxes
  await prisma.$executeRaw`
    UPDATE cash_registers 
    SET "isOpen" = false, "closedAt" = NOW(), "closedBy" = "openedBy", "closingAmount" = "currentAmount"
    WHERE "isOpen" = true AND name = 'caja1'
  `;
  console.log('Caja caja1 cerrada');
  
  // Verify
  const registers = await prisma.cashRegister.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('Cajas:', registers.map(r => ({name: r.name, isOpen: r.isOpen})));
  
  await prisma.$disconnect();
}

fix();
