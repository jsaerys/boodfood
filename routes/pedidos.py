# routes/pedidos.py
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from models import db, Pedido, PedidoItem, MenuItem, Inventario, InventarioMovimiento
try:
    from models import Receta
except ImportError:
    Receta = None
from datetime import datetime
import uuid
from utils.pedido_utils import add_or_update_pedido_item

pedidos_bp = Blueprint('pedidos', __name__, url_prefix='/pedidos')


@pedidos_bp.route('/crear', methods=['POST'])
@login_required
def crear_pedido():
    """Crear un nuevo pedido y actualizar inventario"""
    try:
        data = request.get_json()
        
        if not data.get('items') or len(data['items']) == 0:
            return jsonify({'error': 'El carrito está vacío'}), 400
        
        total = sum(item['precio'] * item['cantidad'] for item in data['items'])
        codigo = f"PED{uuid.uuid4().hex[:8].upper()}"
        
        nuevo_pedido = Pedido(
            usuario_id=current_user.id,
            restaurante_id=1,
            codigo_pedido=codigo,
            subtotal=total,
            total=total,
            estado='pendiente',
            metodo_pago=data.get('metodo_pago', 'efectivo'),
            direccion_entrega=data.get('direccion_entrega'),
            coordenadas_entrega=data.get('coordenadas_entrega'),
            instrucciones_entrega=data.get('instrucciones_entrega'),
            telefono_contacto=data.get('telefono_contacto', current_user.telefono),
            nombre_receptor=data.get('nombre_receptor', f"{current_user.nombre} {current_user.apellido}"),
            fecha_pedido=datetime.utcnow()
        )
        
        # Validar disponibilidad de mesa si es pedido para mesa
        if data.get('tipo') == 'mesa' and data.get('mesa_id'):
            mesa_id = int(data['mesa_id'])
            
            # Verificar que la mesa no esté ocupada por OTRO usuario (permitir si es del mismo usuario)
            pedido_existente = Pedido.query.filter(
                Pedido.mesa_id == mesa_id,
                Pedido.estado.in_(['pendiente', 'preparando', 'enviado']),
                Pedido.usuario_id != current_user.id  # Solo bloquear si es de otro usuario
            ).first()
            
            if pedido_existente:
                return jsonify({
                    'error': f'La mesa seleccionada está ocupada por otro cliente. Por favor elige otra mesa.'
                }), 400
            
            nuevo_pedido.mesa_id = mesa_id
        
        db.session.add(nuevo_pedido)
        db.session.flush()
        
        # Verificar stock antes de crear el pedido
        movimientos_inventario = []
        for item_data in data['items']:
            menu_item = MenuItem.query.get(item_data['id'])
            if not menu_item:
                # Fallback para pedidos de piscina: crear MenuItem "ligero" si no existe
                if data.get('tipo') == 'piscina':
                    nombre_fallback = item_data.get('nombre') or f"Producto piscina {item_data['id']}"
                    precio_fallback = item_data.get('precio') or 0
                    menu_item = MenuItem(
                        restaurante_id=1,
                        nombre=nombre_fallback,
                        descripcion='Producto de consumo rpido (piscina)',
                        precio=precio_fallback,
                        categoria_nombre='Piscina',
                        disponible=True,
                        imagen_url=item_data.get('imagen')
                    )
                    db.session.add(menu_item)
                    db.session.flush()
                else:
                    continue

            # Verificar recetas (ingredientes necesarios)
            if Receta is None:
                return jsonify({'error': 'Funcionalidad de recetas no disponible en el sistema'}), 500
            recetas = Receta.query.filter_by(menu_item_id=menu_item.id).all()
            cantidad_pedido = item_data['cantidad']
            
            # Verificar stock suficiente para cada ingrediente
            for receta in recetas:
                inventario_item = Inventario.query.get(receta.inventario_id)
                if inventario_item:
                    cantidad_necesaria = float(receta.cantidad_usada) * cantidad_pedido
                    if inventario_item.cantidad < cantidad_necesaria:
                        return jsonify({
                            'error': f'Stock insuficiente de "{inventario_item.nombre}" para el plato "{menu_item.nombre}"'
                        }), 400
            
            # Agregar o actualizar item del pedido (centralizado en helper)
            pedido_item = add_or_update_pedido_item(
                nuevo_pedido.id,
                menu_item,
                cantidad_pedido,
                item_data['precio']
            )
            
            # Registrar movimientos de inventario (salidas)
            for receta in recetas:
                inventario_item = Inventario.query.get(receta.inventario_id)
                if inventario_item:
                    cantidad_salida = float(receta.cantidad_usada) * cantidad_pedido
                    inventario_item.cantidad -= cantidad_salida
                    
                    # Registrar movimiento
                    movimiento = InventarioMovimiento(
                        inventario_id=inventario_item.id,
                        tipo='salida',
                        cantidad=cantidad_salida,
                        usuario_id=current_user.id,
                        notas=f'Pedido {codigo} - {menu_item.nombre} x{cantidad_pedido}'
                    )
                    movimientos_inventario.append(movimiento)
        
        # Agregar todos los movimientos de inventario
        for movimiento in movimientos_inventario:
            db.session.add(movimiento)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Pedido creado exitosamente',
            'pedido_id': nuevo_pedido.id,
            'codigo': nuevo_pedido.codigo_pedido
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500