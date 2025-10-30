"""
Rutas para el panel de cuenta del usuario
"""
from flask import Blueprint, render_template, request, jsonify, redirect, url_for
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash
from datetime import datetime
import os
from models import db, Usuario, Pedido, Reserva

cuenta_bp = Blueprint('cuenta', __name__, url_prefix='/cuenta')

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@cuenta_bp.route('/')
@login_required
def mi_cuenta():
    """Panel principal de cuenta del usuario"""
    return render_template('cuenta/mi_cuenta.html')


@cuenta_bp.route('/api/mis-pedidos')
@login_required
def obtener_mis_pedidos():
    """API para obtener los pedidos del usuario"""
    try:
        pedidos = Pedido.query.filter_by(usuario_id=current_user.id)\
            .order_by(Pedido.fecha_pedido.desc())\
            .all()
        
        return jsonify({
            'success': True,
            'pedidos': [p.to_dict() for p in pedidos]
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@cuenta_bp.route('/api/mis-reservas')
@login_required
def obtener_mis_reservas():
    """API para obtener las reservas del usuario"""
    try:
        reservas = Reserva.query.filter_by(usuario_id=current_user.id)\
            .order_by(Reserva.fecha.desc())\
            .all()
        
        return jsonify({
            'success': True,
            'reservas': [r.to_dict() for r in reservas]
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@cuenta_bp.route('/api/cancelar-pedido/<int:pedido_id>', methods=['POST'])
@login_required
def cancelar_pedido(pedido_id):
    """Cancelar un pedido del usuario"""
    try:
        pedido = Pedido.query.get_or_404(pedido_id)
        
        # Verificar que el pedido pertenece al usuario
        if pedido.usuario_id != current_user.id:
            return jsonify({'success': False, 'error': 'No autorizado'}), 403
        
        # Solo se puede cancelar si está pendiente o preparando
        if pedido.estado not in ['pendiente', 'preparando']:
            return jsonify({
                'success': False,
                'error': 'No se puede cancelar un pedido en estado: ' + pedido.estado
            }), 400
        
        pedido.estado = 'cancelado'
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Pedido cancelado exitosamente'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@cuenta_bp.route('/api/cancelar-reserva/<int:reserva_id>', methods=['POST'])
@login_required
def cancelar_reserva(reserva_id):
    """Cancelar una reserva del usuario"""
    try:
        reserva = Reserva.query.get_or_404(reserva_id)
        
        # Verificar que la reserva pertenece al usuario
        if reserva.usuario_id != current_user.id:
            return jsonify({'success': False, 'error': 'No autorizado'}), 403
        
        # Solo se puede cancelar si está pendiente o confirmada
        if reserva.estado not in ['pendiente', 'confirmada']:
            return jsonify({
                'success': False,
                'error': 'No se puede cancelar una reserva en estado: ' + reserva.estado
            }), 400
        
        reserva.estado = 'cancelada'
        reserva.fecha_cancelacion = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Reserva cancelada exitosamente'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@cuenta_bp.route('/api/actualizar-perfil', methods=['POST'])
@login_required
def actualizar_perfil():
    """Actualizar información del perfil del usuario"""
    try:
        data = request.get_json()
        
        usuario = Usuario.query.get(current_user.id)
        
        # Actualizar campos permitidos
        if data.get('nombre'):
            usuario.nombre = data['nombre']
        if data.get('apellido'):
            usuario.apellido = data['apellido']
        if data.get('telefono'):
            usuario.telefono = data['telefono']
        if data.get('direccion'):
            usuario.direccion = data['direccion']
        if data.get('ciudad'):
            usuario.ciudad = data['ciudad']
        if data.get('codigo_postal'):
            usuario.codigo_postal = data['codigo_postal']
        
        # Actualizar contraseña si se proporciona
        if data.get('password_nueva'):
            usuario.password_hash = generate_password_hash(data['password_nueva'])
        
        usuario.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Perfil actualizado exitosamente',
            'usuario': usuario.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@cuenta_bp.route('/api/subir-foto', methods=['POST'])
@login_required
def subir_foto_perfil():
    """Subir foto de perfil del usuario"""
    try:
        if 'foto' not in request.files:
            return jsonify({'success': False, 'error': 'No se encontró archivo'}), 400
        
        file = request.files['foto']
        
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No se seleccionó archivo'}), 400
        
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            # Agregar timestamp para evitar colisiones
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"user_{current_user.id}_{timestamp}_{filename}"
            
            # Guardar en la carpeta de uploads de usuarios
            upload_folder = os.path.join('static', 'uploads', 'users')
            os.makedirs(upload_folder, exist_ok=True)
            filepath = os.path.join(upload_folder, filename)
            file.save(filepath)
            
            # Actualizar ruta en la base de datos
            usuario = Usuario.query.get(current_user.id)
            usuario.foto_perfil = f'/static/uploads/users/{filename}'
            usuario.updated_at = datetime.utcnow()
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': 'Foto subida exitosamente',
                'foto_url': usuario.foto_perfil
            })
        else:
            return jsonify({'success': False, 'error': 'Tipo de archivo no permitido'}), 400
            
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@cuenta_bp.route('/api/eliminar-foto', methods=['POST'])
@login_required
def eliminar_foto_perfil():
    """Eliminar la foto de perfil del usuario (y borrar el archivo si existe)."""
    try:
        usuario = Usuario.query.get(current_user.id)
        ruta_rel = usuario.foto_perfil  # Ej: /static/uploads/users/archivo.jpg
        
        if ruta_rel:
            try:
                # Construir ruta absoluta segura al archivo dentro del proyecto
                base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
                ruta_abs = os.path.join(base_dir, ruta_rel.lstrip('/').replace('/', os.sep))
                if os.path.exists(ruta_abs) and os.path.isfile(ruta_abs):
                    os.remove(ruta_abs)
            except Exception:
                # No bloquear por errores al eliminar el archivo físico
                pass
        
        # Limpiar en base de datos
        usuario.foto_perfil = None
        usuario.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Foto de perfil eliminada'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
