# FINANDEX Backend

Backend API para el sistema de gestión financiera FINANDEX.

## Requisitos

- Node.js >= 18.0.0
- PostgreSQL >= 14.0
- npm o yarn

## Instalación

1. **Instalar dependencias:**
```bash
npm install
```

2. **Configurar variables de entorno:**
```bash
cp .env.example .env
```

Editar `.env` con tu configuración de PostgreSQL:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/finandex"
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-refresh-token-secret
```

3. **Generar cliente Prisma:**
```bash
npm run db:generate
```

4. **Ejecutar migraciones:**
```bash
npm run db:migrate
```

5. **Poblar datos iniciales (seed):**
```bash
npm run db:seed
```

## Uso

### Desarrollo
```bash
npm run dev
```

### Producción
```bash
npm start
```

El servidor estará disponible en `http://localhost:3001`

## Credenciales por defecto

Después de ejecutar el seed:
- **Usuario:** admin
- **Contraseña:** admin123

## API Endpoints

### Autenticación
- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/refresh` - Refrescar token
- `GET /api/auth/profile` - Obtener perfil

### Usuarios
- `GET /api/users` - Listar usuarios
- `GET /api/users/:id` - Obtener usuario
- `POST /api/users` - Crear usuario
- `PUT /api/users/:id` - Actualizar usuario
- `DELETE /api/users/:id` - Eliminar usuario

### Productos
- `GET /api/products` - Listar productos
- `GET /api/products/:id` - Obtener producto
- `POST /api/products` - Crear producto
- `PUT /api/products/:id` - Actualizar producto
- `DELETE /api/products/:id` - Eliminar producto
- `PATCH /api/products/:id/stock` - Actualizar stock

### Categorías
- `GET /api/categories` - Listar categorías
- `GET /api/categories/:id` - Obtener categoría
- `POST /api/categories` - Crear categoría
- `PUT /api/categories/:id` - Actualizar categoría
- `DELETE /api/categories/:id` - Eliminar categoría

### Clientes
- `GET /api/clients` - Listar clientes
- `GET /api/clients/:id` - Obtener cliente
- `POST /api/clients` - Crear cliente
- `PUT /api/clients/:id` - Actualizar cliente
- `DELETE /api/clients/:id` - Eliminar cliente
- `POST /api/clients/:id/payment` - Registrar pago

### Proveedores
- `GET /api/suppliers` - Listar proveedores
- `GET /api/suppliers/:id` - Obtener proveedor
- `POST /api/suppliers` - Crear proveedor
- `PUT /api/suppliers/:id` - Actualizar proveedor
- `DELETE /api/suppliers/:id` - Eliminar proveedor

### Transacciones
- `GET /api/transactions` - Listar transacciones
- `GET /api/transactions/summary` - Resumen de transacciones
- `POST /api/transactions` - Crear transacción
- `PUT /api/transactions/:id` - Actualizar transacción
- `DELETE /api/transactions/:id` - Eliminar transacción

### Ventas
- `GET /api/sales` - Listar ventas
- `GET /api/sales/daily` - Ventas del día
- `GET /api/sales/:id` - Obtener venta
- `POST /api/sales` - Crear venta
- `PATCH /api/sales/:id/cancel` - Cancelar venta

### Reportes
- `GET /api/reports/dashboard` - Estadísticas del dashboard
- `GET /api/reports/sales` - Reporte de ventas
- `GET /api/reports/inventory` - Reporte de inventario
- `GET /api/reports/financial` - Reporte financiero

### Configuración
- `GET /api/settings` - Obtener configuración
- `PUT /api/settings` - Actualizar configuración
- `POST /api/settings/reset` - Reiniciar configuración

## Seguridad

El backend incluye:
- Autenticación JWT
- Hash de contraseñas con bcrypt
- Rate limiting
- Validación de inputs con Zod
- Headers de seguridad con Helmet
- Prevención de SQL injection (Prisma)
- CORS configurado

## Licencia

ISC
