import { createUser } from '../src/controllers/userController.js';

const makeReqRes = (body = {}) => {
  const req = { body };
  const res = {
    status(code) { this._status = code; return this; },
    json(payload) { console.log('RESPONSE', this._status || 200, JSON.stringify(payload, null, 2)); },
  };
  return { req, res };
};

async function main() {
  try {
    console.log('Ejecutando createUser de prueba...');
    const { req, res } = makeReqRes({
      username: 'testuser123',
      email: 'testuser123@example.com',
      password: 'secret123',
      name: 'Test User'
    });

    await createUser(req, res);
    console.log('Prueba finalizada');
  } catch (err) {
    console.error('Error en create_user_test:', err);
  }
}

main();
