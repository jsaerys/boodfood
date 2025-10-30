// static/js/admin/notificaciones.js

let todasNotificaciones = [];

// Cargar notificaciones
async function cargarNotificaciones() {
  try {
    // Simular carga de notificaciones
    // En producción, esto vendría de un API endpoint
    todasNotificaciones = [
      {
        id: 1,
        tipo: 'pedido',
        mensaje: 'Nuevo pedido #1234',
        tiempo: new Date(),
        leido: false,
        icono: '🍽️'
      },
      {
        id: 2,
        tipo: 'reserva',
        mensaje: 'Nueva reserva para mañana',
        tiempo: new Date(Date.now() - 3600000),
        leido: false,
        icono: '📅'
      },
      {
        id: 3,
        tipo: 'inventario',
        mensaje: 'Stock bajo de Arroz: 2 kg',
        tiempo: new Date(Date.now() - 7200000),
        leido: true,
        icono: '⚠️'
      },
      {
        id: 4,
        tipo: 'sistema',
        mensaje: 'Sistema actualizado correctamente',
        tiempo: new Date(Date.now() - 86400000),
        leido: true,
        icono: '💻'
      }
    ];
    
    renderizarNotificaciones();
    
  } catch (err) {
    console.error('Error:', err);
    document.getElementById('notificaciones-list').innerHTML = 
      `<p class="error" style="color:red">Error al cargar notificaciones: ${err.message}</p>`;
  }
}

function renderizarNotificaciones() {
  const filtros = {
    nuevos_pedidos: document.getElementById('filter-notif-nuevos').checked,
    reservas: document.getElementById('filter-notif-reservas').checked,
    inventario: document.getElementById('filter-notif-inventario').checked,
    sistema: document.getElementById('filter-notif-sistema').checked
  };
  
  const notificacionesFiltradas = todasNotificaciones.filter(n => {
    if (n.tipo === 'pedido' && !filtros.nuevos_pedidos) return false;
    if (n.tipo === 'reserva' && !filtros.reservas) return false;
    if (n.tipo === 'inventario' && !filtros.inventario) return false;
    if (n.tipo === 'sistema' && !filtros.sistema) return false;
    return true;
  });
  
  if (notificacionesFiltradas.length === 0) {
    document.getElementById('notificaciones-list').innerHTML = 
      '<p style="text-align: center; padding: 20px; color: #999;">No hay notificaciones</p>';
    return;
  }
  
  const html = notificacionesFiltradas.map(n => `
    <div class="notification-item ${n.leido ? '' : 'unread'}" data-id="${n.id}">
      <div class="notification-icon">${n.icono}</div>
      <div class="notification-content">
        <div class="notification-message">${n.mensaje}</div>
        <div class="notification-time">${formatDateTime(n.tiempo)}</div>
      </div>
      <div class="notification-actions">
        ${!n.leido ? `<button class="ghost small" onclick="window.marcarLeida(${n.id})">✓ Marcar leída</button>` : ''}
        <button class="ghost small" onclick="window.eliminarNotificacion(${n.id})">🗑️</button>
      </div>
    </div>
  `).join('');
  
  document.getElementById('notificaciones-list').innerHTML = html;
}

// Funciones globales
window.marcarLeida = (id) => {
  const notif = todasNotificaciones.find(n => n.id === id);
  if (notif) {
    notif.leido = true;
    renderizarNotificaciones();
    showToast('✅ Notificación marcada como leída', 'success');
  }
};

window.marcarTodasLeidas = () => {
  todasNotificaciones.forEach(n => n.leido = true);
  renderizarNotificaciones();
  showToast('✅ Todas las notificaciones marcadas como leídas', 'success');
};

window.eliminarNotificacion = (id) => {
  todasNotificaciones = todasNotificaciones.filter(n => n.id !== id);
  renderizarNotificaciones();
  showToast('🗑️ Notificación eliminada', 'info');
};

window.limpiarNotificaciones = () => {
  if (!confirm('¿Eliminar todas las notificaciones leídas?')) return;
  todasNotificaciones = todasNotificaciones.filter(n => !n.leido);
  renderizarNotificaciones();
  showToast('🗑️ Notificaciones limpiadas', 'info');
};

window.filtrarNotificaciones = () => {
  renderizarNotificaciones();
};

function showToast(message, type = 'info') {
  if (typeof Toastify !== 'undefined') {
    Toastify({
      text: message,
      duration: 3000,
      gravity: "top",
      position: "right",
      backgroundColor: type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3',
    }).showToast();
  } else {
    alert(message);
  }
}

// Inicialización del módulo
window.notificacionesModuleLoaded = true;
cargarNotificaciones();
