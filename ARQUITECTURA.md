# Arquitectura del Sistema BoodFood

## Descripción General
Sistema web completo para restaurante con piscina, servicios de reservas, pedidos en línea y múltiples paneles administrativos.

## Componentes Principales

### 1. Frontend Público
- **Página Principal**: Información del restaurante, servicios, galería
- **Menú Digital**: Comidas, bebidas, precios
- **Sistema de Reservas**: Mesas, meseros, horarios
- **Servicios Adicionales**: Piscina, billar, alquiler para eventos
- **Equipo de Trabajo**: Presentación del personal
- **Login/Registro**: Esquina superior derecha

### 2. Panel de Cliente (En Restaurante)
- Visualización del menú en tiempo real
- Pedidos desde la mesa
- Actualización de pedidos
- Visualización de cuenta total
- Pedidos desde la piscina

### 3. Panel de Cocina
- Recepción de pedidos en tiempo real
- Cola de pedidos ordenada
- Despacho de pedidos
- Actualización automática

### 4. Panel de Tienda/Caja
- Facturas por mesa
- Total a pagar por cliente
- Gestión de pagos
- Pedidos desde piscina

### 5. Panel de Administrador
- Gestión de inventario
- Recepción de productos
- Control general del sistema

## Estructura de Base de Datos

### Tablas Principales:
1. **usuarios** - Clientes y personal
2. **mesas** - Información de mesas disponibles
3. **meseros** - Personal de servicio
4. **reservas** - Reservaciones de mesas y servicios
5. **menu_items** - Productos (comidas, bebidas)
6. **categorias** - Categorías del menú
7. **pedidos** - Pedidos de clientes
8. **pedido_items** - Detalle de pedidos
9. **facturas** - Cuentas por mesa
10. **inventario** - Control de productos
11. **servicios** - Piscina, eventos, etc.

## Tecnologías
- **Backend**: Flask (Python)
- **Base de Datos**: MySQL remota (isladigital.xyz:3311)
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla + AJAX)
- **Autenticación**: Flask-Login
- **ORM**: Flask-SQLAlchemy

## Flujo de Trabajo

### Reservas:
1. Usuario navega sin login
2. Al intentar reservar → Login/Registro
3. Selección de mesa, mesero, horario
4. Confirmación de reserva

### Pedidos en Restaurante:
1. Cliente escanea QR o accede desde dispositivo
2. Login con cuenta
3. Selecciona productos del menú
4. Envía pedido → Panel de Cocina
5. Puede actualizar pedido
6. Visualiza total acumulado
7. Panel de Caja muestra factura

### Pedidos desde Piscina:
1. Cliente hace pedido desde app
2. Pedido llega a Panel de Tienda
3. Personal de tienda prepara y entrega
4. Se suma a la cuenta del cliente

## Seguridad
- Passwords hasheados (bcrypt)
- Sesiones seguras
- Validación de permisos por rol
- Protección CSRF
