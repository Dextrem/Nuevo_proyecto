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
  
  console.log('=== Abriendo caja para pruebas ===');
  
  const openAttempt = await makeRequest({
    hostname: 'localhost', port: 3002, path: '/api/cash-registers/open',
    method: 'POST', 
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
  }, { 
    name: 'Caja Principal',
    openingAmount: 5000,
    authorizerUsername: 'admin',
    authorizerPassword: 'admin123'
  });
  
  console.log('Resultado:', openAttempt.id ? 'Caja abierta exitosamente' : openAttempt.error);
  
  console.log('\n=== Resumen de alertas implementadas ===');
  console.log('1. Al abrir caja: Si ya hay una caja abierta, muestra error');
  console.log('2. Al vender en efectivo: Si no hay caja abierta, muestra error');
  console.log('3. Al operar en caja cerrada: Muestra que la caja está cerrada');
}

test().catch(e => console.error('Error:', e.message));
