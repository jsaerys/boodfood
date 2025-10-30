"""
Rutas para la API del panel de administrador.
Incluye endpoints para estadísticas, actividad y alertas.
"""
from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from models import db, Pedido, Reserva, Mesa, Servicio, Usuario, Inventario
from datetime import datetime, timedelta
import functools

admin_api_bp = Blueprint('admin_api', __name__, url_prefix='/admin/api')

def admin_required(f):
    """Decorador para requerir rol de administrador"""
    @functools.wraps(f)
    @login_required
    def decorated_function(*args, **kwargs):
        if current_user.rol != 'admin':
            return jsonify({'error': 'Se requiere rol de administrador'}), 403
        return f(*args, **kwargs)
    return decorated_function

@admin_api_bp.route('/stats/dashboard', methods=['GET'])
@admin_required
def get_dashboard_stats():
    """Obtiene las estadísticas principales para el dashboard"""
    try:
        today = datetime.now().date()
        
        # Pedidos de hoy
        pedidos_hoy = Pedido.query.filter(
            db.func.date(Pedido.fecha_pedido) == today
        ).count()
        
        # Ventas de hoy
        ventas_hoy = db.session.query(db.func.sum(Pedido.total)).filter(
            db.func.date(Pedido.fecha_pedido) == today
        ).scalar() or 0
        
        # Reservas de hoy
        reservas_hoy = Reserva.query.filter_by(
            fecha=today.strftime('%Y-%m-%d')
        ).count()
        
        # Estado de mesas
        total_mesas = Mesa.query.count()
        mesas_ocupadas = Mesa.query.filter_by(estado='ocupada').count()
        
        return jsonify({
            'pedidos_hoy': pedidos_hoy,
            'ventas_hoy': float(ventas_hoy),
            'reservas_hoy': reservas_hoy,
            'total_mesas': total_mesas,
            'mesas_ocupadas': mesas_ocupadas
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_api_bp.route('/stats/ventas', methods=['GET'])
@admin_required
def get_ventas_stats():
    """Obtiene estadísticas detalladas de ventas"""
    try:
        periodo = request.args.get('periodo', 'hoy')
        
        if periodo == 'hoy':
            fecha_inicio = datetime.now().date()
            fecha_fin = fecha_inicio + timedelta(days=1)
        elif periodo == 'semana':
            fecha_inicio = datetime.now().date() - timedelta(days=7)
            fecha_fin = datetime.now().date() + timedelta(days=1)
        elif periodo == 'mes':
            fecha_inicio = datetime.now().date().replace(day=1)
            fecha_fin = (fecha_inicio + timedelta(days=32)).replace(day=1)
        else:
            return jsonify({'error': 'Periodo no válido'}), 400
        
        # Ventas por estado
        ventas_por_estado = db.session.query(
            Pedido.estado,
            db.func.count(Pedido.id),
            db.func.sum(Pedido.total)
        ).filter(
            db.func.date(Pedido.fecha_pedido) >= fecha_inicio,
            db.func.date(Pedido.fecha_pedido) < fecha_fin
        ).group_by(Pedido.estado).all()
        
        # Ventas por método de pago
        ventas_por_metodo = db.session.query(
            Pedido.metodo_pago,
            db.func.count(Pedido.id),
            db.func.sum(Pedido.total)
        ).filter(
            db.func.date(Pedido.fecha_pedido) >= fecha_inicio,
            db.func.date(Pedido.fecha_pedido) < fecha_fin
        ).group_by(Pedido.metodo_pago).all()
        
        return jsonify({
            'periodo': periodo,
            'fecha_inicio': fecha_inicio.isoformat(),
            'fecha_fin': fecha_fin.isoformat(),
            'ventas_por_estado': [
                {
                    'estado': estado,
                    'cantidad': cantidad,
                    'total': float(total or 0)
                } for estado, cantidad, total in ventas_por_estado
            ],
            'ventas_por_metodo': [
                {
                    'metodo': metodo,
                    'cantidad': cantidad,
                    'total': float(total or 0)
                } for metodo, cantidad, total in ventas_por_metodo
            ]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_api_bp.route('/stats/reservas', methods=['GET'])
@admin_required
def get_reservas_stats():
    """Obtiene estadísticas detalladas de reservas"""
    try:
        periodo = request.args.get('periodo', 'hoy')
        
        if periodo == 'hoy':
            fecha = datetime.now().date()
        elif periodo == 'semana':
            fecha = datetime.now().date() - timedelta(days=7)
        elif periodo == 'mes':
            fecha = datetime.now().date().replace(day=1)
        else:
            return jsonify({'error': 'Periodo no válido'}), 400
        
        # Reservas por estado
        reservas_por_estado = db.session.query(
            Reserva.estado,
            db.func.count(Reserva.id)
        ).filter(
            Reserva.fecha >= fecha
        ).group_by(Reserva.estado).all()
        
        # Reservas por zona
        reservas_por_zona = db.session.query(
            Reserva.zona_mesa,
            db.func.count(Reserva.id)
        ).filter(
            Reserva.fecha >= fecha
        ).group_by(Reserva.zona_mesa).all()
        
        return jsonify({
            'periodo': periodo,
            'fecha_inicio': fecha.isoformat(),
            'reservas_por_estado': [
                {
                    'estado': estado,
                    'cantidad': cantidad
                } for estado, cantidad in reservas_por_estado
            ],
            'reservas_por_zona': [
                {
                    'zona': zona,
                    'cantidad': cantidad
                } for zona, cantidad in reservas_por_zona
            ]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_api_bp.route('/alertas', methods=['GET'])
@admin_required
def get_alertas():
    """Obtiene las alertas activas del sistema"""
    try:
        alertas = []
        
        # Stock bajo en inventario
        items_stock_bajo = Inventario.query.filter(
            Inventario.cantidad <= Inventario.stock_minimo
        ).all()
        
        for item in items_stock_bajo:
            alertas.append({
                'tipo': 'warning',
                'categoria': 'inventario',
                'mensaje': f'Stock bajo de {item.nombre}: {item.cantidad} {item.unidad}',
                'datos': item.to_dict(),
                'fecha': datetime.now().isoformat()
            })
        
        # Pedidos atrasados
        limite_tiempo = datetime.now() - timedelta(hours=1)
        pedidos_atrasados = Pedido.query.filter(
            Pedido.estado.in_(['pendiente', 'preparando']),
            Pedido.fecha_pedido <= limite_tiempo
        ).all()
        
        for pedido in pedidos_atrasados:
            alertas.append({
                'tipo': 'danger',
                'categoria': 'pedidos',
                'mensaje': f'Pedido #{pedido.id} atrasado ({pedido.estado})',
                'datos': pedido.to_dict(),
                'fecha': datetime.now().isoformat()
            })
        
        # Reservas sin confirmar
        reservas_pendientes = Reserva.query.filter(
            Reserva.estado == 'pendiente',
            Reserva.fecha <= datetime.now().date() + timedelta(days=1)
        ).all()
        
        for reserva in reservas_pendientes:
            alertas.append({
                'tipo': 'info',
                'categoria': 'reservas',
                'mensaje': f'Reserva #{reserva.id} sin confirmar para {reserva.fecha}',
                'datos': reserva.to_dict(),
                'fecha': datetime.now().isoformat()
            })
        
        return jsonify(alertas)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_api_bp.route('/actividad', methods=['GET'])
@admin_required
def get_actividad():
    """Obtiene el registro de actividad reciente"""
    try:
        actividad = []
        limite = datetime.now() - timedelta(days=1)
        
        # Pedidos recientes
        pedidos = Pedido.query.filter(
            Pedido.fecha_pedido >= limite
        ).order_by(Pedido.fecha_pedido.desc()).limit(20).all()
        
        for pedido in pedidos:
            actividad.append({
                'tipo': 'pedido',
                'mensaje': f'Nuevo pedido #{pedido.id}',
                'datos': pedido.to_dict(),
                'fecha': pedido.fecha_pedido.isoformat()
            })
        
        # Reservas recientes
        reservas = Reserva.query.filter(
            Reserva.fecha >= datetime.now().date()
        ).order_by(Reserva.fecha.desc()).limit(20).all()
        
        for reserva in reservas:
            actividad.append({
                'tipo': 'reserva',
                'mensaje': f'Nueva reserva #{reserva.id}',
                'datos': reserva.to_dict(),
                'fecha': reserva.created_at.isoformat()
            })
        
        # Ordenar por fecha
        actividad.sort(key=lambda x: x['fecha'], reverse=True)
        
        return jsonify(actividad[:50])  # Retornar solo las últimas 50 actividades
    except Exception as e:
        return jsonify({'error': str(e)}), 500