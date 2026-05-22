const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function check() {
  console.log('=== Cajas en la base de datos ===');
  const registers = await prisma.cashRegister.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log(JSON.stringify(registers.map(r => ({
    id: r.id,
    name: r.name,
    isOpen: r.isOpen,
    openedBy: r.openedBy,
    currentAmount: r.currentAmount
  })), null, 2));
  
  console.log('\n=== Usuarios ===');
  const users = await prisma.user.findMany({
    select: { id: true, username: true, name: true }
  });
  console.log(JSON.stringify(users, null, 2));
  
  await prisma.$disconnect();
}

check();
