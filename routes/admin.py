"""
Rutas del panel de administrador - COMPLETO Y FUNCIONAL
"""
import os

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

from flask import Blueprint, render_template, request, jsonify
from werkzeug.utils import secure_filename
from flask_login import login_required, current_user
from functools import wraps
from datetime import datetime, date
from flask import current_app
from models import db, MenuItem, Categoria, Usuario, Mesa, Mesero, Servicio, Pedido, Reserva, Inventario, InventarioMovimiento

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')


def admin_required(f):
    """Decorador para verificar que el usuario es administrador"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or current_user.rol != 'admin':
            return jsonify({'error': 'No autorizado'}), 403
        return f(*args, **kwargs)
    return decorated_function


@admin_bp.route('/')
@login_required
@admin_required
def panel_admin():
    """Panel de administración principal"""
    try:
        mesas = Mesa.query.order_by(Mesa.numero.asc()).all()
        mesas_config = [m.to_dict() for m in mesas]
    except Exception:
        mesas_config = []

    # ✅ AÑADIDO: estado_inicial con datos reales para evitar el error de Undefined
    try:
        pedidos = Pedido.query.order_by(Pedido.fecha_pedido.desc()).limit(20).all()
        pedidos_data = [p.to_dict() for p in pedidos]
        
        hoy = date.today()
        reservas = Reserva.query.filter(Reserva.fecha >= hoy).order_by(Reserva.fecha, Reserva.hora).limit(10).all()
        reservas_data = [r.to_dict() for r in reservas]
        
        inventario_bajo = Inventario.query.filter(Inventario.cantidad <= Inventario.stock_minimo).all()
        inventario_data = [i.to_dict() for i in inventario_bajo]

    except Exception as e:
        current_app.logger.error(f"Error al cargar estado_inicial: {e}")
        pedidos_data = []
        reservas_data = []
        inventario_data = []

    estado_inicial = {
        "mesas": mesas_config,
        "pedidos": pedidos_data,
        "reservas": reservas_data,
        "inventario_bajo": inventario_data
    }

    return render_template(
        'panels/admin.html',
        current_user_id=current_user.id,
        mesas_config=mesas_config,
        estado_inicial=estado_inicial  # ✅ Ahora sí se pasa
    )


# ===== USUARIOS =====

@admin_bp.route('/api/mesas', methods=['GET', 'POST'])
@login_required
@admin_required
def api_mesas():
    """Devuelve todas las mesas (GET) o crea una nueva (POST)"""
    if request.method == 'POST':
        data = request.get_json()
        numero = data.get('numero')
        capacidad = data.get('capacidad')
        tipo = data.get('tipo')
        
        if not numero or not capacidad or not tipo:
            return jsonify({'error': 'Faltan datos requeridos (numero, capacidad, tipo)'}), 400
            
        if Mesa.query.filter_by(numero=numero).first():
            return jsonify({'error': f'Ya existe una mesa con el número {numero}'}), 409
            
        try:
            nueva_mesa = Mesa(numero=numero, capacidad=capacidad, tipo=tipo, disponible=True)
            db.session.add(nueva_mesa)
            db.session.commit()
            return jsonify(nueva_mesa.to_dict()), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Error al crear la mesa: {str(e)}'}), 500
            
    else: # GET
        mesas = Mesa.query.all()
        return jsonify([m.to_dict() for m in mesas])

@admin_bp.route('/api/mesas/<int:mesa_id>', methods=['DELETE'])
@login_required
@admin_required
def delete_mesa(mesa_id):
    """Elimina una mesa específica"""
    mesa = Mesa.query.get_or_404(mesa_id)
    
    try:
        db.session.delete(mesa)
        db.session.commit()
        return jsonify({'message': f'Mesa {mesa_id} eliminada exitosamente'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al eliminar la mesa: {str(e)}'}), 500


@admin_bp.route('/api/usuarios/crear', methods=['POST'])
@login_required
@admin_required
def crear_usuario():
    """Crea un nuevo usuario (solo para fines de admin)"""
    data = request.get_json()
    nombre = data.get('nombre')
    apellido = data.get('apellido', '')
    email = data.get('email')
    rol = data.get('rol', 'cliente')
    
    if not nombre or not email:
        return jsonify({'error': 'Faltan datos requeridos (nombre, email)'}), 400
        
    if Usuario.query.filter_by(email=email).first():
        return jsonify({'error': f'El email {email} ya está registrado'}), 409

    temp_password = 'password123' 
    
    try:
        nuevo_usuario = Usuario(nombre=nombre, apellido=apellido, email=email, rol=rol)
        nuevo_usuario.set_password(temp_password)
        db.session.add(nuevo_usuario)
        db.session.commit()
        return jsonify(nuevo_usuario.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al crear el usuario: {str(e)}'}), 500

@admin_bp.route('/api/usuarios/<int:user_id>/rol', methods=['PUT'])
@login_required
@admin_required
def cambiar_rol(user_id):
    """Cambia el rol de un usuario"""
    usuario = Usuario.query.get_or_404(user_id)
    data = request.get_json()
    nuevo_rol = data.get('rol')
    
    if not nuevo_rol:
        return jsonify({'error': 'Rol no proporcionado'}), 400
        
    roles_validos = ['cliente', 'mesero', 'cocinero', 'cajero', 'admin']
    if nuevo_rol not in roles_validos:
        return jsonify({'error': f'Rol inválido: {nuevo_rol}'}), 400
        
    usuario.rol = nuevo_rol
    db.session.commit()
    
    return jsonify(usuario.to_dict())

@admin_bp.route('/api/usuarios/<int:user_id>/delete', methods=['DELETE'])
@login_required
@admin_required
def eliminar_usuario_admin(user_id):
    """Elimina un usuario"""
    if user_id == current_user.id:
        return jsonify({'error': 'No puedes eliminar tu propia cuenta'}), 403
        
    usuario = Usuario.query.get_or_404(user_id)
    
    try:
        db.session.delete(usuario)
        db.session.commit()
        return jsonify({'message': f'Usuario {user_id} eliminado exitosamente'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al eliminar el usuario: {str(e)}'}), 500


# ===== PEDIDOS =====

# ✅ MODIFICADO: Asegurar que to_dict() incluya el campo 'tipo'
@admin_bp.route('/api/pedidos')
@login_required
@admin_required
def api_pedidos():
    """Devuelve todos los pedidos"""
    # Obtener parámetros de filtro (opcional)
    tipo = request.args.get('tipo')
    estado = request.args.get('estado')
    
    query = Pedido.query.order_by(Pedido.fecha_pedido.desc())
    
    if tipo:
        query = query.filter(Pedido.tipo == tipo)
    if estado:
        query = query.filter(Pedido.estado == estado)
        
    pedidos = query.all()
    return jsonify([p.to_dict() for p in pedidos])


@admin_bp.route('/api/pedidos/<int:pedido_id>')
@login_required
@admin_required
def get_pedido(pedido_id):
    """Obtiene los detalles de un pedido específico"""
    pedido = Pedido.query.get_or_404(pedido_id)
    return jsonify(pedido.to_dict())

@admin_bp.route('/api/pedidos/<int:pedido_id>/estado', methods=['POST'])
@login_required
@admin_required
def update_pedido_estado(pedido_id):
    """Actualiza el estado de un pedido específico"""
    pedido = Pedido.query.get_or_404(pedido_id)
    data = request.get_json()
    nuevo_estado = data.get('estado')
    
    if not nuevo_estado:
        return jsonify({'error': 'Estado no proporcionado'}), 400
        
    estados_validos = ['pendiente', 'preparando', 'enviado', 'entregado', 'cancelado', 'rechazado']
    if nuevo_estado not in estados_validos:
        return jsonify({'error': f'Estado inválido: {nuevo_estado}'}), 400
        
    pedido.estado = nuevo_estado
    db.session.commit()
    
    try:
        from app import socketio
        socketio.emit('estado_pedido_actualizado', {'pedido_id': pedido.id, 'estado': nuevo_estado}, namespace='/')
    except ImportError:
        pass
    
    return jsonify({'message': f'Estado de pedido {pedido_id} actualizado a {nuevo_estado}', 'estado': nuevo_estado})


@admin_bp.route('/api/usuarios/lista')
@login_required
@admin_required
def api_usuarios_lista():
    """Devuelve la lista de usuarios (solo nombre, email y rol)"""
    usuarios = Usuario.query.all()
    return jsonify([u.to_dict() for u in usuarios])


@admin_bp.route('/api/pedido/<int:pedido_id>/actualizar', methods=['PUT'])
@login_required
@admin_required
def actualizar_pedido(pedido_id):
    """Actualizar un pedido (estado, mesa, etc.)"""
    try:
        data = request.get_json()
        pedido = Pedido.query.get_or_404(pedido_id)
        
        if 'estado' in data:
            if data['estado'] in ['pendiente', 'preparando', 'enviado', 'entregado', 'cancelado', 'rechazado']:
                pedido.estado = data['estado']
        
        if 'mesa_id' in data:
            pedido.mesa_id = data['mesa_id']
        
        db.session.commit()
        return jsonify({'success': True, 'pedido': pedido.to_dict()})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ===== RESERVAS =====
@admin_bp.route('/api/reservas', methods=['GET', 'POST'])
@login_required
@admin_required
def api_reservas():
    """Devuelve todas las reservas (GET) o crea una nueva (POST)"""
    if request.method == 'POST':
        data = request.get_json()
        
        if not data.get('fecha') or not data.get('hora') or not data.get('numero_personas') or not data.get('nombre_reserva'):
            return jsonify({'error': 'Faltan datos requeridos (fecha, hora, numero_personas, nombre_reserva)'}), 400
            
        try:
            nueva_reserva = Reserva(
                usuario_id=current_user.id,
                restaurante_id=1,
                fecha=datetime.strptime(data['fecha'], '%Y-%m-%d').date(),
                hora=datetime.strptime(data['hora'], '%H:%M').time(),
                numero_personas=data['numero_personas'],
                nombre_reserva=data['nombre_reserva'],
                email_reserva=data.get('email_reserva'),
                telefono_reserva=data.get('telefono_reserva'),
                zona_mesa=data.get('zona_mesa', 'interior'),
                estado='confirmada'
            )
            db.session.add(nueva_reserva)
            db.session.commit()
            
            try:
                from app import socketio
                socketio.emit('nueva_reserva', nueva_reserva.to_dict(), namespace='/')
            except ImportError:
                pass
            
            return jsonify(nueva_reserva.to_dict()), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Error al crear la reserva: {str(e)}'}), 500
    else: # GET
        reservas = Reserva.query.order_by(Reserva.created_at.desc()).all()
        return jsonify([r.to_dict() for r in reservas])

@admin_bp.route('/api/reservas/<int:reserva_id>/estado', methods=['PUT'])
@login_required
@admin_required
def update_reserva_estado(reserva_id):
    """Actualiza el estado de una reserva específica"""
    reserva = Reserva.query.get_or_404(reserva_id)
    data = request.get_json()
    nuevo_estado = data.get('estado')
    
    if not nuevo_estado:
        return jsonify({'error': 'Estado no proporcionado'}), 400
        
    estados_validos = ['pendiente', 'confirmada', 'cancelada', 'completada', 'no_asistio']
    if nuevo_estado not in estados_validos:
        return jsonify({'error': f'Estado inválido: {nuevo_estado}'}), 400
        
    reserva.estado = nuevo_estado
    db.session.commit()
    
    try:
        from app import socketio
        socketio.emit('estado_reserva_actualizado', {'reserva_id': reserva.id, 'estado': nuevo_estado}, namespace='/')
    except ImportError:
        pass
    
    return jsonify(reserva.to_dict())


@admin_bp.route('/api/reservas/crear', methods=['POST'])
@login_required
@admin_required
def crear_reserva():
    """Crear una nueva reserva"""
    try:
        data = request.get_json()
        nueva = Reserva(
            usuario_id=data.get('usuario_id', current_user.id),
            restaurante_id=data.get('restaurante_id', 1),
            fecha=datetime.strptime(data['fecha'], '%Y-%m-%d').date(),
            hora=datetime.strptime(data['hora'], '%H:%M').time(),
            numero_personas=data['numero_personas'],
            nombre_reserva=data.get('nombre_reserva'),
            email_reserva=data.get('email_reserva'),
            telefono_reserva=data.get('telefono_reserva'),
            notas_especiales=data.get('notas_especiales'),
            estado=data.get('estado', 'pendiente'),
            metodo_pago=data.get('metodo_pago'),
            total_reserva=data.get('total_reserva', 0),
            zona_mesa=data.get('zona_mesa')
        )
        db.session.add(nueva)
        db.session.commit()
        return jsonify({'success': True, 'reserva': nueva.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
    
@admin_bp.route('/api/menu/subir-imagen', methods=['POST'])
@login_required
@admin_required
def subir_imagen_menu():
    """Subir imagen para un item del menú"""
    try:
        if 'imagen' not in request.files:
            return jsonify({'error': 'No se seleccionó ninguna imagen'}), 400
        
        file = request.files['imagen']
        if file.filename == '':
            return jsonify({'error': 'Nombre de archivo vacío'}), 400
        
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            from datetime import datetime
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{timestamp}_{filename}"
            
            filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            
            url = f"/static/uploads/menu/{filename}"
            return jsonify({'success': True, 'url': url})
        
        return jsonify({'error': 'Formato de archivo no permitido'}), 400
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/reserva/<int:reserva_id>/actualizar', methods=['PUT'])
@login_required
@admin_required
def actualizar_reserva(reserva_id):
    """Actualizar una reserva completa"""
    try:
        data = request.get_json()
        reserva = Reserva.query.get_or_404(reserva_id)
        
        # Actualizar campos simples
        for field in ['estado', 'mesa_asignada', 'zona_mesa', 'notas_especiales', 
                      'nombre_reserva', 'email_reserva', 'telefono_reserva', 
                      'numero_personas', 'total_reserva', 'metodo_pago']:
            if field in data:
                setattr(reserva, field, data[field])
        
        # Actualizar fecha y hora si vienen en el request
        if 'fecha' in data:
            reserva.fecha = datetime.strptime(data['fecha'], '%Y-%m-%d').date()
        if 'hora' in data:
            reserva.hora = datetime.strptime(data['hora'], '%H:%M').time()
        
        db.session.commit()
        
        # Emitir evento de actualización
        try:
            from app import socketio
            socketio.emit('reserva_actualizada', reserva.to_dict(), namespace='/')
        except ImportError:
            pass
        
        return jsonify({'success': True, 'reserva': reserva.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/reservas/<int:reserva_id>', methods=['GET'])
@login_required
@admin_required
def obtener_reserva(reserva_id):
    """Obtener una reserva específica"""
    try:
        reserva = Reserva.query.get_or_404(reserva_id)
        return jsonify(reserva.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/reservas/<int:reserva_id>/asignar-mesa', methods=['PUT'])
@login_required
@admin_required
def asignar_mesa_reserva(reserva_id):
    """Asignar mesa a una reserva específica"""
    try:
        data = request.get_json()
        reserva = Reserva.query.get_or_404(reserva_id)
        
        reserva.mesa_asignada = data.get('mesa_asignada')
        reserva.zona_mesa = data.get('zona_mesa', reserva.zona_mesa)
        
        db.session.commit()
        
        # Emitir evento de mesa asignada
        try:
            from app import socketio
            socketio.emit('mesa_asignada', {
                'reserva_id': reserva.id,
                'mesa': reserva.mesa_asignada,
                'zona': reserva.zona_mesa
            }, namespace='/')
        except ImportError:
            pass
        
        return jsonify({'success': True, 'reserva': reserva.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/reservas/<int:reserva_id>', methods=['DELETE'])
@login_required
@admin_required
def eliminar_reserva(reserva_id):
    """Eliminar una reserva (soft delete cambiando estado a cancelada)"""
    try:
        reserva = Reserva.query.get_or_404(reserva_id)
        
        # En lugar de eliminar, cambiar estado a cancelada
        reserva.estado = 'cancelada'
        db.session.commit()
        
        # Emitir evento de eliminación
        try:
            from app import socketio
            socketio.emit('reserva_eliminada', {'reserva_id': reserva_id}, namespace='/')
        except ImportError:
            pass
        
        return jsonify({'success': True, 'message': 'Reserva cancelada correctamente'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


## ===== INVENTARIO =====
@admin_bp.route('/api/inventario', methods=['GET', 'POST'])
@login_required
@admin_required
def api_inventario():
    """Devuelve todos los items de inventario (GET) o crea uno nuevo (POST)"""
    if request.method == 'POST':
        data = request.get_json()
        nombre = data.get('nombre')
        cantidad = data.get('cantidad')
        unidad = data.get('unidad')
        stock_minimo = data.get('stock_minimo', 0)
        
        if not nombre or not cantidad or not unidad:
            return jsonify({'error': 'Faltan datos requeridos (nombre, cantidad, unidad)'}), 400
            
        try:
            nuevo_item = Inventario(
                nombre=nombre,
                cantidad=cantidad,
                unidad=unidad,
                stock_minimo=stock_minimo
            )
            db.session.add(nuevo_item)
            db.session.commit()
            return jsonify(nuevo_item.to_dict()), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Error al crear el item: {str(e)}'}), 500
    else: # GET
        items = Inventario.query.all()
        return jsonify([i.to_dict() for i in items])

@admin_bp.route('/api/inventario/<int:item_id>/movimiento', methods=['POST'])
@login_required
@admin_required
def registrar_movimiento(item_id):
    """Registra un movimiento de inventario (entrada o salida)"""
    item = Inventario.query.get_or_404(item_id)
    data = request.get_json()
    tipo = data.get('tipo')
    cantidad = data.get('cantidad')
    notas = data.get('notas')
    
    if tipo not in ['entrada', 'salida'] or not cantidad:
        return jsonify({'error': 'Tipo de movimiento o cantidad inválida'}), 400
        
    try:
        cantidad_movimiento = float(cantidad)
        
        nuevo_movimiento = InventarioMovimiento(
            inventario_id=item.id,
            tipo=tipo,
            cantidad=cantidad_movimiento,
            usuario_id=current_user.id,
            notas=notas
        )
        db.session.add(nuevo_movimiento)
        
        if tipo == 'entrada':
            item.cantidad += cantidad_movimiento
        elif tipo == 'salida':
            if item.cantidad < cantidad_movimiento:
                return jsonify({'error': 'Stock insuficiente para esta salida'}), 400
            item.cantidad -= cantidad_movimiento
            
        db.session.commit()
        
        return jsonify({'message': 'Movimiento registrado', 'nueva_cantidad': float(item.cantidad)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al registrar movimiento: {str(e)}'}), 500

@admin_bp.route('/api/inventario/lista')
@login_required
@admin_required
def api_inventario_lista():
    """Devuelve todo el inventario"""
    items = Inventario.query.all()
    return jsonify([i.to_dict() for i in items])


@admin_bp.route('/api/inventario/crear', methods=['POST'])
@login_required
@admin_required
def crear_item_inventario():
    """Crear un nuevo item de inventario"""
    try:
        data = request.get_json()
        nuevo_item = Inventario(
            nombre=data['nombre'],
            descripcion=data.get('descripcion', ''),
            cantidad=float(data['cantidad']),
            unidad=data['unidad'],
            precio_unitario=float(data.get('precio_unitario', 0)),
            stock_minimo=float(data.get('stock_minimo', 0))
        )
        db.session.add(nuevo_item)
        db.session.commit()
        return jsonify({'success': True, 'item': nuevo_item.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/inventario/<int:item_id>/movimiento', methods=['POST'])
@login_required
@admin_required
def registrar_movimiento_inventario(item_id):
    """Registrar entrada o salida de inventario"""
    try:
        data = request.get_json()
        item = Inventario.query.get_or_404(item_id)
        tipo = data.get('tipo')
        cantidad = float(data.get('cantidad', 0))
        
        if tipo not in ['entrada', 'salida']:
            return jsonify({'error': 'Tipo de movimiento inválido'}), 400
        
        if tipo == 'salida' and item.cantidad < cantidad:
            return jsonify({'error': 'Cantidad insuficiente en inventario'}), 400
        
        movimiento = InventarioMovimiento(
            inventario_id=item.id,
            tipo=tipo,
            cantidad=cantidad,
            usuario_id=current_user.id,
            notas=data.get('notas', '')
        )
        
        if tipo == 'entrada':
            item.cantidad += cantidad
        else:
            item.cantidad -= cantidad
        
        db.session.add(movimiento)
        db.session.commit()
        return jsonify({'success': True, 'item': item.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ===== MENÚ =====

@admin_bp.route('/api/menu/crear', methods=['POST'])
@login_required
@admin_required
def crear_menu_item():
    """Crear un nuevo item del menú"""
    try:
        data = request.get_json() or {}

        nombre = data.get('nombre')
        precio = data.get('precio')
        if not nombre or precio is None:
            return jsonify({'error': 'nombre y precio son requeridos'}), 400

        restaurante_id = data.get('restaurante_id', 1)

        nuevo_item = MenuItem(
            restaurante_id=restaurante_id,
            nombre=nombre,
            descripcion=data.get('descripcion', ''),
            precio=float(precio),
            categoria_id=data.get('categoria_id'),
            imagen_url=data.get('imagen_url', ''),
            disponible=data.get('disponible', True)
        )
        db.session.add(nuevo_item)
        db.session.commit()
        return jsonify({'success': True, 'item': nuevo_item.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.exception('Error creando menu item')
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/menu/<int:item_id>/actualizar', methods=['PUT'])
@login_required
@admin_required
def actualizar_menu_item(item_id):
    """Actualizar un item del menú"""
    try:
        data = request.get_json()
        item = MenuItem.query.get_or_404(item_id)
        
        if 'nombre' in data:
            item.nombre = data['nombre']
        if 'descripcion' in data:
            item.descripcion = data['descripcion']
        if 'precio' in data:
            item.precio = float(data['precio'])
        if 'categoria_id' in data:
            item.categoria_id = data['categoria_id']
        if 'imagen_url' in data:
            item.imagen_url = data['imagen_url']
        if 'disponible' in data:
            item.disponible = data['disponible']
        
        db.session.commit()
        return jsonify({'success': True, 'item': item.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/menu/<int:item_id>', methods=['DELETE'])
@login_required
@admin_required
def eliminar_menu_item(item_id):
    """Eliminar un item del menú"""
    try:
        item = MenuItem.query.get_or_404(item_id)
        db.session.delete(item)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Item eliminado'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/api/categorias/lista')
@login_required
@admin_required
def api_categorias_lista():
    """Devuelve todas las categorías"""
    categorias = Categoria.query.all()
    return jsonify([c.to_dict() for c in categorias])


@admin_bp.route('/api/menu/items')
@login_required
@admin_required
def api_menu_items():
    """Devuelve todos los items del menú"""
    items = MenuItem.query.all()
    return jsonify([i.to_dict() for i in items])


# Nueva ruta para cargar contenido dinámico del menú
@admin_bp.route('/dashboard-content')
@login_required
@admin_required
def dashboard_content():
    """Devuelve solo el contenido HTML para la sección de dashboard"""
    return render_template('admin/dashboard_content.html')

@admin_bp.route('/pedidos-content')
@login_required
@admin_required
def pedidos_content():
    """Devuelve solo el contenido HTML para la sección de pedidos"""
    return render_template('admin/pedidos_content.html')

@admin_bp.route('/reservas-content')
@login_required
@admin_required
def reservas_content():
    """Devuelve solo el contenido HTML para la sección de reservas"""
    return render_template('admin/reservas_content.html')

@admin_bp.route('/usuarios-content')
@login_required
@admin_required
def usuarios_content():
    """Devuelve solo el contenido HTML para la sección de usuarios"""
    return render_template('admin/usuarios_content.html')

@admin_bp.route('/inventario-content')
@login_required
@admin_required
def inventario_content():
    """Devuelve solo el contenido HTML para la sección de inventario"""
    return render_template('admin/inventario_content.html')

@admin_bp.route('/mesas-content')
@login_required
@admin_required
def mesas_content():
    """Devuelve solo el contenido HTML para la sección de mesas"""
    return render_template('admin/mesas_content.html')

@admin_bp.route('/menu-content')
@login_required
@admin_required
def menu_content():
    """Devuelve solo el contenido HTML para la sección de menú"""
    return render_template('admin/menu_content.html')

@admin_bp.route('/notificaciones-content')
@login_required
@admin_required
def notificaciones_content():
    """Devuelve solo el contenido HTML para la sección de notificaciones"""
    return render_template('admin/notificaciones_content.html')

