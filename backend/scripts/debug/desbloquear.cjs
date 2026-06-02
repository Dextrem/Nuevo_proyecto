const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function desbloquear() {
  await prisma.user.updateMany({
    where: {
      failedLoginAttempts: { gt: 0 }
    },
    data: {
      failedLoginAttempts: 0,
      lockUntil: null,
      lastLoginAttempt: null
    }
  });
  console.log('Usuarios desbloqueados');
  
  const usuarios = await prisma.user.findMany({
    select: { id: true, username: true, failedLoginAttempts: true, lockUntil: true }
  });
  console.log('Estado actual:', usuarios);
  await prisma.$disconnect();
}

desbloquear();
