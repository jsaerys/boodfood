from decimal import Decimal
from sqlalchemy.exc import IntegrityError
import os, sys

# Asegurar que el directorio de proyecto está en sys.path para importar app y models
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app
from models import db, Usuario, MenuItem, Pedido, PedidoItem


def run_test():
    app = create_app('development')
    with app.app_context():
        # Asegurar usuario de prueba
        user = Usuario.query.first()
        if not user:
            user = Usuario(nombre='Test', apellido='User', email='test@example.com')
            user.set_password('test')
            db.session.add(user)
            db.session.commit()

        # Crear menu item de prueba
        menu = MenuItem.query.first()
        if not menu:
            menu = MenuItem(restaurante_id=1, nombre='Plato Test', precio=Decimal('10.00'))
            db.session.add(menu)
            db.session.commit()

        # Crear pedido de prueba
        pedido = Pedido(usuario_id=user.id, restaurante_id=1, subtotal=Decimal('0.00'), total=Decimal('0.00'), metodo_pago='efectivo')
        db.session.add(pedido)
        db.session.flush()  # obtener id sin commit

        print('Pedido creado id=', pedido.id)

        # Usar helper para agregar/actualizar items
        from utils.pedido_utils import add_or_update_pedido_item

        add_or_update_pedido_item(pedido.id, menu, 1, Decimal('10.00'))
        db.session.commit()
        print('Primer pedido_item insertado/actualizado OK')

        # Llamar de nuevo con cantidad 2 — el helper debe sumarizar en lugar de crear un duplicado
        add_or_update_pedido_item(pedido.id, menu, 2, Decimal('10.00'))
        db.session.commit()

        # Verificar que sólo exista un registro con cantidad = 3
        pi = PedidoItem.query.filter_by(pedido_id=pedido.id, menu_item_id=menu.id).first()
        if not pi:
            print('ERROR: no se encontró pedido_item después de operaciones')
            return

        print('PedidoItem final cantidad=', pi.cantidad, 'subtotal=', pi.subtotal)
        if pi.cantidad == 3:
            print('Prueba OK: cantidades sumadas correctamente')
        else:
            print('Prueba FALLIDA: cantidad esperada 3, obtenida', pi.cantidad)


if __name__ == '__main__':
    run_test()
