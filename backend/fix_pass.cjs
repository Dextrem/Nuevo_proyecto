const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function fix() {
  // Update password for caja1 user
  const newPassword = await bcrypt.hash('admin123', 12);
  
  await prisma.user.update({
    where: { username: 'caja1' },
    data: { password: newPassword }
  });
  
  console.log('Password de caja1 actualizada a: admin123');
  
  await prisma.$disconnect();
}

fix();
