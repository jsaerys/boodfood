"""
Modelos de base de datos para BoodFood
Actualizados para coincidir con la estructura existente de la base de datos
"""
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()


class Usuario(UserMixin, db.Model):
    """Modelo de usuario"""
    __tablename__ = 'usuarios'
    
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    apellido = db.Column(db.String(100), nullable=False, default='')
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    telefono = db.Column(db.String(20))
    direccion = db.Column(db.Text)
    ciudad = db.Column(db.String(100))
    codigo_postal = db.Column(db.String(10))
    fecha_registro = db.Column(db.DateTime, default=datetime.utcnow)
    ultima_sesion = db.Column(db.DateTime)
    estado = db.Column(db.Enum('activo', 'inactivo', 'suspendido'))
    rol = db.Column(db.Enum('cliente', 'mesero', 'cocinero', 'cajero', 'admin'), default='cliente')
    verificado = db.Column(db.Boolean)
    genero = db.Column(db.Enum('masculino', 'femenino', 'otro', 'no_especifica'))
    fecha_nacimiento = db.Column(db.Date)
    foto_perfil = db.Column(db.String(500))
    activo = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime)
    updated_at = db.Column(db.DateTime)
    
    # Relaciones
    reservas = db.relationship('Reserva', backref='usuario', lazy=True)
    pedidos = db.relationship('Pedido', backref='usuario', lazy=True)
    
    def set_password(self, password):
        """Establece el hash de la contraseña"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Verifica la contraseña"""
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        """Convierte el usuario a diccionario"""
        return {
            'id': self.id,
            'nombre': self.nombre,
            'apellido': self.apellido,
            'email': self.email,
            'telefono': self.telefono,
            'rol': self.rol,
            'activo': self.activo
        }


class Mesa(db.Model):
    """Modelo de mesa"""
    __tablename__ = 'mesas'
    
    id = db.Column(db.Integer, primary_key=True)
    numero = db.Column(db.Integer, unique=True, nullable=False)
    capacidad = db.Column(db.Integer, nullable=False)
    ubicacion = db.Column(db.String(50))
    disponible = db.Column(db.Boolean, default=True)
    tipo = db.Column(db.Enum('interior', 'terraza', 'vip'), default='interior')
    
    def to_dict(self):
        # Determinar si la mesa está ocupada por pedidos activos
        ocupada = False
        try:
            from models import Pedido
            pedido_activo = Pedido.query.filter(
                Pedido.mesa_id == self.id,
                Pedido.estado.in_(['pendiente', 'preparando', 'enviado'])
            ).first()
            ocupada = pedido_activo is not None
        except Exception:
            pass
        
        return {
            'id': self.id,
            'numero': self.numero,
            'capacidad': self.capacidad,
            'ubicacion': self.ubicacion,
            'disponible': self.disponible,
            'tipo': self.tipo,
            'ocupada': ocupada
        }


class Mesero(db.Model):
    """Modelo de mesero"""
    __tablename__ = 'meseros'
    
    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'))
    nombre = db.Column(db.String(100), nullable=False)
    foto = db.Column(db.String(255))
    especialidad = db.Column(db.String(100))
    disponible = db.Column(db.Boolean, default=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'nombre': self.nombre,
            'foto': self.foto,
            'especialidad': self.especialidad,
            'disponible': self.disponible
        }


class Categoria(db.Model):
    """Modelo de categoría del menú"""
    __tablename__ = 'categorias'
    
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(50), nullable=False)
    descripcion = db.Column(db.Text)
    orden = db.Column(db.Integer, default=0)
    
    # Relaciones
    items = db.relationship('MenuItem', backref='categoria', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'nombre': self.nombre,
            'descripcion': self.descripcion,
            'orden': self.orden
        }


class MenuItem(db.Model):
    """Modelo de item del menú"""
    __tablename__ = 'menu_items'
    
    id = db.Column(db.Integer, primary_key=True)
    restaurante_id = db.Column(db.Integer, nullable=False)
    categoria_id = db.Column(db.Integer, db.ForeignKey('categorias.id'))
    nombre = db.Column(db.String(255), nullable=False)
    descripcion = db.Column(db.Text)
    precio = db.Column(db.Numeric(10, 2), nullable=False)
    precio_descuento = db.Column(db.Numeric(10, 2))
    categoria_nombre = db.Column(db.String(100))
    subcategoria = db.Column(db.String(100))
    imagen_url = db.Column(db.String(500))
    disponible = db.Column(db.Boolean, default=True)
    tiempo_preparacion = db.Column(db.Integer)
    calorias = db.Column(db.Integer)
    vegetariano = db.Column(db.Boolean)
    vegano = db.Column(db.Boolean)
    sin_gluten = db.Column(db.Boolean)
    picante = db.Column(db.Boolean)
    destacado = db.Column(db.Boolean)
    orden = db.Column(db.Integer)
    created_at = db.Column(db.DateTime)
    updated_at = db.Column(db.DateTime)
    
    def to_dict(self):
        return {
            'id': self.id,
            'nombre': self.nombre,
            'descripcion': self.descripcion,
            'precio': float(self.precio),
            'precio_descuento': float(self.precio_descuento) if self.precio_descuento else None,
            'categoria_id': self.categoria_id,
            'categoria_nombre': self.categoria_nombre,
            'subcategoria': self.subcategoria,
            'imagen': self.imagen_url,
            'disponible': self.disponible,
            'tiempo_preparacion': self.tiempo_preparacion,
            'vegetariano': self.vegetariano,
            'vegano': self.vegano,
            'sin_gluten': self.sin_gluten,
            'picante': self.picante,
            'destacado': self.destacado
        }


class Servicio(db.Model):
    """Modelo de servicio adicional"""
    __tablename__ = 'servicios'
    
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    descripcion = db.Column(db.Text)
    precio = db.Column(db.Numeric(10, 2), nullable=False)
    tipo = db.Column(db.Enum('piscina', 'billar', 'evento', 'otro'), nullable=False)
    capacidad = db.Column(db.Integer)
    disponible = db.Column(db.Boolean, default=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'nombre': self.nombre,
            'descripcion': self.descripcion,
            'precio': float(self.precio),
            'tipo': self.tipo,
            'capacidad': self.capacidad,
            'disponible': self.disponible
        }


class Reserva(db.Model):
    """Modelo de reserva"""
    __tablename__ = 'reservas'
    
    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=False)
    restaurante_id = db.Column(db.Integer, nullable=False)
    fecha = db.Column(db.Date, nullable=False)
    hora = db.Column(db.Time, nullable=False)
    numero_personas = db.Column(db.Integer, nullable=False)
    nombre_reserva = db.Column(db.String(200))
    email_reserva = db.Column(db.String(255))
    telefono_reserva = db.Column(db.String(20))
    notas_especiales = db.Column(db.Text)
    codigo_reserva = db.Column(db.String(20), unique=True)
    estado = db.Column(db.Enum('pendiente', 'confirmada', 'cancelada', 'completada', 'no_asistio'), default='pendiente')
    metodo_pago = db.Column(db.Enum('efectivo', 'tarjeta', 'transferencia', 'paypal'))
    deposito_pagado = db.Column(db.Numeric(10, 2))
    total_reserva = db.Column(db.Numeric(10, 2))
    duracion_estimada = db.Column(db.Integer)
    mesa_asignada = db.Column(db.String(50))
    zona_mesa = db.Column(db.Enum('terraza', 'interior', 'vip', 'privada'))
    fecha_cancelacion = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime)
    
    def to_dict(self):
        return {
            'id': self.id,
            'usuario_id': self.usuario_id,
            'fecha': self.fecha.isoformat() if self.fecha else None,
            'hora': self.hora.isoformat() if self.hora else None,
            'numero_personas': self.numero_personas,
            'nombre_reserva': self.nombre_reserva,
            'email_reserva': self.email_reserva,
            'telefono_reserva': self.telefono_reserva,
            'notas_especiales': self.notas_especiales,
            'codigo_reserva': self.codigo_reserva,
            'estado': self.estado,
            'mesa_asignada': self.mesa_asignada,
            'zona_mesa': self.zona_mesa,
            'duracion_estimada': self.duracion_estimada,
            'total_reserva': float(self.total_reserva) if self.total_reserva is not None else None
        }


class Pedido(db.Model):
    """Modelo de pedido"""
    __tablename__ = 'pedidos'
    
    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=False)
    restaurante_id = db.Column(db.Integer, nullable=False)
    codigo_pedido = db.Column(db.String(20), unique=True)
    subtotal = db.Column(db.Numeric(10, 2), nullable=False)
    impuestos = db.Column(db.Numeric(10, 2))
    costo_envio = db.Column(db.Numeric(10, 2))
    descuento = db.Column(db.Numeric(10, 2))
    total = db.Column(db.Numeric(10, 2), nullable=False)
    estado = db.Column(db.Enum('pendiente', 'preparando', 'enviado', 'entregado', 'cancelado', 'rechazado'), default='pendiente')
    metodo_pago = db.Column(db.Enum('efectivo', 'tarjeta', 'transferencia', 'paypal', 'mercado_pago'), nullable=False)
    direccion_entrega = db.Column(db.Text)
    coordenadas_entrega = db.Column(db.Text)
    instrucciones_entrega = db.Column(db.Text)
    telefono_contacto = db.Column(db.String(20))
    nombre_receptor = db.Column(db.String(200))
    fecha_pedido = db.Column(db.DateTime, default=datetime.utcnow)
    fecha_preparacion = db.Column(db.DateTime)
    fecha_envio = db.Column(db.DateTime)
    fecha_entrega = db.Column(db.DateTime)
    tiempo_estimado_entrega = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime)
    mesa_id = db.Column(db.Integer, db.ForeignKey('mesas.id'))
    mesa = db.relationship('Mesa', backref='pedidos')
    
    # Relaciones
    items = db.relationship('PedidoItem', backref='pedido', lazy=True, cascade='all, delete-orphan')
    
    def calcular_total(self):
        """Calcula el total del pedido"""
        self.subtotal = sum(item.subtotal for item in self.items)
        self.total = self.subtotal + (self.impuestos or 0) + (self.costo_envio or 0) - (self.descuento or 0)
        return self.total
    
    def to_dict(self):
        return {
            'id': self.id,
            'usuario_id': self.usuario_id,
            'codigo_pedido': self.codigo_pedido,
            'subtotal': float(self.subtotal),
            'impuestos': float(self.impuestos) if self.impuestos else 0,
            'costo_envio': float(self.costo_envio) if self.costo_envio else 0,
            'descuento': float(self.descuento) if self.descuento else 0,
            'total': float(self.total),
            'estado': self.estado,
            'metodo_pago': self.metodo_pago,
            'direccion_entrega': self.direccion_entrega,
            'telefono_contacto': self.telefono_contacto,
            'nombre_receptor': self.nombre_receptor,
            'fecha_pedido': self.fecha_pedido.isoformat() if self.fecha_pedido else None,
            'items': [item.to_dict() for item in self.items]
        }


class PedidoItem(db.Model):
    """Modelo de item de pedido"""
    __tablename__ = 'pedido_items'
    
    pedido_id = db.Column(db.Integer, db.ForeignKey('pedidos.id'), nullable=False, primary_key=True)
    menu_item_id = db.Column(db.Integer, db.ForeignKey('menu_items.id'), primary_key=True)  # Ahora también es parte de la clave primaria
    nombre_item = db.Column(db.String(255), nullable=False)
    descripcion_item = db.Column(db.Text)
    cantidad = db.Column(db.Integer, nullable=False, default=1)
    precio_unitario = db.Column(db.Numeric(10, 2), nullable=False)
    subtotal = db.Column(db.Numeric(10, 2), nullable=False)
    
    # Relación con MenuItem
    menu_item = db.relationship('MenuItem', backref='pedido_items')
    
    def to_dict(self):
        return {
            'pedido_id': self.pedido_id,
            'menu_item_id': self.menu_item_id,
            'nombre_item': self.nombre_item,
            'descripcion_item': self.descripcion_item,
            'cantidad': self.cantidad,
            'precio_unitario': float(self.precio_unitario),
            'subtotal': float(self.subtotal),
            'menu_item': self.menu_item.to_dict() if self.menu_item else None
        }


# Nota: Las tablas de Factura e Inventario no existen en la base de datos actual
# por lo que han sido removidas de este archivo. Si necesitas estas funcionalidades,
# deberás crear las tablas correspondientes en la base de datos.



class Inventario(db.Model):
    """Modelo de inventario"""
    __tablename__ = 'inventario'
    
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    descripcion = db.Column(db.Text)
    cantidad = db.Column(db.Numeric(10, 2), nullable=False)
    unidad = db.Column(db.String(20), nullable=False)
    precio_unitario = db.Column(db.Numeric(10, 2))
    stock_minimo = db.Column(db.Numeric(10, 2), default=0)
    fecha_actualizacion = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relaciones
    movimientos = db.relationship('InventarioMovimiento', backref='inventario', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'nombre': self.nombre,
            'descripcion': self.descripcion,
            'cantidad': float(self.cantidad),
            'unidad': self.unidad,
            'precio_unitario': float(self.precio_unitario) if self.precio_unitario else None,
            'stock_minimo': float(self.stock_minimo),
            'fecha_actualizacion': self.fecha_actualizacion.isoformat() if self.fecha_actualizacion else None
        }


class InventarioMovimiento(db.Model):
    """Modelo de movimiento de inventario"""
    __tablename__ = 'inventario_movimientos'
    
    id = db.Column(db.Integer, primary_key=True)
    inventario_id = db.Column(db.Integer, db.ForeignKey('inventario.id'), nullable=False)
    tipo = db.Column(db.Enum('entrada', 'salida'), nullable=False)
    cantidad = db.Column(db.Numeric(10, 2), nullable=False)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'))
    notas = db.Column(db.Text)
    fecha_movimiento = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'inventario_id': self.inventario_id,
            'tipo': self.tipo,
            'cantidad': float(self.cantidad),
            'usuario_id': self.usuario_id,
            'notas': self.notas,
            'fecha_movimiento': self.fecha_movimiento.isoformat() if self.fecha_movimiento else None
        }

class Receta(db.Model):
    """Define los ingredientes necesarios para cada plato del menú"""
    __tablename__ = 'recetas'
    
    id = db.Column(db.Integer, primary_key=True)
    menu_item_id = db.Column(db.Integer, db.ForeignKey('menu_items.id'), nullable=False)
    inventario_id = db.Column(db.Integer, db.ForeignKey('inventario.id'), nullable=False)
    cantidad_usada = db.Column(db.Numeric(10, 2), nullable=False)  # Cantidad por unidad de plato
    
    # Relaciones
    menu_item = db.relationship('MenuItem', backref=db.backref('recetas', lazy=True, cascade='all, delete-orphan'))
    inventario = db.relationship('Inventario', backref=db.backref('usos_en_recetas', lazy=True))
    
    def to_dict(self):
        return {
            'id': self.id,
            'menu_item_id': self.menu_item_id,
            'inventario_id': self.inventario_id,
            'cantidad_usada': float(self.cantidad_usada),
            'ingrediente': self.inventario.to_dict() if self.inventario else None
        }