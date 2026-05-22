// Use global fetch (Node 18+). No external dependency.
async function test() {
  try {
    const res = await fetch('http://localhost:3002/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin' })
    });

    const text = await res.text();
    console.log('status:', res.status);
    console.log(text);
  } catch (err) {
    console.error('Request error:', err.message || err);
  }
}

test();
