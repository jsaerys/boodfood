"""
Rutas del panel de cocina
"""
from flask import Blueprint, render_template, request, jsonify
from flask_login import login_required, current_user
from functools import wraps
from models import db, Pedido

cocina_bp = Blueprint('cocina', __name__, url_prefix='/cocina')


def cocina_required(f):
    """Decorador para verificar que el usuario es cocinero o admin"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or current_user.rol not in ['cocinero', 'admin']:
            return jsonify({'error': 'No autorizado'}), 403
        return f(*args, **kwargs)
    return decorated_function


@cocina_bp.route('/')
@login_required
@cocina_required
def panel_cocina():
    """Panel de cocina"""
    return render_template('panels/cocina.html')


@cocina_bp.route('/api/pedidos-pendientes')
@login_required
@cocina_required
def pedidos_pendientes():
    """Obtener pedidos pendientes para la cocina"""
    pedidos = Pedido.query.filter(
        Pedido.tipo.in_(['mesa', 'domicilio']),
        Pedido.estado.in_(['pendiente', 'preparando'])
    ).order_by(Pedido.fecha_pedido.asc()).all()
    
    return jsonify([pedido.to_dict() for pedido in pedidos])


@cocina_bp.route('/api/pedido/<int:pedido_id>/estado', methods=['POST'])
@login_required
@cocina_required
def actualizar_estado_pedido(pedido_id):
    """Actualizar el estado de un pedido"""
    try:
        data = request.get_json()
        nuevo_estado = data.get('estado')
        
        if nuevo_estado not in ['pendiente', 'preparando', 'listo', 'entregado', 'cancelado']:
            return jsonify({'error': 'Estado inválido'}), 400
        
        pedido = Pedido.query.get_or_404(pedido_id)
        pedido.estado = nuevo_estado
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Pedido actualizado a {nuevo_estado}',
            'pedido': pedido.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@cocina_bp.route('/api/pedido/<int:pedido_id>/despachar', methods=['POST'])
@login_required
@cocina_required
def despachar_pedido(pedido_id):
    """Marcar un pedido como listo/despachado"""
    try:
        pedido = Pedido.query.get_or_404(pedido_id)
        pedido.estado = 'listo'
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Pedido despachado exitosamente',
            'pedido': pedido.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
