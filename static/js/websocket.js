/**
 * WebSocket Client para BoodFood
 */

class BoodFoodSocket {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.handlers = {
            'pedido_recibido': [],
            'estado_pedido_actualizado': [],
            'estado_mesa_actualizado': [],
            'nueva_notificacion': []
        };
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    connect(mesaId = null) {
        let url = new URL(window.location.origin);
        if (mesaId) {
            url.searchParams.append('mesa_id', mesaId);
        }

        this.socket = io(url.toString(), {
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: this.maxReconnectAttempts
        });

        this.socket.on('connect', () => {
            console.log('Conectado al servidor WebSocket');
            this.connected = true;
            this.reconnectAttempts = 0;
            BoodFood.mostrarNotificacion('Conexión establecida', 'success');
        });

        this.socket.on('disconnect', () => {
            console.log('Desconectado del servidor WebSocket');
            this.connected = false;
            BoodFood.mostrarNotificacion('Conexión perdida. Reconectando...', 'warning');
        });

        this.socket.on('connection_response', (data) => {
            if (data.status === 'connected') {
                console.log('Conexión confirmada por el servidor');
            }
        });

        // Eventos de pedidos
        this.socket.on('pedido_recibido', (data) => {
            this._triggerHandlers('pedido_recibido', data);
            BoodFood.reproducirSonidoNotificacion();
        });

        this.socket.on('estado_pedido_actualizado', (data) => {
            this._triggerHandlers('estado_pedido_actualizado', data);
        });

        // Eventos de mesas
        this.socket.on('estado_mesa_actualizado', (data) => {
            this._triggerHandlers('estado_mesa_actualizado', data);
        });

        // Notificaciones generales
        this.socket.on('nueva_notificacion', (data) => {
            this._triggerHandlers('nueva_notificacion', data);
            BoodFood.mostrarNotificacion(data.mensaje, data.tipo || 'info');
            if (data.sonido !== false) {
                BoodFood.reproducirSonidoNotificacion();
            }
        });
    }

    on(event, callback) {
        if (this.handlers[event]) {
            this.handlers[event].push(callback);
        }
    }

    emit(event, data) {
        if (this.connected && this.socket) {
            this.socket.emit(event, data);
        } else {
            console.warn('No hay conexión con el servidor WebSocket');
            BoodFood.mostrarNotificacion('Error de conexión', 'error');
        }
    }

    _triggerHandlers(event, data) {
        if (this.handlers[event]) {
            this.handlers[event].forEach(callback => callback(data));
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

// Crear instancia global
window.boodFoodSocket = new BoodFoodSocket();

// Conectar automáticamente si hay un usuario autenticado
document.addEventListener('DOMContentLoaded', () => {
    // Verificar si el usuario está autenticado
    BoodFood.verificarAutenticacion().then(autenticado => {
        if (autenticado) {
            // Obtener mesa_id si existe en la URL o en algún elemento de datos
            const mesaId = new URLSearchParams(window.location.search).get('mesa_id');
            window.boodFoodSocket.connect(mesaId);
        }
    });
});