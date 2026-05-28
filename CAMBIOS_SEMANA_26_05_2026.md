# Cambios Semana del 26 de Mayo de 2026

Período: 22 al 28 de mayo — Total: **35 commits** (excluyendo módulo RRHH)

---

## 1. Commits

| Commit | Fecha | Descripción |
|---|---|---|
| `47122438` | 2026-05-28 | feat: costo de envío por venta/cotización (shippingCost) — schema, API, POS, recibos, PDF, Billing |
| `ca374c3a` | 2026-05-27 | fix: ANSI escape codes en ACTUALIZAR.bat (faltaba ESC byte) |
| `19934b82` | 2026-05-27 | fix: Node.js portátil en ACTUALIZAR.bat + scroll overlay efectivo POS |
| `ba82c254` | 2026-05-27 | feat: exportar facturas a Excel/PDF desde Billing + documentar cambios |
| `e96202c8` | 2026-05-26 | refactor: reemplazar descarga ZIP por git fetch+reset |
| `19c04cb8` | 2026-05-26 | fix: no enviar accent/secondary a la API al guardar settings |
| `5916fe09` | 2026-05-26 | fix: .env backup no fatal + BITSAdmin fallback en ACTUALIZAR.bat |
| `e8f83cb1` | 2026-05-26 | fix: rutas portables en ACTUALIZAR.bat (%CD% → %~dp0) y limit -1 para POS |
| `1a1bb296` | 2026-05-26 | fix: aumentar limit productos POS a 1000 + backup BD automático |
| `6d7cf664` | 2026-05-26 | revert: POS.jsx al estado original (commit 8318ba79) |
| `ba6fc391` | 2026-05-26 | fix: ignorar auto-repeat de tecla Enter en cash y overlay |
| `538fbf07` | 2026-05-26 | fix: Enter en input muestra overlay en vez de submit directo |
| `1cb1caa6` | 2026-05-26 | fix: pasar onCashEnter como prop a CartSummary |
| `7a6655d0` | 2026-05-26 | fix: swap handleCashEnter después de handleProcessSale para evitar TDZ |
| `27d5cdb5` | 2026-05-26 | feat: Enter en input efectivo procesa venta directo en POS |
| `c0160416` | 2026-05-26 | fix: mover useEffects tras useCallbacks para evitar TDZ en POS |
| `79c58909` | 2026-05-26 | feat: Enter key confirma efectivo + auto-print en POS |
| `8318ba79` | 2026-05-26 | fix: install cross-env dependency for build |
| `d3bd70e3` | 2026-05-26 | Fix: PDF fecha desborde, recuadros QuotationLetterReceipt, marca de agua PDF/HTML |
| `964f2923` | 2026-05-25 | Fases 3-5: PDF mejoras, MonthlyClosing print, cleanup imports y receiptFooter |
| `da47a429` | 2026-05-25 | Fase 2: Unificar nomenclatura ticket58/ticket80 -> thermal-58/thermal-80 |
| `ee5a9838` | 2026-05-25 | Fase 1: Estandarizar CSS de tickets térmicos en POSQR, Reports, Billing |
| `85c33f42` | 2026-05-25 | Reemplazar todos los alert() nativos con Toast notifications |
| `971ca0d4` | 2026-05-25 | Reemplazar todos los confirm() nativos con ConfirmModal component |
| `96b40cbf` | 2026-05-25 | Fix: reemplazar confirm() nativo por modal en confirmación eliminar producto |
| `4d74c997` | 2026-05-25 | Fix: eliminar onClick del modal-overlay en creación/edición productos |
| `51060809` | 2026-05-25 | Fix: reemplazar confirm() nativo por modal con título Advertencia |
| `32ddb5ab` | 2026-05-25 | Fix: validación código barras vacío en creación producto |
| `95911147` | 2026-05-25 | Add: reporte de ventas por producto (backend + frontend con gráfico dona + Excel) |
| `896b7b05` | 2026-05-25 | Performance: eliminar N+1 queries, paginación CxC/CxP/compras, índices BD |
| `2da1a828` | 2026-05-22 | Fix: bucle session-expired al cargar login (api.js interceptor) + logger global |
| `7fc83c6a` | 2026-05-22 | Fix: impresión térmica 80mm + PDF cotización (right-align, truncado, notas wrap) |
| `1e925930` | 2026-05-22 | Fix: eliminar .rar del tracking |
| `99c1bf1b` | 2026-05-22 | Fix: columna Productos en reporte + carrito 1.3fr + host check JSON + interceptor login |
| `f260490a` | 2026-05-22 | Add: ACTUALIZAR_PRIMERA_VEZ.bat bootstrap |
| `fd790c07` | 2026-05-22 | Fix: quitar seed.js de ACTUALIZAR.bat + guía actualización remota |
| `01d2aab6` | 2026-05-22 | Fix: excluir backups/ y uploads/ del tracking |
| `4639deed` | 2026-05-22 | v1.1: .gitignore + ACTUALIZAR.bat + 4h sesión + POS mejoras |

---

## 2. ACTUALIZAR.bat — Actualizador automático

### Rutas portables (`%~dp0`)
Cambia `%CD%` por `%~dp0` en todas las rutas para que el script funcione desde cualquier directorio.

### .env backup no fatal
Si falla el respaldo del `.env`, ya no aborta la actualización. Solo avisa y continúa.

### Descarga con git (reemplaza ZIP)
El repositorio es privado, la descarga anónima de ZIP no funcionaba. Ahora usa:
```batch
git fetch origin main
git reset --hard origin/main
```

### Backup BD automático
Antes de migrar, crea backup de PostgreSQL con `pg_dump`.

### Node.js portátil
Detecta primero `bin\node.exe` portátil. Si existe, usa `bin\npm.cmd` y `bin\npx.cmd`; si no, cae al del sistema.

### ANSI escape codes corregidos
Faltaba el carácter ESC (byte 0x1B) en los códigos de color. Ahora se genera dinámicamente con:
```batch
for /f %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"
```

---

## 3. POS.jsx — Punto de Venta

### Scroll en overlay de confirmación de efectivo
El overlay `showCashConfirm` no tenía `max-height` ni `overflow-y`. En pantallas pequeñas los botones quedaban fuera de vista.

### Enter key + auto-print
- Enter en input de efectivo abre overlay de confirmación
- Tras confirmar, imprime automáticamente
- Enter procesa venta directo (flujo rápido)

### Evitar TDZ (Temporal Dead Zone)
Mover todos los `useEffect` después de los `useCallback`.

### Overlay en vez de submit directo
Enter en input de efectivo ahora muestra el overlay de cambio antes de confirmar.

### Ignorar auto-repeat de Enter
Si el usuario mantiene presionada Enter, no se dispara múltiples veces.

### Límite de productos
- `limit: 1000` → `limit: -1` para mostrar inventario completo
- Backend: cuando `limit === -1` omite skip/take en `findMany`

---

## 4. Billing.jsx — Exportar Facturas a Excel y PDF

### Nuevos archivos

**`frontend/src/utils/pdfGenerator.js`** — Generación de PDF con jsPDF:
- `generateInvoicePDF` — Factura completa con logo, datos empresa, cliente, items, totales
- `generateARReportPDF` — Reporte de Cuentas por Cobrar con tarjetas de resumen
- `generateReminderPDF` — Recordatorio de pago personalizable

**`frontend/src/utils/excelExporter.js`** — Exportación a Excel con SheetJS:
- `exportToExcel` — Función genérica multi-hoja
- `exportSalesToExcel` — Facturas con NCF, método, estado
- `exportARToExcel` — CxC ordenado por vencimiento + resumen
- `exportInventoryToExcel` — Inventario completo
- `exportClientsToExcel` — Clientes con balance y límite
- `exportAccountMovementsToExcel` — Movimientos contables

### Modificaciones en Billing.jsx
- Botón "Exportar a Excel" en el header
- Botón de descarga PDF por cada factura
- Función `downloadInvoicePDF` que obtiene items completos si hace falta

---

## 5. Toast notifications — Reemplazo de `alert()` nativos

**Archivo:** `frontend/src/context/AppContext.jsx`

Se implementó `showNotification(message, type, duration)`:
- Tipos: `success`, `error`, `warning`, `info`
- Estilos coherentes con el tema, animación `slideIn`
- Auto-dismiss después de `duration` ms (default 3000)
- Se reemplazaron todos los `alert()` en todas las páginas del frontend

---

## 6. ConfirmModal — Reemplazo de `confirm()` nativos

**Archivo nuevo:** `frontend/src/components/ConfirmModal.jsx`

Componente reutilizable con:
- `show`, `title`, `message`, `icon`, `iconColor`
- `confirmText`, `confirmButtonClass`
- Callbacks `onConfirm`, `onCancel`
- Aplicado en: eliminar productos, anular facturas, creación de productos sin código barras

---

## 7. Tickets térmicos — Estandarización CSS

### Fase 1 — CSS unificado
Estilos consistentes para `thermal-58` (50mm), `thermal-80` (72mm), `letter` y `a4`.
Aplicado en: POSQR, Reports, Billing.

### Fase 2 — Nomenclatura
- `ticket58` → `thermal-58`
- `ticket80` → `thermal-80`

### Fases 3-5 — Mejoras PDF
- MonthlyClosing print
- Cleanup de imports no usados
- `receiptFooterMessage` en settings

### Fix adicional — PDF
- Fecha no se desborda
- Recuadros correctos en QuotationLetterReceipt
- Marca de agua en PDF/HTML

### Fix térmico 80mm
- Padding, max-width, box-sizing corregidos
- PDF cotización: right-align offset, truncado, notas wrap

---

## 8. Settings — Filtro de campos inexistentes en BD

**Archivo:** `frontend/src/context/AppContext.jsx`

### Problema
Los campos `accent` y `secondary` (colores del tema) no existen en la base de datos Prisma. Al enviarlos al API, Prisma rechazaba la actualización y los cambios se perdían al recargar.

### Solución
Extraer `accent` y `secondary` del objeto antes de enviarlo al API:
```javascript
const { accent, secondary, ...apiData } = newSettings;
const response = await settingsService.update(apiData);
```

---

## 9. Reporte de ventas por producto

**Archivos:**
- `backend/src/routes/sales.js` — Nueva ruta `/sales/by-product`
- `backend/src/controllers/saleController.js` — Controlador con agrupación por producto
- `frontend/src/pages/Reports.jsx` — Nuevo tab "Ventas por Producto"

Funcionalidades:
- Gráfico dona (Chart.js)
- Filtro por categoría
- Exportación a Excel

---

## 10. Performance — N+1 queries + índices BD

- Eliminados N+1 queries en `suppliers.createSale` y `suppliers.cancelSale`
- Paginación implementada en Cuentas por Cobrar, Cuentas por Pagar y compras
- Índices compuestos agregados en la base de datos

---

## 11. Fix session-expired + logger global

- Interceptor en `api.js` detecta 401 y redirige al login sin bucle infinito
- Logger global de errores en backend (`middleware/errorHandler.js`)

---

## 12. Paginación — `limit: -1`

**Archivos:**
- `backend/src/utils/pagination.js` — `parsePaginationParams` permite `limit: -1` sin clamp
- `backend/src/controllers/productController.js` — Cuando `limit === -1`, omite skip/take

---

## 13. Archivos nuevos vs modificados

### Archivos nuevos (6)
| Archivo | Propósito |
|---|---|
| `CAMBIO_GUIA.md` | Guía de cambios y despliegue |
| `CAMBIOS_SEMANA_26_05_2026.md` | Resumen semanal de cambios |
| `frontend/src/utils/pdfGenerator.js` | Generación de PDF (jsPDF) |
| `frontend/src/utils/excelExporter.js` | Exportación a Excel (SheetJS) |
| `frontend/src/components/ConfirmModal.jsx` | Modal de confirmación reutilizable |
| `ACTUALIZAR_PRIMERA_VEZ.bat` | Bootstrap para primera actualización |

### Archivos modificados (14+)
| Archivo | Cambios |
|---|---|
| `ACTUALIZAR.bat` | Node.js portátil, ANSI colors, `%~dp0`, backup BD, git fetch |
| `.gitignore` | Excluir backups/, uploads/, scratch/, [0m |
| `backend/src/utils/pagination.js` | Soporte limit: -1 |
| `backend/src/controllers/productController.js` | Saltar skip/take en limit -1 |
| `backend/src/controllers/saleController.js` | Ruta by-product, paginación |
| `backend/src/routes/sales.js` | Nueva ruta /by-product |
| `backend/src/middleware/errorHandler.js` | Logger global |
| `frontend/src/pages/POS.jsx` | Enter key, overlay efectivo, scroll, TDZ |
| `frontend/src/pages/Billing.jsx` | Exportar Excel, descargar PDF |
| `frontend/src/pages/POSQR.jsx` | Tickets térmicos CSS |
| `frontend/src/pages/Reports.jsx` | Tab ventas por producto |
| `frontend/src/components/POSModals.jsx` | Tickets térmicos, receipt footer |
| `frontend/src/context/AppContext.jsx` | Toast notifications, filtro accent/secondary |
| `frontend/src/styles/styles.css` | Modales con scroll, estilos térmicos |

---

## 14. Cómo actualizar la otra PC

### Opción 1 — Copiar archivos manualmente
Copiar los archivos listados arriba y luego:
```cmd
cd backend
..\bin\npx.cmd prisma generate
cd ..\frontend
..\bin\npm.cmd run build
```

### Opción 2 — ACTUALIZAR.bat (recomendado)
```cmd
cd C:\Programa de Finanzas\financial_app
git fetch origin main
git reset --hard origin/main
ACTUALIZAR.bat
```

El repositorio es público, no necesita autenticación.
