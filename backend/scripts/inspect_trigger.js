import prisma from '../src/config/database.js';

async function show() {
  try {
    const res = await prisma.$queryRaw`SELECT pg_get_functiondef(p.oid) as def FROM pg_proc p WHERE p.proname = 'update_updated_at_column'`;
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('Error querying function:', err.message || err);
  } finally {
    await prisma.$disconnect();
  }
}

show();
