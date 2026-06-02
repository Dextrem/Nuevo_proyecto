const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verificar() {
  const usuario = await prisma.user.findFirst({
    where: { username: 'admin2' }
  });
  console.log('Usuario admin2:', usuario ? 'Encontrado' : 'No encontrado');
  if (usuario) {
    console.log('Username en BD:', usuario.username);
  }
  await prisma.$disconnect();
}

verificar();
