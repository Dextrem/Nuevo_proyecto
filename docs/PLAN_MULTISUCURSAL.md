# Plan de Implementación — Multisucursal

## Arquitectura

PC servidor central con PostgreSQL + Node.js.
Cada sucursal accede vía navegador a la IP del servidor.
Cada usuario pertenece a una sucursal y solo ve sus datos.

```
┌──────────────────────────────────────┐
│         PC SERVIDOR CENTRAL           │
│  PostgreSQL + Node.js + App (3000)    │
└──────┬─────────────────────┬─────────┘
       │                     │
       ▼                     ▼
┌──────────────┐   ┌──────────────┐
│ Sucursal SD   │   │ Sucursal SDN  │
│ (navegador)   │   │ (navegador)   │
└──────────────┘   └──────────────┘
```

## Decisiones del dueño

- **Clientes:** Compartidos entre sucursales
- **Proveedores:** Compartidos (una sola empresa)
- **Productos:** Catálogo separado por sucursal (stock/precio independiente)
- **Categorías:** Globales
- **NCF:** Secuencia única para toda la empresa
- **Settings:** Una sola config global (logo, nombre, RNC, tasa)
- **Usuarios:** 1 usuario = 1 sucursal

## Roles

| Rol | Descripción |
|---|---|
| SUPER_ADMIN | Todo, reports consolidados, gestiona sucursales |
| ADMIN | Administra su sucursal (usuarios, productos, inventario) |
| MANAGER | Encargado de sucursal (cajas, reimprimir, anular, reportes) |
| CASHIER | Cajero (solo vender en POS) |
| VIEWER | Solo lectura en su sucursal |

## Permisos por Rol

| Acción | SUPER_ADMIN | ADMIN | MANAGER | CASHIER | VIEWER |
|---|---|---|---|---|---|
| Gestionar sucursales | ✅ | ❌ | ❌ | ❌ | ❌ |
| Gestionar usuarios | ✅ | ✅ (su sucursal) | ❌ | ❌ | ❌ |
| Gestionar productos | ✅ | ✅ | ❌ | ❌ | ❌ |
| Gestionar clientes | ✅ | ✅ | ✅ | ✅ (crear) | ❌ |
| Gestionar proveedores | ✅ | ✅ | ❌ | ❌ | ❌ |
| Reimprimir facturas | ✅ | ✅ | ✅ | ❌ | ❌ |
| Abrir/cerrar caja | ✅ | ✅ | ✅ | ❌ | ❌ |
| Anular ventas | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ajustar inventario | ✅ | ✅ | ❌ | ❌ | ❌ |
| Reportes globales | ✅ | ❌ | ❌ | ❌ | ❌ |
| Reportes sucursal | ✅ | ✅ | ✅ | ❌ | ✅ (ver) |
| POS (vender) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Cambiar settings | ✅ | ❌ | ❌ | ❌ | ❌ |

## Modelo de Datos

### Nueva tabla: Branch

```prisma
model Branch {
  id        String   @id @default(uuid())
  name      String
  rnc       String?
  address   String?
  phone     String?
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users         User[]
  products      Product[]
  sales         Sale[]
  quotations    Quotation[]
  transactions  Transaction[]
  purchases     Purchase[]
  cashRegisters CashRegister[]
  commissions   Commission[]
}
```

### Catálogo de productos: Template + Inventory por sucursal

```prisma
model ProductTemplate {
  id          String   @id @default(uuid())
  name        String
  description String?
  categoryId  String
  sku         String?
  barcode     String?
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  category    Category          @relation(fields: [categoryId], references: [id])
  inventories ProductInventory[]
}

model ProductInventory {
  id         String  @id @default(uuid())
  templateId String
  branchId   String
  price      Float
  cost       Float?
  stock      Int     @default(0)
  minStock   Int     @default(0)
  active     Boolean @default(true)

  branch   Branch          @relation(fields: [branchId], references: [id])
  template ProductTemplate @relation(fields: [templateId], references: [id])

  @@unique([templateId, branchId])
}
```

### Tablas con branchId

| Tabla | branchId | Nota |
|---|---|---|
| User | required | 1 usuario = 1 sucursal |
| Product → ProductInventory | required | Por sucursal |
| Sale | required | |
| Quotation | required | |
| Transaction | required | |
| Purchase | required | |
| CashRegister | required | |
| Commission | required | |

### Tablas sin branchId (compartidas)

| Tabla | Motivo |
|---|---|
| Client | Compartidos entre sucursales |
| Supplier | Misma empresa |
| Category | Global |
| NcfSequence | Secuencia única |
| Settings | Config global |
| ProductTemplate | Catálogo maestro |

## Backend

### Nuevo middleware: resolveBranch

```js
const resolveBranch = (req, res, next) => {
  if (req.user.role === 'SUPER_ADMIN') {
    req.branchId = req.query.branchId || null; // null = todas
  } else {
    req.branchId = req.user.branchId;
  }
  next();
};
```

### Nuevas rutas

```
GET    /api/branches          → listar (SUPER_ADMIN)
POST   /api/branches          → crear (SUPER_ADMIN)
GET    /api/branches/:id      → detalle (SUPER_ADMIN)
PUT    /api/branches/:id      → editar (SUPER_ADMIN)
```

### Modificaciones en controllers existentes

Todos los controllers que consultan tablas con branchId deben agregar:
```js
const where = { branchId: req.branchId };
// SUPER_ADMIN con branchId=null → omitir filtro (ver todas)
if (req.branchId) where.branchId = req.branchId;
```

### JWT payload

Agregar `branchId` al payload del token.

## Frontend

### Cambios por pantalla

| Pantalla | Cambio |
|---|---|
| Login | Sin cambio visible (branchId en token) |
| Header/badge | SUPER_ADMIN ve selector de sucursal + opción "Global" |
| Dashboard | Filtro por sucursal (solo SUPER_ADMIN ve "Global") |
| Productos | Migrar UI a template + inventory, editar stock/precio por sucursal |
| POS | branchId del usuario, transparente |
| Reportes | SUPER_ADMIN puede ver consolidado global |
| Users | Asignar sucursal y rol al crear/editar |
| Settings | Siguen globales — sin cambio |
| Sucursales | Nueva página solo para SUPER_ADMIN (CRUD) |

### API service

```js
// Ejemplo: agregar branchId como header o query param
api.interceptors.request.use((config) => {
  const selectedBranch = store.getState().selectedBranch;
  if (selectedBranch) config.headers['X-Branch-Id'] = selectedBranch;
  return config;
});
```

## Migración de datos existentes

```sql
-- 1. Crear sucursal por defecto
INSERT INTO "branches" (id, name, active, "createdAt", "updatedAt")
VALUES ('principal', 'Principal', true, NOW(), NOW());

-- 2. Migrar productos a template + inventory
INSERT INTO "product_templates" (id, name, description, "categoryId", sku, barcode, active, "createdAt", "updatedAt")
SELECT id, name, description, "categoryId", sku, barcode, active, "createdAt", "updatedAt" FROM "products";

INSERT INTO "product_inventories" (id, "templateId", "branchId", price, cost, stock, "minStock", active)
SELECT gen_random_uuid()::text, id, 'principal', price, cost, stock, "minStock", active FROM "products";

-- 3. Agregar branchId a tablas existentes
ALTER TABLE "users" ADD COLUMN "branchId" TEXT;
UPDATE "users" SET "branchId" = 'principal';
ALTER TABLE "users" ALTER COLUMN "branchId" SET NOT NULL;

-- Repetir para sales, quotations, transactions, purchases, cash_registers, commissions

-- 4. Agregar constraints FK
ALTER TABLE "users" ADD CONSTRAINT "fk_user_branch" FOREIGN KEY ("branchId") REFERENCES "branches"("id");
-- Repetir para cada tabla
```

## Archivos a crear/modificar

| Archivo | Acción |
|---|---|
| `backend/prisma/schema.prisma` | Modificar — nuevas tablas + branchId |
| Migración SQL | Crear |
| `backend/src/middleware/branch.js` | Crear |
| `backend/src/controllers/branchController.js` | Crear |
| `backend/src/routes/branches.js` | Crear |
| `backend/src/middleware/auth.js` | Modificar — agregar branchId a JWT |
| `backend/src/server.js` | Modificar — registrar rutas |
| Todos los controllers | Modificar — filtrar por branchId |
| `frontend/src/pages/Products.jsx` | Modificar — migrar a template+inventory |
| `frontend/src/pages/Dashboard.jsx` | Modificar — filtro sucursal |
| `frontend/src/pages/Reports.jsx` | Modificar — filtro sucursal |
| `frontend/src/pages/Users.jsx` | Modificar — selector sucursal |
| `frontend/src/components/Header.jsx` | Modificar — selector sucursal (SUPER_ADMIN) |
| Nueva página branches | Crear |

## Tiempo estimado

4-6 horas de trabajo efectivo.
