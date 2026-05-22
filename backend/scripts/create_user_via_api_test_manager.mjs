const API = 'http://localhost:3001/api';

async function main() {
  try {
    const loginRes = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'manager1', password: 'Manager123' }),
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok) {
      console.error('Login failed', loginRes.status, loginData);
      return;
    }
    const token = loginData.accessToken;
    console.log('Got token for manager');

    const res = await fetch(`${API}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ username: 'manager_created_user', email: 'manager_created@example.com', password: 'Mpass1234', name: 'Created by Manager', role: 'CASHIER' }),
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
