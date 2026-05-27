# Cambios Realizados

## Commits

| Commit | Fecha | Descripción |
|---|---|---|
| `e96202c8` | 2026-05-27 | Reemplazar descarga ZIP por `git fetch + reset` |
| `19c04cb8` | 2026-05-27 | No enviar `accent`/`secondary` al API al guardar settings |
| `5916fe09` | 2026-05-27 | `.env` backup no fatal + BITSAdmin fallback |
| `e8f83cb1` | 2026-05-27 | `%CD%` → `%~dp0` (rutas portables) + `limit: -1` para POS |
| `1a1bb296` | 2026-05-27 | Aumentar `limit` productos POS a 1000 + backup BD automático |
| `6d7cf664` | 2026-05-27 | Revertir POS.jsx al estado original (commit `8318ba79`) |
| `ba6fc391` | 2026-05-27 | Ignorar auto-repeat de Enter en cash y overlay |
| `538fbf07` | 2026-05-27 | Enter en input → muestra overlay en vez de submit directo |
| `1cb1caa6` | 2026-05-27 | Pasar `onCashEnter` como prop a CartSummary |
| `7a6655d0` | 2026-05-27 | Swap `handleCashEnter` después de `handleProcessSale` para evitar TDZ |
| `27d5cdb5` | 2026-05-27 | Enter en input efectivo procesa venta directo |
| `c0160416` | 2026-05-27 | Mover `useEffects` tras `useCallbacks` para evitar TDZ |
| `79c58909` | 2026-05-27 | Enter key confirma efectivo + auto-print |
| `8318ba79` | 2026-05-27 | Instalar `cross-env` dependency para build |
| `d3bd70e3` | 2026-05-25 | PDF: fecha desborde, recuadros QuotationLetterReceipt, marca de agua |
| `964f2923` | 2026-05-25 | Fases 3-5: PDF mejoras, MonthlyClosing print, cleanup imports, receiptFooter |
| `da47a429` | 2026-05-25 | Fase 2: Unificar nomenclatura `ticket58`/`ticket80` → `thermal-58`/`thermal-80` |
| `ee5a9838` | 2026-05-25 | Fase 1: Estandarizar CSS de tickets térmicos (POSQR, Reports, Billing) |
| `85c33f42` | 2026-05-25 | Reemplazar todos los `alert()` nativos con Toast notifications |
| `971ca0d4` | 2026-05-25 | Reemplazar todos los `confirm()` nativos con ConfirmModal component |
| `96b40cbf` | 2026-05-25 | Reemplazar `confirm()` nativo por modal en confirmación de eliminar producto |
| `4d74c997` | 2026-05-25 | Eliminar `onClick` del modal-overlay en creación/edición de productos |
| `51060809` | 2026-05-25 | Reemplazar `confirm()` nativo por modal con título Advertencia |
| `32ddb5ab` | 2026-05-25 | Validación código barras vacío en creación producto |
| `95911147` | 2026-05-23 | Reporte de ventas por producto (back-end + frontend con gráfico dona + Excel) |
| `896b7b05` | 2026-05-22 | Performance: eliminar N+1 queries, paginación CxC/CxP/compras, índices BD |
| `2da1a828` | 2026-05-22 | Fix bucle session-expired al cargar login (interceptor api.js) + logger global |
| `7fc83c6a` | 2026-05-22 | Fix impresión térmica 80mm + PDF cotización (right-align, truncado, notas wrap) |
| `1e925930` | 2026-05-22 | Eliminar `.rar` del tracking de git |

---

## 1. ACTUALIZAR.bat — actualizador automático

### Rutas portables (`%~dp0`)
Cambia `%CD%` por `%~dp0` en 8 rutas para que el script funcione sin importar desde qué directorio se ejecute.

```diff
-set "BACKEND_DIR=%CD%\backend"
+set "BACKEND_DIR=%~dp0backend"
```

### .env backup no fatal
Si falla el respaldo del `.env`, ya no aborta la actualización. Solo avisa y continúa.

### Descarga con git (reemplaza ZIP)
El repositorio es privado, la descarga anónima de ZIP no funcionaba. Ahora usa:

```batch
git fetch origin main
git reset --hard origin/main
```

Esto funciona con las credenciales guardadas de git y preserva `.gitignore` (`.env`, `data/`, `node_modules/` no se tocan).

---

## 2. Paginación — `limit: -1`

**Archivos modificados:**
- `backend/src/utils/pagination.js`
- `backend/src/controllers/productController.js`
- `frontend/src/pages/POS.jsx`

### `pagination.js`
`parsePaginationParams` permite pasar `limit: -1` sin clamp (antes lo convertía a 1).

### `productController.js`
Cuando `limit === -1`, omite `skip`/`take` en el `findMany` para traer TODOS los productos sin paginación.

### `POS.jsx`
Cambia `limit: 1000` → `limit: -1` para mostrar el inventario completo en el POS.

---

## 3. Settings — Configuración persistente

**Archivo:** `frontend/src/context/AppContext.jsx`

### Problema
Los campos `accent` y `secondary` (colores del tema) no existen en la base de datos (Prisma). Al enviarlos al API, Prisma rechazaba la actualización y los cambios (ITBIS, tiempo, etc.) solo se guardaban en `localStorage`. Al recargar la app, se perdían.

### Solución
Extraer `accent` y `secondary` del objeto antes de enviarlo al API:

```javascript
const { accent, secondary, ...apiData } = newSettings;
const response = await settingsService.update(apiData);
```

---

---

## 4. Billing.jsx — Exportar Facturas a Excel y PDF

**Archivos nuevos:**
- `frontend/src/utils/pdfGenerator.js` — Generación de PDF profesional con jsPDF
- `frontend/src/utils/excelExporter.js` — Exportación a Excel multi-hoja con SheetJS

**Archivo modificado:**
- `frontend/src/pages/Billing.jsx`

### PDF (`pdfGenerator.js`)
- `generateInvoicePDF` — Factura completa con logo, datos empresa, cliente, items, totales, pie de página
- `generateARReportPDF` — Reporte de Cuentas por Cobrar con tarjetas de resumen
- `generateReminderPDF` — Recordatorio de pago personalizable

### Excel (`excelExporter.js`)
- `exportToExcel` — Función genérica: recibe sheets con columnas + datos
- `exportSalesToExcel` — Facturas con todas las columnas (NCF, método, estado)
- `exportARToExcel` — CxC ordenado por vencimiento + hoja de resumen
- `exportInventoryToExcel` — Inventario completo
- `exportClientsToExcel` — Clientes con balance y límite
- `exportAccountMovementsToExcel` — Movimientos contables

### Billing.jsx
- Botón "Exportar a Excel" en el header
- Botón de descarga PDF por cada factura (ícono `fa-file-pdf`)
- La función `downloadInvoicePDF` obtiene items completos si hace falta

---

## 5. Toast notifications — Reemplazo de `alert()` nativos

**Archivo:** `frontend/src/context/AppContext.jsx`

### Problema
Los `alert()` nativos de JavaScript se veían fuera de lugar en una app moderna, no tenían estilos consistentes y bloqueaban la interacción.

### Solución
Se implementó `showNotification(message, type, duration)` en `AppContext`:
- **Tipos:** `success`, `error`, `warning`, `info`
- **Estilos:** colores coherentes con el tema, animación `slideIn`, posición fija arriba a la derecha
- **Auto-dismiss:** se cierra después de `duration` ms (default 3000)
- **Uso:** `const { showNotification } = useApp(); showNotification('Mensaje', 'success');`
- Se reemplazaron todos los `alert()` en todas las páginas del frontend

---

## 6. ConfirmModal — Reemplazo de `confirm()` nativos

**Archivo nuevo:** `frontend/src/components/ConfirmModal.jsx`

### Problema
Los `confirm()` nativos bloqueaban la UI y no se veían profesionales.

### Solución
Componente `ConfirmModal` reutilizable con:
- `show`, `title`, `message`, `icon`, `iconColor`
- `confirmText`, `confirmButtonClass`
- Callbacks `onConfirm`, `onCancel`
- Se reemplazaron todos los `confirm()` en todas las páginas

---

## 7. Tickets térmicos — Estandarización CSS

### Fase 1 — CSS unificado (commit `ee5a9838`)
- Estilos consistentes para `thermal-58` (50mm), `thermal-80` (72mm) y `letter`
- Aplicado en: POSQR, Reports, Billing

### Fase 2 — Nomenclatura (commit `da47a429`)
- `ticket58` → `thermal-58`
- `ticket80` → `thermal-80`

### Fase 3-5 — Mejoras PDF (commit `964f2923`)
- `MonthlyClosing` print
- Cleanup de imports no usados
- `receiptFooterMessage` en settings

### Fix adicional (commit `d3bd70e3`)
- Fecha no se desbordaba en PDF
- Recuadros correctos en `QuotationLetterReceipt`
- Marca de agua en PDF/HTML

### Fix térmico 80mm (commit `7fc83c6a`)
- Padding, max-width, box-sizing corregidos
- PDF cotización: right-align offset, truncado, notas wrap

---

## 8. POS.jsx — Mejoras en flujo de efectivo

### Enter key + auto-print (commit `79c58909`)
- Presionar Enter en el input de efectivo abre el overlay de confirmación
- Tras confirmar, imprime automáticamente

### Evitar TDZ (commit `c0160416`)
- Mover todos los `useEffect` después de los `useCallback` para evitar *Temporal Dead Zone*

### Enter procesa venta directo (commit `27d5cdb5`)
- Enter en input de efectivo procesa la venta directamente (para flujo rápido)

### Swap handlers + prop passing (commits `7a6655d0`, `1cb1caa6`)
- `handleCashEnter` y `handleProcessSale` ordenados correctamente
- `onCashEnter` pasado como prop a `CartSummary`

### Overlay en vez de submit directo (commit `538fbf07`)
- Enter en input de efectivo ahora muestra el overlay de cambio antes de confirmar

### Ignorar auto-repeat (commit `ba6fc391`)
- Si el usuario mantiene presionada la tecla Enter, no se dispara múltiples veces

---

## 9. Reporte de ventas por producto (commit `95911147`)

**Archivos modificados:**
- `backend/src/routes/sales.js` — Nueva ruta `/sales/by-product`
- `backend/src/controllers/saleController.js` — Controlador con agrupación por producto
- `frontend/src/pages/Reports.jsx` — Nuevo tab "Ventas por Producto" con:
  - Gráfico dona (Chart.js)
  - Filtro por categoría
  - Exportación a Excel

---

## 10. Performance — N+1 queries + índices (commit `896b7b05`)

- Eliminados N+1 queries en `suppliers.createSale` y `suppliers.cancelSale`
- Paginación implementada en Cuentas por Cobrar (CxC), Cuentas por Pagar (CxP) y compras
- Índices compuestos agregados en la base de datos para consultas frecuentes

---

## 11. Fix session-expired + logger global (commit `2da1a828`)

- Interceptor en `api.js` detecta `401` y redirige al login sin bucle infinito
- Logger global de errores en el backend (`middleware/errorHandler.js`)

---

## 12. ACTUALIZAR.bat — Soporte para Node.js portátil

**Problema:** En la PC de producción no hay Node.js instalado globalmente, solo el portátil en `bin/`. `ACTUALIZAR.bat` fallaba porque usaba `npm`/`npx` del PATH del sistema.

**Solución:** Detectar primero `bin\node.exe` portátil. Si existe, usar ese; si no, caer en el del sistema.

```batch
if exist "%~dp0bin\node.exe" (
    set "NPM_CMD=%~dp0bin\npm.cmd"
    set "NPX_CMD=%~dp0bin\npx.cmd"
) else (
    set "NPM_CMD=npm"
    set "NPX_CMD=npx"
)
```

Todas las llamadas a `npm install`, `npx prisma generate`, `npx prisma db push` y `npx vite build` ahora usan `"%NPM_CMD%"` y `"%NPX_CMD%"`.

---

## 13. POS.jsx — Scroll en overlay de confirmación de efectivo

**Problema:** El overlay de confirmación de efectivo (`showCashConfirm`) no tenía `max-height` ni `overflow-y`. En pantallas pequeñas o con mucho contenido, los botones quedaban fuera de la vista sin posibilidad de hacer scroll.

**Solución:** Agregar `maxHeight: '90vh', overflowY: 'auto'` al contenedor interno del overlay.

```jsx
<div style={{ ..., maxHeight: '90vh', overflowY: 'auto' }}>
```

---

## Para desplegar en la otra PC

### Opción 1 — Copiar archivos manualmente

Copiar estos 5 archivos desde esta PC:

1. `ACTUALIZAR.bat`
2. `backend/src/utils/pagination.js`
3. `backend/src/controllers/productController.js`
4. `frontend/src/pages/POS.jsx`
5. `frontend/src/context/AppContext.jsx`

Luego ejecutar:

```cmd
cd backend
npx prisma generate
cd ..\frontend
npx vite build
```

Y reiniciar con `INICIAR.bat`.

### Opción 2 — Usar ACTUALIZAR.bat (si git está configurado)

```cmd
git init
git remote add origin https://github.com/Dextrem/Nuevo_proyecto.git
ACTUALIZAR.bat
```
