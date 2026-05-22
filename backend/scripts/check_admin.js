import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- DATABASE USER CHECK ---');
  try {
    const allUsers = await prisma.user.findMany({
      select: { username: true, role: true, active: true }
    });
    console.log('All Users:', JSON.stringify(allUsers, null, 2));

    const admin = await prisma.user.findUnique({
      where: { username: 'admin' }
    });

    if (!admin) {
      console.log('Admin user NOT FOUND. Creating one...');
      const hashedPassword = await bcrypt.hash('admin', 10);
      await prisma.user.create({
        data: {
          username: 'admin',
          password: hashedPassword,
          name: 'Administrator',
          role: 'ADMIN',
          active: true
        }
      });
      console.log('✓ Admin user created with password: admin');
    } else {
      // Reset password to just 'admin'
      const hashedPassword = await bcrypt.hash('admin', 10);
      await prisma.user.update({
        where: { username: 'admin' },
        data: {
          password: hashedPassword,
          active: true,
          failedLoginAttempts: 0,
          lockUntil: null
        }
      });
      console.log('✓ Admin user "admin" is active and password reset to: admin');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
