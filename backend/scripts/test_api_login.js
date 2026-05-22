async function testLogin() {
  console.log('Testing login API at http://localhost:3002/api/auth/login');
  try {
    const response = await fetch('http://localhost:3002/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin'
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('--- LOGIN SUCCESS ---');
      console.log('User:', data.user.username);
      console.log('Role:', data.user.role);
    } else {
      console.log('--- LOGIN FAILED ---');
      console.log('Status:', response.status);
      console.log('Error Data:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('--- CONNECTION ERROR ---');
    console.log('Error:', error.message);
  }
}

testLogin();
