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
  // Login as admin (who has the box open)
  console.log('=== Test 1: Login como admin (dueño de caja) ===');
  const loginAdmin = await makeRequest({
    hostname: 'localhost', port: 3002, path: '/api/auth/login',
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }, { username: 'admin', password: 'admin123' });
  
  const tokenAdmin = loginAdmin.accessToken;
  console.log('Admin logueado');
  
  // Check current register for admin
  const currentAdmin = await makeRequest({
    hostname: 'localhost', port: 3002, path: '/api/cash-registers/current',
    method: 'GET', 
    headers: { 'Authorization': `Bearer ${tokenAdmin}` }
  });
  console.log('Caja actual (admin):', currentAdmin ? currentAdmin.name : 'N/A', currentAdmin ? `Monto: ${currentAdmin.currentAmount}` : '');
  
  // Login as another user (cajero)
  console.log('\n=== Test 2: Login como usuario caja1 (cajero) ===');
  const loginCajero = await makeRequest({
    hostname: 'localhost', port: 3002, path: '/api/auth/login',
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }, { username: 'caja1', password: 'admin123' });
  
  const tokenCajero = loginCajero.accessToken;
  console.log('Cajero logueado');
  
  // Check current register for cajero
  const currentCajero = await makeRequest({
    hostname: 'localhost', port: 3002, path: '/api/cash-registers/current',
    method: 'GET', 
    headers: { 'Authorization': `Bearer ${tokenCajero}` }
  });
  console.log('Caja actual (cajero):', currentCajero ? currentCajero.name : 'N/A');
  console.log('Es caja compartida:', currentCajero ? currentCajero.isShared : 'N/A');
  
  // Try to make a sale
  if (currentCajero) {
    console.log('\n=== Test 3: Hacer venta en efectivo como cajero ===');
    
    const products = await makeRequest({
      hostname: 'localhost', port: 3002, path: '/api/products?limit=1',
      method: 'GET', 
      headers: { 'Authorization': `Bearer ${tokenCajero}` }
    });
    
    if (products.data && products.data.length > 0) {
      const product = products.data[0];
      console.log('Producto:', product.name, `RD$ ${product.price}`);
      
      const sale = await makeRequest({
        hostname: 'localhost', port: 3002, path: '/api/sales',
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenCajero}` }
      }, { 
        paymentMethod: 'CASH', 
        paidAmount: product.price,
        items: [{ productId: product.id, quantity: 1, price: product.price, tax: 0 }]
      });
      
      console.log('Venta:', sale.message || sale.error || 'OK');
      console.log('ID Caja:', sale.sale ? sale.sale.cashRegisterId : 'N/A');
    }
  }
}

test().catch(e => console.error('Error:', e.message));
