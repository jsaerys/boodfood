from flask import Blueprint, jsonify, request
from sqlalchemy import text
from datetime import datetime, timedelta
from models import db, Categoria, Inventario, MenuItem, Mesa, Mesero, Pedido, PedidoItem, Reserva, Servicio, Usuario
from flask_login import login_required, current_user

api_bp = Blueprint('api', __name__, url_prefix='/api')

# Rutas para Menú
@api_bp.route('/menu/items', methods=['GET'])
def get_menu_items():
    """Obtener todos los items del menú disponibles"""
    try:
        items = MenuItem.query.filter_by(disponible=True).all()
        return jsonify([item.to_dict() for item in items])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Productos para pedidos en piscina desde la tabla productos_de_consumo_rapido
@api_bp.route('/piscina/productos', methods=['GET'])
def get_productos_piscina():
    """Leer productos de la tabla productos_de_consumo_rapido para pedidos en piscina"""
    # Usamos SQL crudo y filtramos disponibilidad en Python para tolerar esquemas sin la columna
    sql = text("SELECT * FROM productos_de_consumo_rapido")
    result = db.session.execute(sql).mappings().all()

    # Construir mapa de MenuItem por nombre normalizado (insensible a mayúsculas/acentos/espacios)
    import unicodedata
    def normalize(s):
        if not s:
            return ''
        s = str(s).strip().lower()
        return ''.join(c for c in unicodedata.normalize('NFKD', s) if not unicodedata.combining(c))
    menu_map = {}
    for mi in MenuItem.query.all():
        menu_map[normalize(mi.nombre)] = mi.id

    productos = []
    for row in result:
        # Filtrar por disponibilidad si la columna existe
        raw_disp = row.get('disponible') if 'disponible' in row else None
        is_disp = bool(raw_disp) if raw_disp is not None else True
        if not is_disp:
            continue

        # Mapeo flexible de columnas comunes
        pid = row.get('id') or row.get('producto_id') or row.get('codigo')
        nombre = row.get('nombre') or row.get('producto') or row.get('titulo')
        descripcion = row.get('descripcion') or row.get('detalle') or ''
        precio_raw = row.get('precio') or row.get('valor') or row.get('precio_unitario') or 0
        try:
            precio = float(precio_raw)
        except Exception:
            precio = 0.0
        imagen = row.get('imagen') or row.get('imagen_url') or row.get('foto') or None

        # Enlazar con MenuItem por nombre normalizado
        menu_item_id = menu_map.get(normalize(nombre)) if nombre else None

        productos.append({
            'id': pid,
            'nombre': nombre,
            'descripcion': descripcion,
            'precio': precio,
            'imagen': imagen,
            'disponible': is_disp,
            'menu_item_id': menu_item_id
        })

    return jsonify(productos)

# Rutas para Pedidos (detalle individual)
@api_bp.route('/pedidos/<int:pedido_id>', methods=['GET'])
@login_required
def get_pedido_detail(pedido_id):
    """Obtener detalles de un pedido específico"""
    try:
        pedido = Pedido.query.get(pedido_id)
        if not pedido:
            return jsonify({'error': 'Pedido no encontrado'}), 404
        # Autorizar: propietario o admin
        if pedido.usuario_id != current_user.id and current_user.rol not in ['admin', 'administrador']:
            return jsonify({'error': 'No autorizado'}), 403
        return jsonify(pedido.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Rutas para Reservas (detalle individual)
@api_bp.route('/reservas/<int:reserva_id>', methods=['GET'])
@login_required
def get_reserva_detail(reserva_id):
    """Obtener detalles de una reserva específica"""
    try:
        reserva = Reserva.query.get(reserva_id)
        if not reserva:
            return jsonify({'error': 'Reserva no encontrada'}), 404
        # Autorizar: propietario o admin
        if reserva.usuario_id != current_user.id and current_user.rol not in ['admin', 'administrador']:
            return jsonify({'error': 'No autorizado'}), 403
        return jsonify(reserva.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Dashboard Stats
@api_bp.route('/dashboard/stats', methods=['GET'])
def get_dashboard_stats():
    """Obtener estadísticas para el dashboard"""
    try:
        from datetime import datetime, timedelta
        today = datetime.now().date()
        
        # Pedidos de hoy
        pedidos_hoy = Pedido.query.filter(
            db.func.date(Pedido.fecha_pedido) == today
        ).count()
        
        # Reservas de hoy
        reservas_hoy = Reserva.query.filter_by(
            fecha=today.strftime('%Y-%m-%d')
        ).count()
        
        # Ventas de hoy
        ventas_hoy = db.session.query(db.func.sum(Pedido.total)).filter(
            db.func.date(Pedido.fecha_pedido) == today
        ).scalar() or 0
        
        # Estado de mesas
        total_mesas = Mesa.query.count()
        mesas_ocupadas = Mesa.query.filter_by(estado='ocupada').count()
        
        return jsonify({
            'pedidos_hoy': pedidos_hoy,
            'reservas_hoy': reservas_hoy,
            'ventas_hoy': float(ventas_hoy),
            'total_mesas': total_mesas,
            'mesas_ocupadas': mesas_ocupadas
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Actividad Reciente
@api_bp.route('/dashboard/actividad', methods=['GET'])
def get_dashboard_actividad():
    """Obtener actividad reciente para el dashboard"""
    try:
        from datetime import datetime, timedelta
        
        # Últimas 24 horas
        desde = datetime.now() - timedelta(days=1)
        
        # Obtener últimos pedidos
        pedidos = Pedido.query.filter(
            Pedido.fecha_pedido >= desde
        ).order_by(Pedido.fecha_pedido.desc()).limit(10).all()
        
        # Obtener últimas reservas
        reservas = Reserva.query.filter(
            Reserva.fecha_creacion >= desde
        ).order_by(Reserva.fecha_creacion.desc()).limit(10).all()
        
        # Combinar y ordenar actividades
        actividades = []
        
        for p in pedidos:
            actividades.append({
                'tipo': 'pedido',
                'mensaje': f'Nuevo pedido #{p.id} ({p.estado})',
                'tiempo': p.fecha_pedido.isoformat(),
                'datos': p.to_dict()
            })
        
        for r in reservas:
            actividades.append({
                'tipo': 'reserva',
                'mensaje': f'Nueva reserva para {r.fecha}',
                'tiempo': r.fecha_creacion.isoformat(),
                'datos': r.to_dict()
            })
        
        # Ordenar por tiempo
        actividades.sort(key=lambda x: x['tiempo'], reverse=True)
        
        return jsonify(actividades[:50])  # Retornar las últimas 50 actividades
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Alertas
@api_bp.route('/dashboard/alertas', methods=['GET'])
def get_dashboard_alertas():
    """Obtener alertas activas para el dashboard"""
    try:
        alertas = []
        
        # Verificar stock bajo en inventario
        items_stock_bajo = Inventario.query.filter(
            Inventario.cantidad <= Inventario.stock_minimo
        ).all()
        
        for item in items_stock_bajo:
            alertas.append({
                'tipo': 'warning',
                'mensaje': f'Stock bajo de {item.nombre}: {item.cantidad} {item.unidad}',
                'tiempo': datetime.now().isoformat(),
                'datos': item.to_dict()
            })
        
        # Verificar pedidos atrasados
        pedidos_atrasados = Pedido.query.filter(
            Pedido.estado.in_(['pendiente', 'preparando']),
            Pedido.fecha_pedido <= datetime.now() - timedelta(hours=1)
        ).all()
        
        for pedido in pedidos_atrasados:
            alertas.append({
                'tipo': 'urgent',
                'mensaje': f'Pedido #{pedido.id} atrasado ({pedido.estado})',
                'tiempo': datetime.now().isoformat(),
                'datos': pedido.to_dict()
            })
        
        return jsonify(alertas)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api_bp.route('/data/<model_name>', methods=['GET'])
def get_data(model_name):
    try:
        model = globals()[model_name.capitalize()]
        if not model:
            return jsonify({'error': 'Modelo no encontrado'}), 404

        items = model.query.all()
        return jsonify([item.to_dict() for item in items])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api_bp.route('/data/<model_name>/<int:item_id>', methods=['GET'])
def get_single_data(model_name, item_id):
    try:
        model = globals()[model_name.capitalize()]
        if not model:
            return jsonify({'error': 'Modelo no encontrado'}), 404

        item = model.query.get(item_id)
        if not item:
            return jsonify({'error': 'Elemento no encontrado'}), 404
        return jsonify(item.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api_bp.route('/data/<model_name>', methods=['POST'])
def create_data(model_name):
    try:
        model = globals()[model_name.capitalize()]
        if not model:
            return jsonify({'error': 'Modelo no encontrado'}), 404

        data = request.get_json()
        new_item = model(**data)
        db.session.add(new_item)
        db.session.commit()
        return jsonify(new_item.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@api_bp.route('/data/<model_name>/<int:item_id>', methods=['PUT'])
def update_data(model_name, item_id):
    try:
        model = globals()[model_name.capitalize()]
        if not model:
            return jsonify({'error': 'Modelo no encontrado'}), 404

        item = model.query.get(item_id)
        if not item:
            return jsonify({'error': 'Elemento no encontrado'}), 404

        data = request.get_json()
        for key, value in data.items():
            setattr(item, key, value)
        db.session.commit()
        return jsonify(item.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@api_bp.route('/data/<model_name>/<int:item_id>', methods=['DELETE'])
def delete_data(model_name, item_id):
    try:
        model = globals()[model_name.capitalize()]
        if not model:
            return jsonify({'error': 'Modelo no encontrado'}), 404

        item = model.query.get(item_id)
        if not item:
            return jsonify({'error': 'Elemento no encontrado'}), 404

        db.session.delete(item)
        db.session.commit()
        return jsonify({'message': 'Elemento eliminado correctamente'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Rutas específicas para el panel de cocina
@api_bp.route('/cocina/pedidos', methods=['GET'])
def get_pedidos_cocina():
    try:
        pedidos = Pedido.query.filter(Pedido.estado.in_(['pendiente', 'preparando', 'enviado'])).all()
        return jsonify([p.to_dict() for p in pedidos])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api_bp.route('/cocina/pedido/<int:pedido_id>/estado', methods=['PUT'])
def update_pedido_estado_cocina(pedido_id):
    try:
        pedido = Pedido.query.get(pedido_id)
        if not pedido:
            return jsonify({'error': 'Pedido no encontrado'}), 404
        
        data = request.get_json()
        new_estado = data.get('estado')
        if new_estado not in ['pendiente', 'preparando', 'enviado', 'entregado', 'cancelado', 'rechazado']:
            return jsonify({'error': 'Estado inválido'}), 400
        
        pedido.estado = new_estado
        db.session.commit()
        return jsonify(pedido.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# (Se removieron las rutas y lógica de facturas porque el modelo `Factura` ya no se usa.)

# Rutas para Inventario
@api_bp.route('/inventario/items', methods=['GET'])
def get_inventario_items():
    try:
        items = Inventario.query.all()
        return jsonify([item.to_dict() for item in items])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api_bp.route('/inventario/item', methods=['POST'])
def add_inventario_item():
    try:
        data = request.get_json()
        new_item = Inventario(**data)
        db.session.add(new_item)
        db.session.commit()
        return jsonify(new_item.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@api_bp.route('/inventario/item/<int:item_id>', methods=['PUT'])
def update_inventario_item(item_id):
    try:
        item = Inventario.query.get(item_id)
        if not item:
            return jsonify({'error': 'Item de inventario no encontrado'}), 404
        data = request.get_json()
        for key, value in data.items():
            setattr(item, key, value)
        db.session.commit()
        return jsonify(item.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@api_bp.route('/inventario/item/<int:item_id>', methods=['DELETE'])
def delete_inventario_item(item_id):
    try:
        item = Inventario.query.get(item_id)
        if not item:
            return jsonify({'error': 'Item de inventario no encontrado'}), 404
        db.session.delete(item)
        db.session.commit()
        return jsonify({'message': 'Item de inventario eliminado'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Rutas para Usuarios
@api_bp.route('/usuarios', methods=['GET'])
def get_usuarios():
    try:
        usuarios = Usuario.query.all()
        return jsonify([u.to_dict() for u in usuarios])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api_bp.route('/usuarios/<int:user_id>', methods=['PUT'])
def update_usuario(user_id):
    try:
        usuario = Usuario.query.get(user_id)
        if not usuario:
            return jsonify({'error': 'Usuario no encontrado'}), 404
        data = request.get_json()
        for key, value in data.items():
            setattr(usuario, key, value)
        db.session.commit()
        return jsonify(usuario.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@api_bp.route('/usuarios/<int:user_id>', methods=['DELETE'])
def delete_usuario(user_id):
    try:
        usuario = Usuario.query.get(user_id)
        if not usuario:
            return jsonify({'error': 'Usuario no encontrado'}), 404
        db.session.delete(usuario)
        db.session.commit()
        return jsonify({'message': 'Usuario eliminado'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Rutas para Piscina (Servicios)
@api_bp.route('/piscina/servicios', methods=['GET'])
def get_servicios_piscina():
    try:
        servicios = Servicio.query.filter_by(tipo='piscina').all()
        return jsonify([s.to_dict() for s in servicios])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api_bp.route('/piscina/servicio/<int:servicio_id>/estado', methods=['PUT'])
def update_servicio_estado_piscina(servicio_id):
    try:
        servicio = Servicio.query.get(servicio_id)
        if not servicio:
            return jsonify({'error': 'Servicio no encontrado'}), 404
        
        data = request.get_json()
        disponible = data.get('disponible')
        
        if disponible is not None:
            servicio.disponible = disponible
        else:
            return jsonify({'error': 'Estado de disponibilidad inválido'}), 400

        db.session.commit()
        return jsonify(servicio.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@api_bp.route('/piscina/pedidos', methods=['GET'])
def get_pedidos_piscina():
    try:
        # Asumiendo que los pedidos de piscina se gestionan de forma similar a cocina
        # y están relacionados con el modelo Pedido o un modelo similar.
        # Si hay un modelo específico para pedidos de piscina, se debería usar ese.
        pedidos = Pedido.query.filter(Pedido.estado.in_(['pendiente', 'preparando', 'enviado'])).all()
        return jsonify([p.to_dict() for p in pedidos])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api_bp.route('/piscina/pedido/<int:pedido_id>/estado', methods=['PUT'])
def update_pedido_estado_piscina(pedido_id):
    try:
        pedido = Pedido.query.get(pedido_id)
        if not pedido:
            return jsonify({'error': 'Pedido no encontrado'}), 404
        
        data = request.get_json()
        new_estado = data.get('estado')
        if new_estado not in ['pendiente', 'preparando', 'enviado', 'entregado', 'cancelado', 'rechazado']:
            return jsonify({'error': 'Estado inválido'}), 400
        
        pedido.estado = new_estado
        db.session.commit()
        return jsonify(pedido.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


