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
    console.log('Creando usuario MANAGER de prueba...');
    const { req, res } = makeReqRes({
      username: 'manager1',
      email: 'manager1@example.com',
      password: 'Manager123',
      name: 'Manager Uno',
      role: 'MANAGER'
    });

    await createUser(req, res);
    console.log('Prueba finalizada');
  } catch (err) {
    console.error('Error en create_manager_test:', err);
  }
}

main();
