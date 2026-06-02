const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const warranties = await p.warranty.findMany();
  console.log('Count:', warranties.length);
  console.log(JSON.stringify(warranties, null, 2));
  await p.$disconnect();
}
main().catch(e => { console.error('Error:', e.message); p.$disconnect(); });
