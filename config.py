"""
Configuración de la aplicación BoodFood
"""
import os


class Config:
    """Configuración base"""
    
    # Clave secreta para sesiones
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'boodfood-secret-key-2025'
    
    # Configuración de la base de datos MySQL
    # Usar DATABASE_URL de variable de entorno o la remota por defecto
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or (
        'mysql+pymysql://brandon:brandonc@isladigital.xyz:3311/f58_brandon'
    )
    
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = False
    # Opciones del engine para conexiones estables a MySQL remoto
    # - pool_pre_ping: detecta conexiones caídas antes de usarlas
    # - pool_recycle: recicla conexiones inactivas para evitar timeouts del servidor
    # - pool_timeout: tiempo de espera al obtener conexión del pool
    # - pool_size / max_overflow: tamaño del pool para esta app
    # - connect_args: timeouts a nivel de PyMySQL
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 280,  # menor que el wait_timeout típico del servidor
        "pool_timeout": 10,
        "pool_size": 5,
        "max_overflow": 10,
        "connect_args": {
            "connect_timeout": 10,
            "read_timeout": 30,
            "write_timeout": 30,
            "charset": "utf8mb4",
        },
    }
    
    # Configuración de sesiones
    SESSION_COOKIE_SECURE = False  # Cambiar a True en producción con HTTPS
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    PERMANENT_SESSION_LIFETIME = 3600  # 1 hora
    
    # Configuración de uploads
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB máximo
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
    
    # Configuración de la aplicación
    DEBUG = True
    TESTING = False
    
    # Zona horaria
    TIMEZONE = 'America/Bogota'


class DevelopmentConfig(Config):
    """Configuración de desarrollo"""
    DEBUG = True
    SQLALCHEMY_ECHO = True


class ProductionConfig(Config):
    """Configuración de producción"""
    DEBUG = False
    SESSION_COOKIE_SECURE = True


# Configuración por defecto
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
