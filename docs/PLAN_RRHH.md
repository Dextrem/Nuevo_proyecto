# Plan: Modulo de Recursos Humanos (RRHH)

## Vision General
Modulo completo de Recursos Humanos para Finandex, que cubre desde la gestion basica de empleados hasta nomina con calculos de ley dominicana (ISR, AFP, SFS).

---

## Fase 1 - Estructura Base: Empleados + Departamentos

### Modelos Prisma

**Department:**
```prisma
model Department {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  employees   Employee[]
  @@index([active])
  @@map("departments")
}
```

**Employee:**
```prisma
model Employee {
  id            String    @id @default(uuid())
  employeeCode  String    @unique
  firstName     String
  lastName      String
  cedula        String?   @unique
  email         String?
  phone         String?
  address       String?
  birthDate     DateTime?
  hireDate      DateTime  @default(now())
  baseSalary    Float     @default(0)
  salaryType    String    @default("MENSUAL") // MENSUAL, QUINCENAL, SEMANAL, POR_HORAS
  position      String?
  departmentId  String?
  supervisorId  String?
  userId        String?   @unique
  active        Boolean   @default(true)
  notes         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  department   Department? @relation(fields: [departmentId], references: [id])
  supervisor   Employee?   @relation("Supervision", fields: [supervisorId], references: [id])
  subordinates Employee[]  @relation("Supervision")
  user         User?       @relation(fields: [userId], references: [id])

  @@index([departmentId])
  @@index([supervisorId])
  @@index([active])
  @@map("employees")
}
```

### Backend

| Archivo | Accion |
|---------|--------|
| `backend/src/controllers/departmentController.js` | Crear - CRUD (getAll, getById, create, update, delete) |
| `backend/src/controllers/employeeController.js` | Crear - CRUD + filtros (departamento, activo, busqueda por nombre/cedula) |
| `backend/src/routes/departments.js` | Crear - rutas estandar con autenticacion |
| `backend/src/routes/employees.js` | Crear - rutas estandar con autenticacion |
| `backend/src/middleware/validate.js` | Editar - agregar schemas Zod para Department y Employee |
| `backend/src/server.js` | Editar - registrar rutas `/api/departments` y `/api/employees` |

### Frontend

| Archivo | Accion |
|---------|--------|
| `frontend/src/pages/Departments.jsx` | Crear - tabla CRUD simple con nombre, descripcion, activo/inactivo |
| `frontend/src/pages/Employees.jsx` | Crear - ficha completa: datos personales, laborales, selector de departamento, supervisor, link a usuario |
| `frontend/src/services/api.js` | Editar - agregar `departmentService` y `employeeService` |
| `frontend/src/App.jsx` | Editar - agregar rutas `/departments` y `/employees` con lazy loading |
| `frontend/src/components/Layout.jsx` | Editar - agregar items al menu lateral |
| `frontend/src/context/AuthContext.jsx` | Editar - agregar permisos `manage_employees`, `manage_departments` |

### Permisos nuevos
- `manage_employees` - Ver, crear, editar, desactivar empleados
- `manage_departments` - Ver, crear, editar, desactivar departamentos

---

## Fase 2 - Asistencia y Ausencias

### Modelos Prisma

```prisma
model Attendance {
  id             String   @id @default(uuid())
  employeeId     String
  date           DateTime @default(now())
  entryTime      DateTime?
  exitTime       DateTime?
  hoursWorked    Float    @default(0)
  type           String   @default("PRESENCIAL") // PRESENCIAL, REMOTO
  status         String   @default("PRESENTE")   // PRESENTE, AUSENTE, TARDANZA, JUSTIFICADO
  notes          String?
  registeredById String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  employee       Employee @relation(fields: [employeeId], references: [id])
  registeredBy   User?    @relation(fields: [registeredById], references: [id])

  @@unique([employeeId, date])
  @@index([employeeId])
  @@index([date])
  @@index([status])
  @@map("attendance")
}

model Leave {
  id          String   @id @default(uuid())
  employeeId  String
  type        String   // VACACIONES, ENFERMEDAD, PERMISO, JUSTIFICADO, MATERNIDAD, PATERNIDAD
  startDate   DateTime
  endDate     DateTime
  days        Int
  reason      String?
  status      String   @default("PENDIENTE") // PENDIENTE, APROBADO, RECHAZADO, CANCELADO
  approvedBy  String?
  approvedAt  DateTime?
  comments    String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  employee    Employee @relation(fields: [employeeId], references: [id])
  approvedByUser User? @relation(fields: [approvedBy], references: [id])

  @@index([employeeId])
  @@index([status])
  @@index([startDate])
  @@map("leaves")
}
```

### Archivos a crear
| Capa | Archivos |
|------|----------|
| Backend | `attendanceController.js`, `leaveController.js`, `routes/attendance.js`, `routes/leaves.js` |
| Frontend | `pages/Attendance.jsx`, `pages/Leaves.jsx` |

### Funcionalidades
- **Asistencia:** Reloj marcador (entrada/salida), registro manual, vista calendario mensual, reporte de tardanzas/ausencias
- **Ausencias:** Solicitud con flujo PENDIENTE -> APROBADO/RECHAZADO, calculo automatico de dias habiles, vista de vacaciones pendientes por empleado

---

## Fase 3 - Nomina / Payroll

### Modelos Prisma

```prisma
model PayrollPeriod {
  id              String    @id @default(uuid())
  year            Int
  month           Int
  periodType      String    @default("MENSUAL") // MENSUAL, QUINCENAL
  periodNumber    Int       @default(1)         // 1 o 2 para quincenal
  startDate       DateTime
  endDate         DateTime
  status          String    @default("ABIERTO") // ABIERTO, CERRADO, PAGADO
  totalSalary     Float     @default(0)
  totalOvertime   Float     @default(0)
  totalBonuses    Float     @default(0)
  totalCommissions Float    @default(0)
  totalDeductions Float     @default(0)
  totalNet        Float     @default(0)
  processedBy     String?
  processedAt     DateTime?
  paidAt          DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  processedByUser User?     @relation(fields: [processedBy], references: [id])
  items           PayrollItem[]

  @@unique([year, month, periodType, periodNumber])
  @@index([status])
  @@map("payroll_periods")
}

model PayrollItem {
  id              String   @id @default(uuid())
  payrollPeriodId String
  employeeId      String
  daysWorked      Int      @default(0)
  baseSalary      Float    @default(0)
  overtime        Float    @default(0)
  bonuses         Float    @default(0)
  commissions     Float    @default(0)
  grossTotal      Float    @default(0)
  deductions      Json     @default("{}") // { isr: 0, afp: 0, sfs: 0, others: 0 }
  totalDeductions Float    @default(0)
  netTotal        Float    @default(0)
  status          String   @default("CALCULADO") // CALCULADO, PAGADO
  paidAt          DateTime?
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  payrollPeriod   PayrollPeriod @relation(fields: [payrollPeriodId], references: [id], onDelete: Cascade)
  employee        Employee      @relation(fields: [employeeId], references: [id])

  @@index([payrollPeriodId])
  @@index([employeeId])
  @@map("payroll_items")
}
```

### Reglas de Calculo (Republica Dominicana)
| Concepto | Porcentaje | Base |
|----------|-----------|------|
| **AFP** (empleado) | 2.87% | Salario mensual hasta 20 TSS (RD$ 154,140 en 2025) |
| **SFS** (empleado) | 3.04% | Salario mensual hasta 20 TSS |
| **ISR** (empleado) | Escala progresiva | Salario mensual - AFP - SFS, aplica tabla de IRS |

**Escala ISR mensual (RD$):**
| Desde | Hasta | Tasa | Sobre exceso |
|-------|-------|------|-------------|
| 0.01 | 34,685.00 | Exento | - |
| 34,685.01 | 50,337.00 | 15% | 34,685.00 |
| 50,337.01 | 72,270.00 | 20% | 50,337.00 |
| 72,270.01 | en adelante | 25% | 72,270.00 |

### Archivos a crear
| Capa | Archivos |
|------|----------|
| Backend | `payrollController.js`, `routes/payroll.js` |
| Frontend | `pages/Payroll.jsx` |

### Funcionalidades
- Crear periodo de nomina (mensual o quincenal)
- Calcular nomina automaticamente (toma todos los empleados activos)
- Calculos de ISR, AFP, SFS segun ley
- Vista previa antes de cerrar periodo
- Marcar como pagado (genera asiento contable)
- Exportar a Excel / PDF (colillas)

---

## Fase 4 - Reportes RRHH

### Reportes incluidos
| Reporte | Descripcion |
|---------|-------------|
| **Nomina por periodo** | Resumen de salarios, deducciones, neto por empleado |
| **Asistencia mensual** | Dias trabajados, tardanzas, ausencias por empleado |
| **Vacaciones pendientes** | Empleados con dias de vacaciones acumulados sin tomar |
| **Costo de personal** | Gasto total en salarios + deducciones por departamento |
| **Historial de pagos** | Seguimiento de nominas pagadas por periodo |

**Implementacion:** Nueva pestana en `Reports.jsx` (similar a "Ventas x Producto") y/o paginas independientes.

---

## Fase 5 - Contratos y Documentos (Post-MVP)

### Modelos Prisma
```prisma
model Contract {
  id          String   @id @default(uuid())
  employeeId  String
  type        String   // INDEFINIDO, FIJO, TEMPORAL, PRACTICAS
  startDate   DateTime
  endDate     DateTime?
  fileUrl     String?
  fileName    String?
  status      String   @default("ACTIVO") // ACTIVO, VENCIDO, TERMINADO
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  employee    Employee @relation(fields: [employeeId], references: [id])
  @@map("contracts")
}

model EmployeeDocument {
  id          String   @id @default(uuid())
  employeeId  String
  type        String   // CEDULA, CURRICULUM, CERTIFICADO, TITULO, CARNET, OTRO
  name        String
  fileUrl     String
  fileName    String
  notes       String?
  uploadedAt  DateTime @default(now())
  employee    Employee @relation(fields: [employeeId], references: [id])
  @@map("employee_documents")
}
```

---

## Resumen Completo de Archivos

### Backend (crear)
| Archivo | Fase |
|---------|------|
| `controllers/departmentController.js` | 1 |
| `controllers/employeeController.js` | 1 |
| `controllers/attendanceController.js` | 2 |
| `controllers/leaveController.js` | 2 |
| `controllers/payrollController.js` | 3 |
| `routes/departments.js` | 1 |
| `routes/employees.js` | 1 |
| `routes/attendance.js` | 2 |
| `routes/leaves.js` | 2 |
| `routes/payroll.js` | 3 |

### Backend (editar)
| Archivo | Cambio |
|---------|--------|
| `prisma/schema.prisma` | +5 modelos (Employee, Department, Attendance, Leave, PayrollPeriod, PayrollItem, Contract, EmployeeDocument) |
| `server.js` | +5 rutas |
| `middleware/validate.js` | +5 schemas Zod |

### Frontend (crear)
| Archivo | Fase |
|---------|------|
| `pages/Departments.jsx` | 1 |
| `pages/Employees.jsx` | 1 |
| `pages/Attendance.jsx` | 2 |
| `pages/Leaves.jsx` | 2 |
| `pages/Payroll.jsx` | 3 |

### Frontend (editar)
| Archivo | Cambio |
|---------|--------|
| `services/api.js` | +5 servicios |
| `App.jsx` | +5 rutas lazy |
| `components/Layout.jsx` | Items menu lateral |
| `context/AuthContext.jsx` | Permisos `manage_*` |
| `pages/Users.jsx` | Agregar permisos a AVAILABLE_PERMISSIONS |
| `pages/Reports.jsx` | Nuevas pestanas de reportes RRHH |

---

## Notas Tecnicas

- El modelo `Employee` se vincula opcionalmente a `User` mediante `userId` (unique). Un usuario del sistema existente puede tener su ficha de empleado asociada, pero no es obligatorio.
- Los calculos de nomina siguen la legislacion laboral dominicana (ISR, AFP, SFS). Las tasas TSS deben actualizarse anualmente.
- El sistema de permisos sigue el mismo patron existente: cada permiso se registra en `AuthContext`, se asigna por rol/usuario, y se verifica con `requirePermission()` y `hasPermission()`.
- Los reportes RRHH se integran como nuevas pestanas en `Reports.jsx` siguiendo el patron de "Ventas x Producto".
