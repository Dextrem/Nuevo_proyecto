const http = require('http');

const makeRequest = (options, data = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch(e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
};

async function test() {
  // Login as caja1
  console.log('=== Login como caja1 ===');
  const loginCajero = await makeRequest({
    hostname: 'localhost', port: 3002, path: '/api/auth/login',
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }, { username: 'caja1', password: 'admin123' });
  
  console.log('Login status:', loginCajero.status);
  console.log('Login response:', JSON.stringify(loginCajero.data, null, 2));
  
  if (loginCajero.data.accessToken) {
    const tokenCajero = loginCajero.data.accessToken;
    
    // Check current register
    console.log('\n=== Verificando caja actual ===');
    const current = await makeRequest({
      hostname: 'localhost', port: 3002, path: '/api/cash-registers/current',
      method: 'GET', 
      headers: { 'Authorization': `Bearer ${tokenCajero}` }
    });
    
    console.log('Current status:', current.status);
    console.log('Current response:', JSON.stringify(current.data, null, 2));
    
    // Check open registers
    console.log('\n=== Verificando cajas abiertas ===');
    const open = await makeRequest({
      hostname: 'localhost', port: 3002, path: '/api/cash-registers/open',
      method: 'GET', 
      headers: { 'Authorization': `Bearer ${tokenCajero}` }
    });
    
    console.log('Open status:', open.status);
    console.log('Open response:', JSON.stringify(open.data, null, 2));
  }
}

test().catch(e => console.error('Error:', e.message));
