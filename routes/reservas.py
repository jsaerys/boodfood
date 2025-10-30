"""
Rutas de gestión de reservas
"""
from flask import Blueprint, request, jsonify, render_template, redirect, url_for
from flask_login import login_required, current_user
from datetime import datetime
import random
import string
from models import db, Reserva, Mesa, Mesero, Servicio
import json
from decimal import Decimal

reservas_bp = Blueprint('reservas', __name__, url_prefix='/api/reservas')


def generar_codigo_reserva():
    """Genera un código único para la reserva"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))


@reservas_bp.route('/', methods=['GET'])
@login_required
def listar_reservas():
    """Listar reservas del usuario actual"""
    try:
        reservas = Reserva.query.filter_by(usuario_id=current_user.id).order_by(Reserva.created_at.desc()).all()
        return jsonify([reserva.to_dict() for reserva in reservas])
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@reservas_bp.route('/crear', methods=['POST'])
@login_required
def crear_reserva():
    """Crear una nueva reserva"""
    try:
        # Aceptar JSON (AJAX) o datos de formulario (POST tradicional)
        data = request.get_json(silent=True) or {}
        is_form = False
        if not data:
            # Intentar leer desde formulario
            form = request.form
            if form:
                is_form = True
                # Normalizar campos desde el formulario de servicios
                data = {
                    'servicio_id': form.get('servicio_id'),
                    'tipo': form.get('tipo'),
                    'fecha': form.get('fecha'),
                    'hora': form.get('hora'),
                    'numero_personas': form.get('personas') or form.get('numero_personas'),
                    'mesa_id': form.get('mesa') or form.get('mesa_id'),
                }
                # Extraer detalles[...] del formulario
                detalles = {}
                for key in form.keys():
                    if key.startswith('detalles[') and key.endswith(']'):
                        inner = key[len('detalles['):-1]
                        detalles[inner] = form.get(key)
                if detalles:
                    data['detalles'] = detalles
            else:
                return jsonify({'error': 'Solicitud vacía'}), 400

        # Validar datos requeridos
        if not data.get('fecha') or not data.get('hora') or not data.get('numero_personas'):
            return jsonify({'error': 'Datos incompletos'}), 400

        # Parsear fecha y hora
        fecha = datetime.strptime(data['fecha'], '%Y-%m-%d').date()
        hora = datetime.strptime(data['hora'], '%H:%M').time()
        
        # Validar disponibilidad de mesa si se especifica (para servicios de billar, etc.)
        # Solo verificar conflictos con reservas de OTROS usuarios
        if data.get('mesa_id'):
            mesa_id_str = str(data.get('mesa_id'))
            # Verificar que no haya reservas activas de otros usuarios para esa mesa en la misma fecha
            reserva_existente = Reserva.query.filter(
                Reserva.mesa_asignada == mesa_id_str,
                Reserva.fecha == fecha,
                Reserva.estado.in_(['pendiente', 'confirmada']),
                Reserva.usuario_id != current_user.id  # Permitir al mismo usuario
            ).first()
            
            if reserva_existente:
                return jsonify({
                    'error': f'La mesa {mesa_id_str} ya está reservada por otro cliente para el {fecha.strftime("%d/%m/%Y")}'
                }), 400

        # Preparar notas_especiales con metadatos del servicio
        notas_payload = {}
        if data.get('tipo'):
            notas_payload['tipo_servicio'] = data.get('tipo')
        if data.get('servicio_id'):
            notas_payload['servicio_id'] = data.get('servicio_id')
        if data.get('detalles'):
            notas_payload['detalles'] = data.get('detalles')
        # Permitir campo 'notas' adicional
        if data.get('notas'):
            notas_payload['notas'] = data.get('notas')

        notas_especiales = json.dumps(notas_payload, ensure_ascii=False) if notas_payload else ''

    # Crear reserva
        nueva_reserva = Reserva(
            usuario_id=current_user.id,
            restaurante_id=1,  # ID del restaurante BoodFood
            fecha=fecha,
            hora=hora,
            numero_personas=int(data['numero_personas']),
            nombre_reserva=data.get('nombre_reserva', current_user.nombre),
            email_reserva=data.get('email_reserva', current_user.email),
            telefono_reserva=data.get('telefono_reserva', current_user.telefono),
            notas_especiales=notas_especiales,
            codigo_reserva=generar_codigo_reserva(),
            estado='pendiente',
            mesa_asignada=str(data.get('mesa_id')) if data.get('mesa_id') else None,
            zona_mesa=data.get('zona_mesa') or 'interior'
        )

        # Si viene una duración estimada (por ejemplo piscina), guardarla
        if data.get('duracion_estimada'):
            try:
                nueva_reserva.duracion_estimada = int(data['duracion_estimada'])
            except Exception:
                pass

        # Calcular total_reserva si hay servicio y reglas básicas
        try:
            servicio = None
            if data.get('servicio_id'):
                servicio = Servicio.query.get(int(data['servicio_id']))
            if servicio and servicio.precio is not None:
                precio = Decimal(str(servicio.precio))
                tipo = (data.get('tipo') or '').lower()
                if tipo == 'piscina':
                    # Total por hora (precio base es por hora del grupo)
                    horas = None
                    detalles = data.get('detalles') or {}
                    if isinstance(detalles, dict):
                        horas = detalles.get('duracion_horas')
                    if horas is None and nueva_reserva.duracion_estimada:
                        horas = nueva_reserva.duracion_estimada
                    horas = int(horas) if horas else 1
                    total = precio * Decimal(horas)
                    # Descuento por grupos grandes: >20 personas = 15% descuento
                    if nueva_reserva.numero_personas > 20:
                        total = total * Decimal('0.85')
                    nueva_reserva.total_reserva = total
                elif tipo == 'evento':
                    # Total por invitado (precio como tarifa por persona)
                    personas = int(data.get('numero_personas') or nueva_reserva.numero_personas or 1)
                    total = precio * Decimal(personas)
                    # Descuento por grupo grande: >50 invitados = 10% descuento
                    if personas > 50:
                        total = total * Decimal('0.90')
                    nueva_reserva.total_reserva = total
                elif tipo == 'billar':
                    # Tarifa fija (si no tenemos duración)
                    nueva_reserva.total_reserva = precio
        except Exception:
            # No bloquear si falla el cálculo
            pass

        db.session.add(nueva_reserva)
        db.session.commit()

        # Si es formulario tradicional, redirigir a página de reservas
        if is_form:
            return redirect(url_for('main.reservas'))

        return jsonify({
            'success': True,
            'message': 'Reserva creada exitosamente',
            'reserva': nueva_reserva.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@reservas_bp.route('/<int:reserva_id>', methods=['GET'])
@login_required
def obtener_reserva(reserva_id):
    """Obtener detalles de una reserva"""
    try:
        reserva = Reserva.query.get_or_404(reserva_id)
        
        # Verificar que la reserva pertenece al usuario o es admin
        if reserva.usuario_id != current_user.id and current_user.rol not in ['admin', 'administrador']:
            return jsonify({'error': 'No autorizado'}), 403
        
        return jsonify(reserva.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@reservas_bp.route('/<int:reserva_id>/cancelar', methods=['POST'])
@login_required
def cancelar_reserva(reserva_id):
    """Cancelar una reserva"""
    try:
        reserva = Reserva.query.get_or_404(reserva_id)
        
        # Verificar que la reserva pertenece al usuario o es admin
        if reserva.usuario_id != current_user.id and current_user.rol not in ['admin', 'administrador']:
            return jsonify({'error': 'No autorizado'}), 403
        
        reserva.estado = 'cancelada'
        reserva.fecha_cancelacion = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Reserva cancelada exitosamente'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@reservas_bp.route('/disponibilidad', methods=['GET'])
def verificar_disponibilidad():
    """Verificar disponibilidad de mesas en una fecha"""
    try:
        fecha_str = request.args.get('fecha')
        
        if not fecha_str:
            return jsonify({'error': 'Fecha requerida'}), 400
        
        fecha = datetime.strptime(fecha_str, '%Y-%m-%d').date()
        
        # Obtener reservas para esa fecha
        reservas_fecha = Reserva.query.filter(
            Reserva.fecha == fecha,
            Reserva.estado.in_(['pendiente', 'confirmada'])
        ).all()
        
        mesas_reservadas = [r.mesa_asignada for r in reservas_fecha if r.mesa_asignada]
        
        # Obtener mesas disponibles
        mesas_disponibles = Mesa.query.filter(
            Mesa.disponible == True
        ).all()
        
        # Filtrar las que no están reservadas
        mesas_libres = [mesa for mesa in mesas_disponibles if str(mesa.numero) not in mesas_reservadas]
        
        return jsonify({
            'disponibles': [mesa.to_dict() for mesa in mesas_libres],
            'reservadas': mesas_reservadas
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
