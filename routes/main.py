"""
Rutas principales de la aplicación
"""
from flask import Blueprint, render_template, request, jsonify
from flask_login import current_user
from models import db, MenuItem, Categoria, Servicio, Mesero, Mesa
from datetime import datetime

main_bp = Blueprint('main', __name__)


@main_bp.route('/')
def index():
    """Página principal"""
    return render_template('index.html')


@main_bp.route('/menu')
def menu():
    """Página del menú"""
    try:
        categorias = Categoria.query.order_by(Categoria.orden).all()
        items = MenuItem.query.filter_by(disponible=True).all()
        
        # Organizar items por categoría
        # Se pasa la lista plana de items y las categorías para permitir el filtrado por JS
        return render_template('menu.html', categorias=categorias, items=items)
    except Exception as e:
        print(f"Error en /menu: {e}")
        return render_template('menu.html', categorias=[], menu_por_categoria={})


@main_bp.route('/servicios')
def servicios():
    """Página de servicios"""
    try:
        servicios_list = Servicio.query.filter_by(disponible=True).all()
        return render_template('servicios.html', servicios=servicios_list)
    except Exception as e:
        print(f"Error en /servicios: {e}")
        return render_template('servicios.html', servicios=[])


@main_bp.route('/equipo')
def equipo():
    """Página del equipo de trabajo"""
    try:
        meseros = Mesero.query.filter_by(disponible=True).all()
        return render_template('equipo.html', meseros=meseros)
    except Exception as e:
        print(f"Error en /equipo: {e}")
        return render_template('equipo.html', meseros=[])


@main_bp.route('/reservas')
def reservas():
    """Página de reservas"""
    if not current_user.is_authenticated:
        return render_template('auth/login_required.html', redirect_to='main.reservas')
    
    try:
        mesas = Mesa.query.filter_by(disponible=True).all()
        meseros = Mesero.query.filter_by(disponible=True).all()
        servicios_list = Servicio.query.filter_by(disponible=True).all()
        
        return render_template('reservas.html', mesas=mesas, meseros=meseros, servicios=servicios_list, now=datetime.now())
    except Exception as e:
        print(f"Error en /reservas: {e}")
        return render_template('reservas.html', mesas=[], meseros=[], servicios=[], now=datetime.now())


@main_bp.route('/domicilios')
def domicilios():
    """Página de domicilios"""
    try:
        categorias = Categoria.query.order_by(Categoria.orden).all()
        items = MenuItem.query.filter_by(disponible=True).all()
        
        return render_template('domicilios.html', categorias=categorias, items=items)
    except Exception as e:
        print(f"Error en /domicilios: {e}")
        return render_template('domicilios.html', categorias=[], items=[])


# API Endpoints para obtener datos
@main_bp.route('/api/menu')
def api_menu():
    """API para obtener el menú completo"""
    try:
        categorias = Categoria.query.order_by(Categoria.orden).all()
        items = MenuItem.query.filter_by(disponible=True).all()
        
        menu_data = []
        for categoria in categorias:
            categoria_items = [item.to_dict() for item in items if item.categoria_id == categoria.id]
            if categoria_items:
                menu_data.append({
                    'categoria': categoria.to_dict(),
                    'items': categoria_items
                })
        
        return jsonify(menu_data)
    except Exception as e:
        print(f"Error en /api/menu: {e}")
        return jsonify([])


@main_bp.route('/api/mesas')
def api_mesas():
    """API para obtener mesas disponibles (excluyendo las ocupadas por otros usuarios)"""
    try:
        from models import Pedido
        
        # Obtener todas las mesas disponibles
        mesas = Mesa.query.filter_by(disponible=True).all()
        
        # Si el usuario está autenticado, obtener pedidos activos de OTROS usuarios
        if current_user.is_authenticated:
            pedidos_activos = Pedido.query.filter(
                Pedido.mesa_id.isnot(None),
                Pedido.estado.in_(['pendiente', 'preparando', 'enviado']),
                Pedido.usuario_id != current_user.id  # Excluir pedidos del usuario actual
            ).all()
        else:
            # Si no está autenticado, mostrar todas las mesas ocupadas
            pedidos_activos = Pedido.query.filter(
                Pedido.mesa_id.isnot(None),
                Pedido.estado.in_(['pendiente', 'preparando', 'enviado'])
            ).all()
        
        # IDs de mesas ocupadas por otros
        mesas_ocupadas_ids = set(p.mesa_id for p in pedidos_activos if p.mesa_id)
        
        # Filtrar mesas que no estén ocupadas por otros
        mesas_disponibles = [
            mesa.to_dict() for mesa in mesas 
            if mesa.id not in mesas_ocupadas_ids
        ]
        
        return jsonify(mesas_disponibles)
    except Exception as e:
        print(f"Error en /api/mesas: {e}")
        return jsonify([])


@main_bp.route('/api/meseros')
def api_meseros():
    """API para obtener meseros disponibles"""
    try:
        meseros = Mesero.query.filter_by(disponible=True).all()
        return jsonify([mesero.to_dict() for mesero in meseros])
    except Exception as e:
        print(f"Error en /api/meseros: {e}")
        return jsonify([])


@main_bp.route('/api/servicios')
def api_servicios():
    """API para obtener servicios disponibles"""
    try:
        servicios_list = Servicio.query.filter_by(disponible=True).all()
        return jsonify([servicio.to_dict() for servicio in servicios_list])
    except Exception as e:
        print(f"Error en /api/servicios: {e}")
        return jsonify([])
