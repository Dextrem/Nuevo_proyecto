import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function unlockAdmin() {
  console.log('Desbloqueando usuario admin...');
  try {
    const admin = await prisma.user.update({
      where: { username: 'admin' },
      data: {
        failedLoginAttempts: 0,
        lockUntil: null
      }
    });
    console.log(`✓ Usuario ${admin.username} desbloqueado con éxito.`);
  } catch (error) {
    console.error('Error al desbloquear:', error);
  } finally {
    await prisma.$disconnect();
  }
}

unlockAdmin();
