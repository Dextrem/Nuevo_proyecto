# FINANDEX Frontend

Frontend React para el sistema de gestión financiera FINANDEX.

## Requisitos

- Node.js >= 18.0.0
- npm o yarn

## Instalación

1. **Instalar dependencias:**
```bash
npm install
```

2. **Iniciar en modo desarrollo:**
```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

3. **Build para producción:**
```bash
npm run build
```

4. **Previsualizar build de producción:**
```bash
npm run preview
```

## Configuración

El frontend se conecta automáticamente al backend en `http://localhost:3001`.

Para cambiar la URL del API, crear un archivo `.env`:
```env
VITE_API_URL=/api
```

## Funcionalidades

- **Dashboard**: Resumen de métricas del negocio
- **Punto de Venta (POS)**: Procesamiento de ventas con múltiples métodos de pago
- **Inventario**: Gestión completa de productos y categorías
- **Clientes**: Administración de clientes y cuentas por cobrar
- **Proveedores**: Directorio de proveedores
- **Contabilidad**: Registro de ingresos y gastos
- **Reportes**: Análisis y visualización de datos
- **Usuarios**: Gestión de usuarios y permisos
- **Configuración**: Personalización de la aplicación

## PWA

La aplicación soporta funcionalidad offline a través de Service Workers:

- Instalable como aplicación nativa
- Funciona offline (lectura de datos en cache)
- Sincronización automática cuando vuelve la conexión

## Tecnologías

- React 18
- Vite
- React Router 6
- Axios
- Chart.js
- PWA (Service Workers)

## Estructura del Proyecto

```
frontend/
├── src/
│   ├── components/    # Componentes reutilizables
│   ├── context/      # Contextos de React (Auth, App)
│   ├── hooks/        # Custom hooks
│   ├── pages/        # Páginas de la aplicación
│   ├── services/     # Servicios API
│   ├── styles/      # Estilos CSS
│   ├── App.jsx      # Componente principal
│   └── main.jsx     # Entry point
├── public/           # Archivos públicos
└── package.json
```

## Licencia

ISC
