"""
Configuración y eventos de WebSocket para BoodFood
"""
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_login import current_user
from flask import request

# Inicializar SocketIO
socketio = SocketIO()

# Salas para diferentes áreas
ROOM_COCINA = 'cocina'
ROOM_CAJA = 'caja'
ROOM_ADMIN = 'admin'
ROOM_MESAS = 'mesas'

@socketio.on('connect')
def handle_connect():
    """Cliente conectado al WebSocket"""
    if not current_user.is_authenticated:
        return False
    
    # Unir usuarios a salas según su rol
    if current_user.rol == 'admin':
        join_room(ROOM_ADMIN)
        join_room(ROOM_COCINA)
        join_room(ROOM_CAJA)
    elif current_user.rol == 'cocinero':
        join_room(ROOM_COCINA)
    elif current_user.rol == 'cajero':
        join_room(ROOM_CAJA)
    
    # Clientes en mesas
    mesa_id = request.args.get('mesa_id')
    if mesa_id:
        join_room(f'mesa_{mesa_id}')
    
    emit('connection_response', {'status': 'connected'})

@socketio.on('disconnect')
def handle_disconnect():
    """Cliente desconectado"""
    if current_user.is_authenticated:
        if current_user.rol == 'admin':
            leave_room(ROOM_ADMIN)
            leave_room(ROOM_COCINA)
            leave_room(ROOM_CAJA)
        elif current_user.rol == 'cocinero':
            leave_room(ROOM_COCINA)
        elif current_user.rol == 'cajero':
            leave_room(ROOM_CAJA)

# Eventos de Pedidos
@socketio.on('nuevo_pedido')
def handle_nuevo_pedido(data):
    """Nuevo pedido creado"""
    # Notificar a cocina
    emit('pedido_recibido', data, room=ROOM_COCINA)
    # Notificar a caja si es relevante
    if data.get('requiere_pago'):
        emit('pedido_pendiente_pago', data, room=ROOM_CAJA)
    # Notificar a admin
    emit('nuevo_pedido_admin', data, room=ROOM_ADMIN)
    # Confirmar al cliente
    emit('pedido_confirmado', {
        'pedido_id': data.get('pedido_id'),
        'estado': 'recibido'
    })

@socketio.on('actualizar_estado_pedido')
def handle_actualizar_pedido(data):
    """Actualización del estado de un pedido"""
    pedido_id = data.get('pedido_id')
    nuevo_estado = data.get('estado')
    # Notificar a todas las salas relevantes
    emit('estado_pedido_actualizado', data, room=ROOM_COCINA)
    emit('estado_pedido_actualizado', data, room=ROOM_CAJA)
    emit('estado_pedido_actualizado', data, room=ROOM_ADMIN)
    # Notificar a la mesa específica si existe
    if data.get('mesa_id'):
        emit('estado_pedido_actualizado', data, room=f'mesa_{data["mesa_id"]}')

# Eventos de Mesas
@socketio.on('actualizar_estado_mesa')
def handle_actualizar_mesa(data):
    """Actualización del estado de una mesa"""
    mesa_id = data.get('mesa_id')
    estado = data.get('estado')
    emit('estado_mesa_actualizado', data, room=ROOM_MESAS)
    emit('estado_mesa_actualizado', data, room=ROOM_ADMIN)

# Eventos de Notificaciones
@socketio.on('enviar_notificacion')
def handle_notificacion(data):
    """Enviar notificación a usuarios específicos o roles"""
    destino = data.get('destino')
    if destino == 'cocina':
        emit('nueva_notificacion', data, room=ROOM_COCINA)
    elif destino == 'caja':
        emit('nueva_notificacion', data, room=ROOM_CAJA)
    elif destino == 'admin':
        emit('nueva_notificacion', data, room=ROOM_ADMIN)
    elif destino.startswith('mesa_'):
        emit('nueva_notificacion', data, room=destino)