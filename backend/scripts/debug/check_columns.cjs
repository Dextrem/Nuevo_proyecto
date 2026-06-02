const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkColumns() {
  try {
    const result = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'monthly_closings'
    `;
    console.log('Columnas en monthly_closings:');
    result.forEach(c => console.log('- ' + c.column_name));
  } catch (e) {
    console.log('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkColumns();