from decimal import Decimal
from models import db, PedidoItem


def add_or_update_pedido_item(pedido_id, menu_item, cantidad, precio_unitario):
    """Agrega un PedidoItem o actualiza la cantidad si ya existe (upsert lógico).

    Args:
        pedido_id (int): id del pedido
        menu_item (models.MenuItem): instancia de MenuItem
        cantidad (int): cantidad a sumar
        precio_unitario (Decimal|float): precio por unidad

    Returns:
        PedidoItem: la instancia creada o actualizada
    """
    # Normalizar tipos
    cantidad = int(cantidad)
    precio = Decimal(precio_unitario)

    pedido_item = PedidoItem.query.filter_by(pedido_id=pedido_id, menu_item_id=menu_item.id).first()
    if pedido_item:
        pedido_item.cantidad = (pedido_item.cantidad or 0) + cantidad
        pedido_item.subtotal = pedido_item.precio_unitario * pedido_item.cantidad
    else:
        pedido_item = PedidoItem(
            pedido_id=pedido_id,
            menu_item_id=menu_item.id,
            nombre_item=menu_item.nombre,
            descripcion_item=menu_item.descripcion or '',
            cantidad=cantidad,
            precio_unitario=precio,
            subtotal=precio * cantidad
        )
        db.session.add(pedido_item)

    return pedido_item
