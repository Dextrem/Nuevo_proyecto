const API = 'http://localhost:3001/api';

async function main() {
  try {
    const loginRes = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin' }),
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok) {
      console.error('Login failed', loginRes.status, loginData);
      return;
    }
    const token = loginData.accessToken;
    console.log('Got token');

    const res = await fetch(`${API}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ username: 'api_newuser', email: 'api_newuser@example.com', password: 'Password1', name: 'API New User', role: 'CASHIER' }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('API error', res.status, data);
    } else {
      console.log('Create response status:', res.status, data);
    }
  } catch (err) {
    console.error('Request error', err);
  }
}

main();
