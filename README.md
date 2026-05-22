# Finandex - Sistema de Gestión Financiera

Aplicación web portátil de gestión financiera integral para Windows. Incluye PostgreSQL portátil, servidor Node.js/Express y frontend React empaquetados.

## Características

- **Punto de Venta (POS)**: Ventas rápidas con soporte para facturación fiscal (NCF/DGII), crédito, múltiples métodos de pago y QR
- **Inventario**: Control de stock, kárdex, productos con imágenes, categorías, alertas de stock bajo
- **Facturación y Cotizaciones**: Gestión de facturas y cotizaciones con conversión a venta
- **Clientes y Proveedores**: Gestión completa con cuentas por cobrar/pagar
- **Contabilidad**: Libro diario, cierre mensual, balance general, reportes financieros
- **Caja General**: Apertura/cierre de caja, registro de transacciones
- **Presupuestos**: Planificación y seguimiento de presupuestos por período
- **Costos**: Análisis de costos por producto, márgenes de ganancia
- **Comisiones**: Cálculo y gestión de comisiones por vendedor
- **Reportes Fiscales (DGII)**: Generación de reportes 606 (Compras) y 607 (Ventas), gestión de secuencias NCF
- **Usuarios y Permisos**: Control de acceso basado en roles y permisos granulares
- **Seguridad**: Autenticación JWT con refresh tokens, rotación de tokens, cambio obligatorio de contraseña, rate limiting, bloqueo por intentos fallidos
- **Backup y Restauración**: Exportación/importación completa de la base de datos
- **Notificaciones**: Alertas programadas de cuentas por pagar y stock bajo

## Estructura del proyecto

```
financial_app/
├── backend/
│   ├── src/
│   │   ├── controllers/    # Controladores por módulo
│   │   ├── routes/         # Rutas Express
│   │   ├── middleware/     # Auth, validación, rate limiting
│   │   ├── services/       # Backup programado, scheduler
│   │   ├── utils/          # Paginación, generación de facturas, logger
│   │   ├── config/         # Conexión Prisma a PostgreSQL
│   │   └── server.js       # Punto de entrada
│   └── prisma/
│       ├── schema.prisma   # Modelo de datos
│       └── seed.js         # Datos iniciales
├── frontend/
│   ├── src/
│   │   ├── pages/          # Componentes de página (React)
│   │   ├── components/     # Componentes reutilizables
│   │   ├── context/        # AuthContext, AppContext
│   │   ├── services/       # API client (axios)
│   │   ├── hooks/          # Custom hooks
│   │   ├── styles/         # CSS global
│   │   └── utils/          # Utilidades (colores, constantes, helpers, Excel)
│   └── dist/               # Frontend compilado (generado por Vite)
├── bin/                    # Node.js y PostgreSQL portátiles
├── data/                   # Datos de PostgreSQL
├── INICIAR.bat             # Iniciar el sistema
├── INSTALAR.bat            # Instalación inicial
└── README.md
```

## Requisitos

- Windows 10 o 11 (64 bits)
- 4 GB RAM mínimo
- 500 MB espacio en disco

## Instalación

1. Ejecutar `INSTALAR.bat` como Administrador (solo la primera vez)
   - Instala dependencias npm del backend
   - Compila el frontend con Vite
   - Inicializa la base de datos PostgreSQL
   - Crea el usuario administrador
2. **Opcional**: Ejecutar `install.ps1` en PowerShell (recomendado para Windows 11).
    ```powershell
    Set-ExecutionPolicy RemoteSigned -Scope CurrentUser   # Permite scripts
    .\install.ps1
    ```
3. Ejecutar `INICIAR.bat` para arrancar el sistema
    - Inicia PostgreSQL
    - Inicia el servidor web
    - Abre el navegador en `http://localhost:3002`

## Uso

- **Usuario**: admin
- **Contraseña**: admin (se solicita cambio en el primer inicio)
- La interfaz web está disponible en `http://localhost:3002`

## Puertos

- **3002**: Servidor web (API + frontend)
- **5432**: PostgreSQL (portátil)

Si el puerto 3002 está ocupado, el sistema busca automáticamente el siguiente puerto disponible (3003, 3004, ...) y lo muestra en la consola.

## Tecnologías

- **Backend**: Node.js 20, Express, Prisma ORM
- **Frontend**: React 18, Vite, React Router, Chart.js
- **Base de datos**: PostgreSQL 16 (portátil)
- **Autenticación**: JWT con refresh tokens y rotación
