"""
Aplicación principal BoodFood
Sistema de gestión para restaurante con reservas, pedidos y múltiples paneles
"""
import os

# Configuración para subir imágenes
STATIC_FOLDER = 'static'
UPLOADS_FOLDER = os.path.join(STATIC_FOLDER, 'uploads')
MENU_UPLOADS = os.path.join(UPLOADS_FOLDER, 'menu')  # Para imágenes del menú
USER_UPLOADS = os.path.join(UPLOADS_FOLDER, 'users')  # Para fotos de perfil (si se necesitan)
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max

# Lista de carpetas que deben existir
REQUIRED_FOLDERS = [
    STATIC_FOLDER,
    UPLOADS_FOLDER,
    MENU_UPLOADS,
    USER_UPLOADS,
]


def allowed_file(filename):


    """Verificar si el archivo tiene una extensión permitida"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

from flask import Flask, render_template
from flask_login import LoginManager
from flask_socketio import SocketIO
from config import config
from models import db, Usuario
from werkzeug.utils import secure_filename
from socket_events import socketio  # Importar la instancia de SocketIO
from sqlalchemy.exc import OperationalError, InterfaceError

# Importar blueprints
from routes.auth import auth_bp
from routes.main import main_bp
from routes.reservas import reservas_bp
from routes.pedidos import pedidos_bp
from routes.cocina import cocina_bp
from routes.caja import caja_bp
from routes.admin import admin_bp
from routes.api_routes import api_bp
from routes.cuenta import cuenta_bp

from routes.admin_api import admin_api_bp

def create_app(config_name='default'):
    """Factory para crear la aplicación Flask"""
    app = Flask(__name__)
    # Configuración para subir imágenes (mover aquí evita usar `app` antes de definirla)
    app.config['UPLOAD_FOLDER'] = os.path.join(app.root_path, MENU_UPLOADS)  # Por defecto usa la carpeta del menú
    app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH
    
    # Crear todas las carpetas necesarias
    for folder in REQUIRED_FOLDERS:
        os.makedirs(os.path.join(app.root_path, folder), exist_ok=True)

    # Cargar configuración
    app.config.from_object(config[config_name])
    
    # Inicializar extensiones
    db.init_app(app)
    # Inicializar SocketIO con la app (usa init_app para instancias globales)
    try:
        socketio.init_app(app, cors_allowed_origins='*')
    except Exception:
        # Fallback: si ya estaba inicializado, ignorar
        pass
    
    # Configurar Flask-Login
    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'
    login_manager.login_message = 'Por favor inicia sesión para acceder a esta página.'
    login_manager.login_message_category = 'info'
    
    @login_manager.user_loader
    def load_user(user_id):
        """Carga el usuario para Flask-Login con manejo de desconexión de MySQL.
        Intenta una vez, y si hay error de conexión, recicla el engine y reintenta.
        """
        uid = int(user_id)
        try:
            # Preferir Session.get() (SQLAlchemy 2.x)
            return db.session.get(Usuario, uid)
        except (OperationalError, InterfaceError):
            # Conexión perdida, intentar recuperar
            try:
                db.session.rollback()
            except Exception:
                pass
            try:
                db.engine.dispose()  # Fuerza reciclar conexiones del pool
            except Exception:
                pass
            try:
                return db.session.get(Usuario, uid)
            except Exception:
                return None
    
    # Registrar blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)
    app.register_blueprint(reservas_bp)
    app.register_blueprint(pedidos_bp)
    app.register_blueprint(cocina_bp)
    app.register_blueprint(caja_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(api_bp)
    app.register_blueprint(cuenta_bp)
    app.register_blueprint(admin_api_bp)
    
    # Manejador de errores
    @app.errorhandler(404)
    def not_found(error):
        return render_template('errors/404.html'), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return render_template('errors/500.html'), 500
    
    # Crear tablas si no existen
    with app.app_context():
        db.create_all()
    
    return app


if __name__ == '__main__':
    app = create_app('development')
    # Usar socketio.run en lugar de app.run para habilitar WebSocket
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
