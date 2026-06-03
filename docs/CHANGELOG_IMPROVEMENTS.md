# Registro de Mejoras — Sistema FINANDEX

> Documento que consolida todos los cambios realizados por fases para referencia futura.

---

## Fase 0 — Garantías (Warranty Certificate System)

### Descripción
Sistema completo de certificados de garantía con modal manual en POS, página dedicada tipo Billing, PDF con marca de agua, y autorización de supervisor para eliminación.

### Archivos creados
| Archivo | Propósito |
|---|---|
| `backend/prisma/schema.prisma` (modelo `Warranty`) | Modelo con campos `clientId`, `clientName`, `clientRnc`, `clientPhone`, `days`, `coverage`, `exclusions`, `issueDate`, `expiryDate`, `saleId` (opcional), `createdById`. Opposite relations con `Sale`, `Client`, `User`. `@@map("warranties")` |
| `backend/src/controllers/warrantyController.js` | `getAllWarranties` (filtro por status: active/expiring/expired), `createWarranty` (+ `saveToHistory`), `deleteWarranty` (autenticación supervisor + `saveToHistory`) |
| `backend/src/routes/warranties.js` | `GET /`, `POST /` (con `validate(schemas.warranty)`), `DELETE /:id` |
| `frontend/src/utils/warrantyPDF.js` | `generateWarrantyPDF` — certificado con marca de agua "GARANTÍA", encabezado empresa, datos cliente, período, factura (right-aligned), cobertura/exclusiones, emitido por, footer |
| `docs/CHANGELOG_IMPROVEMENTS.md` | Este archivo |

### Archivos modificados
| Archivo | Cambio |
|---|---|
| `backend/src/controllers/saleController.js` | Creación de `Warranty` record + `saveToHistory` en `createSale` cuando `hasWarranty && warrantyData` |
| `backend/src/middleware/validate.js` | Schema `sale`: added `hasWarranty` + `warrantyData`. Nuevos schemas: `warranty`, `quotation`, `budget`, `purchaseOrder` |
| `backend/src/server.js` | Montada ruta `/api/warranties`, `TZ='America/Santo_Domingo'`, `unhandledRejection` handler, CSP headers, `stopScheduler` cleanup |
| `backend/src/controllers/clientController.js` | Fix `limit=-1` → `take: undefined` (Prisma `take: -1` inválido) |
| `frontend/src/services/api.js` | Added `warrantyService.getAll`, `.create`, `.delete` |
| `frontend/src/pages/Warranties.jsx` | Rediseño completo estilo Billing: KPIs, data-table, filtros, badges, PDF, delete auth, create modal, paginación |
| `frontend/src/components/WarrantyModal.jsx` | Refactor: no-bloqueante, soporte `initialData` |
| `frontend/src/pages/POS.jsx` + `POSQR.jsx` | Botón garantía junto al contador de items, estado `warrantyActive`/`warrantyData` |
| `frontend/src/App.jsx` | Lazy route `/warranties` |
| `frontend/src/components/Layout.jsx` | Sidebar "Garantías" entre "Cuentas x Pagar" y "Caja General" |
| `frontend/src/components/POSModals.jsx` | `ThermalReceipt80` + `ThermalReceipt58` — `color: '#000'` + `fontWeight: 600` |
| `frontend/src/pages/Quotations.jsx` | Fix PDF: company name font 22→18, title rect `y=22, h=20` |

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

---

## Fase 5 — Limpieza (Cleanup)

### Descripción
Reorganización de scripts debug, eliminación de escape hatch CORS, generación de baseline SQL para migración.

### Archivos modificados
| Archivo | Cambio |
|---|---|
| `backend/scripts/debug/` **(nuevo directorio)** | 17 scripts `.cjs` movidos de `backend/` a `backend/scripts/debug/` |
| `backend/src/server.js` | CORS wildcard escape hatch (`corsOrigin === '*' || corsOrigin === 'true'`) eliminado |
| `backend/prisma/` | Prisma migration baseline SQL generado via `migrate diff --from-empty --to-schema-datamodel` |

---

## Fase 6 — Sesión por inactividad (Inactivity Session Timeout)

### Descripción
Sincronización del JWT con el setting `sessionTimeoutMinutes`, cambio de UI a horas, y tracking real de inactividad con logout automático.

### Problema resuelto
`sessionTimeoutMinutes` (configurable en Settings) **no tenía efecto real**:
- Backend usaba `JWT_EXPIRES_IN=4h` fijo del `.env`
- Frontend usaba 240 min hardcodeados
- El setting se ignoraba completamente al firmar el JWT
- El timeout era tiempo absoluto desde login, no por inactividad
- El check periódico (cada 60s) no hacía logout real — solo limpiaba el timer local

### Archivos modificados
| Archivo | Cambio |
|---|---|
| `backend/src/controllers/authController.js` | `login()` ahora usa `sessionTimeoutMinutes` del DB como JWT `expiresIn`. `refreshToken()` igual. Cookies `accessToken` con `maxAge` dinámico. Refresh token extendido a 30d |
| `frontend/src/pages/Settings.jsx` | Input numérico (5-480 min) reemplazado por `<select>` en horas: 1h, 2h, 4h, 8h, 12h, 24h. Se almacena como `sessionTimeoutMinutes = horas * 60` |
| `frontend/src/context/AuthContext.jsx` | **Inactividad real**: event listeners (`mousemove`, `mousedown`, `keydown`, `click`, `scroll`, `touchstart`) con debounce 1s que llaman `resetSessionTimer()`. **Logout real**: check cada 10s → si expiró, llama `logout()` vía ref. Escucha evento `tokenRefreshed` para resetear timer |
| `frontend/src/services/api.js` | Dispara `window.dispatchEvent(new CustomEvent('tokenRefreshed'))` tras refresh exitoso para que AuthContext resetee el timer |

### Comportamiento final
- Admin elige horas (1h-24h) en Settings → se guarda como minutos
- Backend firma JWT con esa duración exacta
- Frontend rastrea actividad del usuario (mouse, teclado, click, scroll, touch)
- Si hay actividad antes del timeout, el timer se extiende (sesión deslizante)
- Si el usuario está inactivo por el período configurado, el frontend hace logout automático
- Si el JWT expira mientras hay actividad, el refresh token lo renueva transparentemente

---

## Fase X — Windows Auto-start

### Descripción
Configuración de inicio automático del sistema al encender Windows.

### Archivos creados
| Archivo | Propósito |
|---|---|
| `CONFIGURA_ARRANQUE_AUTOMATICO.bat` | Script interactivo para activar/desactivar inicio automático. Crea `dextremix_startup.vbs` en `%APPDATA%\...\Startup\` |
| `%APPDATA%\...\Startup\dextremix_startup.vbs` | Ejecuta `INICIAR.bat` silenciosamente en segundo plano (sin ventanas) al iniciar sesión |

---

## Próximos Pasos (Pendientes)

- [ ] Completar transición a Prisma migrations: eliminar `20260320185023_primer_migration`, aplicar baseline SQL via `prisma migrate resolve --applied`, cambiar ACTUALIZAR.bat a `migrate deploy`
- [ ] En otra PC: `git fetch origin && git reset --hard origin/main`, luego `prisma generate` + `prisma db push --accept-data-loss`, luego `vite build`
- [ ] Considerar modelo `InvoiceSequence` o advisory lock como alternativa a `$transaction` para concurrencia de facturas si surgen errores P2002
