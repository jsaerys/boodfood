/**
 * BoodFood - JavaScript Principal
 */

// Auto-cerrar mensajes flash después de 5 segundos
document.addEventListener('DOMContentLoaded', function() {
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            alert.style.opacity = '0';
            setTimeout(() => alert.remove(), 300);
        }, 5000);
    });
    
    // Actualizar contador del carrito al cargar la página
    if (window.BoodFood) {
        const c = obtenerCarrito();
        if (c) {
            c.actualizar();
            console.log('Carrito actualizado en DOMContentLoaded');
        }
    }
});

// Función para hacer peticiones fetch con manejo de errores
async function fetchAPI(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error en la petición:', error);
        throw error;
    }
}

// Función para mostrar notificaciones
function mostrarNotificacion(mensaje, tipo = 'info') {
    const flashContainer = document.querySelector('.flash-messages') || crearFlashContainer();
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${tipo}`;
    alert.innerHTML = `
        ${mensaje}
        <button class="close-alert" onclick="this.parentElement.remove()">&times;</button>
    `;
    
    flashContainer.appendChild(alert);
    
    setTimeout(() => {
        alert.style.opacity = '0';
        setTimeout(() => alert.remove(), 300);
    }, 5000);
}

function crearFlashContainer() {
    const container = document.createElement('div');
    container.className = 'flash-messages';
    document.body.appendChild(container);
    return container;
}

// Formatear precio
function formatearPrecio(precio) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
    }).format(precio);
}

// Formatear fecha
function formatearFecha(fecha) {
    return new Date(fecha).toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Validar formularios
function validarFormulario(formId) {
    const form = document.getElementById(formId);
    if (!form) return false;
    
    const inputs = form.querySelectorAll('[required]');
    let valido = true;
    
    inputs.forEach(input => {
        if (!input.value.trim()) {
            input.classList.add('error');
            valido = false;
        } else {
            input.classList.remove('error');
        }
    });
    
    return valido;
}

// Verificar autenticación
async function verificarAutenticacion() {
    try {
        const data = await fetchAPI('/api/check-auth');
        return data.authenticated;
    } catch (error) {
        return false;
    }
}

// Redirigir a login si no está autenticado
async function requiereAutenticacion(callback) {
    const autenticado = await verificarAutenticacion();
    
    if (!autenticado) {
        mostrarNotificacion('Debes iniciar sesión para continuar', 'info');
        setTimeout(() => {
            window.location.href = '/login';
        }, 1500);
        return false;
    }
    
    if (callback) callback();
    return true;
}

// Carrito de compras (para domicilios)
class Carrito {
    constructor() {
        this.items = JSON.parse(localStorage.getItem('carrito_domicilios')) || [];
    }
    
    agregar(item) {
        const existente = this.items.find(i => i.id === item.id);
        
        if (existente) {
            existente.cantidad += item.cantidad;
        } else {
            this.items.push(item);
        }
        
        this.guardar();
        this.actualizar();
    }
    
    remover(itemId) {
        this.items = this.items.filter(i => i.id !== itemId);
        this.guardar();
        this.actualizar();
    }
    
    vaciar() {
        this.items = [];
        this.guardar();
        this.actualizar();
    }
    
    obtenerTotal() {
        return this.items.reduce((total, item) => {
            return total + (item.precio * item.cantidad);
        }, 0);
    }
    
    guardar() {
        localStorage.setItem('carrito_domicilios', JSON.stringify(this.items));
    }
    
    actualizar() {
        // Actualizar contador en la UI si existe
        const contador = document.getElementById('carrito-contador');
        if (contador) {
            contador.textContent = this.items.length;
        }
    }

    obtenerItems() {
        return this.items;
    }

    incrementar(itemId) {
        const item = this.items.find(i => i.id === itemId);
        if (item) {
            item.cantidad += 1;
            this.guardar();
            this.actualizar();
        }
    }

    decrementar(itemId) {
        const item = this.items.find(i => i.id === itemId);
        if (item) {
            item.cantidad -= 1;
            if (item.cantidad <= 0) {
                this.remover(itemId);
            } else {
                this.guardar();
                this.actualizar();
            }
        }
    }
}

// Instancia global del carrito - inicialización lazy
let carrito = null;

function obtenerCarrito() {
    if (!carrito) {
        carrito = new Carrito();
        console.log('Carrito inicializado:', carrito);
    }
    return carrito;
}

// Log para depuración

// Función para agregar al carrito desde el menú (SOLO PARA DOMICILIOS)
// El menú tiene su propia función agregarAlCarrito local
function agregarAlCarritoDomicilios(itemId, nombre, precio) {
    obtenerCarrito().agregar({
        id: itemId,
        nombre: nombre,
        precio: precio,
        cantidad: 1
    });
    
    mostrarNotificacion(`${nombre} agregado al carrito`, 'success');
}

// Actualización en tiempo real (WebSocket simulado con polling)
class ActualizadorTiempoReal {
    constructor(url, callback, intervalo = 5000) {
        this.url = url;
        this.callback = callback;
        this.intervalo = intervalo;
        this.intervalId = null;
    }
    
    iniciar() {
        this.actualizar();
        this.intervalId = setInterval(() => this.actualizar(), this.intervalo);
    }
    
    detener() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
    
    async actualizar() {
        try {
            const data = await fetchAPI(this.url);
            this.callback(data);
        } catch (error) {
            console.error('Error al actualizar:', error);
        }
    }
}

// Sonido de notificación
function reproducirSonidoNotificacion() {
    // Crear un beep simple usando Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}

// Exportar funciones globales - Extender BoodFood si ya existe
if (!window.BoodFood) {
    window.BoodFood = {};
}

// Añadir propiedades al objeto BoodFood existente
Object.assign(window.BoodFood, {
    fetchAPI,
    mostrarNotificacion,
    formatearPrecio,
    formatearFecha,
    validarFormulario,
    verificarAutenticacion,
    requiereAutenticacion,
    obtenerCarrito,  // Exponer función para obtener carrito
    get carrito() { return obtenerCarrito(); },  // Getter para acceso directo
    agregarAlCarritoDomicilios,  // Renombrada para domicilios
    ActualizadorTiempoReal,
    reproducirSonidoNotificacion
});
