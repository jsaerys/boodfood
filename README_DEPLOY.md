# Guía de Despliegue en Coolify

Este proyecto está configurado para desplegarse fácilmente en Coolify usando Docker.

## Requisitos Previos

- Cuenta en Coolify
- Repositorio Git con el código del proyecto

## Pasos para Desplegar

### 1. Preparar Variables de Entorno

Crea un archivo `.env` en Coolify con las siguientes variables:

```env
SECRET_KEY=tu-clave-secreta-muy-segura-aqui
MYSQL_ROOT_PASSWORD=password_root_seguro
MYSQL_DATABASE=f58_brandon
MYSQL_USER=brandon
MYSQL_PASSWORD=brandonc
DATABASE_URL=mysql+pymysql://brandon:brandonc@db:3306/f58_brandon
MAIL_USERNAME=tu_email@ejemplo.com
MAIL_PASSWORD=tu_password
MAIL_DEFAULT_SENDER=noreply@boodfood.com
```

### 2. Configurar en Coolify

1. **Crear nuevo proyecto** en Coolify
2. **Seleccionar "Docker Compose"** como tipo de despliegue
3. **Conectar tu repositorio Git**
4. **Configurar las variables de entorno** desde el panel de Coolify
5. **Iniciar el despliegue**

### 3. Verificar el Despliegue

Una vez desplegado, la aplicación estará disponible en:
- Puerto: 5000
- URL: La que te proporcione Coolify

### 4. Inicializar la Base de Datos

La primera vez que se ejecute, las tablas se crearán automáticamente gracias a `db.create_all()` en `app.py`.

## Estructura de Servicios

El proyecto incluye dos servicios:

1. **web**: Aplicación Flask con SocketIO
   - Puerto: 5000
   - Comando: `python app.py`
   - Depende de: db

2. **db**: Base de datos MySQL 8.0
   - Puerto interno: 3306
   - Volumen persistente: `db_data`

## Notas Importantes

- La aplicación usa **Flask-SocketIO** con **eventlet** para WebSockets
- La base de datos MySQL se ejecuta en un contenedor separado
- Los datos de la base de datos persisten en un volumen Docker
- El puerto 5000 debe estar expuesto públicamente

## Solución de Problemas

### Error de conexión a la base de datos
- Verifica que las variables de entorno estén correctamente configuradas
- Asegúrate de que el servicio `db` esté ejecutándose antes que `web`

### WebSockets no funcionan
- Verifica que el puerto 5000 esté correctamente expuesto
- Asegúrate de que Coolify permita conexiones WebSocket

### Archivos estáticos no se cargan
- Verifica que la carpeta `static` esté incluida en el contenedor
- Revisa los permisos de las carpetas de uploads

## Contacto

Para más información sobre el proyecto, consulta el archivo README.md principal.
