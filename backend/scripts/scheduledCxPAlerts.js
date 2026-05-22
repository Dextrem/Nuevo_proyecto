import prisma from '../src/config/database.js';
import { sendMail } from '../src/services/emailService.js';
import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(new URL('../logs', import.meta.url).pathname);
const LOG_FILE = path.join(LOG_DIR, 'cxp-alerts.log');

const ensureLogsDir = async () => {
  try {
    await fs.promises.access(LOG_DIR);
  } catch {
    await fs.promises.mkdir(LOG_DIR, { recursive: true });
  }
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(value);

const checkAging = async () => {
  const now = new Date();
  const soon = new Date();
  soon.setDate(now.getDate() + 7);

  const overdue = await prisma.supplierInvoice.findMany({
    where: { paid: false, dueDate: { lt: now } }
  });

  const dueSoon = await prisma.supplierInvoice.findMany({
    where: { paid: false, dueDate: { gte: now, lte: soon } }
  });

  const messages = [];

  if (overdue.length > 0) {
    const overdueAmount = overdue.reduce((sum, inv) => sum + (inv.amount - inv.paidAmount), 0);
    messages.push(`⚠️ Facturas vencidas: ${overdue.length}, total ${formatCurrency(overdueAmount)}`);
  }

  if (dueSoon.length > 0) {
    const dueSoonAmount = dueSoon.reduce((sum, inv) => sum + (inv.amount - inv.paidAmount), 0);
    messages.push(`⏳ Facturas por vencer en 7 días: ${dueSoon.length}, total ${formatCurrency(dueSoonAmount)}`);
  }

  if (messages.length === 0) {
    messages.push('✔️ No hay facturas vencidas ni próximas para el periodo actual.');
  }

  const logLine = `${new Date().toISOString()} - ${messages.join(' | ')}\n`;
  await ensureLogsDir();
  await fs.promises.appendFile(LOG_FILE, logLine);

  console.log(logLine);

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const to = process.env.NOTIFICATION_EMAILS || process.env.SMTP_USER;
    const subject = '[FINANDEX] Alerta CxP automática';
    const text = `Informe CxP automático:\n\n${messages.join('\n')}\n\nGenerado: ${new Date().toLocaleString()}`;

    try {
      await sendMail({ to, subject, text });
      console.log('Correo de alerta CxP enviado a', to);
    } catch (error) {
      console.error('Error enviando correo de alerta CxP:', error);
    }
  }
};

(async () => {
  console.log('Iniciando monitor CxP programado (cada 60 minutos)...');
  await checkAging();

  setInterval(async () => {
    try {
      await checkAging();
    } catch (error) {
      console.error('Error en monitor CxP:', error);
    }
  }, 60 * 60 * 1000); // cada hora
})();