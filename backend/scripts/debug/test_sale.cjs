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
  const loginCajero = await makeRequest({
    hostname: 'localhost', port: 3002, path: '/api/auth/login',
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }, { username: 'caja1', password: 'admin123' });
  
  const tokenCajero = loginCajero.data.accessToken;
  console.log('Login OK');
  
  // Get products
  const products = await makeRequest({
    hostname: 'localhost', port: 3002, path: '/api/products?limit=1',
    method: 'GET', 
    headers: { 'Authorization': `Bearer ${tokenCajero}` }
  });
  
  const product = products.data.data[0];
  console.log('Producto:', product.name);
  
  // Try sale
  try {
    const sale = await makeRequest({
      hostname: 'localhost', port: 3002, path: '/api/sales',
      method: 'POST', 
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenCajero}` }
    }, { 
      paymentMethod: 'CASH', 
      paidAmount: product.price,
      items: [{ productId: product.id, quantity: 1, price: product.price, tax: 0 }]
    });
    
    console.log('Status:', sale.status);
    console.log('Response:', JSON.stringify(sale.data, null, 2));
  } catch(e) {
    console.log('Error:', e.message);
  }
}

test().catch(e => console.error('Error global:', e.message));
