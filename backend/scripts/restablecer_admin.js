import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetAdminPassword() {
  console.log('Iniciando restablecimiento de contraseña para admin...');
  try {
    // Buscar al usuario admin
    const adminUser = await prisma.user.findUnique({
      where: { username: 'admin' }
    });

    if (!adminUser) {
      console.log('No se encontró un usuario con el username "admin".');
      return;
    }

    // Generar nueva contraseña: "Admin123!"
    // Cumple con las reglas: 8+ caracteres, mayúscula, minúscula, número, especial.
    const newPassword = 'Admin123!';
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Actualizar usuario: nueva contraseña, desbloquear cuenta, restablecer intentos
    await prisma.user.update({
      where: { username: 'admin' },
      data: {
        password: hashedPassword,
        failedLoginAttempts: 0,
        lockUntil: null,
        active: true
      }
    });

    console.log('✓ Contraseña del usuario "admin" restablecida con éxito.');
    console.log('----------------------------------------------------');
    console.log('NUEVO USUARIO: admin');
    console.log(`NUEVA CONTRASEÑA: ${newPassword}`);
    console.log('----------------------------------------------------');
    console.log('Nota: El sistema no tiene expiración de contraseñas, por lo que esta contraseña nunca expirará.');

  } catch (error) {
    console.error('Error al restablecer la contraseña:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetAdminPassword();
