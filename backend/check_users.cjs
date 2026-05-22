const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const userCount = await prisma.user.count();
    console.log('Total usuarios:', userCount);
    const firstUser = await prisma.user.findFirst();
    console.log('Primer usuario:', firstUser ? firstUser.username : 'Ninguno');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
