# Registro de Mejoras — Sistema FINANDEX

> Documento que consolida los cambios de mejora y estabilidad del sistema realizados por fases. Para referencia futura.

---

## Fase 1 — Estabilidad crítica (Critical Stability Fixes)

### Descripción
Correcciones de estabilidad del servidor, reemplazo de `console.error` por `logger.error`, eliminación de credenciales hardcodeadas, y fixes en batch files.

### Archivos modificados
| Archivo | Cambio |
|---|---|
| `backend/src/server.js` | Added `unhandledRejection` handler (sin `process.exit`, recuperación segura). Eliminado print de credenciales admin en consola (líneas 186-188) |
| 18 controllers en `backend/src/controllers/` | 102 llamadas `console.error()` → `logger.error()` |
| `INICIAR.bat` | Líneas 186-188: eliminado print de credenciales `admin`/`admin`. Fix `>>%N%` redirect bug (líneas 62, 73) |
| `DETENER.bat`, `CREA_BACKUP.bat`, `RESTAURAR_BACKUP.bat`, `CONFIGURA_ARRANQUE_AUTOMATICO.bat` | Fix ANSI color codes — eliminado espacio leading antes de `[92m` |
| `backend/src/services/scheduler.js` | Fix stock alert logic (`NOT: { minStock: 0 }` → `minStock: { gt: 0 }`). Added `stopScheduler()` + `schedulerTimer` variable |
| `backend/src/utils/money.js` **(nuevo)** | Helpers: `roundMoney`, `addMoney`, `sumMoney`, `formatMoney`, `compareMoney`, `gteMoney`, `lteMoney` con `EPSILON = 0.005` |
| `backend/src/controllers/saleController.js` | `gteMoney` aplicado en líneas 956, 1104 (reemplazando `newPaidAmount >= sale.total - 0.01`) |
| `backend/src/routes/warranties.js` | Zod validation en POST |

---

## Fase 2 — Validación y Timezone (Validation & Timezone)

### Descripción
Validación Zod en rutas críticas, corrección de timezone, y preservación de password hash en restauración de backup.

### Archivos modificados
| Archivo | Cambio |
|---|---|
| `backend/src/middleware/validate.js` | Nuevos schemas Zod: `quotation`, `budget`, `warranty`, `purchaseOrder` |
| `backend/src/routes/quotations.js` | Zod validation en POST/PUT |
| `backend/src/routes/budgets.js` | Zod validation en POST/PUT |
| `backend/src/routes/purchases.js` | Zod validation en POST |
| `backend/src/routes/suppliers.js` | Zod validation en POST/PUT de invoices |
| `backend/src/server.js` | `process.env.TZ = 'America/Santo_Domingo'` (línea 1) |
| `backend/src/services/backupService.js` | Password hash preservado en restore (`user.password` en vez de `bcrypt.hash('temp_password_123', 10)`). Línea 224 |
| `CREA_BACKUP.bat` (línea 28), `RESTAURAR_BACKUP.bat` (línea 69) | `PGPASSWORD` lee de env var con fallback a `postgres` |

---

## Fase 3 — Seguridad y concurrencia (Security & Concurrency)

### Descripción
Generación de facturas concurrente-safe, caché PWA segmentada, headers CSP.

### Archivos modificados
| Archivo | Cambio |
|---|---|
| `backend/src/utils/invoice.js` | `generateInvoiceNumber` envuelto en `prisma.$transaction(async (tx) => {...})` para concurrencia |
| `frontend/vite.config.js` | PWA cache split: `NetworkOnly` para `/api/(sales|transactions|reports|clients|fiscal|monthly|backup).*`; `NetworkFirst` para otras API con 30 min TTL |
| `backend/src/server.js` | CSP headers habilitados via helmet (`default-src 'self'`, `connect-src 'self'`, etc.) |

---

## Fase 4 — Configurabilidad (Configurable Provisions)

### Descripción
Porcentajes de provisión, keywords de gastos, y umbrales de estado ahora configurables desde Settings en vez de hardcodeados.

### Archivos modificados
| Archivo | Cambio |
|---|---|
| `backend/prisma/schema.prisma` | Settings model extendido con: `provisionOverduePercent`, `provisionOver90Percent`, `expenseKeywordsOperational`, `expenseKeywordsAdministrative`, `expenseKeywordsFinancial`, `expenseKeywordsDepreciation`, `statusThresholdAlertOver90`, `statusThresholdPrecautionOver90`, `statusThresholdPrecautionNetIncome`, `statusThresholdCurrentRatio` |
| `backend/src/controllers/monthlyClosingController.js` | Todos los porcentajes de provisión, keywords de gastos, y umbrales de estado reemplazados por lecturas de `finSettings` (modelo Settings) con fallbacks a valores originales |
| `backend/src/middleware/validate.js` | Settings schema actualizado con los 11 nuevos campos financieros |
| `backend/src/utils/pagination.js` | `MAX_LIMIT = 200`; bypass de `limit=-1` eliminado |
| `backend/src/services/backupService.js` | TRUNCATE movido dentro de `$transaction` (antes ejecutaba fuera, dejando DB vacía en caso de fallo) |


