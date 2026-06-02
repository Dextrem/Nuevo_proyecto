const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkCashRegisters() {
  console.log('=== Cajas (cash_registers) ===');
  const registers = await prisma.cashRegister.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log(JSON.stringify(registers, null, 2));
  
  console.log('\n=== Cajas Abiertas ===');
  const openRegisters = await prisma.cashRegister.findMany({
    where: { isOpen: true }
  });
  console.log(JSON.stringify(openRegisters, null, 2));
  
  console.log('\n=== Usuarios ===');
  const users = await prisma.user.findMany({
    select: { id: true, username: true, name: true, role: true }
  });
  console.log(JSON.stringify(users, null, 2));
  
  await prisma.$disconnect();
}

checkCashRegisters();
