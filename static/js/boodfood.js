/**
 * Clase principal para funcionalidades compartidas de BoodFood
 */
class BoodFood {
    static NOTIFICATION_SOUND = '/static/sounds/notification.mp3';
    static notificationSound = null;

    static async verificarAutenticacion() {
        try {
            const response = await fetch('/api/auth/check');
            const data = await response.json();
            return data.autenticado === true;
        } catch (error) {
            console.error('Error al verificar autenticación:', error);
            return false;
        }
    }

    static mostrarNotificacion(mensaje, tipo = 'info') {
        // Si existe Toastify, usarlo
        if (typeof Toastify === 'function') {
            Toastify({
                text: mensaje,
                duration: 3000,
                gravity: "top",
                position: "right",
                backgroundColor: this._getNotificationColor(tipo),
                stopOnFocus: true
            }).showToast();
        } else {
            // Fallback a notificaciones nativas
            if ("Notification" in window && Notification.permission === "granted") {
                new Notification("BoodFood", {
                    body: mensaje,
                    icon: "/static/images/logo.png"
                });
            } else {
                // Fallback final a alert
                alert(mensaje);
            }
        }
    }

    static _getNotificationColor(tipo) {
        switch (tipo) {
            case 'success':
                return 'linear-gradient(to right, #00b09b, #96c93d)';
            case 'error':
                return 'linear-gradient(to right, #ff5f6d, #ffc371)';
            case 'warning':
                return 'linear-gradient(to right, #f7971e, #ffd200)';
            default:
                return 'linear-gradient(to right, #2193b0, #6dd5ed)';
        }
    }

    static reproducirSonidoNotificacion() {
        if (!this.notificationSound) {
            this.notificationSound = new Audio(this.NOTIFICATION_SOUND);
        }
        
        // Reiniciar el sonido si ya estaba reproduciéndose
        this.notificationSound.pause();
        this.notificationSound.currentTime = 0;
        
        // Reproducir con manejo de errores
        this.notificationSound.play().catch(error => {
            console.warn('No se pudo reproducir el sonido de notificación:', error);
        });
    }

    static async actualizarInterfaz(elementoId, url, opciones = {}) {
        try {
            const elemento = document.getElementById(elementoId);
            if (!elemento) {
                throw new Error(`Elemento ${elementoId} no encontrado`);
            }

            const response = await fetch(url, {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                },
                ...opciones
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.text();
            elemento.innerHTML = data;

            // Ejecutar scripts si existen
            const scripts = elemento.getElementsByTagName('script');
            for (let script of scripts) {
                eval(script.innerHTML);
            }

            return true;
        } catch (error) {
            console.error('Error al actualizar interfaz:', error);
            this.mostrarNotificacion(
                'Error al actualizar la interfaz. Por favor, recarga la página.',
                'error'
            );
            return false;
        }
    }

    static formatearFecha(fecha) {
        return new Date(fecha).toLocaleString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    static formatearPrecio(precio) {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(precio);
    }

    static async enviarFormulario(formulario, opciones = {}) {
        try {
            const formData = new FormData(formulario);
            
            const response = await fetch(formulario.action, {
                method: formulario.method,
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                },
                ...opciones
            });

            const data = await response.json();

            if (response.ok) {
                if (data.mensaje) {
                    this.mostrarNotificacion(data.mensaje, 'success');
                }
                return { exito: true, data };
            } else {
                throw new Error(data.error || 'Error al procesar la solicitud');
            }
        } catch (error) {
            console.error('Error al enviar formulario:', error);
            this.mostrarNotificacion(
                error.message || 'Error al procesar la solicitud',
                'error'
            );
            return { exito: false, error };
        }
    }
}

// Exponer globalmente
window.BoodFood = BoodFood;

// Solicitar permisos de notificación al cargar
document.addEventListener('DOMContentLoaded', () => {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
});