# Changelog - 27 de Mayo, 2026

## Mejoras visuales
- **ConfirmModal.jsx**: Header con branding DEXTREMIX (gradiente morado), variantes (`danger`, `warning`, `info`), animaciones (slideUp + scale, iconPulse), ícono circular con fondo. Compatible hacia atrás.
- **styles.css**: 8 clases CSS nuevas y 2 animaciones (`confirmSlideUp`, `iconPulse`).

## Reemplazo de modales inline
- **Inventory.jsx** (líneas 921-943): Modal inline reemplazado por `<ConfirmModal variant="danger">`.
- **Users**, **Suppliers**, **Quotations**, **FiscalReports**, **Clients**, **Budget**, **Billing**, **AccountsPayable**, **Accounting**: Todas las páginas actualizadas con `variant="danger"` en eliminaciones y `variant="warning"` en advertencias.

## PDF - Overflow de números corregido
- **pdfGenerator.js** (`generateInvoicePDF`):
  - Columnas redistribuidas: Producto 78mm, Cantidad 25mm, Precio 25mm, ITBIS 28mm, **Total 30mm** (antes 11mm, desbordaba el papel).
  - Números alineados a la derecha dentro del ancho de cada columna con `{ align: 'right' }`.
  - Nombres de productos largos envueltos con `splitTextToSize`.
  - Altura de fila dinámica para nombres multilínea (`rowH`).

## Marca de agua PDF
- **pdfGenerator.js** (`generateInvoicePDF`): Marca de agua añadida — nombre de empresa en 72pt gris claro (230,230,240), centrada en `(pw/2, ph/2)` con rotación -45°, en todas las páginas.
- **Quotations.jsx** (`downloadPDF`): Marca de agua reposicionada al centro exacto de la página (de `y=145` a `ph/2`).

## Sistema de impresión térmica (verificado)
- **POS**, **Billing**, **Quotations**, **Reports**, **POSQR**: Verificados los templates 58mm y 80mm. Todos manejan correctamente el contenido:
  - 58mm: ~46mm de contenido usable, nombres truncados con ellipsis, wrapping natural para NCF/notas.
  - 80mm: ~66mm de contenido usable, espacio suficiente para todos los campos.
  - No se detectaron desbordamientos críticos.

## Flujo de caja (investigado)
- `currentAmount` se actualiza correctamente con: apertura de caja, ventas CONTADO, abonos a crédito, cobros CxC, transacciones manuales.
- Contabilidad (`Transaction`) es independiente de caja (`CashTransaction`).
- `openingAmount >= 0` sin mínimo obligatorio (válido $0).
