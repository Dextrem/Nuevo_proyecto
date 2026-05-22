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
  console.log('1. Login OK');
  
  // Check current register
  const current = await makeRequest({
    hostname: 'localhost', port: 3002, path: '/api/cash-registers/current',
    method: 'GET', 
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('2. Mi caja actual:', current ? current.name : 'N/A', current ? `(${current.currentAmount})` : '');
  
  // Check open registers
  const open = await makeRequest({
    hostname: 'localhost', port: 3002, path: '/api/cash-registers/open',
    method: 'GET', 
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('3. Cajas abiertas:', open.length, open.map(r => r.name));
  
  // Verify sale can be made
  console.log('4. Intentando hacer venta en efectivo...');
  
  // First check if there are products
  const products = await makeRequest({
    hostname: 'localhost', port: 3002, path: '/api/products?limit=1',
    method: 'GET', 
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('5. Productos disponibles:', products.data ? products.data.length : 0);
}

test().catch(e => console.error('Error:', e.message));
