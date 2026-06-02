const http = require('http');

const makeRequest = (options, data = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch(e) {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
};

async function test() {
  const login = await makeRequest({
    hostname: 'localhost', port: 3002, path: '/api/auth/login',
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }, { username: 'admin', password: 'admin123' });
  
  const token = login.accessToken;
  
  // Create new transaction
  await makeRequest({
    hostname: 'localhost', port: 3002, path: '/api/transactions',
    method: 'POST', 
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
  }, { type: 'EXPENSE', amount: 500, description: 'Gasto prueba', reference: 'GASTO01' });
  
  console.log('Nueva transacción creada');
  
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  const history = await prisma.$queryRaw`
    SELECT "type", "description", "amount", "userName", "categoryName" 
    FROM transactions_history 
    ORDER BY "createdAt" DESC LIMIT 3
  `;
  
  console.log('Transaction History:');
  console.log(JSON.stringify(history, null, 2));
  
  await prisma.$disconnect();
}

test().catch(e => console.error('Error:', e.message));
