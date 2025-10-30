// static/js/admin/reservas.js
// Sistema completo de gestión de reservas

let reservasData = [];
let reservasFiltradas = [];

// ========================================
// CARGAR RESERVAS
// ========================================
async function cargarReservas() {
  try {
    mostrarCargando();
    const reservas = await API.get('/api/reservas');
    reservasData = reservas;
    reservasFiltradas = [...reservas];
    
    actualizarEstadisticas(reservas);
    renderizarTablaReservas(reservasFiltradas);
    
  } catch (err) {
    console.error('Error:', err);
    mostrarError('Error al cargar las reservas: ' + err.message);
  }
}

// ========================================
// ACTUALIZAR ESTADÍSTICAS
// ========================================
function actualizarEstadisticas(reservas) {
  const hoy = new Date().toDateString();
  const mesActual = new Date().getMonth();
  const añoActual = new Date().getFullYear();
  
  const pendientes = reservas.filter(r => r.estado === 'pendiente').length;
  const confirmadasHoy = reservas.filter(r => {
    const fechaReserva = new Date(r.fecha).toDateString();
    return r.estado === 'confirmada' && fechaReserva === hoy;
  }).length;
  const completadas = reservas.filter(r => r.estado === 'completada').length;
  const totalMes = reservas.filter(r => {
    const fecha = new Date(r.fecha);
    return fecha.getMonth() === mesActual && fecha.getFullYear() === añoActual;
  }).length;
  
  document.getElementById('reservas-pendientes-count').textContent = pendientes;
  document.getElementById('reservas-confirmadas-count').textContent = confirmadasHoy;
  document.getElementById('reservas-completadas-count').textContent = completadas;
  document.getElementById('reservas-total-count').textContent = totalMes;
}

// ========================================
// RENDERIZAR TABLA
// ========================================
function renderizarTablaReservas(reservas) {
  const container = document.getElementById('reservas-table-container');
  
  if (!reservas || reservas.length === 0) {
    container.innerHTML = `
      <div class="no-data-message">
        <div style="font-size: 4rem;">📅</div>
        <p>No se encontraron reservas</p>
        <button class="btn-action btn-create" onclick="window.abrirModalNuevaReserva()" style="margin-top: 20px;">
          ➕ Crear Primera Reserva
        </button>
      </div>
    `;
    return;
  }
  
  let html = `
    <table class="reservas-table">
      <thead>
        <tr>
          <th>Código</th>
          <th>Cliente</th>
          <th>Tipo</th>
          <th>Fecha</th>
          <th>Hora</th>
          <th>Personas</th>
          <th>Mesa/Zona</th>
          <th>Total</th>
          <th>Estado</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  reservas.forEach(r => {
    // Determinar tipo de reserva
    let tipoReserva = 'mesa';
    let iconoTipo = '🍽️';
    try {
      if (r.notas_especiales) {
        const notas = typeof r.notas_especiales === 'string' 
          ? JSON.parse(r.notas_especiales) 
          : r.notas_especiales;
        if (notas && notas.tipo_servicio) {
          tipoReserva = notas.tipo_servicio;
          iconoTipo = tipoReserva === 'piscina' ? '🏊' : 
                     tipoReserva === 'billar' ? '🎱' : 
                     tipoReserva === 'evento' ? '🎉' : '🍽️';
        }
      }
    } catch (e) {
      // Si falla el parse, es una reserva de mesa normal
    }
    
    const estadoIcono = 
      r.estado === 'confirmada' ? '✅' :
      r.estado === 'pendiente' ? '⏳' :
      r.estado === 'completada' ? '🎉' :
      r.estado === 'cancelada' ? '❌' :
      '👻';
    
    const total = r.total_reserva != null 
      ? Number(r.total_reserva).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })
      : '-';
    
    html += `
      <tr data-estado="${r.estado}" data-fecha="${r.fecha}" data-tipo="${tipoReserva}">
        <td><span class="codigo-reserva">${r.codigo_reserva || 'R-' + r.id}</span></td>
        <td>
          <div><strong>${r.nombre_reserva || 'Sin nombre'}</strong></div>
          ${r.telefono_reserva ? `<div style="font-size: 0.85rem; color: #666;">📞 ${r.telefono_reserva}</div>` : ''}
        </td>
        <td><span class="tipo-badge tipo-${tipoReserva}">${iconoTipo} ${tipoReserva.charAt(0).toUpperCase() + tipoReserva.slice(1)}</span></td>
        <td>${formatDate(r.fecha)}</td>
        <td><strong>${r.hora}</strong></td>
        <td>👥 ${r.numero_personas}</td>
        <td>${r.mesa_asignada || r.zona_mesa || 'Sin asignar'}</td>
        <td><strong>${total}</strong></td>
        <td>
          <span class="badge-estado badge-${r.estado}">
            ${estadoIcono} ${r.estado.replace('_', ' ')}
          </span>
        </td>
        <td>
          <div class="acciones-cell">
            <button class="btn-table btn-ver" onclick="window.verDetalleReserva(${r.id})" title="Ver detalles">
              👁️ Ver
            </button>
            <button class="btn-table btn-editar" onclick="window.editarReserva(${r.id})" title="Editar">
              ✏️
            </button>
            <button class="btn-table btn-mesa" onclick="window.asignarMesaReserva(${r.id})" title="Asignar mesa">
              🪑
            </button>
            ${r.estado !== 'cancelada' && r.estado !== 'completada' ? `
              <button class="btn-table btn-eliminar" onclick="window.cancelarReserva(${r.id})" title="Cancelar">
                ❌
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

// ========================================
// FILTRAR RESERVAS
// ========================================
window.filtrarReservas = function() {
  const buscar = document.getElementById('filter-buscar').value.toLowerCase();
  const estado = document.getElementById('filter-estado-reserva').value;
  const fechaDesde = document.getElementById('filter-fecha-desde').value;
  const fechaHasta = document.getElementById('filter-fecha-hasta').value;
  const tipo = document.getElementById('filter-tipo-servicio').value;
  
  reservasFiltradas = reservasData.filter(r => {
    // Filtro de búsqueda
    if (buscar) {
      const coincide = 
        (r.codigo_reserva && r.codigo_reserva.toLowerCase().includes(buscar)) ||
        (r.nombre_reserva && r.nombre_reserva.toLowerCase().includes(buscar)) ||
        (r.telefono_reserva && r.telefono_reserva.includes(buscar)) ||
        (r.email_reserva && r.email_reserva.toLowerCase().includes(buscar));
      if (!coincide) return false;
    }
    
    // Filtro de estado
    if (estado !== 'todas' && r.estado !== estado) return false;
    
    // Filtro de fecha desde
    if (fechaDesde && r.fecha < fechaDesde) return false;
    
    // Filtro de fecha hasta
    if (fechaHasta && r.fecha > fechaHasta) return false;
    
    // Filtro de tipo
    if (tipo !== 'todos') {
      let tipoReserva = 'mesa';
      try {
        if (r.notas_especiales) {
          const notas = typeof r.notas_especiales === 'string' 
            ? JSON.parse(r.notas_especiales) 
            : r.notas_especiales;
          if (notas && notas.tipo_servicio) {
            tipoReserva = notas.tipo_servicio;
          }
        }
      } catch (e) {}
      if (tipoReserva !== tipo) return false;
    }
    
    return true;
  });
  
  renderizarTablaReservas(reservasFiltradas);
};

window.limpiarFiltros = function() {
  document.getElementById('filter-buscar').value = '';
  document.getElementById('filter-estado-reserva').value = 'todas';
  document.getElementById('filter-fecha-desde').value = '';
  document.getElementById('filter-fecha-hasta').value = '';
  document.getElementById('filter-tipo-servicio').value = 'todos';
  filtrarReservas();
};

// ========================================
// VER DETALLE
// ========================================
window.verDetalleReserva = async function(reservaId) {
  try {
    const reserva = await API.get(`/api/reservas/${reservaId}`);
    
    // Parsear servicio
    let servicio = null;
    let tipoReserva = 'mesa';
    try {
      if (reserva.notas_especiales) {
        servicio = typeof reserva.notas_especiales === 'string'
          ? JSON.parse(reserva.notas_especiales)
          : reserva.notas_especiales;
        if (servicio && servicio.tipo_servicio) {
          tipoReserva = servicio.tipo_servicio;
        }
      }
    } catch (e) {}
    
    const iconoTipo = tipoReserva === 'piscina' ? '🏊' : 
                     tipoReserva === 'billar' ? '🎱' : 
                     tipoReserva === 'evento' ? '🎉' : '🍽️';
    
    // Construir bloque de servicio
    let servicioHTML = '';
    if (servicio && servicio.tipo_servicio) {
      const detalles = servicio.detalles || {};
      servicioHTML = `
        <div class="info-section">
          <h3>${iconoTipo} Información del Servicio</h3>
          <div class="info-row"><strong>Tipo:</strong> ${tipoReserva.charAt(0).toUpperCase() + tipoReserva.slice(1)}</div>
      `;
      
      if (tipoReserva === 'billar') {
        servicioHTML += `
          <div class="info-row"><strong>Mesa asignada:</strong> ${reserva.mesa_asignada || 'Por asignar'}</div>
          <div class="info-row"><strong>Duración estimada:</strong> ${reserva.duracion_estimada || detalles.duracion_horas || 'N/A'} horas</div>
        `;
      } else if (tipoReserva === 'evento') {
        servicioHTML += `
          <div class="info-row"><strong>Tipo de evento:</strong> ${detalles.tipo_evento || 'N/A'}</div>
          ${detalles.notas ? `<div class="info-row"><strong>Notas del evento:</strong> ${detalles.notas}</div>` : ''}
          <div class="info-row"><strong>Duración:</strong> ${reserva.duracion_estimada || 'N/A'} horas</div>
        `;
      } else if (tipoReserva === 'piscina') {
        servicioHTML += `
          <div class="info-row"><strong>Duración:</strong> ${detalles.duracion_horas || reserva.duracion_estimada || 'N/A'} horas</div>
          <div class="info-row"><strong>Área niños:</strong> ${(detalles.area_ninos === 'si') ? 'Sí ✅' : 'No'}</div>
        `;
      }
      
      servicioHTML += '</div>';
    }
    
    const total = reserva.total_reserva != null 
      ? Number(reserva.total_reserva).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })
      : 'No especificado';
    
    const modalHTML = `
      <div id="modal-detalle-reserva" class="modal-overlay" onclick="cerrarSiClickFuera(event, 'modal-detalle-reserva')">
        <div class="modal-content modal-detalle" onclick="event.stopPropagation()">
          <span class="close-modal" onclick="cerrarModal('modal-detalle-reserva')">&times;</span>
          <h2>📋 Detalle de Reserva</h2>
          <div class="codigo-grande">${reserva.codigo_reserva || 'R-' + reserva.id}</div>
          
          <div class="reserva-detalle-grid">
            <div class="info-section">
              <h3>👤 Información del Cliente</h3>
              <div class="info-row"><strong>Nombre:</strong> ${reserva.nombre_reserva || 'N/A'}</div>
              <div class="info-row"><strong>Email:</strong> ${reserva.email_reserva || 'No proporcionado'}</div>
              <div class="info-row"><strong>Teléfono:</strong> ${reserva.telefono_reserva || 'No proporcionado'}</div>
            </div>
            
            <div class="info-section">
              <h3>📅 Información de la Reserva</h3>
              <div class="info-row"><strong>Fecha:</strong> ${formatDate(reserva.fecha)}</div>
              <div class="info-row"><strong>Hora:</strong> ${reserva.hora}</div>
              <div class="info-row"><strong>Personas:</strong> 👥 ${reserva.numero_personas}</div>
              <div class="info-row"><strong>Mesa/Zona:</strong> ${reserva.mesa_asignada || reserva.zona_mesa || 'Sin asignar'}</div>
              <div class="info-row"><strong>Estado:</strong> <span class="badge-estado badge-${reserva.estado}">${reserva.estado}</span></div>
            </div>
            
            ${servicioHTML}
            
            <div class="info-section">
              <h3>💰 Información Financiera</h3>
              <div class="info-row"><strong>Total de la reserva:</strong> <span style="color: #4caf50; font-weight: bold; font-size: 1.2rem;">${total}</span></div>
              <div class="info-row"><strong>Método de pago:</strong> ${reserva.metodo_pago || 'No especificado'}</div>
              ${reserva.deposito_pagado ? `<div class="info-row"><strong>Depósito pagado:</strong> ${Number(reserva.deposito_pagado).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</div>` : ''}
            </div>
            
            ${reserva.notas_especiales && typeof reserva.notas_especiales === 'string' && !servicio ? `
              <div class="info-section full-width">
                <h3>📝 Notas Especiales</h3>
                <p>${reserva.notas_especiales}</p>
              </div>
            ` : ''}
          </div>
          
          <div class="modal-actions">
            <button class="btn-modal btn-secondary" onclick="cerrarModal('modal-detalle-reserva')">Cerrar</button>
            <button class="btn-modal btn-primary" onclick="cerrarModal('modal-detalle-reserva'); window.editarReserva(${reservaId})">✏️ Editar</button>
            <button class="btn-modal btn-success" onclick="cerrarModal('modal-detalle-reserva'); window.asignarMesaReserva(${reservaId})">🪑 Asignar Mesa</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
  } catch (err) {
    showToast('❌ Error al cargar detalles: ' + err.message, 'error');
  }
};

// ========================================
// EDITAR RESERVA
// ========================================
window.editarReserva = async function(reservaId) {
  try {
    const reserva = await API.get(`/api/reservas/${reservaId}`);
    
    const modalHTML = `
      <div id="modal-editar-reserva" class="modal-overlay" onclick="cerrarSiClickFuera(event, 'modal-editar-reserva')">
        <div class="modal-content" onclick="event.stopPropagation()">
          <span class="close-modal" onclick="cerrarModal('modal-editar-reserva')">&times;</span>
          <h2>✏️ Editar Reserva</h2>
          
          <form id="form-editar-reserva" class="reserva-form">
            <div class="form-grid">
              <div class="form-group">
                <label>👤 Nombre del Cliente *</label>
                <input type="text" id="edit-nombre" value="${reserva.nombre_reserva || ''}" required>
              </div>
              
              <div class="form-group">
                <label>📧 Email</label>
                <input type="email" id="edit-email" value="${reserva.email_reserva || ''}">
              </div>
              
              <div class="form-group">
                <label>📱 Teléfono</label>
                <input type="tel" id="edit-telefono" value="${reserva.telefono_reserva || ''}">
              </div>
              
              <div class="form-group">
                <label>📅 Fecha *</label>
                <input type="date" id="edit-fecha" value="${reserva.fecha}" required>
              </div>
              
              <div class="form-group">
                <label>🕐 Hora *</label>
                <input type="time" id="edit-hora" value="${reserva.hora}" required>
              </div>
              
              <div class="form-group">
                <label>👥 Número de Personas *</label>
                <input type="number" id="edit-personas" value="${reserva.numero_personas}" min="1" required>
              </div>
              
              <div class="form-group">
                <label>🪑 Mesa/Zona</label>
                <input type="text" id="edit-mesa" value="${reserva.mesa_asignada || ''}">
              </div>
              
              <div class="form-group">
                <label>📋 Estado</label>
                <select id="edit-estado">
                  <option value="pendiente" ${reserva.estado === 'pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
                  <option value="confirmada" ${reserva.estado === 'confirmada' ? 'selected' : ''}>✅ Confirmada</option>
                  <option value="completada" ${reserva.estado === 'completada' ? 'selected' : ''}>🎉 Completada</option>
                  <option value="cancelada" ${reserva.estado === 'cancelada' ? 'selected' : ''}>❌ Cancelada</option>
                  <option value="no_asistio" ${reserva.estado === 'no_asistio' ? 'selected' : ''}>👻 No Asistió</option>
                </select>
              </div>
            </div>
            
            <div class="form-group full-width">
              <label>📝 Notas Especiales</label>
              <textarea id="edit-notas" rows="3">${typeof reserva.notas_especiales === 'string' ? reserva.notas_especiales : ''}</textarea>
            </div>
            
            <div class="modal-actions">
              <button type="button" class="btn-modal btn-secondary" onclick="cerrarModal('modal-editar-reserva')">Cancelar</button>
              <button type="submit" class="btn-modal btn-success">💾 Guardar Cambios</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    document.getElementById('form-editar-reserva').onsubmit = async (e) => {
      e.preventDefault();
      try {
        const data = {
          nombre_reserva: document.getElementById('edit-nombre').value,
          email_reserva: document.getElementById('edit-email').value,
          telefono_reserva: document.getElementById('edit-telefono').value,
          fecha: document.getElementById('edit-fecha').value,
          hora: document.getElementById('edit-hora').value,
          numero_personas: parseInt(document.getElementById('edit-personas').value),
          mesa_asignada: document.getElementById('edit-mesa').value,
          estado: document.getElementById('edit-estado').value,
          notas_especiales: document.getElementById('edit-notas').value
        };
        
        await API.put(`/api/reserva/${reservaId}/actualizar`, data);
        showToast('✅ Reserva actualizada correctamente', 'success');
        cerrarModal('modal-editar-reserva');
        cargarReservas();
      } catch (err) {
        showToast('❌ Error: ' + err.message, 'error');
      }
    };
    
  } catch (err) {
    showToast('❌ Error al cargar reserva: ' + err.message, 'error');
  }
};

// ========================================
// ASIGNAR MESA
// ========================================
window.asignarMesaReserva = async function(reservaId) {
  try {
    const mesas = await API.get('/api/mesas');
    const mesasDisponibles = mesas.filter(m => m.disponible);
    
    const modalHTML = `
      <div id="modal-asignar-mesa" class="modal-overlay" onclick="cerrarSiClickFuera(event, 'modal-asignar-mesa')">
        <div class="modal-content" onclick="event.stopPropagation()">
          <span class="close-modal" onclick="cerrarModal('modal-asignar-mesa')">&times;</span>
          <h2>🪑 Asignar Mesa</h2>
          
          <form id="form-asignar-mesa" class="reserva-form">
            <div class="form-group">
              <label>Seleccionar Mesa</label>
              <select id="mesa-asignada" required>
                <option value="">-- Seleccione una mesa --</option>
                ${mesasDisponibles.map(m => `
                  <option value="${m.numero}">
                    Mesa ${m.numero} - ${m.capacidad} personas - ${m.ubicacion} (${m.tipo})
                  </option>
                `).join('')}
              </select>
            </div>
            
            <div class="form-group">
              <label>Zona</label>
              <select id="zona-mesa">
                <option value="interior">Interior</option>
                <option value="terraza">Terraza</option>
                <option value="vip">VIP</option>
                <option value="privada">Privada</option>
              </select>
            </div>
            
            <div class="modal-actions">
              <button type="button" class="btn-modal btn-secondary" onclick="cerrarModal('modal-asignar-mesa')">Cancelar</button>
              <button type="submit" class="btn-modal btn-success">✅ Asignar</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    document.getElementById('form-asignar-mesa').onsubmit = async (e) => {
      e.preventDefault();
      try {
        const data = {
          mesa_asignada: document.getElementById('mesa-asignada').value,
          zona_mesa: document.getElementById('zona-mesa').value
        };
        
        await API.put(`/api/reserva/${reservaId}/actualizar`, data);
        showToast('✅ Mesa asignada correctamente', 'success');
        cerrarModal('modal-asignar-mesa');
        cargarReservas();
      } catch (err) {
        showToast('❌ Error: ' + err.message, 'error');
      }
    };
    
  } catch (err) {
    showToast('❌ Error al cargar mesas: ' + err.message, 'error');
  }
};

// ========================================
// CANCELAR RESERVA
// ========================================
window.cancelarReserva = async function(reservaId) {
  if (!confirm('¿Estás seguro de que deseas cancelar esta reserva?')) return;
  
  try {
    await API.put(`/api/reservas/${reservaId}/estado`, { estado: 'cancelada' });
    showToast('✅ Reserva cancelada correctamente', 'success');
    cargarReservas();
  } catch (err) {
    showToast('❌ Error: ' + err.message, 'error');
  }
};

// ========================================
// CREAR NUEVA RESERVA
// ========================================
window.abrirModalNuevaReserva = function() {
  const hoy = new Date().toISOString().split('T')[0];
  const horaActual = new Date().toTimeString().slice(0,5);
  
  const modalHTML = `
    <div id="modal-nueva-reserva" class="modal-overlay" onclick="cerrarSiClickFuera(event, 'modal-nueva-reserva')">
      <div class="modal-content modal-large" onclick="event.stopPropagation()">
        <span class="close-modal" onclick="cerrarModal('modal-nueva-reserva')">&times;</span>
        <h2>➕ Nueva Reserva</h2>
        
        <form id="form-nueva-reserva" class="reserva-form">
          <div class="form-grid">
            <div class="form-group">
              <label>👤 Nombre del Cliente *</label>
              <input type="text" id="new-nombre" required placeholder="Juan Pérez">
            </div>
            
            <div class="form-group">
              <label>📧 Email</label>
              <input type="email" id="new-email" placeholder="cliente@ejemplo.com">
            </div>
            
            <div class="form-group">
              <label>📱 Teléfono *</label>
              <input type="tel" id="new-telefono" required placeholder="3001234567">
            </div>
            
            <div class="form-group">
              <label>📅 Fecha *</label>
              <input type="date" id="new-fecha" min="${hoy}" required>
            </div>
            
            <div class="form-group">
              <label>🕐 Hora *</label>
              <input type="time" id="new-hora" required>
            </div>
            
            <div class="form-group">
              <label>👥 Número de Personas *</label>
              <input type="number" id="new-personas" min="1" value="2" required>
            </div>
            
            <div class="form-group">
              <label>🏷️ Tipo de Reserva</label>
              <select id="new-tipo" onchange="actualizarCamposTipo()">
                <option value="mesa">🍽️ Mesa Regular</option>
                <option value="piscina">🏊 Piscina</option>
                <option value="billar">🎱 Billar</option>
                <option value="evento">🎉 Evento</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>📋 Estado</label>
              <select id="new-estado">
                <option value="pendiente">⏳ Pendiente</option>
                <option value="confirmada" selected>✅ Confirmada</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>🪑 Mesa/Zona</label>
              <input type="text" id="new-mesa" placeholder="Mesa 5 o Terraza">
            </div>
            
            <div class="form-group">
              <label>💰 Total Estimado</label>
              <input type="number" id="new-total" min="0" step="1000" placeholder="50000">
            </div>
            
            <div class="form-group">
              <label>💳 Método de Pago</label>
              <select id="new-metodo-pago">
                <option value="">No especificado</option>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
                <option value="paypal">PayPal</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>🏠 Zona de Mesa</label>
              <select id="new-zona">
                <option value="interior">Interior</option>
                <option value="terraza">Terraza</option>
                <option value="vip">VIP</option>
                <option value="privada">Privada</option>
              </select>
            </div>
          </div>
          
          <div class="form-group full-width">
            <label>📝 Notas Especiales</label>
            <textarea id="new-notas" rows="3" placeholder="Alergias, preferencias, solicitudes especiales..."></textarea>
          </div>
          
          <div class="modal-actions">
            <button type="button" class="btn-modal btn-secondary" onclick="cerrarModal('modal-nueva-reserva')">Cancelar</button>
            <button type="submit" class="btn-modal btn-success">💾 Crear Reserva</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Set fecha y hora por defecto
  document.getElementById('new-fecha').value = hoy;
  document.getElementById('new-hora').value = horaActual;
  
  document.getElementById('form-nueva-reserva').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const tipo = document.getElementById('new-tipo').value;
      let notasEspeciales = document.getElementById('new-notas').value;
      
      // Si es un servicio especial, agregar metadata
      if (tipo !== 'mesa') {
        const metadata = {
          tipo_servicio: tipo,
          detalles: {}
        };
        notasEspeciales = JSON.stringify(metadata);
      }
      
      const data = {
        nombre_reserva: document.getElementById('new-nombre').value,
        email_reserva: document.getElementById('new-email').value,
        telefono_reserva: document.getElementById('new-telefono').value,
        fecha: document.getElementById('new-fecha').value,
        hora: document.getElementById('new-hora').value,
        numero_personas: parseInt(document.getElementById('new-personas').value),
        mesa_asignada: document.getElementById('new-mesa').value,
        zona_mesa: document.getElementById('new-zona').value,
        estado: document.getElementById('new-estado').value,
        total_reserva: parseFloat(document.getElementById('new-total').value || 0),
        metodo_pago: document.getElementById('new-metodo-pago').value,
        notas_especiales: notasEspeciales
      };
      
      await API.post('/api/reservas/crear', data);
      showToast('✅ Reserva creada exitosamente', 'success');
      cerrarModal('modal-nueva-reserva');
      cargarReservas();
    } catch (err) {
      showToast('❌ Error: ' + err.message, 'error');
    }
  };
};

// ========================================
// UTILIDADES
// ========================================
function mostrarCargando() {
  document.getElementById('reservas-table-container').innerHTML = `
    <div class="loading-spinner">
      <div class="spinner"></div>
      <p>Cargando reservas...</p>
    </div>
  `;
}

function mostrarError(mensaje) {
  document.getElementById('reservas-table-container').innerHTML = `
    <div class="no-data-message">
      <div style="font-size: 4rem; color: #f44336;">❌</div>
      <p style="color: #f44336;">${mensaje}</p>
      <button class="btn-action btn-refresh" onclick="cargarReservas()" style="margin-top: 20px;">
        🔄 Reintentar
      </button>
    </div>
  `;
}

function cerrarModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.remove();
}

function cerrarSiClickFuera(event, modalId) {
  if (event.target.classList.contains('modal-overlay')) {
    cerrarModal(modalId);
  }
}

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

// ========================================
// FUNCIÓN HELPER PARA FORMATEO DE FECHAS
// ========================================
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('es-ES', options);
  } catch (e) {
    return dateString;
  }
}

// Inicialización
window.reservasModuleLoaded = true;
cargarReservas();
