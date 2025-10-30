"""
Rutas del panel de caja/tienda
"""
from flask import Blueprint, render_template, request, jsonify
from flask_login import login_required, current_user
from functools import wraps
from datetime import datetime
from models import db, Pedido, Mesa
try:
    from models import Factura
except ImportError:
    Factura = None

caja_bp = Blueprint('caja', __name__, url_prefix='/caja')


def cajero_required(f):
    """Decorador para verificar que el usuario es cajero o admin"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or current_user.rol not in ['cajero', 'admin']:
            return jsonify({'error': 'No autorizado'}), 403
        return f(*args, **kwargs)
    return decorated_function


@caja_bp.route('/')
@login_required
@cajero_required
def panel_caja():
    """Panel de caja"""
    return render_template('panels/caja.html')


@caja_bp.route('/api/facturas-pendientes')
@login_required
@cajero_required
def facturas_pendientes():
    """Obtener facturas pendientes de pago"""
    if Factura is None:
        return jsonify({'error': 'Funcionalidad de facturas no disponible'}), 404

    facturas = Factura.query.filter_by(estado='pendiente').order_by(Factura.fecha_creacion.desc()).all()
    
    facturas_data = []
    for factura in facturas:
        factura_dict = factura.to_dict()
        
        # Agregar información de la mesa
        if factura.mesa_id:
            mesa = Mesa.query.get(factura.mesa_id)
            factura_dict['mesa'] = mesa.to_dict() if mesa else None
        
        # Agregar información del pedido
        factura_dict['pedido_detalle'] = factura.pedido.to_dict() if factura.pedido else None
        
        facturas_data.append(factura_dict)
    
    return jsonify(facturas_data)


@caja_bp.route('/api/pedidos-piscina')
@login_required
@cajero_required
def pedidos_piscina():
    """Obtener pedidos desde la piscina"""
    pedidos = Pedido.query.filter_by(
        tipo='piscina',
        estado='pendiente'
    ).order_by(Pedido.fecha_pedido.asc()).all()
    
    return jsonify([pedido.to_dict() for pedido in pedidos])


@caja_bp.route('/api/pedido/<int:pedido_id>/despachar', methods=['POST'])
@login_required
@cajero_required
def despachar_pedido_piscina(pedido_id):
    """Despachar un pedido de piscina"""
    try:
        pedido = Pedido.query.get_or_404(pedido_id)
        
        if pedido.tipo != 'piscina':
            return jsonify({'error': 'Este pedido no es de piscina'}), 400
        
        pedido.estado = 'entregado'
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Pedido despachado exitosamente'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@caja_bp.route('/api/factura/<int:factura_id>/pagar', methods=['POST'])
@login_required
@cajero_required
def pagar_factura(factura_id):
    """Registrar el pago de una factura"""
    try:
        if Factura is None:
            return jsonify({'error': 'Funcionalidad de facturas no disponible'}), 404
        data = request.get_json()
        metodo_pago = data.get('metodo_pago', 'efectivo')
        
        factura = Factura.query.get_or_404(factura_id)
        
        if factura.estado != 'pendiente':
            return jsonify({'error': 'Esta factura ya fue procesada'}), 400
        
        factura.estado = 'pagada'
        factura.metodo_pago = metodo_pago
        factura.fecha_pago = datetime.utcnow()
        
        # Actualizar el estado del pedido
        if factura.pedido:
            factura.pedido.estado = 'entregado'
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Pago registrado exitosamente',
            'factura': factura.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@caja_bp.route('/api/mesa/<int:mesa_id>/cuenta')
@login_required
@cajero_required
def obtener_cuenta_mesa(mesa_id):
    """Obtener la cuenta total de una mesa"""
    # Obtener todos los pedidos activos de la mesa
    pedidos = Pedido.query.filter_by(
        mesa_id=mesa_id,
        estado='listo'
    ).all()
    
    total = sum(float(pedido.total) for pedido in pedidos)
    
    return jsonify({
        'mesa_id': mesa_id,
        'total': total,
        'pedidos': [pedido.to_dict() for pedido in pedidos]
    })


@caja_bp.route('/api/crear-factura', methods=['POST'])
@login_required
@cajero_required
def crear_factura():
    """Crear una factura para un pedido"""
    try:
        if Factura is None:
            return jsonify({'error': 'Funcionalidad de facturas no disponible'}), 404
        data = request.get_json()
        pedido_id = data.get('pedido_id')
        
        if not pedido_id:
            return jsonify({'error': 'ID de pedido requerido'}), 400
        
        pedido = Pedido.query.get_or_404(pedido_id)
        
        # Verificar si ya existe una factura para este pedido
        factura_existente = Factura.query.filter_by(pedido_id=pedido_id).first()
        if factura_existente:
            return jsonify({'error': 'Ya existe una factura para este pedido'}), 400
        
        # Crear nueva factura
        nueva_factura = Factura(
            pedido_id=pedido.id,
            mesa_id=pedido.mesa_id,
            usuario_id=pedido.usuario_id,
            total=pedido.total,
            estado='pendiente'
        )
        
        db.session.add(nueva_factura)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Factura creada exitosamente',
            'factura': nueva_factura.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
